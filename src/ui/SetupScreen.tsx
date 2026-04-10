// src/ui/SetupScreen.tsx
import React, { useState } from 'react';
import { useGameStore } from '../state/useGameStore';
import { HelpModal } from './HelpModal';
import { GlitchTitle } from './GlitchTitle';

const LABEL: React.CSSProperties = {
  fontSize: '0.65rem', letterSpacing: 3, color: '#446655', marginBottom: '0.5rem',
};

const SEP: React.CSSProperties = {
  borderBottom: '1px solid #00ffcc11', margin: '0.25rem 0',
};

function SegmentButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '0.4rem',
        background: active ? '#00ffcc22' : 'transparent',
        border: `1px solid ${active ? '#00ffcc' : '#00ffcc33'}`,
        color: active ? '#00ffcc' : '#446655',
        fontFamily: 'monospace', fontSize: '0.85rem',
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
      onClick={() => onChange(!checked)}
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
      {/* Custom checkbox */}
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

export const SetupScreen: React.FC = () => {
  const startGame = useGameStore(s => s.startGame);
  const [name, setName]             = useState(() => localStorage.getItem('crg-handle') ?? '');
  const [count, setCount]           = useState(() => Number(localStorage.getItem('crg-count') ?? '1'));
  const [startingPop, setStartingPop] = useState(() => Number(localStorage.getItem('crg-credits') ?? '50'));
  const [hidePpCounts, setHidePpCounts] = useState(() => localStorage.getItem('crg-hide-credits') === 'true');
  const [deadMansSwitch, setDeadMansSwitch] = useState(() => localStorage.getItem('crg-dead-mans-switch') === 'true');
  const [showHelp, setShowHelp] = useState(false);

  const handleStart = () => {
    localStorage.setItem('crg-handle', name.trim() || 'Ghost');
    localStorage.setItem('crg-count', String(count));
    localStorage.setItem('crg-credits', String(startingPop));
    localStorage.setItem('crg-hide-credits', String(hidePpCounts));
    localStorage.setItem('crg-dead-mans-switch', String(deadMansSwitch));
    startGame(count + 1, name.trim() || 'Ghost', startingPop, hidePpCounts, deadMansSwitch);
  };

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
      <button
        onClick={() => setShowHelp(true)}
        style={{
          background: 'transparent', border: '1px solid #00ffcc33',
          color: '#446655', fontFamily: 'monospace', fontSize: '0.65rem',
          letterSpacing: 2, cursor: 'pointer', padding: '0.25rem 0.8rem',
          transition: 'all 0.15s', marginBottom: '2rem',
        }}
        onMouseEnter={e => { (e.target as HTMLElement).style.color = '#00ffcc'; (e.target as HTMLElement).style.borderColor = '#00ffcc66'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.color = '#446655'; (e.target as HTMLElement).style.borderColor = '#00ffcc33'; }}
      >
        ? HELP
      </button>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

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
              <SegmentButton key={n} active={count === n} onClick={() => setCount(n)}>
                {n}
              </SegmentButton>
            ))}
          </div>
        </div>

        <div style={SEP} />

        {/* Starting credits */}
        <div>
          <div style={{ ...LABEL, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span>STARTING CREDITS</span>
            <span style={{ fontSize: '0.85rem', color: '#00ffcc', letterSpacing: 2 }}>{startingPop}</span>
          </div>
          <input
            type="range"
            className="credits-slider"
            min={30}
            max={100}
            step={5}
            value={startingPop}
            onChange={e => setStartingPop(Number(e.target.value))}
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

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Toggle
            checked={hidePpCounts}
            onChange={setHidePpCounts}
            label="HIDE CREDITS"
            description="Exact credit totals are hidden — judge your rivals by the bar alone."
          />
          <Toggle
            checked={deadMansSwitch}
            onChange={setDeadMansSwitch}
            label="DEAD MAN'S SWITCH"
            description="An eliminated player may play one last negative card before they fall."
          />
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
          JACK IN →
        </button>
      </div>
    </div>
  );
};
