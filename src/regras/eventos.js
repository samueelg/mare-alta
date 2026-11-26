// Eventos aleatórios: deixam cada expedição diferente sem mudar o que o jogo ensina.
//
//   Condição do dia (clima)  -> sorteada ao chegar o pedido; aparece no porto ANTES de abastecer.
//                               Conhecer o risco e se preparar para ele é Gerência de Projetos.
//   Gaivotas (comum)         -> um cardume novo surge no meio da viagem.
//   Cardume dourado (raro)   -> garoupas douradas por poucos segundos; cada uma vira troféu.
//   Pesca em dobro (comum) e peixe especial (raro) -> sorteados a cada peixe, em pescarPeixe().
//
// Tudo é sorteado com o rng da partida, então ?semente=N repete os mesmos eventos.

import { CONFIG, ESPECIES_COMUNS } from './config.js';

export function climaPorId(id) {
  return CONFIG.eventos.clima.find((c) => c.id === id);
}

export function sortearClima(rng) {
  return { ...rng.porPeso(CONFIG.eventos.clima) };
}

// Lugar livre no mar, longe dos cardumes que já existem (para não nascer um em cima do outro).
function posicaoLivre(rng, ocupados) {
  let p = null;
  for (let t = 0; t < 200; t++) {
    p = { x: rng.inteiro(260, 900), y: rng.inteiro(100, 480) };
    if (ocupados.every((c) => Math.hypot(c.x - p.x, c.y - p.y) >= 90)) break;
  }
  ocupados.push(p);
  return p;
}

// Decide, já no início da expedição, se e quando os eventos de mar acontecem.
// `em` é a fração do prazo (0 a 1) em que o evento dispara.
export function sortearEventosMar(rng, pedido, cardumes = []) {
  const ev = CONFIG.eventos;
  const ocupados = cardumes.map((c) => ({ x: c.x, y: c.y }));
  const eventos = { gaivotas: null, dourado: null };
  if (rng() < ev.gaivotas.chance) {
    const especie = rng() < ev.gaivotas.especiePedida ? pedido.spec.especie : rng.escolher(ESPECIES_COMUNS);
    eventos.gaivotas = { em: rng.entre(...ev.gaivotas.quando), especie, quantidade: rng.inteiro(3, 5), ...posicaoLivre(rng, ocupados), ocorreu: false };
  }
  if (rng() < ev.cardumeDourado.chance) {
    eventos.dourado = {
      em: rng.entre(...ev.cardumeDourado.quando),
      duracao: ev.cardumeDourado.duracao,
      quantidade: ev.cardumeDourado.peixes,
      ...posicaoLivre(rng, ocupados),
      ocorreu: false,
    };
  }
  return eventos;
}

// Põe no mapa o cardume de um evento (tipo: 'gaivotas' | 'dourado') e devolve o cardume criado.
export function surgirCardume(exp, tipo) {
  const ev = exp.eventosMar[tipo];
  ev.ocorreu = true;
  const cardume = {
    id: exp.cardumes.length,
    especie: tipo === 'dourado' ? 'garoupa' : ev.especie,
    quantidade: ev.quantidade,
    x: ev.x,
    y: ev.y,
    evento: tipo,
  };
  exp.cardumes.push(cardume);
  return cardume;
}

// O cardume dourado mergulha depois de alguns segundos.
export function sumirCardume(cardume) {
  cardume.quantidade = 0;
}
