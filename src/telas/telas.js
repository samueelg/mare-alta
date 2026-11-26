// Telas HTML por cima do canvas do Phaser. Depois do porto jogável, sobraram só:
//   início, rádio de mudança (modal no mar), escritório (modal no porto), relatório da entrega (modal) e final.
// O visual (molduras de pergaminho, ícones pixel) vem de src/cena/pixel.js via CSS.
// Cada tela devolve uma Promise que resolve com a escolha do jogador.
// As telas NÃO aplicam regras: quem aplica é quem as chama (main.js ou a cena), via src/regras.

import { CONFIG, ESPECIES } from '../regras/config.js';
import { PROCESSOS, IDS_PROCESSOS, nivelMaturidade } from '../regras/processos.js';
import { mediaTripulacao } from '../regras/estado.js';
import { custoMinimoViagem, impactoMudanca } from '../regras/expedicao.js';
import { som } from '../cena/som.js';

const tela = document.getElementById('tela');

export const real = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const kg = (v) => `${v.toFixed(1).replace('.', ',')} kg`;
const nomeEsp = (id) => ESPECIES[id].nome;
const ico = (nome) => `<i class="ico ico-${nome}"></i>`;

// modal: aparece por cima do jogo (fundo escurecido); sem modal: tela própria sobre o mar
function mostrar(html, { modal = false, largo = false } = {}) {
  tela.className = modal ? 'modal' : '';
  tela.innerHTML = `<div class="cartao ${largo ? 'largo' : ''}">${html}</div>`;
  tela.hidden = false;
  tela.querySelector('.cartao').scrollTop = 0;
}

// Atenção: a classe 'modal' precisa sair junto. Antes ela ficava, e o `display: flex` do CSS
// vencia o atributo `hidden`: o fundo escuro do rádio continuava por cima do mar.
export function esconder() {
  tela.hidden = true;
  tela.className = '';
  tela.innerHTML = '';
  tela.onclick = null;
  tela.onchange = null;
}

// Liga os botões [data-acao] a um handler. O handler chama resolve() quando a tela termina.
function aoClicar(handler) {
  return new Promise((resolve) => {
    tela.onclick = (e) => {
      const b = e.target.closest('[data-acao]');
      if (!b || b.disabled) return;
      som.interacao();
      handler(b.dataset.acao, b.dataset, resolve);
    };
  });
}

function barraStatus(estado) {
  const m = nivelMaturidade(estado.processos);
  return `
    <div class="status">
      <span>${ico('moeda')}<b>${real(estado.caixa)}</b></span>
      <span>${ico('estrela')}Reputação <b>${estado.reputacao}</b>/100</span>
      <span>${ico('pessoa')}Tripulação <b>${estado.tripulacao.length}</b></span>
      <span class="maturidade nivel-${m.nivel}" title="${m.descricao}">${m.rotulo}</span>
    </div>`;
}

// ------------------------------------------------------------------ início

export function inicio() {
  mostrar(`
    <div class="capa">
      <h1>Maré Alta</h1>
      <p class="sub">do improviso ao processo</p>
      <div class="cena-capa"><div class="boneco boneco-pescador"></div><div class="barco"></div><div class="boneco boneco-cliente"></div></div>
      <p>Você comanda um barco que atende pedidos de restaurantes. São <b>${CONFIG.totalExpedicoes} expedições</b>.
      Entre uma e outra, no porto, você pode transformar boas práticas em <b>processos permanentes</b> da empresa.
      Termine com caixa positivo e reputação de pelo menos <b>${CONFIG.reputacaoVitoria}</b>.</p>
      <div class="colunas">
        <ul class="lista">
          <li class="titulo">No porto</li>
          <li><kbd>WASD</kbd>andar</li>
          <li><kbd>E</kbd>falar / usar (segure na bomba)</li>
          <li><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>escolher · <kbd>Esc</kbd>fechar</li>
        </ul>
        <ul class="lista">
          <li class="titulo">No mar</li>
          <li><kbd>WASD</kbd>navegar</li>
          <li><kbd>Espaço</kbd>pescar perto de um cardume</li>
          <li>volte às boias para atracar · <kbd>F</kbd>tela cheia · <kbd>M</kbd>som</li>
        </ul>
      </div>
      <button class="primario" data-acao="comecar">Começar temporada</button>
    </div>`);
  return aoClicar((_a, _d, resolve) => resolve());
}

// ------------------------------------------------------------------ rádio: mudança de requisito (no mar)

