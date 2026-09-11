// src/ui/WarPreOverlay.tsx
import React from 'react';
import { useGameStore } from '../state/useGameStore';
import type { CounterCard } from '../types/cards';
import { OverlayShell } from './OverlayShell';


export const WarPreOverlay: React.FC = () => {
  const pending       = useGameStore(s => s.warPrePending);
  const players       = useGameStore(s => s.players);
  const playPreCard   = useGameStore(s => s.playWarPreCard);
  const pass          = useGameStore(s => s.passWarPre);
  const cancel        = useGameStore(s => s.cancelWarPre);

  if (!pending) return null;

  const { card: warCard, p1Index, p2Index, step } = pending;
  const combatantIndex = step === 1 ? p1Index : p2Index;
  const combatant = players[combatantIndex];

  // Cards this combatant can play: Firewall Surge (+1 roll) only.
  // Quarantine is proactive — arm it on your own turn before a war reaches you.
  const surgeCards = combatant.hand.filter(c =>
    c.category === 'COUNTER' && (c as CounterCard).counterType === 'TACTICAL_ADVANTAGE'
  ) as CounterCard[];
  const currentBonus = combatant.tacticalBonus;

  const renderPlayer = (player: typeof players[0], isActive: boolean) => (
    <div style={{
      padding: '0.4rem 0.75rem',
      background: isActive
        ? 'color-mix(in srgb, var(--crg-rival) 20%, transparent)'
        : 'color-mix(in srgb, var(--crg-rival) 10%, transparent)',
      border: isActive
        ? '1px solid color-mix(in srgb, var(--crg-rival) 60%, transparent)'
        : '1px solid color-mix(in srgb, var(--crg-rival) 45%, transparent)',
      fontSize: '0.75rem', letterSpacing: 2,
      minWidth: 120,
    }}>
      <div style={{ color: 'var(--crg-rival)', fontWeight: 'bold', marginBottom: 3 }}>
        {player.name}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--crg-body)', marginBottom: 3 }}>
        {player.cycles}⟳
        {player.tacticalBonus > 0 && (
          <span style={{ color: 'var(--crg-conflict)', marginLeft: 6 }}>+{player.tacticalBonus} roll</span>
        )}
      </div>
      {player.daemons.includes('HARDENED_NODE') && (
        <span style={{
          fontSize: '0.75rem', padding: '1px 4px',
          background: 'rgba(0,255,204,0.07)', border: '1px solid #00ffcc22',
          color: 'var(--crg-signal)', borderRadius: 2, letterSpacing: 1,
        }}>
          Hardened Node
        </span>
      )}
    </div>
  );

  return (
    <OverlayShell
      ariaLabel="Pre-conflict preparation"
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
          textAlign: 'center', marginBottom: '0.3rem',
        }}>
          ⚔ PRE-CONFLICT PREPARATION
        </div>
        <h2 style={{
          color: 'var(--crg-rival)', letterSpacing: 3, fontSize: '1rem',
          margin: '0 0 0.25rem', textAlign: 'center',
        }}>
          {warCard.name.toUpperCase()}
        </h2>

        {/* Matchup with cycles and daemons */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 12, marginBottom: '1.2rem', marginTop: '0.5rem',
        }}>
          {renderPlayer(players[p1Index], step === 1)}
          <div style={{ color: 'var(--crg-muted)', fontSize: '0.875rem', flexShrink: 0 }}>VS</div>
          {renderPlayer(players[p2Index], step === 2)}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem',
          marginBottom: '0.5rem', fontSize: '0.75rem', letterSpacing: 1,
        }}>
          <div style={{
            padding: '0.65rem', textAlign: 'center',
            border: '1px solid color-mix(in srgb, var(--crg-conflict) 28%, transparent)',
            color: 'var(--crg-body)',
          }}>
            WINNER <strong style={{ color: 'var(--crg-conflict)' }}>−{warCard.winnerLoses} CYCLES</strong>
          </div>
          <div style={{
            padding: '0.65rem', textAlign: 'center',
            border: '1px solid color-mix(in srgb, var(--crg-conflict) 28%, transparent)',
            color: 'var(--crg-body)',
          }}>
            LOSER <strong style={{ color: 'var(--crg-conflict)' }}>−{warCard.loserLoses} CYCLES</strong>
          </div>
        </div>
        {warCard.loserLosesImprovement && (
          <div style={{
            color: 'var(--crg-conflict)', fontSize: '0.75rem', letterSpacing: 2,
            textAlign: 'center', marginBottom: '0.5rem',
          }}>
            LOSER ALSO LOSES 1 DAEMON
          </div>
        )}
        <div style={{
          color: 'var(--crg-body)', fontSize: '0.75rem', letterSpacing: 1,
          textAlign: 'center', marginBottom: '1rem',
        }}>
          Higher modified roll wins.
        </div>

        {/* Whose turn it is */}
        <div style={{
          fontSize: '0.75rem', color: 'var(--crg-body)', letterSpacing: 2,
          textAlign: 'center', marginBottom: '1rem',
        }}>
          {combatant.name.toUpperCase()} — PREPARE FOR BATTLE
          {currentBonus > 0 && (
            <span style={{ color: 'var(--crg-conflict)', marginLeft: 8 }}>
              (+{currentBonus} to roll)
            </span>
          )}
        </div>

        {/* Eligible cards */}
        {surgeCards.length === 0 ? (
          <div style={{
            fontSize: '0.75rem', color: 'var(--crg-muted)', letterSpacing: 1,
            textAlign: 'center', padding: '1rem',
            border: '1px solid color-mix(in srgb, var(--crg-rival) 12%, transparent)',
            marginBottom: '1rem',
          }}>
            <strong style={{ display: 'block', color: 'var(--crg-conflict)', letterSpacing: 2 }}>
              NO COUNTERMEASURES AVAILABLE
            </strong>
            Outcome will be decided by the roll.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>

            {/* Firewall Surge cards — can play multiple */}
            {surgeCards.length > 0 && (
              <>
                <div style={{ fontSize: '0.75rem', color: 'var(--crg-body)', letterSpacing: 3, marginBottom: 2 }}>
                  FIREWALL SURGE — adds +1 to your CONFLICT roll (stackable)
                </div>
                {surgeCards.map(c => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => playPreCard(c.id)}
                    style={{
                      background: 'color-mix(in srgb, var(--crg-conflict) 6%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--crg-conflict) 20%, transparent)',
                      color: 'var(--crg-conflict)',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem', letterSpacing: 2,
                      padding: '0.6rem 0.9rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                      minHeight: 44,
                    }}
                    className="crg-btn-orange"
                  >
                    ▲ {c.name} — +1 to CONFLICT roll
                  </button>
                ))}
              </>
            )}

          </div>
        )}

        {/* Go to battle */}
        <button
          type="button"
          onClick={() => pass()}
          style={{
            width: '100%',
            background: 'var(--crg-conflict)',
            border: '1px solid var(--crg-conflict)',
            color: 'var(--crg-void)',
            fontFamily: 'monospace',
            fontSize: '0.75rem', letterSpacing: 3,
            padding: '0.65rem', minHeight: 44,
            cursor: 'pointer',
            transition: 'all 0.12s',
            marginBottom: '0.5rem',
          }}
          className="crg-btn-war-roll"
        >
          ROLL FOR CONFLICT
        </button>

        {/* Abort */}
        <button
          type="button"
          onClick={() => cancel()}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid #22223322',
            color: 'var(--crg-muted)',
            fontFamily: 'monospace',
            fontSize: '0.75rem', letterSpacing: 3,
            padding: '0.4rem', minHeight: 44,
            cursor: 'pointer',
            transition: 'all 0.12s',
          }}
          className="crg-btn-dismiss-war"
        >
          RETREAT
        </button>
    </OverlayShell>
  );
};
