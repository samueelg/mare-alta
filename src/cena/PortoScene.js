// Cena do porto (lobby visto de cima, pixel art). O jogador anda com um pescador e resolve tudo
// falando com as pessoas e usando os lugares do porto. A cena só desenha e lê o teclado:
// toda regra é chamada em src/regras/expedicao.js.
//
// Duas fases (scene.start('Porto', dados)):
//   'saida'   -> cliente na praça (pedido: REQ) · bomba (combustível: GPR) · escritório (processos: MR-MPS-SW)
//                · taverna (tripulação: MR-MPS-RH) · barco (escolher a jornada e zarpar)
//   'chegada' -> bancada (triagem = verificação, opcional) · cliente (entrega = validação) · colecionador
//
// Dados: fase, estado, exp, descanso (opcional: resultado de descansar() para animar demissões)
//   abrirEscritorio() -> Promise   (modal HTML dos processos)
//   aoConcluir(valor)              saida: { jornada }   chegada: resultado de entregar()

import { CONFIG, ESPECIES } from '../regras/config.js';
import { nivelMaturidade } from '../regras/processos.js';
import {
  abastecer,
  contratar,
  conversarComCliente,
  entregar,
  limiteTensao,
  podeZarpar,
  prazoDaJornada,
  previsao,
  previsaoCombustivel,
  receberPedido,
  salarios,
  specVigente,
  triagemAutomatica,
  triar,
} from '../regras/expedicao.js';
import { CORES, FONTE, H, TOPO, W, atualizarTexto, flutuar, kg, prepararCamera, real } from './comum.js';
import { COR, S, TINTA, hex, registrarTexturas } from './pixel.js';
import { Aviso, Dialogo, Faixa, LinhaIcones, Ponteiro, barra, barraTopo, caixa } from './ui.js';
import { ambiente, som } from './som.js';

const MAR_X = 702;
const PIER = { x: 690, y: 258, w: 180, h: 48 };
const RAIO = 11;
const VELOCIDADE = 190;

const PREDIOS = {
  escritorio: { x: 39, y: 78, w: 192, h: 105, placa: 'Escritório' },
  mercado: { x: 288, y: 78, w: 192, h: 81, placa: 'Mercado' },
  taverna: { x: 39, y: 363, w: 192, h: 105, placa: 'Taverna' },
};
const BOMBA = { x: 600, y: 111, w: 45, h: 57 };
const BANCADA = { x: 558, y: 399, w: 111, h: 36 };

// Enfeites: (x, y) é o pé do objeto. Os sólidos entram na colisão.
const ENFEITES = [
  { ico: 'barril', x: 498, y: 159, solido: true },
  { ico: 'barril', x: 522, y: 150, solido: true },
  { ico: 'caixote', x: 666, y: 141, solido: true },
  { ico: 'caixote', x: 684, y: 162, solido: true },
  { ico: 'barril', x: 21, y: 351, solido: true },
  { ico: 'poste', x: 252, y: 225, solido: true },
  { ico: 'poste', x: 588, y: 225, solido: true },
  { ico: 'poste', x: 252, y: 417, solido: true },
  { ico: 'corda', x: 720, y: 303 },
  { ico: 'pedra', x: 684, y: 363 },
  { ico: 'pedra', x: 690, y: 483 },
  { ico: 'pedra', x: 681, y: 228 },
];

const SOLIDOS = [
  ...Object.values(PREDIOS),
  BOMBA,
  BANCADA,
  ...ENFEITES.filter((e) => e.solido).map((e) => ({ x: e.x - 9, y: e.y - 12, w: 18, h: 12 })),
];

// Pontos de interação. O do cliente acompanha o boneco dele.
const LUGARES = {
  escritorio: { x: 135, y: 201, raio: 42, tecla: 'E', rotulo: 'entrar no escritório' },
  taverna: { x: 135, y: 489, raio: 42, tecla: 'E', rotulo: 'falar com a tripulação' },
  colecionador: { x: 384, y: 180, raio: 40, tecla: 'E', rotulo: 'falar com o colecionador' },
  bomba: { x: 621, y: 192, raio: 42, tecla: 'segure E', rotulo: 'abastecer' },
  bancada: { x: 612, y: 384, raio: 46, tecla: 'E', rotulo: 'usar a bancada de triagem' },
  barco: { x: 858, y: 282, raio: 46, tecla: 'E', rotulo: 'embarcar' },
  cliente: { x: 420, y: 303, raio: 46, tecla: 'E', rotulo: 'falar com o cliente' },
};

const descSpec = (spec, meta) => `${meta} kg de ${ESPECIES[spec.especie].nome} com pelo menos ${spec.tamanhoMin} cm, sem machucados`;
const profundidade = (y) => 10 + y / 100; // quem está mais embaixo aparece na frente

export class PortoScene extends Phaser.Scene {
  constructor() {
    super('Porto');
  }

