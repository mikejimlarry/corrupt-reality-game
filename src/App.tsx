// src/App.tsx
import { useEffect } from 'react';
import { createGame, destroyGame } from './game';
import { useGameStore } from './state/useGameStore';
import { SetupScreen } from './ui/SetupScreen';
import { HUD } from './ui/HUD';
import { DeadMansSwitchOverlay } from './ui/DeadMansSwitchOverlay';
import { DaemonStealOverlay } from './ui/DaemonStealOverlay';
import { WarPickOverlay } from './ui/WarPickOverlay';
import { WarPreOverlay } from './ui/WarPreOverlay';
import { CounterOpportunityOverlay } from './ui/CounterOpportunityOverlay';
import { PauseOverlay } from './ui/PauseOverlay';
import { GameOverScreen } from './ui/GameOverScreen';
import { CardPreview } from './ui/CardPreview';
import { useGameAudio } from './hooks/useGameAudio';
import { resumeAudio, stopMusic } from './lib/audio';
import { trackEvent } from './lib/analytics';

const AMBIENT_STYLE = `
@keyframes game-scan {
  0%   { transform: translateY(-100vh); }
  100% { transform: translateY(100vh); }
}
`;

function App() {
  const phase      = useGameStore(s => s.phase);
  const corruption = useGameStore(s => s.globalCorruptionMode);
  const active     = phase !== 'SETUP' && phase !== 'GAME_OVER';
  const winnerId   = useGameStore(s => s.winnerId);
  const players    = useGameStore(s => s.players);
  const turnNumber = useGameStore(s => s.turnNumber);

  useGameAudio();


  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = AMBIENT_STYLE;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);

  useEffect(() => {
    createGame();
    return () => destroyGame();
  }, []);

  // Resume AudioContext + start music on first user gesture (browser autoplay policy)
  useEffect(() => {
    const handler = () => resumeAudio(); // also calls startMusic() internally
    window.addEventListener('pointerdown', handler, { once: true });
    return () => window.removeEventListener('pointerdown', handler);
  }, []);

  // Stop music when the game ends or returns to setup; fire game_over event
  useEffect(() => {
    if (phase === 'GAME_OVER') {
      stopMusic();
      const winner = players.find(p => p.id === winnerId);
      trackEvent('game_over', {
        outcome: winner?.isHuman ? 'human_wins' : 'ai_wins',
        winner_name: winner?.name ?? 'unknown',
        turns: turnNumber,
      });
    } else if (phase === 'SETUP') {
      stopMusic();
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track PWA install
  useEffect(() => {
    const handler = () => trackEvent('pwa_installed');
    window.addEventListener('appinstalled', handler);
    return () => window.removeEventListener('appinstalled', handler);
  }, []);


  const scanColor = corruption ? 'rgba(255,30,60,0.07)' : 'rgba(0,255,204,0.045)';

  return (
    <>
      {/* Phaser canvas mounts here */}
      <div id="phaser-container" style={{ position: 'fixed', inset: 0 }} />

      {/* Corruption vignette — red border bleeds in from the edges */}
      {corruption && (
        <div
          style={{
            position: 'fixed', inset: 0,
            pointerEvents: 'none', zIndex: 1,
            boxShadow: 'inset 0 0 120px 40px rgba(200,0,30,0.35)',
            transition: 'opacity 1.2s ease',
          }}
        />
      )}

      {/* Ambient scanline sweep — visible during active gameplay only */}
      {active && (
        <div style={{
          position: 'fixed', inset: 0,
          pointerEvents: 'none', zIndex: 2,
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', left: 0, right: 0,
            height: 2,
            background: `linear-gradient(to right, transparent, ${scanColor}, ${scanColor}, transparent)`,
            animation: 'game-scan 6s linear infinite',
          }} />
          <div style={{
            position: 'absolute', left: 0, right: 0,
            height: 1,
            background: `linear-gradient(to right, transparent, ${scanColor}, transparent)`,
            animation: 'game-scan 9s linear infinite',
            animationDelay: '-4s',
          }} />
        </div>
      )}

      {/* React UI overlays */}
      {phase === 'SETUP' && <SetupScreen />}
      {phase !== 'SETUP' && phase !== 'GAME_OVER' && <HUD />}
      {phase === 'GAME_OVER' && <GameOverScreen />}
      <DeadMansSwitchOverlay />
      <DaemonStealOverlay />
      <WarPickOverlay />
      <WarPreOverlay />
      <CounterOpportunityOverlay />
      <PauseOverlay />
      <CardPreview />
    </>
  );
}

export default App;
