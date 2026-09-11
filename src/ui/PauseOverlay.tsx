// src/ui/PauseOverlay.tsx
// Full-screen "SYSTEM HALTED" overlay shown when the game is paused.
import React from 'react';
import { useGameStore } from '../state/useGameStore';
import { OverlayShell } from './OverlayShell';

const BLINK_CSS = `
@keyframes halt-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
@keyframes halt-scan {
  0%   { transform: translateY(-100vh); }
  100% { transform: translateY(100vh); }
}
.halt-blink { animation: halt-blink 1.1s step-start infinite; }
`;

export const PauseOverlay: React.FC = () => {
  const paused      = useGameStore(s => s.paused);
  const togglePause = useGameStore(s => s.togglePause);

  if (!paused) return null;

  return (
    <>
      <style>{BLINK_CSS}</style>
      <OverlayShell
        ariaLabel="Game paused"
        background="rgba(5, 2, 0, 0.92)"
        zIndex={300}
        maxWidth={560}
        onBackdropClick={togglePause}
        onRequestClose={togglePause}
        panelStyle={{ overflow: 'hidden', textAlign: 'center', color: '#ff8800', padding: '32px 20px' }}
      >
        {/* Scanline */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 2, pointerEvents: 'none',
          background: 'linear-gradient(to right, transparent, color-mix(in srgb, var(--crg-conflict) 18%, transparent), transparent)',
          animation: 'halt-scan 5s linear infinite',
        }} />

        {/* Orange vignette */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          boxShadow: 'inset 0 0 100px 30px rgba(200,80,0,0.18)',
        }} />

        {/* Content */}
        <div style={{ textAlign: 'center', zIndex: 1, position: 'relative' }}>
          <div style={{
            fontSize: '0.75rem', letterSpacing: 6,
            color: 'var(--crg-conflict)', marginBottom: '1rem',
          }}>
            ⚠ EXECUTION SUSPENDED ⚠
          </div>

          <div style={{
            fontSize: '3rem', fontWeight: 'bold', letterSpacing: 12,
            color: 'var(--crg-conflict)',
            textShadow: '0 0 40px rgba(255,153,0,0.6), 0 0 80px rgba(255,153,0,0.3)',
          }}>
            SYSTEM
          </div>
          <div style={{
            fontSize: '3rem', fontWeight: 'bold', letterSpacing: 12,
            color: 'var(--crg-conflict)',
            textShadow: '0 0 40px rgba(255,153,0,0.6), 0 0 80px rgba(255,153,0,0.3)',
            marginBottom: '1.5rem',
          }}>
            HALTED
          </div>

          <button
            type="button"
            onClick={togglePause}
            className="crg-btn-orange halt-blink"
            style={{
              minHeight: 48,
              minWidth: 220,
              padding: '12px 20px',
              background: 'transparent',
              border: '1px solid var(--crg-conflict)',
              color: 'var(--crg-conflict)',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              letterSpacing: 4,
              cursor: 'pointer',
            }}
          >
            RESUME SYSTEM
          </button>

          <div style={{
            marginTop: '2rem',
            fontSize: '0.75rem', letterSpacing: 3,
            color: 'var(--crg-muted)',
          }}>
            ALL AI PROCESSES PAUSED
          </div>
        </div>
      </OverlayShell>
    </>
  );
};
