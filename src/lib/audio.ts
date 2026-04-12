// src/lib/audio.ts
// Procedural 16-bit chiptune sound effects using Web Audio API.
// All sounds are synthesised at runtime — no audio files required.

let _ctx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof AudioContext === 'undefined' && typeof (window as any).webkitAudioContext === 'undefined') return null;
  if (!_ctx) _ctx = new (AudioContext || (window as any).webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

/** Play a single oscillator note with an exponential volume decay. */
function note(
  freq: number,
  dur: number,
  type: OscillatorType = 'square',
  vol  = 0.14,
  delay = 0,
  endFreq?: number,          // optional pitch sweep target
) {
  const c = ctx();
  if (!c) return;
  const t   = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  }

  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.01);
}

// ── Sound effects ─────────────────────────────────────────────────────────────

/** Short double-blip when drawing a card. */
export function sfxDraw() {
  note(220, 0.04, 'square', 0.10);
  note(440, 0.06, 'square', 0.10, 0.05);
}

/** Soft confirmation tone when selecting / playing a card. */
export function sfxCardSelect() {
  note(330, 0.06, 'square', 0.09);
}

/** Credit gain — ascending 3-note arpeggio in C major. */
export function sfxGain() {
  note(262, 0.07, 'square', 0.12, 0.00);
  note(330, 0.07, 'square', 0.12, 0.07);
  note(392, 0.11, 'square', 0.14, 0.14);
}

/** Credit loss — descending 2-note drop. */
export function sfxLoss() {
  note(440, 0.07, 'square', 0.13, 0.00, 330);
  note(220, 0.13, 'square', 0.12, 0.07, 150);
}

/** Attack / targeted hack — sawtooth burst sweeping down. */
export function sfxAttack() {
  note(480, 0.05, 'sawtooth', 0.18, 0.00, 280);
  note(280, 0.08, 'sawtooth', 0.14, 0.05, 140);
  note(140, 0.14, 'square',   0.10, 0.12,  80);
}

/** Daemon deployed — resonant rising two-note chord. */
export function sfxDaemon() {
  note(196, 0.22, 'square', 0.11, 0.00);
  note(294, 0.28, 'square', 0.10, 0.08);
  note(392, 0.18, 'square', 0.08, 0.18);
}

/** Turn / phase start — subtle high click. */
export function sfxTurnStart() {
  note(660, 0.03, 'square', 0.07);
}

/** WAR card played — dramatic low three-beat descend. */
export function sfxWar() {
  note(220, 0.07, 'sawtooth', 0.20, 0.00, 165);
  note(165, 0.08, 'sawtooth', 0.18, 0.08, 110);
  note(110, 0.18, 'square',   0.15, 0.15,  82);
}

/** WAR win fanfare — quick rising two-note with accent. */
export function sfxWarWin() {
  note(392, 0.07, 'square', 0.14, 0.00);
  note(523, 0.12, 'square', 0.16, 0.08);
  note(659, 0.18, 'square', 0.14, 0.20);
}

/** WAR loss — descending three-note defeat sting. */
export function sfxWarLoss() {
  note(330, 0.07, 'square', 0.14, 0.00, 294);
  note(220, 0.09, 'square', 0.13, 0.08, 165);
  note(110, 0.18, 'square', 0.12, 0.16,  82);
}

/** Stability roll — quick upward sweep before the roll animation. */
export function sfxRollStart() {
  note(110, 0.25, 'square', 0.10, 0, 440);
}

/** Corruption mode activates — descending ominous chord. */
export function sfxCorruption() {
  note(440, 0.10, 'sawtooth', 0.16, 0.00, 220);
  note(330, 0.15, 'sawtooth', 0.14, 0.06, 165);
  note(220, 0.25, 'sawtooth', 0.12, 0.14, 110);
}

/** Victory — ascending 5-note chiptune fanfare. */
export function sfxWin() {
  const melody = [262, 330, 392, 523, 659];
  melody.forEach((f, i) => {
    note(f, 0.10 + i * 0.02, 'square', 0.14, i * 0.10);
  });
  // Harmony
  const harmony = [196, 247, 294, 392, 494];
  harmony.forEach((f, i) => {
    note(f, 0.10 + i * 0.02, 'square', 0.07, i * 0.10);
  });
}

/** Defeat — slow descending minor arpeggio. */
export function sfxGameOver() {
  [440, 349, 262, 196].forEach((f, i) => {
    note(f, 0.14 + i * 0.04, 'square', 0.14, i * 0.14, f * 0.9);
  });
}

/** Ensures AudioContext is ready after a user gesture (call on first click). */
export function resumeAudio() {
  ctx();
}
