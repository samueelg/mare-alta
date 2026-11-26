// Testes das regras do jogo. Rodar com: npm test  (ou: node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../src/regras/config.js';
import { criarEstado } from '../src/regras/estado.js';
import { criarRng } from '../src/regras/rng.js';
import { nivelMaturidade } from '../src/regras/processos.js';
import { atualizarMinijogo, criarMinijogo } from '../src/regras/minijogo.js';
import { licoes } from '../src/regras/relatorio.js';
import {
  abastecer,
  avaliarPeixe,
  comprarProcesso,
  consumirCombustivel,
  contratar,
  conversarComCliente,
  custoMinimoViagem,
  decidirMudanca,
  descansar,
  encerrarMar,
  entregar,
  iniciarExpedicao,
  limiteTensao,
  pescarPeixe,
  planejar,
  podeZarpar,
  previsao,
  receberPedido,
  specParaPeixe,
  triar,
  verificarFim,
} from '../src/regras/expedicao.js';
import { sortearClima, surgirCardume, sumirCardume } from '../src/regras/eventos.js';

const peixe = (especie, tamanho, peso, extra = {}) => ({ especie, tamanho, peso, defeito: false, specIndex: 0, verificacao: null, ...extra });

// Fala com o cliente, abastece na bomba e zarpa (sem conversar).
function expedicaoPronta(estado, { jornada = 'normal', combustivel = 90 } = {}) {
  const exp = iniciarExpedicao(estado);
  receberPedido(estado, exp);
  abastecer(estado, exp, combustivel);
  planejar(estado, exp, { jornada });
  return exp;
}

// Troca temporariamente valores do CONFIG (para forçar um evento) e restaura depois.
function comConfig(caminho, valor, fn) {
  const partes = caminho.split('.');
  const dono = partes.slice(0, -1).reduce((o, k) => o[k], CONFIG);
  const chave = partes.at(-1);
  const antes = dono[chave];
  dono[chave] = valor;
  try {
    return fn();
  } finally {
    dono[chave] = antes;
  }
}

test('mesma semente gera a mesma partida', () => {
  const a = iniciarExpedicao(criarEstado(42)).cardumes;
  const b = iniciarExpedicao(criarEstado(42)).cardumes;
  assert.deepEqual(a, b);
});

test('cardumes da espécie pedida sempre existem (inclusive a da mudança)', () => {
  const estado = criarEstado(7);
  estado.expedicaoAtual = 1; // Cantina do Porto: robalo -> tainha
  const exp = iniciarExpedicao(estado);
  assert.ok(exp.cardumes.filter((c) => c.especie === 'robalo').length >= 2);
  assert.ok(exp.cardumes.filter((c) => c.especie === 'tainha').length >= 2);
});

test('REQ: conversar esclarece o pedido e custa tempo de mar; a Ficha esclarece de graça', () => {
  const sem = criarEstado(1);
  const exp = iniciarExpedicao(sem);
  receberPedido(sem, exp);
  assert.equal(exp.especificacaoConhecida, false);
  conversarComCliente(sem, exp);
  abastecer(sem, exp, 90);
  planejar(sem, exp, { jornada: 'normal' });
  assert.equal(exp.especificacaoConhecida, true);
  assert.equal(exp.prazo, CONFIG.jornada.normal.segundos - CONFIG.conversarCliente.segundos);

  const com = criarEstado(1);
  com.processos.fichaPedido = true;
  const exp2 = expedicaoPronta(com);
  assert.equal(exp2.especificacaoConhecida, true);
  assert.equal(exp2.prazo, CONFIG.jornada.normal.segundos);
});

test('avaliarPeixe: espécie, tamanho e defeito', () => {
  const spec = { especie: 'pargo', tamanhoMin: 35 };
  assert.equal(avaliarPeixe(peixe('pargo', 40, 2), spec).ok, true);
  assert.equal(avaliarPeixe(peixe('robalo', 40, 2), spec).motivo, 'espécie errada');
  assert.equal(avaliarPeixe(peixe('pargo', 30, 1), spec).motivo, 'abaixo do tamanho');
  assert.equal(avaliarPeixe(peixe('pargo', 40, 2, { defeito: true }), spec).motivo, 'machucado');
});

