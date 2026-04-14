// src/ui/HUD.tsx
import React, { useEffect, useState } from 'react';
import { useGameStore } from '../state/useGameStore';
import { HelpModal } from './HelpModal';

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
  width: '100%',
};

function panel(accent: string): React.CSSProperties {
  return {
    background: 'rgba(5,5,15,0.88)',
    border: `1px solid ${accent}33`,
    borderRadius: 6,
    padding: '8px 12px',
    fontFamily: 'monospace',
    color: '#c0d0e0',
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
  const log                 = useGameStore(s => s.log);
  const corruption          = useGameStore(s => s.globalCorruptionMode);
  const drawCard            = useGameStore(s => s.drawCard);
  const playCard            = useGameStore(s => s.playCard);
  const discardCard         = useGameStore(s => s.discardCard);
  const triggerRoll         = useGameStore(s => s.triggerRoll);
  const rollTriggered       = useGameStore(s => s.rollTriggered);
  const validTargetIds      = useGameStore(s => s.validTargetIds);
  const cancelTargeting     = useGameStore(s => s.cancelTargeting);
  const endTurn             = useGameStore(s => s.endTurn);

  const ACCENT = corruption ? '#ff1e3c' : '#00ffcc';

  const [logExpanded, setLogExpanded] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [rollReady, setRollReady] = useState(false);
  useEffect(() => {
    if (phase === 'PHASE_ROLL') {
      setRollReady(false);
      const t = setTimeout(() => setRollReady(true), 700);
      return () => clearTimeout(t);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'END_TURN') {
      const t = setTimeout(() => endTurn(), 900);
      return () => clearTimeout(t);
    }
  }, [phase, endTurn]);

  if (phase === 'SETUP') return null;

  const currentPlayer = players[currentPlayerIndex];
  const isHuman = currentPlayer?.isHuman ?? false;
  const selectedCard = selectedCardId
    ? players.find(p => p.isHuman)?.hand.find(c => c.id === selectedCardId)
    : null;
  const logTail = log.slice(-3);

  // Whether the selected card is a forced play (The Corruption) — no discard allowed
  const isForced = (selectedCard as any)?.effect === 'CORRUPTION';

  return (
    <>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* ── Top-right: compact info (kept short so it clears the mid-screen AI zones) ── */}
      <div style={{
        position: 'fixed', top: 16, right: 16, zIndex: 5,
        width: 160, display: 'flex', flexDirection: 'column', gap: 6,
        pointerEvents: 'none',
      }}>
        {corruption && (
          <div className="corruption-pulse corruption-flicker" style={{
            background: 'rgba(20,0,5,0.92)',
            border: '1px solid #ff1e3c88',
            borderRadius: 6,
            padding: '6px 10px',
            fontFamily: 'monospace',
            textAlign: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 8, color: '#ff1e3c', letterSpacing: 2, marginBottom: 2 }}>
              [!] CORRUPTION DETECTED
            </div>
            <div style={{ fontSize: 7, color: '#ff1e3c66', letterSpacing: 1 }}>
              STABILITY ROLLS INVERTED
            </div>
          </div>
        )}

        <div style={{ ...panel(ACCENT), pointerEvents: 'none' }}>
          <div style={{ fontSize: 9, color: `${ACCENT}88`, letterSpacing: 2, marginBottom: 3 }}>
            TURN {turnNumber} · {phase}
          </div>
          <div style={{ fontSize: 12, color: isHuman ? ACCENT : '#ff9955', fontWeight: 'bold', letterSpacing: 1 }}>
            {isHuman ? '> YOUR TURN' : `${currentPlayer?.name ?? '...'}`}
          </div>
        </div>

        <button
          onClick={() => setShowHelp(true)}
          style={{
            ...BTN_BASE,
            background: 'transparent',
            border: `1px solid ${ACCENT}22`,
            color: `${ACCENT}44`,
            fontSize: 9, letterSpacing: 2,
            pointerEvents: 'auto',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = ACCENT;
            (e.currentTarget as HTMLElement).style.borderColor = `${ACCENT}55`;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = `${ACCENT}44`;
            (e.currentTarget as HTMLElement).style.borderColor = `${ACCENT}22`;
          }}
        >
          ? FIELD MANUAL
        </button>
      </div>

      {/* ── Bottom-center: action panels (roll, draw, play, targeting) ── */}
      <div style={{
        position: 'fixed', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        zIndex: 5, width: 260,
        display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch',
        pointerEvents: 'none',
      }}>
        {phase === 'PHASE_ROLL' && isHuman && rollReady && !rollTriggered && (
          <div
            style={{ ...panel(ACCENT), pointerEvents: 'auto' }}
            className={corruption ? 'corruption-pulse' : 'hud-pulse'}
          >
            <div style={{ fontSize: 9, color: `${ACCENT}55`, letterSpacing: 3, marginBottom: 8 }}>
              SEQUENCE READY
            </div>
            <button style={btnPrimary(ACCENT)} onClick={() => triggerRoll()}>
              ▶ BEGIN SEQUENCE
            </button>
          </div>
        )}

        {phase === 'TARGETING' && (
          <div
            style={{ ...panel(ACCENT), borderColor: '#ff333388', pointerEvents: 'auto' }}
            className="hud-pulse"
          >
            <div style={{ fontSize: 9, color: '#ff3333', letterSpacing: 3, marginBottom: 6 }}>
              SELECT A TARGET
            </div>
            <div style={{ fontSize: 10, color: '#667788', marginBottom: 10 }}>
              {validTargetIds.length} opponent{validTargetIds.length !== 1 ? 's' : ''} available
            </div>
            {!isForced && (
              <button
                style={{ ...btnDim('#ff3333'), borderColor: '#ff333344', color: '#ff3333aa' }}
                onClick={() => cancelTargeting()}
              >
                x CANCEL
              </button>
            )}
          </div>
        )}

        {phase !== 'GAME_OVER' && phase !== 'PHASE_ROLL' && phase !== 'TARGETING' && isHuman && (
          <div
            style={{
              ...panel(ACCENT),
              pointerEvents: (phase === 'MAIN' && !selectedCard) ? 'none' : 'auto',
              opacity: (phase === 'MAIN' && !selectedCard) ? 0 : 1,
            }}
            className={phase === 'DRAW' ? (corruption ? 'corruption-pulse' : 'hud-pulse') : ''}
          >
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
                  {!isForced && (
                    <button style={btnDim(ACCENT)} onClick={() => discardCard(selectedCard.id)}>
                      DISCARD
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {phase === 'END_TURN' && (
          <div style={{ ...panel(ACCENT), opacity: 0.6, pointerEvents: 'none', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: `${ACCENT}88`, letterSpacing: 2 }}>TURN COMPLETE</div>
          </div>
        )}
      </div>

      {/* ── Bottom-right: activity log ── */}
      {log.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 8, right: 16, zIndex: 5, width: 160,
          pointerEvents: 'none',
        }}>
          <div style={{ ...panel(ACCENT), padding: 0, overflow: 'hidden', pointerEvents: 'auto' }}>
            <button
              onClick={() => setLogExpanded(e => !e)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '7px 10px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'monospace', fontSize: 8,
                color: `${ACCENT}55`, letterSpacing: 2,
              }}
            >
              <span>ACTIVITY LOG</span>
              <span style={{ color: `${ACCENT}44` }}>
                {logExpanded ? 'v COLLAPSE' : `^ ${log.length}`}
              </span>
            </button>

            {!logExpanded && (
              <div style={{ padding: '0 10px 7px' }}>
                {logTail.map(entry => (
                  <div key={entry.id} style={{
                    fontSize: 9, color: '#667788', lineHeight: 1.6, letterSpacing: 0.5,
                  }}>
                    {entry.text}
                  </div>
                ))}
              </div>
            )}

            {logExpanded && (
              <div
                className="log-scroll"
                style={{
                  maxHeight: 200, overflowY: 'auto',
                  padding: '0 10px 8px',
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}
              >
                {log.map((entry, i) => (
                  <div key={entry.id} style={{
                    fontSize: 9, lineHeight: 1.6, letterSpacing: 0.5,
                    color: i === log.length - 1 ? '#aabbcc' : '#667788',
                    borderLeft: entry.type === 'turn'   ? `2px solid ${ACCENT}33` :
                                entry.type === 'card'   ? '2px solid #aa44ff55' :
                                entry.type === 'effect' ? '2px solid #ff996655' :
                                entry.type === 'combat' ? '2px solid #ff336655' : 'none',
                    paddingLeft: entry.type !== 'roll' ? 5 : 0,
                  }}>
                    {entry.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