  init(dados) {
    Object.assign(this, dados);
    this.modalAberto = false;
    this.concluido = false;
    this.entregue = false;
    this.bufferComb = 0;
    this.ultimoAviso = 0;
    this.passo = 0;
    this.tempoAgua = 0;
  }

  create() {
    prepararCamera(this);
    registrarTexturas(this);
    ambiente('porto');
    this.desenharCenario();

    // Cliente: na saída ele chega andando; na chegada já está esperando a entrega
    const chegando = this.fase === 'saida';
    this.cliente = this.boneco('cliente', chegando ? -20 : LUGARES.cliente.x, LUGARES.cliente.y);
    this.nomeCliente = this.add.text(0, 0, this.exp.pedido.cliente, { ...FONTE.clara, fontSize: '12px' }).setOrigin(0.5, 1).setDepth(18);
    if (chegando) {
      this.cliente.setFrame(4);
      this.tweens.add({
        targets: [this.cliente, this.cliente.sombra],
        x: LUGARES.cliente.x,
        duration: 1800,
        onUpdate: (tw) => this.cliente.setFrame(4 + (Math.floor(tw.elapsed / 160) % 2)),
        onComplete: () => this.cliente.setFrame(0),
      });
    }
    this.colecionador = this.boneco('colecionador', LUGARES.colecionador.x, LUGARES.colecionador.y - 6);

    this.criarTripulacao();

    // Pescador: sai do barco na chegada; na saída, começa na praça
    const inicio = this.fase === 'chegada' ? { x: 840, y: 282 } : { x: 330, y: 306 };
    this.jogador = this.boneco('pescador', inicio.x, inicio.y);
    this.carga = null;
    if (this.fase === 'chegada' && (this.exp.porao.length || this.exp.trofeus.length)) {
      this.carga = this.add.image(inicio.x - 18, inicio.y, 'ico-caixote').setOrigin(0.5, 1);
      this.desenharPeixesNaBancada();
    }

    this.criarHud();
    this.criarPainelBomba();
    this.dialogo = new Dialogo(this);
    this.aviso = new Aviso(this);
    this.ponteiro = new Ponteiro(this);

    this.teclas = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E');
    this.acoes = new Set();
    const aoTeclar = (ev) => {
      if (ev.repeat) return;
      const mapa = { KeyE: 'interagir', Escape: 'esc', Digit1: '1', Digit2: '2', Digit3: '3', Numpad1: '1', Numpad2: '2', Numpad3: '3' };
      if (mapa[ev.code]) this.acoes.add(mapa[ev.code]);
    };
    this.input.keyboard.on('keydown', aoTeclar);
    this.events.once('shutdown', () => this.input.keyboard.off('keydown', aoTeclar));

    this.anunciarInicio();
    this.atualizarHud();
  }

  // Personagem com sombra; (x, y) é o pé.
  boneco(textura, x, y) {
    const sombra = this.add.image(x, y, 'ico-sombra').setDepth(9);
    const b = this.add.image(x, y + 3, textura, 0).setOrigin(0.5, 1).setDepth(profundidade(y));
    b.sombra = sombra;
    return b;
  }

  moverBoneco(b, x, y) {
    b.setPosition(x, y + 3).setDepth(profundidade(y));
    b.sombra.setPosition(x, y);
  }

  // ------------------------------------------------------------------ cenário