test('mudança aceita sem análise invalida o que já foi pescado; analisada preserva', () => {
  for (const [decisao, esperado] of [['aceitar', 'espécie errada'], ['analisar', null]]) {
    const estado = criarEstado(3);
    estado.expedicaoAtual = 1; // robalo -> tainha
    const exp = expedicaoPronta(estado);
    exp.porao.push(peixe('robalo', 50, 2.5));
    const prazoAntes = exp.prazo;
    decidirMudanca(estado, exp, decisao);
    assert.equal(avaliarPeixe(exp.porao[0], specParaPeixe(exp, exp.porao[0])).motivo, esperado, decisao);
    if (decisao === 'analisar') assert.equal(exp.prazo, prazoAntes + CONFIG.mudanca.prazoExtraAnalise);
  }
});

test('recusar mudança custa reputação e mantém o requisito', () => {
  const estado = criarEstado(3);
  estado.expedicaoAtual = 1;
  const exp = expedicaoPronta(estado);
  const rep = estado.reputacao;
  decidirMudanca(estado, exp, 'recusar');
  assert.equal(estado.reputacao, rep + CONFIG.mudanca.recusar);
  assert.equal(exp.specs.length, 1);
});

test('triagem sem requisito esclarecido só separa peixe machucado', () => {
  const estado = criarEstado(5);
  const exp = expedicaoPronta(estado);
  exp.porao.push(peixe('robalo', 50, 2), peixe('pargo', 40, 2, { defeito: true }));
  encerrarMar(estado, exp, { tempoUsado: 60, motivo: 'porto' });
  triar(estado, exp, true);
  assert.equal(exp.entregues.length, 1); // o robalo (espécie errada) passou
  assert.equal(exp.descartados.length, 1);
});

test('pular a triagem: o cliente devolve e a reputação cai', () => {
  const estado = criarEstado(5);
  const exp = expedicaoPronta(estado);
  exp.especificacaoConhecida = true;
  exp.porao.push(peixe('pargo', 40, 3), peixe('pargo', 30, 1), peixe('robalo', 50, 3));
  encerrarMar(estado, exp, { tempoUsado: 60, motivo: 'porto' });
  triar(estado, exp, false);
  const rep = estado.reputacao;
  const r = entregar(estado, exp);
  assert.equal(r.rejeitados.length, 2);
  assert.equal(r.kgValido, 3);
  assert.ok(estado.reputacao < rep);
  assert.equal(estado.contadores.triagensPuladas, 1);
});

test('entrega paga a meta pelo preço do pedido e o excedente a preço de mercado', () => {
  const estado = criarEstado(5);
  const exp = expedicaoPronta(estado); // pargo >= 35, meta 6, R$110/kg
  exp.especificacaoConhecida = true;
  exp.porao.push(peixe('pargo', 40, 4), peixe('pargo', 45, 4));
  encerrarMar(estado, exp, { tempoUsado: 60, motivo: 'porto' });
  triar(estado, exp, true);
  const r = entregar(estado, exp);
  assert.equal(r.metaAtingida, true);
  assert.equal(r.receita, 6 * 110 + 2 * CONFIG.mercadoPorKg);
});

test('falta de combustível gera reboque', () => {
  const estado = criarEstado(5);
  const exp = expedicaoPronta(estado);
  const caixa = estado.caixa;
  encerrarMar(estado, exp, { tempoUsado: 30, motivo: 'combustivel' });
  assert.equal(estado.caixa, caixa - CONFIG.reboque.custo);
  assert.equal(estado.contadores.reboques, 1);
});

test('RH: cansaço reduz a firmeza da linha; treinamento aumenta', () => {
  const estado = criarEstado(9);
  const base = limiteTensao(estado);
  estado.tripulacao.forEach((t) => (t.fadiga = 80));
  assert.ok(limiteTensao(estado) < base);
  estado.tripulacao.forEach((t) => (t.fadiga = 10));
  estado.caixa = 5000;
  comprarProcesso(estado, 'escalaTreinamento');
  assert.ok(limiteTensao(estado) > base);
});

test('RH: quem chega esgotado pede demissão; escala recupera mais', () => {
  const estado = criarEstado(9);
  estado.tripulacao[0].fadiga = 90;
  estado.tripulacao[1].fadiga = 60;
  const { demitidos, recupera } = descansar(estado);
  assert.equal(demitidos.length, 1);
  assert.equal(estado.tripulacao.length, 2);
  assert.equal(recupera, CONFIG.descanso.normal);
  assert.equal(estado.tripulacao[0].fadiga, 60 - CONFIG.descanso.normal);
});

