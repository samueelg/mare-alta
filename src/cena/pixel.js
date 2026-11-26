// Pixel art do jogo, toda desenhada por código: nenhuma imagem externa.
//
// Cada "pixel de arte" vira S×S pixels de tela, para todo o jogo ter o mesmo tamanho de pixel.
// Todas as cores saem da PALETA abaixo (com sombra e luz para cada material).
// As mesmas artes são usadas no Phaser (registrarTexturas) e no HTML (instalarEstiloPixel).

import { criarRng } from '../regras/rng.js';

export const S = 3;

export const COR = {
  k: '#2a1f2d', k2: '#43334a', k3: '#5e4b66', // contornos
  a0: '#b88a5a', a1: '#d4aa72', a2: '#e3bf88', a3: '#f1d8a8', // areia
  r0: '#6f6168', r1: '#988a88', r2: '#bcae9f', r3: '#d9ccb9', // pedra
  m0: '#4e2f25', m1: '#7a4a34', m2: '#a26a45', m3: '#c98d5c', // madeira
  w0: '#183152', w1: '#24497a', w2: '#3570a0', w3: '#62a6c9', w4: '#b4e0ea', // água
  t0: '#6e2a2e', t1: '#9e3d3a', t2: '#c75b48', t3: '#e3876a', // telhado vermelho
  g0: '#2e4f3e', g1: '#3f7356', g2: '#5d9a6c', g3: '#8cc28a', // verde
  p0: '#a89a80', p1: '#cdbf9f', p2: '#e6dabd', p3: '#f6efdc', // parede
  y0: '#a8641e', y1: '#d9932e', y2: '#f2c14e', y3: '#ffe596', // amarelo
  b0: '#2c4a78', b1: '#3f6fa8', b2: '#5d9ad6', b3: '#9cc8ef', // azul
  s0: '#b46e4e', s1: '#e09a6e', s2: '#f4c49a', // pele
  v0: '#7a2630', v1: '#b33a3a', v2: '#e0605a', v3: '#f59a8a', // vermelho
  u0: '#3e2c5e', u1: '#634a8e', u2: '#8e6fbe', u3: '#bca3e0', // roxo
  c0: '#8a8f99', c1: '#c3c7cc', c2: '#eceae4', c3: '#ffffff', // branco/cinza
  q0: '#c9a878', q1: '#e8d3a8', q2: '#f6ead0', // pergaminho
};

// Cores do texto (Phaser e CSS usam as mesmas)
export const TINTA = { escura: '#3b2a2a', media: '#7a4a34', clara: '#f6ead0', ok: '#3f7356', ruim: '#9e3d3a', destaque: '#a8641e' };

export const hex = (cor) => parseInt(cor.slice(1), 16);

// ------------------------------------------------------------------ pintor de pixels

export class Pintor {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
  }
  px(x, y, cor) {
    if (!cor || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.ctx.fillStyle = cor;
    this.ctx.fillRect(x, y, 1, 1);
  }
  ret(x, y, w, h, cor) {
    this.ctx.fillStyle = cor;
    this.ctx.fillRect(x, y, w, h);
  }
  apagar(x, y) {
    this.ctx.clearRect(x, y, 1, 1);
  }
  grade(linhas, legenda, ox = 0, oy = 0) {
    linhas.forEach((l, y) => [...l].forEach((ch, x) => this.px(ox + x, oy + y, legenda[ch])));
  }
  // Cópia ampliada sem suavização (cada pixel de arte vira um bloco S×S)
  ampliado(escala = S) {
    const c = document.createElement('canvas');
    c.width = this.w * escala;
    c.height = this.h * escala;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(this.canvas, 0, 0, c.width, c.height);
    return c;
  }
}

// Gira 90° no sentido anti-horário (quem apontava para a direita passa a apontar para cima)
function girar(p) {
  const src = p.ctx.getImageData(0, 0, p.w, p.h);
  const q = new Pintor(p.h, p.w);
  const dst = q.ctx.createImageData(p.h, p.w);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const i = (y * p.w + x) * 4;
      const j = ((p.w - 1 - x) * p.h + y) * 4;
      for (let k = 0; k < 4; k++) dst.data[j + k] = src.data[i + k];
    }
  }
  q.ctx.putImageData(dst, 0, 0);
  return q;
}

// ------------------------------------------------------------------ molduras (caixas de diálogo, botões, faixas)

function base(p, contorno, fundo) {
  const { w, h } = p;
  p.ret(0, 0, w, h, contorno);
  p.ret(1, 1, w - 2, h - 2, fundo);
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) p.apagar(x, y);
}

