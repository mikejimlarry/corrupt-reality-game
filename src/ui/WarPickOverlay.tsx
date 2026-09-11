// src/ui/WarPickOverlay.tsx
import React, { useState } from 'react';
import { useGameStore } from '../state/useGameStore';
import { OverlayShell } from './OverlayShell';

const DAEMON_LABEL: Record<string, string> = {
  FIREWALL:     'FW',
  ENCRYPTION:   'ENC',
  HARDENED_NODE:'HN',
};

function CombatantCard({ playerIndex, label, active }: { playerIndex: number; label: string; active: boolean }) {
  const players = useGameStore(s => s.players);
  const player  = active ? players[playerIndex] : null;

  return (
    <div style={{
      flex: 1, padding: '0.5rem 0.7rem',
      background: active
        ? 'color-mix(in srgb, var(--crg-rival) 12%, transparent)'
        : 'color-mix(in srgb, var(--crg-rival) 3%, transparent)',
      border: active
        ? '1px solid color-mix(in srgb, var(--crg-rival) 40%, transparent)'
        : '1px solid color-mix(in srgb, var(--crg-rival) 18%, transparent)',
      color: active ? 'var(--crg-rival)' : 'var(--crg-muted)',
      fontSize: '0.75rem', letterSpacing: 1,
      // Fixed height so layout never shifts when a player is selected
      minHeight: 72, boxSizing: 'border-box',
    }}>
      <div style={{ fontSize: '0.75rem', letterSpacing: 2, marginBottom: 3, color: active ? 'var(--crg-rival)' : 'var(--crg-muted)' }}>{label}</div>
      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
        {player ? player.name : '— select —'}
      </div>
      <div style={{ fontSize: '0.75rem', color: active ? 'var(--crg-rival)' : 'var(--crg-muted)', marginBottom: 2 }}>
        {player ? `${player.cycles}⟳` : '—'}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minHeight: 14 }}>
        {player && player.daemons.length > 0
          ? player.daemons.map((d, i) => (
            <span key={i} style={{
              fontSize: '0.75rem', letterSpacing: 1, padding: '1px 4px',
              background: 'rgba(0,255,204,0.08)', border: '1px solid #00ffcc22',
              color: 'var(--crg-signal)', borderRadius: 2,
            }}>
              {DAEMON_LABEL[d] ?? d}
            </span>
          ))
          : <span style={{ fontSize: '0.75rem', color: 'var(--crg-muted)' }}>
              {player ? 'no daemons' : '—'}
            </span>
        }
      </div>
    </div>
  );
}

