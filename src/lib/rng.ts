// src/lib/rng.ts
// Mulberry32 — fast, seedable 32-bit PRNG

let _state = 0;

export const initRNG = (seed?: number): number => {
  _state = seed !== undefined ? seed >>> 0 : (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  return _state;
};

export const random = (): number => {
  _state |= 0;
  _state = _state + 0x6d2b79f5 | 0;
  let t = Math.imul(_state ^ _state >>> 15, 1 | _state);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
