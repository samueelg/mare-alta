// Ciclo de vida de uma expedição (espelha os processos técnicos da ISO/IEC/IEEE 12207):
//   pedido (requisitos) -> planejamento (GPR) -> mar (construção) -> triagem (verificação)
//   -> entrega (validação/transição) -> porto (melhoria de processo, entre projetos)
//
// No jogo, pedido, abastecimento, triagem, entrega e melhoria acontecem andando pelo porto
// (cena Porto); o mar é a cena Mar. Estas funções são as REGRAS por trás das duas cenas:
// recebem o estado, alteram o estado e não conhecem Phaser nem DOM.

import { CONFIG, ESPECIES, ESPECIES_COMUNS, pesoMedio } from './config.js';
import { PEDIDOS } from './pedidos.js';
import { mediaTripulacao } from './estado.js';
import { PROCESSOS } from './processos.js';
import { sortearClima, sortearEventosMar } from './eventos.js';

const arred2 = (n) => Math.round(n * 100) / 100;
const limitar = (n, min, max) => Math.max(min, Math.min(max, n));

function alterarReputacao(estado, delta) {
  estado.reputacao = limitar(estado.reputacao + delta, 0, 100);
}

// ---------------------------------------------------------------- 1. Pedido (REQ)

// O cliente chega ao porto. O pedido só é "recebido" quando o jogador fala com ele.
export function iniciarExpedicao(estado) {
  const pedido = PEDIDOS[estado.expedicaoAtual];
  const rng = estado.rng;
  const clima = sortearClima(rng);
  const cardumes = gerarCardumes(rng, pedido, clima);
  const exp = {
    numero: estado.expedicaoAtual + 1,
    pedido,
    clima,
    specs: [{ ...pedido.spec }], // histórico de versões do requisito
    meta: pedido.meta,
    pedidoRecebido: false,
    especificacaoConhecida: false,
    penalidadeTempo: 0,
    porao: [],
    trofeus: [], // garoupas douradas: não vão ao cliente, são vendidas ao colecionador
    cardumes,
    eventosMar: sortearEventosMar(rng, pedido, cardumes),
    mudanca: pedido.mudanca ? { ocorreu: false, decisao: null } : null,
    linhasArrebentadas: 0,
    triagem: null, // resultado de triar(), quando o jogador passa na bancada
    custos: { combustivel: 0, salarios: 0, triagem: 0, reboque: 0 },
    caixaInicial: estado.caixa,
    reputacaoInicial: estado.reputacao,
    previsaoUsada: null,
  };
  return exp;
}

// Falar com o cliente pela primeira vez. Com a Ficha de pedido, o requisito já sai esclarecido.
export function receberPedido(estado, exp) {
  if (exp.pedidoRecebido) return;
  exp.pedidoRecebido = true;
  if (estado.processos.fichaPedido) exp.especificacaoConhecida = true;
}

export function conversarComCliente(estado, exp) {
  if (exp.especificacaoConhecida) return;
  exp.especificacaoConhecida = true;
  exp.penalidadeTempo += CONFIG.conversarCliente.segundos;
}

export function specVigente(exp) {
  return exp.specs[exp.specs.length - 1];
}

// Com mudança ANALISADA, cada peixe vale pela versão do requisito do momento em que foi pescado
// (foi o que se negociou com o cliente). Sem análise, tudo é cobrado pela versão nova.
export function specParaPeixe(exp, peixe) {
  if (exp.mudanca?.decisao === 'analisar') return exp.specs[peixe.specIndex];
  return specVigente(exp);
}

// ---------------------------------------------------------------- 2. Planejamento (GPR)

export function salarios(estado, tripulantes = estado.tripulacao.length) {
  return tripulantes * CONFIG.salarioPorTripulante;
}

// Quanto o caixa precisa ter para a próxima viagem sair: completar o combustível mínimo + salários.
export function custoMinimoViagem(estado, tripulantes = estado.tripulacao.length) {
  const c = CONFIG.combustivel;
  return Math.max(0, c.minimoZarpar - estado.tanque) * c.precoUnidade + salarios(estado, tripulantes);
}

