// src/App.tsx
import { useEffect } from 'react';
import { createGame, destroyGame } from './game';
import { useGameStore } from './state/useGameStore';
import { SetupScreen } from './ui/SetupScreen';

function App() {
  const phase = useGameStore(s => s.phase);

  useEffect(() => {
    createGame();
    return () => destroyGame();
  }, []);

  return (
    <>
      {/* Phaser canvas mounts here */}
      <div id="phaser-container" style={{ position: 'fixed', inset: 0 }} />

      {/* React UI overlays */}
      {phase === 'SETUP' && <SetupScreen />}
    </>
  );
}

export default App;
