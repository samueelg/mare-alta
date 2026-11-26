// Efeitos sonoros sintetizados na hora (Web Audio API): nenhum arquivo de áudio, funciona offline.
// Estilo minimalista: ondas simples (seno, triângulo, quadrada) e ruído filtrado, volumes baixos.
//
//   som.interacao()  som.passo('areia' | 'madeira')  som.lancar()  som.fisgado()  som.dinheiro()
//   som.gaivota()    ambiente('porto' | 'mar' | null)  -> ondas contínuas + gaivotas de vez em quando
//
// O navegador só libera áudio depois de um clique ou tecla: chame iniciarAudio() num desses eventos.
// M liga/desliga o som (ver main.js).

let ctx = null;
let mestre = null;
let ruidoBuf = null;
let mudo = false;
const VOLUME = 0.7;

export function iniciarAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!ctx) {
    ctx = new Ctx();
    mestre = ctx.createGain();
    mestre.gain.value = mudo ? 0 : VOLUME;
    mestre.connect(ctx.destination);
    // 2 s de ruído branco, reaproveitado por todos os sons de ruído
    ruidoBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = ruidoBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (ambienteAtual) montarAmbiente(ambienteAtual);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function alternarMudo() {
  mudo = !mudo;
  if (mestre) mestre.gain.setTargetAtTime(mudo ? 0 : VOLUME, ctx.currentTime, 0.05);
  return mudo;
}

const pronto = () => ctx && ctx.state === 'running';

// Para testes/depuração: 'sem-contexto' | 'suspended' | 'running' (+ mudo)
export const estadoAudio = () => ({ contexto: ctx ? ctx.state : 'sem-contexto', mudo, ambiente: ambienteAtual });

// Envelope curto: sobe rápido e cai exponencialmente
function envelope(param, t0, vol, ataque, dur) {
  param.setValueAtTime(0.0001, t0);
  param.exponentialRampToValueAtTime(vol, t0 + ataque);
  param.exponentialRampToValueAtTime(0.0001, t0 + dur);
}

function tom({ freq, freqFim = freq, tipo = 'triangle', dur = 0.1, vol = 0.1, atraso = 0, ataque = 0.005, vibrato = 0 }) {
  if (!pronto()) return;
  const t0 = ctx.currentTime + atraso;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqFim !== freq) osc.frequency.exponentialRampToValueAtTime(freqFim, t0 + dur);
  if (vibrato) {
    const lfo = ctx.createOscillator();
    const prof = ctx.createGain();
    lfo.frequency.value = 22;
    prof.gain.value = vibrato;
    lfo.connect(prof).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.05);
  }
  envelope(g.gain, t0, vol, ataque, dur);
  osc.connect(g).connect(mestre);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function ruido({ dur = 0.1, filtro = 'bandpass', freq = 1000, freqFim = freq, q = 1, vol = 0.1, atraso = 0, ataque = 0.005 }) {
  if (!pronto()) return;
  const t0 = ctx.currentTime + atraso;
  const src = ctx.createBufferSource();
  src.buffer = ruidoBuf;
  const f = ctx.createBiquadFilter();
  f.type = filtro;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t0);
  if (freqFim !== freq) f.frequency.exponentialRampToValueAtTime(freqFim, t0 + dur);
  const g = ctx.createGain();
  envelope(g.gain, t0, vol, ataque, dur);
  src.connect(f).connect(g).connect(mestre);
  src.start(t0, Math.random() * 1.5);
  src.stop(t0 + dur + 0.05);
}

const variar = (v, p = 0.1) => v * (1 + (Math.random() * 2 - 1) * p);