// Bomba do porto. Abastece até `unidades`, respeitando o tanque e guardando dinheiro para os salários.
// Retorna as unidades efetivamente colocadas.
export function abastecer(estado, exp, unidades) {
  const c = CONFIG.combustivel;
  const cabeNoTanque = c.tanqueMax - estado.tanque;
  const podePagar = Math.floor((estado.caixa - salarios(estado)) / c.precoUnidade);
  const colocar = Math.max(0, Math.min(Math.floor(unidades), cabeNoTanque, podePagar));
  estado.tanque += colocar;
  estado.caixa -= colocar * c.precoUnidade;
  exp.custos.combustivel += colocar * c.precoUnidade;
  return colocar;
}

// Checagem do barco antes de zarpar. Não é derrota: diz o que falta fazer no porto.
export function podeZarpar(estado, exp) {
  if (!exp.pedidoRecebido) return { ok: false, motivo: 'Fale com o cliente primeiro: ainda não há pedido.' };
  if (estado.tripulacao.length < CONFIG.tripulacaoMinima) {
    return { ok: false, motivo: `São precisos ${CONFIG.tripulacaoMinima} tripulantes. Contrate alguém na taverna.` };
  }
  if (estado.tanque < CONFIG.combustivel.minimoZarpar) {
    return { ok: false, motivo: `Tanque com ${estado.tanque} unidades. Abasteça pelo menos ${CONFIG.combustivel.minimoZarpar} na bomba.` };
  }
  if (estado.caixa < salarios(estado)) return { ok: false, motivo: 'Não há dinheiro para pagar os salários.' };
  return { ok: true };
}

// Faixa de combustível prevista pelo Diário de bordo para um prazo, já ajustada ao clima do dia.
export function previsaoCombustivel(estado, exp, prazo) {
  const p = previsao(estado);
  if (!p || p.semDados) return null;
  const mult = (exp.clima.combustivelMult ?? 1) * (prazo / 60);
  return { min: Math.round(p.combPorMinuto.min * mult), max: Math.round(p.combPorMinuto.max * mult) };
}

export function prazoDaJornada(exp, jornada) {
  return CONFIG.jornada[jornada].segundos - exp.penalidadeTempo;
}

// Previsão do Diário de bordo: só existe se o processo foi adotado, e só melhora com dados.
export function previsao(estado) {
  if (!estado.processos.diarioBordo) return null;
  const regs = estado.historicoMedido;
  if (regs.length === 0) return { semDados: true, registros: 0 };

  const d = CONFIG.diario;
  const banda = Math.max(d.bandaMin, d.bandaInicial - d.reducaoPorRegistro * regs.length);
  const faixa = (valores) => {
    const media = valores.reduce((s, v) => s + v, 0) / valores.length;
    return { min: arred2(media * (1 - banda)), max: arred2(media * (1 + banda)), media: arred2(media) };
  };
  return {
    semDados: false,
    registros: regs.length,
    kgPorMinuto: faixa(regs.map((r) => r.kgPorMinuto)),
    combPorMinuto: faixa(regs.map((r) => r.combPorMinuto)),
  };
}

// Zarpar: o combustível já foi comprado na bomba; aqui se escolhe a jornada e se pagam os salários.
export function planejar(estado, exp, { jornada }) {
  exp.combustivel = estado.tanque;
  exp.combustivelInicial = estado.tanque;
  exp.jornada = jornada;
  exp.prazo = prazoDaJornada(exp, jornada);
  exp.custos.salarios = salarios(estado);
  exp.previsaoUsada = previsao(estado);
  estado.caixa -= exp.custos.salarios;
  if (jornada === 'horaExtra') estado.contadores.horasExtras++;
}

// ---------------------------------------------------------------- 3. No mar

export function gerarCardumes(rng, pedido, clima = {}) {
  const especies = [pedido.spec.especie, pedido.spec.especie];
  if (pedido.mudanca?.novaSpec) especies.push(pedido.mudanca.novaSpec.especie, pedido.mudanca.novaSpec.especie);
  while (especies.length < 7) especies.push(rng.escolher(ESPECIES_COMUNS));
  const extra = clima.peixesExtra ?? 0;

  const cardumes = [];
  for (const especie of especies) {
    let pos = null;
    for (let tentativa = 0; tentativa < 200 && !pos; tentativa++) {
      const p = { x: rng.inteiro(230, 910), y: rng.inteiro(90, 490) };
      if (cardumes.every((c) => Math.hypot(c.x - p.x, c.y - p.y) >= 100)) pos = p;
    }
    pos ??= { x: rng.inteiro(230, 910), y: rng.inteiro(90, 490) };
    cardumes.push({ id: cardumes.length, especie, quantidade: rng.inteiro(2, 4) + extra, ...pos });
  }
  return cardumes;
}

