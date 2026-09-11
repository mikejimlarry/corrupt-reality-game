// src/ui/SetupScreen.tsx
import React, { Suspense, lazy, useEffect, useState, useRef, useCallback } from 'react';
import { safeStorage } from '../lib/storage';

// Show boot sequence once per page load; flag persists across re-renders
let _bootSeen = false;

const BOOT_LINES = [
  'INITIALIZING CORRUPT_REALITY v2.7..',
  'LOADING CARD PROTOCOLS.................. [OK]',
  'MOUNTING DAEMON REGISTRY................ [OK]',
  'VERIFYING ENTROPY SEED.................. [OK]',
  'ESTABLISHING NEURAL LINK................ [OK]',
  '> SYSTEM READY.',
];

const BOOT_CSS = `
@keyframes boot-line-in {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: none; }
}
.boot-line { animation: boot-line-in 0.12s ease both; }
@keyframes boot-fade-out {
  to { opacity: 0; }
}
.boot-fading { animation: boot-fade-out 0.7s ease forwards; }
`;

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
type Difficulty = typeof DIFFICULTIES[number];

function readStoredDifficulty(): Difficulty {
  const value = safeStorage.get('crg-difficulty');
  return DIFFICULTIES.includes(value as Difficulty) ? value as Difficulty : 'MEDIUM';
}

function useHover() {
  const [hovered, setHovered] = useState(false);
  return {
    hovered,
    onMouseEnter: useCallback(() => setHovered(true),  []),
    onMouseLeave: useCallback(() => setHovered(false), []),
  };
}
import { useGameStore } from '../state/useGameStore';
import { OverlayShell } from './OverlayShell';
import { GlitchTitle } from './GlitchTitle';
import {
  resumeAudio, sfxNavClick, sfxSliderUp, sfxSliderDown,
  sfxToggleOn, sfxToggleOff, sfxShowModal, sfxConnect,
  getMusicEnabled, setMusicEnabled, getMusicTrack, nextMusicTrack,
} from '../lib/audio';
import { trackEvent } from '../lib/analytics';

const TRACK_NAMES = ['NEURAL DRIFT', 'AMBIENT BG'] as const;
const HelpModal = lazy(() => import('./HelpModal').then(module => ({ default: module.HelpModal })));
const AboutModal = lazy(() => import('./AboutModal').then(module => ({ default: module.AboutModal })));

const LABEL: React.CSSProperties = {
  fontSize: '0.75rem', letterSpacing: 3, color: 'var(--crg-muted)', marginBottom: '0.5rem',
};

const SEP: React.CSSProperties = {
  borderBottom: '1px solid #00ffcc11', margin: '0.25rem 0',
};

