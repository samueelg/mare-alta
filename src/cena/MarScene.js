// Cena do mar (Phaser 3, visão de cima, pixel art). Só desenha e lê o teclado:
// toda decisão de regra é delegada a src/regras (expedicao.js, eventos.js e minijogo.js).
//
// Dados recebidos em scene.start('Mar', dados):
//   estado, exp           -> estado do jogo e expedição atual
//   aoMudanca(exp)        -> Promise; o controlador mostra o rádio de mudança e aplica a decisão
//   aoTerminar({tempoUsado, motivo})

import { CONFIG, ESPECIES } from '../regras/config.js';
import { mediaTripulacao } from '../regras/estado.js';
import { sumirCardume, surgirCardume } from '../regras/eventos.js';
import {
  consumirCombustivel,
  estimativaCardume,
  limiteTensao,
  pescarPeixe,
  registrarLinhaArrebentada,
  specVigente,
} from '../regras/expedicao.js';
import { atualizarMinijogo, criarMinijogo } from '../regras/minijogo.js';
import { CORES, FONTE, H, TOPO, W, atualizarTexto, flutuar, kg, prepararCamera, real } from './comum.js';
import { COR, S, TINTA, hex, registrarTexturas, texturaVeuNevoa } from './pixel.js';
import { Faixa, LinhaIcones, barra, barraTopo, caixa, dicaRodape } from './ui.js';
import { ambiente, som } from './som.js';

const PORTO_X = 120; // onde termina a areia
const COSTA_MIN = PORTO_X + 27; // o barco não passa daqui (não navega sobre a areia)
const LINHA_ATRACAR = PORTO_X + 48; // voltando à costa até aqui, o barco atraca sozinho (boias marcam a linha)
const AFASTOU = PORTO_X + 110; // só atraca sozinho depois de ter saído da costa
const RAIO_PESCA = 48;
const tamanhoCardume = (q) => (q <= 2 ? 'p' : q <= 4 ? 'm' : 'g');

export class MarScene extends Phaser.Scene {
  constructor() {
    super('Mar');
  }

  init(dados) {
    Object.assign(this, dados);
    this.tempo = 0;
    this.pausado = false;
    this.encerrado = false;
    this.minijogo = null;
    this.cardumeAlvo = null;
    this.vel = { x: 0, y: 0 };
    this.limite = limiteTensao(this.estado);
    this.clima = this.exp.clima;
    this.mudancaEm = this.exp.mudanca ? this.exp.pedido.mudanca.emFracao * this.exp.prazo : null;
    this.douradoAte = null;
  }

