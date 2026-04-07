// src/ui/SetupScreen.tsx
import React, { useState } from 'react';
import { useGameStore } from '../state/useGameStore';

export const SetupScreen: React.FC = () => {
  const startGame = useGameStore(s => s.startGame);
  const [name, setName] = useState('');
  const [count, setCount] = useState(3);

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
      <h1 style={{ letterSpacing: 8, fontSize: '2rem', marginBottom: '0.25rem' }}>
        CORRUPT REALITY
      </h1>
      <p style={{ color: '#446655', letterSpacing: 4, fontSize: '0.75rem', marginBottom: '2.5rem' }}>
        A GAME OF SURVIVAL AND CORRUPTION
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: 280 }}>
        <input
          type="text"
          placeholder="YOUR HANDLE"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{
            background: 'transparent',
            border: '1px solid #00ffcc44',
            borderBottom: '1px solid #00ffcc',
            color: '#00ffcc',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            padding: '0.5rem',
            letterSpacing: 3,
            outline: 'none',
          }}
        />

        <div>
          <div style={{ fontSize: '0.65rem', letterSpacing: 3, color: '#446655', marginBottom: '0.5rem' }}>
            NUMBER OF AGENTS
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[2, 3, 4, 5, 6].map(n => (
              <button
                key={n}
                onClick={() => setCount(n)}
                style={{
                  flex: 1,
                  padding: '0.4rem',
                  background: count === n ? '#00ffcc22' : 'transparent',
                  border: `1px solid ${count === n ? '#00ffcc' : '#00ffcc33'}`,
                  color: count === n ? '#00ffcc' : '#446655',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => startGame(count, name.trim() || 'Ghost')}
          style={{
            marginTop: '0.5rem',
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
