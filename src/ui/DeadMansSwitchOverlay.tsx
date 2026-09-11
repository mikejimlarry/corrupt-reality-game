// src/ui/DeadMansSwitchOverlay.tsx
import React from 'react';
import { useGameStore } from '../state/useGameStore';
import type { NegativeEventCard } from '../types/cards';
import { OverlayShell } from './OverlayShell';

export const DeadMansSwitchOverlay: React.FC = () => {
  const pending  = useGameStore(s => s.deadMansSwitchPending);
  const players  = useGameStore(s => s.players);
  const resolve  = useGameStore(s => s.resolveDeadMansSwitch);

  if (!pending) return null;

  const player       = players[pending.playerIndex];
  const eligibleCards: NegativeEventCard[] = pending.eligibleCards;

  return (
    <OverlayShell
      ariaLabel="Choose a final card"
      background="rgba(5,0,0,0.94)"
      maxWidth={460}
      panelStyle={{
        border: '1px solid color-mix(in srgb, var(--crg-rival) 45%, transparent)',
        padding: '2rem',
        background: 'color-mix(in srgb, var(--crg-rival) 7%, var(--crg-panel))',
      }}
    >
        {/* Header */}
        <div style={{
          color: 'var(--crg-rival)', letterSpacing: 4, fontSize: '0.75rem',
          textAlign: 'center', marginBottom: '0.4rem',
        }}>
          ⚠ SYSTEM ALERT
        </div>
        <h2 style={{
          color: 'var(--crg-rival)', letterSpacing: 4, fontSize: '1.1rem',
          margin: '0 0 0.35rem', textAlign: 'center',
        }}>
          DEAD MAN'S SWITCH
        </h2>
        <p style={{
          color: 'var(--crg-body)', letterSpacing: 1, fontSize: '0.875rem',
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
              type="button"
              key={card.id}
              onClick={() => resolve(card)}
              style={{
                background: 'rgba(255,0,68,0.05)',
                border: '1px solid color-mix(in srgb, var(--crg-rival) 20%, transparent)',
                color: 'var(--crg-rival)',
                fontFamily: 'monospace',
                padding: '0.7rem 0.9rem',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s',
                lineHeight: 1,
                minHeight: 44,
              }}
              className="crg-btn-red"
            >
              <div style={{ fontSize: '0.75rem', letterSpacing: 2, marginBottom: '0.3rem' }}>
                {card.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--crg-body)', letterSpacing: 0.5, lineHeight: 1.5 }}>
                {card.description}
              </div>
            </button>
          ))}
        </div>

        {/* Skip */}
        <button
          type="button"
          onClick={() => resolve(null)}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid color-mix(in srgb, var(--crg-muted) 25%, transparent)',
            color: 'var(--crg-muted)',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            letterSpacing: 3,
            padding: '0.5rem', minHeight: 44,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          className="crg-btn-dismiss-red"
        >
          SKIP — GO QUIETLY
        </button>
    </OverlayShell>
  );
};
