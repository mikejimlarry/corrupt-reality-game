// src/ui/CounterOpportunityOverlay.tsx
// Shown whenever an AI declares WAR on the human, before the roll.
// Any eligible reactive counter cards are offered inside the briefing.
import React from 'react';
import { useGameStore } from '../state/useGameStore';
import type { CounterCard, WarCard } from '../types/cards';
import { OverlayShell } from './OverlayShell';

const COUNTER_LABEL: Record<string, string> = {
  SHIELD:             'SYSTEM INTERRUPT',
  TACTICAL_ADVANTAGE: 'FIREWALL SURGE',
};

const COUNTER_DESC: Record<string, string> = {
  SHIELD:             'Cancel the war — System Interrupt nullifies the incoming Conflict.',
  TACTICAL_ADVANTAGE: 'Boost your roll by +1 — war still proceeds, but you fight with an edge.',
};

export const CounterOpportunityOverlay: React.FC = () => {
  const pending  = useGameStore(s => s.counterPending);
  const players  = useGameStore(s => s.players);
  const resolve  = useGameStore(s => s.resolveCounterOpportunity);

  if (!pending) return null;

  const { attackerIndex, cardId, targetIndex, eligibleCounters } = pending;
  const attacker   = players[attackerIndex];
  const defender   = players[targetIndex];
  const attackCard = attacker?.hand.find(c => c.id === cardId);

  if (!attacker || !defender || !attackCard || attackCard.category !== 'WAR') return null;

  const warCard = attackCard as WarCard;
  const hasCounters = eligibleCounters.length > 0;

  // Group by counterType (NEGOTIATE/Quarantine is proactive — never appears here)
  const shieldCards   = eligibleCounters.filter(c => c.counterType === 'SHIELD');
  const tacticalCards = eligibleCounters.filter(c => c.counterType === 'TACTICAL_ADVANTAGE');

  const counterBtn = (card: CounterCard) => (
    <button
      type="button"
      key={card.id}
      onClick={() => resolve(card.id)}
      className="crg-btn-cyan"
      style={{
        background: 'rgba(0,255,204,0.06)',
        border: '1px solid #00ffcc22',
        color: 'var(--crg-signal)',
        fontFamily: 'monospace',
        fontSize: '0.75rem', letterSpacing: 2,
        padding: '0.6rem 0.9rem',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.12s',
        width: '100%',
        minHeight: 44,
      }}
    >
      ⊘ {card.name}
    </button>
  );

  return (
    <OverlayShell
      ariaLabel="Incoming conflict briefing"
      background="rgba(8,3,0,0.94)"
      panelStyle={{
        border: '1px solid #ff880044',
        padding: '2rem',
        background: 'color-mix(in srgb, var(--crg-conflict) 6%, var(--crg-panel))',
      }}
    >

        {/* Header */}
        <div style={{
          color: 'var(--crg-conflict)', letterSpacing: 4, fontSize: '0.75rem',
          textAlign: 'center', marginBottom: '0.3rem',
        }}>
          ⚔ INCOMING WAR
        </div>
        <h2 style={{
          color: 'var(--crg-conflict)', letterSpacing: 3, fontSize: '1rem',
          margin: '0 0 1rem', textAlign: 'center',
        }}>
          {attackCard.name.toUpperCase()}
        </h2>

        {/* Who's attacking */}
        <div style={{
          fontSize: '0.875rem', color: 'var(--crg-body)', letterSpacing: 2,
          textAlign: 'center', marginBottom: '1.25rem',
        }}>
          {attacker.name.toUpperCase()} VS {defender.name.toUpperCase()}
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
          textAlign: 'center', marginBottom: '1.25rem',
        }}>
          Higher modified roll wins.
          {defender.tacticalBonus > 0 && (
            <strong style={{
              display: 'block', color: 'var(--crg-signal)', letterSpacing: 2,
              marginTop: '0.4rem',
            }}>
              FIREWALL BONUS ARMED: +{defender.tacticalBonus}
            </strong>
          )}
        </div>

        {/* Counter options */}
        <div style={{
          fontSize: '0.75rem', color: 'var(--crg-conflict)', letterSpacing: 3,
          marginBottom: '0.5rem',
        }}>
          {hasCounters ? 'COUNTERMEASURES AVAILABLE' : 'COUNTERMEASURE STATUS'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' }}>
          {!hasCounters && (
            <div style={{
              padding: '0.9rem', textAlign: 'center',
              border: '1px solid color-mix(in srgb, var(--crg-conflict) 28%, transparent)',
              color: 'var(--crg-body)', fontSize: '0.75rem', letterSpacing: 1,
              lineHeight: 1.6,
            }}>
              <strong style={{ display: 'block', color: 'var(--crg-conflict)', letterSpacing: 2 }}>
                NO COUNTERMEASURES AVAILABLE
              </strong>
              Outcome will be decided by the roll.
            </div>
          )}
          {shieldCards.length > 0 && (
            <>
              <div style={{ fontSize: '0.75rem', color: 'var(--crg-body)', letterSpacing: 2, marginBottom: 2 }}>
                {COUNTER_LABEL.SHIELD} — {COUNTER_DESC.SHIELD}
              </div>
              {shieldCards.map(counterBtn)}
            </>
          )}
          {tacticalCards.length > 0 && (
            <>
              <div style={{
                fontSize: '0.75rem', color: 'var(--crg-body)', letterSpacing: 2,
                marginTop: shieldCards.length > 0 ? 8 : 0, marginBottom: 2,
              }}>
                {COUNTER_LABEL.TACTICAL_ADVANTAGE} — {COUNTER_DESC.TACTICAL_ADVANTAGE}
              </div>
              {tacticalCards.map(counterBtn)}
            </>
          )}
        </div>

        {/* Separator */}
        <div style={{ borderBottom: '1px solid #ff880022', marginBottom: '1rem' }} />

        {/* Allow */}
        <button
          type="button"
          onClick={() => resolve(null)}
          style={{
            width: '100%',
            background: 'var(--crg-conflict)',
            border: '1px solid var(--crg-conflict)',
            color: 'var(--crg-void)',
            fontFamily: 'monospace',
            fontSize: '0.75rem', letterSpacing: 3,
            padding: '0.6rem', minHeight: 44,
            cursor: 'pointer',
            transition: 'all 0.12s',
          }}
          className="crg-btn-war-roll"
        >
          ROLL FOR CONFLICT
        </button>
    </OverlayShell>
  );
};