// w e h em pixels de arte
export function pintarMoldura(estilo, w, h) {
  const p = new Pintor(w, h);
  const C = COR;
  if (estilo === 'pergaminho') {
    base(p, C.k, C.m2);
    p.ret(2, 1, w - 4, 1, C.m3); // luz da madeira
    p.ret(2, 2, w - 4, h - 4, C.m1);
    p.ret(3, 3, w - 6, h - 6, C.m0);
    p.ret(4, 4, w - 8, h - 8, C.q2);
    p.ret(4, 4, w - 8, 1, C.q1); // sombra interna
    p.ret(4, 4, 1, h - 8, C.q1);
    for (const [x, y] of [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]]) p.px(x, y, C.k);
    for (const [x, y] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) p.px(x, y, C.y3); // pregos
  } else if (estilo === 'simples') {
    base(p, C.m0, C.q2);
    p.ret(1, 1, w - 2, 1, C.c3);
    p.ret(1, h - 2, w - 2, 1, C.q1);
  } else if (estilo === 'fita') {
    base(p, C.y0, C.y2);
    p.ret(1, 1, w - 2, 1, C.y3);
    p.ret(1, h - 2, w - 2, 1, C.y1);
  } else if (estilo === 'madeira') {
    base(p, C.k, C.m2);
    p.ret(1, 1, w - 2, 1, C.m3);
    p.ret(1, h - 2, w - 2, 1, C.m1);
    const meio = Math.floor(h / 2);
    p.px(2, meio, C.y3);
    p.px(w - 3, meio, C.y3);
  } else if (estilo === 'tecla') {
    base(p, C.k2, C.c2);
    p.ret(1, 1, w - 2, 1, C.c3);
    p.ret(1, h - 3, w - 2, 1, C.c1);
    p.ret(1, h - 2, w - 2, 1, C.c0);
  } else if (estilo === 'trilho') {
    base(p, C.k, C.k2);
    p.ret(1, h - 2, w - 2, 1, C.k3);
  }
  return p;
}

// ------------------------------------------------------------------ chão, água e cenário

function ruido(p, semente, cores, densidade) {
  const rng = criarRng(semente);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (rng() < densidade) p.px(x, y, rng.escolher(cores));
}

function pintarAreia() {
  const p = new Pintor(32, 32);
  p.ret(0, 0, 32, 32, COR.a1);
  ruido(p, 11, [COR.a2, COR.a2, COR.a0], 0.09);
  ruido(p, 12, [COR.a3], 0.015);
  const rng = criarRng(13);
  for (let i = 0; i < 3; i++) {
    const x = rng.inteiro(1, 29);
    const y = rng.inteiro(1, 29);
    p.px(x, y, COR.r2);
    p.px(x + 1, y, COR.r1);
    p.px(x, y + 1, COR.a0);
  }
  return p;
}

function pintarAgua() {
  const p = new Pintor(32, 32);
  p.ret(0, 0, 32, 32, COR.w1);
  ruido(p, 21, [COR.w2], 0.07);
  ruido(p, 22, [COR.w0], 0.02);
  const rng = criarRng(23);
  for (let i = 0; i < 4; i++) {
    const x = rng.inteiro(0, 26);
    const y = rng.inteiro(2, 30);
    p.ret(x, y, 5, 1, COR.w3); // onda
    p.ret(x + 1, y - 1, 3, 1, COR.w4); // crista com luz
  }
  return p;
}

// Faixa entre areia e mar: areia molhada, pedras e espuma
function pintarMargem() {
  const p = new Pintor(5, 32);
  const rng = criarRng(31);
  for (let y = 0; y < 32; y++) {
    p.px(0, y, COR.a0);
    p.px(1, y, rng() < 0.5 ? COR.r1 : COR.a0);
    p.px(2, y, rng() < 0.6 ? COR.r0 : COR.r1);
    p.px(3, y, rng() < 0.5 ? COR.w4 : COR.c2);
    p.px(4, y, rng() < 0.4 ? COR.w3 : COR.w2);
  }
  return p;
}

// Tábuas: horizontal = tábuas atravessadas (píer visto de cima, indo para a direita)
function pintarTabuas(w, h, horizontal = true) {
  const p = new Pintor(w, h);
  const rng = criarRng(w * 7 + h);
  const comp = horizontal ? w : h;
  const larg = horizontal ? h : w;
  for (let i = 0; i < comp; i++) {
    for (let j = 0; j < larg; j++) {
      let c = i % 4 === 3 ? COR.m0 : rng() < 0.08 ? COR.m1 : COR.m2;
      if (i % 4 === 0 && c !== COR.m0) c = COR.m3;
      if (horizontal) p.px(i, j, c);
      else p.px(j, i, c);
    }
  }
  // borda e espessura (a madeira tem lateral visível embaixo)
  if (horizontal) {
    p.ret(0, 0, w, 1, COR.k);
    p.ret(0, h - 3, w, 1, COR.m1);
    p.ret(0, h - 2, w, 1, COR.m0);
    p.ret(0, h - 1, w, 1, COR.k);
    for (let x = 2; x < w; x += 15) {
      p.ret(x, h - 2, 2, 2, COR.k2); // estacas
    }
  } else {
    p.ret(0, 0, 1, h, COR.k);
    p.ret(w - 1, 0, 1, h, COR.k);
    p.ret(0, h - 2, w, 1, COR.m0);
    p.ret(0, h - 1, w, 1, COR.k);
  }
  return p;
}

