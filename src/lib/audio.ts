// src/lib/audio.ts
// Plays Cyberpunk 2077 UI SFX pack WAV files via the Web Audio API.
// All buffers are preloaded on first use; same public function signatures
// as before so useGameAudio.ts needs no changes.

let _ctx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof AudioContext === 'undefined' && typeof (window as any).webkitAudioContext === 'undefined') return null;
  if (!_ctx) _ctx = new (AudioContext || (window as any).webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ── Buffer cache ───────────────────────────────────────────────────────────────

const buffers = new Map<string, AudioBuffer>();
const loading  = new Map<string, Promise<AudioBuffer | null>>();

async function load(file: string): Promise<AudioBuffer | null> {
  if (buffers.has(file)) return buffers.get(file)!;
  if (loading.has(file))  return loading.get(file)!;

  const promise = (async () => {
    try {
      const res  = await fetch(`/sfx/${file}`);
      const data = await res.arrayBuffer();
      const c    = ctx();
      if (!c) return null;
      const buf  = await c.decodeAudioData(data);
      buffers.set(file, buf);
      return buf;
    } catch (e) {
      console.warn(`[audio] failed to load ${file}`, e);
      return null;
    }
  })();

  loading.set(file, promise);
  return promise;
}

function play(file: string, volume = 1.0) {
  const c = ctx();
  if (!c) return;
  load(file).then(buf => {
    if (!buf) return;
    const src  = c.createBufferSource();
    const gain = c.createGain();
    src.buffer = buf;
    gain.gain.setValueAtTime(volume, c.currentTime);
    src.connect(gain);
    gain.connect(c.destination);
    src.start();
  });
}

// ── Background music ───────────────────────────────────────────────────────────
// Uses HTML Audio elements (loop support + no buffer-size limits).
// Two tracks available; the active track index is persisted to localStorage.

const MUSIC_FILES = [
  '/sfx/music_bg.mp3',   // track 1 — original
  '/sfx/music_bg2.mp3',  // track 2 — ambient background
] as const;

let _musicEls: (HTMLAudioElement | null)[] = [null, null];
const MUSIC_KEY       = 'crg-music-enabled';
const MUSIC_TRACK_KEY = 'crg-music-track';

export function getMusicEnabled(): boolean {
  return localStorage.getItem(MUSIC_KEY) !== 'false';
}

/** Returns the active track index (0 or 1). */
export function getMusicTrack(): number {
  const stored = parseInt(localStorage.getItem(MUSIC_TRACK_KEY) ?? '0', 10);
  return (stored === 1) ? 1 : 0;
}

export function setMusicEnabled(enabled: boolean): void {
  localStorage.setItem(MUSIC_KEY, String(enabled));
  if (enabled) {
    _playMusicEl();
  } else {
    stopMusic();
  }
}

/** Switch to the next track (cycles 0 → 1 → 0). Persists choice. */
export function nextMusicTrack(): void {
  const next = (getMusicTrack() + 1) % MUSIC_FILES.length;
  localStorage.setItem(MUSIC_TRACK_KEY, String(next));
  // Stop all tracks then play the new one
  _musicEls.forEach(el => { if (el) { el.pause(); el.currentTime = 0; } });
  if (getMusicEnabled()) _playMusicEl();
}

function _playMusicEl(): void {
  const idx = getMusicTrack();
  if (!_musicEls[idx]) {
    const el = new Audio(MUSIC_FILES[idx]);
    el.loop   = true;
    el.volume = 0.35;
    _musicEls[idx] = el;
  }
  // Pause any other playing track
  _musicEls.forEach((el, i) => { if (el && i !== idx) { el.pause(); el.currentTime = 0; } });
  _musicEls[idx]!.play().catch(() => {
    // Autoplay blocked (e.g. pointerdown fired before user activation was established).
    // Register a one-shot retry on the next reliable user gesture.
    const el = _musicEls[idx];
    if (!el) return;
    const retry = () => { if (getMusicEnabled()) el.play().catch(() => {}); };
    window.addEventListener('click', retry, { once: true });
    window.addEventListener('keydown', retry, { once: true });
  });
}

/** Start background music if the toggle is enabled. Call after first user gesture. */
export function startMusic(): void {
  if (!getMusicEnabled()) return;
  _playMusicEl();
}

/** Stop and reset background music. */
export function stopMusic(): void {
  _musicEls.forEach(el => { if (el) { el.pause(); el.currentTime = 0; } });
}

// ── Preload everything on first user gesture ──────────────────────────────────

const ALL_FILES = [
  'deck_ui_typing.wav',
  'deck_ui_default_activation.wav',
  'deck_ui_slider_up.wav',
  'deck_ui_slider_down.wav',
  'deck_ui_bumper_end_02.wav',
  'deck_ui_switch_toggle_on.wav',
  'deck_ui_switch_toggle_off.wav',
  'deck_ui_tab_transition_01.wav',
  'deck_ui_side_menu_fly_in.wav',
  'deck_ui_side_menu_fly_out.wav',
  'deck_ui_achievement_toast.wav',
  'deck_ui_hide_modal.wav',
  'deck_ui_navigation.wav',
  'deck_ui_show_modal.wav',
  'deck_ui_out_of_game_detail.wav',
  'deck_ui_launch_game.wav',
];

/** Call on first pointer event to unblock AudioContext, kick off SFX preloading, and start music. */
export function resumeAudio() {
  ctx(); // unblocks suspended context
  ALL_FILES.forEach(f => load(f));
  startMusic(); // attempt music now that the user has gestured
}

// ── In-game sound effects ──────────────────────────────────────────────────────

/** Short blip when drawing a card. */
export function sfxDraw() {
  play('deck_ui_typing.wav', 0.9);
}

/** Per-tick sound during the dice roll slot-machine animation. */
export function sfxDiceTick() {
  play('deck_ui_bumper_end_02.wav', 0.85);
}

/** Sound when the dice roll LED display appears (standby mode). */
export function sfxShowDiceRoll() {
  play('deck_ui_show_modal.wav', 1.0);
}

/** Ascending tone when a card in hand is selected. */
export function sfxCardSelect() {
  play('deck_ui_slider_up.wav', 0.85);
}

/** Descending tone when the selected card is confirmed and played. */
export function sfxCardPlay() {
  play('deck_ui_slider_down.wav', 0.85);
}

/** Credit gain. */
export function sfxGain() {
  play('deck_ui_slider_up.wav', 0.9);
}

/** Credit loss. */
export function sfxLoss() {
  play('deck_ui_slider_down.wav', 0.9);
}

/** Attack / targeted hack. */
export function sfxAttack() {
  play('deck_ui_bumper_end_02.wav', 1.0);
}

/** Daemon deployed — plays when a daemon card is activated on the board. */
export function sfxDaemon() {
  play('deck_ui_achievement_toast.wav', 1.0);
}

/** Turn / phase start. */
export function sfxTurnStart() {
  play('deck_ui_tab_transition_01.wav', 0.8);
}

/** WAR card played. */
export function sfxWar() {
  play('deck_ui_side_menu_fly_in.wav', 1.0);
}

/** WAR win. */
export function sfxWarWin() {
  play('deck_ui_achievement_toast.wav', 1.0);
}

/** WAR loss. */
export function sfxWarLoss() {
  play('deck_ui_hide_modal.wav', 0.9);
}

/** Roll about to start. */
export function sfxRollStart() {
  play('deck_ui_navigation.wav', 1.0);
}

/** Corruption mode activates. */
export function sfxCorruption() {
  play('deck_ui_side_menu_fly_out.wav', 1.0);
}

/** The Corruption card is revealed — shown centre-screen when drawn. */
export function sfxCorruptionReveal() {
  play('deck_ui_achievement_toast.wav', 1.0);
}

/** Dice roll complete — plays when the result digits start blinking. */
export function sfxToast() {
  play('deck_ui_toast.wav', 1.0);
}

/** Victory or defeat — game end transition. */
export function sfxWin() {
  play('deck_ui_side_menu_fly_out.wav', 1.0);
}

/** Defeat / game over. */
export function sfxGameOver() {
  play('deck_ui_side_menu_fly_out.wav', 0.9);
}

// ── Synthesized SFX (no WAV files) ────────────────────────────────────────────

/** Chromatic-aberration glitch burst — played when a card is played out. */
export function sfxGlitch() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;

  const bufSize = Math.floor(c.sampleRate * 0.14);
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;

  const src = c.createBufferSource();
  src.buffer = buf;

  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2400;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.35, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

  src.connect(hp); hp.connect(gain); gain.connect(c.destination);
  src.start(t); src.stop(t + 0.14);
}