// Estimativa de kg de um cardume (Diário de bordo). Faixa estreita conforme o histórico cresce.
export function estimativaCardume(estado, cardume) {
  if (!estado.processos.diarioBordo) return null;
  const d = CONFIG.diario;
  const banda = Math.max(d.bandaMin, d.bandaInicial - d.reducaoPorRegistro * estado.historicoMedido.length);
  const esperado = cardume.quantidade * pesoMedio(cardume.especie);
  return { min: arred2(esperado * (1 - banda)), max: arred2(esperado * (1 + banda)) };
}

// Limite de tensão da linha no minijogo: é aqui que gestão de pessoas vira mecânica.
export function limiteTensao(estado) {
  const m = CONFIG.minijogo;
  const faltam = Math.max(0, 3 - estado.tripulacao.length);
  const limite =
    m.limiteBase +
    m.porHabilidade * mediaTripulacao(estado, 'habilidade') -
    m.porFadiga * mediaTripulacao(estado, 'fadiga') -
    m.porFaltaTripulante * faltam;
  return Math.round(limitar(limite, m.limiteMin, m.limiteMax));
}

export function avaliarPeixe(peixe, spec) {
  if (peixe.defeito) return { ok: false, motivo: 'machucado' };
  if (peixe.especie !== spec.especie) return { ok: false, motivo: 'espécie errada' };
  if (peixe.tamanho < spec.tamanhoMin) return { ok: false, motivo: 'abaixo do tamanho' };
  return { ok: true, motivo: null };
}

// Sem requisito esclarecido, a verificação só enxerga defeito: não dá pra verificar contra o que não se sabe.
function avaliarComOQueSeSabe(exp, peixe) {
  if (exp.especificacaoConhecida) return avaliarPeixe(peixe, specParaPeixe(exp, peixe));
  return peixe.defeito ? { ok: false, motivo: 'machucado' } : { ok: true, motivo: null };
}

function sortearMedidas(rng, especie) {
  const esp = ESPECIES[especie];
  const [tMin, tMax] = esp.tamanho;
  const [pMin, pMax] = esp.peso;
  const tamanho = rng.inteiro(tMin, tMax);
  const frac = (tamanho - tMin) / (tMax - tMin);
  return { especie, tamanho, peso: arred2((pMin + frac * (pMax - pMin)) * rng.entre(0.9, 1.1)) };
}

function guardarTrofeu(estado, exp) {
  const trofeu = sortearMedidas(estado.rng, 'garoupa');
  exp.trofeus.push(trofeu);
  estado.contadores.trofeus++;
  return trofeu;
}

function guardarNoPorao(estado, exp, cardume) {
  const rng = estado.rng;
  const peixe = {
    id: exp.porao.length,
    ...sortearMedidas(rng, cardume.especie),
    defeito: rng() < CONFIG.defeitoChance,
    specIndex: exp.specs.length - 1,
    verificacao: null,
  };
  // Checklist de triagem: verifica na hora em que o peixe entra no porão
  if (estado.processos.checklistTriagem) peixe.verificacao = avaliarComOQueSeSabe(exp, peixe);
  cardume.quantidade--;
  exp.porao.push(peixe);
  return peixe;
}

// Resultado de um minijogo ganho. Pode trazer surpresas (eventos):
//   cardume dourado -> toda captura é troféu
//   peixe especial  -> raro: em vez do peixe comum, uma Garoupa dourada (o cardume não diminui)
//   pesca em dobro  -> comum: um segundo peixe do mesmo cardume vem junto
// Retorna { peixes: [...], trofeu: objeto | null, dobro: boolean }.
export function pescarPeixe(estado, exp, cardume) {
  const rng = estado.rng;
  const ev = CONFIG.eventos;
  if (cardume.evento === 'dourado') {
    cardume.quantidade--;
    return { peixes: [], trofeu: guardarTrofeu(estado, exp), dobro: false };
  }
  const chanceEspecial = ev.peixeEspecial.chance * (exp.clima?.especialMult ?? 1);
  if (rng() < chanceEspecial) return { peixes: [], trofeu: guardarTrofeu(estado, exp), dobro: false };

  const peixes = [guardarNoPorao(estado, exp, cardume)];
  const dobro = cardume.quantidade > 0 && rng() < ev.pescaEmDobro;
  if (dobro) {
    peixes.push(guardarNoPorao(estado, exp, cardume));
    estado.contadores.pescasEmDobro++;
  }
  return { peixes, trofeu: null, dobro };
}