// Tábuas horizontais da barra de topo (20 de altura = 60 px de tela)
function pintarTabuaTopo() {
  const p = new Pintor(32, 20);
  const rng = criarRng(41);
  for (let y = 0; y < 20; y++) {
    const r = y % 5;
    for (let x = 0; x < 32; x++) {
      let c = r === 0 ? COR.m2 : r === 4 ? COR.m0 : COR.m1;
      if (r > 0 && r < 4 && rng() < 0.1) c = COR.m0; // veio da madeira
      p.px(x, y, c);
    }
    if (r > 0 && r < 4) p.px((Math.floor(y / 5) * 11 + 5) % 32, y, COR.k); // emenda
  }
  return p;
}

function pintarPraca(w, h) {
  const p = new Pintor(w, h);
  const raio = 9;
  const dentro = (x, y) => {
    const cx = Math.max(raio, Math.min(w - 1 - raio, x));
    const cy = Math.max(raio, Math.min(h - 1 - raio, y));
    return Math.hypot(x - cx, y - cy) <= raio;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!dentro(x, y)) continue;
      const linha = Math.floor(y / 4);
      const xx = x + (linha % 2) * 3;
      const ly = y % 4;
      const lx = xx % 6;
      let c = COR.r2;
      if (ly === 3 || lx === 5) c = COR.r1; // rejunte
      else if (ly === 0 || lx === 0) c = COR.r3; // luz da pedra
      else if (ly === 2 && lx === 4) c = COR.r1; // sombra
      p.px(x, y, c);
    }
  }
  // borda
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!dentro(x, y)) continue;
      if (!dentro(x + 1, y) || !dentro(x - 1, y) || !dentro(x, y + 1) || !dentro(x, y - 1)) p.px(x, y, COR.a0);
    }
  }
  return p;
}

function pintarPredio(w, h, { telhado, toldo = false, chamine = false }) {
  const p = new Pintor(w, h);
  const C = COR;
  const paredeH = 13;
  const telhadoH = h - paredeH;
  const [t0, t1, t2, t3] = telhado;

  for (let y = 0; y < telhadoH; y++) {
    for (let x = 0; x < w; x++) {
      let c = t1;
      if (y % 3 === 2) c = t0; // fileira de telhas
      else if (y % 3 === 0 && (x + Math.floor(y / 3) * 2) % 4 === 0) c = t2;
      if (y === 1) c = t3; // cumeeira com luz
      if (x === 1 && y > 0) c = t2;
      if (x === w - 2) c = t0;
      p.px(x, y, c);
    }
  }
  p.ret(0, telhadoH - 1, w, 1, t0);
  p.ret(0, telhadoH, w, 1, C.k); // beiral

  for (let y = telhadoH + 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = C.p2;
      if ((y - telhadoH) % 3 === 0) c = C.p1;
      if (y === telhadoH + 1) c = C.p0; // sombra do beiral
      if (x === 1) c = C.p3;
      if (x === w - 2) c = C.p1;
      if (y === h - 1) c = C.p0;
      p.px(x, y, c);
    }
  }

  // janelas
  for (const cx of [Math.round(w * 0.2), Math.round(w * 0.8)]) {
    const x = cx - 3;
    const y = telhadoH + 4;
    p.ret(x, y, 7, 5, C.k);
    p.ret(x + 1, y + 1, 5, 3, C.w3);
    p.px(x + 1, y + 1, C.w4);
    p.px(x + 2, y + 1, C.w4);
    p.ret(x + 3, y + 1, 1, 3, C.m1);
    p.ret(x, y + 5, 7, 1, C.m2); // peitoril
  }

  // porta
  const px0 = Math.floor(w / 2) - 4;
  const py0 = h - 10;
  p.ret(px0, py0, 8, 10, C.k);
  p.ret(px0 + 1, py0 + 1, 6, 9, C.m1);
  p.ret(px0 + 1, py0 + 1, 6, 1, C.m2);
  p.ret(px0 + 4, py0 + 1, 1, 9, C.m0);
  p.px(px0 + 5, py0 + 5, C.y2);
  p.px(px0 + 2, py0 + 5, C.y2);

  if (toldo) {
    for (let y = telhadoH + 1; y < telhadoH + 4; y++) {
      for (let x = 1; x < w - 1; x++) p.px(x, y, Math.floor(x / 4) % 2 ? C.c2 : C.g2);
    }
    for (let x = 1; x < w - 1; x++) if (x % 4 < 2) p.px(x, telhadoH + 4, Math.floor(x / 4) % 2 ? C.c1 : C.g1);
  }
  if (chamine) {
    const x = w - 13;
    p.ret(x, 0, 6, 7, C.k);
    p.ret(x + 1, 1, 4, 5, C.r1);
    p.ret(x + 1, 1, 4, 1, C.r3);
    p.ret(x + 4, 2, 1, 4, C.r0);
  }

  // contorno
  p.ret(0, 0, w, 1, C.k);
  p.ret(0, h - 1, w, 1, C.k);
  p.ret(0, 0, 1, h, C.k);
  p.ret(w - 1, 0, 1, h, C.k);
  return p;
}