export const WarPickOverlay: React.FC = () => {
  const pending = useGameStore(s => s.warPickPending);
  const players = useGameStore(s => s.players);
  const resolve = useGameStore(s => s.resolveWarPick);
  const cancel  = useGameStore(s => s.cancelWarPick);

  const [p1Index, setP1Index] = useState<number | null>(null);
  const [p2Index, setP2Index] = useState<number | null>(null);

  // Reset local picks whenever the pending state changes
  React.useEffect(() => {
    setP1Index(null);
    setP2Index(null);
  }, [pending]);

  if (!pending) return null;

  const cardName = players
    .flatMap(p => p.hand)
    .find(c => c.id === pending.cardId)?.name ?? 'CONFLICT';

  const handleSelect = (playerIndex: number) => {
    if (p1Index === null) {
      setP1Index(playerIndex);
    } else if (p1Index === playerIndex) {
      setP1Index(null);
      setP2Index(null);
    } else if (p2Index === playerIndex) {
      setP2Index(null);
    } else {
      setP2Index(playerIndex);
    }
  };

  const canConfirm = p1Index !== null && p2Index !== null;

  return (
    <OverlayShell
      ariaLabel="Choose conflict combatants"
      background="rgba(5,0,10,0.94)"
      panelStyle={{
        border: '1px solid color-mix(in srgb, var(--crg-rival) 35%, transparent)',
        padding: '2rem',
        background: 'color-mix(in srgb, var(--crg-rival) 6%, var(--crg-panel))',
      }}
    >
        {/* Header */}
        <div style={{
          color: 'var(--crg-rival)', letterSpacing: 4, fontSize: '0.75rem',
          textAlign: 'center', marginBottom: '0.4rem',
        }}>
          ⚔ CONFLICT DECLARATION
        </div>
        <h2 style={{
          color: 'var(--crg-rival)', letterSpacing: 4, fontSize: '1.1rem',
          margin: '0 0 0.35rem', textAlign: 'center',
        }}>
          {cardName.toUpperCase()}
        </h2>
        <p style={{
          color: 'var(--crg-body)', letterSpacing: 1, fontSize: '0.875rem',
          textAlign: 'center', margin: '0 0 1.4rem',
          lineHeight: 1.6,
        }}>
          Choose two combatants.<br />
          Both will roll — the loser pays the price.
        </p>

        {/* Selection summary */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: '1rem',
        }}>
          <CombatantCard
            playerIndex={p1Index ?? -1}
            label="COMBATANT 1"
            active={p1Index !== null}
          />
          <div style={{
            display: 'flex', alignItems: 'center',
            color: 'var(--crg-muted)', fontSize: '0.875rem',
          }}>⚔</div>
          <CombatantCard
            playerIndex={p2Index ?? -1}
            label="COMBATANT 2"
            active={p2Index !== null}
          />
        </div>

        {/* Player buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
          {pending.availablePlayers.map(({ id, name, playerIndex }) => {
            const isP1 = p1Index === playerIndex;
            const isP2 = p2Index === playerIndex;
            const isSelected = isP1 || isP2;
            const label = isP1 ? '① ' : isP2 ? '② ' : '';
            const player = players[playerIndex];

            return (
              <button
                type="button"
                key={id}
                onClick={() => handleSelect(playerIndex)}
                style={{
                  background: isSelected
                    ? 'color-mix(in srgb, var(--crg-rival) 14%, transparent)'
                    : 'color-mix(in srgb, var(--crg-rival) 4%, transparent)',
                  border: isSelected
                    ? '1px solid color-mix(in srgb, var(--crg-rival) 45%, transparent)'
                    : '1px solid color-mix(in srgb, var(--crg-rival) 18%, transparent)',
                  color: isSelected ? 'var(--crg-rival)' : 'var(--crg-text)',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  letterSpacing: 2,
                  padding: '0.55rem 0.9rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 44,
                }}
                className="crg-btn-war"
              >
                <span style={{ color: 'var(--crg-rival)', minWidth: 14 }}>{label}</span>
                <span style={{ flex: 1 }}>{name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--crg-body)', marginLeft: 8 }}>
                  {player?.cycles ?? 0}⟳
                </span>
                {player?.daemons && player.daemons.length > 0 && (
                  <span style={{ display: 'flex', gap: 3 }}>
                    {player.daemons.map((d, i) => (
                      <span key={i} style={{
                        fontSize: '0.75rem', padding: '1px 3px',
                        background: 'rgba(0,255,204,0.07)', border: '1px solid #00ffcc22',
                        color: 'var(--crg-signal)', borderRadius: 2,
                      }}>
                        {DAEMON_LABEL[d] ?? d}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Confirm */}
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => canConfirm && resolve(p1Index!, p2Index!)}
          style={{
            width: '100%',
            background: canConfirm
              ? 'color-mix(in srgb, var(--crg-rival) 18%, transparent)'
              : 'color-mix(in srgb, var(--crg-rival) 4%, transparent)',
            border: canConfirm
              ? '1px solid color-mix(in srgb, var(--crg-rival) 55%, transparent)'
              : '1px solid color-mix(in srgb, var(--crg-rival) 18%, transparent)',
            color: canConfirm ? 'var(--crg-rival)' : 'var(--crg-muted)',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            letterSpacing: 3,
            padding: '0.65rem', minHeight: 44,
            cursor: canConfirm ? 'pointer' : 'not-allowed',
            transition: 'all 0.12s',
            marginBottom: '0.5rem',
          }}
          className={canConfirm ? 'crg-btn-war-confirm' : ''}
        >
          ⚔ DECLARE CONFLICT
        </button>

        {/* Cancel */}
        <button
          type="button"
          onClick={() => cancel()}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid #22223322',
            color: 'var(--crg-muted)',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            letterSpacing: 3,
            padding: '0.4rem', minHeight: 44,
            cursor: 'pointer',
            transition: 'all 0.12s',
          }}
          className="crg-btn-dismiss-war"
        >
          ABORT
        </button>
    </OverlayShell>
  );
};