function SegmentButton({
  active, onClick, children, fontSize = '0.9rem', disabled = false,
}: { active: boolean; onClick: () => void; children: React.ReactNode; fontSize?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className="crg-btn-cyan"
      style={{
        flex: 1, padding: '0.4rem',
        background: active ? '#00ffcc22' : 'transparent',
        border: `1px solid ${active ? '#00ffcc' : '#00ffcc33'}`,
        color: active ? 'var(--crg-signal)' : 'var(--crg-muted)',
        fontFamily: 'monospace', fontSize,
        cursor: disabled ? 'not-allowed' : 'pointer', letterSpacing: 1,
        minHeight: 44,
        opacity: disabled ? 0.45 : 1,
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function Toggle({
  checked, onChange, label, description,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; description: string }) {
  return (
    <button
      type="button"
      onClick={() => { resumeAudio(); (checked ? sfxToggleOff : sfxToggleOn)(); onChange(!checked); }}
      aria-pressed={checked}
      style={{
        width: '100%', textAlign: 'left',
        background: checked ? '#00ffcc0a' : 'transparent',
        border: `1px solid ${checked ? '#00ffcc44' : '#00ffcc1a'}`,
        borderRadius: 4, padding: '0.6rem 0.75rem', minHeight: 44,
        cursor: 'pointer', fontFamily: 'monospace',
        display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
        transition: 'all 0.15s',
      }}
    >
      <span style={{
        flexShrink: 0, marginTop: 2,
        width: 12, height: 12,
        border: `1px solid ${checked ? '#00ffcc' : '#00ffcc44'}`,
        background: checked ? '#00ffcc33' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, color: '#00ffcc',
      }}>
        {checked ? '✓' : ''}
      </span>
      <span>
        <div style={{ fontSize: '0.75rem', color: checked ? 'var(--crg-signal)' : 'var(--crg-text)', letterSpacing: 2, marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--crg-body)', letterSpacing: 0.5, lineHeight: 1.5 }}>
          {description}
        </div>
      </span>
    </button>
  );
}

// ── Options modal ─────────────────────────────────────────────────────────────

interface OptionsModalProps {
  onClose: () => void;
  hidePpCounts: boolean;
  setHidePpCounts: (v: boolean) => void;
  deadMansSwitch: boolean;
  setDeadMansSwitch: (v: boolean) => void;
  warTiePenalty: boolean;
  setWarTiePenalty: (v: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
}

const OPTIONS_ANIM_CSS = `
@keyframes opt-unfold {
  0%   { transform: scaleY(0) scaleX(0.04); opacity: 0; }
  40%  { transform: scaleY(1) scaleX(0.04); opacity: 1; }
  100% { transform: scaleY(1) scaleX(1);    opacity: 1; }
}
@keyframes opt-fold {
  0%   { transform: scaleY(1) scaleX(1);    opacity: 1; }
  55%  { transform: scaleY(1) scaleX(0.04); opacity: 1; }
  100% { transform: scaleY(0) scaleX(0.04); opacity: 0; }
}
@keyframes opt-in  { from { opacity: 0 } to { opacity: 1 } }
@keyframes opt-out { from { opacity: 1 } to { opacity: 0 } }
@keyframes opt-bd-in  { from { opacity: 0 } to { opacity: 1 } }
@keyframes opt-bd-out { from { opacity: 1 } to { opacity: 0 } }
.opt-unfold   { animation: opt-unfold  0.38s cubic-bezier(0.22, 1, 0.36, 1) both; transform-origin: center center; }
.opt-fold     { animation: opt-fold    0.28s cubic-bezier(0.55, 0, 1, 0.45) both; transform-origin: center center; }
.opt-in       { animation: opt-in      0.14s 0.32s ease both; }
.opt-out      { animation: opt-out     0.08s ease both; }
.opt-bd-in    { animation: opt-bd-in   0.22s ease both; }
.opt-bd-out   { animation: opt-bd-out  0.28s ease both; }
`;

function OptionsModal({
  onClose,
  hidePpCounts, setHidePpCounts,
  deadMansSwitch, setDeadMansSwitch,
  warTiePenalty, setWarTiePenalty,
  reducedMotion, setReducedMotion,
}: OptionsModalProps) {
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    if (reducedMotion) {
      onClose();
      return;
    }
    setClosing(true);
    setTimeout(onClose, 300);
  }, [onClose, reducedMotion]);

  return (
    <>
      <style>{OPTIONS_ANIM_CSS}</style>
      <OverlayShell
        ariaLabel="Game options"
        background="rgba(2,4,12,0.96)"
        zIndex={500}
        maxWidth={400}
        onBackdropClick={handleClose}
        onRequestClose={handleClose}
        panelClassName={closing ? 'opt-fold opt-bd-out' : 'opt-unfold opt-bd-in'}
        panelStyle={{
            border: '1px solid #00ffcc33',
            background: 'rgba(5,10,20,0.98)',
            padding: '2rem 2.5rem',
            color: '#00ffcc',
        }}
      >
          <div className={closing ? 'opt-out' : 'opt-in'} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.75rem', letterSpacing: 6, color: 'var(--crg-muted)', marginBottom: '0.25rem' }}>
              SYSTEM CONFIG
            </div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem', letterSpacing: 4, color: '#00ffcc' }}>
              OPTIONS
            </h2>

            <Toggle
              checked={deadMansSwitch}
              onChange={v => setDeadMansSwitch(v)}
              label="DEAD MAN'S SWITCH"
              description="An eliminated player may play one last protocol card before they fall."
            />
            <Toggle
              checked={warTiePenalty}
              onChange={v => setWarTiePenalty(v)}
              label="WAR TIE PENALTY"
              description="Tied war rolls cost both combatants the winner's cycle amount instead of nothing."
            />
            <Toggle
              checked={hidePpCounts}
              onChange={v => setHidePpCounts(v)}
              label="HIDE CYCLES"
              description="Exact cycle totals are hidden — judge your rivals by the bar alone."
            />
            <Toggle
              checked={reducedMotion}
              onChange={v => setReducedMotion(v)}
              label="REDUCE ANIMATIONS"
              description="Disables card art tweens, scanlines, and panel wipe animations."
            />

            <button
              type="button"
              onClick={handleClose}
              style={{
                marginTop: '0.5rem',
                width: '100%',
                background: 'transparent',
                border: '1px solid #00ffcc33',
                color: 'var(--crg-muted)',
                fontFamily: 'monospace',
                fontSize: '0.75rem', letterSpacing: 3,
                padding: '0.5rem', minHeight: 44,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              className="crg-btn-cyan"
            >
              CLOSE
            </button>
          </div>
      </OverlayShell>
    </>
  );
}

// ── Setup screen ──────────────────────────────────────────────────────────────

export const SetupScreen: React.FC = () => {
  const startGame      = useGameStore(s => s.startGame);
  const startTutorial  = useGameStore(s => s.startTutorial);
  const reducedMotion  = useGameStore(s => s.reducedMotion);
  const setReducedMotion = useGameStore(s => s.setReducedMotion);

  // ── Boot sequence (all hooks must precede any early return) ─────────────────
  const [bootDone,   setBootDone]   = useState(() => _bootSeen || reducedMotion);
  const [bootLines,  setBootLines]  = useState<number[]>([]);
  const [bootFading, setBootFading] = useState(false);

  const skipBoot = useCallback(() => {
    _bootSeen = true;
    setBootFading(false);
    setBootDone(true);
  }, []);

  useEffect(() => {
    if (bootDone) return;
    const LINE_DELAY = 480;   // ms between each line appearing
    const HOLD      = 1400;   // ms to hold after last line before fading
    const FADE      = 700;    // ms fade-out duration (matches CSS transition)
    const timers: ReturnType<typeof setTimeout>[] = [];
    BOOT_LINES.forEach((_, i) => {
      timers.push(setTimeout(() => setBootLines(prev => [...prev, i]), i * LINE_DELAY + 200));
    });
    const allIn = BOOT_LINES.length * LINE_DELAY + 200;
    timers.push(setTimeout(() => setBootFading(true), allIn + HOLD));
    timers.push(setTimeout(() => { _bootSeen = true; setBootDone(true); }, allIn + HOLD + FADE));
    const onKey = () => skipBoot();
    window.addEventListener('keydown', onKey, { once: true });
    return () => { timers.forEach(clearTimeout); window.removeEventListener('keydown', onKey); };
  }, [bootDone, skipBoot]);

  // ── Normal setup state ──────────────────────────────────────────────────────
  const [name, setName]                     = useState(() => safeStorage.get('crg-handle'));
  const [nameFocused, setNameFocused]       = useState(false);
  const [count, setCount]                   = useState(() => safeStorage.getInteger('crg-count', 1, 1, 4));
  const [startingPop, setStartingPop]       = useState(() => safeStorage.getInteger('crg-cycles', 50, 30, 100, 5));
  const [hidePpCounts, setHidePpCounts]     = useState(() => safeStorage.get('crg-hide-cycles') === 'true');
  const [deadMansSwitch, setDeadMansSwitch] = useState(() => safeStorage.get('crg-dead-mans-switch') === 'true');
  const [warTiePenalty, setWarTiePenalty]   = useState(() => safeStorage.get('crg-war-tie-penalty') === 'true');
  const [difficulty, setDifficulty]         = useState<Difficulty>(readStoredDifficulty);
  const [musicOn, setMusicOn]               = useState(() => getMusicEnabled());
  const [musicTrack, setMusicTrack]         = useState(() => getMusicTrack());
  const prevCycles = useRef(startingPop);

  const isPortraitViewport = () => window.innerWidth < window.innerHeight;
  const [portraitViewport, setPortraitViewport] = useState(isPortraitViewport);
  useEffect(() => {
    const check = () => setPortraitViewport(isPortraitViewport());
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  const portraitPlayerLimitReached = portraitViewport && count > 1;
  const hConnect = useHover();

  const [showHelp, setShowHelp]       = useState(false);
  const [showAbout, setShowAbout]     = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    trackEvent('game_setup_started');
  }, []);

  const handleStart = () => {
    if (portraitPlayerLimitReached) return;
    safeStorage.set('crg-handle', name.trim() || 'Ghost');
    safeStorage.set('crg-count', String(count));
    safeStorage.set('crg-cycles', String(startingPop));
    safeStorage.set('crg-hide-cycles', String(hidePpCounts));
    safeStorage.set('crg-dead-mans-switch', String(deadMansSwitch));
    safeStorage.set('crg-war-tie-penalty', String(warTiePenalty));
    safeStorage.set('crg-difficulty', difficulty);
    trackEvent('game_start', { player_count: count + 1, starting_cycles: startingPop, difficulty });
    sfxConnect();
    startGame(count + 1, name.trim() || 'Ghost', startingPop, hidePpCounts, deadMansSwitch, warTiePenalty, undefined, difficulty);
  };

  // Small helper so all meta-buttons share the same look; pass active=true to light it up
  const metaBtn = (onClick: () => void, label: string, active?: boolean) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active === undefined ? undefined : active}
      style={{
        flexBasis: '50%',
        maxWidth: 120,
        background: active ? '#00ffcc11' : 'transparent',
        border: `1px solid ${active ? '#00ffcc66' : '#00ffcc33'}`,
        color: active ? 'var(--crg-signal)' : 'var(--crg-muted)',
        fontFamily: 'monospace', fontSize: '0.75rem',
        letterSpacing: 2, cursor: 'pointer', padding: '0.25rem 0.8rem', minHeight: 44,
        transition: 'all 0.15s',
      }}
      className="crg-btn-cyan"
    >
      {label}
    </button>
  );

  return (
    <>
    {/* Boot overlay — sits above setup screen so there's no flash on exit */}
    {!bootDone && (
      <>
        <style>{BOOT_CSS}</style>
        <div
          role="status"
          aria-label="System boot sequence"
          className={bootFading ? 'boot-fading' : ''}
          style={{
            position: 'fixed', inset: 0,
            background: '#0a0a0f',
            display: 'flex', flexDirection: 'column',
            justifyContent: 'flex-start',
            padding: '3rem 3.5rem',
            fontFamily: 'monospace',
            zIndex: 20,
            cursor: 'default',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {bootLines.map(i => (
              <div
                key={i}
                className="boot-line"
                style={{
                  fontSize: '0.72rem',
                  letterSpacing: 1.5,
                  color: i === BOOT_LINES.length - 1 ? '#00ffcc' : 'var(--crg-body)',
                  fontWeight: i === BOOT_LINES.length - 1 ? 'bold' : 'normal',
                }}
              >
                {BOOT_LINES[i]}
              </div>
            ))}
          </div>
          <button type="button" onClick={skipBoot} style={{
            position: 'absolute', bottom: '1.5rem', right: '2rem',
            fontSize: '0.75rem', color: 'var(--crg-muted)', letterSpacing: 2,
            minHeight: 44, padding: '0.5rem 0.75rem', cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--crg-muted)',
            fontFamily: 'monospace',
          }}>
            SKIP BOOT · ANY KEY
          </button>
        </div>
      </>
    )}

    {/* Setup screen — always in DOM, visible under/after boot overlay */}
    <div className="crg-setup-screen" style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(5,5,15,0.78)',
      zIndex: 10,
      fontFamily: 'monospace',
      color: '#00ffcc',
    }}>
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        flexShrink: 0,
      }}>
      <div className="crg-setup-title" style={{ textAlign: 'center', marginBottom: '0.25rem', maxWidth: '90vw', flexShrink: 0 }}>
        <GlitchTitle />
      </div>
      <p className="crg-setup-subtitle" style={{
        color: 'var(--crg-muted)',
        letterSpacing: 4,
        fontSize: '0.75rem',
        margin: '0 0 0.75rem',
        textAlign: 'center',
        maxWidth: '90vw',
        lineHeight: 1.8,
      }}>
        A GAME OF SURVIVAL AND CORRUPTION
      </p>

      {/* Meta buttons */}
      <div className="crg-setup-meta" style={{
        display: 'grid',
        gap: '0.5rem',
        marginBottom: '2rem',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
      }}>
        {metaBtn(() => { resumeAudio(); sfxShowModal(); setShowHelp(true); trackEvent('help_opened', { source: 'setup' }); }, '? HELP')}
        {metaBtn(() => { resumeAudio(); sfxShowModal(); setShowOptions(true); }, '⚙ OPTIONS')}
        {metaBtn(() => { resumeAudio(); sfxShowModal(); setShowAbout(true); },   'i ABOUT')}
        {metaBtn(() => {
          resumeAudio();
          const next = !musicOn;
          (next ? sfxToggleOn : sfxToggleOff)();
          setMusicOn(next);
          setMusicEnabled(next);
        }, '♫ MUSIC', musicOn)}
      </div>

      {/* Track selector — visible when music is on */}
      {musicOn && (
        <div className="crg-setup-track" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', letterSpacing: 3, color: 'var(--crg-muted)', marginBottom: '0.4rem' }}>
            SOUNDTRACK
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'stretch' }}>
            {TRACK_NAMES.map((name, i) => (
              <SegmentButton
                key={i}
                active={musicTrack === i}
                fontSize='0.75rem'
                onClick={() => {
                  if (musicTrack !== i) {
                    resumeAudio();
                    nextMusicTrack();
                    setMusicTrack(i);
                  }
                }}
              >
                {i === 0 ? '①' : '②'} {name}
              </SegmentButton>
            ))}
          </div>
        </div>
      )}

      <Suspense fallback={<div className="sr-only" role="status">Loading dialog…</div>}>
        {showHelp    && <HelpModal    onClose={() => setShowHelp(false)} />}
        {showAbout   && <AboutModal   onClose={() => setShowAbout(false)} />}
      </Suspense>
      {showOptions && (
        <OptionsModal
          onClose={() => setShowOptions(false)}
          hidePpCounts={hidePpCounts}     setHidePpCounts={setHidePpCounts}
          deadMansSwitch={deadMansSwitch} setDeadMansSwitch={setDeadMansSwitch}
          warTiePenalty={warTiePenalty}   setWarTiePenalty={setWarTiePenalty}
          reducedMotion={reducedMotion}   setReducedMotion={setReducedMotion}
        />
      )}

      <div className="crg-setup-form" style={{
        display: 'flex', flexDirection: 'column', gap: '1rem',
        width: 'min(300px, calc(100vw - 24px))', flexShrink: 0,
      }}>

        {/* Handle */}
        <style>{`@keyframes crg-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }`}</style>
        <div style={{
          display: 'flex', alignItems: 'center',
          borderBottom: '1px solid #00ffcc',
          padding: '0.5rem 0.5rem 0.5rem 0',
        }}>
          <span style={{ color: '#00ffcc', fontFamily: 'monospace', fontSize: '0.9rem', marginRight: 6 }}>{'>'}</span>
          {/* Mirror + cursor: the invisible mirror span sizes itself to the typed text,
              the blinking _ sits immediately after it, the real input overlays everything. */}
          <div style={{
            position: 'relative', flex: 1, display: 'flex', alignItems: 'center',
            minHeight: 44,
          }}>
            <label className="sr-only" htmlFor="crg-handle">Operator handle</label>
            <span style={{
              visibility: 'hidden', whiteSpace: 'pre',
              fontFamily: 'monospace', fontSize: '0.9rem', letterSpacing: 3,
              pointerEvents: 'none',
            }}>{name}</span>
            {nameFocused && (
              <span style={{
                color: '#00ffcc', fontFamily: 'monospace', fontSize: '0.9rem',
                animation: 'crg-blink 1s step-end infinite', lineHeight: 1,
                pointerEvents: 'none',
              }}>_</span>
            )}
            {name === '' && (
              <span style={{
                position: 'absolute', left: 0, pointerEvents: 'none',
                fontFamily: 'monospace', fontSize: '0.9rem', letterSpacing: 3,
                color: 'var(--crg-muted)',
              }}>YOUR HANDLE</span>
            )}
            <input
              id="crg-handle"
              type="text"
              aria-describedby="crg-handle-hint"
              autoComplete="nickname"
              value={name}
              onChange={e => setName(e.target.value.toUpperCase())}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                background: 'transparent', border: 'none', outline: 'none',
                color: '#00ffcc', fontFamily: 'monospace', fontSize: '0.9rem',
                letterSpacing: 3, caretColor: 'transparent',
                textTransform: 'uppercase', padding: 0, lineHeight: '1.4rem',
              }}
            />
            <span id="crg-handle-hint" className="sr-only">Shown as your player name. Defaults to Ghost.</span>
          </div>
        </div>

        {/* Number of AI agents */}
        <div>
          <div style={{ ...LABEL, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span id="opponent-count-label">AI OPPONENTS</span>
            {portraitViewport && <span style={{ fontSize: '0.75rem', color: 'var(--crg-muted)', letterSpacing: 1 }}>1V1 IN PORTRAIT</span>}
          </div>
          <div role="group" aria-labelledby="opponent-count-label" style={{ display: 'flex', gap: '0.5rem' }}>
            {[1, 2, 3, 4].map(n => (
              <SegmentButton
                key={n}
                active={count === n}
                disabled={portraitViewport && n > 1}
                onClick={() => { resumeAudio(); sfxNavClick(); setCount(n); }}
              >
                {n}
              </SegmentButton>
            ))}
          </div>
          {portraitPlayerLimitReached && (
            <p role="status" style={{ margin: '0.5rem 0 0', color: 'var(--crg-text)', fontSize: '0.75rem', lineHeight: 1.5 }}>
              Rotate to landscape to connect with {count} AI opponents. Your selection is preserved.
            </p>
          )}
        </div>

        {/* Difficulty */}
        <div>
          <div id="difficulty-label" style={LABEL}>DIFFICULTY</div>
          <div role="group" aria-labelledby="difficulty-label" style={{ display: 'flex', gap: '0.5rem' }}>
            {(['EASY', 'MEDIUM', 'HARD'] as const).map(d => (
              <SegmentButton key={d} active={difficulty === d} onClick={() => { resumeAudio(); sfxNavClick(); setDifficulty(d); }}>
                {d}
              </SegmentButton>
            ))}
          </div>
        </div>

        <div style={SEP} />

        {/* Starting cycles */}
        <div>
          <div style={{ ...LABEL, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <label htmlFor="starting-cycles">STARTING CYCLES</label>
            <span style={{ fontSize: '0.9rem', color: '#00ffcc', letterSpacing: 2 }}>{startingPop}</span>
          </div>
          <input
            id="starting-cycles"
            type="range"
            className="cycles-slider"
            min={30}
            max={100}
            step={5}
            value={startingPop}
            onChange={e => {
              const v = Number(e.target.value);
              resumeAudio();
              if (v > prevCycles.current) sfxSliderUp(); else sfxSliderDown();
              prevCycles.current = v;
              setStartingPop(v);
            }}
            style={{
              '--fill': `${((startingPop - 30) / 70) * 100}%`,
            } as React.CSSProperties}
          />
          <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--crg-muted)', letterSpacing: 1, marginTop: '0.3rem' }}>
            <span>30</span>
            <span style={{ color: 'var(--crg-muted)' }}>
              {startingPop < 45 ? 'SHORT GAME' : startingPop > 55 ? 'LONG GAME' : 'STANDARD'}
            </span>
            <span>100</span>
          </div>
        </div>

        <div style={SEP} />

        {/* Start */}
        <button
          type="button"
          onClick={handleStart}
          disabled={portraitPlayerLimitReached}
          aria-describedby={portraitPlayerLimitReached ? 'connect-requirement' : undefined}
          onMouseEnter={hConnect.onMouseEnter}
          onMouseLeave={hConnect.onMouseLeave}
          style={{
            padding: '0.75rem',
            background: hConnect.hovered ? '#00ffcc22' : '#00ffcc11',
            border: '1px solid #00ffcc',
            color: '#00ffcc',
            fontFamily: 'monospace',
            fontSize: '1rem',
            letterSpacing: 4,
            cursor: portraitPlayerLimitReached ? 'not-allowed' : 'pointer',
            opacity: portraitPlayerLimitReached ? 0.5 : 1,
            minHeight: 48,
            boxShadow: hConnect.hovered ? '0 0 18px #00ffcc33' : 'none',
            transition: 'all 0.15s',
          }}
        >
          CONNECT →
        </button>
        {portraitPlayerLimitReached && <span id="connect-requirement" className="sr-only">Rotate to landscape before connecting with more than one AI opponent.</span>}

        {/* Tutorial */}
        <button
          type="button"
          onClick={() => {
            resumeAudio();
            sfxNavClick();
            startTutorial(name.trim() || 'Ghost');
          }}
          style={{
            padding: '0.5rem',
            background: 'transparent',
            border: '1px solid #00ffcc33',
            color: 'var(--crg-muted)',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            letterSpacing: 3,
            cursor: 'pointer',
            transition: 'all 0.15s', minHeight: 44,
          }}
          className="crg-btn-cyan"
        >
          ▷ TUTORIAL
        </button>
      </div>
      </div>
    </div>
    </>
  );
};