  desenharCenario() {
    this.add.tileSprite(0, 0, MAR_X, H, 'areia').setOrigin(0);
    this.ondas = this.add.tileSprite(MAR_X, 0, W - MAR_X, H, 'agua').setOrigin(0);
    this.add.tileSprite(MAR_X - 9, 0, 15, H, 'margem').setOrigin(0);
    this.add.image(255, 219, 'praca').setOrigin(0);

    // tufos de grama em lugares livres (sempre os mesmos)
    let semente = 7;
    const aleat = () => ((semente = (semente * 9301 + 49297) % 233280) / 233280);
    for (let i = 0, n = 0; i < 200 && n < 16; i++) {
      const x = Math.round((30 + aleat() * (MAR_X - 60)) / S) * S;
      const y = Math.round((TOPO + 20 + aleat() * (H - TOPO - 30)) / S) * S;
      const naPraca = x > 250 && x < 590 && y > 214 && y < 410;
      if (!naPraca && this.livre(x, y)) {
        this.add.image(x, y, 'ico-tufo').setDepth(1);
        n++;
      }
    }

    // píer, sombra na água e barco atracado
    this.add.rectangle(MAR_X, PIER.y + PIER.h, PIER.x + PIER.w - MAR_X, 2 * S, hex(COR.w0), 0.6).setOrigin(0);
    this.add.image(PIER.x, PIER.y, 'pier').setOrigin(0).setDepth(2);
    this.add.image(PIER.x + PIER.w + 36, PIER.y + PIER.h / 2, 'barcoH').setDepth(3);

    for (const [chave, p] of Object.entries(PREDIOS)) {
      this.add.rectangle(p.x + 2 * S, p.y + 2 * S, p.w, p.h, hex(COR.k), 0.25).setOrigin(0).setDepth(3);
      this.add.image(p.x, p.y, chave).setOrigin(0).setDepth(4);
      const t = this.add.text(0, 0, p.placa, FONTE.clara).setOrigin(0.5).setDepth(6);
      const w = Math.ceil((t.width + 30) / S) * S;
      const yPlaca = p.y + Math.round((p.h - 39) / 2 / S) * S - 3;
      caixa(this, p.x + Math.round((p.w - w) / 2 / S) * S, yPlaca, w, 30, 'madeira').setDepth(5);
      t.setPosition(p.x + p.w / 2, yPlaca + 15);
    }

    this.add.rectangle(BOMBA.x + 2 * S, BOMBA.y + 2 * S, BOMBA.w - 6, BOMBA.h, hex(COR.k), 0.25).setOrigin(0).setDepth(3);
    this.add.image(BOMBA.x, BOMBA.y, 'bomba').setOrigin(0).setDepth(profundidade(BOMBA.y + BOMBA.h));
    this.add.image(BANCADA.x, BANCADA.y, 'bancada').setOrigin(0).setDepth(profundidade(BANCADA.y + BANCADA.h));
    this.rotuloLugar(BANCADA.x + BANCADA.w / 2, BANCADA.y + BANCADA.h + 15, 'Bancada de triagem');
    this.rotuloLugar(BOMBA.x + BOMBA.w / 2 - 6, BOMBA.y - 12, 'Bomba');

    for (const e of ENFEITES) {
      this.add.image(e.x, e.y, `ico-${e.ico}`).setOrigin(0.5, 1).setDepth(e.solido ? profundidade(e.y) : 2);
    }
  }

  rotuloLugar(x, y, texto) {
    this.add.text(x, y, texto, { ...FONTE.clara, fontSize: '12px' }).setOrigin(0.5).setDepth(7);
  }

  criarTripulacao() {
    this.sprTripulacao = [];
    const naChegada = this.fase === 'chegada';
    this.estado.tripulacao.forEach((t, i) => this.adicionarTripulante(t, i, naChegada));

    // Quem pediu demissão vai embora andando (MR-MPS-RH com consequência visível)
    for (const [i, d] of (this.descanso?.demitidos ?? []).entries()) {
      const b = this.boneco('cansado', 264 + (this.estado.tripulacao.length + i) * 39, 441);
      const fala = this.balao(b.x, b.y - 48, `${d.nome}: "Tô esgotado. Vou embora!"`, 'ruim');
      this.time.delayedCall(1400, () => {
        b.setFrame(4).setFlipX(true);
        this.tweens.add({
          targets: [b, b.sombra, fala],
          x: '-=420',
          duration: 3600,
          onUpdate: (tw) => b.setFrame(4 + (Math.floor(tw.elapsed / 160) % 2)),
          onComplete: () => [b, b.sombra, fala].forEach((o) => o.destroy()),
        });
      });
    }
  }

  adicionarTripulante(t, i, naChegada = false) {
    const x = naChegada ? 729 + i * 36 : 264 + i * 39;
    const y = naChegada ? 270 : 441;
    const b = this.boneco('tripulante', x, y);
    const nome = this.add.text(x, y + 9, t.nome, { ...FONTE.clara, fontSize: '11px' }).setOrigin(0.5, 0).setDepth(18);
    const bar = barra(this, x - 15, y - 54, 30, 9, 18);
    const item = { t, b, nome, bar };
    this.sprTripulacao.push(item);
    this.desenharFadiga(item);
  }

  desenharFadiga({ t, bar }) {
    bar.set(t.fadiga / 100, t.fadiga > 70 ? COR.v2 : t.fadiga > 40 ? COR.y1 : COR.g2);
  }

  desenharPeixesNaBancada() {
    this.peixesBancada = this.exp.porao.slice(0, 16).map((p, i) => {
      const x = BANCADA.x + 18 + (i % 8) * 12;
      const y = BANCADA.y + 6 + Math.floor(i / 8) * 9;
      return { p, spr: this.add.image(x, y, 'ico-peixe').setTint(ESPECIES[p.especie].cor).setDepth(17) };
    });
  }

  // Balão de fala em pergaminho. tipo: 'neutro' | 'ok' | 'ruim'
  balao(x, y, texto, tipo = 'neutro') {
    const cor = { neutro: TINTA.escura, ok: TINTA.ok, ruim: TINTA.ruim }[tipo];
    const t = this.add.text(0, 0, texto, { ...FONTE.base, fontSize: '14px', color: cor }).setOrigin(0.5);
    const w = Math.ceil((t.width + 24) / S) * S;
    const c = this.add.container(x, y).setDepth(26);
    c.add([caixa(this, -Math.round(w / 2 / S) * S, -18, w, 36, 'simples'), t]);
    return c;
  }

