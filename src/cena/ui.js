// Componentes de interface em pixel art, usados pelas cenas Porto e Mar.
// Molduras e ícones vêm de pixel.js; o texto usa a fonte pixel (Pixelify Sans).

import { COR, S, TINTA, hex, texturaMoldura } from './pixel.js';
import { FONTE, H, W, atualizarTexto } from './comum.js';
import { som } from './som.js';

const m3 = (v) => Math.ceil(v / S) * S; // arredonda para múltiplo do pixel de arte

// Caixa (imagem com moldura) de tamanho qualquer; origem no canto superior esquerdo.
export function caixa(cena, x, y, w, h, estilo) {
  return cena.add.image(x, y, texturaMoldura(cena, estilo, m3(w), m3(h))).setOrigin(0);
}

function redimensionar(img, estilo, w, h) {
  img.setTexture(texturaMoldura(img.scene, estilo, m3(w), m3(h)));
}

// Tecla desenhada (E, 1, 2, Esc...). Devolve um container com origem no canto superior esquerdo.
export function tecla(cena, rotulo) {
  const w = m3(Math.max(27, 15 + rotulo.length * 9));
  const c = cena.add.container(0, 0);
  c.add(cena.add.image(0, 0, texturaMoldura(cena, 'tecla', w, 30)).setOrigin(0));
  c.add(cena.add.text(w / 2, 13, rotulo, { ...FONTE.base, fontSize: '14px' }).setOrigin(0.5));
  c.largura = w;
  return c;
}

// ------------------------------------------------------------------ barra de topo

export function barraTopo(cena, altura) {
  const t = cena.add.tileSprite(0, 0, W, altura, 'tabuaTopo').setOrigin(0).setDepth(20);
  cena.add.rectangle(0, altura, W, S, hex(COR.k)).setOrigin(0).setDepth(20);
  cena.add.rectangle(0, altura + S, W, S, hex(COR.k), 0.35).setOrigin(0).setDepth(20);
  return t;
}

// Ícone + texto, alinhados a partir de uma borda (dir ou esq). Recria só quando muda.
export class LinhaIcones {
  constructor(cena, x, y, { alinhar = 'dir', estilo = FONTE.clara, profundidade = 21 } = {}) {
    Object.assign(this, { cena, x, y, alinhar, estilo, profundidade });
    this.objs = [];
    this.chave = '';
  }
  set(itens) {
    const chave = JSON.stringify(itens);
    if (chave === this.chave) return;
    this.chave = chave;
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
    const c = this.cena;
    if (this.alinhar === 'dir') {
      let x = this.x;
      for (const it of [...itens].reverse()) {
        const t = c.add.text(x, this.y, it.texto, { ...this.estilo, color: it.cor ?? this.estilo.color }).setOrigin(1, 0.5).setDepth(this.profundidade);
        x -= t.width + 6;
        const i = c.add.image(x, this.y, `ico-${it.icone}`).setOrigin(1, 0.5).setDepth(this.profundidade);
        x -= i.width + 18;
        this.objs.push(t, i);
      }
    } else {
      let x = this.x;
      for (const it of itens) {
        const i = c.add.image(x, this.y, `ico-${it.icone}`).setOrigin(0, 0.5).setDepth(this.profundidade);
        x += i.width + 6;
        const t = c.add.text(x, this.y, it.texto, { ...this.estilo, color: it.cor ?? this.estilo.color }).setOrigin(0, 0.5).setDepth(this.profundidade);
        x += t.width + 18;
        this.objs.push(i, t);
      }
    }
  }
}

// ------------------------------------------------------------------ faixa amarela do objetivo

