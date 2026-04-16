// src/ui/PauseOverlay.tsx
// Full-screen "SYSTEM HALTED" overlay shown when the game is paused.
import React from 'react';
import { useGameStore } from '../state/useGameStore';

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
      <div
        style={{
          position: 'fixed', inset: 0,
          zIndex: 300,
          background: 'rgba(5, 2, 0, 0.92)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: 'monospace',
          cursor: 'pointer',
          overflow: 'hidden',
        }}
        onClick={togglePause}
      >
        {/* Scanline */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 2, pointerEvents: 'none',
          background: 'linear-gradient(to right, transparent, rgba(255,153,0,0.18), transparent)',
          animation: 'halt-scan 5s linear infinite',
        }} />

        {/* Orange vignette */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          boxShadow: 'inset 0 0 100px 30px rgba(200,80,0,0.18)',
        }} />

        {/* Content */}
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <div style={{
            fontSize: '0.55rem', letterSpacing: 8,
            color: '#ff9900aa', marginBottom: '1rem',
          }}>
            ⚠ EXECUTION SUSPENDED ⚠
          </div>

          <div style={{
            fontSize: '3rem', fontWeight: 'bold', letterSpacing: 12,
            color: '#ff9900',
            textShadow: '0 0 40px rgba(255,153,0,0.6), 0 0 80px rgba(255,153,0,0.3)',
          }}>
            SYSTEM
          </div>
          <div style={{
            fontSize: '3rem', fontWeight: 'bold', letterSpacing: 12,
            color: '#ff9900',
            textShadow: '0 0 40px rgba(255,153,0,0.6), 0 0 80px rgba(255,153,0,0.3)',
            marginBottom: '1.5rem',
          }}>
            HALTED
          </div>

          <div className="halt-blink" style={{
            fontSize: '0.7rem', letterSpacing: 4,
            color: '#ff9900bb',
          }}>
            CLICK ANYWHERE TO RESUME
          </div>

          <div style={{
            marginTop: '2rem',
            fontSize: '0.5rem', letterSpacing: 3,
            color: '#ff990044',
          }}>
            ALL AI PROCESSES PAUSED
          </div>
        </div>
      </div>
    </>
  );
};
