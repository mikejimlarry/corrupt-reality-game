// src/ui/WarPreOverlay.tsx
import React from 'react';
import { useGameStore } from '../state/useGameStore';
import type { CounterCard } from '../types/cards';

const DAEMON_LABEL: Record<string, string> = {
  FIREWALL:     'Firewall',
  ENCRYPTION:   'Encryption',
  HARDENED_NODE:'Hardened Node',
};

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

  // Cards this combatant can play: Firewall Surge (multiple OK) or System Interrupt (cancel)
  const eligibleCards = combatant.hand.filter(c => {
    if (c.category !== 'COUNTER') return false;
    const cnt = c as CounterCard;
    return cnt.counterType === 'TACTICAL_ADVANTAGE' || cnt.counterType === 'NEGOTIATE';
  }) as CounterCard[];

  const surgeCards = eligibleCards.filter(c => c.counterType === 'TACTICAL_ADVANTAGE');
  const siCards    = eligibleCards.filter(c => c.counterType === 'NEGOTIATE');
  const currentBonus = combatant.tacticalBonus;

  const renderPlayer = (player: typeof players[0], isActive: boolean) => (
    <div style={{
      padding: '0.4rem 0.75rem',
      background: isActive ? 'rgba(255,51,102,0.14)' : 'rgba(255,51,102,0.05)',
      border: isActive ? '1px solid #ff336666' : '1px solid #ff336622',
      fontSize: '0.7rem', letterSpacing: 2,
      minWidth: 120,
    }}>
      <div style={{ color: isActive ? '#ff5577' : '#664455', fontWeight: 'bold', marginBottom: 3 }}>
        {player.name}
      </div>
      <div style={{ fontSize: '0.55rem', color: isActive ? '#ff336688' : '#443344', marginBottom: 3 }}>
        {player.credits}¢
        {player.tacticalBonus > 0 && (
          <span style={{ color: '#ff9955', marginLeft: 6 }}>+{player.tacticalBonus} roll</span>
        )}
      </div>
      {player.daemons.length > 0 ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {player.daemons.map((d, i) => (
            <span key={i} style={{
              fontSize: '0.45rem', padding: '1px 4px',
              background: 'rgba(0,255,204,0.07)', border: '1px solid #00ffcc22',
              color: '#00ffcc55', borderRadius: 2, letterSpacing: 1,
            }}>
              {DAEMON_LABEL[d] ?? d}
            </span>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '0.45rem', color: '#442233' }}>no daemons</div>
      )}
    </div>
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
          ⚔ PRE-CONFLICT PREPARATION
        </div>
        <h2 style={{
          color: '#ff4466', letterSpacing: 3, fontSize: '1rem',
          margin: '0 0 0.25rem', textAlign: 'center',
        }}>
          {warCard.name.toUpperCase()}
        </h2>

        {/* Matchup with credits and daemons */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 12, marginBottom: '1.2rem', marginTop: '0.5rem',
        }}>
          {renderPlayer(players[p1Index], step === 1)}
          <div style={{ color: '#552233', fontSize: '0.8rem', flexShrink: 0 }}>VS</div>
          {renderPlayer(players[p2Index], step === 2)}
        </div>

        {/* Whose turn it is */}
        <div style={{
          fontSize: '0.6rem', color: '#ff336688', letterSpacing: 2,
          textAlign: 'center', marginBottom: '1rem',
        }}>
          {combatant.name.toUpperCase()} — PREPARE FOR BATTLE
          {currentBonus > 0 && (
            <span style={{ color: '#ff9955', marginLeft: 8 }}>
              (+{currentBonus} to roll)
            </span>
          )}
        </div>

        {/* Eligible cards */}
        {eligibleCards.length === 0 ? (
          <div style={{
            fontSize: '0.65rem', color: '#442233', letterSpacing: 1,
            textAlign: 'center', padding: '1rem',
            border: '1px solid #33112211',
            marginBottom: '1rem',
          }}>
            No eligible cards in hand
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>

            {/* Firewall Surge cards — can play multiple */}
            {surgeCards.length > 0 && (
              <>
                <div style={{ fontSize: '0.5rem', color: '#ff336644', letterSpacing: 3, marginBottom: 2 }}>
                  FIREWALL SURGE — adds +1 to your CONFLICT roll (stackable)
                </div>
                {surgeCards.map(c => (
                  <button
                    key={c.id}
                    onClick={() => playPreCard(c.id)}
                    style={{
                      background: 'rgba(255,153,51,0.06)',
                      border: '1px solid #ff993322',
                      color: '#cc7733',
                      fontFamily: 'monospace',
                      fontSize: '0.72rem', letterSpacing: 2,
                      padding: '0.6rem 0.9rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,153,51,0.16)';
                      (e.currentTarget as HTMLElement).style.borderColor = '#ff993355';
                      (e.currentTarget as HTMLElement).style.color = '#ffaa44';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,153,51,0.06)';
                      (e.currentTarget as HTMLElement).style.borderColor = '#ff993322';
                      (e.currentTarget as HTMLElement).style.color = '#cc7733';
                    }}
                  >
                    ▲ {c.name} — +1 to CONFLICT roll
                  </button>
                ))}
              </>
            )}

            {/* System Interrupt — cancels the conflict */}
            {siCards.length > 0 && (
              <>
                <div style={{ fontSize: '0.5rem', color: '#ff336644', letterSpacing: 3, marginTop: 8, marginBottom: 2 }}>
                  SYSTEM INTERRUPT — cancels this conflict entirely
                </div>
                {siCards.map(c => (
                  <button
                    key={c.id}
                    onClick={() => playPreCard(c.id)}
                    style={{
                      background: 'rgba(100,100,255,0.06)',
                      border: '1px solid #5555ff22',
                      color: '#6677cc',
                      fontFamily: 'monospace',
                      fontSize: '0.72rem', letterSpacing: 2,
                      padding: '0.6rem 0.9rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(100,100,255,0.16)';
                      (e.currentTarget as HTMLElement).style.borderColor = '#5555ff55';
                      (e.currentTarget as HTMLElement).style.color = '#8899ee';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(100,100,255,0.06)';
                      (e.currentTarget as HTMLElement).style.borderColor = '#5555ff22';
                      (e.currentTarget as HTMLElement).style.color = '#6677cc';
                    }}
                  >
                    ✕ {c.name} — cancel conflict
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {/* Go to battle */}
        <button
          onClick={() => pass()}
          style={{
            width: '100%',
            background: 'rgba(255,51,102,0.14)',
            border: '1px solid #ff336666',
            color: '#ff4466',
            fontFamily: 'monospace',
            fontSize: '0.75rem', letterSpacing: 3,
            padding: '0.65rem',
            cursor: 'pointer',
            transition: 'all 0.12s',
            marginBottom: '0.5rem',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,51,102,0.26)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,51,102,0.14)'}
        >
          ⚔ GO TO BATTLE
        </button>

        {/* Abort */}
        <button
          onClick={() => cancel()}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid #22223322',
            color: '#442233',
            fontFamily: 'monospace',
            fontSize: '0.6rem', letterSpacing: 3,
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
          RETREAT
        </button>
      </div>
    </div>
  );
};
