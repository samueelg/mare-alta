// Robô: joga uma temporada inteira no Chrome de verdade (porto + mar) e tira prints.
// Usa ?debug para teleportar o pescador/barco e ler a tensão do minijogo; as AÇÕES são teclas reais.
import puppeteer from 'puppeteer-core';

const URL = process.env.URL_JOGO ?? 'http://localhost:8080/?semente=123&debug';
const SAIDA = process.argv[2] ?? './prints';
const erros = [];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--window-size=1600,900', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && erros.push(m.text()));
page.on('pageerror', (e) => erros.push(String(e)));

const print = (nome) => page.screenshot({ path: `${SAIDA}/${nome}.png` });
const clicar = async (acao, extra = '') => {
  await page.waitForSelector(`#tela:not([hidden]) [data-acao="${acao}"]${extra}`, { timeout: 15000 });
  await page.click(`#tela [data-acao="${acao}"]${extra}`);
  await esperar(200);
};
const naCena = (nome) => (fn, ...args) =>
  page.evaluate((n, src, a) => new Function('s', 'a', src)(window.mareAlta.game.scene.getScene(n), a), nome, fn, args);
const mar = naCena('Mar');
const porto = naCena('Porto');
const tecla = async (code) => {
  await page.keyboard.press(code);
  await esperar(150);
};
const irPara = async (x, y) => {
  await porto(`s.moverBoneco(s.jogador, a[0], a[1]); return 1;`, x, y);
  await esperar(120);
};
const esperarPorto = () =>
  page.waitForFunction(() => {
    const g = window.mareAlta.game;
    return g.scene.isActive('Porto') && !g.scene.getScene('Porto').concluido;
  }, { timeout: 20000 });
const dialogoAberto = () => porto('return s.dialogo.aberto;');
// Fundo do #tela visível sem modal = o bug do "tela escurecida"
const overlayPreso = () => page.$eval('#tela', (t) => getComputedStyle(t).display !== 'none' && !t.innerHTML.trim());

async function pescar(n, { dourado = false } = {}) {
  for (let i = 0; i < n; i++) {
    const ok = await mar(`
      const esp = s.exp.specs[s.exp.specs.length - 1].especie;
      const vivos = s.exp.cardumes.filter(c => c.quantidade > 0);
      const c = (a[0] && vivos.find(c => c.evento === 'dourado')) || vivos.find(c => c.especie === esp) || vivos[0];
      if (!c) return false;
      s.barco.x = c.x; s.barco.y = c.y; s.vel = { x: 0, y: 0 }; return true;`, dourado);
    if (!ok) return;
    await page.keyboard.press('Space');
    await esperar(50);
    let segurando = false;
    for (let t = 0; t < 400; t++) {
      const m = await mar(`return s.minijogo && { tensao: s.minijogo.tensao, limite: s.minijogo.limite };`);
      if (!m) break;
      if (i === 0 && t === 20 && !dourado) await print('03-minijogo');
      const quer = segurando ? m.tensao < m.limite * 0.7 : m.tensao < m.limite * 0.35;
      if (quer !== segurando) {
        segurando = quer;
        await (segurando ? page.keyboard.down('Space') : page.keyboard.up('Space'));
      }
      await esperar(40);
    }
    if (segurando) await page.keyboard.up('Space');
    await esperar(300);
    if (i === 0 && !dourado) await print('03b-captura');
    if (await overlayPreso()) erros.push(`Overlay escuro preso depois da pesca ${i + 1}`);
  }
}

