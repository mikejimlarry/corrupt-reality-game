// src/App.tsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGameStore } from './state/useGameStore';
import { SetupScreen } from './ui/SetupScreen';
import { HUD } from './ui/HUD';
import { DeadMansSwitchOverlay } from './ui/DeadMansSwitchOverlay';
import { DaemonStealOverlay } from './ui/DaemonStealOverlay';
import { WarLootOverlay } from './ui/WarLootOverlay';
import { WarPickOverlay } from './ui/WarPickOverlay';
import { WarPreOverlay } from './ui/WarPreOverlay';
import { CounterOpportunityOverlay } from './ui/CounterOpportunityOverlay';
import { PauseOverlay } from './ui/PauseOverlay';
import { GameOverScreen } from './ui/GameOverScreen';
import { UpdateBanner } from './ui/UpdateBanner';
import { TutorialOverlay } from './ui/TutorialOverlay';
import { WarResultOverlay } from './ui/WarResultOverlay';
import { useGameAudio } from './hooks/useGameAudio';
import { listenForAudioUnlock, stopMusic, sfxHover } from './lib/audio';
import { trackEvent } from './lib/analytics';

const AMBIENT_STYLE = `
@keyframes game-scan {
  0%   { transform: translateY(-100vh); }
  100% { transform: translateY(100vh); }
}
`;

type GameRuntime = typeof import('./game');
let gameRuntimePromise: Promise<GameRuntime> | null = null;
const loadGameRuntime = () => {
  gameRuntimePromise ??= import('./game');
  return gameRuntimePromise;
};

function App() {
  const phase      = useGameStore(s => s.phase);
  const corruption = useGameStore(s => s.globalCorruptionMode);
  const active     = phase !== 'SETUP' && phase !== 'GAME_OVER';
  const winnerId   = useGameStore(s => s.winnerId);
  const players    = useGameStore(s => s.players);
  const turnNumber = useGameStore(s => s.turnNumber);
  const reducedMotion = useGameStore(s => s.reducedMotion);
  const previousPhase = useRef(phase);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const [gameReady, setGameReady] = useState(false);

  useGameAudio();


  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = AMBIENT_STYLE;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('crg-reduced-motion', reducedMotion);
    return () => document.documentElement.classList.remove('crg-reduced-motion');
  }, [reducedMotion]);

  useEffect(() => {
    let cancelled = false;
    const needsGame = phase !== 'SETUP' && phase !== 'GAME_OVER';
    if (!needsGame) {
      runtimeRef.current?.destroyGame();
      runtimeRef.current = null;
      queueMicrotask(() => { if (!cancelled) setGameReady(false); });
      return () => { cancelled = true; };
    }
    void loadGameRuntime().then(runtime => {
      if (cancelled) return;
      runtimeRef.current = runtime;
      runtime.createGame();
      setGameReady(true);
    });
    return () => { cancelled = true; };
  }, [phase]);

  useEffect(() => () => runtimeRef.current?.destroyGame(), []);

  // Resume AudioContext + start music on the first browser-approved gesture.
  useEffect(() => listenForAudioUnlock(), []);

  // Button hover sound — fires once per button entry, gated to avoid rapid-fire
  useEffect(() => {
    let lastT = 0;
    const handler = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (
        el.closest('button') &&
        !(e.relatedTarget as HTMLElement | null)?.closest('button')
      ) {
        const now = Date.now();
        if (now - lastT > 80) { lastT = now; sfxHover(); }
      }
    };
    document.addEventListener('mouseover', handler, true);
    return () => document.removeEventListener('mouseover', handler, true);
  }, []);

  // Stop music when the game ends or returns to setup; fire game_over event
  useEffect(() => {
    const phaseChanged = previousPhase.current !== phase;
    previousPhase.current = phase;

    if (phase === 'GAME_OVER' && phaseChanged) {
      stopMusic();
      const winner = players.find(p => p.id === winnerId);
      trackEvent('game_over', {
        outcome: winner?.isHuman ? 'human_wins' : 'ai_wins',
        winner_name: winner?.name ?? 'unknown',
        turns: turnNumber,
      });
    } else if (phase === 'SETUP' && phaseChanged) {
      stopMusic();
    }
  }, [phase, players, winnerId, turnNumber]);

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
      <div id="phaser-container" aria-hidden="true" style={{ position: 'fixed', inset: 0 }} />

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
      {active && !reducedMotion && (
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
      {phase !== 'SETUP' && phase !== 'GAME_OVER' && gameReady && <HUD />}
      {phase !== 'SETUP' && phase !== 'GAME_OVER' && !gameReady && (
        <div role="status" aria-live="polite" style={{
          position: 'fixed', inset: 0, zIndex: 20,
          display: 'grid', placeItems: 'center',
          background: 'var(--crg-void)', color: 'var(--crg-signal)',
          fontFamily: 'monospace', fontSize: '0.9rem', letterSpacing: 3,
        }}>
          LOADING COMMAND TABLE…
        </div>
      )}
      {phase === 'GAME_OVER' && <GameOverScreen />}
      <DeadMansSwitchOverlay />
      <DaemonStealOverlay />
      <WarLootOverlay />
      <WarPickOverlay />
      <WarPreOverlay />
      <CounterOpportunityOverlay />
      <PauseOverlay />
      <UpdateBanner />
      <TutorialOverlay />
      <WarResultOverlay />
    </>
  );
}

export default App;