/** Descending harsh tone when a daemon is terminated. */
export function sfxDaemonTerminated() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;

  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(55, t + 0.45);

  const distCurve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1;
    distCurve[i] = (Math.PI + 300) * x / (Math.PI + 300 * Math.abs(x));
  }
  const dist = c.createWaveShaper();
  dist.curve = distCurve;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.28, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

  osc.connect(dist); dist.connect(gain); gain.connect(c.destination);
  osc.start(t); osc.stop(t + 0.45);
}

/** Low drone swell + glitch hit when corruption mode activates. */
export function sfxCorruptionActivate() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;

  // Immediate glitch hit
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(960, t);
  osc.frequency.exponentialRampToValueAtTime(120, t + 0.28);
  const g0 = c.createGain();
  g0.gain.setValueAtTime(0.22, t);
  g0.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  osc.connect(g0); g0.connect(c.destination);
  osc.start(t); osc.stop(t + 0.28);

  // Low drone swell (two slightly detuned saws for beating effect)
  [55, 62].forEach(freq => {
    const d = c.createOscillator();
    d.type = 'sawtooth';
    d.frequency.value = freq;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t + 0.1);
    g.gain.linearRampToValueAtTime(0.13, t + 0.9);
    g.gain.linearRampToValueAtTime(0.07, t + 2.8);
    g.gain.exponentialRampToValueAtTime(0.001, t + 3.2);
    d.connect(lp); lp.connect(g); g.connect(c.destination);
    d.start(t + 0.1); d.stop(t + 3.2);
  });
}

// ── Setup screen ──────────────────────────────────────────────────────────────

/** Segment button / agent count click. */
export function sfxNavClick() {
  play('deck_ui_navigation.wav', 0.85);
}

/** Credits slider moved up. */
export function sfxSliderUp() {
  play('deck_ui_slider_up.wav', 0.75);
}

/** Credits slider moved down. */
export function sfxSliderDown() {
  play('deck_ui_slider_down.wav', 0.75);
}

/** Toggle switched on. */
export function sfxToggleOn() {
  play('deck_ui_switch_toggle_on.wav', 0.85);
}

/** Toggle switched off. */
export function sfxToggleOff() {
  play('deck_ui_switch_toggle_off.wav', 0.85);
}

/** Open help modal. */
export function sfxShowModal() {
  play('deck_ui_show_modal.wav', 0.85);
}

/** CONNECT — start game. */
export function sfxConnect() {
  play('deck_ui_side_menu_fly_in.wav', 1.0);
}

/** Button hover — quiet blip for any interactive button. */
export function sfxHover() {
  play('deck_ui_navigation.wav', 0.45);
}