async function saida(n, { conversar, compras = [], contratar = false, combustivelAlvo = 90, horaExtra = false, forcarDourado = false }) {
  await esperarPorto();
  await esperar(2000); // o cliente chega andando
  if (n === 1) await print('01-porto');

  // Escritório: processos (antes de falar com o cliente, para a Ficha valer neste pedido)
  if (compras.length) {
    await irPara(135, 204);
    await tecla('KeyE');
    for (const id of compras) await clicar('comprar', `[data-id="${id}"]`).catch(() => erros.push(`Não comprou ${id}`));
    await print(`07-escritorio-exp${n}`);
    await clicar('sair');
  }

  // Cliente: pedido (REQ)
  await porto(`s.moverBoneco(s.jogador, s.cliente.sombra.x - 30, s.cliente.sombra.y); return 1;`);
  await esperar(120);
  await tecla('KeyE');
  if (conversar) await tecla('Digit1');
  if (n === 1) await print('02-pedido');
  await tecla('Escape');

  // Taverna
  if (contratar) {
    await irPara(135, 492);
    await tecla('KeyE');
    await tecla('Digit1');
    await print(`07-taverna-exp${n}`);
    await tecla('Escape');
  }

  // Bomba: segura E até perto do alvo
  const tanque = await porto('return s.estado.tanque;');
  if (tanque < combustivelAlvo) {
    await irPara(621, 195);
    await page.keyboard.down('KeyE');
    await esperar(((combustivelAlvo - tanque) / 40) * 1000);
    if (n === 1) await print('02b-bomba');
    await page.keyboard.up('KeyE');
    await esperar(100);
  }

  if (forcarDourado) {
    await porto(`s.exp.eventosMar.dourado = { em: 0.05, duracao: 20, quantidade: 2, x: 520, y: 300, ocorreu: false }; return 1;`);
  }

  // Barco: jornada. Na 1ª expedição o robô anda de verdade (areia e depois píer) para tocar os passos.
  if (n === 1) {
    await irPara(660, 282);
    await page.keyboard.down('KeyD');
    await esperar(1300);
    await page.keyboard.up('KeyD');
  }
  await irPara(858, 282);
  await tecla('KeyE');
  if (n === 1) await print('02c-barco');
  if (await dialogoAberto()) await tecla(horaExtra ? 'Digit2' : 'Digit1');
  await page.waitForFunction(() => window.mareAlta.game.scene.isActive('Mar'), { timeout: 10000 });
  await esperar(400);
}

async function expedicao(n, opcoes) {
  const { decisaoMudanca, pularTriagem = false, forcarDourado = false } = opcoes;
  await saida(n, opcoes);

  if (n === 1) {
    // logo ao zarpar, forçar o barco contra a areia: ele deve parar na costa (sem atracar sozinho)
    await page.keyboard.down('KeyA');
    await esperar(1200);
    await page.keyboard.up('KeyA');
    const b = await mar(`return { x: Math.round(s.barco.x), encerrado: s.encerrado };`);
    if (b.x < 147) erros.push(`O barco entrou na areia logo ao sair (x = ${b.x})`);
    if (b.encerrado) erros.push('O barco atracou sozinho sem ter se afastado da costa');
    await print('04a-encostado-na-costa');
  }

  if (forcarDourado) {
    await page.waitForFunction(() => window.mareAlta.game.scene.getScene('Mar').exp.eventosMar.dourado.ocorreu, { timeout: 15000 });
    await esperar(300);
    await print(`04b-cardume-dourado-exp${n}`);
    await pescar(1, { dourado: true });
  }
  await pescar(3);
  if (n === 1) await print('04-mar');

  const temMudanca = await mar(`return !!s.exp.mudanca;`);
  if (temMudanca) {
    await mar(`s.tempo = s.mudancaEm; return 1;`);
    await page.waitForSelector('#tela.modal:not([hidden])', { timeout: 5000 });
    await print(`05-mudanca-exp${n}`);
    await clicar(decisaoMudanca);
    await esperar(300);
    if (await overlayPreso()) erros.push(`Overlay escuro preso depois do rádio (exp ${n})`);
    await print(`05b-depois-do-radio-exp${n}`);
    await pescar(3);
  } else {
    await pescar(2);
  }

  if (n === 3) {
    await mar(`s.tempo = s.exp.prazo; return 1;`); // termina pelo prazo
  } else {
    // volta navegando para a costa: ao cruzar a linha de boias o barco atraca sozinho
    await mar(`s.barco.x = 300; s.barco.y = 270; s.vel = { x: 0, y: 0 }; return 1;`);
    await page.keyboard.down('KeyA');
    await page.waitForFunction(() => window.mareAlta.game.scene.getScene('Mar').encerrado, { timeout: 8000 });
    await page.keyboard.up('KeyA');
    const x = await mar(`return Math.round(s.barco.x);`);
    if (x < 147) erros.push(`O barco entrou na areia (x = ${x})`);
    if (n === 1) await print('04c-atracando');
  }

  // Chegada: bancada (opcional) e entrega
  await esperarPorto();
  await esperar(500);
  if (!pularTriagem) {
    await irPara(612, 381);
    await tecla('KeyE');
    if (await porto('return s.dialogo.aberto && s.dialogo.opcoes.length > 0;')) await tecla('Digit1'); // fazer a triagem
    await esperar(900);
    if (n === 1) await print('06a-triagem');
    await tecla('Escape');
  }
  await porto(`s.moverBoneco(s.jogador, s.cliente.sombra.x + 30, s.cliente.sombra.y); return 1;`);
  await esperar(120);
  await tecla('KeyE');
  if (n === 1) await print('06b-entregar');
  await tecla('Digit1');
  await esperar(600);
  if (n === 1) await print('06c-reacao-cliente');
  await page.waitForSelector('#tela.modal:not([hidden]) [data-acao="seguir"]', { timeout: 10000 });
  await print(`06-relatorio-exp${n}`);
  const resumo = await page.$eval('#tela', (t) => t.innerText.slice(0, 700));
  await clicar('seguir');
  return resumo;
}