export class Faixa {
  constructor(cena, x, y) {
    Object.assign(this, { cena, x, y });
    this.cont = cena.add.container(x, y).setDepth(22);
    this.fundo = cena.add.image(0, 0, texturaMoldura(cena, 'fita', 60, 36));
    // a seta fica num container próprio: a animação mexe só na imagem de dentro
    this.seta = cena.add.container(0, 0);
    const img = cena.add.image(0, 0, 'ico-seta').setOrigin(0, 0.5);
    this.seta.add(img);
    this.texto = cena.add.text(0, 0, '', { ...FONTE.base, fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.sub = cena.add.text(0, 0, '', { ...FONTE.base, fontSize: '12px', color: TINTA.media }).setOrigin(0, 0.5);
    this.cont.add([this.fundo, this.seta, this.texto, this.sub]);
    this.chave = '';
    cena.tweens.add({ targets: img, x: S, duration: 350, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [1] });
  }
  set(texto, sub = '') {
    const chave = `${texto}|${sub}`;
    if (chave === this.chave) return;
    const mudou = this.chave !== '';
    this.chave = chave;
    this.texto.setText(texto);
    this.sub.setText(sub);
    const larg = m3(Math.max(this.texto.width, this.sub.width) + 60);
    const alt = sub ? 45 : 33;
    redimensionar(this.fundo, 'fita', larg, alt);
    const x0 = -larg / 2;
    this.seta.x = x0 + 12;
    this.texto.x = x0 + 42;
    this.sub.x = x0 + 42;
    this.texto.y = sub ? -8 : 0;
    this.sub.y = 11;
    if (mudou) {
      // chama atenção quando o objetivo muda
      this.cena.tweens.add({ targets: this.cont, y: this.y + 6, duration: 120, yoyo: true, repeat: 1 });
    }
  }
}

// ------------------------------------------------------------------ seta que pula sobre o objetivo no mapa

export class Ponteiro {
  constructor(cena) {
    this.cont = cena.add.container(0, 0).setDepth(19).setVisible(false);
    const img = cena.add.image(0, 0, 'ico-setaBaixo').setOrigin(0.5, 1);
    this.cont.add(img);
    cena.tweens.add({ targets: img, y: -9, duration: 300, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });
  }
  apontar(pos) {
    if (!pos) return this.cont.setVisible(false);
    this.cont.setPosition(pos.x, pos.y).setVisible(true);
  }
}

// ------------------------------------------------------------------ aviso "E: fazer algo"

export class Aviso {
  constructor(cena) {
    this.cena = cena;
    this.cont = cena.add.container(0, 0).setDepth(25).setVisible(false);
    this.chave = '';
  }
  mostrar(x, y, teclaRotulo, texto) {
    const chave = `${teclaRotulo}|${texto}`;
    if (chave !== this.chave) {
      this.chave = chave;
      this.cont.removeAll(true);
      const c = this.cena;
      const t = tecla(c, teclaRotulo);
      const txt = c.add.text(0, 0, texto, { ...FONTE.base, fontSize: '14px' }).setOrigin(0, 0.5);
      const w = m3(t.largura + txt.width + 27);
      const fundo = c.add.image(0, 0, texturaMoldura(c, 'simples', w, 42)).setOrigin(0);
      t.setPosition(9, 6);
      txt.setPosition(t.largura + 18, 21);
      this.cont.add([fundo, t, txt]);
      this.w = w;
    }
    this.cont.setPosition(Math.round(Math.min(W - this.w - 6, Math.max(6, x - this.w / 2))), Math.round(y - 42)).setVisible(true);
  }
  esconder() {
    this.cont.setVisible(false);
  }
}

// ------------------------------------------------------------------ barra de progresso em pixels

export function barra(cena, x, y, w, h, profundidade = 21) {
  const g = cena.add.graphics().setDepth(profundidade);
  return {
    g,
    // extra: função (g, x0, y0, largInterna, altInterna) para desenhar marcas por cima
    set(frac, cor, extra) {
      const f = Math.max(0, Math.min(1, frac));
      g.clear();
      g.fillStyle(hex(COR.k)).fillRect(x, y, w, h);
      g.fillStyle(hex(COR.k2)).fillRect(x + S, y + S, w - 2 * S, h - 2 * S);
      const fw = Math.round(((w - 2 * S) * f) / S) * S;
      if (fw > 0) {
        g.fillStyle(hex(cor)).fillRect(x + S, y + S, fw, h - 2 * S);
        g.fillStyle(0xffffff, 0.35).fillRect(x + S, y + S, fw, S);
      }
      extra?.(g, x + S, y + S, w - 2 * S, h - 2 * S);
    },
  };
}

// ------------------------------------------------------------------ caixa de diálogo

const LARG_DLG = 816;

export class Dialogo {
  constructor(cena) {
    this.cena = cena;
    this.cont = cena.add.container(m3((W - LARG_DLG) / 2), 0).setDepth(30).setVisible(false);
    this.opcoes = null;
  }
  get aberto() {
    return this.opcoes !== null;
  }
  // opcoes: [{ rotulo, acao }]. Escolher fecha o diálogo e roda a ação (que pode abrir outro).
  abrir({ titulo, icone = null, texto, opcoes = [] }) {
    const c = this.cena;
    this.cont.removeAll(true);
    const pad = 27;
    const corpo = c.add.text(pad, 33, texto, { ...FONTE.base, wordWrap: { width: LARG_DLG - 2 * pad }, lineSpacing: 5 });
    let y = 33 + corpo.height + 15;
    const linhas = [];
    opcoes.forEach((o, i) => {
      const t = tecla(c, String(i + 1));
      t.setPosition(pad, y);
      const txt = c.add.text(pad + t.largura + 12, y + 14, o.rotulo, { ...FONTE.base, color: TINTA.media }).setOrigin(0, 0.5);
      linhas.push(t, txt);
      y += 36;
    });
    const fechar = tecla(c, opcoes.length ? 'Esc' : 'E');
    const txtFechar = c.add.text(0, 0, 'fechar', { ...FONTE.base, fontSize: '13px', color: TINTA.media }).setOrigin(0, 0.5);
    const altura = m3(y + 30);
    fechar.setPosition(LARG_DLG - pad - fechar.largura - txtFechar.width - 9, altura - 45);
    txtFechar.setPosition(LARG_DLG - pad - txtFechar.width, altura - 31);
    const fundo = c.add.image(0, 0, texturaMoldura(c, 'pergaminho', LARG_DLG, altura)).setOrigin(0);

    // aba de madeira com o título
    const tTitulo = c.add.text(0, 0, titulo, { ...FONTE.clara, fontStyle: 'bold' }).setOrigin(0, 0.5);
    const larAba = m3(tTitulo.width + (icone ? 48 : 30));
    const aba = c.add.image(18, -18, texturaMoldura(c, 'madeira', larAba, 36)).setOrigin(0);
    const itens = [fundo, aba];
    let xt = 33;
    if (icone) {
      itens.push(c.add.image(xt, 0, `ico-${icone}`).setOrigin(0, 0.5));
      xt += 30;
    }
    tTitulo.setPosition(xt, 0);
    itens.push(tTitulo, corpo, ...linhas, fechar, txtFechar);
    this.cont.add(itens);
    this.cont.y = m3(H - 12 - altura);
    this.cont.setVisible(true);
    this.opcoes = opcoes;
  }
  fechar() {
    this.cont.setVisible(false);
    this.opcoes = null;
  }
  // acoes: Set com '1', '2', '3', 'esc', 'interagir'
  processar(acoes) {
    for (const k of ['1', '2', '3']) {
      const op = this.opcoes[Number(k) - 1];
      if (acoes.has(k) && op) {
        som.interacao();
        this.fechar();
        op.acao?.();
        return;
      }
    }
    if (acoes.has('esc') || (acoes.has('interagir') && !this.opcoes.length)) {
      som.interacao();
      this.fechar();
    }
  }
}

// ------------------------------------------------------------------ dica fixa no rodapé

export function dicaRodape(cena, texto) {
  const t = cena.add.text(0, 0, texto, { ...FONTE.base, fontSize: '13px' }).setOrigin(0.5);
  const w = m3(t.width + 30);
  const img = caixa(cena, m3((W - w) / 2), H - 45, w, 36, 'simples').setDepth(21);
  t.setPosition(img.x + w / 2, img.y + 18).setDepth(22);
  return {
    setVisible(v) {
      img.setVisible(v);
      t.setVisible(v);
    },
  };
}

export { atualizarTexto };