test('GPR: previsão só existe com Diário de bordo e estreita com o histórico', () => {
  const estado = criarEstado(11);
  assert.equal(previsao(estado), null);
  estado.processos.diarioBordo = true;
  assert.equal(previsao(estado).semDados, true);
  estado.historicoMedido.push({ kgPorMinuto: 6, combPorMinuto: 40 });
  const larga = previsao(estado).kgPorMinuto;
  estado.historicoMedido.push({ kgPorMinuto: 6, combPorMinuto: 40 }, { kgPorMinuto: 6, combPorMinuto: 40 });
  const estreita = previsao(estado).kgPorMinuto;
  assert.ok(estreita.max - estreita.min < larga.max - larga.min);
});

test('processos: compra exige caixa e não repete', () => {
  const estado = criarEstado(1);
  estado.caixa = 100;
  assert.equal(comprarProcesso(estado, 'fichaPedido').ok, false);
  estado.caixa = 1000;
  assert.equal(comprarProcesso(estado, 'fichaPedido').ok, true);
  assert.equal(comprarProcesso(estado, 'fichaPedido').ok, false);
});

test('contratar respeita caixa e lotação', () => {
  const estado = criarEstado(1);
  assert.equal(contratar(estado).ok, true);
  assert.equal(contratar(estado).ok, false); // 4 pessoas é o máximo
});

test('maturidade: Nível G exige GPR + REQ', () => {
  const p = { fichaPedido: false, diarioBordo: false, checklistTriagem: false, escalaTreinamento: false };
  assert.equal(nivelMaturidade(p).rotulo, 'Improviso');
  assert.equal(nivelMaturidade({ ...p, fichaPedido: true }).rotulo, 'Em transição');
  assert.equal(nivelMaturidade({ ...p, fichaPedido: true, diarioBordo: true }).rotulo, 'Nível G');
});

test('fim de jogo: falência, tripulação e vitória', () => {
  const estado = criarEstado(1);
  estado.caixa = -1;
  assert.equal(verificarFim(estado, 'aposEntrega').tipo, 'derrota');
  estado.caixa = 1000;
  estado.tripulacao = estado.tripulacao.slice(0, 1);
  assert.equal(verificarFim(estado, 'noPorto'), null, 'falta gente, mas dá para contratar');
  estado.caixa = 250;
  assert.equal(verificarFim(estado, 'noPorto').tipo, 'derrota', 'falta gente e não dá para contratar');
  estado.caixa = 1000;
  estado.tripulacao = criarEstado(1).tripulacao;
  assert.equal(verificarFim(estado, 'noPorto'), null);
  estado.caixa = custoMinimoViagem(estado) - 1;
  assert.equal(verificarFim(estado, 'noPorto').tipo, 'derrota');
  estado.caixa = 1000;
  assert.equal(verificarFim(estado, 'final').tipo, 'vitoria');
  estado.reputacao = 10;
  assert.equal(verificarFim(estado, 'final').tipo, 'derrota');
});

test('minijogo: segurar sem parar arrebenta; ritmo certo pesca', () => {
  const rng = criarRng(1);
  const m = criarMinijogo(65, rng);
  while (!m.resultado) atualizarMinijogo(m, 0.05, true, rng);
  assert.equal(m.resultado, 'arrebentou');

  // Estratégia: puxa até 70% do limite, solta até 35%
  const rng2 = criarRng(2);
  const m2 = criarMinijogo(80, rng2);
  let segurando = true;
  while (!m2.resultado) {
    if (m2.tensao > m2.limite * 0.7) segurando = false;
    if (m2.tensao < m2.limite * 0.35) segurando = true;
    atualizarMinijogo(m2, 1 / 60, segurando, rng2);
  }
  assert.equal(m2.resultado, 'pescou');
  assert.ok(m2.tempo < 8, `demorou ${m2.tempo}s`);
});

test('relatório aponta o conceito de cada problema', () => {
  const estado = criarEstado(1);
  estado.contadores.rejeitadosSemRequisito = 3;
  estado.contadores.mudancasSemAnalise = 1;
  const conceitos = licoes(estado).map((l) => l.conceito).join(' | ');
  assert.match(conceitos, /Engenharia de Requisitos/);
  assert.match(conceitos, /Controle de mudanças/);
  assert.match(conceitos, /MR-MPS-SW/);
});

