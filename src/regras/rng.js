// Gerador aleatório com semente (mulberry32): a mesma semente gera a mesma partida.
// Útil para testes e para repetir uma partida na apresentação.

export function criarRng(semente) {
  let a = semente >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.entre = (min, max) => min + rng() * (max - min);
  rng.inteiro = (min, max) => Math.floor(rng.entre(min, max + 1));
  rng.escolher = (lista) => lista[Math.floor(rng() * lista.length)];
  // Sorteio ponderado: cada item tem um campo `peso` (quanto maior, mais comum).
  rng.porPeso = (lista) => {
    let r = rng() * lista.reduce((s, i) => s + i.peso, 0);
    for (const item of lista) if ((r -= item.peso) < 0) return item;
    return lista[lista.length - 1];
  };
  return rng;
}
