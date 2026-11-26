// Processos que podem ser institucionalizados na fase "No porto".
// Uma vez adotado, o processo vale para todas as expedições seguintes: é isso que representa a
// institucionalização do MR-MPS-SW (a prática deixa de depender de quem está no barco).
//
// ATENÇÃO aos rótulos de nível: no MR-MPS-SW:2021 o Nível G é formado por Gerência de Projetos
// (GPR) e Engenharia de Requisitos (REQ). Confira no guia usado na disciplina antes de citar
// outros níveis.

export const PROCESSOS = {
  fichaPedido: {
    nome: 'Ficha de pedido padrão',
    sigla: 'REQ',
    area: 'MR-MPS-SW · Engenharia de Requisitos',
    custo: 350,
    descricao:
      'Todo pedido já sai do porto esclarecido, sem perder tempo de mar. Pedidos de mudança passam a mostrar o impacto antes da decisão, e renegociar deixa de custar reputação.',
  },
  diarioBordo: {
    nome: 'Diário de bordo',
    sigla: 'GPR',
    area: 'MR-MPS-SW · Gerência de Projetos',
    custo: 300,
    descricao:
      'Cada viagem passa a ser medida. O planejamento mostra uma previsão baseada no histórico e o mapa mostra a estimativa de cada cardume. Quanto mais viagens registradas, mais estreita a previsão.',
  },
  checklistTriagem: {
    nome: 'Checklist de triagem',
    sigla: 'VER',
    area: 'ISO/IEC/IEEE 12207 · Verificação',
    custo: 300,
    descricao:
      'Cada peixe é verificado ao entrar no porão (marcado dentro ou fora da especificação), e a triagem antes da entrega passa a ser automática e sem custo.',
  },
  escalaTreinamento: {
    nome: 'Escala e treinamento da tripulação',
    sigla: 'RH',
    area: 'MR-MPS-RH · Gestão de pessoas',
    custo: 400,
    descricao:
      'A tripulação é treinada (+1 de habilidade, até 3) e passa a ter escala de descanso: recupera mais cansaço no porto. Novos contratados chegam treinados.',
  },
};

export const IDS_PROCESSOS = Object.keys(PROCESSOS);

export function nivelMaturidade(processos) {
  const req = processos.fichaPedido;
  const gpr = processos.diarioBordo;
  if (!req && !gpr) {
    return { nivel: 0, rotulo: 'Improviso', descricao: 'Cada viagem depende da sorte e de quem está no barco.' };
  }
  if (!(req && gpr)) {
    return { nivel: 1, rotulo: 'Em transição', descricao: 'Parte das práticas de Gerência de Projetos e Requisitos foi institucionalizada.' };
  }
  if (!processos.checklistTriagem) {
    return { nivel: 2, rotulo: 'Nível G', descricao: 'Gerência de Projetos e Engenharia de Requisitos institucionalizadas (MR-MPS-SW Nível G).' };
  }
  return { nivel: 3, rotulo: 'Nível G + Verificação', descricao: 'Além do Nível G, a verificação do produto virou rotina.' };
}
