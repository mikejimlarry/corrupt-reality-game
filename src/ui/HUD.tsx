// src/ui/HUD.tsx
import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useGameStore, mustPlayCorruptionFirst } from '../state/useGameStore';
import type { HandSortMode } from '../state/useGameStore';
import type { DaemonCard, NegativeEventCard } from '../types/cards';
import { AccessibleCommandPanel } from './AccessibleCommandPanel';
import { sfxCardPlay, getMusicEnabled, setMusicEnabled, sfxToggleOn, sfxToggleOff, getMusicTrack, nextMusicTrack } from '../lib/audio';
import { trackEvent } from '../lib/analytics';
import { getViewportLayout } from '../game/layout';
import { getCardDisabledReason, isCorruptionCard } from '../lib/cardPlayability';
import { COLORS, alpha } from '../theme/tokens';

const HelpModal = lazy(() => import('./HelpModal').then(module => ({ default: module.HelpModal })));

const PULSE_STYLE = `
@keyframes log-cursor-blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
.log-cursor { animation: log-cursor-blink 1s step-end infinite; }

@keyframes hud-pulse {
  0%, 100% { box-shadow: 0 0 6px 1px rgba(0,255,204,0.25), 0 0 0 1px rgba(0,255,204,0.15); }
  50%       { box-shadow: 0 0 22px 4px rgba(0,255,204,0.65), 0 0 0 1px rgba(0,255,204,0.45); }
}
.hud-pulse {
  box-shadow: 0 0 10px 2px rgba(0,255,204,0.38), 0 0 0 1px rgba(0,255,204,0.24);
  animation: hud-pulse 1.4s ease-in-out infinite;
}

@keyframes corruption-pulse {
  0%, 100% { box-shadow: 0 0 8px 2px rgba(255,30,60,0.35), 0 0 0 1px rgba(255,30,60,0.25); }
  50%       { box-shadow: 0 0 28px 6px rgba(255,30,60,0.75), 0 0 0 1px rgba(255,30,60,0.55); }
}
.corruption-pulse {
  box-shadow: 0 0 12px 2px rgba(255,30,60,0.48), 0 0 0 1px rgba(255,30,60,0.32);
  animation: corruption-pulse 1.1s ease-in-out infinite;
}

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
    color: COLORS.text,
  };
}

function btnPrimary(accent: string): React.CSSProperties {
  return { ...BTN_BASE, background: accent, color: COLORS.void };
}

function btnDim(accent: string): React.CSSProperties {
  return {
    ...BTN_BASE,
    background: `${accent}1a`,
    color: accent,
    border: `1px solid ${accent}33`,
  };
}

function fmtUptime(s: number) {
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function SystemUptime() {
  const [uptime, setUptime] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setUptime(value => value + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div style={{ fontSize: 12, color: 'var(--crg-muted)', letterSpacing: 2, marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
      SYS {fmtUptime(uptime)}
    </div>
  );
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
  const tutorialStep             = useGameStore(s => s.tutorialStep);
  const tutorialModalOpen        = useGameStore(s => s.tutorialModalOpen);
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

  const ACCENT = corruption ? COLORS.corruption : COLORS.signal;

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

  const { w: winW, h: winH } = useWindowSize();
  const viewportLayout = getViewportLayout(winW, winH);
  const isMobile = viewportLayout.isNarrow;
  const compactLandscape = viewportLayout.compactLandscape;

  // Freeze the scoreboard during the war dice animation so credit counts/bars
  // don't reveal the outcome before the result is shown.
  const [displayPlayers, setDisplayPlayers] = useState(allPlayers);
  useEffect(() => {
    if (!warRollDisplay) {
      const t = setTimeout(() => setDisplayPlayers(allPlayers), 0);
      return () => clearTimeout(t);
    }
  }, [allPlayers, warRollDisplay]);
  const players = displayPlayers;

  const [logExpanded, setLogExpanded] = useState(false);
  const [showHelp, setShowHelp]       = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [musicOn, setMusicOn]         = useState(() => getMusicEnabled());
  const [musicTrack, setMusicTrack]   = useState(() => getMusicTrack());

  useEffect(() => {
    const openCommands = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'c' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      event.preventDefault();
      setShowCommands(true);
    };
    window.addEventListener('keydown', openCommands);
    return () => window.removeEventListener('keydown', openCommands);
  }, []);

  // True once the LED panel's unfold animation fires 'crg:led-open'.
  // Reset whenever the phase leaves PHASE_ROLL so stale events don't bleed through.
  const [rollReady, setRollReady] = useState(false);
  useEffect(() => {
    if (phase !== 'PHASE_ROLL') return;
    const reset = window.setTimeout(() => setRollReady(false), 0);
    const fallback = window.setTimeout(() => setRollReady(true), 3000);
    const handler = () => {
      window.clearTimeout(fallback);
      setRollReady(true);
    };
    window.addEventListener('crg:led-open', handler);
    return () => {
      window.clearTimeout(reset);
      window.clearTimeout(fallback);
      window.removeEventListener('crg:led-open', handler);
    };
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
      c => c.category === 'EVENT_NEGATIVE' && (c as NegativeEventCard).effect === 'CORRUPTION',
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
    ? (players.find(p => p.isHuman)?.hand.find(c => c.id === selectedCardId) ?? null)
    : null;
  const logTail = log.slice(-3);

  // Whether the selected card is a forced play (The Corruption) — no discard allowed
  const humanPlayer = players.find(p => p.isHuman);
  const corruptionFirstActive = isHuman && !!humanPlayer && mustPlayCorruptionFirst(humanPlayer, gameStats);
  const isForced = isCorruptionCard(selectedCard) || corruptionPendingTarget || corruptionFirstActive;
  const disabledReason = getCardDisabledReason(
    selectedCard,
    humanPlayer,
    corruptionFirstActive,
    extraPlayPending,
    tutorialStep,
    tutorialModalOpen,
  );

  // Already-installed daemon — can discard but not play
  const isDiscardOnly = selectedCard?.category === 'DAEMON' &&
    !!humanPlayer?.daemons.includes((selectedCard as DaemonCard).daemonType);
  const canPlaySelected = !!selectedCard && disabledReason === null;

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
      <Suspense fallback={<div className="sr-only" role="status">Loading Field Manual…</div>}>
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      </Suspense>
      {showCommands && <AccessibleCommandPanel onClose={() => setShowCommands(false)} />}

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Turn {turnNumber}. {isHuman ? 'Your turn' : `${currentPlayer?.name ?? 'Opponent'} is acting`}. Phase {phase.replace('_', ' ')}.
        {selectedCard ? ` Selected card: ${selectedCard.name}. ${selectedCard.description}` : ''}
        {log.length > 0 ? ` Latest activity: ${log[log.length - 1].text}` : ''}
      </div>

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
            type="button"
            onClick={() => { setShowHelp(true); trackEvent('help_opened', { source: 'hud' }); }}
            aria-label="Open field manual"
            onMouseEnter={hFieldManual.onMouseEnter}
            onMouseLeave={hFieldManual.onMouseLeave}
            style={{
              ...BTN_BASE,
              flex: isMobile ? '0 0 44px' : '1 1 auto',
              width: isMobile ? 44 : 'auto',
              minWidth: isMobile ? 44 : 0,
              background: hFieldManual.hovered ? `${ACCENT}22` : 'transparent',
              border: `1px solid ${hFieldManual.hovered ? ACCENT : ACCENT + '44'}`,
              color: ACCENT,
              fontSize: isMobile ? 14 : 10,
              letterSpacing: isMobile ? 0 : 2,
              padding: '6px 10px',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {isMobile ? '?' : '? MANUAL'}
          </button>

          {/* Music toggle */}
          <button
            type="button"
            onClick={handleMusicToggle}
            aria-label={musicOn ? 'Mute music' : 'Unmute music'}
            aria-pressed={musicOn}
            title={musicOn ? 'Music ON — click to mute' : 'Music OFF — click to unmute'}
            onMouseEnter={hMusic.onMouseEnter}
            onMouseLeave={hMusic.onMouseLeave}
            style={{
              ...BTN_BASE,
              width: 44,
              minWidth: 44,
              flexShrink: 0,
              padding: '6px 10px',
              background: musicOn ? `${ACCENT}18` : 'transparent',
              border: `1px solid ${hMusic.hovered ? ACCENT + '66' : musicOn ? ACCENT + '44' : ACCENT + '18'}`,
              color: (hMusic.hovered || musicOn) ? ACCENT : COLORS.muted,
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
              type="button"
              onClick={handleTrackSwitch}
              aria-label={`Select next music track. Track ${musicTrack + 1} is active.`}
              title={`Track ${musicTrack + 1} — click to switch`}
              onMouseEnter={hTrack.onMouseEnter}
              onMouseLeave={hTrack.onMouseLeave}
              style={{
                ...BTN_BASE,
                width: 44,
                minWidth: 44,
                flexShrink: 0,
                padding: '6px 10px',
                background: `${ACCENT}18`,
                border: `1px solid ${hTrack.hovered ? ACCENT + '66' : ACCENT + '33'}`,
                color: ACCENT,
                fontSize: 12,
                letterSpacing: 0,
                transition: 'all 0.15s',
              }}
            >
              {musicTrack === 0 ? '①' : '②'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCommands(true)}
            aria-label="Open accessible game commands"
            aria-keyshortcuts="C"
            title="Game commands (C)"
            style={{
              ...BTN_BASE,
              width: isMobile ? 44 : 92,
              minWidth: isMobile ? 44 : 92,
              flexShrink: 0,
              padding: '6px 8px',
              background: 'transparent',
              border: `1px solid ${ACCENT}44`,
              color: ACCENT,
              fontSize: 12,
              letterSpacing: isMobile ? 1 : 2,
              whiteSpace: 'nowrap',
            }}
          >
            {isMobile ? 'CMD' : 'COMMANDS'}
          </button>

        </div>

      </div>

      {/* ── TOP-RIGHT: Turn tracker + action buttons ── */}
      <div
        style={{
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 5,
          width: compactLandscape ? 150 : isMobile ? 160 : 290,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: compactLandscape ? 4 : 8,
        }}
      >
        {/* System controls row — pause + reduce-motion */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={togglePause}
            aria-label={paused ? 'Resume game' : 'Pause game'}
            aria-pressed={paused}
            title={paused ? 'SYSTEM HALTED — click to resume' : 'Pause game'}
            onMouseEnter={hPause.onMouseEnter}
            onMouseLeave={hPause.onMouseLeave}
            style={{
              ...BTN_BASE,
              flex: 1,
              background: paused ? alpha(COLORS.conflict, 0.18) : 'transparent',
              border: `1px solid ${hPause.hovered ? (paused ? COLORS.conflict : ACCENT + '66') : (paused ? alpha(COLORS.conflict, 0.5) : ACCENT + '18')}`,
              color: hPause.hovered ? (paused ? COLORS.conflict : ACCENT) : (paused ? COLORS.conflict : COLORS.muted),
              fontSize: 10, letterSpacing: paused ? 1 : 0,
              transition: 'all 0.15s',
            }}
          >
            {paused ? '▶ RESUME' : 'Ⅱ PAUSE'}
          </button>
          <button
            type="button"
            onClick={() => setReducedMotion(!reducedMotion)}
            aria-label={reducedMotion ? 'Disable reduced motion' : 'Enable reduced motion'}
            aria-pressed={reducedMotion}
            title={reducedMotion ? 'Reduced motion ON — click to restore' : 'Reduce animations'}
            onMouseEnter={hMotion.onMouseEnter}
            onMouseLeave={hMotion.onMouseLeave}
            style={{
              ...BTN_BASE,
              width: 44, minWidth: 44,
              background: reducedMotion ? `${ACCENT}18` : 'transparent',
              border: `1px solid ${hMotion.hovered ? ACCENT + '66' : reducedMotion ? ACCENT + '44' : ACCENT + '18'}`,
              color: (hMotion.hovered || reducedMotion) ? ACCENT : COLORS.muted,
              fontSize: 13, letterSpacing: 0,
              transition: 'all 0.15s',
            }}
          >
            ✦
          </button>
        </div>


        {/* Status panel + scoreboard */}
        <div style={{ ...panelStyle, padding: compactLandscape ? '6px 8px' : panelStyle.padding }}>
          <div style={{ fontSize: 12, color: 'var(--crg-text)', letterSpacing: 2, marginBottom: 2 }}>
            TURN {turnNumber} · {phase}
          </div>
          {!compactLandscape && <SystemUptime />}
          <div style={{ display: compactLandscape ? 'none' : undefined, fontSize: 13, color: isHuman ? ACCENT : COLORS.conflict, fontWeight: 'bold', marginBottom: 10 }}>
            {isHuman ? '▶ YOUR TURN' : `◌ ${currentPlayer?.name ?? '...'}`}
          </div>

          {/* Mini scoreboard */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: compactLandscape ? 2 : 5 }}>
            {players.map(p => {
              const pct = Math.max(0, Math.min(100, (p.cycles / startingPop) * 100));
              const isCurrent = p.id === currentPlayer?.id;
              const nameColor = p.eliminated ? '#778899'
                : p.isHuman ? ACCENT
                : isCurrent ? COLORS.conflict
                : '#7788aa';
              const barColor = p.eliminated ? '#223344'
                : p.isHuman ? ACCENT
                : COLORS.conflict;
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: p.eliminated ? 0.4 : 1 }}>
                  {/* Turn indicator dot */}
                  <span style={{ width: 8, flexShrink: 0, fontSize: 11, color: isCurrent ? nameColor : 'transparent' }}>▶</span>
                  {/* Name */}
                  <span style={{
                    fontSize: 12, letterSpacing: 1, color: nameColor,
                    width: compactLandscape ? 45 : 68, flexShrink: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    textDecoration: p.eliminated ? 'line-through' : 'none',
                  }}>
                    {p.name}
                  </span>
                  {compactLandscape && (
                    <span title={`${p.daemons.length} active daemon${p.daemons.length === 1 ? '' : 's'}`} style={{ fontSize: 11, color: nameColor, width: 18, flexShrink: 0 }}>
                      D{p.daemons.length}
                    </span>
                  )}
                  {/* Bar */}
                  <div style={{
                    flex: 1, height: 4,
                    background: `${barColor}18`,
                    borderRadius: 2, overflow: 'hidden',
                  }}>
                    <div style={{
                      width: '100%', height: '100%',
                      background: barColor,
                      borderRadius: 2,
                      transform: `scaleX(${pct / 100})`,
                      transformOrigin: 'left center',
                      transition: 'transform 0.4s ease',
                    }} />
                  </div>
                  {/* Count */}
                  {!hidePpCounts && (
                    <span style={{ fontSize: 12, color: nameColor, letterSpacing: 0, width: 28, textAlign: 'right', flexShrink: 0 }}>
                      {p.cycles}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>


        {/* Targeting banner — click an opponent on the board to select them */}
        {phase === 'TARGETING' && (
          <div style={{ ...panelStyle, borderColor: alpha(COLORS.rival, 0.6) }} className="hud-pulse">
            <div style={{ fontSize: 11, color: COLORS.rival, letterSpacing: 3, marginBottom: 8 }}>
              SELECT A TARGET
            </div>
            <div style={{ fontSize: 12, color: 'var(--crg-muted)', marginBottom: 10 }}>
              {validTargetIds.length} opponent{validTargetIds.length !== 1 ? 's' : ''} available
            </div>
            {!isForced && (
              <button type="button" style={{ ...btnDim(COLORS.rival), borderColor: alpha(COLORS.rival, 0.5), color: COLORS.rival }} onClick={() => cancelTargeting()}>
                ✕ CANCEL
              </button>
            )}
          </div>
        )}

        {/* Multitask indicator — shown in top-right when extra plays are pending */}
        {phase === 'MAIN' && isHuman && extraPlayPending > 0 && (
          <div style={panelStyle}>
            <div style={{ fontSize: 11, color: ACCENT, letterSpacing: 3, marginBottom: 8 }}>
              ⟳ MULTITASKING
            </div>
            <div style={{ fontSize: 12, color: 'var(--crg-muted)', marginBottom: 10 }}>
              {extraPlayPending} more card{extraPlayPending > 1 ? 's' : ''} to play
            </div>
            <button
              type="button"
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
            <div style={{ fontSize: 11, color: 'var(--crg-muted)', letterSpacing: 2 }}>
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
          <div style={{ fontSize: 11, color: 'var(--crg-muted)', letterSpacing: 3, fontFamily: 'monospace' }}>
            SEQUENCE READY
          </div>
          <button
            type="button"
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
            bottom: viewportLayout.actionBottom,
            left: compactLandscape ? 'auto' : '50%',
            right: compactLandscape ? 12 : 'auto',
            transform: compactLandscape ? 'none' : 'translateX(-50%)',
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
              fontSize: 11, color: COLORS.corruption, letterSpacing: 2,
              fontFamily: 'monospace', textAlign: 'center', marginBottom: 2,
            }}>
              ⚠ THE CORRUPTION MUST BE PLAYED FIRST
            </div>
          )}
          {!selectedCard && (
            <div style={{ fontSize: 11, color: 'var(--crg-muted)', letterSpacing: 3, fontFamily: 'monospace' }}>
              {corruptionFirstActive ? 'SELECT THE CORRUPTION' : 'SELECT A CARD'}
            </div>
          )}
          {selectedCard && (
            <>
              <div style={{ fontSize: 11, color: ACCENT, letterSpacing: 2, fontFamily: 'monospace' }}>
                {selectedCard.name.toUpperCase()}
              </div>
              {compactLandscape && (
                <button
                  type="button"
                  onClick={() => setShowCommands(true)}
                  style={{ ...dimBtnStyle, width: 100, minHeight: 44, color: ACCENT }}
                >
                  DETAILS
                </button>
              )}
              <div style={{ display: 'flex', flexDirection: compactLandscape ? 'column' : 'row', gap: compactLandscape ? 4 : 8 }}>
                {canPlaySelected && !isDiscardOnly && (
                  <button
                    type="button"
                    className={corruption ? 'corruption-pulse' : 'hud-pulse'}
                    style={{
                      ...primaryBtnStyle,
                      width: compactLandscape ? 100 : isMobile ? 120 : 100,
                      fontSize: isMobile ? 14 : 12,
                      minHeight: 48,
                    }}
                    onClick={() => { sfxCardPlay(); playCard(selectedCard.id); }}
                  >
                    PLAY
                  </button>
                )}
                {!isForced && extraPlayPending === 0 && (
                  <button
                    type="button"
                    style={{
                      ...dimBtnStyle,
                      width: compactLandscape ? 100 : isMobile ? 120 : 100,
                      fontSize: isMobile ? 14 : 12,
                      minHeight: 48,
                    }}
                    onClick={() => discardCard(selectedCard.id)}
                  >
                    DISCARD
                  </button>
                )}
              </div>
              {disabledReason && (
                <div style={{
                  maxWidth: isMobile ? 260 : 360,
                  padding: '6px 10px',
                  border: `1px solid ${ACCENT}22`,
                  background: 'rgba(5,5,15,0.86)',
                  color: corruptionFirstActive ? COLORS.rival : COLORS.text,
                  fontSize: 11,
                  letterSpacing: 1,
                  lineHeight: 1.4,
                  textAlign: 'center',
                  fontFamily: 'monospace',
                }}>
                  {disabledReason.toUpperCase()}
                </div>
              )}
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
            width: (isMobile || compactLandscape) ? '100vw' : 340,
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
                  maxHeight: compactLandscape ? 'calc(100dvh - 48px)' : isMobile ? 180 : 300,
                  overflowY: 'auto',
                  padding: '8px 14px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {log.map((entry, i) => (
                  <div key={entry.id} style={{
                    fontSize: 12, lineHeight: 1.65, letterSpacing: 0.5,
                    color: i === log.length - 1 ? COLORS.text : COLORS.muted,
                    borderLeft: entry.type === 'turn'   ? `2px solid ${ACCENT}33` :
                                entry.type === 'card'   ? '2px solid #aa44ff55' :
                                entry.type === 'effect' ? '2px solid #ff996655' :
                                entry.type === 'combat' ? '2px solid #ff336655' : 'none',
                    paddingLeft: entry.type !== 'roll' ? 6 : 0,
                  }}>
                    {entry.text}
                    {i === log.length - 1 && (
                      <span className="log-cursor" style={{ color: ACCENT, marginLeft: 2 }}>█</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Header bar — always visible */}
            <button
              type="button"
              onClick={() => setLogExpanded(v => !v)}
              aria-expanded={logExpanded}
              aria-label={`${logExpanded ? 'Collapse' : 'Expand'} activity log`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '6px 14px',
                background: logExpanded ? `${ACCENT}08` : 'none',
                border: 'none',
                borderTop: logExpanded ? `1px solid ${ACCENT}18` : 'none',
                cursor: 'pointer',
                fontFamily: 'monospace', fontSize: 11,
                color: COLORS.muted, letterSpacing: 2,
                minHeight: 44,
              }}
            >
              <span>ACTIVITY LOG</span>
              {/* Collapsed: show the latest entry as a preview */}
              {!logExpanded && logTail.length > 0 && (
                <span style={{
                  fontSize: 12, color: 'var(--crg-muted)', letterSpacing: 0.3,
                  maxWidth: isMobile ? 140 : 200,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginLeft: 8, flex: 1, textAlign: 'right',
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  gap: 2,
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {logTail[logTail.length - 1].text}
                  </span>
                  <span className="log-cursor" style={{ color: ACCENT, flexShrink: 0 }}>█</span>
                </span>
              )}
              <span style={{ color: ACCENT, marginLeft: 10, flexShrink: 0 }}>
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
            bottom: viewportLayout.actionBottom,
            left: compactLandscape ? 'auto' : '50%',
            right: compactLandscape ? 12 : 'auto',
            transform: compactLandscape ? 'none' : 'translateX(-50%)',
            zIndex: 10,
            pointerEvents: 'auto',
            animation: 'protocol-slide-up 0.18s ease-out forwards',
          }}
          onMouseDown={stopPhaser}
          onTouchStart={stopPhaser}
        >
          <button
            type="button"
            className={corruption ? 'corruption-pulse' : 'hud-pulse'}
            style={{
              ...BTN_BASE,
              width: isMobile ? 150 : 120,
              background: ACCENT,
              color: COLORS.void,
              border: `1px solid ${ACCENT}`,
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
      {(phase === 'MAIN' || phase === 'DRAW') && !(selectedCard && (isMobile || compactLandscape)) && (() => {
        const SORT_MODES: HandSortMode[] = ['DEFAULT', 'TYPE', 'VALUE', 'ALPHA'];
        const modeLabels: Record<HandSortMode, string> = { DEFAULT: 'DEF', TYPE: 'TYPE', VALUE: 'VAL', ALPHA: 'A–Z' };
        const nextMode = SORT_MODES[(SORT_MODES.indexOf(handSortMode) + 1) % SORT_MODES.length];
        const btnStyle: React.CSSProperties = {
          fontFamily: 'monospace', fontSize: 12, letterSpacing: 1,
          padding: '6px 9px', borderRadius: 3, cursor: 'pointer',
          background: 'rgba(5,5,15,0.88)', transition: 'all 0.12s',
          minWidth: 44, minHeight: 44,
        };
        return (
          <div
            style={{
              position: 'fixed', bottom: (isMobile && !compactLandscape) ? viewportLayout.actionBottom : 92, right: 14, zIndex: 6,
              display: 'flex', alignItems: 'center', gap: 4,
              pointerEvents: 'auto',
            }}
            onMouseDown={stopPhaser}
            onTouchStart={stopPhaser}
          >
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--crg-muted)', letterSpacing: 2 }}>SORT</span>
            <button
              type="button"
              title={`Sort: ${handSortMode} — click to change to ${nextMode}`}
              aria-label={`Sort hand by ${nextMode.toLowerCase()}`}
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
              type="button"
              title={handSortReverse ? 'Reversed — click to restore' : 'Click to reverse sort order'}
              aria-label="Reverse hand sort order"
              aria-pressed={handSortReverse}
              style={{
                ...btnStyle,
                border: `1px solid ${hSortRev.hovered ? ACCENT : handSortReverse ? ACCENT + '88' : ACCENT + '33'}`,
                color: (hSortRev.hovered || handSortReverse) ? ACCENT : COLORS.muted,
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
