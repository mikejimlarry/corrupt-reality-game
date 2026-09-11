import { TUTORIAL_REQUIRED_CARD } from '../data/tutorial';
import type { Card, DaemonCard, NegativeEventCard, PositiveEventCard } from '../types/cards';
import type { PlayerState } from '../types/gameState';

export function isCorruptionCard(card: Card | null): boolean {
  return !!card &&
    card.category === 'EVENT_NEGATIVE' &&
    (card as NegativeEventCard).effect === 'CORRUPTION';
}

export function getCardDisabledReason(
  card: Card | null,
  humanPlayer: PlayerState | undefined,
  corruptionFirstActive: boolean,
  extraPlayPending: number,
  tutorialStep: number | null,
  tutorialModalOpen: boolean,
): string | null {
  if (!card) return null;
  if (corruptionFirstActive && !isCorruptionCard(card)) {
    return 'The Corruption must be played first.';
  }
  if (extraPlayPending > 0) {
    const isMultitask = card.category === 'EVENT_POSITIVE' &&
      (card as PositiveEventCard).effect === 'EXTRA_PLAY';
    if (card.category === 'WAR') return 'Conflict cards cannot be played during Multitask.';
    if (card.category === 'COUNTER') return 'Countermeasures are reactive and cannot be used for Multitask.';
    if (isMultitask) return 'Multitask cannot chain into another Multitask.';
  }
  if (card.category === 'COUNTER') {
    return 'Countermeasures trigger during conflicts, not from your hand.';
  }
  if (card.category === 'DAEMON' && humanPlayer?.daemons.includes((card as DaemonCard).daemonType)) {
    return `${card.name} is already active. Discard it or choose another card.`;
  }
  if (tutorialStep !== null) {
    if (tutorialModalOpen) return 'Dismiss the tutorial prompt to continue.';
    const required = TUTORIAL_REQUIRED_CARD[tutorialStep];
    if (required && card.name !== required) return `Tutorial step requires ${required}.`;
  }
  return null;
}
