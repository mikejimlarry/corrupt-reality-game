// src/ui/WarPickOverlay.tsx
import React, { useState } from 'react';
import { useGameStore } from '../state/useGameStore';

const DAEMON_LABEL: Record<string, string> = {
  FIREWALL:     'FW',
  ENCRYPTION:   'ENC',
  HARDENED_NODE:'HN',
};

function CombatantCard({ playerIndex, label, active }: { playerIndex: number; label: string; active: boolean }) {
  const players = useGameStore(s => s.players);
  const player  = players[playerIndex];
  if (!player) return null;

  return (
    <div style={{
      flex: 1, padding: '0.5rem 0.7rem',
      background: active ? 'rgba(255,51,102,0.12)' : 'rgba(255,51,102,0.03)',
      border: active ? '1px solid #ff336655' : '1px solid #ff336622',
      color: active ? '#ff4466' : '#553344',
      fontSize: '0.65rem', letterSpacing: 1,
    }}>
      <div style={{ fontSize: '0.5rem', letterSpacing: 2, marginBottom: 3, color: '#663344' }}>{label}</div>
      <div style={{ fontWeight: 'bold', marginBottom: active ? 4 : 0 }}>{active ? player.name : '— select below —'}</div>
      {active && (
        <>
          <div style={{ fontSize: '0.55rem', color: '#ff336677', marginBottom: 2 }}>
            {player.credits}¢
          </div>
          {player.daemons.length > 0 ? (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {player.daemons.map((d, i) => (
                <span key={i} style={{
                  fontSize: '0.48rem', letterSpacing: 1, padding: '1px 4px',
                  background: 'rgba(0,255,204,0.08)', border: '1px solid #00ffcc22',
                  color: '#00ffcc66', borderRadius: 2,
                }}>
                  {DAEMON_LABEL[d] ?? d}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.48rem', color: '#442233' }}>no daemons</div>
          )}
        </>
      )}
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
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(5,0,10,0.94)',
      zIndex: 200,
      fontFamily: 'monospace',
    }}>
      <div style={{
        border: '1px solid #ff336644',
        padding: '2rem',
        maxWidth: 480,
        width: '90%',
        background: 'rgba(15,0,10,0.90)',
      }}>
        {/* Header */}
        <div style={{
          color: '#ff3366', letterSpacing: 6, fontSize: '0.6rem',
          textAlign: 'center', marginBottom: '0.4rem',
        }}>
          ⚔ CONFLICT DECLARATION
        </div>
        <h2 style={{
          color: '#ff4466', letterSpacing: 4, fontSize: '1.1rem',
          margin: '0 0 0.35rem', textAlign: 'center',
        }}>
          {cardName.toUpperCase()}
        </h2>
        <p style={{
          color: '#663344', letterSpacing: 1, fontSize: '0.6rem',
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
            color: '#552233', fontSize: '0.8rem',
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
                key={id}
                onClick={() => handleSelect(playerIndex)}
                style={{
                  background: isSelected ? 'rgba(255,51,102,0.14)' : 'rgba(255,51,102,0.04)',
                  border: isSelected ? '1px solid #ff336666' : '1px solid #ff336622',
                  color: isSelected ? '#ff5577' : '#883355',
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
                }}
                onMouseEnter={e => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,51,102,0.10)';
                    (e.currentTarget as HTMLElement).style.borderColor = '#ff336644';
                    (e.currentTarget as HTMLElement).style.color = '#cc4466';
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,51,102,0.04)';
                    (e.currentTarget as HTMLElement).style.borderColor = '#ff336622';
                    (e.currentTarget as HTMLElement).style.color = '#883355';
                  }
                }}
              >
                <span style={{ color: '#ff336688', minWidth: 14 }}>{label}</span>
                <span style={{ flex: 1 }}>{name}</span>
                <span style={{ fontSize: '0.6rem', color: '#ff336666', marginLeft: 8 }}>
                  {player?.credits ?? 0}¢
                </span>
                {player?.daemons && player.daemons.length > 0 && (
                  <span style={{ display: 'flex', gap: 3 }}>
                    {player.daemons.map((d, i) => (
                      <span key={i} style={{
                        fontSize: '0.45rem', padding: '1px 3px',
                        background: 'rgba(0,255,204,0.07)', border: '1px solid #00ffcc22',
                        color: '#00ffcc55', borderRadius: 2,
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
          disabled={!canConfirm}
          onClick={() => canConfirm && resolve(p1Index!, p2Index!)}
          style={{
            width: '100%',
            background: canConfirm ? 'rgba(255,51,102,0.18)' : 'rgba(255,51,102,0.04)',
            border: canConfirm ? '1px solid #ff336688' : '1px solid #ff336622',
            color: canConfirm ? '#ff4466' : '#552233',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            letterSpacing: 3,
            padding: '0.65rem',
            cursor: canConfirm ? 'pointer' : 'not-allowed',
            transition: 'all 0.12s',
            marginBottom: '0.5rem',
          }}
          onMouseEnter={e => {
            if (canConfirm) (e.currentTarget as HTMLElement).style.background = 'rgba(255,51,102,0.28)';
          }}
          onMouseLeave={e => {
            if (canConfirm) (e.currentTarget as HTMLElement).style.background = 'rgba(255,51,102,0.18)';
          }}
        >
          ⚔ DECLARE CONFLICT
        </button>

        {/* Cancel */}
        <button
          onClick={() => cancel()}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid #22223322',
            color: '#442233',
            fontFamily: 'monospace',
            fontSize: '0.6rem',
            letterSpacing: 3,
            padding: '0.4rem',
            cursor: 'pointer',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = '#885566';
            (e.currentTarget as HTMLElement).style.borderColor = '#664455';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = '#442233';
            (e.currentTarget as HTMLElement).style.borderColor = '#22223322';
          }}
        >
          ABORT
        </button>
      </div>
    </div>
  );
};
