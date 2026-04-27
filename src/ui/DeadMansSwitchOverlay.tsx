// src/ui/DeadMansSwitchOverlay.tsx
import React from 'react';
import { useGameStore } from '../state/useGameStore';
import type { NegativeEventCard } from '../types/cards';

export const DeadMansSwitchOverlay: React.FC = () => {
  const pending  = useGameStore(s => s.deadMansSwitchPending);
  const players  = useGameStore(s => s.players);
  const resolve  = useGameStore(s => s.resolveDeadMansSwitch);

  if (!pending) return null;

  const player       = players[pending.playerIndex];
  const eligibleCards: NegativeEventCard[] = pending.eligibleCards;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(5,0,0,0.94)',
      zIndex: 200,
      fontFamily: 'monospace',
    }}>
      <div style={{
        border: '1px solid #ff004466',
        padding: '2rem',
        maxWidth: 460,
        width: '90%',
        background: 'rgba(20,0,0,0.85)',
      }}>
        {/* Header */}
        <div style={{
          color: '#ff0044', letterSpacing: 6, fontSize: '0.6rem',
          textAlign: 'center', marginBottom: '0.4rem',
        }}>
          ⚠ SYSTEM ALERT
        </div>
        <h2 style={{
          color: '#ff2244', letterSpacing: 4, fontSize: '1.1rem',
          margin: '0 0 0.35rem', textAlign: 'center',
        }}>
          DEAD MAN'S SWITCH
        </h2>
        <p style={{
          color: '#662233', letterSpacing: 1, fontSize: '0.6rem',
          textAlign: 'center', margin: '0 0 1.5rem',
          lineHeight: 1.6,
        }}>
          {player?.name} — SIGNAL LOST.<br />
          Play one last card before you fall.
        </p>

        {/* Card choices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {eligibleCards.map(card => (
            <button
              key={card.id}
              onClick={() => resolve(card)}
              style={{
                background: 'rgba(255,0,68,0.05)',
                border: '1px solid #ff004422',
                color: '#cc4455',
                fontFamily: 'monospace',
                padding: '0.7rem 0.9rem',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s',
                lineHeight: 1,
              }}
              className="crg-btn-red"
            >
              <div style={{ fontSize: '0.72rem', letterSpacing: 2, marginBottom: '0.3rem' }}>
                {card.name}
              </div>
              <div style={{ fontSize: '0.58rem', color: '#883344', letterSpacing: 0.5, lineHeight: 1.5 }}>
                {card.description}
              </div>
            </button>
          ))}
        </div>

        {/* Skip */}
        <button
          onClick={() => resolve(null)}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid #33222244',
            color: '#443333',
            fontFamily: 'monospace',
            fontSize: '0.65rem',
            letterSpacing: 3,
            padding: '0.5rem',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          className="crg-btn-dismiss-red"
        >
          SKIP — GO QUIETLY
        </button>
      </div>
    </div>
  );
};
