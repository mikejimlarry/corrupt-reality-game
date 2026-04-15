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

/** Call on first pointer event to unblock AudioContext and kick off preloading. */
export function resumeAudio() {
  ctx(); // unblocks suspended context
  ALL_FILES.forEach(f => load(f));
}

// ── In-game sound effects ──────────────────────────────────────────────────────

/** Short blip when drawing a card. */
export function sfxDraw() {
  play('deck_ui_typing.wav', 0.9);
}

/** Per-tick sound during the dice roll slot-machine animation. */
export function sfxDiceTick() {
  play('deck_ui_bumper_end_02.wav', 0.45);
}

/** Sound when the dice roll LED display appears (standby mode). */
export function sfxShowDiceRoll() {
  play('deck_ui_show_modal.wav', 0.85);
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
  play('deck_ui_navigation.wav', 0.85);
}

/** Corruption mode activates. */
export function sfxCorruption() {
  play('deck_ui_switch_toggle_off.wav', 1.0);
}

/** The Corruption card is revealed — shown centre-screen when drawn. */
export function sfxCorruptionReveal() {
  play('deck_ui_achievement_toast.wav', 1.0);
}

/** Dice roll complete — plays when the result digits start blinking. */
export function sfxToast() {
  play('deck_ui_toast.wav', 0.5);
}

/** Victory or defeat — game end transition. */
export function sfxWin() {
  play('deck_ui_side_menu_fly_out.wav', 1.0);
}

/** Defeat / game over. */
export function sfxGameOver() {
  play('deck_ui_side_menu_fly_out.wav', 0.9);
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

/** JACK IN — start game. */
export function sfxJackIn() {
  play('deck_ui_side_menu_fly_in.wav', 1.0);
}