function pintarBomba() {
  const p = new Pintor(15, 19);
  const C = COR;
  p.ret(0, 0, 11, 17, C.k);
  p.ret(1, 1, 9, 15, C.v1);
  p.ret(1, 1, 1, 15, C.v2);
  p.ret(9, 1, 1, 15, C.v0);
  p.ret(1, 1, 9, 2, C.v2);
  p.ret(2, 1, 7, 1, C.v3);
  // visor
  p.ret(2, 4, 7, 5, C.k2);
  p.ret(3, 5, 5, 3, C.c2);
  p.px(4, 6, C.y1);
  p.px(5, 6, C.y1);
  p.px(6, 6, C.y1);
  // logo
  p.ret(3, 10, 5, 4, C.y2);
  p.ret(3, 10, 5, 1, C.y3);
  p.px(5, 12, C.y0);
  // mangueira e bico
  p.ret(11, 5, 2, 4, C.k);
  p.px(11, 6, C.c0);
  p.px(13, 8, C.k2);
  p.px(13, 9, C.k2);
  p.px(13, 10, C.k2);
  p.px(12, 11, C.k2);
  p.px(12, 12, C.k2);
  p.px(13, 13, C.k2);
  p.px(13, 14, C.k2);
  // base
  p.ret(0, 16, 15, 3, C.k);
  p.ret(1, 16, 13, 2, C.c1);
  p.ret(1, 16, 13, 1, C.c2);
  return p;
}

function pintarBancada() {
  const p = new Pintor(37, 12);
  const C = COR;
  p.ret(0, 0, 37, 9, C.k);
  for (let y = 1; y < 6; y++) p.ret(1, y, 35, 1, y % 2 ? C.m2 : C.m3);
  p.ret(1, 1, 35, 1, C.m3);
  p.ret(1, 6, 35, 2, C.m1);
  p.ret(1, 7, 35, 1, C.m0);
  for (const x of [1, 33]) {
    p.ret(x, 9, 3, 3, C.k);
    p.ret(x + 1, 9, 1, 2, C.m0);
  }
  return p;
}

function pintarBarco() {
  const w = 26;
  const h = 12;
  const p = new Pintor(w, h);
  const C = COR;
  const meia = (x) => (x < 17 ? 5.5 : 5.5 * (1 - (x - 17) / 9));
  const dentro = (x, y) => x >= 0 && x < w && y >= 0 && y < h && Math.abs(y - 5.5) <= meia(x);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!dentro(x, y)) continue;
      const borda = !dentro(x + 1, y) || !dentro(x - 1, y) || !dentro(x, y + 1) || !dentro(x, y - 1);
      const casco = !dentro(x + 2, y) || !dentro(x - 2, y) || !dentro(x, y + 2) || !dentro(x, y - 2);
      let c;
      if (borda) c = C.k;
      else if (casco) c = y < 6 ? C.c3 : C.c1; // casco branco: luz em cima, sombra embaixo
      else c = x % 3 === 0 ? C.m1 : C.m2; // convés de tábuas
      p.px(x, y, c);
    }
  }
  // cabine
  p.ret(4, 3, 7, 6, C.k);
  p.ret(5, 4, 5, 4, C.t1);
  p.ret(5, 4, 5, 1, C.t3);
  p.ret(5, 7, 5, 1, C.t0);
  p.px(7, 5, C.w4);
  // proa e popa
  p.px(22, 5, C.v2);
  p.px(22, 6, C.v2);
  p.ret(1, 4, 1, 4, C.m0);
  return p;
}

function pintarCardume(r, dourado) {
  const ry = Math.round(r * 0.7);
  const p = new Pintor(2 * r + 1, 2 * ry + 1);
  const base1 = dourado ? COR.y1 : '#18324f';
  const base2 = dourado ? COR.y2 : '#1f3d61';
  for (let y = 0; y <= 2 * ry; y++) {
    for (let x = 0; x <= 2 * r; x++) {
      const d = ((x - r) / r) ** 2 + ((y - ry) / ry) ** 2;
      if (d > 1) continue;
      if (d > 0.7 && (x + y) % 2) continue; // borda pontilhada
      p.px(x, y, d > 0.45 ? base2 : base1);
    }
  }
  const rng = criarRng(r * 13 + (dourado ? 7 : 0));
  for (let i = 0; i < Math.max(2, Math.floor(r / 3)); i++) {
    const x = rng.inteiro(r - Math.floor(r / 2), r + Math.floor(r / 3));
    const y = rng.inteiro(ry - Math.floor(ry / 2), ry + Math.floor(ry / 2));
    const cor = dourado ? COR.y3 : COR.w2;
    p.ret(x, y, 3, 1, cor);
    p.px(x + 3, y - 1, cor);
    p.px(x + 3, y + 1, cor);
  }
  return p;
}