test('simulação: uma temporada inteira roda do começo ao fim sem quebrar', () => {
  const estado = criarEstado(2026);
  let fim = null;
  for (let i = 0; i < CONFIG.totalExpedicoes && !fim; i++) {
    const exp = iniciarExpedicao(estado);
    receberPedido(estado, exp);
    conversarComCliente(estado, exp);
    abastecer(estado, exp, 90);
    assert.equal(podeZarpar(estado, exp).ok, true);
    planejar(estado, exp, { jornada: 'normal' });
    // pesca 4 peixes de cardumes da espécie certa
    for (let k = 0; k < 4; k++) {
      const c = exp.cardumes.find((cc) => cc.quantidade > 0 && cc.especie === exp.specs[0].especie) ?? exp.cardumes.find((cc) => cc.quantidade > 0);
      exp.porao.push({ ...peixe(c.especie, 48, 2.2), specIndex: exp.specs.length - 1 });
      c.quantidade--;
    }
    if (exp.mudanca) decidirMudanca(estado, exp, 'analisar');
    exp.combustivel -= 40;
    encerrarMar(estado, exp, { tempoUsado: 70, motivo: 'porto' });
    triar(estado, exp, true);
    entregar(estado, exp);
    fim = verificarFim(estado, 'aposEntrega');
    if (fim || i === CONFIG.totalExpedicoes - 1) break;
    descansar(estado);
    fim = verificarFim(estado, 'noPorto');
  }
  fim ??= verificarFim(estado, 'final');
  assert.ok(['vitoria', 'derrota'].includes(fim.tipo));
  assert.equal(estado.registros.length, CONFIG.totalExpedicoes);
});

// ---------------------------------------------------------------- porto: bomba, reserva e zarpar

test('bomba: respeita o tanque, guarda dinheiro dos salários e o que sobra fica no tanque', () => {
  const estado = criarEstado(1);
  const exp = iniciarExpedicao(estado);
  assert.equal(abastecer(estado, exp, 500), CONFIG.combustivel.tanqueMax);
  assert.equal(estado.caixa, CONFIG.caixaInicial - CONFIG.combustivel.tanqueMax * CONFIG.combustivel.precoUnidade);
  assert.equal(exp.custos.combustivel, CONFIG.combustivel.tanqueMax * CONFIG.combustivel.precoUnidade);

  const pobre = criarEstado(1);
  pobre.caixa = 300; // salários de 3 pessoas = 240: só sobra para 30 unidades
  assert.equal(abastecer(pobre, iniciarExpedicao(pobre), 100), 30);

  receberPedido(estado, exp);
  planejar(estado, exp, { jornada: 'normal' });
  exp.combustivel = 47.6;
  encerrarMar(estado, exp, { tempoUsado: 60, motivo: 'porto' });
  assert.equal(estado.tanque, 47);
});

test('zarpar exige pedido, tripulação mínima e combustível mínimo', () => {
  const estado = criarEstado(1);
  const exp = iniciarExpedicao(estado);
  assert.match(podeZarpar(estado, exp).motivo, /cliente/);
  receberPedido(estado, exp);
  assert.match(podeZarpar(estado, exp).motivo, /Abasteça/);
  abastecer(estado, exp, CONFIG.combustivel.minimoZarpar);
  assert.equal(podeZarpar(estado, exp).ok, true);
  estado.tripulacao = estado.tripulacao.slice(0, 1);
  assert.match(podeZarpar(estado, exp).motivo, /taverna/);
});

test('REQ: a Ficha vale quando o pedido é recebido depois de adotada', () => {
  const estado = criarEstado(1);
  const exp = iniciarExpedicao(estado); // o cliente chegou ao porto
  comprarProcesso(estado, 'fichaPedido'); // adotada antes de falar com ele
  receberPedido(estado, exp);
  assert.equal(exp.especificacaoConhecida, true);
  assert.equal(exp.penalidadeTempo, 0);
});

test('investir não deixa a empresa sem dinheiro para zarpar', () => {
  const estado = criarEstado(1);
  estado.caixa = 600; // reserva: 30 un × R$2 + 3 × R$80 = R$300
  const r = comprarProcesso(estado, 'fichaPedido'); // R$350 deixaria R$250
  assert.equal(r.ok, false);
  assert.match(r.erro, /guarde/);
  assert.equal(estado.caixa, 600);
  estado.caixa = 650;
  assert.equal(comprarProcesso(estado, 'fichaPedido').ok, true);
  assert.equal(verificarFim(estado, 'noPorto'), null);
  estado.caixa = 450; // contratar (R$200) com reserva para 4 pessoas (R$380) não cabe
  assert.equal(contratar(estado).ok, false);
});

// ---------------------------------------------------------------- eventos aleatórios

test('eventos: mesma semente repete clima e eventos de mar', () => {
  const a = iniciarExpedicao(criarEstado(77));
  const b = iniciarExpedicao(criarEstado(77));
  assert.deepEqual(a.clima, b.clima);
  assert.deepEqual(a.eventosMar, b.eventosMar);
});

