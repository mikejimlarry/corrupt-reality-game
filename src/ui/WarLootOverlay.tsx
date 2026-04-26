// src/ui/WarLootOverlay.tsx
import React from 'react';
import { useGameStore } from '../state/useGameStore';
import type { DaemonType } from '../types/cards';

const DAEMON_LABELS: Record<DaemonType, string> = {
  FIREWALL:     'FIREWALL',
  ENCRYPTION:   'ENCRYPTION',
  HARDENED_NODE:'HARDENED NODE',
};

const DAEMON_DESCRIPTIONS: Record<DaemonType, string> = {
  FIREWALL:     'Deflects incoming WAR card damage',
  ENCRYPTION:   'Blocks incoming EVENT_NEGATIVE cards',
  HARDENED_NODE:'Reduces credit loss when losing a war',
};

export const WarLootOverlay: React.FC = () => {
  const pending = useGameStore(s => s.warLootPending);
  const players = useGameStore(s => s.players);
  const resolve = useGameStore(s => s.resolveWarLoot);

  if (!pending) return null;

  const loser = players[pending.loserIndex];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(10,0,5,0.94)',
      zIndex: 200,
      fontFamily: 'monospace',
    }}>
      <div style={{
        border: '1px solid #ff336644',
        padding: '2rem',
        maxWidth: 460,
        width: '90%',
        background: 'rgba(15,0,10,0.90)',
      }}>
        <div style={{
          color: '#ff5566', letterSpacing: 6, fontSize: '0.6rem',
          textAlign: 'center', marginBottom: '0.4rem',
        }}>
          ⚔ TOTAL SIEGE — VICTORY
        </div>
        <h2 style={{
          color: '#ff4466', letterSpacing: 3, fontSize: '1.1rem',
          margin: '0 0 0.35rem', textAlign: 'center',
        }}>
          WAR SPOILS
        </h2>
        <p style={{
          color: '#884455', letterSpacing: 1, fontSize: '0.6rem',
          textAlign: 'center', margin: '0 0 1.5rem',
          lineHeight: 1.6,
        }}>
          {loser?.name ?? 'TARGET'} — SYSTEMS BREACHED.<br />
          Choose which daemon to destroy.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {pending.availableDaemons.map(daemon => (
            <button
              key={daemon}
              onClick={() => resolve(daemon)}
              style={{
                background: 'rgba(255,51,102,0.04)',
                border: '1px solid #ff336622',
                color: '#cc5566',
                fontFamily: 'monospace',
                padding: '0.7rem 0.9rem',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s',
                lineHeight: 1,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,51,102,0.14)';
                (e.currentTarget as HTMLElement).style.borderColor = '#ff336666';
                (e.currentTarget as HTMLElement).style.color = '#ff5577';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,51,102,0.04)';
                (e.currentTarget as HTMLElement).style.borderColor = '#ff336622';
                (e.currentTarget as HTMLElement).style.color = '#cc5566';
              }}
            >
              <div style={{ fontSize: '0.72rem', letterSpacing: 2, marginBottom: '0.3rem' }}>
                {DAEMON_LABELS[daemon]}
              </div>
              <div style={{ fontSize: '0.58rem', color: '#664455', letterSpacing: 0.5, lineHeight: 1.5 }}>
                {DAEMON_DESCRIPTIONS[daemon]}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