export function registrarLinhaArrebentada(estado, exp) {
  exp.linhasArrebentadas++;
  estado.contadores.linhasArrebentadas++;
  if (mediaTripulacao(estado, 'fadiga') > 50) estado.contadores.linhasArrebentadasCansaco++;
}

// Retorna true quando o combustível acabou.
export function consumirCombustivel(exp, pixels) {
  const mult = exp.clima?.combustivelMult ?? 1; // mar agitado gasta mais
  exp.combustivel = Math.max(0, exp.combustivel - (pixels * mult) / CONFIG.combustivel.pxPorUnidade);
  return exp.combustivel <= 0;
}

// ---------------------------------------------------------------- Mudança de requisito (REQ)

export function impactoMudanca(exp) {
  const m = exp.pedido.mudanca;
  const atual = specVigente(exp);
  let perdemValidade = 0;
  if (m.novaSpec) {
    for (const p of exp.porao) {
      if (avaliarPeixe(p, atual).ok && !avaliarPeixe(p, m.novaSpec).ok) perdemValidade++;
    }
  }
  return {
    perdemValidade,
    kgAMais: m.novaMeta ? m.novaMeta - exp.meta : 0,
    prazoExtraSeAnalisar: CONFIG.mudanca.prazoExtraAnalise,
  };
}

// decisao: 'aceitar' (sem análise) | 'analisar' (renegocia prazo) | 'recusar'
// Retorna os segundos de prazo ganhos.
export function decidirMudanca(estado, exp, decisao) {
  const m = exp.pedido.mudanca;
  exp.mudanca.ocorreu = true;
  exp.mudanca.decisao = decisao;

  const aplicar = () => {
    if (m.novaSpec) exp.specs.push({ ...m.novaSpec });
    if (m.novaMeta) exp.meta = m.novaMeta;
  };

  if (decisao === 'aceitar') {
    aplicar();
    estado.contadores.mudancasSemAnalise++;
    // o checklist reavalia o porão contra a nova versão
    if (estado.processos.checklistTriagem) exp.porao.forEach((p) => (p.verificacao = avaliarComOQueSeSabe(exp, p)));
    return 0;
  }
  if (decisao === 'analisar') {
    aplicar();
    alterarReputacao(estado, estado.processos.fichaPedido ? 0 : CONFIG.mudanca.analisar);
    exp.prazo += CONFIG.mudanca.prazoExtraAnalise;
    return CONFIG.mudanca.prazoExtraAnalise;
  }
  alterarReputacao(estado, CONFIG.mudanca.recusar);
  estado.contadores.mudancasRecusadas++;
  return 0;
}

// ---------------------------------------------------------------- Fim do mar

// motivo: 'porto' (voltou) | 'prazo' (tempo acabou) | 'combustivel' (precisou de reboque)
export function encerrarMar(estado, exp, { tempoUsado, motivo }) {
  exp.tempoUsado = tempoUsado;
  exp.motivoFim = motivo;
  estado.tanque = Math.floor(exp.combustivel); // o que sobrou continua no tanque
  if (motivo === 'combustivel') {
    exp.custos.reboque = CONFIG.reboque.custo;
    estado.caixa -= CONFIG.reboque.custo;
    alterarReputacao(estado, CONFIG.reboque.reputacao);
    estado.contadores.reboques++;
  }
  const ganho = CONFIG.jornada[exp.jornada].fadiga;
  estado.tripulacao.forEach((p) => (p.fadiga = Math.min(100, Math.round(p.fadiga + ganho * p.desgaste))));
}

// ---------------------------------------------------------------- 4. Triagem (verificação)

export function triagemAutomatica(estado) {
  return estado.processos.checklistTriagem;
}

