import { describe, expect, it, vi } from 'vitest';
import type { Card, DaemonCard, PositiveEventCard, WarCard } from '../types/cards';
import type { PlayerState } from '../types/gameState';
import { generateDeck } from '../data/deck';
import { initRNG } from '../lib/rng';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
});

function categoryCounts(deck: Card[]): Record<string, number> {
  return deck.reduce<Record<string, number>>((counts, card) => {
    counts[card.category] = (counts[card.category] ?? 0) + 1;
    return counts;
  }, {});
}

function player(id: string, partial: Partial<PlayerState> = {}): PlayerState {
  return {
    id,
    name: id.toUpperCase(),
    isHuman: id === 'human',
    cycles: 50,
    hand: [],
    daemons: [],
    eliminated: false,
    overclocked: false,
    tacticalBonus: 0,
    negotiating: false,
    quarantineCard: null,
    ...partial,
  };
}

describe('deck generation', () => {
  it('builds a 70-card deck with the intended category mix', () => {
    initRNG(100);
    const deck = generateDeck();

    expect(deck).toHaveLength(70);
    expect(categoryCounts(deck)).toEqual({
      CYCLES: 12,
      EVENT_POSITIVE: 8,
      EVENT_NEGATIVE: 28,
      WAR: 7,
      COUNTER: 5,
      DAEMON: 10,
    });
    expect(deck.filter(card => card.name === 'The Corruption')).toHaveLength(1);
  });
});

describe('session deck staging', () => {
  it('keeps The Corruption out of opening hands and inserts it mid-session', async () => {
    const { CORRUPTION_DECK_WINDOW, stageCorruptionForSession } = await import('./useGameStore');
    initRNG(200);
    const initialDealCount = 20;
    const deck = stageCorruptionForSession(generateDeck(), initialDealCount);
    const corruptionIndex = deck.findIndex(card => card.name === 'The Corruption');
    const remainingAfterDeal = deck.length - 1 - initialDealCount;
    const minIndex = initialDealCount + Math.floor(remainingAfterDeal * CORRUPTION_DECK_WINDOW.min);
    const maxIndex = initialDealCount + Math.floor(remainingAfterDeal * CORRUPTION_DECK_WINDOW.max);

    expect(deck).toHaveLength(70);
    expect(corruptionIndex).toBeGreaterThanOrEqual(minIndex);
    expect(corruptionIndex).toBeLessThanOrEqual(maxIndex);
    expect(deck.slice(0, initialDealCount).some(card => card.name === 'The Corruption')).toBe(false);
  });
});

describe('card effects', () => {
  it('shifts the next roll when Overclock is played', async () => {
    const { applyCardEffect } = await import('./useGameStore');
    const overclock: PositiveEventCard = {
      id: 'overclock',
      name: 'Overclock',
      category: 'EVENT_POSITIVE',
      description: '',
      rarity: 'RARE',
      effect: 'OVERCLOCK',
      amount: 0,
    };

    const result = applyCardEffect(overclock, [player('human'), player('ai')], 0);

    expect(result.players[0].overclocked).toBe(true);
  });

  it('does not install duplicate daemons', async () => {
    const { applyCardEffect } = await import('./useGameStore');
    const firewall: DaemonCard = {
      id: 'firewall',
      name: 'Firewall',
      category: 'DAEMON',
      description: '',
      rarity: 'COMMON',
      daemonType: 'FIREWALL',
      prosperityBonus: 1,
      corruptionPenalty: -1,
    };

    const result = applyCardEffect(
      firewall,
      [player('human', { daemons: ['FIREWALL'] }), player('ai')],
      0,
    );

    expect(result.players[0].daemons).toEqual(['FIREWALL']);
  });

  it('uses Quarantine as the proactive war block', async () => {
    const { applyCardEffect } = await import('./useGameStore');
    const quarantine: PositiveEventCard = {
      id: 'quarantine',
      name: 'Quarantine',
      category: 'EVENT_POSITIVE',
      description: '',
      rarity: 'UNCOMMON',
      effect: 'NEGOTIATE',
      amount: 0,
    };
    const war: WarCard = {
      id: 'war',
      name: 'Skirmish',
      category: 'WAR',
      description: '',
      rarity: 'COMMON',
      winnerLoses: 5,
      loserLoses: 10,
    };

    const armed = applyCardEffect(quarantine, [player('human'), player('ai')], 1).players;
    const blocked = applyCardEffect(war, armed, 0, 1);

    expect(blocked.negotiateBlockedBy).toBe('AI');
    expect(blocked.consumedQuarantineCard?.name).toBe('Quarantine');
    expect(blocked.players[1].negotiating).toBe(false);
  });
});