function pintarAnel(r) {
  const R = r + 3;
  const ry = Math.round(R * 0.7);
  const p = new Pintor(2 * R + 1, 2 * ry + 1);
  const dentro = (x, y) => ((x - R) / R) ** 2 + ((y - ry) / ry) ** 2 <= 1;
  for (let y = 0; y <= 2 * ry; y++) {
    for (let x = 0; x <= 2 * R; x++) {
      if (!dentro(x, y)) continue;
      if (dentro(x + 1, y) && dentro(x - 1, y) && dentro(x, y + 1) && dentro(x, y - 1)) continue;
      const ang = Math.atan2(y - ry, x - R);
      if (Math.floor((ang + Math.PI) * 4) % 2) continue; // tracejado
      p.px(x, y, COR.y2);
    }
  }
  return p;
}

// ------------------------------------------------------------------ neblina (pontilhado "Bayer", o jeito pixel art de fazer transparência)

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((l) => l.map((v) => (v + 0.5) / 16));

const rgb = (cor) => [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16));

// Pinta direto nos bytes (milhares de pixels: bem mais rápido que fillRect um a um)
function pintarPorPixel(w, h, fn) {
  const p = new Pintor(w, h);
  const img = p.ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cor = fn(x, y);
      if (!cor) continue;
      const i = (y * w + x) * 4;
      [img.data[i], img.data[i + 1], img.data[i + 2]] = cor;
      img.data[i + 3] = 255;
    }
  }
  p.ctx.putImageData(img, 0, 0);
  return p;
}

// Véu de neblina com um "buraco" de visibilidade no meio (o barco fica no centro).
// É grande o bastante para cobrir a tela com o barco em qualquer lugar.
export function pintarVeuNevoa(raio) {
  const w = 540;
  const h = 300;
  const rng = criarRng(51);
  const [c1, c2, c3] = [COR.c1, COR.c2, COR.c3].map(rgb);
  return pintarPorPixel(w, h, (x, y) => {
    const d = Math.hypot(x - w / 2, (y - h / 2) * 1.15) / raio;
    const densidade = Math.min(1, Math.max(0, (d - 0.72) / 0.55)); // 0 = limpo, 1 = neblina fechada
    if (densidade <= BAYER[y % 4][x % 4]) return null;
    const r = rng();
    return r < 0.05 ? c3 : r < 0.09 ? c1 : c2;
  });
}

// Nuvens de névoa que passam devagar (ladrilho que se repete sem emenda)
function pintarNuvensNevoa() {
  const w = 160;
  const h = 96;
  const rng = criarRng(61);
  const bolhas = Array.from({ length: 7 }, () => ({ x: rng.inteiro(0, w), y: rng.inteiro(0, h), rx: rng.inteiro(16, 38), ry: rng.inteiro(5, 12) }));
  const [c2, c3] = [COR.c2, COR.c3].map(rgb);
  return pintarPorPixel(w, h, (x, y) => {
    let dens = 0;
    for (const b of bolhas) {
      const dx = Math.min(Math.abs(x - b.x), w - Math.abs(x - b.x)) / b.rx; // distância "dando a volta" no ladrilho
      const dy = Math.min(Math.abs(y - b.y), h - Math.abs(y - b.y)) / b.ry;
      dens = Math.max(dens, 1 - Math.hypot(dx, dy));
    }
    if (dens * 1.3 <= BAYER[y % 4][x % 4]) return null;
    return dens > 0.55 ? c3 : c2;
  });
}

// Contorno de elipse (ondinha na água)
function pintarOndinha(rx, ry) {
  const p = new Pintor(2 * rx + 1, 2 * ry + 1);
  const dentro = (x, y) => ((x - rx) / rx) ** 2 + ((y - ry) / ry) ** 2 <= 1;
  for (let y = 0; y <= 2 * ry; y++) {
    for (let x = 0; x <= 2 * rx; x++) {
      if (!dentro(x, y)) continue;
      if (dentro(x + 1, y) && dentro(x - 1, y) && dentro(x, y + 1) && dentro(x, y - 1)) continue;
      p.px(x, y, y < ry ? COR.c3 : COR.w4);
    }
  }
  return p;
}

// Peixe saltando (cabeça para a esquerda; espelhar para a direita), em branco para tingir com a cor da espécie.
// Quadros: 0 subindo · 1 no alto · 2 descendo
const PULO = [
  ['.kk.....', 'kaek....', 'kbbak...', '.kbbak..', '..kbbakk', '...kkkkk'],
  ['........', '.kkkk.kk', 'kaebbkbk', 'kbbbbbbk', '.kkkk.kk', '........'],
  ['...kkkkk', '..kbbakk', '.kbbak..', 'kbbak...', 'kaek....', '.kk.....'],
];
function pintarPeixePulo() {
  const p = new Pintor(8 * PULO.length, 6);
  PULO.forEach((g, i) => p.grade(g, { k: COR.k2, a: COR.c3, b: COR.c1, e: COR.k }, i * 8, 0));
  return p;
}

function pintarGotas() {
  const p = new Pintor(9, 5);
  p.grade(['..a...a..', 'a...b...a', '.a.b.b.a.', '..b...b..', '.........'], { a: COR.c3, b: COR.w4 });
  return p;
}

