// src/ui/HUD.tsx
import React, { useEffect, useState } from 'react';
import { useGameStore } from '../state/useGameStore';

const PULSE_STYLE = `
@keyframes hud-pulse {
  0%, 100% { box-shadow: 0 0 6px 1px rgba(0,255,204,0.25), 0 0 0 1px rgba(0,255,204,0.15); }
  50%       { box-shadow: 0 0 22px 4px rgba(0,255,204,0.65), 0 0 0 1px rgba(0,255,204,0.45); }
}
.hud-pulse { animation: hud-pulse 1.4s ease-in-out infinite; }

.log-scroll::-webkit-scrollbar { width: 3px; }
.log-scroll::-webkit-scrollbar-track { background: transparent; }
.log-scroll::-webkit-scrollbar-thumb { background: #00ffcc33; border-radius: 2px; }
.log-scroll::-webkit-scrollbar-thumb:hover { background: #00ffcc66; }
`;

function useInjectStyle(css: string) {
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, [css]);
}

const PANEL: React.CSSProperties = {
  background: 'rgba(5,5,15,0.88)',
  border: '1px solid #00ffcc33',
  borderRadius: 6,
  padding: '10px 14px',
  fontFamily: 'monospace',
  color: '#c0d0e0',
  marginBottom: 8,
};

const BTN_BASE: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 12,
  padding: '6px 14px',
  borderRadius: 4,
  border: 'none',
  cursor: 'pointer',
  letterSpacing: 1,
  fontWeight: 'bold',
};

const BTN_CYAN: React.CSSProperties = {
  ...BTN_BASE,
  background: '#00ffcc',
  color: '#000',
};

const BTN_DIM: React.CSSProperties = {
  ...BTN_BASE,
  background: 'rgba(0,255,204,0.12)',
  color: '#00ffcc88',
  border: '1px solid #00ffcc33',
};

