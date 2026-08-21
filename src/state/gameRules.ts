import { random } from '../lib/rng';
import type { Card, NegativeEventCard } from '../types/cards';
import type { GameState, PlayerState } from '../types/gameState';

// If a player has The Corruption before playing any card, it is mandatory.
export function mustPlayCorruptionFirst(
  player: PlayerState,
  gameStats: GameState['gameStats'],
): boolean {
  if ((gameStats.cardsPlayed[player.id] ?? 0) !== 0) return false;
  return player.hand.some(
    card => card.category === 'EVENT_NEGATIVE' &&
      (card as NegativeEventCard).effect === 'CORRUPTION',
  );
}

export function markEliminations(
  players: PlayerState[],
  eliminationOrder: string[],
  keepHumanAlive = false,
): { players: PlayerState[]; eliminationOrder: string[] } {
  let order = eliminationOrder;
  const updated = players.map(player => {
    if (player.eliminated) return player;
    const shouldEliminate = player.cycles <= 0 && (!keepHumanAlive || !player.isHuman);
    if (!shouldEliminate) return player;
    if (!order.includes(player.id)) order = [...order, player.id];
    return { ...player, eliminated: true, daemons: [] };
  });
  return { players: updated, eliminationOrder: order };
}

export const CORRUPTION_DECK_WINDOW = { min: 0.25, max: 0.55 } as const;

export function stageCorruptionForSession(deck: Card[], initialDealCount: number): Card[] {
  const corruptionIndex = deck.findIndex(
    card => card.category === 'EVENT_NEGATIVE' &&
      (card as NegativeEventCard).effect === 'CORRUPTION',
  );
  if (corruptionIndex === -1) return deck;

  const corruptionCard = deck[corruptionIndex];
  const withoutCorruption = deck.filter((_, index) => index !== corruptionIndex);
  const dealt = withoutCorruption.slice(0, initialDealCount);
  const remaining = withoutCorruption.slice(initialDealCount);
  const minIndex = Math.floor(remaining.length * CORRUPTION_DECK_WINDOW.min);
  const maxIndex = Math.max(minIndex, Math.floor(remaining.length * CORRUPTION_DECK_WINDOW.max));
  const insertAt = minIndex + Math.floor(random() * (maxIndex - minIndex + 1));

  return [
    ...dealt,
    ...remaining.slice(0, insertAt),
    corruptionCard,
    ...remaining.slice(insertAt),
  ];
}
