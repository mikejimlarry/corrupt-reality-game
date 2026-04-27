// src/ui/DaemonStealOverlay.tsx
import React from 'react';
import { useGameStore } from '../state/useGameStore';
import type { DaemonType } from '../types/cards';

const DAEMON_LABELS: Record<DaemonType, string> = {
  FIREWALL: 'FIREWALL',
  ENCRYPTION: 'ENCRYPTION',
  HARDENED_NODE: 'HARDENED NODE',
};

const DAEMON_DESCRIPTIONS: Record<DaemonType, string> = {
  FIREWALL: 'Deflects incoming WAR card damage',
  ENCRYPTION: 'Blocks incoming EVENT_NEGATIVE cards',
  HARDENED_NODE: 'Grants passive cycle gain each stability roll',
};

export const DaemonStealOverlay: React.FC = () => {
  const pending = useGameStore(s => s.daemonStealPending);
  const players = useGameStore(s => s.players);
  const resolve = useGameStore(s => s.resolveDaemonSteal);

  if (!pending) return null;

  const target = players[pending.targetIndex];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,5,15,0.94)',
      zIndex: 200,
      fontFamily: 'monospace',
    }}>
      <div style={{
        border: '1px solid #00ffcc44',
        padding: '2rem',
        maxWidth: 460,
        width: '90%',
        background: 'rgba(0,15,20,0.90)',
      }}>
        {/* Header */}
        <div style={{
          color: '#00ffcc', letterSpacing: 6, fontSize: '0.6rem',
          textAlign: 'center', marginBottom: '0.4rem',
        }}>
          ◈ BACKDOOR ACCESS
        </div>
        <h2 style={{
          color: '#00ddaa', letterSpacing: 4, fontSize: '1.1rem',
          margin: '0 0 0.35rem', textAlign: 'center',
        }}>
          DAEMON EXTRACTION
        </h2>
        <p style={{
          color: '#336655', letterSpacing: 1, fontSize: '0.6rem',
          textAlign: 'center', margin: '0 0 1.5rem',
          lineHeight: 1.6,
        }}>
          {target?.name ?? 'TARGET'} — SYSTEM BREACHED.<br />
          Choose which daemon to extract.
        </p>

        {/* Daemon choices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {pending.availableDaemons.map(daemon => (
            <button
              key={daemon}
              onClick={() => resolve(daemon)}
              style={{
                background: 'rgba(0,255,204,0.04)',
                border: '1px solid #00ffcc22',
                color: '#44bbaa',
                fontFamily: 'monospace',
                padding: '0.7rem 0.9rem',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s',
                lineHeight: 1,
              }}
              className="crg-btn-cyan"
            >
              <div style={{ fontSize: '0.72rem', letterSpacing: 2, marginBottom: '0.3rem' }}>
                {DAEMON_LABELS[daemon]}
              </div>
              <div style={{ fontSize: '0.58rem', color: '#336655', letterSpacing: 0.5, lineHeight: 1.5 }}>
                {DAEMON_DESCRIPTIONS[daemon]}
              </div>
            </button>
          ))}
        </div>

        {/* Cancel — lose the card effect */}
        <button
          onClick={() => resolve(null)}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid #22334422',
            color: '#334444',
            fontFamily: 'monospace',
            fontSize: '0.65rem',
            letterSpacing: 3,
            padding: '0.5rem',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          className="crg-btn-dismiss-teal"
        >
          ABORT — TAKE NOTHING
        </button>
      </div>
    </div>
  );
};
