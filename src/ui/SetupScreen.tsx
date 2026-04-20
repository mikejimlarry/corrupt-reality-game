// src/ui/SetupScreen.tsx
import React, { useState, useRef } from 'react';
import { useGameStore } from '../state/useGameStore';
import { HelpModal } from './HelpModal';
import { AboutModal } from './AboutModal';
import { GlitchTitle } from './GlitchTitle';
import {
  resumeAudio, sfxNavClick, sfxSliderUp, sfxSliderDown,
  sfxToggleOn, sfxToggleOff, sfxShowModal, sfxConnect,
  getMusicEnabled, setMusicEnabled, getMusicTrack, nextMusicTrack,
} from '../lib/audio';

const TRACK_NAMES = ['NEURAL DRIFT', 'AMBIENT BG'] as const;

const LABEL: React.CSSProperties = {
  fontSize: '0.65rem', letterSpacing: 3, color: '#446655', marginBottom: '0.5rem',
};

const SEP: React.CSSProperties = {
  borderBottom: '1px solid #00ffcc11', margin: '0.25rem 0',
};

function SegmentButton({
  active, onClick, children, fontSize = '0.85rem',
}: { active: boolean; onClick: () => void; children: React.ReactNode; fontSize?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '0.4rem',
        background: active ? '#00ffcc22' : 'transparent',
        border: `1px solid ${active ? '#00ffcc' : '#00ffcc33'}`,
        color: active ? '#00ffcc' : '#446655',
        fontFamily: 'monospace', fontSize,
        cursor: 'pointer', letterSpacing: 1,
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
      onClick={() => { resumeAudio(); (checked ? sfxToggleOff : sfxToggleOn)(); onChange(!checked); }}
      style={{
        width: '100%', textAlign: 'left',
        background: checked ? '#00ffcc0a' : 'transparent',
        border: `1px solid ${checked ? '#00ffcc44' : '#00ffcc1a'}`,
        borderRadius: 4, padding: '0.6rem 0.75rem',
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
        <div style={{ fontSize: '0.7rem', color: checked ? '#00ffcc' : '#557766', letterSpacing: 2, marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: '0.6rem', color: '#334455', letterSpacing: 0.5, lineHeight: 1.5 }}>
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
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
}

function OptionsModal({
  onClose,
  hidePpCounts, setHidePpCounts,
  deadMansSwitch, setDeadMansSwitch,
  reducedMotion, setReducedMotion,
}: OptionsModalProps) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(2,4,12,0.96)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 500,
        fontFamily: 'monospace',
      }}
      onClick={onClose}
    >
      <div
        style={{
          border: '1px solid #00ffcc33',
          background: 'rgba(5,10,20,0.98)',
          padding: '2rem 2.5rem',
          maxWidth: 400,
          width: '90%',
          color: '#00ffcc',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: '0.5rem', letterSpacing: 6, color: '#00ffcc44', marginBottom: '0.25rem' }}>
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
          onClick={onClose}
          style={{
            marginTop: '0.5rem',
            width: '100%',
            background: 'transparent',
            border: '1px solid #00ffcc33',
            color: '#446655',
            fontFamily: 'monospace',
            fontSize: '0.65rem', letterSpacing: 3,
            padding: '0.5rem',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = '#00ffcc';
            (e.currentTarget as HTMLElement).style.borderColor = '#00ffcc66';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = '#446655';
            (e.currentTarget as HTMLElement).style.borderColor = '#00ffcc33';
          }}
        >
          CLOSE
        </button>
      </div>
    </div>
  );
}

// ── Setup screen ──────────────────────────────────────────────────────────────

