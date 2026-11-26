// Todos os números de balanceamento ficam aqui. Ajuste aqui, não espalhado pelo código.

export const CONFIG = {
  totalExpedicoes: 4,

  caixaInicial: 1000,
  reputacaoInicial: 60,
  reputacaoVitoria: 50,

  salarioPorTripulante: 80,

  // O combustível é comprado na bomba do porto (segurando E) e o que sobra fica no tanque.
  combustivel: {
    precoUnidade: 2,
    tanqueMax: 120,
    minimoZarpar: 30, // abaixo disso o barco não sai
    vazaoPorSegundo: 40, // unidades por segundo segurando E na bomba
    pxPorUnidade: 22, // pixels navegados por unidade de combustível
  },

  jornada: {
    normal: { rotulo: 'Jornada normal', segundos: 75, fadiga: 25 },
    horaExtra: { rotulo: 'Hora extra', segundos: 105, fadiga: 45 },
  },

  conversarCliente: { segundos: 15 }, // tempo de mar perdido para esclarecer o pedido sem processo
  reboque: { custo: 300, reputacao: -5 },
  triagemManual: { custo: 120, fadiga: 10 },
  mercadoPorKg: 15, // peixe que não vai para o cliente é vendido barato no mercado

  rejeicao: { reputacaoPorPeixe: -4, limite: -20 },
  metaAtingida: { reputacao: 6 },
  metaFalhou: { reputacaoMax: -20 }, // proporcional ao quanto faltou

  mudanca: {
    recusar: -8,
    analisar: -2, // vira 0 com a Ficha de pedido
    prazoExtraAnalise: 20,
  },

  descanso: { normal: 30, comEscala: 50 },
  demissaoFadiga: 85,
  tripulacaoMinima: 2,
  contratar: { custo: 200 },

  minijogo: {
    limiteBase: 55,
    porHabilidade: 10,
    porFadiga: 0.3,
    porFaltaTripulante: 8,
    limiteMin: 30,
    limiteMax: 95,
    // Calibrado por simulação (300 partidas por cenário, jogador com reação de 0,15 s):
    // ritmo bom pesca em ~5 s; limite 65 (início) ≈ 95% de acerto, limite 40 (esgotado) ≈ 30%.
    puxar: 30, // progresso por segundo segurando
    tensaoSobe: 30, // por segundo segurando
    tensaoDesce: 70, // por segundo solto
    progressoPerde: 4, // por segundo solto (o peixe nada de volta)
    trancoMin: 8,
    trancoMax: 18,
    intervaloTrancoMin: 0.8,
    intervaloTrancoMax: 1.6,
    tempoMax: 15,
  },

  diario: { bandaInicial: 0.5, reducaoPorRegistro: 0.15, bandaMin: 0.1 },

  defeitoChance: 0.12,

  // Eventos aleatórios. Todos usam o rng da partida: com ?semente=N eles se repetem.
  eventos: {
    // Condição do dia: uma por expedição, aparece no porto ANTES de abastecer (risco conhecido = GPR).
    clima: [
      { id: 'calmo', peso: 45, icone: 'sol', nome: 'Mar calmo', texto: 'Dia comum, sem surpresas.' },
      { id: 'marAgitado', peso: 20, icone: 'onda', nome: 'Mar agitado', texto: 'O barco gasta 30% mais combustível.', combustivelMult: 1.3 },
      { id: 'neblina', peso: 18, icone: 'nuvem', nome: 'Neblina', texto: 'O sonar só enxerga cardumes próximos do barco.', alcanceSonar: 190 },
      { id: 'luaCheia', peso: 10, icone: 'lua', nome: 'Lua cheia', texto: 'Peixe agitado: puxar rende 40% mais e o peixe especial aparece em dobro.', puxarMult: 1.4, especialMult: 2 },
      { id: 'piracema', peso: 7, icone: 'cardume', nome: 'Cardumes fartos', texto: 'Cada cardume vem com 2 peixes a mais.', peixesExtra: 2 },
    ],
    pescaEmDobro: 0.12, // comum: vem um segundo peixe do mesmo cardume junto
    peixeEspecial: { chance: 0.03, valor: 150 }, // raro: Garoupa dourada, vendida ao colecionador no porto
    gaivotas: { chance: 0.6, quando: [0.2, 0.6], especiePedida: 0.5 }, // comum: novo cardume no meio da viagem
    cardumeDourado: { chance: 0.18, quando: [0.3, 0.7], duracao: 20, peixes: 2 }, // raro: cardume de garoupas que some rápido
  },
};

export const ESPECIES = {
  sardinha: { nome: 'Sardinha', cor: 0x9fb4c7, tamanho: [15, 25], peso: [0.1, 0.3] },
  tainha: { nome: 'Tainha', cor: 0x7fa36b, tamanho: [25, 50], peso: [0.6, 2.0] },
  pargo: { nome: 'Pargo', cor: 0xd9644a, tamanho: [25, 50], peso: [0.7, 2.5] },
  robalo: { nome: 'Robalo', cor: 0xe0c060, tamanho: [30, 60], peso: [1.0, 3.5] },
  // Especial: nunca é pedida por cliente e não conta para a meta; vira troféu vendido no porto.
  garoupa: { nome: 'Garoupa dourada', cor: 0xffc400, tamanho: [55, 80], peso: [4.0, 7.0], especial: true },
};

export const ESPECIES_COMUNS = Object.keys(ESPECIES).filter((id) => !ESPECIES[id].especial);

export function pesoMedio(especie) {
  const [min, max] = ESPECIES[especie].peso;
  return (min + max) / 2;
}