test('eventos: cardumes de evento não nascem em cima dos cardumes do mapa', () => {
  for (let semente = 1; semente <= 60; semente++) {
    const exp = iniciarExpedicao(criarEstado(semente));
    for (const ev of [exp.eventosMar.gaivotas, exp.eventosMar.dourado].filter(Boolean)) {
      const maisPerto = Math.min(...exp.cardumes.map((c) => Math.hypot(c.x - ev.x, c.y - ev.y)));
      assert.ok(maisPerto >= 90, `semente ${semente}: ${maisPerto.toFixed(0)} px`);
    }
  }
});

test('eventos: o clima segue os pesos (comuns saem mais que raros)', () => {
  const rng = criarRng(5);
  const conta = {};
  for (let i = 0; i < 4000; i++) {
    const c = sortearClima(rng).id;
    conta[c] = (conta[c] ?? 0) + 1;
  }
  assert.ok(conta.calmo > conta.marAgitado);
  assert.ok(conta.marAgitado > conta.luaCheia);
  assert.ok(conta.piracema > 0 && conta.piracema < conta.neblina);
});

test('eventos: mar agitado gasta mais combustível; cardumes fartos têm mais peixe', () => {
  const calmo = { combustivel: 100, clima: { id: 'calmo' } };
  const agitado = { combustivel: 100, clima: { id: 'marAgitado', combustivelMult: 1.3 } };
  consumirCombustivel(calmo, 220);
  consumirCombustivel(agitado, 220);
  assert.equal(calmo.combustivel, 90);
  assert.equal(agitado.combustivel, 87);

  const comClima = (id) => {
    const estado = criarEstado(3);
    estado.rng.porPeso = (lista) => lista.find((c) => c.id === id); // força o clima
    return iniciarExpedicao(estado).cardumes.map((c) => c.quantidade);
  };
  const normal = comClima('calmo');
  const farto = comClima('piracema');
  assert.equal(farto.reduce((s, q) => s + q, 0) - normal.reduce((s, q) => s + q, 0), 2 * normal.length);
});

test('eventos: cardume dourado vira troféu, que é vendido no porto e não conta para a meta', () => {
  const estado = criarEstado(4);
  const exp = expedicaoPronta(estado);
  exp.eventosMar.dourado = { em: 0.5, duracao: 20, quantidade: 2, x: 500, y: 300, ocorreu: false };
  const dourado = surgirCardume(exp, 'dourado');
  const r = pescarPeixe(estado, exp, dourado);
  assert.equal(r.trofeu.especie, 'garoupa');
  assert.equal(exp.porao.length, 0);
  assert.equal(dourado.quantidade, 1);
  sumirCardume(dourado);
  assert.equal(dourado.quantidade, 0);

  encerrarMar(estado, exp, { tempoUsado: 60, motivo: 'porto' });
  const res = entregar(estado, exp);
  assert.equal(res.trofeus, 1);
  assert.equal(res.receita, CONFIG.eventos.peixeEspecial.valor);
  assert.equal(res.metaAtingida, false);
});

test('eventos: pesca em dobro traz dois peixes do mesmo cardume', () => {
  const estado = criarEstado(4);
  const exp = expedicaoPronta(estado);
  const cardume = { id: 99, especie: 'pargo', quantidade: 3, x: 0, y: 0 };
  comConfig('eventos.peixeEspecial.chance', 0, () =>
    comConfig('eventos.pescaEmDobro', 1, () => {
      const r = pescarPeixe(estado, exp, cardume);
      assert.equal(r.dobro, true);
      assert.equal(r.peixes.length, 2);
    }),
  );
  assert.equal(cardume.quantidade, 1);
  assert.equal(estado.contadores.pescasEmDobro, 1);
  // com 1 peixe sobrando no cardume não há dobro
  comConfig('eventos.peixeEspecial.chance', 0, () =>
    comConfig('eventos.pescaEmDobro', 1, () => assert.equal(pescarPeixe(estado, exp, cardume).peixes.length, 1)),
  );
});

test('eventos: lua cheia faz o minijogo render mais', () => {
  const tempo = (mult) => {
    const rng = criarRng(8);
    const m = criarMinijogo(95, rng, { puxarMult: mult });
    let segurando = true;
    while (!m.resultado) {
      if (m.tensao > m.limite * 0.7) segurando = false;
      if (m.tensao < m.limite * 0.35) segurando = true;
      atualizarMinijogo(m, 1 / 60, segurando, rng);
    }
    return m.tempo;
  };
  assert.ok(tempo(1.4) < tempo(1));
});