// fazer: o jogador escolheu fazer a triagem manual (ignorado se o checklist faz automático).
// Na bancada do porto (fazer = true) ou na hora da entrega, se ninguém passou na bancada (fazer = false).
export function triar(estado, exp, fazer) {
  if (exp.triagem) return exp.triagem;
  const automatica = triagemAutomatica(estado);
  if (!automatica && !fazer) {
    exp.entregues = [...exp.porao];
    exp.descartados = [];
    estado.contadores.triagensPuladas++;
    exp.triagem = { feita: false, automatica, descartados: [] };
    return exp.triagem;
  }
  if (!automatica) {
    exp.custos.triagem = CONFIG.triagemManual.custo;
    estado.caixa -= CONFIG.triagemManual.custo;
    estado.tripulacao.forEach((p) => (p.fadiga = Math.min(100, Math.round(p.fadiga + CONFIG.triagemManual.fadiga * p.desgaste))));
  }
  exp.entregues = [];
  exp.descartados = [];
  for (const p of exp.porao) {
    const v = avaliarComOQueSeSabe(exp, p);
    p.verificacao = v;
    (v.ok ? exp.entregues : exp.descartados).push(p);
  }
  exp.triagem = { feita: true, automatica, descartados: exp.descartados };
  return exp.triagem;
}

// ---------------------------------------------------------------- 5. Entrega (validação) e pós-venda

export function entregar(estado, exp) {
  const c = estado.contadores;
  if (!exp.triagem) triar(estado, exp, false); // entregou sem passar na bancada
  const validos = [];
  const rejeitados = [];
  for (const p of exp.entregues) {
    const v = avaliarPeixe(p, specParaPeixe(exp, p)); // o cliente valida contra o requisito REAL
    (v.ok ? validos : rejeitados).push({ ...p, validacao: v });
  }

  const soma = (lista) => arred2(lista.reduce((s, p) => s + p.peso, 0));
  const kgValido = soma(validos);
  const kgPago = Math.min(kgValido, exp.meta);
  const kgExcedente = arred2(kgValido - kgPago);
  const kgDescartado = soma(exp.descartados);

  const receitaTrofeus = exp.trofeus.length * CONFIG.eventos.peixeEspecial.valor; // colecionador do porto
  const receita = Math.round(
    kgPago * exp.pedido.precoKg + kgExcedente * CONFIG.mercadoPorKg + kgDescartado * CONFIG.mercadoPorKg + receitaTrofeus,
  );
  estado.caixa += receita;

  const repAntes = estado.reputacao;
  if (rejeitados.length > 0) {
    alterarReputacao(estado, Math.max(CONFIG.rejeicao.limite, rejeitados.length * CONFIG.rejeicao.reputacaoPorPeixe));
  }
  const metaAtingida = kgValido >= exp.meta;
  if (metaAtingida) {
    alterarReputacao(estado, CONFIG.metaAtingida.reputacao);
    c.metasAtingidas++;
  } else {
    alterarReputacao(estado, Math.round(CONFIG.metaFalhou.reputacaoMax * (1 - kgValido / exp.meta)));
  }

  c.peixesRejeitados += rejeitados.length;
  if (!exp.especificacaoConhecida) c.rejeitadosSemRequisito += rejeitados.length;
  c.defeituososEntregues += rejeitados.filter((p) => p.defeito).length;

  // Diário de bordo: a medição alimenta as previsões das próximas viagens
  const minutos = Math.max(exp.tempoUsado, 1) / 60;
  const kgPescado = soma(exp.porao);
  const combUsado = arred2(exp.combustivelInicial - exp.combustivel);
  if (estado.processos.diarioBordo) {
    estado.historicoMedido.push({ kgPorMinuto: arred2(kgPescado / minutos), combPorMinuto: arred2(combUsado / minutos) });
  }

  const custoTotal = Object.values(exp.custos).reduce((s, v) => s + v, 0);
  const resultado = {
    validos,
    rejeitados,
    kgValido,
    kgPago,
    kgExcedente,
    kgDescartado,
    trofeus: exp.trofeus.length,
    receitaTrofeus,
    receita,
    custoTotal,
    lucro: receita - custoTotal,
    metaAtingida,
    reputacaoDelta: estado.reputacao - exp.reputacaoInicial,
    reputacaoEntrega: estado.reputacao - repAntes,
    planejado: { combustivel: exp.combustivelInicial, prazo: exp.prazo, meta: exp.meta },
    realizado: { combustivel: combUsado, tempo: Math.round(exp.tempoUsado), kgValido, kgPescado },
    previsao: exp.previsaoUsada,
  };

  estado.registros.push({
    numero: exp.numero,
    cliente: exp.pedido.cliente,
    clima: exp.clima,
    trofeus: exp.trofeus.length,
    especificacaoConhecida: exp.especificacaoConhecida,
    meta: exp.meta,
    kgValido,
    rejeitados: rejeitados.length,
    lucro: resultado.lucro,
    reputacaoDelta: resultado.reputacaoDelta,
  });
  estado.expedicaoAtual++;
  exp.resultado = resultado;
  return resultado;
}