await page.goto(URL, { waitUntil: 'networkidle0' });
// Conta cada efeito sonoro disparado (o robô não ouve, mas confere que cada som tocou)
await page.evaluate(() => {
  window.sonsTocados = {};
  const som = window.mareAlta.som;
  for (const nome of Object.keys(som)) {
    const original = som[nome];
    som[nome] = (...a) => {
      window.sonsTocados[nome] = (window.sonsTocados[nome] ?? 0) + 1;
      return original(...a);
    };
  }
});
await print('00-inicio');
await clicar('comecar');

// Cada expedição exercita um caminho diferente (entrega sem bancada, mudança aceita, cardume dourado,
// hora extra, contratação, checklist automático, mudança analisada).
const roteiro = [
  { conversar: true, pularTriagem: true },
  { compras: ['fichaPedido'], decisaoMudanca: 'aceitar', forcarDourado: true },
  { compras: ['checklistTriagem'], horaExtra: true, contratar: true },
  { decisaoMudanca: 'analisar' },
];
const resumos = [];
for (const [i, opcoes] of roteiro.entries()) {
  if (await page.$('#tela:not([hidden]) [data-acao="denovo"]')) {
    console.log(`A partida terminou antes da expedição ${i + 1}.`);
    break;
  }
  resumos.push(await expedicao(i + 1, opcoes));
}

await page.waitForSelector('[data-acao="denovo"]', { timeout: 10000 });
await print('08-final');
const final = await page.$eval('#tela', (t) => t.innerText);
console.log('=== RESUMOS DAS ENTREGAS ===');
resumos.forEach((r, i) => console.log(`--- exp ${i + 1}\n${r.replace(/\n+/g, ' | ')}`));
console.log('=== TELA FINAL ===\n' + final);
const sons = await page.evaluate(() => ({ tocados: window.sonsTocados, audio: window.mareAlta.estadoAudio() }));
console.log('=== SONS ===\n' + JSON.stringify(sons));
for (const nome of ['interacao', 'passo', 'lancar', 'fisgado', 'dinheiro', 'gaivota', 'respingo']) {
  if (!sons.tocados[nome]) erros.push(`O som "${nome}" não tocou nenhuma vez`);
}
console.log('=== ERROS DO NAVEGADOR ===\n' + (erros.length ? erros.join('\n') : 'nenhum'));
await browser.close();