// ------------------------------------------------------------------ personagens (molde com troca de cores)
// k contorno · h/H/L chapéu (base/sombra/luz) · s/S pele · e olho · c/C/l roupa · p/P calça · b bota

const MOLDES = {
  frente0: ['...kkkk...', '..kLhhhk..', '.kLhhhhHk.', 'khhhhhhhHk', '.kssssssk.', '.ksesseSk.', '.kSssssSk.', 'kllcccccCk', 'klccccccCk', 'kscccccCsk', '.kcccccCk.', '.kppkkpPk.', '.kbk..kbk.', '..k....k..'],
  frente1: ['...kkkk...', '..kLhhhk..', '.kLhhhhHk.', 'khhhhhhhHk', '.kssssssk.', '.ksesseSk.', '.kSssssSk.', 'kllcccccCk', 'klccccccCk', 'kscccccCsk', '.kcccccCk.', '.kppkkpPk.', '.kpk..kbk.', '.kbk...k..'],
  costas0: ['...kkkk...', '..kLhhhk..', '.kLhhhhHk.', 'khhhhhhhHk', '.kHhhhhHk.', '.kSSSSSSk.', '..kSSSSk..', 'kllcccccCk', 'klccccccCk', 'kscccccCsk', '.kcccccCk.', '.kppkkpPk.', '.kbk..kbk.', '..k....k..'],
  costas1: ['...kkkk...', '..kLhhhk..', '.kLhhhhHk.', 'khhhhhhhHk', '.kHhhhhHk.', '.kSSSSSSk.', '..kSSSSk..', 'kllcccccCk', 'klccccccCk', 'kscccccCsk', '.kcccccCk.', '.kppkkpPk.', '.kbk..kpk.', '..k...kbk.'],
  lado0: ['...kkkk...', '..kLhhhk..', '.kLhhhhHk.', '.khhhhhhhk', '..kssssk..', '..ksssek..', '..kSsssk..', '..klccCk..', '..klccCk..', '..klccsk..', '..kcccCk..', '..kppPk...', '..kbkbk...', '...k.k....'],
  lado1: ['...kkkk...', '..kLhhhk..', '.kLhhhhHk.', '.khhhhhhhk', '..kssssk..', '..ksssek..', '..kSsssk..', '..klccCk..', '..klccCk..', '..klccsk..', '..kcccCk..', '.kppkPPk..', '.kbk.kbk..', '..k...k...'],
};
export const QUADROS = ['frente0', 'frente1', 'costas0', 'costas1', 'lado0', 'lado1'];

const PERSONAGENS = {
  pescador: { h: COR.y2, H: COR.y1, L: COR.y3, c: COR.y2, C: COR.y1, l: COR.y3, p: COR.b1, P: COR.b0, b: COR.m0 },
  cliente: { h: COR.c2, H: COR.c1, L: COR.c3, c: COR.c2, C: COR.c1, l: COR.c3, p: COR.k2, P: COR.k, b: COR.m0 },
  tripulante: { h: COR.b1, H: COR.b0, L: COR.b2, c: COR.b2, C: COR.b1, l: COR.b3, p: COR.m1, P: COR.m0, b: COR.k2 },
  colecionador: { h: COR.u1, H: COR.u0, L: COR.u2, c: COR.u2, C: COR.u1, l: COR.u3, p: COR.k2, P: COR.k, b: COR.k },
  cansado: { h: COR.c0, H: COR.k3, L: COR.c1, c: COR.c1, C: COR.c0, l: COR.c2, p: COR.k3, P: COR.k2, b: COR.k2 },
};

function pintarPersonagem(cores) {
  const legenda = { k: COR.k, s: COR.s1, S: COR.s0, e: COR.k, ...cores };
  const p = new Pintor(10 * QUADROS.length, 14);
  QUADROS.forEach((q, i) => p.grade(MOLDES[q], legenda, i * 10, 0));
  return p;
}

// ------------------------------------------------------------------ ícones e pequenos objetos

