// src/ui/HUD.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useGameStore, mustPlayCorruptionFirst } from '../state/useGameStore';
import type { HandSortMode } from '../state/useGameStore';
import { HelpModal } from './HelpModal';
import { sfxCardPlay, getMusicEnabled, setMusicEnabled, sfxToggleOn, sfxToggleOff, getMusicTrack, nextMusicTrack } from '../lib/audio';
import { trackEvent } from '../lib/analytics';

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

@keyframes hud-fade-in {
  from { opacity: 0; transform: translate(-50%, 38px); }
  to   { opacity: 1; transform: translate(-50%, 30px); }
}

@keyframes protocol-fade-in {
  from { opacity: 0; transform: translate(-50%, -44%); }
  to   { opacity: 1; transform: translate(-50%, -50%); }
}

@keyframes protocol-slide-up {
  from { opacity: 0; transform: translateX(-50%) translateY(12px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}

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

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const handler = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}

/** Stop both mouse AND touch events from falling through to Phaser. */
function stopPhaser(e: React.MouseEvent | React.TouchEvent) {
  e.nativeEvent.stopImmediatePropagation();
}

function useHover() {
  const [hovered, setHovered] = useState(false);
  return {
    hovered,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };
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
  minHeight: 44,   // touch-friendly tap target
  touchAction: 'manipulation',
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
  const allPlayers          = useGameStore(s => s.players);
  const warRollDisplay      = useGameStore(s => s.warRollDisplay);
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
  const cancelExtraPlays    = useGameStore(s => s.cancelExtraPlays);
  const togglePause         = useGameStore(s => s.togglePause);
  const paused              = useGameStore(s => s.paused);
  const extraPlayPending         = useGameStore(s => s.extraPlayPending);
  const corruptionPendingTarget  = useGameStore(s => s.corruptionPendingTarget);
  const anyOverlayActive         = useGameStore(s => !!(
    s.warPickPending || s.warPrePending ||
    s.daemonStealPending || s.warLootPending || s.deadMansSwitchPending
  ));
  const gameStats                = useGameStore(s => s.gameStats);
  const startingPop              = useGameStore(s => s.startingPop);
  const hidePpCounts             = useGameStore(s => s.hidePpCounts);
  const reducedMotion            = useGameStore(s => s.reducedMotion);
  const setReducedMotion         = useGameStore(s => s.setReducedMotion);
  const handSortMode             = useGameStore(s => s.handSortMode);
  const handSortReverse          = useGameStore(s => s.handSortReverse);
  const setHandSort              = useGameStore(s => s.setHandSort);

  const ACCENT = corruption ? '#ff1e3c' : '#00ffcc';

  const hFieldManual = useHover();
  const hMusic       = useHover();
  const hTrack       = useHover();
  const hPause       = useHover();
  const hMotion      = useHover();
  const hSortMode    = useHover();
  const hSortRev     = useHover();

  const panelStyle      = useMemo(() => panel(ACCENT), [ACCENT]);
  const primaryBtnStyle = useMemo(() => btnPrimary(ACCENT), [ACCENT]);
  const dimBtnStyle     = useMemo(() => btnDim(ACCENT), [ACCENT]);

  const { w: winW } = useWindowSize();
  // Landscape mobile: short dimension < 500 px, or total width < 700 px
  const isMobile = winW < 700;

  // Freeze the scoreboard during the war dice animation so credit counts/bars
  // don't reveal the outcome before the result is shown.
  const [displayPlayers, setDisplayPlayers] = useState(allPlayers);
  useEffect(() => {
    if (!warRollDisplay) setDisplayPlayers(allPlayers);
  }, [allPlayers, warRollDisplay]);
  const players = displayPlayers;

  const [logExpanded, setLogExpanded] = useState(false);
  const [showHelp, setShowHelp]       = useState(false);
  const [musicOn, setMusicOn]         = useState(() => getMusicEnabled());
  const [musicTrack, setMusicTrack]   = useState(() => getMusicTrack());

  // True once the LED panel's unfold animation fires 'crg:led-open'.
  // Reset whenever the phase leaves PHASE_ROLL so stale events don't bleed through.
  const [rollReady, setRollReady] = useState(false);
  useEffect(() => {
    if (phase !== 'PHASE_ROLL') { setRollReady(false); return; }
    const handler = () => setRollReady(true);
    window.addEventListener('crg:led-open', handler);
    return () => { window.removeEventListener('crg:led-open', handler); setRollReady(false); };
  }, [phase]);

  useEffect(() => {
    if (phase === 'END_TURN') {
      const t = setTimeout(() => endTurn(), 900);
      return () => clearTimeout(t);
    }
  }, [phase, endTurn]);

  // Auto-play The Corruption when it's in the starting hand.
  // Fires as soon as MAIN phase begins with the card still unplayed.
  // A short delay lets the deal-in animation settle before the reveal triggers.
  useEffect(() => {
    if (phase !== 'MAIN') return;
    const human = useGameStore.getState().players.find(p => p.isHuman);
    if (!human) return;
    const corruptionCard = human.hand.find(
      c => c.category === 'EVENT_NEGATIVE' && (c as any).effect === 'CORRUPTION',
    );
    if (!corruptionCard) return;
    if ((useGameStore.getState().gameStats.cardsPlayed[human.id] ?? 0) !== 0) return;
    const t = setTimeout(() => {
      sfxCardPlay();
      useGameStore.getState().playCard(corruptionCard.id);
    }, 700);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === 'SETUP') return null;

  const currentPlayer = players[currentPlayerIndex];
  const isHuman = currentPlayer?.isHuman ?? false;
  const selectedCard = selectedCardId
    ? players.find(p => p.isHuman)?.hand.find(c => c.id === selectedCardId)
    : null;
  const logTail = log.slice(-3);

  // Whether the selected card is a forced play (The Corruption) — no discard allowed
  const humanPlayer = players.find(p => p.isHuman);
  const corruptionFirstActive = isHuman && !!humanPlayer && mustPlayCorruptionFirst(humanPlayer, gameStats);
  const isForced = (selectedCard as any)?.effect === 'CORRUPTION' || corruptionPendingTarget || corruptionFirstActive;

  const handleMusicToggle = () => {
    const next = !musicOn;
    setMusicOn(next);
    (next ? sfxToggleOn : sfxToggleOff)();
    setMusicEnabled(next);
  };

  const handleTrackSwitch = () => {
    nextMusicTrack();
    setMusicTrack(getMusicTrack());
  };

  return (
    <>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* ── TOP-LEFT: Field Manual + Music toggle + Activity Log ── */}
      <div
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          zIndex: 5,
          width: isMobile ? 'auto' : 290,
          maxWidth: isMobile ? 'calc(100vw - 24px)' : 290,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top row: Help button + icon buttons */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {/* Help — text on desktop, icon-only on mobile */}
          <button
            onClick={() => { setShowHelp(true); trackEvent('help_opened', { source: 'hud' }); }}
            onMouseEnter={hFieldManual.onMouseEnter}
            onMouseLeave={hFieldManual.onMouseLeave}
            style={{
              ...BTN_BASE,
              flex: isMobile ? 0 : 1,
              width: isMobile ? 44 : 'auto',
              minWidth: 44,
              background: hFieldManual.hovered ? `${ACCENT}22` : 'transparent',
              border: `1px solid ${hFieldManual.hovered ? ACCENT : ACCENT + '44'}`,
              color: ACCENT,
              fontSize: isMobile ? 14 : 10,
              letterSpacing: isMobile ? 0 : 2,
              padding: '6px 10px',
              transition: 'all 0.15s',
            }}
          >
            {isMobile ? '?' : '? FIELD MANUAL'}
          </button>

          {/* Music toggle */}
          <button
            onClick={handleMusicToggle}
            title={musicOn ? 'Music ON — click to mute' : 'Music OFF — click to unmute'}
            onMouseEnter={hMusic.onMouseEnter}
            onMouseLeave={hMusic.onMouseLeave}
            style={{
              ...BTN_BASE,
              width: 44,
              minWidth: 44,
              padding: '6px 10px',
              background: musicOn ? `${ACCENT}18` : 'transparent',
              border: `1px solid ${hMusic.hovered ? ACCENT + '66' : musicOn ? ACCENT + '44' : ACCENT + '18'}`,
              color: (hMusic.hovered || musicOn) ? ACCENT : `${ACCENT}33`,
              fontSize: 14,
              letterSpacing: 0,
              transition: 'all 0.15s',
            }}
          >
            {musicOn ? '♫' : '♪'}
          </button>

          {/* Track switcher — only visible when music is on */}
          {musicOn && (
            <button
              onClick={handleTrackSwitch}
              title={`Track ${musicTrack + 1} — click to switch`}
              onMouseEnter={hTrack.onMouseEnter}
              onMouseLeave={hTrack.onMouseLeave}
              style={{
                ...BTN_BASE,
                width: 44,
                minWidth: 44,
                padding: '6px 10px',
                background: `${ACCENT}18`,
                border: `1px solid ${hTrack.hovered ? ACCENT + '66' : ACCENT + '33'}`,
                color: hTrack.hovered ? ACCENT : `${ACCENT}88`,
                fontSize: 12,
                letterSpacing: 0,
                transition: 'all 0.15s',
              }}
            >
              {musicTrack === 0 ? '①' : '②'}
            </button>
          )}

        </div>

      </div>

      {/* ── TOP-RIGHT: Turn tracker + action buttons ── */}
      <div
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 5,
          width: isMobile ? 160 : 290,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 8,
        }}
      >
        {/* System controls row — pause + reduce-motion */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={togglePause}
            title={paused ? 'SYSTEM HALTED — click to resume' : 'Pause game'}
            onMouseEnter={hPause.onMouseEnter}
            onMouseLeave={hPause.onMouseLeave}
            style={{
              ...BTN_BASE,
              flex: 1,
              background: paused ? 'rgba(255,153,0,0.18)' : 'transparent',
              border: `1px solid ${hPause.hovered ? (paused ? '#ff990088' : ACCENT + '66') : (paused ? '#ff990066' : ACCENT + '18')}`,
              color: hPause.hovered ? (paused ? '#ffbb44' : ACCENT) : (paused ? '#ff9900' : `${ACCENT}33`),
              fontSize: 10, letterSpacing: paused ? 1 : 0,
              transition: 'all 0.15s',
            }}
          >
            {paused ? '▶ RESUME' : 'Ⅱ PAUSE'}
          </button>
          <button
            onClick={() => setReducedMotion(!reducedMotion)}
            title={reducedMotion ? 'Reduced motion ON — click to restore' : 'Reduce animations'}
            onMouseEnter={hMotion.onMouseEnter}
            onMouseLeave={hMotion.onMouseLeave}
            style={{
              ...BTN_BASE,
              width: 44, minWidth: 44,
              background: reducedMotion ? `${ACCENT}18` : 'transparent',
              border: `1px solid ${hMotion.hovered ? ACCENT + '66' : reducedMotion ? ACCENT + '44' : ACCENT + '18'}`,
              color: (hMotion.hovered || reducedMotion) ? ACCENT : `${ACCENT}33`,
              fontSize: 13, letterSpacing: 0,
              transition: 'all 0.15s',
            }}
          >
            ✦
          </button>
        </div>


        {/* Status panel + scoreboard */}
        <div style={panelStyle}>
          <div style={{ fontSize: 10, color: `${ACCENT}88`, letterSpacing: 2, marginBottom: 4 }}>
            TURN {turnNumber} · {phase}
          </div>
          <div style={{ fontSize: 13, color: isHuman ? ACCENT : '#ff9955', fontWeight: 'bold', marginBottom: 10 }}>
            {isHuman ? '▶ YOUR TURN' : `⏳ ${currentPlayer?.name ?? '...'}`}
          </div>

          {/* Mini scoreboard */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {players.map(p => {
              const pct = Math.max(0, Math.min(100, (p.credits / startingPop) * 100));
              const isCurrent = p.id === currentPlayer?.id;
              const nameColor = p.eliminated ? '#334455'
                : p.isHuman ? ACCENT
                : isCurrent ? '#ff9955'
                : '#7788aa';
              const barColor = p.eliminated ? '#223344'
                : p.isHuman ? ACCENT
                : '#ff9955';
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: p.eliminated ? 0.4 : 1 }}>
                  {/* Turn indicator dot */}
                  <span style={{ width: 5, flexShrink: 0, fontSize: 8, color: isCurrent ? nameColor : 'transparent' }}>▶</span>
                  {/* Name */}
                  <span style={{
                    fontSize: 9, letterSpacing: 1, color: nameColor,
                    width: 68, flexShrink: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    textDecoration: p.eliminated ? 'line-through' : 'none',
                  }}>
                    {p.name}
                  </span>
                  {/* Bar */}
                  <div style={{
                    flex: 1, height: 4,
                    background: `${barColor}18`,
                    borderRadius: 2, overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: barColor,
                      borderRadius: 2,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  {/* Count */}
                  {!hidePpCounts && (
                    <span style={{ fontSize: 9, color: nameColor, letterSpacing: 0, width: 22, textAlign: 'right', flexShrink: 0 }}>
                      {p.credits}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>


        {/* Targeting banner — click an opponent on the board to select them */}
        {phase === 'TARGETING' && (
          <div style={{ ...panelStyle, borderColor: '#ff333388' }} className="hud-pulse">
            <div style={{ fontSize: 10, color: '#ff3333', letterSpacing: 3, marginBottom: 8 }}>
              SELECT A TARGET
            </div>
            <div style={{ fontSize: 10, color: '#667788', marginBottom: 10 }}>
              {validTargetIds.length} opponent{validTargetIds.length !== 1 ? 's' : ''} available
            </div>
            {!isForced && (
              <button style={{ ...btnDim('#ff3333'), borderColor: '#ff333344', color: '#ff3333aa' }} onClick={() => cancelTargeting()}>
                ✕ CANCEL
              </button>
            )}
          </div>
        )}

        {/* Multithread indicator — shown in top-right when extra plays are pending */}
        {phase === 'MAIN' && isHuman && extraPlayPending > 0 && (
          <div style={panelStyle}>
            <div style={{ fontSize: 10, color: `${ACCENT}`, letterSpacing: 3, marginBottom: 8 }}>
              ⟳ MULTITHREADING
            </div>
            <div style={{ fontSize: 10, color: '#667788', marginBottom: 10 }}>
              {extraPlayPending} more card{extraPlayPending > 1 ? 's' : ''} to play
            </div>
            <button
              onClick={() => cancelExtraPlays()}
              title="End your turn now without using remaining plays"
              style={{ ...btnDim(ACCENT), borderColor: `${ACCENT}44`, color: `${ACCENT}aa` }}
            >
              ✓ DONE
            </button>
          </div>
        )}

        {/* End turn — auto-advances after 900 ms; show a brief status flash */}
        {phase === 'END_TURN' && (
          <div style={{ ...panelStyle, opacity: 0.7 }}>
            <div style={{ fontSize: 10, color: `${ACCENT}88`, letterSpacing: 2 }}>
              TURN COMPLETE
            </div>
          </div>
        )}
      </div>

      {/* ── BEGIN SEQUENCE — centered inside the LED display ── */}
      {phase === 'PHASE_ROLL' && isHuman && rollReady && !rollTriggered && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, 30px)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            pointerEvents: 'auto',
            animation: 'hud-fade-in 0.2s ease-out forwards',
          }}
          onMouseDown={stopPhaser}
          onTouchStart={stopPhaser}
        >
          <div style={{ fontSize: 9, color: `${ACCENT}66`, letterSpacing: 4, fontFamily: 'monospace' }}>
            SEQUENCE READY
          </div>
          <button
            className={corruption ? 'corruption-pulse' : 'hud-pulse'}
            style={{
              ...primaryBtnStyle,
              width: isMobile ? 180 : 200,
              fontSize: isMobile ? 15 : 13,
              letterSpacing: 2,
              minHeight: 48,
            }}
            onClick={() => triggerRoll()}
          >
            ▶ BEGIN SEQUENCE
          </button>
        </div>
      )}

      {/* ── MAIN phase — play / discard anchored to bottom-centre ── */}
      {phase === 'MAIN' && isHuman && !anyOverlayActive && (
        <div
          style={{
            position: 'fixed',
            bottom: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            pointerEvents: 'auto',
            animation: 'protocol-slide-up 0.18s ease-out forwards',
          }}
          onMouseDown={stopPhaser}
          onTouchStart={stopPhaser}
        >
          {corruptionFirstActive && (
            <div style={{
              fontSize: 9, color: '#ff1e3caa', letterSpacing: 2,
              fontFamily: 'monospace', textAlign: 'center', marginBottom: 2,
            }}>
              ⚠ THE CORRUPTION MUST BE PLAYED FIRST
            </div>
          )}
          {!selectedCard && (
            <div style={{ fontSize: 10, color: `${ACCENT}33`, letterSpacing: 3, fontFamily: 'monospace' }}>
              {corruptionFirstActive ? 'SELECT THE CORRUPTION' : 'SELECT A CARD'}
            </div>
          )}
          {selectedCard && (
            <>
              <div style={{ fontSize: 10, color: `${ACCENT}aa`, letterSpacing: 2, fontFamily: 'monospace' }}>
                {selectedCard.name.toUpperCase()}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={corruption ? 'corruption-pulse' : 'hud-pulse'}
                  style={{
                    ...primaryBtnStyle,
                    width: isMobile ? 120 : 100,
                    fontSize: isMobile ? 14 : 12,
                    minHeight: 48,
                  }}
                  onClick={() => { sfxCardPlay(); playCard(selectedCard.id); }}
                >
                  PLAY
                </button>
                {!isForced && extraPlayPending === 0 && (
                  <button
                    style={{
                      ...dimBtnStyle,
                      width: isMobile ? 120 : 100,
                      fontSize: isMobile ? 14 : 12,
                      minHeight: 48,
                    }}
                    onClick={() => discardCard(selectedCard.id)}
                  >
                    DISCARD
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── BOTTOM: Activity Log strip ── */}
      {log.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            zIndex: 5,
            width: isMobile ? '100vw' : 340,
            fontFamily: 'monospace',
          }}
        >
          <div
            style={{
              background: 'rgba(5,5,15,0.92)',
              border: `1px solid ${ACCENT}22`,
              borderBottom: 'none',
              borderRadius: '6px 6px 0 0',
              overflow: 'hidden',
            }}
          >
            {/* Expanded history — grows upward */}
            {logExpanded && (
              <div
                className="log-scroll"
                style={{
                  maxHeight: isMobile ? 180 : 300,
                  overflowY: 'auto',
                  padding: '8px 14px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {log.map((entry, i) => (
                  <div key={entry.id} style={{
                    fontSize: 10, lineHeight: 1.65, letterSpacing: 0.5,
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

            {/* Header bar — always visible */}
            <button
              onClick={() => setLogExpanded(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '6px 14px',
                background: logExpanded ? `${ACCENT}08` : 'none',
                border: 'none',
                borderTop: logExpanded ? `1px solid ${ACCENT}18` : 'none',
                cursor: 'pointer',
                fontFamily: 'monospace', fontSize: 9,
                color: `${ACCENT}55`, letterSpacing: 2,
                minHeight: 36,
              }}
            >
              <span>ACTIVITY LOG</span>
              {/* Collapsed: show the latest entry as a preview */}
              {!logExpanded && logTail.length > 0 && (
                <span style={{
                  fontSize: 9, color: '#556677', letterSpacing: 0.3,
                  maxWidth: isMobile ? 140 : 200,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginLeft: 8, flex: 1, textAlign: 'right',
                }}>
                  {logTail[logTail.length - 1].text}
                </span>
              )}
              <span style={{ color: `${ACCENT}33`, marginLeft: 10, flexShrink: 0 }}>
                {logExpanded ? '▼' : `▲ ${log.length}`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ── DRAW CARD — anchored to bottom-centre ── */}
      {phase === 'DRAW' && isHuman && (
        <div
          style={{
            position: 'fixed',
            bottom: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            pointerEvents: 'auto',
            animation: 'protocol-slide-up 0.18s ease-out forwards',
          }}
          onMouseDown={stopPhaser}
          onTouchStart={stopPhaser}
        >
          <button
            className={corruption ? 'corruption-pulse' : 'hud-pulse'}
            style={{
              ...BTN_BASE,
              width: isMobile ? 150 : 120,
              background: `${ACCENT}18`,
              color: ACCENT,
              border: `1px solid ${ACCENT}88`,
              fontSize: isMobile ? 14 : 11,
              letterSpacing: 2,
              minHeight: 48,
            }}
            onClick={() => drawCard()}
          >
            DRAW CARD
          </button>
        </div>
      )}
      {/* ── HAND SORT — bottom-right, visible during gameplay ── */}
      {phase !== 'GAME_OVER' && (() => {
        const SORT_MODES: HandSortMode[] = ['DEFAULT', 'TYPE', 'VALUE', 'ALPHA'];
        const modeLabels: Record<HandSortMode, string> = { DEFAULT: 'DEF', TYPE: 'TYPE', VALUE: 'VAL', ALPHA: 'A–Z' };
        const nextMode = SORT_MODES[(SORT_MODES.indexOf(handSortMode) + 1) % SORT_MODES.length];
        const btnStyle: React.CSSProperties = {
          fontFamily: 'monospace', fontSize: 8, letterSpacing: 2,
          padding: '3px 7px', borderRadius: 3, cursor: 'pointer',
          background: 'rgba(5,5,15,0.88)', transition: 'all 0.12s',
          minHeight: 0,
        };
        return (
          <div
            style={{
              position: 'fixed', bottom: 92, right: 14, zIndex: 6,
              display: 'flex', alignItems: 'center', gap: 4,
              pointerEvents: 'auto',
            }}
            onMouseDown={stopPhaser}
            onTouchStart={stopPhaser}
          >
            <span style={{ fontFamily: 'monospace', fontSize: 7, color: `${ACCENT}44`, letterSpacing: 2 }}>SORT</span>
            <button
              title={`Sort: ${handSortMode} — click to change to ${nextMode}`}
              style={{
                ...btnStyle,
                border: `1px solid ${hSortMode.hovered ? ACCENT : handSortMode !== 'DEFAULT' ? ACCENT + '88' : ACCENT + '33'}`,
                color: (hSortMode.hovered || handSortMode !== 'DEFAULT') ? ACCENT : `${ACCENT}66`,
              }}
              onClick={() => setHandSort(nextMode, handSortReverse)}
              onMouseEnter={hSortMode.onMouseEnter}
              onMouseLeave={hSortMode.onMouseLeave}
            >
              {modeLabels[handSortMode]}
            </button>
            <button
              title={handSortReverse ? 'Reversed — click to restore' : 'Click to reverse sort order'}
              style={{
                ...btnStyle,
                border: `1px solid ${hSortRev.hovered ? ACCENT : handSortReverse ? ACCENT + '88' : ACCENT + '33'}`,
                color: (hSortRev.hovered || handSortReverse) ? ACCENT : `${ACCENT}44`,
              }}
              onClick={() => setHandSort(handSortMode, !handSortReverse)}
              onMouseEnter={hSortRev.onMouseEnter}
              onMouseLeave={hSortRev.onMouseLeave}
            >
              ⇅
            </button>
          </div>
        );
      })()}
    </>
  );
}