// ---------------------------------------------------------------- 6. No porto (melhoria de processo + RH)

export function descansar(estado) {
  // Quem chega esgotado pede demissão antes de descansar
  const demitidos = estado.tripulacao.filter((p) => p.fadiga > CONFIG.demissaoFadiga);
  estado.tripulacao = estado.tripulacao.filter((p) => p.fadiga <= CONFIG.demissaoFadiga);
  estado.contadores.demissoes += demitidos.length;

  const recupera = estado.processos.escalaTreinamento ? CONFIG.descanso.comEscala : CONFIG.descanso.normal;
  estado.tripulacao.forEach((p) => (p.fadiga = Math.max(0, p.fadiga - recupera)));
  return { demitidos, recupera };
}

// Investir não pode deixar a empresa sem dinheiro para sair ao mar (evita derrota-surpresa).
function reservaInsuficiente(estado, gasto, tripulantes) {
  const reserva = custoMinimoViagem(estado, tripulantes);
  if (estado.caixa - gasto >= reserva) return null;
  return `Caixa insuficiente: guarde ${reserva.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} para a próxima viagem (combustível mínimo + salários).`;
}

export function comprarProcesso(estado, id) {
  const p = PROCESSOS[id];
  if (!p) return { ok: false, erro: 'Processo desconhecido.' };
  if (estado.processos[id]) return { ok: false, erro: 'Já adotado.' };
  const falta = reservaInsuficiente(estado, p.custo);
  if (falta) return { ok: false, erro: falta };
  estado.caixa -= p.custo;
  estado.processos[id] = true;
  if (id === 'escalaTreinamento') estado.tripulacao.forEach((t) => (t.habilidade = Math.min(3, t.habilidade + 1)));
  return { ok: true };
}

const NOVATOS = ['Nina', 'Caio', 'Rosa', 'Téo', 'Duda'];

export function contratar(estado) {
  if (estado.tripulacao.length >= 4) return { ok: false, erro: 'O barco comporta no máximo 4 pessoas.' };
  const falta = reservaInsuficiente(estado, CONFIG.contratar.custo, estado.tripulacao.length + 1);
  if (falta) return { ok: false, erro: falta };
  const usados = new Set(estado.tripulacao.map((t) => t.nome));
  const nome = NOVATOS.find((n) => !usados.has(n)) ?? 'Novato';
  estado.caixa -= CONFIG.contratar.custo;
  estado.tripulacao.push({ nome, habilidade: estado.processos.escalaTreinamento ? 2 : 1, fadiga: 0, desgaste: 1.0 });
  return { ok: true, nome };
}

// ---------------------------------------------------------------- Vitória / derrota

// momento: 'aposEntrega' | 'noPorto' (depois do descanso, antes da próxima viagem) | 'final'
export function verificarFim(estado, momento) {
  if (estado.caixa < 0) return { tipo: 'derrota', motivo: 'Falência: o caixa ficou negativo.' };
  if (estado.reputacao <= 0) return { tipo: 'derrota', motivo: 'Reputação zerada: os clientes cancelaram os contratos.' };
  if (momento === 'noPorto') {
    // Só é derrota se não houver saída: faltar gente E não dar para contratar, ou faltar dinheiro para zarpar.
    const faltam = Math.max(0, CONFIG.tripulacaoMinima - estado.tripulacao.length);
    const precisa = faltam * CONFIG.contratar.custo + custoMinimoViagem(estado, estado.tripulacao.length + faltam);
    if (estado.caixa < precisa) {
      return {
        tipo: 'derrota',
        motivo: faltam
          ? 'Tripulação insuficiente e sem dinheiro para contratar.'
          : 'Sem dinheiro para combustível e salários da próxima viagem.',
      };
    }
  }
  if (momento === 'final') {
    if (estado.reputacao >= CONFIG.reputacaoVitoria) return { tipo: 'vitoria', motivo: 'A empresa terminou a temporada lucrando e com clientes satisfeitos.' };
    return { tipo: 'derrota', motivo: `Reputação abaixo de ${CONFIG.reputacaoVitoria}: os contratos não foram renovados.` };
  }
  return null;
}
