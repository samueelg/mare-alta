// Controlador: amarra regras (src/regras), telas HTML (src/telas) e as cenas (src/cena).
// O fluxo de uma partida é lido de cima para baixo em jogar().
//
// Dica para a apresentação: abra com ?semente=123 para repetir sempre a mesma partida
// (inclusive o clima e os eventos aleatórios).

import { CONFIG } from './regras/config.js';
import { criarEstado } from './regras/estado.js';
import {
  comprarProcesso,
  decidirMudanca,
  descansar,
  encerrarMar,
  iniciarExpedicao,
  planejar,
  verificarFim,
} from './regras/expedicao.js';
import { licoes } from './regras/relatorio.js';
import * as telas from './telas/telas.js';
import { MarScene } from './cena/MarScene.js';
import { PortoScene } from './cena/PortoScene.js';
import { instalarEstiloPixel } from './cena/pixel.js';
import { alternarMudo, ambiente, iniciarAudio, som, estadoAudio } from './cena/som.js';

// As mesmas artes do canvas viram CSS (molduras, ícones) para as telas HTML.
instalarEstiloPixel();

// ------------------------------------------------------------------ canvas do tamanho exato do palco

// O canvas tem exatamente os pixels físicos do palco (considerando a escala do Windows, ex.: 125%).
// Assim o navegador nunca estica nem encolhe a imagem, que era o que borrava os textos.
// As cenas ajustam o zoom da câmera para o mundo de 960×540 caber (ver prepararCamera).
const palco = document.getElementById('palco');
function medidasPalco() {
  const r = palco.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  return { w: Math.max(320, Math.round(r.width * dpr)), h: Math.max(180, Math.round(r.height * dpr)), dpr };
}
const inicial = medidasPalco();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'palco',
  width: inicial.w,
  height: inicial.h,
  backgroundColor: '#120d17',
  pixelArt: true,
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / inicial.dpr },
  scene: [],
});

function redimensionar() {
  palco.style.setProperty('--k', palco.clientWidth / 960); // telas HTML: desenhadas em 960×540 e escaladas
  const m = medidasPalco();
  if (game.scale.width !== m.w || game.scale.height !== m.h) game.scale.resize(m.w, m.h);
  if (game.scale.zoom !== 1 / m.dpr) game.scale.setZoom(1 / m.dpr);
}
new ResizeObserver(redimensionar).observe(palco);
redimensionar();

// ------------------------------------------------------------------ tela cheia

function alternarTelaCheia() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
document.addEventListener('keydown', (e) => {
  iniciarAudio(); // o navegador só libera som depois de um gesto do jogador
  if (e.repeat) return;
  if (e.code === 'KeyF') alternarTelaCheia();
  if (e.code === 'KeyM') alternarMudo();
});
document.addEventListener('pointerdown', iniciarAudio);
ambiente('mar'); // ondas e gaivotas já na tela inicial (tocam assim que o som for liberado)
document.getElementById('telaCheia').addEventListener('click', alternarTelaCheia);
game.scene.add('Mar', MarScene, false);
game.scene.add('Porto', PortoScene, false);
const jogoPronto = new Promise((r) => (game.isBooted ? r() : game.events.once('ready', r)));

// ?debug expõe o jogo no console (window.mareAlta) para inspeção e testes automatizados.
if (new URLSearchParams(location.search).has('debug')) window.mareAlta = { game, som, estadoAudio };

function sementeDaUrl() {
  const s = Number(new URLSearchParams(location.search).get('semente'));
  return Number.isFinite(s) && s > 0 ? s : Date.now();
}

// Porto jogável. fase 'saida' resolve com { jornada } quando o jogador embarca;
// fase 'chegada' resolve com o resultado de entregar() quando ele entrega ao cliente.
async function irAoPorto(fase, estado, exp, descanso = null) {
  await jogoPronto;
  telas.esconder();
  game.scene.stop('Mar');
  return new Promise((aoConcluir) => {
    game.scene.start('Porto', {
      fase,
      estado,
      exp,
      descanso,
      aoConcluir,
      abrirEscritorio: async () => {
        await telas.escritorio(estado, { comprar: (id) => comprarProcesso(estado, id) });
        telas.esconder();
      },
    });
  });
}

// Roda a cena do mar e resolve quando o barco volta (ou o prazo/combustível acaba).
async function irAoMar(estado, exp) {
  await jogoPronto;
  telas.esconder();
  game.scene.stop('Porto');
  return new Promise((aoTerminar) => {
    game.scene.start('Mar', {
      estado,
      exp,
      aoTerminar,
      aoMudanca: async (e) => {
        const decisao = await telas.mudanca(estado, e);
        decidirMudanca(estado, e, decisao);
        telas.esconder();
      },
    });
  });
}

// A fonte pixel precisa estar carregada antes do Phaser escrever qualquer texto no canvas.
const fontesProntas = Promise.all([
  document.fonts.load('16px "Pixelify Sans"'),
  document.fonts.load('bold 16px "Pixelify Sans"'),
]).catch(() => {});

async function jogar() {
  const estado = criarEstado(sementeDaUrl());
  console.info('Semente da partida:', estado.semente);
  game.scene.stop('Porto');
  await fontesProntas;
  await telas.inicio();
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); // o clique em "Começar" permite

  let fim = null;
  let descanso = null;
  for (let i = 0; i < CONFIG.totalExpedicoes && !fim; i++) {
    const exp = iniciarExpedicao(estado); // o cliente chega ao porto (e o clima do dia é sorteado)

    // No porto: pedido (REQ), bomba (GPR), escritório (MR-MPS-SW), taverna (RH) e embarque
    const { jornada } = await irAoPorto('saida', estado, exp, descanso);
    planejar(estado, exp, { jornada });

    encerrarMar(estado, exp, await irAoMar(estado, exp));

    // De volta: bancada (verificação) e entrega ao cliente (validação)
    const resultado = await irAoPorto('chegada', estado, exp);
    const ultima = i === CONFIG.totalExpedicoes - 1;
    await telas.entrega(estado, exp, resultado, ultima);

    fim = verificarFim(estado, 'aposEntrega');
    if (fim || ultima) break;
    descanso = descansar(estado);
    fim = verificarFim(estado, 'noPorto');
  }

  fim ??= verificarFim(estado, 'final');
  game.scene.stop('Porto');
  game.scene.stop('Mar');
  await telas.final(estado, fim, licoes(estado));
  jogar();
}

jogar();