const SOMBRA = 'rgba(42,31,45,0.35)';
const ICONES = {
  moeda: { g: ['..kkkk..', '.kaabbk.', 'kabbbbck', 'kabddbck', 'kabddbck', 'kbbbbcck', '.kcccck.', '..kkkk..'], l: { a: COR.y3, b: COR.y2, c: COR.y1, d: COR.y0 } },
  estrela: { g: ['....k....', '...kak...', 'kkkkabkkk', 'kaabbbbck', '.kbbbbck.', '..kbbbk..', '.kbbkbbk.', '.kkk.kkk.'], l: { a: COR.y3, b: COR.y2, c: COR.y1 } },
  combustivel: { g: ['..kkkk..', '.kk..kk.', 'kaaaaabk', 'kabbbbck', 'kabkkbck', 'kabbbbck', 'kbbbbcck', '.kkkkkk.'], l: { a: COR.v3, b: COR.v2, c: COR.v1 } },
  coluna: { g: ['kkkkkkkk', 'kaaaaabk', 'kkkkkkkk', '.kakabk.', '.kakabk.', '.kakabk.', 'kkkkkkkk', 'kaaaabbk', 'kkkkkkkk'], l: { a: COR.c3, b: COR.c1 } },
  relogio: { g: ['..kkkk..', '.kaaaak.', 'kaakaabk', 'kaakaabk', 'kaakkabk', 'kaaaaabk', '.kbbbbk.', '..kkkk..'], l: { a: COR.c3, b: COR.c1 } },
  sol: { g: ['b..bb..b', '.bkkkkb.', '.kaaabk.', 'bkaaabkb', 'bkabbbkb', '.kbbbck.', '.bkkkkb.', 'b..bb..b'], l: { a: COR.y3, b: COR.y2, c: COR.y1 } },
  onda: { g: ['...kkk..', '..kaabk.', '.kabkkbk', 'kabk..k.', 'kabbk...', 'kbbbbkkk', 'kcccccck', '.kkkkkk.'], l: { a: COR.w4, b: COR.w3, c: COR.w2 } },
  nuvem: { g: ['...kkk...', '..kaaak..', '.kaaaabkk', 'kaaaaabbk', 'kbbbbbbck', '.kkkkkkk.'], l: { a: COR.c3, b: COR.c2, c: COR.c1 } },
  lua: { g: ['..kkkk..', '.kaak...', 'kaak....', 'kaak....', 'kabk....', 'kabbk...', '.kbbbkk.', '..kkkk..'], l: { a: COR.y3, b: COR.y2 } },
  cardume: { g: ['..kkkk...', '.kaaabk.k', 'kaekabbkk', 'kabbbbckk', '.kccck..k', '..kkk....'], l: { a: COR.b3, b: COR.b2, c: COR.b1, e: COR.k } },
  peixe: { g: ['.kkkk.k', 'kaebbkk', 'kbbbbkk', '.kkkk.k'], l: { a: COR.c3, b: COR.c2, e: COR.k } },
  brilho: { g: ['...a...', '...a...', '..aba..', 'aabbbaa', '..aba..', '...a...', '...a...'], l: { a: COR.y2, b: COR.c3 } },
  seta: { g: ['..aa...', '..aba..', 'aaabba.', 'abbbbba', 'aaabba.', '..aba..', '..aa...'], l: { a: COR.m0, b: COR.m1 } },
  setaBaixo: { g: ['.kkkkk.', '.kaabk.', '.kaabk.', 'kkaabkk', 'kaaabbk', '.kaabk.', '..kbk..', '...k...'], l: { a: COR.y3, b: COR.y2 } },
  barril: { g: ['.kkkkk.', 'kabbbck', 'kdddddk', 'kabbbck', 'kabbbck', 'kdddddk', 'kabbbck', '.kkkkk.'], l: { a: COR.m3, b: COR.m2, c: COR.m1, d: COR.c0 } },
  caixote: { g: ['kkkkkkk', 'kaaaabk', 'kbcbcbk', 'kkkkkkk', 'kaaaabk', 'kbcbcbk', 'kkkkkkk'], l: { a: COR.m3, b: COR.m2, c: COR.m1 } },
  poste: { g: ['.kkk.', 'kaaak', 'kabak', '.kkk.', '..d..', '..d..', '..d..', '..d..', '..d..', '..d..', '.kdk.', 'kkkkk'], l: { a: COR.y3, b: COR.y2, d: COR.k2 } },
  tufo: { g: ['a.b.a', 'ab.ba', 'bbcbb'], l: { a: COR.g3, b: COR.g2, c: COR.g1 } },
  pedra: { g: ['.kk.', 'kabk', 'kbbk', '.kk.'], l: { a: COR.r3, b: COR.r1 } },
  corda: { g: ['.kkk.', 'kabak', 'kbkbk', 'kabak', '.kkk.'], l: { a: COR.m3, b: COR.m2 } },
  pessoa: { g: ['..kkk..', '.kaaak.', '.kaaak.', '..kkk..', '.kbbbk.', 'kbbbbbk', 'kcbbbck', 'kkkkkkk'], l: { a: COR.s2, b: COR.b2, c: COR.b1 } },
  bolha: { g: ['ab', 'bb'], l: { a: COR.c3, b: COR.w4 } },
  sombra: { g: ['.aaaaaa.', 'aaaaaaaa', '.aaaaaa.'], l: { a: SOMBRA } },
  gaivota0: { g: ['a.....a', 'ab...ba', '.abkba.', '...k...'], l: { a: COR.c3, b: COR.c1, k: COR.k2 } },
  gaivota1: { g: ['.......', 'aab.baa', '..bkb..', '...k...'], l: { a: COR.c3, b: COR.c1, k: COR.k2 } },
};

export const NOMES_ICONES = Object.keys(ICONES);

function pintarIcone(nome) {
  const { g, l } = ICONES[nome];
  const p = new Pintor(Math.max(...g.map((x) => x.length)), g.length);
  p.grade(g, { k: COR.k, ...l });
  return p;
}

// ------------------------------------------------------------------ registro no Phaser

