// src/ui/HUD.tsx
import React, { useEffect, useState } from 'react';
import { useGameStore } from '../state/useGameStore';

const PULSE_STYLE = `
@keyframes hud-pulse {
  0%, 100% { box-shadow: 0 0 6px 1px rgba(0,255,204,0.25), 0 0 0 1px rgba(0,255,204,0.15); }
  50%       { box-shadow: 0 0 22px 4px rgba(0,255,204,0.65), 0 0 0 1px rgba(0,255,204,0.45); }
}
.hud-pulse { animation: hud-pulse 1.4s ease-in-out infinite; }

@keyframes corruption-pulse {
  0%, 100% { box-shadow: 0 0 8px 2px rgba(255,30,60,0.35), 0 0 0 1px rgba(255,30,60,0.25); }
  50%       { box-shadow: 0 0 28px 6px rgba(255,30,60,0.75), 0 0 0 1px rgba(255,30,60,0.55); }
}
.corruption-pulse { animation: corruption-pulse 1.1s ease-in-out infinite; }

@keyframes corruption-flicker {
  0%, 92%, 100% { opacity: 1; }
  93%           { opacity: 0.4; }
  95%           { opacity: 1; }
  97%           { opacity: 0.6; }
}
.corruption-flicker { animation: corruption-flicker 3s infinite; }

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

function panel(accent: string): React.CSSProperties {
  return {
    background: 'rgba(5,5,15,0.88)',
    border: `1px solid ${accent}33`,
    borderRadius: 6,
    padding: '10px 14px',
    fontFamily: 'monospace',
    color: '#c0d0e0',
    marginBottom: 8,
  };
}

function btnPrimary(accent: string): React.CSSProperties {
  return { ...BTN_BASE, background: accent, color: '#000' };
}

function btnDim(accent: string): React.CSSProperties {
  return {
    ...BTN_BASE,
    background: `${accent}1a`,
    color: `${accent}88`,
    border: `1px solid ${accent}33`,
  };
}

export function HUD() {
  useInjectStyle(PULSE_STYLE);
  const phase               = useGameStore(s => s.phase);
  const players             = useGameStore(s => s.players);
  const currentPlayerIndex  = useGameStore(s => s.currentPlayerIndex);
  const selectedCardId      = useGameStore(s => s.selectedCardId);
  const turnNumber          = useGameStore(s => s.turnNumber);
  const winnerId            = useGameStore(s => s.winnerId);
  const log                 = useGameStore(s => s.log);
  const corruption          = useGameStore(s => s.globalCorruptionMode);
  const drawCard            = useGameStore(s => s.drawCard);
  const playCard            = useGameStore(s => s.playCard);
  const discardCard         = useGameStore(s => s.discardCard);
  const resetToSetup        = useGameStore(s => s.resetToSetup);
  const triggerRoll         = useGameStore(s => s.triggerRoll);
  const rollTriggered       = useGameStore(s => s.rollTriggered);
  const validTargetIds      = useGameStore(s => s.validTargetIds);
  const cancelTargeting     = useGameStore(s => s.cancelTargeting);
  const endTurn             = useGameStore(s => s.endTurn);

  const ACCENT = corruption ? '#ff1e3c' : '#00ffcc';

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
      {/* Corruption banner */}
      {corruption && (
        <div
          className="corruption-pulse corruption-flicker"
          style={{
            background: 'rgba(20,0,5,0.92)',
            border: '1px solid #ff1e3c88',
            borderRadius: 6,
            padding: '8px 14px',
            marginBottom: 8,
            fontFamily: 'monospace',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 9, color: '#ff1e3c', letterSpacing: 3, marginBottom: 2 }}>
            ⚠ SYSTEM ALERT ⚠
          </div>
          <div style={{ fontSize: 11, color: '#ff4466', fontWeight: 'bold', letterSpacing: 2 }}>
            CORRUPTION DETECTED
          </div>
          <div style={{ fontSize: 8, color: '#ff1e3c66', letterSpacing: 1, marginTop: 3 }}>
            STABILITY ROLLS INVERTED
          </div>
        </div>
      )}

      {/* Status panel */}
      <div style={panel(ACCENT)}>
        <div style={{ fontSize: 10, color: `${ACCENT}88`, letterSpacing: 2, marginBottom: 4 }}>
          TURN {turnNumber} · {phase}
        </div>
        {phase === 'GAME_OVER' ? (
          <div style={{ fontSize: 13, color: ACCENT, fontWeight: 'bold' }}>
            🏆 {winner?.name ?? 'Unknown'} WINS
          </div>
        ) : (
          <div style={{ fontSize: 13, color: isHuman ? ACCENT : '#ff9955', fontWeight: 'bold' }}>
            {isHuman ? '▶ YOUR TURN' : `⏳ ${currentPlayer?.name ?? '...'}`}
          </div>
        )}
      </div>

      {/* BEGIN SEQUENCE button — human PHASE_ROLL only, appears after animations settle */}
      {phase === 'PHASE_ROLL' && isHuman && rollReady && !rollTriggered && (
        <div style={panel(ACCENT)} className={corruption ? 'corruption-pulse' : 'hud-pulse'}>
          <div style={{ fontSize: 10, color: `${ACCENT}55`, letterSpacing: 3, marginBottom: 8 }}>
            SEQUENCE READY
          </div>
          <button style={btnPrimary(ACCENT)} onClick={() => triggerRoll()}>
            ▶ BEGIN SEQUENCE
          </button>
        </div>
      )}

      {/* Targeting banner — click an opponent on the board to select them */}
      {phase === 'TARGETING' && (
        <div style={{ ...panel(ACCENT), borderColor: '#ff333388' }} className="hud-pulse">
          <div style={{ fontSize: 10, color: '#ff3333', letterSpacing: 3, marginBottom: 8 }}>
            SELECT A TARGET
          </div>
          <div style={{ fontSize: 10, color: '#667788', marginBottom: 10 }}>
            {validTargetIds.length} opponent{validTargetIds.length !== 1 ? 's' : ''} available
          </div>
          <button style={{ ...btnDim('#ff3333'), borderColor: '#ff333344', color: '#ff3333aa' }} onClick={() => cancelTargeting()}>
            ✕ CANCEL
          </button>
        </div>
      )}

      {/* Action panel — only when game active, human turn, and not rolling */}
      {phase !== 'GAME_OVER' && phase !== 'PHASE_ROLL' && phase !== 'TARGETING' && isHuman && (
        <div style={panel(ACCENT)} className={phase === 'DRAW' ? (corruption ? 'corruption-pulse' : 'hud-pulse') : ''}>
          {phase === 'DRAW' && (
            <button style={btnPrimary(ACCENT)} onClick={() => drawCard()}>
              DRAW CARD
            </button>
          )}

          {phase === 'MAIN' && !selectedCard && (
            <div style={{ fontSize: 11, color: `${ACCENT}55`, letterSpacing: 1 }}>
              SELECT A CARD TO PLAY
            </div>
          )}

          {phase === 'MAIN' && selectedCard && (
            <>
              <div style={{ fontSize: 10, color: ACCENT, marginBottom: 8, letterSpacing: 1 }}>
                {selectedCard.name.toUpperCase()}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnPrimary(ACCENT)} onClick={() => playCard(selectedCard.id)}>
                  PLAY
                </button>
                <button style={btnDim(ACCENT)} onClick={() => discardCard(selectedCard.id)}>
                  DISCARD
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* End turn panel */}
      {phase === 'END_TURN' && (
        <div style={panel(ACCENT)} className={corruption ? 'corruption-pulse' : 'hud-pulse'}>
          <div style={{ fontSize: 10, color: `${ACCENT}88`, letterSpacing: 2, marginBottom: 8 }}>
            TURN COMPLETE
          </div>
          <button style={btnPrimary(ACCENT)} onClick={() => endTurn()}>
            END TURN ›
          </button>
        </div>
      )}

      {/* Game over action */}
      {phase === 'GAME_OVER' && (
        <div style={panel(ACCENT)}>
          <button style={btnPrimary(ACCENT)} onClick={() => resetToSetup()}>
            PLAY AGAIN
          </button>
        </div>
      )}

      {/* Game log */}
      {log.length > 0 && (
        <div style={{ ...panel(ACCENT), padding: 0, overflow: 'hidden' }}>

          {/* Header row — always visible, click to expand/collapse */}
          <button
            onClick={() => setLogExpanded(e => !e)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '8px 12px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'monospace', fontSize: 9,
              color: `${ACCENT}55`, letterSpacing: 2,
            }}
          >
            <span>ACTIVITY LOG</span>
            <span style={{ color: `${ACCENT}44` }}>{logExpanded ? '▲ COLLAPSE' : `▼ ${log.length} ENTRIES`}</span>
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
                  borderLeft: entry.type === 'turn'   ? `2px solid ${ACCENT}33` :
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
