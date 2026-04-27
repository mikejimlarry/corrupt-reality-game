// src/ui/CounterOpportunityOverlay.tsx
// Shown when an AI declares WAR on the human and they hold a counter card.
// Counter cards can only be played reactively during a WAR, before the roll.
import React from 'react';
import { useGameStore } from '../state/useGameStore';
import type { CounterCard } from '../types/cards';

const COUNTER_LABEL: Record<string, string> = {
  SHIELD:             'QUARANTINE',
  NEGOTIATE:          'SYSTEM INTERRUPT',
  TACTICAL_ADVANTAGE: 'FIREWALL SURGE',
};

const COUNTER_DESC: Record<string, string> = {
  SHIELD:             'Cancel the war — Quarantine nullifies the incoming Conflict.',
  NEGOTIATE:          'Cancel the war — System Interrupt blocks incoming Conflict cards.',
  TACTICAL_ADVANTAGE: 'Boost your roll by +1 — war still proceeds, but you fight with an edge.',
};

export const CounterOpportunityOverlay: React.FC = () => {
  const pending  = useGameStore(s => s.counterPending);
  const players  = useGameStore(s => s.players);
  const resolve  = useGameStore(s => s.resolveCounterOpportunity);

  if (!pending) return null;

  const { attackerIndex, cardId, eligibleCounters } = pending;
  const attacker   = players[attackerIndex];
  const attackCard = attacker?.hand.find(c => c.id === cardId);

  if (!attacker || !attackCard) return null;

  // Group by counterType
  const shieldCards   = eligibleCounters.filter(c => c.counterType === 'SHIELD');
  const negCards      = eligibleCounters.filter(c => c.counterType === 'NEGOTIATE');
  const tacticalCards = eligibleCounters.filter(c => c.counterType === 'TACTICAL_ADVANTAGE');

  const counterBtn = (card: CounterCard) => (
    <button
      key={card.id}
      onClick={() => resolve(card.id)}
      className="crg-btn-cyan"
      style={{
        background: 'rgba(0,255,204,0.06)',
        border: '1px solid #00ffcc22',
        color: '#00cc99',
        fontFamily: 'monospace',
        fontSize: '0.72rem', letterSpacing: 2,
        padding: '0.6rem 0.9rem',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.12s',
        width: '100%',
      }}
    >
      ⊘ {card.name}
    </button>
  );

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
          color: '#ff5566', letterSpacing: 6, fontSize: '0.55rem',
          textAlign: 'center', marginBottom: '0.3rem',
        }}>
          ⚔ INCOMING WAR
        </div>
        <h2 style={{
          color: '#ff4466', letterSpacing: 3, fontSize: '1rem',
          margin: '0 0 1rem', textAlign: 'center',
        }}>
          {attackCard.name.toUpperCase()}
        </h2>

        {/* Who's attacking */}
        <div style={{
          fontSize: '0.65rem', color: '#ff336688', letterSpacing: 2,
          textAlign: 'center', marginBottom: '1.25rem',
        }}>
          {attacker.name.toUpperCase()} is declaring war on you
        </div>

        {/* Counter options */}
        <div style={{
          fontSize: '0.5rem', color: '#00ffcc44', letterSpacing: 3,
          marginBottom: '0.5rem',
        }}>
          RESPOND BEFORE THE WAR BEGINS
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' }}>
          {shieldCards.length > 0 && (
            <>
              <div style={{ fontSize: '0.5rem', color: '#00ffcc33', letterSpacing: 2, marginBottom: 2 }}>
                {COUNTER_LABEL.SHIELD} — {COUNTER_DESC.SHIELD}
              </div>
              {shieldCards.map(counterBtn)}
            </>
          )}
          {negCards.length > 0 && (
            <>
              <div style={{
                fontSize: '0.5rem', color: '#00ffcc33', letterSpacing: 2,
                marginTop: shieldCards.length > 0 ? 8 : 0, marginBottom: 2,
              }}>
                {COUNTER_LABEL.NEGOTIATE} — {COUNTER_DESC.NEGOTIATE}
              </div>
              {negCards.map(counterBtn)}
            </>
          )}
          {tacticalCards.length > 0 && (
            <>
              <div style={{
                fontSize: '0.5rem', color: '#00ffcc33', letterSpacing: 2,
                marginTop: (shieldCards.length > 0 || negCards.length > 0) ? 8 : 0, marginBottom: 2,
              }}>
                {COUNTER_LABEL.TACTICAL_ADVANTAGE} — {COUNTER_DESC.TACTICAL_ADVANTAGE}
              </div>
              {tacticalCards.map(counterBtn)}
            </>
          )}
        </div>

        {/* Separator */}
        <div style={{ borderBottom: '1px solid #ff336622', marginBottom: '1rem' }} />

        {/* Allow */}
        <button
          onClick={() => resolve(null)}
          style={{
            width: '100%',
            background: 'rgba(255,51,102,0.08)',
            border: '1px solid #ff336644',
            color: '#ff4466',
            fontFamily: 'monospace',
            fontSize: '0.72rem', letterSpacing: 3,
            padding: '0.6rem',
            cursor: 'pointer',
            transition: 'all 0.12s',
          }}
          className="crg-btn-war-proceed"
        >
          TAKE THE HIT
        </button>
      </div>
    </div>
  );
};
