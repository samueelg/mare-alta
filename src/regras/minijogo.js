// Minijogo de puxar o peixe: lógica pura, sem desenho. A cena do mar só chama atualizar()
// a cada quadro e desenha o resultado.
//
// Segurar puxa o peixe e estica a linha. Soltar alivia a linha, mas o peixe nada de volta.
// O peixe dá trancos aleatórios. Se a tensão passar do limite, a linha arrebenta.
// O limite vem da tripulação (habilidade, cansaço, quantidade): ver limiteTensao() em expedicao.js.

import { CONFIG } from './config.js';

// opcoes.puxarMult: bônus de evento (ex.: lua cheia) sobre a velocidade de puxar.
export function criarMinijogo(limite, rng, opcoes = {}) {
  const c = CONFIG.minijogo;
  return {
    limite,
    puxarMult: opcoes.puxarMult ?? 1,
    tensao: 0,
    progresso: 0,
    tempo: 0,
    proximoTranco: rng.entre(c.intervaloTrancoMin, c.intervaloTrancoMax),
    resultado: null, // 'pescou' | 'arrebentou' | 'escapou'
  };
}

export function atualizarMinijogo(m, dt, segurando, rng) {
  if (m.resultado) return m;
  const c = CONFIG.minijogo;

  m.tempo += dt;
  if (segurando) {
    m.progresso += c.puxar * m.puxarMult * dt;
    m.tensao += c.tensaoSobe * dt;
  } else {
    m.progresso = Math.max(0, m.progresso - c.progressoPerde * dt);
    m.tensao = Math.max(0, m.tensao - c.tensaoDesce * dt);
  }

  m.proximoTranco -= dt;
  if (m.proximoTranco <= 0) {
    m.tensao += rng.entre(c.trancoMin, c.trancoMax);
    m.proximoTranco = rng.entre(c.intervaloTrancoMin, c.intervaloTrancoMax);
  }

  if (m.tensao >= m.limite) m.resultado = 'arrebentou';
  else if (m.progresso >= 100) m.resultado = 'pescou';
  else if (m.tempo >= c.tempoMax) m.resultado = 'escapou';

  return m;
}
