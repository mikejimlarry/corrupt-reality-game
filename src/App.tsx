// src/App.tsx
import { useEffect } from 'react';
import { createGame, destroyGame } from './game';
import { useGameStore } from './state/useGameStore';
import { SetupScreen } from './ui/SetupScreen';
import { HUD } from './ui/HUD';
import { DeadMansSwitchOverlay } from './ui/DeadMansSwitchOverlay';

function App() {
  const phase      = useGameStore(s => s.phase);
  const corruption = useGameStore(s => s.globalCorruptionMode);

  useEffect(() => {
    createGame();
    return () => destroyGame();
  }, []);

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

      {/* React UI overlays */}
      {phase === 'SETUP' && <SetupScreen />}
      {phase !== 'SETUP' && <HUD />}
      <DeadMansSwitchOverlay />
    </>
  );
}

export default App;