function addCanvas(cena, chave, pintor, quadros = null) {
  if (cena.textures.exists(chave)) return;
  const tex = cena.textures.addCanvas(chave, pintor.ampliado());
  if (quadros) {
    const { n, w, h } = quadros;
    for (let i = 0; i < n; i++) tex.add(i, 0, i * w * S, 0, w * S, h * S);
  }
}

export function registrarTexturas(cena) {
  if (cena.textures.exists('areia')) return;
  addCanvas(cena, 'areia', pintarAreia());
  addCanvas(cena, 'agua', pintarAgua());
  addCanvas(cena, 'nuvensNevoa', pintarNuvensNevoa());
  addCanvas(cena, 'peixePulo', pintarPeixePulo(), { n: PULO.length, w: 8, h: 6 });
  addCanvas(cena, 'gotas', pintarGotas());
  [[3, 1], [5, 2], [8, 3]].forEach(([rx, ry], i) => addCanvas(cena, `ondinha-${i}`, pintarOndinha(rx, ry)));
  addCanvas(cena, 'tabuaTopo', pintarTabuaTopo());
  addCanvas(cena, 'margem', pintarMargem());
  addCanvas(cena, 'pier', pintarTabuas(60, 16, true));
  addCanvas(cena, 'pierMar', pintarTabuas(18, 40, false));
  addCanvas(cena, 'praca', pintarPraca(110, 62));
  addCanvas(cena, 'escritorio', pintarPredio(64, 35, { telhado: [COR.t0, COR.t1, COR.t2, COR.t3] }));
  addCanvas(cena, 'mercado', pintarPredio(64, 27, { telhado: [COR.g0, COR.g1, COR.g2, COR.g3], toldo: true }));
  addCanvas(cena, 'taverna', pintarPredio(64, 35, { telhado: [COR.m0, COR.m1, COR.m2, COR.m3], chamine: true }));
  addCanvas(cena, 'bomba', pintarBomba());
  addCanvas(cena, 'bancada', pintarBancada());
  const barco = pintarBarco();
  addCanvas(cena, 'barcoH', barco);
  addCanvas(cena, 'barcoV', girar(barco));
  for (const [nome, cores] of Object.entries(PERSONAGENS)) addCanvas(cena, nome, pintarPersonagem(cores), { n: QUADROS.length, w: 10, h: 14 });
  for (const [r, tam] of [[9, 'p'], [12, 'm'], [15, 'g']]) {
    addCanvas(cena, `cardume-${tam}`, pintarCardume(r, false));
    addCanvas(cena, `cardumeDourado-${tam}`, pintarCardume(r, true));
    addCanvas(cena, `anel-${tam}`, pintarAnel(r));
  }
  for (const nome of NOMES_ICONES) addCanvas(cena, `ico-${nome}`, pintarIcone(nome));
}

// Véu de neblina para um alcance de sonar (em unidades do mundo). Gera uma vez e reaproveita.
export function texturaVeuNevoa(cena, alcance) {
  const chave = `veuNevoa-${alcance}`;
  if (!cena.textures.exists(chave)) cena.textures.addCanvas(chave, pintarVeuNevoa(Math.round(alcance / S)).ampliado());
  return chave;
}

// Moldura de qualquer tamanho (w, h em pixels de TELA, múltiplos de S). Gera uma vez e reaproveita.
export function texturaMoldura(cena, estilo, w, h) {
  const aw = Math.max(6, Math.round(w / S));
  const ah = Math.max(6, Math.round(h / S));
  const chave = `moldura-${estilo}-${aw}x${ah}`;
  if (!cena.textures.exists(chave)) cena.textures.addCanvas(chave, pintarMoldura(estilo, aw, ah).ampliado());
  return chave;
}

// ------------------------------------------------------------------ as mesmas artes no HTML

export function instalarEstiloPixel() {
  const url = (p) => `url(${p.ampliado().toDataURL()})`;
  const css = [
    `:root {
      --moldura: ${url(pintarMoldura('pergaminho', 16, 16))};
      --moldura-simples: ${url(pintarMoldura('simples', 10, 10))};
      --moldura-fita: ${url(pintarMoldura('fita', 10, 10))};
      --moldura-madeira: ${url(pintarMoldura('madeira', 10, 10))};
      --moldura-tecla: ${url(pintarMoldura('tecla', 10, 10))};
      --agua: ${url(pintarAgua())};
      --areia: ${url(pintarAreia())};
      --barco: ${url(pintarBarco())};
    }`,
  ];
  for (const nome of NOMES_ICONES) {
    const p = pintarIcone(nome);
    css.push(`.ico-${nome} { background-image: ${url(p)}; width: ${p.w * S}px; height: ${p.h * S}px; }`);
  }
  for (const nome of Object.keys(PERSONAGENS)) {
    const p = pintarPersonagem(PERSONAGENS[nome]);
    css.push(`.boneco-${nome} { background-image: ${url(p)}; }`);
  }
  const style = document.createElement('style');
  style.textContent = css.join('\n');
  document.head.append(style);
}
