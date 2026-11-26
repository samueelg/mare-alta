// Os 4 pedidos da partida, um por expedição. A ordem é fixa e pensada para ensinar:
// 1. pedido vago (REQ)            2. mudança de espécie no meio da viagem (controle de mudanças)
// 3. pedido grande, puxa hora extra (RH)   4. aumento de escopo no mesmo prazo (GPR + REQ)
//
// textoVago: o que o cliente diz. spec/meta: o que ele realmente quer (só aparece depois de esclarecer).

export const PEDIDOS = [
  {
    cliente: 'Restaurante Maré Mansa',
    textoVago: 'Quero uns 6 kg de peixe bom pro almoço de domingo.',
    spec: { especie: 'pargo', tamanhoMin: 35 },
    meta: 6,
    precoKg: 110,
  },
  {
    cliente: 'Cantina do Porto',
    textoVago: 'Preciso de peixe pra moqueca, coisa de 8 kg.',
    spec: { especie: 'robalo', tamanhoMin: 40 },
    meta: 8,
    precoKg: 100,
    mudanca: {
      emFracao: 0.4, // acontece quando 40% do prazo passou
      texto: 'O robalo ficou caro no cardápio. Troca por tainha, de 30 cm pra cima?',
      novaSpec: { especie: 'tainha', tamanhoMin: 30 },
    },
  },
  {
    cliente: 'Hotel Farol',
    textoVago: 'Temos um evento grande, mandem 10 kg.',
    spec: { especie: 'tainha', tamanhoMin: 30 },
    meta: 10,
    precoKg: 90,
  },
  {
    cliente: 'Bistrô Coral',
    textoVago: 'Algo nobre pro menu degustação, uns 6 kg.',
    spec: { especie: 'robalo', tamanhoMin: 45 },
    meta: 6,
    precoKg: 130,
    mudanca: {
      emFracao: 0.4,
      texto: 'O evento cresceu! Dá pra trazer 9 kg no mesmo prazo?',
      novaMeta: 9,
    },
  },
];