export function mudanca(estado, exp) {
  const m = exp.pedido.mudanca;
  const temFicha = estado.processos.fichaPedido;
  let analise;
  if (temFicha) {
    const imp = impactoMudanca(exp);
    const partes = [];
    if (imp.perdemValidade) partes.push(`<b>${imp.perdemValidade}</b> peixe(s) já pescado(s) deixariam de valer`);
    if (imp.kgAMais) partes.push(`a meta sobe <b>${imp.kgAMais} kg</b> no mesmo prazo`);
    if (!partes.length) partes.push('nenhum peixe já pescado perde validade');
    analise = `<div class="caixa ok"><b>Análise de impacto (Ficha de pedido):</b> ${partes.join(' e ')}.</div>`;
  } else {
    analise = `<div class="caixa neutro">Sem a Ficha de pedido, não há análise de impacto pronta.</div>`;
  }
  const repAnalisar = temFicha ? 0 : CONFIG.mudanca.analisar;
  mostrar(
    `<h2>${ico('onda')}Rádio: ${exp.pedido.cliente}</h2>
     <blockquote>“${m.texto}”</blockquote>
     ${analise}
     <div class="botoes-col">
       <button data-acao="aceitar">Aceitar direto <small>mesmo prazo; o que já foi pescado é cobrado pela regra nova</small></button>
       <button data-acao="analisar">Analisar e renegociar <small>+${CONFIG.mudanca.prazoExtraAnalise} s de prazo; o já pescado vale pela regra antiga; reputação ${repAnalisar}</small></button>
       <button data-acao="recusar">Recusar a mudança <small>reputação ${CONFIG.mudanca.recusar}</small></button>
     </div>`,
    { modal: true },
  );
  return aoClicar((acao, _d, resolve) => resolve(acao));
}

// ------------------------------------------------------------------ escritório (no porto): MR-MPS-SW

// acoes.comprar(id) -> { ok, erro }
export function escritorio(estado, acoes) {
  let mensagem = '';
  const render = () => {
    const reserva = custoMinimoViagem(estado);
    const cartoes = IDS_PROCESSOS.map((id) => {
      const p = PROCESSOS[id];
      const adotado = estado.processos[id];
      const pode = !adotado && estado.caixa - p.custo >= reserva;
      return `<div class="processo ${adotado ? 'adotado' : ''}">
        <div class="area">${p.area}</div>
        <div class="nome">${p.nome}</div>
        <p>${p.descricao}</p>
        ${adotado ? '<span class="tag">Institucionalizado</span>' : `<button data-acao="comprar" data-id="${id}" ${pode ? '' : 'disabled'}>Adotar · ${real(p.custo)}</button>`}
      </div>`;
    }).join('');
    mostrar(
      `${barraStatus(estado)}
      <div class="cabecalho">
        <h2>${ico('coluna')}Escritório da empresa</h2>
        <button class="primario" data-acao="sair">Voltar ao porto</button>
      </div>
      <p class="nota">${mensagem || `Processo adotado vira regra da empresa em todas as próximas viagens. Reserva para zarpar: <b>${real(reserva)}</b> (compras que a comprometem ficam bloqueadas).`}</p>
      <div class="processos">${cartoes}</div>`,
      { modal: true, largo: true },
    );
  };
  render();
  return aoClicar((acao, dados, resolve) => {
    if (acao === 'comprar') {
      const r = acoes.comprar(dados.id);
      mensagem = r.ok ? `Processo adotado: <b>${PROCESSOS[dados.id].nome}</b>.` : r.erro;
      render();
    } else resolve();
  });
}

// ------------------------------------------------------------------ relatório da entrega (validação + GPR)