  create() {
    prepararCamera(this);
    registrarTexturas(this);
    ambiente('mar');

    this.ondas = this.add.tileSprite(0, 0, W, H, 'agua').setOrigin(0);

    // Porto
    this.add.tileSprite(0, 0, PORTO_X, H, 'areia').setOrigin(0);
    this.add.tileSprite(PORTO_X - 9, 0, 15, H, 'margem').setOrigin(0);
    this.add.image(PORTO_X - 9, 210, 'pierMar').setOrigin(0).setDepth(2);
    const t = this.add.text(0, 0, 'Porto', { ...FONTE.clara, fontStyle: 'bold' }).setOrigin(0.5).setDepth(6);
    caixa(this, 15, H - 102, 90, 30, 'madeira').setDepth(5);
    t.setPosition(60, H - 87);
    this.add.text(60, H - 57, 'volte às boias\npara atracar', { ...FONTE.clara, fontSize: '12px', align: 'center' }).setOrigin(0.5, 0).setDepth(6);

    // Boias vermelhas e brancas na linha de atracação
    const g = this.add.graphics().setDepth(3);
    for (let y = TOPO + 36; y < H - 18; y += 63) {
      g.fillStyle(hex(COR.k)).fillRect(LINHA_ATRACAR - 6, y - 6, 12, 12);
      g.fillStyle(hex(COR.v1)).fillRect(LINHA_ATRACAR - 3, y - 3, 6, 6);
      g.fillStyle(hex(COR.c3)).fillRect(LINHA_ATRACAR - 3, y - 3, 6, 3);
    }
    this.saiuDaCosta = false;

    // Cardumes
    this.sprCardumes = new Map();
    for (const c of this.exp.cardumes) if (c.quantidade > 0) this.criarCardume(c);

    this.barco = this.add.image(PORTO_X + 39, H / 2, 'barcoH').setDepth(5);

    // Neblina: véu pontilhado que acompanha o barco, com uma bolha de visibilidade do tamanho do
    // alcance do sonar, e nuvens de névoa passando por cima (ver atualizarNeblina)
    if (this.clima.alcanceSonar) {
      this.add.rectangle(PORTO_X, 0, W - PORTO_X, H, hex(COR.c2), 0.1).setOrigin(0).setDepth(4);
      this.veu = this.add.image(0, 0, texturaVeuNevoa(this, this.clima.alcanceSonar)).setAlpha(0.88).setDepth(4);
      this.nuvens = this.add.tileSprite(PORTO_X, TOPO, W - PORTO_X, H - TOPO, 'nuvensNevoa').setOrigin(0).setAlpha(0.55).setDepth(4.1);
    }

    this.atualizarNeblina();
    this.agendarPulo();

    this.criarHud();
    this.criarMinijogoUi();

    this.teclas = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E');
    // Eventos 'down' em vez de JustDown: JustDown perde toques rápidos (tecla desce e sobe no mesmo quadro)
    this.acoes = new Set();
    this.teclas.SPACE.on('down', () => this.acoes.add('lancar'));
    this.teclas.E.on('down', () => this.acoes.add('atracar'));
    this.atualizarHud();
    flutuar(this, W / 2, TOPO + 75, `Hoje: ${this.clima.nome}`, CORES.alerta, 2500);
  }

  // ------------------------------------------------------------------ cardumes

  criarCardume(c) {
    const tam = tamanhoCardume(c.quantidade);
    const dourado = c.evento === 'dourado';
    const cont = this.add.container(c.x, c.y).setDepth(2);
    const mancha = this.add.image(0, 0, `${dourado ? 'cardumeDourado' : 'cardume'}-${tam}`);
    const anel = this.add.image(0, 0, `anel-${tam}`).setVisible(false);
    cont.add([mancha, anel]);
    const r = mancha.width / 2;
    for (let i = 0; i < 2; i++) {
      const bolha = this.add.image(Math.round((i ? 0.4 : -0.3) * r / S) * S, 0, 'ico-bolha');
      cont.add(bolha);
      this.tweens.add({ targets: bolha, y: -r * 0.7, alpha: 0, duration: 1300, delay: i * 600, repeat: -1, ease: 'Stepped', easeParams: [6] });
    }
    if (dourado) {
      const brilho = this.add.image(r * 0.5, -r * 0.4, 'ico-brilho');
      cont.add(brilho);
      this.tweens.add({ targets: brilho, alpha: 0.2, duration: 400, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [2] });
    }
    this.tweens.add({ targets: anel, alpha: 0.4, duration: 500, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [2] });

    // Gaivotas circulando: ficam acima da neblina (são a pista visual do evento)
    let aves = null;
    if (c.evento === 'gaivotas') {
      aves = this.add.container(c.x, c.y - 9).setDepth(6);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const g = this.add.image(Math.round((Math.cos(a) * 33) / S) * S, Math.round((Math.sin(a) * 21) / S) * S, 'ico-gaivota0');
        this.time.addEvent({ delay: 220 + i * 40, loop: true, callback: () => g.setTexture(g.texture.key === 'ico-gaivota0' ? 'ico-gaivota1' : 'ico-gaivota0') });
        aves.add(g);
      }
      this.tweens.add({ targets: aves, x: c.x + 12, duration: 900, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [4] });
    }