  anunciarInicio() {
    const c = this.exp.clima;
    if (this.fase === 'saida') {
      const t = this.balao(W / 2 - 36, H - 30, `Previsão do dia: ${c.nome}. ${c.texto}`);
      this.time.delayedCall(4500, () => this.tweens.add({ targets: t, alpha: 0, duration: 500, onComplete: () => t.destroy() }));
      if (this.descanso) flutuar(this, 210, 405, `Tripulação descansou: −${this.descanso.recupera} de cansaço`, CORES.ok, 3000);
    } else {
      flutuar(this, 780, 228, 'De volta ao porto!', CORES.ok, 2000);
    }
  }

  // ------------------------------------------------------------------ HUD

  criarHud() {
    barraTopo(this, TOPO);
    this.hudEsq1 = new LinhaIcones(this, 15, 17, { alinhar: 'esq' });
    this.hudEsq2 = new LinhaIcones(this, 15, 42, { alinhar: 'esq' });
    this.hudDir1 = new LinhaIcones(this, W - 15, 17);
    this.hudDir2 = new LinhaIcones(this, W - 15, 42);
    this.faixa = new Faixa(this, W / 2, TOPO / 2);
  }

  // Objetivo atual: texto da faixa amarela e lugar para onde a seta aponta no mapa
  objetivo() {
    const e = this.estado;
    const exp = this.exp;
    if (this.fase === 'chegada') {
      if (this.entregue) return { texto: 'Pedido entregue!' };
      if (!triagemAutomatica(e) && !exp.triagem && exp.porao.length) {
        return { texto: 'Entregue o peixe ao cliente', alvo: 'cliente', dica: 'triagem na bancada é opcional' };
      }
      return { texto: 'Entregue o peixe ao cliente', alvo: 'cliente' };
    }
    if (!exp.pedidoRecebido) return { texto: 'Fale com o cliente na praça', alvo: 'cliente' };
    if (e.tripulacao.length < CONFIG.tripulacaoMinima) return { texto: 'Contrate gente na taverna', alvo: 'taverna' };
    if (e.tanque < CONFIG.combustivel.minimoZarpar) return { texto: `Abasteça na bomba (mínimo ${CONFIG.combustivel.minimoZarpar})`, alvo: 'bomba' };
    return { texto: 'Pronto! Embarque no barco', alvo: 'barco', dica: 'ou invista no escritório antes' };
  }

  atualizarHud() {
    const e = this.estado;
    const exp = this.exp;
    const m = nivelMaturidade(e.processos);
    this.hudEsq1.set([
      { icone: 'moeda', texto: real(e.caixa) },
      { icone: 'estrela', texto: String(e.reputacao) },
    ]);
    this.hudEsq2.set([{ icone: 'coluna', texto: m.rotulo }]);
    if (this.fase === 'chegada' && !this.entregue) {
      const peso = exp.porao.reduce((s, p) => s + p.peso, 0);
      const itens = [{ icone: 'caixote', texto: `${exp.porao.length} peixes · ${kg(peso)}` }];
      if (exp.trofeus.length) itens.push({ icone: 'brilho', texto: String(exp.trofeus.length), cor: COR.y2 });
      this.hudDir1.set(itens);
    } else {
      this.hudDir1.set([{ icone: 'combustivel', texto: `${e.tanque}/${CONFIG.combustivel.tanqueMax}` }]);
    }
    this.hudDir2.set([{ icone: exp.clima.icone, texto: exp.clima.nome }]);

    const obj = this.objetivo();
    const sub = obj.dica ?? `Expedição ${exp.numero} de ${CONFIG.totalExpedicoes} · ${exp.pedido.cliente}`;
    this.faixa.set(obj.texto, sub);
    const alvo = obj.alvo && (obj.alvo === 'cliente' ? { x: this.cliente.x, y: this.cliente.y } : LUGARES[obj.alvo]);
    this.ponteiro.apontar(alvo && !this.dialogo.aberto ? { x: alvo.x, y: alvo.y - (obj.alvo === 'cliente' ? 66 : 48) } : null);

    this.nomeCliente.setPosition(this.cliente.x, this.cliente.y - 42);
  }

  criarPainelBomba() {
    const x = 333;
    const y = 180;
    const p = this.add.container(x, y).setDepth(24).setVisible(false);
    const fundo = caixa(this, 0, 0, 264, 150, 'pergaminho');
    this.bombaTitulo = this.add.text(18, 15, 'Bomba de combustível', { ...FONTE.base, fontStyle: 'bold' });
    this.bombaTexto = this.add.text(18, 36, '', { ...FONTE.base, fontSize: '13px' });
    this.bombaPrev = this.add.text(18, 84, '', { ...FONTE.base, fontSize: '12px', color: TINTA.media, wordWrap: { width: 228 }, lineSpacing: 2 });
    p.add([fundo, this.bombaTitulo, this.bombaTexto, this.bombaPrev]);
    this.painelBomba = p;
    this.bombaBarra = barra(this, x + 18, y + 57, 228, 18, 25);
    this.bombaBarra.g.setVisible(false);
  }

