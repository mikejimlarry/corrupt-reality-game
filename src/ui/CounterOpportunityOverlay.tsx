// src/ui/CounterOpportunityOverlay.tsx
// Shown when an AI plays a targeted EVENT_NEGATIVE or WAR at the human and they
// hold a reactive counter card they can play in response.
import React from 'react';
import { useGameStore } from '../state/useGameStore';
import type { CounterCard } from '../types/cards';

const COUNTER_LABEL: Record<string, string> = {
  SHIELD:             'QUARANTINE',
  NEGOTIATE:          'SYSTEM INTERRUPT',
  TACTICAL_ADVANTAGE: 'FIREWALL SURGE',
};

// Descriptions vary by threat type
const COUNTER_DESC_ATTACK: Record<string, string> = {
  SHIELD:    'Absorbs this attack — blocks hack protocols (not Digital Crusade or M.A.D.).',
  NEGOTIATE: 'Cancels this attack — blocks WAR cards and Digital Crusade.',
};

const COUNTER_DESC_WAR: Record<string, string> = {
  NEGOTIATE:          'Cancel the war — System Interrupt blocks incoming WAR cards.',
  TACTICAL_ADVANTAGE: 'Boost your roll by +1 — war still proceeds, but you fight with an edge.',
};

export const CounterOpportunityOverlay: React.FC = () => {
  const pending  = useGameStore(s => s.counterPending);
  const players  = useGameStore(s => s.players);
  const resolve  = useGameStore(s => s.resolveCounterOpportunity);

  if (!pending) return null;

  const { type, attackerIndex, cardId, eligibleCounters } = pending;
  const attacker  = players[attackerIndex];
  const attackCard = attacker?.hand.find(c => c.id === cardId);

  if (!attacker || !attackCard) return null;

  const isWar = type === 'WAR';
  const counterDesc = isWar ? COUNTER_DESC_WAR : COUNTER_DESC_ATTACK;

  // Group by counterType
  const shieldCards   = eligibleCounters.filter(c => c.counterType === 'SHIELD');
  const negCards      = eligibleCounters.filter(c => c.counterType === 'NEGOTIATE');
  const tacticalCards = eligibleCounters.filter(c => c.counterType === 'TACTICAL_ADVANTAGE');

  const counterBtn = (card: CounterCard) => (
    <button
      key={card.id}
      onClick={() => resolve(card.id)}
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
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(0,255,204,0.16)';
        (e.currentTarget as HTMLElement).style.borderColor = '#00ffcc55';
        (e.currentTarget as HTMLElement).style.color = '#00ffcc';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(0,255,204,0.06)';
        (e.currentTarget as HTMLElement).style.borderColor = '#00ffcc22';
        (e.currentTarget as HTMLElement).style.color = '#00cc99';
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
          {isWar ? '⚔ INCOMING WAR' : '⚠ INCOMING ATTACK'}
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
          {attacker.name.toUpperCase()} {isWar ? 'is declaring war on you' : 'is targeting you'}
        </div>

        {/* Counter options */}
        <div style={{
          fontSize: '0.5rem', color: '#00ffcc44', letterSpacing: 3,
          marginBottom: '0.5rem',
        }}>
          {isWar ? 'RESPOND BEFORE THE WAR BEGINS' : 'PLAY A COUNTER TO BLOCK'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' }}>
          {shieldCards.length > 0 && (
            <>
              <div style={{ fontSize: '0.5rem', color: '#00ffcc33', letterSpacing: 2, marginBottom: 2 }}>
                {COUNTER_LABEL.SHIELD} — {counterDesc.SHIELD}
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
                {COUNTER_LABEL.NEGOTIATE} — {counterDesc.NEGOTIATE}
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
                {COUNTER_LABEL.TACTICAL_ADVANTAGE} — {counterDesc.TACTICAL_ADVANTAGE}
              </div>
              {tacticalCards.map(counterBtn)}
            </>
          )}
        </div>

        {/* Separator */}
        <div style={{ borderBottom: '1px solid #ff336622', marginBottom: '1rem' }} />

        {/* Allow / Take the hit */}
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
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,51,102,0.2)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,51,102,0.08)'}
        >
          {isWar ? 'TAKE THE HIT' : 'ALLOW ATTACK'}
        </button>
      </div>
    </div>
  );
};
