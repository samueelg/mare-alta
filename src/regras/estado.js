import { CONFIG } from './config.js';
import { IDS_PROCESSOS } from './processos.js';
import { criarRng } from './rng.js';

export function criarEstado(semente = Date.now()) {
  return {
    semente,
    rng: criarRng(semente),
    caixa: CONFIG.caixaInicial,
    reputacao: CONFIG.reputacaoInicial,
    tanque: 0, // combustível no barco; o que sobra de uma viagem fica para a próxima
    // desgaste multiplica o cansaço ganho em cada viagem (cada pessoa cansa num ritmo)
    tripulacao: [
      { nome: 'Zé', habilidade: 1, fadiga: 10, desgaste: 1.2 },
      { nome: 'Lia', habilidade: 2, fadiga: 10, desgaste: 0.9 },
      { nome: 'Bento', habilidade: 1, fadiga: 10, desgaste: 1.0 },
    ],
    processos: Object.fromEntries(IDS_PROCESSOS.map((id) => [id, false])),
    expedicaoAtual: 0, // quantas expedições já foram concluídas
    historicoMedido: [], // só é preenchido com o Diário de bordo
    registros: [], // resumo de todas as expedições, para o relatório final
    contadores: {
      peixesRejeitados: 0,
      rejeitadosSemRequisito: 0, // rejeitados em viagens com pedido não esclarecido
      defeituososEntregues: 0,
      mudancasSemAnalise: 0,
      mudancasRecusadas: 0,
      linhasArrebentadas: 0,
      linhasArrebentadasCansaco: 0, // arrebentou com tripulação cansada (fadiga média > 50)
      reboques: 0,
      triagensPuladas: 0,
      demissoes: 0,
      horasExtras: 0,
      metasAtingidas: 0,
      trofeus: 0, // garoupas douradas (evento raro)
      pescasEmDobro: 0,
    },
  };
}

export function mediaTripulacao(estado, campo) {
  const t = estado.tripulacao;
  if (t.length === 0) return 0;
  return t.reduce((s, p) => s + p[campo], 0) / t.length;
}