  mostrarPainelBomba(visivel) {
    this.painelBomba.setVisible(visivel);
    this.bombaBarra.g.setVisible(visivel);
  }

  atualizarPainelBomba() {
    const c = CONFIG.combustivel;
    const e = this.estado;
    atualizarTexto(this.bombaTexto, `Tanque: ${e.tanque}/${c.tanqueMax} · ${real(c.precoUnidade)} cada`);

    // Barra do tanque: amarelo = no tanque · traço vermelho = mínimo · faixa verde = previsão do Diário
    const prevNormal = previsaoCombustivel(e, this.exp, prazoDaJornada(this.exp, 'normal'));
    this.bombaBarra.set(e.tanque / c.tanqueMax, COR.y2, (g, x0, y0, larg, alt) => {
      const esc = larg / c.tanqueMax;
      if (prevNormal) {
        g.fillStyle(hex(COR.g3), 0.55).fillRect(x0 + Math.round((prevNormal.min * esc) / S) * S, y0, Math.max(S, Math.round(((prevNormal.max - prevNormal.min) * esc) / S) * S), alt);
      }
      g.fillStyle(hex(COR.v1)).fillRect(x0 + Math.round((c.minimoZarpar * esc) / S) * S, y0 - S, S, alt + 2 * S);
    });

    let txt;
    const prev = previsao(e);
    if (!prev) txt = 'Sem Diário de bordo: não há histórico, a quantidade é no chute.';
    else if (prev.semDados) txt = 'Diário de bordo: primeira viagem medida. A previsão aparece na próxima.';
    else {
      const ext = previsaoCombustivel(e, this.exp, prazoDaJornada(this.exp, 'horaExtra'));
      txt = `Diário (faixa verde): normal ${prevNormal.min}–${prevNormal.max} · hora extra ${ext.min}–${ext.max}`;
    }
    if (this.exp.clima.combustivelMult) txt += `\n${this.exp.clima.nome}: consumo +${Math.round((this.exp.clima.combustivelMult - 1) * 100)}%`;
    atualizarTexto(this.bombaPrev, txt);
  }

  aviso_(titulo, texto, icone) {
    this.dialogo.abrir({ titulo, texto, icone });
  }

  // ------------------------------------------------------------------ movimento e proximidade

  livre(x, y) {
    if (x < RAIO || x > W - RAIO || y < TOPO + RAIO + 9 || y > H - RAIO) return false;
    // na água, só sobre o píer
    if (x > MAR_X - RAIO && !(y >= PIER.y + 9 && y <= PIER.y + PIER.h - 12 && x <= PIER.x + PIER.w - RAIO)) return false;
    return !SOLIDOS.some((s) => x > s.x - RAIO && x < s.x + s.w + RAIO && y > s.y - RAIO / 2 && y < s.y + s.h + RAIO / 2);
  }

