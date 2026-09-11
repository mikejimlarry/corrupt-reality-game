import type { CSSProperties } from 'react';
import { useGameStore, mustPlayCorruptionFirst } from '../state/useGameStore';
import type { DaemonCard } from '../types/cards';
import { getCardDisabledReason, isCorruptionCard } from '../lib/cardPlayability';
import { sfxCardPlay } from '../lib/audio';
import { OverlayShell } from './OverlayShell';

interface Props {
  onClose: () => void;
}

const sectionStyle: CSSProperties = {
  borderTop: '1px solid #00ffcc33',
  paddingTop: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const buttonStyle: CSSProperties = {
  minHeight: 44,
  padding: '10px 12px',
  border: '1px solid #00ffcc66',
  background: 'transparent',
  color: 'var(--crg-text)',
  fontFamily: 'monospace',
  fontSize: '0.75rem',
  lineHeight: 1.5,
  textAlign: 'left',
  cursor: 'pointer',
};

const categoryNames: Record<string, string> = {
  CYCLES: 'Cycles',
  EVENT_POSITIVE: 'Positive protocol',
  EVENT_NEGATIVE: 'Hack protocol',
  WAR: 'Conflict',
  COUNTER: 'Countermeasure',
  DAEMON: 'Daemon',
};

export function AccessibleCommandPanel({ onClose }: Props) {
  const phase = useGameStore(state => state.phase);
  const players = useGameStore(state => state.players);
  const currentPlayerIndex = useGameStore(state => state.currentPlayerIndex);
  const turnNumber = useGameStore(state => state.turnNumber);
  const selectedCardId = useGameStore(state => state.selectedCardId);
  const validTargetIds = useGameStore(state => state.validTargetIds);
  const extraPlayPending = useGameStore(state => state.extraPlayPending);
  const corruptionPendingTarget = useGameStore(state => state.corruptionPendingTarget);
  const tutorialStep = useGameStore(state => state.tutorialStep);
  const tutorialModalOpen = useGameStore(state => state.tutorialModalOpen);
  const gameStats = useGameStore(state => state.gameStats);
  const rollTriggered = useGameStore(state => state.rollTriggered);
  const selectCard = useGameStore(state => state.selectCard);
  const selectTarget = useGameStore(state => state.selectTarget);
  const cancelTargeting = useGameStore(state => state.cancelTargeting);
  const playCard = useGameStore(state => state.playCard);
  const discardCard = useGameStore(state => state.discardCard);
  const triggerRoll = useGameStore(state => state.triggerRoll);
  const drawCard = useGameStore(state => state.drawCard);

  const currentPlayer = players[currentPlayerIndex];
  const human = players.find(player => player.isHuman);
  const selectedCard = human?.hand.find(card => card.id === selectedCardId) ?? null;
  const corruptionFirstActive = !!human && currentPlayer?.isHuman && mustPlayCorruptionFirst(human, gameStats);
  const forced = isCorruptionCard(selectedCard) || corruptionPendingTarget || corruptionFirstActive;
  const disabledReason = getCardDisabledReason(
    selectedCard,
    human,
    corruptionFirstActive,
    extraPlayPending,
    tutorialStep,
    tutorialModalOpen,
  );
  const discardOnly = selectedCard?.category === 'DAEMON' &&
    !!human?.daemons.includes((selectedCard as DaemonCard).daemonType);

  return (
    <OverlayShell
      ariaLabel="Accessible game commands"
      background="rgba(2,4,12,0.96)"
      zIndex={600}
      maxWidth={620}
      onBackdropClick={onClose}
      onRequestClose={onClose}
      panelStyle={{
        border: '1px solid #00ffcc66',
        borderTop: '2px solid var(--crg-signal)',
        borderRadius: 8,
        background: 'var(--crg-panel)',
        color: 'var(--crg-text)',
        padding: '20px',
        fontFamily: 'monospace',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ color: 'var(--crg-muted)', fontSize: '0.75rem', letterSpacing: 3 }}>KEYBOARD COMMAND PATH</div>
          <h2 style={{ margin: '4px 0 0', color: 'var(--crg-signal)', fontSize: '1rem', letterSpacing: 3 }}>GAME COMMANDS</h2>
        </div>
        <button type="button" onClick={onClose} className="crg-btn-cyan" style={{ ...buttonStyle, width: 'auto' }}>
          CLOSE
        </button>
      </header>

      <p role="status" style={{ color: 'var(--crg-body)', fontSize: '0.875rem', lineHeight: 1.6 }}>
        Turn {turnNumber}. {currentPlayer?.isHuman ? 'Your turn' : `${currentPlayer?.name ?? 'Opponent'} is acting`}. Phase: {phase.replace('_', ' ')}.
      </p>

      {currentPlayer?.isHuman && phase === 'PHASE_ROLL' && !rollTriggered && (
        <section style={sectionStyle} aria-labelledby="phase-action-heading">
          <h3 id="phase-action-heading" style={{ margin: 0, fontSize: '0.75rem', letterSpacing: 2 }}>REQUIRED ACTION</h3>
          <button type="button" onClick={triggerRoll} className="crg-btn-cyan" style={{ ...buttonStyle, color: 'var(--crg-signal)' }}>
            BEGIN SEQUENCE
          </button>
        </section>
      )}

      {currentPlayer?.isHuman && phase === 'DRAW' && (
        <section style={sectionStyle} aria-labelledby="draw-action-heading">
          <h3 id="draw-action-heading" style={{ margin: 0, fontSize: '0.75rem', letterSpacing: 2 }}>REQUIRED ACTION</h3>
          <button type="button" onClick={drawCard} className="crg-btn-cyan" style={{ ...buttonStyle, color: 'var(--crg-signal)' }}>
            DRAW CARD
          </button>
        </section>
      )}

      {phase === 'TARGETING' && (
        <section style={sectionStyle} aria-labelledby="target-heading">
          <h3 id="target-heading" style={{ margin: 0, fontSize: '0.75rem', letterSpacing: 2 }}>SELECT A TARGET</h3>
          {players.filter(player => validTargetIds.includes(player.id)).map(player => (
            <button
              key={player.id}
              type="button"
              onClick={() => selectTarget(player.id)}
              className="crg-btn-red"
              style={buttonStyle}
            >
              {player.name}: {player.cycles} cycles, {player.daemons.length} active daemon{player.daemons.length === 1 ? '' : 's'}
            </button>
          ))}
          {!forced && (
            <button type="button" onClick={cancelTargeting} className="crg-btn-dismiss-red" style={buttonStyle}>
              CANCEL TARGETING
            </button>
          )}
        </section>
      )}

      {human && (phase === 'MAIN' || phase === 'TARGETING') && (
        <section style={sectionStyle} aria-labelledby="hand-heading">
          <h3 id="hand-heading" style={{ margin: 0, fontSize: '0.75rem', letterSpacing: 2 }}>YOUR HAND</h3>
          <p style={{ margin: 0, color: 'var(--crg-body)', fontSize: '0.75rem', lineHeight: 1.6 }}>
            Choose a card to inspect it at a readable size. Countermeasures remain listed but activate only when a conflict asks for one.
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {human.hand.map((card, index) => (
              <button
                key={card.id}
                type="button"
                aria-pressed={card.id === selectedCardId}
                onClick={() => selectCard(card.id === selectedCardId ? null : card.id)}
                style={{
                  ...buttonStyle,
                  borderColor: card.id === selectedCardId ? 'var(--crg-signal)' : '#00ffcc44',
                  color: card.id === selectedCardId ? 'var(--crg-signal)' : 'var(--crg-text)',
                  background: card.id === selectedCardId ? '#00ffcc14' : 'transparent',
                }}
              >
                {index + 1}. {card.name}. {categoryNames[card.category]}. {card.description}
              </button>
            ))}
          </div>
        </section>
      )}

      {selectedCard && phase === 'MAIN' && (
        <section style={sectionStyle} aria-labelledby="selected-card-heading">
          <h3 id="selected-card-heading" style={{ margin: 0, color: 'var(--crg-signal)', fontSize: '1rem' }}>{selectedCard.name}</h3>
          <p style={{ margin: 0, color: 'var(--crg-text)', fontSize: '0.875rem', lineHeight: 1.7 }}>{selectedCard.description}</p>
          {disabledReason && <p role="alert" style={{ margin: 0, color: 'var(--crg-text)', fontSize: '0.75rem' }}>{disabledReason}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {!discardOnly && (
              <button
                type="button"
                disabled={disabledReason !== null}
                onClick={() => { sfxCardPlay(); playCard(selectedCard.id); }}
                className="crg-btn-cyan"
                style={{ ...buttonStyle, flex: '1 1 180px', color: 'var(--crg-signal)', opacity: disabledReason ? 0.45 : 1 }}
              >
                PLAY {selectedCard.name.toUpperCase()}
              </button>
            )}
            {!forced && extraPlayPending === 0 && (
              <button
                type="button"
                onClick={() => discardCard(selectedCard.id)}
                className="crg-btn-dismiss-teal"
                style={{ ...buttonStyle, flex: '1 1 180px' }}
              >
                DISCARD {selectedCard.name.toUpperCase()}
              </button>
            )}
          </div>
        </section>
      )}
    </OverlayShell>
  );
}