    const rotulo = this.add.text(c.x, c.y + mancha.height / 2 + 3, '', { ...FONTE.clara, fontSize: '12px', align: 'center' }).setOrigin(0.5, 0).setDepth(3);
    this.sprCardumes.set(c.id, { cont, anel, rotulo, aves, mancha, tam });
    this.atualizarCardume(c);
  }

  atualizarCardume(c) {
    const spr = this.sprCardumes.get(c.id);
    if (!spr) return;
    if (c.quantidade <= 0) {
      spr.cont.destroy();
      spr.rotulo.destroy();
      spr.aves?.destroy();
      this.sprCardumes.delete(c.id);
      return;
    }
    // a mancha encolhe conforme o cardume é pescado
    const tam = tamanhoCardume(c.quantidade);
    if (tam !== spr.tam) {
      spr.tam = tam;
      spr.mancha.setTexture(`${c.evento === 'dourado' ? 'cardumeDourado' : 'cardume'}-${tam}`);
      spr.anel.setTexture(`anel-${tam}`);
    }
    if (c.evento === 'dourado') {
      const resta = this.douradoAte ? Math.max(0, Math.ceil(this.douradoAte - this.tempo)) : 0;
      atualizarTexto(spr.rotulo, `${ESPECIES.garoupa.nome}\nsome em ${resta} s`);
      return;
    }
    // Sonar: com o pedido esclarecido (REQ), o jogador sabe o que procurar
    const conhecida = this.exp.especificacaoConhecida;
    spr.anel.setVisible(conhecida && c.especie === specVigente(this.exp).especie);
    const linhas = [conhecida ? ESPECIES[c.especie].nome : '?'];
    // Diário de bordo (GPR): estimativa por cardume
    const est = estimativaCardume(this.estado, c);
    if (est) linhas.push(`${est.min.toFixed(1)}–${est.max.toFixed(1)} kg`);
    atualizarTexto(spr.rotulo, linhas.join('\n'));
  }

  atualizarTodosCardumes() {
    for (const c of this.exp.cardumes) this.atualizarCardume(c);
  }

  // Neblina: cardume longe do barco fica invisível (o sonar não alcança)
  atualizarNeblina() {
    const alcance = this.clima.alcanceSonar;
    if (!alcance) return;

    // o véu acompanha o barco (de pixel em pixel) e não cobre a areia do porto
    const vx = Math.round(this.barco.x / S) * S;
    const vy = Math.round(this.barco.y / S) * S;
    this.veu.setPosition(vx, vy);
    const esquerda = vx - this.veu.width / 2;
    const corte = Math.max(0, PORTO_X - esquerda);
    this.veu.setCrop(corte, 0, this.veu.width - corte, this.veu.height);
    this.nuvens.tilePositionX = Math.floor(this.tempo * 4) * S; // névoa passando devagar
    this.nuvens.tilePositionY = Math.floor(this.tempo * 0.7) * S;

    for (const c of this.exp.cardumes) {
      const spr = this.sprCardumes.get(c.id);
      if (!spr) continue;
      const d = Math.hypot(c.x - this.barco.x, c.y - this.barco.y);
      const alfa = Math.round(Phaser.Math.Clamp((alcance - d) / 60, 0, 1) * 3) / 3; // em degraus, como pixel art
      spr.cont.setAlpha(alfa);
      spr.rotulo.setAlpha(alfa);
    }
  }

  // ------------------------------------------------------------------ peixes pulando (só enfeite)
  // Usa Math.random (não o rng da partida) para não mudar o jogo repetido com ?semente=N.

  agendarPulo() {
    this.time.delayedCall(Phaser.Math.Between(3000, 7000), () => {
      if (this.encerrado) return;
      if (!this.pausado) this.pularPeixe();
      this.agendarPulo();
    });
  }

  pularPeixe() {
    // metade das vezes perto de um cardume (pista de onde tem peixe); senão, em qualquer ponto do mar
    const vivos = this.exp.cardumes.filter((c) => c.quantidade > 0);
    let x;
    let y;
    let cor = null;
    if (vivos.length && Math.random() < 0.5) {
      const c = Phaser.Utils.Array.GetRandom(vivos);
      x = c.x + Phaser.Math.Between(-27, 27);
      y = c.y + Phaser.Math.Between(-15, 15);
      cor = ESPECIES[c.especie].cor;
    } else {
      x = Phaser.Math.Between(LINHA_ATRACAR + 60, W - 45);
      y = Phaser.Math.Between(TOPO + 45, H - 75);
    }
    const passo = (v) => Math.round(v / S) * S;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const dist = Phaser.Math.Between(27, 48);
    const altura = Phaser.Math.Between(18, 33);
    x = passo(x);
    y = passo(y);

    const peixe = this.add.image(x, y, 'peixePulo', 0).setDepth(3.5).setFlipX(dir > 0);
    if (cor) peixe.setTint(cor);
    this.respingo(x, y, false);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 700,
      onUpdate: (tw) => {
        const t = tw.getValue();
        peixe.setPosition(passo(x + dir * dist * t), passo(y - altura * 4 * t * (1 - t)));
        peixe.setFrame(t < 0.38 ? 0 : t < 0.62 ? 1 : 2);
      },
      onComplete: () => {
        peixe.destroy();
        this.respingo(passo(x + dir * dist), y, true);
      },
    });
  }

  // Ondinha que abre na água + gotas; o som cai com a distância (e some na neblina fechada)
  respingo(x, y, comSom) {
    const onda = this.add.image(x, y + S, 'ondinha-0').setDepth(3.4);
    [1, 2].forEach((i) => this.time.delayedCall(i * 130, () => onda.active && onda.setTexture(`ondinha-${i}`)));
    this.tweens.add({ targets: onda, alpha: 0, delay: 260, duration: 260, onComplete: () => onda.destroy() });
    const gotas = this.add.image(x, y - S, 'gotas').setDepth(3.5);
    this.tweens.add({ targets: gotas, y: y - 4 * S, alpha: 0, duration: 380, ease: 'Stepped', easeParams: [3], onComplete: () => gotas.destroy() });
    if (comSom) {
      const d = Math.hypot(x - this.barco.x, y - this.barco.y);
      const vol = Phaser.Math.Clamp(1 - d / 700, 0.25, 1) * (this.clima.alcanceSonar ? 0.7 : 1);
      som.respingo(vol);
    }
  }

  // ------------------------------------------------------------------ eventos aleatórios durante a viagem

  verificarEventos() {
    const ev = this.exp.eventosMar;
    const fracao = this.tempo / this.exp.prazo;

    if (ev.gaivotas && !ev.gaivotas.ocorreu && fracao >= ev.gaivotas.em) {
      const c = surgirCardume(this.exp, 'gaivotas');
      this.criarCardume(c);
      som.gaivota(1.4);
      this.time.delayedCall(900, () => som.gaivota(1.1));
      flutuar(this, c.x, c.y - 45, 'Gaivotas mergulhando: cardume novo!', CORES.neutro, 2500);
    }

    if (ev.dourado && !ev.dourado.ocorreu && fracao >= ev.dourado.em) {
      this.douradoAte = this.tempo + ev.dourado.duracao;
      const c = surgirCardume(this.exp, 'dourado');
      this.criarCardume(c);
      this.cameras.main.flash(250, 242, 193, 78);
      flutuar(this, c.x, c.y - 48, `Cardume dourado! Some em ${ev.dourado.duracao} s`, CORES.ouro, 3000);
    }

    if (this.douradoAte) {
      const c = this.exp.cardumes.find((cc) => cc.evento === 'dourado');
      if (c.quantidade <= 0) {
        this.douradoAte = null;
      } else if (this.tempo >= this.douradoAte && this.cardumeAlvo !== c) {
        sumirCardume(c);
        this.atualizarCardume(c);
        flutuar(this, c.x, c.y, 'O cardume dourado mergulhou…', CORES.alerta);
        this.douradoAte = null;
      } else {
        this.atualizarCardume(c); // contagem regressiva
      }
    }
  }

  // ------------------------------------------------------------------ HUD

  criarHud() {
    barraTopo(this, TOPO);
    this.hudEsq1 = new LinhaIcones(this, 15, 17, { alinhar: 'esq' });
    this.hudEsq2 = new LinhaIcones(this, 15, 42, { alinhar: 'esq' });
    this.hudDir2 = new LinhaIcones(this, W - 15, 42);
    this.faixa = new Faixa(this, W / 2, TOPO / 2);
    // combustível: ícone + barra
    this.add.image(W - 162, 17, 'ico-combustivel').setOrigin(0, 0.5).setDepth(21);
    this.barraComb = barra(this, W - 132, 9, 117, 18);
    this.dica = dicaRodape(this, 'WASD: navegar  ·  ESPAÇO perto de um cardume: pescar  ·  volte às boias para atracar');
  }

  atualizarHud() {
    const exp = this.exp;
    const spec = specVigente(exp);
    const restante = Math.max(0, Math.ceil(exp.prazo - this.tempo));
    this.hudEsq1.set([{ icone: 'relogio', texto: `${restante} s`, cor: restante <= 15 ? COR.v3 : undefined }]);
    this.hudEsq2.set([{ icone: this.clima.icone, texto: this.clima.nome }]);

    const meta = exp.especificacaoConhecida
      ? `Meta: ${exp.meta} kg de ${ESPECIES[spec.especie].nome} (${spec.tamanhoMin} cm ou mais)`
      : `Meta: ${exp.meta} kg de "peixe bom"`;
    this.faixa.set(meta, `Expedição ${exp.numero} · ${exp.pedido.cliente}`);

    const peso = exp.porao.reduce((s, p) => s + p.peso, 0);
    let porao = `${kg(peso)} · ${exp.porao.length} peixes`;
    if (this.estado.processos.checklistTriagem) {
      const ok = exp.porao.filter((p) => p.verificacao?.ok).length;
      porao += ` · ok ${ok} / fora ${exp.porao.length - ok}`;
    }
    const itens = [{ icone: 'caixote', texto: porao }];
    if (exp.trofeus.length) itens.push({ icone: 'brilho', texto: String(exp.trofeus.length), cor: COR.y2 });
    this.hudDir2.set(itens);

    const frac = exp.combustivel / Math.max(1, exp.combustivelInicial);
    this.barraComb.set(frac, frac > 0.5 ? COR.g2 : frac > 0.2 ? COR.y2 : COR.v2);
  }

  // ------------------------------------------------------------------ minijogo de tensão

  criarMinijogoUi() {
    const larg = 402;
    const x0 = Math.round((W - larg) / 2 / S) * S;
    const y0 = H - 123;
    this.mj = { x0, y0 };
    const ui = this.add.container(0, 0).setDepth(22).setVisible(false);
    ui.add(caixa(this, x0, y0, larg, 108, 'pergaminho'));
    ui.add(this.add.text(x0 + 27, y0 + 18, 'Tensão da linha', { ...FONTE.base, fontSize: '13px', fontStyle: 'bold' }));
    ui.add(this.add.text(x0 + 27, y0 + 51, 'Peixe chegando', { ...FONTE.base, fontSize: '13px', fontStyle: 'bold' }));
    ui.add(this.add.text(W / 2, y0 + 87, 'Segure ESPAÇO para puxar · solte quando a linha esticar', { ...FONTE.base, fontSize: '12px', color: TINTA.media }).setOrigin(0.5));
    this.uiMinijogo = ui;
    this.barraTensao = barra(this, x0 + 51, y0 + 33, 300, 18, 23);
    this.barraProg = barra(this, x0 + 51, y0 + 66, 300, 15, 23);
    this.barraTensao.g.setVisible(false);
    this.barraProg.g.setVisible(false);
  }

  mostrarMinijogo(v) {
    this.uiMinijogo.setVisible(v);
    this.barraTensao.g.setVisible(v);
    this.barraProg.g.setVisible(v);
    this.dica.setVisible(!v);
  }

  iniciarPesca(cardume) {
    this.minijogo = criarMinijogo(this.limite, this.estado.rng, { puxarMult: this.clima.puxarMult });
    this.cardumeAlvo = cardume;
    this.vel = { x: 0, y: 0 };
    this.mostrarMinijogo(true);
    som.lancar();
  }

  atualizarPesca(dt) {
    const m = atualizarMinijogo(this.minijogo, dt, this.teclas.SPACE.isDown, this.estado.rng);

    // Tripulação cansada: a barra treme (o erro vem "na mão" do jogador)
    const fadiga = mediaTripulacao(this.estado, 'fadiga');
    const tremor = fadiga > 50 ? Math.round((fadiga - 50) / 15) * S : 0;
    const dx = tremor ? Phaser.Math.Between(-1, 1) * tremor : 0;
    this.uiMinijogo.x = dx;
    this.barraTensao.g.x = dx;
    this.barraProg.g.x = dx;

    const perto = m.tensao / m.limite;
    // zona vermelha: do limite (que depende da tripulação) até 100
    this.barraTensao.set(m.tensao / 100, perto < 0.6 ? COR.g2 : perto < 0.85 ? COR.y2 : COR.v2, (g, x, y, larg, alt) => {
      const xl = x + Math.round((larg * m.limite) / 100 / S) * S;
      g.fillStyle(hex(COR.v0), 0.7).fillRect(xl, y, x + larg - xl, alt);
      for (let i = xl; i < x + larg; i += 2 * S) g.fillStyle(hex(COR.v1), 0.8).fillRect(i, y, S, alt); // listras
    });
    this.barraProg.set(m.progresso / 100, COR.b2);

    if (!m.resultado) return;

    const { x, y } = this.barco;
    if (m.resultado === 'pescou') this.mostrarCaptura(pescarPeixe(this.estado, this.exp, this.cardumeAlvo));
    else if (m.resultado === 'arrebentou') {
      registrarLinhaArrebentada(this.estado, this.exp);
      this.cameras.main.shake(200, 0.006);
      flutuar(this, x, y - 24, 'A linha arrebentou!', CORES.ruim);
    } else {
      flutuar(this, x, y - 24, 'O peixe escapou', CORES.alerta);
    }
    this.atualizarCardume(this.cardumeAlvo);
    this.minijogo = null;
    this.cardumeAlvo = null;
    this.mostrarMinijogo(false);
  }

  mostrarCaptura({ peixes, trofeu, dobro }) {
    const { x, y } = this.barco;
    som.fisgado();
    if (trofeu) {
      this.time.delayedCall(320, () => som.dinheiro());
      this.cameras.main.flash(300, 242, 193, 78);
      flutuar(this, x, y - 27, `${ESPECIES.garoupa.nome}! ${trofeu.peso.toFixed(1)} kg\nO colecionador paga ${real(CONFIG.eventos.peixeEspecial.valor)}`, CORES.ouro, 2600);
      return;
    }
    peixes.forEach((p, i) => {
      let cor = CORES.neutro;
      let marca = '';
      if (p.verificacao) {
        cor = p.verificacao.ok ? CORES.ok : CORES.ruim;
        marca = p.verificacao.ok ? ' (ok)' : ` (${p.verificacao.motivo})`;
      }
      flutuar(this, x, y - 24 - i * 24, `${ESPECIES[p.especie].nome} ${p.tamanho} cm · ${p.peso.toFixed(1)} kg${marca}`, cor);
    });
    if (dobro) {
      flutuar(this, x, y - 75, 'Pesca em dobro!', CORES.ouro, 2000);
      this.time.delayedCall(300, () => som.fisgado());
    }
  }

  // ------------------------------------------------------------------ navegação

  navegar(dt) {
    const t = this.teclas;
    const ax = (t.D.isDown || t.RIGHT.isDown ? 1 : 0) - (t.A.isDown || t.LEFT.isDown ? 1 : 0);
    const ay = (t.S.isDown || t.DOWN.isDown ? 1 : 0) - (t.W.isDown || t.UP.isDown ? 1 : 0);
    const ACEL = 420;
    const MAX = 170;
    this.vel.x += ax * ACEL * dt;
    this.vel.y += ay * ACEL * dt;
    const atrito = Math.pow(0.3, dt);
    this.vel.x *= atrito;
    this.vel.y *= atrito;
    const v = Math.hypot(this.vel.x, this.vel.y);
    if (v > MAX) {
      this.vel.x *= MAX / v;
      this.vel.y *= MAX / v;
    }

    const antes = { x: this.barco.x, y: this.barco.y };
    this.barco.x = Phaser.Math.Clamp(this.barco.x + this.vel.x * dt, COSTA_MIN, W - 39);
    this.barco.y = Phaser.Math.Clamp(this.barco.y + this.vel.y * dt, TOPO + 39, H - 39);
    if (this.barco.x === COSTA_MIN && this.vel.x < 0) this.vel.x = 0; // encosta na costa e para
    // 4 direções desenhadas (pixel art não gira): horizontal ou vertical, espelhado
    if (v > 8) {
      if (Math.abs(this.vel.x) >= Math.abs(this.vel.y)) this.barco.setTexture('barcoH').setFlipX(this.vel.x < 0).setFlipY(false);
      else this.barco.setTexture('barcoV').setFlipY(this.vel.y > 0).setFlipX(false);
    }

    const andou = Math.hypot(this.barco.x - antes.x, this.barco.y - antes.y);
    if (andou > 0 && consumirCombustivel(this.exp, andou)) {
      this.encerrar('combustivel');
      return;
    }

    // Atracar automático: depois de sair para o mar, voltar até as boias encerra a viagem
    if (this.barco.x > AFASTOU) this.saiuDaCosta = true;
    if (this.saiuDaCosta && this.barco.x <= LINHA_ATRACAR) {
      this.encerrar('porto');
      return;
    }

    if (this.acoes.has('lancar')) {
      // o cardume mais próximo do barco dentro do alcance da linha
      let alvo = null;
      let menor = RAIO_PESCA;
      for (const c of this.exp.cardumes) {
        const d = Math.hypot(c.x - this.barco.x, c.y - this.barco.y);
        if (c.quantidade > 0 && d < menor) [alvo, menor] = [c, d];
      }
      if (alvo) this.iniciarPesca(alvo);
      else flutuar(this, this.barco.x, this.barco.y - 27, 'Chegue mais perto de um cardume', CORES.alerta);
    }
    // E continua funcionando perto da costa (ex.: para voltar logo depois de sair, sem ter se afastado)
    if (this.acoes.has('atracar')) {
      if (this.barco.x <= LINHA_ATRACAR + 30) this.encerrar('porto');
      else flutuar(this, this.barco.x, this.barco.y - 27, 'Volte até as boias para atracar', CORES.alerta);
    }
  }

  // ------------------------------------------------------------------ loop

  update(_t, deltaMs) {
    if (this.encerrado || this.pausado) return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.tempo += dt;
    this.ondas.tilePositionX = Math.floor(this.tempo * 3) * S; // a água anda de pixel em pixel
    this.ondas.tilePositionY = Math.floor(this.tempo) * S;

    // Rádio: pedido de mudança no meio da viagem (pausa o jogo até a decisão)
    if (this.mudancaEm !== null && !this.exp.mudanca.ocorreu && this.tempo >= this.mudancaEm && !this.minijogo) {
      this.pausar();
      this.aoMudanca(this.exp).then(() => this.retomar());
      return;
    }

    if (this.tempo >= this.exp.prazo) {
      this.encerrar('prazo');
      return;
    }

    this.verificarEventos();
    if (this.minijogo) this.atualizarPesca(dt);
    else this.navegar(dt);
    this.atualizarNeblina();
    this.acoes.clear();
    if (!this.encerrado) this.atualizarHud();
  }

  pausar() {
    this.pausado = true;
    this.input.keyboard.enabled = false;
    this.input.keyboard.disableGlobalCapture(); // deixa o teclado livre para o HTML
  }

  retomar() {
    this.input.keyboard.enabled = true;
    this.input.keyboard.enableGlobalCapture();
    this.input.keyboard.resetKeys();
    this.atualizarTodosCardumes(); // a espécie-alvo pode ter mudado
    this.atualizarHud();
    this.pausado = false;
  }

  encerrar(motivo) {
    if (this.encerrado) return;
    this.encerrado = true;
    const tempoUsado = Math.min(this.tempo, this.exp.prazo);
    const textos = { porto: 'Atracado!', prazo: 'Fim do prazo: voltando ao porto', combustivel: 'Sem combustível: chamando reboque' };
    flutuar(this, W / 2, H / 2, textos[motivo], motivo === 'porto' ? CORES.ok : CORES.ruim);
    this.time.delayedCall(900, () => {
      this.scene.stop();
      this.aoTerminar({ tempoUsado, motivo });
    });
  }
}