  mover(dt) {
    const t = this.teclas;
    let dx = (t.D.isDown || t.RIGHT.isDown ? 1 : 0) - (t.A.isDown || t.LEFT.isDown ? 1 : 0);
    let dy = (t.S.isDown || t.DOWN.isDown ? 1 : 0) - (t.W.isDown || t.UP.isDown ? 1 : 0);
    const j = this.jogador;
    if (!dx && !dy) {
      j.setFrame(this.quadroBase ?? 0);
      return;
    }
    // quadros: 0-1 frente · 2-3 costas · 4-5 lado (espelhado para a esquerda)
    this.quadroBase = Math.abs(dx) > Math.abs(dy) ? 4 : dy < 0 ? 2 : 0;
    if (dx) j.setFlipX(dx < 0);
    this.passo += dt;
    const passada = Math.floor(this.passo / 0.18);
    j.setFrame(this.quadroBase + (passada % 2));
    if (passada !== this.ultimaPassada) {
      // cada troca de pé é um passo; no píer o som é de madeira
      this.ultimaPassada = passada;
      som.passo(j.sombra.x > MAR_X - RAIO ? 'madeira' : 'areia');
    }

    if (dx && dy) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }
    let x = j.sombra.x;
    let y = j.sombra.y;
    const nx = x + dx * VELOCIDADE * dt;
    const ny = y + dy * VELOCIDADE * dt;
    if (this.livre(nx, y)) x = nx; // desliza pelas paredes
    if (this.livre(x, ny)) y = ny;
    this.moverBoneco(j, x, y);
    if (this.carga) this.carga.setPosition(x - dx * 18, y - dy * 6).setDepth(profundidade(y) - 0.01);
  }

  lugarProximo() {
    const { x: jx, y: jy } = this.jogador.sombra;
    let melhor = null;
    for (const [id, l] of Object.entries(LUGARES)) {
      const pos = id === 'cliente' ? this.cliente.sombra : l;
      const d = Math.hypot(pos.x - jx, pos.y - jy);
      if (d < l.raio && (!melhor || d < melhor.d)) melhor = { id, d, ...l, x: pos.x, y: pos.y };
    }
    return melhor;
  }

  // ------------------------------------------------------------------ loop

  update(_t, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.tempoAgua += dt;
    this.ondas.tilePositionX = Math.floor(this.tempoAgua * 2) * S; // a água anda de pixel em pixel

    if (this.concluido || this.modalAberto) {
      this.acoes.clear();
      return;
    }

    if (this.dialogo.aberto) {
      this.dialogo.processar(this.acoes);
      this.aviso.esconder();
      this.mostrarPainelBomba(false);
    } else {
      this.mover(dt);
      const perto = this.lugarProximo();
      if (perto) this.aviso.mostrar(perto.x, perto.y - (perto.id === 'cliente' || perto.id === 'colecionador' ? 48 : 21), perto.tecla, perto.rotulo);
      else this.aviso.esconder();
      const naBomba = perto?.id === 'bomba';
      this.mostrarPainelBomba(naBomba);
      if (naBomba) {
        if (this.teclas.E.isDown) this.abastecendo(dt);
        this.atualizarPainelBomba();
      }
      if (this.acoes.has('interagir') && perto && !naBomba) this.interagir(perto.id);
      else if (this.acoes.has('interagir') && naBomba && this.fase === 'chegada') {
        this.aviso_('Bomba', 'Primeiro entregue o pedido: o combustível é para a próxima viagem.', 'combustivel');
      }
    }
    this.acoes.clear();
    if (!this.concluido) this.atualizarHud();
  }

  interagir(id) {
    const acoes = {
      cliente: () => (this.fase === 'saida' ? this.falarComCliente() : this.falarNaChegada()),
      bancada: () => this.usarBancada(),
      escritorio: () => this.entrarNoEscritorio(),
      taverna: () => this.falarComTripulacao(),
      colecionador: () => this.falarComColecionador(),
      barco: () => this.embarcar(),
    };
    som.interacao();
    acoes[id]?.();
  }

  // ------------------------------------------------------------------ cliente (REQ e validação)

  falarComCliente(mensagem = '') {
    const e = this.estado;
    const exp = this.exp;
    const p = exp.pedido;
    receberPedido(e, exp);
    let texto = `${mensagem}“${p.textoVago}”\nPaga ${real(p.precoKg)}/kg pelo que estiver dentro do que ele quer.`;
    const opcoes = [];
    if (exp.especificacaoConhecida) {
      const via = e.processos.fichaPedido ? 'Ficha de pedido preenchida, sem perder tempo' : `Você perguntou (−${exp.penalidadeTempo} s de mar)`;
      texto += `\n\n${via}: ${descSpec(specVigente(exp), exp.meta)}.`;
    } else {
      texto += '\n\nVocê não sabe exatamente que peixe ele quer. No mar, os cardumes vão aparecer como "?" e a triagem só vai conseguir separar peixe machucado.';
      opcoes.push({
        rotulo: `Fazer perguntas sobre o pedido (−${CONFIG.conversarCliente.segundos} s de mar)`,
        acao: () => {
          conversarComCliente(e, exp);
          this.falarComCliente();
        },
      });
    }
    opcoes.push({ rotulo: 'Combinado!' });
    this.dialogo.abrir({ titulo: p.cliente, icone: 'pessoa', texto, opcoes });
  }

  falarNaChegada() {
    if (this.entregue) return;
    const e = this.estado;
    const exp = this.exp;
    const peso = exp.porao.reduce((s, p) => s + p.peso, 0);
    let texto = `“E aí, trouxe meu pedido?”\nNa caixa: ${exp.porao.length} peixe(s), ${kg(peso)}.`;
    if (exp.trofeus.length) texto += ` E ${exp.trofeus.length} garoupa(s) dourada(s), que vão para o colecionador.`;
    if (exp.triagem?.feita) {
      texto += `\nTriagem feita: ${exp.entregues.length} peixe(s) vão para o cliente e ${exp.descartados.length} para o mercado.`;
    } else if (triagemAutomatica(e)) {
      texto += '\nO checklist verificou cada peixe: o que estiver fora vai direto para o mercado.';
    } else {
      texto += '\nAtenção: sem triagem, o que estiver fora da especificação o cliente devolve, e isso custa reputação. A bancada fica perto do píer.';
    }
    this.dialogo.abrir({
      titulo: exp.pedido.cliente,
      icone: 'caixote',
      texto,
      opcoes: [{ rotulo: 'Entregar o pedido', acao: () => this.entregarAoCliente() }, { rotulo: 'Ainda não' }],
    });
  }

  entregarAoCliente() {
    const r = entregar(this.estado, this.exp);
    this.entregue = true;
    this.concluido = true; // congela a interação enquanto o cliente reage
    this.aviso.esconder();
    this.ponteiro.apontar(null);
    this.mostrarPainelBomba(false);
    this.carga?.destroy();
    this.carga = null;
    this.peixesBancada?.forEach((b) => b.spr.destroy());

    let fala = 'Perfeito, era isso mesmo!';
    let tipo = 'ok';
    if (r.rejeitados.length) [fala, tipo] = [`Isso aqui não serve! (${r.rejeitados.length} devolvido(s))`, 'ruim'];
    else if (!r.metaAtingida) [fala, tipo] = ['Tá certo, mas veio pouco…', 'ruim'];
    this.balao(this.cliente.x, this.cliente.y - 63, `“${fala}”`, tipo);
    flutuar(this, this.cliente.x, this.cliente.y + 21, `+${real(r.receita - r.receitaTrofeus)}`, CORES.ok, 2200);
    if (r.receita - r.receitaTrofeus > 0) som.dinheiro();
    if (r.trofeus) {
      flutuar(this, this.colecionador.x, this.colecionador.y - 51, `+${real(r.receitaTrofeus)}`, CORES.ouro, 2200);
      this.time.delayedCall(450, () => som.dinheiro());
    }
    this.faixa.set('Pedido entregue!', `${this.exp.pedido.cliente}`);
    this.time.delayedCall(1800, () => this.concluir(r));
  }

  // ------------------------------------------------------------------ bancada (verificação)

  usarBancada() {
    const e = this.estado;
    const exp = this.exp;
    const titulo = 'Bancada de triagem';
    if (this.fase === 'saida') return this.aviso_(titulo, 'Bancada vazia. Volte aqui com o porão cheio, antes de entregar ao cliente.', 'caixote');
    if (this.entregue) return;
    if (triagemAutomatica(e)) {
      return this.aviso_(titulo, 'Checklist de triagem: cada peixe já foi verificado ao entrar no porão. O que estiver fora vai para o mercado automaticamente, sem custo.', 'caixote');
    }
    if (exp.triagem?.feita) return this.aviso_(titulo, this.resumoTriagem(), 'caixote');
    if (!exp.porao.length) return this.aviso_(titulo, 'Porão vazio: não há o que triar.', 'caixote');
    let texto = `Triagem manual: ${real(CONFIG.triagemManual.custo)} e +${CONFIG.triagemManual.fadiga} de cansaço na tripulação.\nO que estiver fora da especificação vai para o mercado a ${real(CONFIG.mercadoPorKg)}/kg, em vez de voltar do cliente.`;
    if (!exp.especificacaoConhecida) texto += '\nAtenção: o pedido não foi esclarecido, então só dá para separar peixe machucado.';
    this.dialogo.abrir({ titulo, icone: 'caixote', texto, opcoes: [{ rotulo: 'Fazer a triagem', acao: () => this.fazerTriagem() }, { rotulo: 'Agora não' }] });
  }

  fazerTriagem() {
    triar(this.estado, this.exp, true);
    const mercado = { x: 384, y: 156 };
    for (const b of this.peixesBancada ?? []) {
      if (!b.p.verificacao?.ok) this.tweens.add({ targets: b.spr, x: mercado.x, y: mercado.y, alpha: 0, duration: 900 });
    }
    this.sprTripulacao.forEach((s) => this.desenharFadiga(s));
    this.aviso_('Triagem feita', this.resumoTriagem(), 'caixote');
  }

  resumoTriagem() {
    const d = this.exp.descartados;
    if (!d.length) return 'Nada foi separado: todos os peixes passaram na verificação.';
    const lista = d.map((p) => `${ESPECIES[p.especie].nome} ${p.tamanho} cm (${p.verificacao.motivo})`).join(', ');
    return `Separado(s) para o mercado: ${d.length}. ${lista}.`;
  }

  // ------------------------------------------------------------------ escritório (MR-MPS-SW)

  async entrarNoEscritorio() {
    if (this.fase === 'chegada' && !this.entregue) {
      return this.aviso_('Escritório', 'O cliente está esperando! Entregue o pedido antes de mexer nos processos.', 'coluna');
    }
    this.travarEntrada();
    await this.abrirEscritorio();
    this.liberarEntrada();
  }

  travarEntrada() {
    this.modalAberto = true;
    this.aviso.esconder();
    this.input.keyboard.enabled = false;
    this.input.keyboard.disableGlobalCapture(); // deixa o teclado livre para o HTML
  }

  liberarEntrada() {
    this.input.keyboard.enabled = true;
    this.input.keyboard.enableGlobalCapture();
    this.input.keyboard.resetKeys();
    this.acoes.clear();
    this.modalAberto = false;
  }

  // ------------------------------------------------------------------ taverna (MR-MPS-RH)

  falarComTripulacao(mensagem = '') {
    const e = this.estado;
    const titulo = 'Taverna: tripulação';
    if (this.fase === 'chegada') return this.aviso_(titulo, 'A tripulação está descarregando o barco. Entregue o pedido primeiro.', 'barril');
    const linhas = e.tripulacao.map((t) => `${t.nome}: habilidade ${t.habilidade}/3 · cansaço ${t.fadiga}`);
    const texto =
      `${mensagem}${linhas.join('\n')}\n\nFirmeza da linha no minijogo: ${limiteTensao(e)}/100 (habilidade sobe, cansaço desce). ` +
      `Cansaço acima de ${CONFIG.demissaoFadiga} na volta = pedido de demissão.`;
    const opcoes = [];
    if (e.tripulacao.length < 4) {
      opcoes.push({
        rotulo: `Contratar tripulante (${real(CONFIG.contratar.custo)} + ${real(CONFIG.salarioPorTripulante)} de salário por viagem)`,
        acao: () => {
          const r = contratar(e);
          if (r.ok) this.adicionarTripulante(e.tripulacao.at(-1), e.tripulacao.length - 1);
          this.falarComTripulacao(r.ok ? `${r.nome} entrou na tripulação!\n\n` : `${r.erro}\n\n`);
        },
      });
    }
    opcoes.push({ rotulo: 'Sair' });
    this.dialogo.abrir({ titulo, icone: 'barril', texto, opcoes });
  }

  falarComColecionador() {
    const v = real(CONFIG.eventos.peixeEspecial.valor);
    const n = this.fase === 'chegada' && !this.entregue ? this.exp.trofeus.length : 0;
    const texto = n
      ? `“Uau, ${n} garoupa(s) dourada(s)! Pago ${v} cada, assim que você fechar a entrega com o cliente.”`
      : `“Garoupa dourada é rara: aparece de vez em quando no anzol, ou num cardume dourado que some rápido. Pago ${v} cada!”\nO peixe fora da especificação vai para o mercado a ${real(CONFIG.mercadoPorKg)}/kg.`;
    this.aviso_('Colecionador', texto, 'brilho');
  }

  // ------------------------------------------------------------------ barco (zarpar com a jornada escolhida)

  embarcar() {
    const e = this.estado;
    const exp = this.exp;
    const titulo = 'Barco';
    if (this.fase === 'chegada') return this.aviso_(titulo, 'Entregue o pedido antes de sair de novo.', 'relogio');
    const pode = podeZarpar(e, exp);
    if (!pode.ok) return this.aviso_(titulo, pode.motivo, 'relogio');

    const opcoes = ['normal', 'horaExtra'].map((j) => ({
      rotulo: `${CONFIG.jornada[j].rotulo}: ${prazoDaJornada(exp, j)} s de mar, +${CONFIG.jornada[j].fadiga} de cansaço`,
      acao: () => this.zarpar(j),
    }));
    opcoes.push({ rotulo: 'Ainda não' });
    let texto = `Tanque: ${e.tanque} unidades. Salários de ${real(salarios(e))} são pagos ao zarpar.\nHoje: ${exp.clima.nome}. ${exp.clima.texto}`;
    const prev = previsaoCombustivel(e, exp, prazoDaJornada(exp, 'normal'));
    if (prev) texto += `\nDiário de bordo: jornada normal deve gastar ${prev.min}–${prev.max} unidades.`;
    if (!exp.especificacaoConhecida) texto += '\nAtenção: você ainda não sabe exatamente o que o cliente quer.';
    this.dialogo.abrir({ titulo, icone: 'relogio', texto, opcoes });
  }

  zarpar(jornada) {
    this.concluido = true;
    this.aviso.esconder();
    this.ponteiro.apontar(null);
    this.mostrarPainelBomba(false);
    const j = this.jogador;
    j.setFrame(4).setFlipX(false);
    this.tweens.add({ targets: [j, j.sombra], x: PIER.x + PIER.w + 15, duration: 400 });
    this.cameras.main.fadeOut(600, 18, 13, 23);
    this.cameras.main.once('camerafadeoutcomplete', () => this.aoConcluir({ jornada }));
  }

  // Fecha a fase: a cena congela (continua visível atrás do modal) e o controlador segue o fluxo.
  concluir(valor) {
    this.concluido = true;
    this.aviso.esconder();
    this.input.keyboard.resetKeys();
    this.scene.pause();
    this.aoConcluir(valor);
  }

  // ------------------------------------------------------------------ bomba (GPR)

  abastecendo(dt) {
    if (this.fase === 'chegada') return;
    this.bufferComb += CONFIG.combustivel.vazaoPorSegundo * dt;
    const n = Math.floor(this.bufferComb);
    if (n <= 0) return;
    this.bufferComb -= n;
    const colocou = abastecer(this.estado, this.exp, n);
    if (colocou < n) {
      this.bufferComb = 0;
      if (this.time.now - this.ultimoAviso > 1500) {
        this.ultimoAviso = this.time.now;
        const cheio = this.estado.tanque >= CONFIG.combustivel.tanqueMax;
        flutuar(this, 621, 102, cheio ? 'Tanque cheio' : 'O resto do caixa é dos salários', CORES.alerta);
      }
    }
  }
}
