// Relatório final: transforma o que aconteceu na partida em lições ligadas aos conceitos.
// É aqui que o jogador conecta "o que deu errado" com "qual processo teria evitado".

import { PROCESSOS, nivelMaturidade } from './processos.js';

export function licoes(estado) {
  const c = estado.contadores;
  const lista = [];

  if (c.rejeitadosSemRequisito > 0) {
    lista.push({
      tipo: 'problema',
      conceito: 'Engenharia de Requisitos (REQ)',
      texto: `${c.rejeitadosSemRequisito} peixe(s) devolvido(s) em viagens com o pedido não esclarecido. Requisito mal entendido vira retrabalho: a Ficha de pedido padroniza o entendimento antes de sair do porto.`,
    });
  }
  if (c.mudancasSemAnalise > 0) {
    lista.push({
      tipo: 'problema',
      conceito: 'Controle de mudanças (REQ/GPR)',
      texto: `${c.mudancasSemAnalise} mudança(s) aceita(s) sem análise de impacto. O escopo mudou, o prazo não: o que já estava pronto perdeu validade ou a meta ficou fora de alcance.`,
    });
  }
  const rejeitadosComRequisito = c.peixesRejeitados - c.rejeitadosSemRequisito;
  if (c.triagensPuladas > 0 && (rejeitadosComRequisito > 0 || c.defeituososEntregues > 0)) {
    lista.push({
      tipo: 'problema',
      conceito: 'Verificação (ISO/IEC/IEEE 12207)',
      texto: `A triagem foi pulada ${c.triagensPuladas} vez(es) e ${c.defeituososEntregues} peixe(s) com defeito chegaram ao cliente. Corrigir depois da entrega (pós-venda) custa mais que verificar antes.`,
    });
  }
  if (c.linhasArrebentadasCansaco > 0 || c.demissoes > 0) {
    lista.push({
      tipo: 'problema',
      conceito: 'Gestão de pessoas (MR-MPS-RH)',
      texto: `${c.linhasArrebentadasCansaco} linha(s) arrebentada(s) com a tripulação cansada e ${c.demissoes} demissão(ões). Hora extra rende hoje e cobra amanhã: equipe esgotada erra mais e vai embora.`,
    });
  }
  if (c.reboques > 0) {
    lista.push({
      tipo: 'problema',
      conceito: 'Gerência de Projetos (GPR)',
      texto: `${c.reboques} reboque(s) por falta de combustível. Planejar recursos sem histórico é chute: o Diário de bordo transforma viagens passadas em estimativa.`,
    });
  }

  const adotados = Object.keys(PROCESSOS).filter((id) => estado.processos[id]);
  const maturidade = nivelMaturidade(estado.processos);
  if (adotados.length > 0) {
    lista.push({
      tipo: 'acerto',
      conceito: 'MR-MPS-SW · Institucionalização',
      texto: `Processos adotados: ${adotados.map((id) => PROCESSOS[id].nome).join(', ')}. Maturidade final: ${maturidade.rotulo}. ${maturidade.descricao}`,
    });
  } else {
    lista.push({
      tipo: 'problema',
      conceito: 'MR-MPS-SW · Melhoria de processos',
      texto: 'Nenhum processo foi institucionalizado: cada viagem dependeu de sorte e improviso. Compare o resultado da 1ª e da última expedição.',
    });
  }
  if (c.metasAtingidas > 0) {
    lista.push({ tipo: 'acerto', conceito: 'Resultado', texto: `${c.metasAtingidas} de ${estado.registros.length} pedido(s) entregue(s) dentro da meta.` });
  }
  return lista;
}