export function HUD() {
  useInjectStyle(PULSE_STYLE);
  const phase             = useGameStore(s => s.phase);
  const players           = useGameStore(s => s.players);
  const currentPlayerIndex = useGameStore(s => s.currentPlayerIndex);
  const selectedCardId    = useGameStore(s => s.selectedCardId);
  const turnNumber        = useGameStore(s => s.turnNumber);
  const winnerId          = useGameStore(s => s.winnerId);
  const log               = useGameStore(s => s.log);
  const drawCard          = useGameStore(s => s.drawCard);
  const playCard          = useGameStore(s => s.playCard);
  const discardCard       = useGameStore(s => s.discardCard);
  const resetToSetup      = useGameStore(s => s.resetToSetup);
  const triggerRoll       = useGameStore(s => s.triggerRoll);
  const rollTriggered     = useGameStore(s => s.rollTriggered);
  const validTargetIds    = useGameStore(s => s.validTargetIds);
  const cancelTargeting   = useGameStore(s => s.cancelTargeting);

  const [logExpanded, setLogExpanded] = useState(false);

  // Delay the BEGIN SEQUENCE button so it appears after the table + card animations settle
  const [rollReady, setRollReady] = useState(false);
  useEffect(() => {
    if (phase === 'PHASE_ROLL') {
      setRollReady(false);
      const t = setTimeout(() => setRollReady(true), 700);
      return () => clearTimeout(t);
    }
  }, [phase]);

  if (phase === 'SETUP') return null;

  const currentPlayer = players[currentPlayerIndex];
  const isHuman = currentPlayer?.isHuman ?? false;
  const selectedCard = selectedCardId
    ? players.find(p => p.isHuman)?.hand.find(c => c.id === selectedCardId)
    : null;
  const winner = winnerId ? players.find(p => p.id === winnerId) : null;
  const logTail = log.slice(-4);

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 5,
        width: 240,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Status panel */}
      <div style={PANEL}>
        <div style={{ fontSize: 10, color: '#00ffcc88', letterSpacing: 2, marginBottom: 4 }}>
          TURN {turnNumber} · {phase}
        </div>
        {phase === 'GAME_OVER' ? (
          <div style={{ fontSize: 13, color: '#00ffcc', fontWeight: 'bold' }}>
            🏆 {winner?.name ?? 'Unknown'} WINS
          </div>
        ) : (
          <div style={{ fontSize: 13, color: isHuman ? '#00ffcc' : '#ff9955', fontWeight: 'bold' }}>
            {isHuman ? '▶ YOUR TURN' : `⏳ ${currentPlayer?.name ?? '...'}`}
          </div>
        )}
      </div>

      {/* BEGIN SEQUENCE button — human PHASE_ROLL only, appears after animations settle */}
      {phase === 'PHASE_ROLL' && isHuman && rollReady && !rollTriggered && (
        <div style={PANEL} className="hud-pulse">
          <div style={{ fontSize: 10, color: '#00ffcc55', letterSpacing: 3, marginBottom: 8 }}>
            SEQUENCE READY
          </div>
          <button style={BTN_CYAN} onClick={() => triggerRoll()}>
            ▶ BEGIN SEQUENCE
          </button>
        </div>
      )}

      {/* Targeting banner — click an opponent on the board to select them */}
      {phase === 'TARGETING' && (
        <div style={{ ...PANEL, borderColor: '#ff333388' }} className="hud-pulse">
          <div style={{ fontSize: 10, color: '#ff3333', letterSpacing: 3, marginBottom: 8 }}>
            SELECT A TARGET
          </div>
          <div style={{ fontSize: 10, color: '#667788', marginBottom: 10 }}>
            {validTargetIds.length} opponent{validTargetIds.length !== 1 ? 's' : ''} available
          </div>
          <button style={{ ...BTN_DIM, borderColor: '#ff333344', color: '#ff3333aa' }} onClick={() => cancelTargeting()}>
            ✕ CANCEL
          </button>
        </div>
      )}

      {/* Action panel — only when game active, human turn, and not rolling */}
      {phase !== 'GAME_OVER' && phase !== 'PHASE_ROLL' && phase !== 'TARGETING' && isHuman && (
        <div style={PANEL} className={phase === 'DRAW' ? 'hud-pulse' : ''}>
          {phase === 'DRAW' && (
            <button style={BTN_CYAN} onClick={() => drawCard()}>
              DRAW CARD
            </button>
          )}

          {phase === 'MAIN' && !selectedCard && (
            <div style={{ fontSize: 11, color: '#00ffcc55', letterSpacing: 1 }}>
              SELECT A CARD TO PLAY
            </div>
          )}

          {phase === 'MAIN' && selectedCard && (
            <>
              <div style={{ fontSize: 10, color: '#00ffcc', marginBottom: 8, letterSpacing: 1 }}>
                {selectedCard.name.toUpperCase()}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={BTN_CYAN} onClick={() => playCard(selectedCard.id)}>
                  PLAY
                </button>
                <button style={BTN_DIM} onClick={() => discardCard(selectedCard.id)}>
                  DISCARD
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Game over action */}
      {phase === 'GAME_OVER' && (
        <div style={PANEL}>
          <button style={BTN_CYAN} onClick={() => resetToSetup()}>
            PLAY AGAIN
          </button>
        </div>
      )}

      {/* Game log */}
      {log.length > 0 && (
        <div style={{ ...PANEL, padding: 0, overflow: 'hidden' }}>

          {/* Header row — always visible, click to expand/collapse */}
          <button
            onClick={() => setLogExpanded(e => !e)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '8px 12px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'monospace', fontSize: 9,
              color: '#00ffcc55', letterSpacing: 2,
            }}
          >
            <span>ACTIVITY LOG</span>
            <span style={{ color: '#00ffcc44' }}>{logExpanded ? '▲ COLLAPSE' : `▼ ${log.length} ENTRIES`}</span>
          </button>

          {/* Collapsed — show last 4 entries */}
          {!logExpanded && (
            <div style={{ padding: '0 12px 8px' }}>
              {logTail.map(entry => (
                <div key={entry.id}
                  style={{ fontSize: 10, color: '#667788', lineHeight: 1.6, letterSpacing: 0.5 }}>
                  {entry.text}
                </div>
              ))}
            </div>
          )}

          {/* Expanded — full scrollable history, newest at bottom */}
          {logExpanded && (
            <div
              className="log-scroll"
              style={{
                maxHeight: 320, overflowY: 'auto',
                padding: '0 12px 10px',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}
            >
              {log.map((entry, i) => (
                <div key={entry.id} style={{
                  fontSize: 10, lineHeight: 1.6, letterSpacing: 0.5,
                  color: i === log.length - 1 ? '#aabbcc' : '#667788',
                  borderLeft: entry.type === 'turn'   ? '2px solid #00ffcc33' :
                              entry.type === 'card'   ? '2px solid #aa44ff55' :
                              entry.type === 'effect' ? '2px solid #ff996655' :
                              entry.type === 'combat' ? '2px solid #ff336655' : 'none',
                  paddingLeft: entry.type !== 'roll' ? 6 : 0,
                }}>
                  {entry.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