export const som = {
  // Bipe curto de dois tons (falar, usar, escolher opção)
  interacao() {
    tom({ freq: 660, tipo: 'triangle', dur: 0.06, vol: 0.09 });
    tom({ freq: 990, tipo: 'triangle', dur: 0.08, vol: 0.07, atraso: 0.05 });
  },

  // Passo: areia = chiado abafado; madeira (píer) = toque grave
  passo(superficie = 'areia') {
    if (superficie === 'madeira') {
      tom({ freq: variar(170), freqFim: 90, tipo: 'sine', dur: 0.07, vol: 0.12 });
      ruido({ dur: 0.04, filtro: 'lowpass', freq: 900, vol: 0.04 });
    } else {
      ruido({ dur: variar(0.06, 0.2), filtro: 'bandpass', freq: variar(1700, 0.25), q: 0.9, vol: 0.05, ataque: 0.01 });
    }
  },

  // Linha cortando o ar (ruído que sobe) e o "plop" da isca na água
  lancar() {
    ruido({ dur: 0.28, filtro: 'bandpass', freq: 500, freqFim: 2600, q: 2, vol: 0.06, ataque: 0.12 });
    tom({ freq: 520, freqFim: 120, tipo: 'sine', dur: 0.14, vol: 0.16, atraso: 0.32 });
    ruido({ dur: 0.18, filtro: 'lowpass', freq: 1400, freqFim: 400, vol: 0.07, atraso: 0.32 });
  },

  // Respingo + três notas subindo
  fisgado() {
    ruido({ dur: 0.22, filtro: 'lowpass', freq: 2200, freqFim: 500, vol: 0.09 });
    [523, 659, 784].forEach((f, i) => tom({ freq: f, tipo: 'triangle', dur: 0.12, vol: 0.09, atraso: 0.06 + i * 0.07 }));
  },

  // Peixe pulando: "plic" curtinho (vol cai com a distância do barco)
  respingo(vol = 1) {
    ruido({ dur: 0.12, filtro: 'bandpass', freq: variar(2400, 0.2), freqFim: 900, q: 1.5, vol: 0.035 * vol });
    tom({ freq: variar(900, 0.15), freqFim: 300, tipo: 'sine', dur: 0.08, vol: 0.04 * vol });
  },

  // Moedinha: duas notas agudas de onda quadrada
  dinheiro() {
    tom({ freq: 988, tipo: 'square', dur: 0.07, vol: 0.045 });
    tom({ freq: 1319, tipo: 'square', dur: 0.28, vol: 0.045, atraso: 0.075 });
  },

  // Gaivota: dois ou três "kiau" descendo, com tremido
  gaivota(vol = 1) {
    const n = 2 + Math.floor(Math.random() * 2);
    const base = variar(1500, 0.15);
    for (let i = 0; i < n; i++) {
      tom({ freq: base, freqFim: base * 0.62, tipo: 'sawtooth', dur: 0.22, vol: 0.022 * vol, atraso: i * 0.3, ataque: 0.03, vibrato: 35 });
      tom({ freq: base * 2, freqFim: base * 1.3, tipo: 'sine', dur: 0.18, vol: 0.012 * vol, atraso: i * 0.3, ataque: 0.03 });
    }
  },
};

// ------------------------------------------------------------------ ambiente: ondas + gaivotas

const AMBIENTES = {
  porto: { filtro: 420, volume: 0.05, gaivotas: [6000, 14000], volGaivota: 0.7 },
  mar: { filtro: 650, volume: 0.075, gaivotas: [9000, 20000], volGaivota: 0.5 },
};
let ambienteAtual = null;
let cadeia = null; // { src, lfo, g }
let timerGaivota = null;

function montarAmbiente(tipo) {
  if (!ctx) return;
  const a = AMBIENTES[tipo];
  if (!cadeia) {
    // ruído grave -> volume que respira devagar (ondas indo e vindo)
    const src = ctx.createBufferSource();
    src.buffer = ruidoBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const prof = ctx.createGain();
    lfo.frequency.value = 0.13;
    lfo.connect(prof).connect(g.gain);
    src.connect(f).connect(g).connect(mestre);
    src.start();
    lfo.start();
    cadeia = { src, f, g, prof };
  }
  const t = ctx.currentTime;
  cadeia.f.frequency.setTargetAtTime(a.filtro, t, 0.5);
  cadeia.g.gain.setTargetAtTime(a.volume, t, 0.5);
  cadeia.prof.gain.setTargetAtTime(a.volume * 0.7, t, 0.5);
}

function agendarGaivota() {
  clearTimeout(timerGaivota);
  const a = AMBIENTES[ambienteAtual];
  if (!a) return;
  const [min, max] = a.gaivotas;
  timerGaivota = setTimeout(() => {
    som.gaivota(a.volGaivota);
    agendarGaivota();
  }, min + Math.random() * (max - min));
}

export function ambiente(tipo) {
  ambienteAtual = tipo;
  if (!tipo) {
    clearTimeout(timerGaivota);
    if (cadeia && ctx) {
      cadeia.g.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      cadeia.prof.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    }
    return;
  }
  montarAmbiente(tipo);
  agendarGaivota();
}