export function entrega(estado, exp, r, ultima) {
  const rejeitados = r.rejeitados.length
    ? `<div class="caixa alerta"><b>Devolvidos pelo cliente (${r.rejeitados.length}):</b> ${r.rejeitados
        .map((p) => `${nomeEsp(p.especie)} ${p.tamanho} cm (${p.validacao.motivo})`)
        .join(', ')}</div>`
    : '';
  const trofeus = r.trofeus
    ? `<div class="caixa ok">${ico('brilho')}${r.trofeus} Garoupa(s) dourada(s) vendida(s) ao colecionador: <b>${real(r.receitaTrofeus)}</b>.</div>`
    : '';
  const prevLinha = r.previsao && !r.previsao.semDados
    ? `<tr><td>Pesca (previsão do diário)</td><td>${kg((r.previsao.kgPorMinuto.min * r.planejado.prazo) / 60)} a ${kg((r.previsao.kgPorMinuto.max * r.planejado.prazo) / 60)}</td><td>${kg(r.realizado.kgPescado)}</td></tr>`
    : '';
  const motivos = {
    porto: 'voltou ao porto',
    prazo: 'o prazo acabou',
    combustivel: `sem combustível: reboque de ${real(CONFIG.reboque.custo)}`,
  };
  mostrar(
    `${barraStatus(estado)}
    <h2>Expedição ${exp.numero} · Entrega para ${exp.pedido.cliente}</h2>
    <p class="nota">${ico(exp.clima.icone)}${exp.clima.nome} · ${motivos[exp.motivoFim]}${exp.linhasArrebentadas ? ` · linhas arrebentadas: ${exp.linhasArrebentadas}` : ''}</p>
    <div class="caixa ${r.metaAtingida ? 'ok' : 'alerta'}">
      <b>${r.metaAtingida ? 'Meta atingida!' : 'Meta não atingida.'}</b>
      ${kg(r.kgValido)} dentro da especificação, de ${exp.meta} kg pedidos.
    </div>
    ${rejeitados}
    ${trofeus}
    <div class="colunas">
      <div>
        <h3>Dinheiro</h3>
        <table class="tabela">
          <tr><td>Receita</td><td>${real(r.receita)}</td></tr>
          <tr><td>Custos (combustível, salários, triagem, reboque)</td><td>−${real(r.custoTotal)}</td></tr>
          <tr><th>Lucro da viagem</th><th>${real(r.lucro)}</th></tr>
          <tr><td>Reputação nesta viagem</td><td>${r.reputacaoDelta >= 0 ? '+' : ''}${r.reputacaoDelta}</td></tr>
        </table>
      </div>
      <div>
        <h3>Planejado × realizado</h3>
        <table class="tabela">
          <tr><th></th><th>Planejado</th><th>Realizado</th></tr>
          <tr><td>Combustível</td><td>${r.planejado.combustivel} no tanque</td><td>${Math.round(r.realizado.combustivel)} usados</td></tr>
          <tr><td>Tempo no mar</td><td>${r.planejado.prazo} s</td><td>${r.realizado.tempo} s</td></tr>
          <tr><td>Peixe válido</td><td>${r.planejado.meta} kg</td><td>${kg(r.realizado.kgValido)}</td></tr>
          ${prevLinha}
        </table>
      </div>
    </div>
    <button class="primario" data-acao="seguir">${ultima ? 'Ver resultado da temporada' : 'Continuar no porto'}</button>`,
    { modal: true, largo: true },
  );
  return aoClicar((_a, _d, resolve) => resolve());
}

// ------------------------------------------------------------------ fim

export function final(estado, fim, listaLicoes) {
  const m = nivelMaturidade(estado.processos);
  const linhas = estado.registros
    .map(
      (r) => `<tr><td>${r.numero}</td><td>${r.cliente}</td><td>${ico(r.clima.icone)}${r.clima.nome}</td><td>${r.especificacaoConhecida ? 'sim' : 'não'}</td>
      <td>${kg(r.kgValido)} / ${r.meta} kg</td><td>${r.rejeitados}</td><td>${real(r.lucro)}</td><td>${r.reputacaoDelta >= 0 ? '+' : ''}${r.reputacaoDelta}</td></tr>`,
    )
    .join('');
  const licoesHtml = listaLicoes
    .map((l) => `<div class="licao ${l.tipo}"><div class="area">${l.conceito}</div>${l.texto}</div>`)
    .join('');
  const c = estado.contadores;
  const sorte = c.trofeus || c.pescasEmDobro
    ? `<p class="nota">${ico('brilho')}Sorte no mar: ${c.trofeus} garoupa(s) dourada(s) e ${c.pescasEmDobro} pesca(s) em dobro.</p>`
    : '';
  mostrar(
    `<h1 class="${fim.tipo}">${fim.tipo === 'vitoria' ? 'Vitória!' : 'Fim de jogo'}</h1>
    <p>${fim.motivo}</p>
    ${barraStatus(estado)}
    <p><b>Maturidade final:</b> ${m.rotulo}: ${m.descricao} <b>Fadiga média:</b> ${Math.round(mediaTripulacao(estado, 'fadiga'))}</p>
    <table class="tabela"><tr><th>#</th><th>Cliente</th><th>Dia</th><th>Pedido claro</th><th>Válido / meta</th><th>Devolvidos</th><th>Lucro</th><th>Reputação</th></tr>${linhas}</table>
    ${sorte}
    <h2>O que a temporada ensinou</h2>
    ${licoesHtml}
    <button class="primario" data-acao="denovo">Jogar de novo</button>`,
    { largo: true },
  );
  return aoClicar((_a, _d, resolve) => resolve());
}
