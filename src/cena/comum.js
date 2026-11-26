// Utilidades compartilhadas pelas cenas Porto e Mar (desenho apenas, sem regras).

import { COR, S, TINTA, hex, texturaMoldura } from './pixel.js';

// O mundo do jogo tem sempre 960×540 de coordenadas. O canvas tem o tamanho REAL do palco em
// pixels da tela (sem o navegador esticar nem encolher a imagem) e a câmera aproxima o mundo.
export const W = 960;
export const H = 540;
export const TOPO = 60; // altura da barra de topo

const familia = '"Pixelify Sans", monospace';
// A resolução do texto é ajustada sozinha ao zoom da câmera (ver prepararCamera)
export const FONTE = {
  base: { fontFamily: familia, fontSize: '16px', color: TINTA.escura },
  clara: { fontFamily: familia, fontSize: '16px', color: TINTA.clara, stroke: '#2a1f2d', strokeThickness: 3 },
};

// Tipos de aviso flutuante: cor da marquinha na etiqueta
export const CORES = { ok: 'ok', ruim: 'ruim', alerta: 'alerta', neutro: 'neutro', ouro: 'ouro' };
const MARCA = { ok: COR.g2, ruim: COR.v1, alerta: COR.y1, neutro: COR.m2, ouro: COR.y2 };

export const real = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const kg = (v) => `${v.toFixed(1).replace('.', ',')} kg`;

// Texto nítido: resolução igual ao zoom (1 pixel do texto = 1 pixel da tela) e filtro suave.
// A pixel art continua com filtro "nearest"; só o texto usa o suave.
function deixarNitido(t, zoom) {
  if (t.style.resolution !== zoom) t.setResolution(zoom);
  t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

function textosDe(lista, fn) {
  for (const go of lista) {
    if (go instanceof Phaser.GameObjects.Text) fn(go);
    else if (go.list) textosDe(go.list, fn); // containers
  }
}

export function prepararCamera(cena) {
  const ajustar = () => {
    const zoom = Math.min(cena.scale.width / W, cena.scale.height / H);
    cena.zoomTexto = zoom;
    cena.cameras.main.setZoom(zoom).centerOn(W / 2, H / 2);
    textosDe(cena.children.list, (t) => deixarNitido(t, zoom));
  };
  const aoAdicionar = (go) => {
    if (go instanceof Phaser.GameObjects.Text) deixarNitido(go, cena.zoomTexto);
  };
  ajustar();
  cena.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, aoAdicionar);
  cena.scale.on('resize', ajustar);
  cena.events.once('shutdown', () => {
    cena.scale.off('resize', ajustar);
    cena.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, aoAdicionar);
  });
}

// Aviso flutuante: etiqueta de pergaminho com texto escuro (legível sobre qualquer fundo).
// Sobe um pouco em degraus, fica parada para leitura e some no fim.
export function flutuar(cena, x, y, texto, tipo = CORES.neutro, duracao = 1800) {
  const t = cena.add.text(0, 0, texto, { ...FONTE.base, fontSize: '15px', align: 'center', lineSpacing: 3 }).setOrigin(0, 0.5);
  const w = Math.ceil((t.width + 33) / S) * S;
  const h = Math.ceil((t.height + 15) / S) * S;
  const fundo = cena.add.image(0, 0, texturaMoldura(cena, 'simples', w, h)).setOrigin(0);
  const marca = cena.add.rectangle(6, 6, S * 2, h - 12, hex(MARCA[tipo] ?? MARCA.neutro)).setOrigin(0);
  t.setPosition(18, h / 2);
  const x0 = Math.round(Math.min(W - w - 6, Math.max(6, x - w / 2)) / S) * S;
  const y0 = Math.round(Math.max(TOPO + 6, Math.min(H - h - 6, y - h / 2)) / S) * S;
  const c = cena.add.container(x0, y0, [fundo, marca, t]).setDepth(50);
  cena.tweens.add({ targets: c, y: y0 - 4 * S, duration: 300, ease: 'Stepped', easeParams: [4] });
  cena.tweens.add({ targets: c, alpha: 0, delay: duracao - 350, duration: 350, onComplete: () => c.destroy() });
  return c;
}

// setText só quando o texto mudou (refazer a textura de texto a cada quadro é caro).
export function atualizarTexto(obj, texto) {
  if (obj.text !== texto) obj.setText(texto);
}