export const SetupScreen: React.FC = () => {
  const startGame = useGameStore(s => s.startGame);
  const [name, setName]                     = useState(() => localStorage.getItem('crg-handle') ?? '');
  const [count, setCount]                   = useState(() => Number(localStorage.getItem('crg-count') ?? '1'));
  const [startingPop, setStartingPop]       = useState(() => Number(localStorage.getItem('crg-credits') ?? '50'));
  const [hidePpCounts, setHidePpCounts]     = useState(() => localStorage.getItem('crg-hide-credits') === 'true');
  const [deadMansSwitch, setDeadMansSwitch] = useState(() => localStorage.getItem('crg-dead-mans-switch') === 'true');
  const [musicOn, setMusicOn]               = useState(() => getMusicEnabled());
  const [musicTrack, setMusicTrack]         = useState(() => getMusicTrack());
  const reducedMotion    = useGameStore(s => s.reducedMotion);
  const setReducedMotion = useGameStore(s => s.setReducedMotion);
  const prevCredits = useRef(startingPop);

  const [showHelp, setShowHelp]       = useState(false);
  const [showAbout, setShowAbout]     = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const handleStart = () => {
    localStorage.setItem('crg-handle', name.trim() || 'Ghost');
    localStorage.setItem('crg-count', String(count));
    localStorage.setItem('crg-credits', String(startingPop));
    localStorage.setItem('crg-hide-credits', String(hidePpCounts));
    localStorage.setItem('crg-dead-mans-switch', String(deadMansSwitch));
    sfxConnect();
    startGame(count + 1, name.trim() || 'Ghost', startingPop, hidePpCounts, deadMansSwitch);
  };

  // Small helper so all meta-buttons share the same look; pass active=true to light it up
  const metaBtn = (onClick: () => void, label: string, active?: boolean) => (
    <button
      onClick={onClick}
      style={{
        flexBasis: '50%',
        maxWidth: 120,
        background: active ? '#00ffcc11' : 'transparent',
        border: `1px solid ${active ? '#00ffcc66' : '#00ffcc33'}`,
        color: active ? '#00ffcc' : '#446655',
        fontFamily: 'monospace', fontSize: '0.65rem',
        letterSpacing: 2, cursor: 'pointer', padding: '0.25rem 0.8rem',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#00ffcc'; (e.currentTarget as HTMLElement).style.borderColor = '#00ffcc66'; }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.color = active ? '#00ffcc' : '#446655';
        (e.currentTarget as HTMLElement).style.borderColor = active ? '#00ffcc66' : '#00ffcc33';
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(5,5,15,0.92)',
      zIndex: 10,
      fontFamily: 'monospace',
      color: '#00ffcc',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
        <GlitchTitle />
      </div>
      <p style={{ color: '#446655', letterSpacing: 4, fontSize: '0.75rem', margin: '0 0 0.75rem' }}>
        A GAME OF SURVIVAL AND CORRUPTION
      </p>

      {/* Meta buttons */}
      <div style={{
        display: 'grid',
        gap: '0.5rem',
        marginBottom: '2rem',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
      }}>
        {metaBtn(() => { resumeAudio(); sfxShowModal(); setShowHelp(true); },    '? HELP')}
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
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.5rem', letterSpacing: 3, color: '#00ffcc33', marginBottom: '0.4rem' }}>
            SOUNDTRACK
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'stretch' }}>
            {TRACK_NAMES.map((name, i) => (
              <SegmentButton
                key={i}
                active={musicTrack === i}
                fontSize='0.6rem'
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

      {showHelp    && <HelpModal    onClose={() => setShowHelp(false)} />}
      {showAbout   && <AboutModal   onClose={() => setShowAbout(false)} />}
      {showOptions && (
        <OptionsModal
          onClose={() => setShowOptions(false)}
          hidePpCounts={hidePpCounts}     setHidePpCounts={setHidePpCounts}
          deadMansSwitch={deadMansSwitch} setDeadMansSwitch={setDeadMansSwitch}
          reducedMotion={reducedMotion}   setReducedMotion={setReducedMotion}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: 300 }}>

        {/* Handle */}
        <input
          type="text"
          placeholder="YOUR HANDLE"
          value={name}
          onChange={e => setName(e.target.value.toUpperCase())}
          style={{
            background: 'transparent',
            border: 'none', borderBottom: '1px solid #00ffcc',
            color: '#00ffcc', fontFamily: 'monospace',
            fontSize: '0.9rem', padding: '0.5rem',
            letterSpacing: 3, outline: 'none',
            textTransform: 'uppercase',
          }}
        />

        {/* Number of AI agents */}
        <div>
          <div style={LABEL}>NUMBER OF AGENTS</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[1, 2, 3].map(n => (
              <SegmentButton key={n} active={count === n} onClick={() => { resumeAudio(); sfxNavClick(); setCount(n); }}>
                {n}
              </SegmentButton>
            ))}
          </div>
        </div>

        <div style={SEP} />

        {/* Starting credits */}
        <div>
          <div style={{ ...LABEL, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span>STARTING CYCLES</span>
            <span style={{ fontSize: '0.85rem', color: '#00ffcc', letterSpacing: 2 }}>{startingPop}</span>
          </div>
          <input
            type="range"
            className="credits-slider"
            min={30}
            max={100}
            step={5}
            value={startingPop}
            onChange={e => {
              const v = Number(e.target.value);
              resumeAudio();
              if (v > prevCredits.current) sfxSliderUp(); else sfxSliderDown();
              prevCredits.current = v;
              setStartingPop(v);
            }}
            style={{
              '--fill': `${((startingPop - 30) / 70) * 100}%`,
            } as React.CSSProperties}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: '#334455', letterSpacing: 1, marginTop: '0.3rem' }}>
            <span>30</span>
            <span style={{ color: startingPop < 45 ? '#446655' : startingPop > 55 ? '#446655' : '#334455' }}>
              {startingPop < 45 ? 'SHORT GAME' : startingPop > 55 ? 'LONG GAME' : 'STANDARD'}
            </span>
            <span>100</span>
          </div>
        </div>

        <div style={SEP} />

        {/* Start */}
        <button
          onClick={handleStart}
          style={{
            padding: '0.75rem',
            background: '#00ffcc11',
            border: '1px solid #00ffcc',
            color: '#00ffcc',
            fontFamily: 'monospace',
            fontSize: '1rem',
            letterSpacing: 4,
            cursor: 'pointer',
          }}
        >
          CONNECT →
        </button>
      </div>
    </div>
  );
};
