import { describe, expect, it, vi } from 'vitest';
import type { Card, CounterCard, CyclesCard, DaemonCard, PositiveEventCard, WarCard } from '../types/cards';
import type { PlayerState } from '../types/gameState';
import { DECK_CATALOG, DECK_SIZE, generateDeck } from '../data/deck';
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

  it('derives the Field Manual catalogue from the playable deck', () => {
    expect(DECK_CATALOG.reduce((total, entry) => total + entry.count, 0)).toBe(DECK_SIZE);
    expect(DECK_SIZE).toBe(70);
    expect(DECK_CATALOG.find(entry => entry.name === 'Memory Leak')?.count).toBe(4);
    expect(DECK_CATALOG.find(entry => entry.name === 'Quarantine')?.count).toBe(2);
    expect(DECK_CATALOG.find(entry => entry.name === 'Hardened Node')?.count).toBe(4);
  });

  it('starts a five-player session with four distinct AI opponents', async () => {
    const { useGameStore } = await import('./useGameStore');
    useGameStore.getState().startGame(5, 'Ghost', 50, false, false, false, 42, 'MEDIUM');

    const state = useGameStore.getState();
    expect(state.players).toHaveLength(5);
    expect(state.players.map(participant => participant.name)).toEqual([
      'GHOST', 'GHOST', 'CIPHER', 'NULL.BYTE', 'PHANTOM',
    ]);
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

describe('guided conflict flow', () => {
  const war: WarCard = {
    id: 'guided-war',
    name: 'Skirmish',
    category: 'WAR',
    description: '',
    rarity: 'COMMON',
    winnerLoses: 5,
    loserLoses: 10,
  };

  it('pauses an incoming AI war for a briefing even without counters', async () => {
    const { useGameStore } = await import('./useGameStore');
    useGameStore.getState().resetToSetup();
    useGameStore.setState({
      phase: 'MAIN',
      players: [player('human'), player('ai', { isHuman: false, hand: [war] })],
      currentPlayerIndex: 1,
      discard: [],
      warIncomingReveal: null,
      counterPending: null,
      warRollDisplay: null,
    });

    useGameStore.getState().applyPlayCard(war.id, 0);

    let state = useGameStore.getState();
    expect(state.warIncomingReveal).toMatchObject({
      attackerIndex: 1,
      targetIndex: 0,
      eligibleCounters: [],
    });
    expect(state.warRollDisplay).toBeNull();
    expect(state.players[1].hand.some(card => card.id === war.id)).toBe(true);

    state.proceedToCounterPending();
    state = useGameStore.getState();
    expect(state.counterPending).toMatchObject({ targetIndex: 0, eligibleCounters: [] });
    expect(state.warRollDisplay).toBeNull();

    state.resolveCounterOpportunity(null);
    state = useGameStore.getState();
    expect(state.counterPending).toBeNull();
    expect(state.players[1].hand.some(card => card.id === war.id)).toBe(false);
    expect(state.warRollDisplay).not.toBeNull();
    expect(state.warRollDisplay?.actorCyclesAfter).toBe(state.players[1].cycles);
    expect(state.warRollDisplay?.targetCyclesAfter).toBe(state.players[0].cycles);

    state.clearWarRollDisplay();
    state = useGameStore.getState();
    expect(state.warResultPending).toMatchObject({
      humanIsActor: false,
      humanCyclesAfter: state.players[0].cycles,
      opponentCyclesAfter: state.players[1].cycles,
    });
  });

  it('returns to the briefing after Firewall Surge until the player starts the roll', async () => {
    const { useGameStore } = await import('./useGameStore');
    const surge: CounterCard = {
      id: 'guided-surge',
      name: 'Firewall Surge',
      category: 'COUNTER',
      description: '',
      rarity: 'UNCOMMON',
      counterType: 'TACTICAL_ADVANTAGE',
    };
    useGameStore.getState().resetToSetup();
    useGameStore.setState({
      phase: 'MAIN',
      players: [player('human', { hand: [surge] }), player('ai', { isHuman: false, hand: [war] })],
      currentPlayerIndex: 1,
      discard: [],
      warIncomingReveal: null,
      counterPending: null,
      warRollDisplay: null,
    });

    useGameStore.getState().applyPlayCard(war.id, 0);
    useGameStore.getState().proceedToCounterPending();
    useGameStore.getState().resolveCounterOpportunity(surge.id);

    let state = useGameStore.getState();
    expect(state.counterPending).toMatchObject({ targetIndex: 0, eligibleCounters: [] });
    expect(state.players[0].tacticalBonus).toBe(1);
    expect(state.warRollDisplay).toBeNull();

    state.resolveCounterOpportunity(null);
    state = useGameStore.getState();
    expect(state.counterPending).toBeNull();
    expect(state.warRollDisplay?.targetBonus).toBe(1);
  });
});

describe('AI sequence timing', () => {
  it('does not release the AI to draw or play until the roll animation reports completion', async () => {
    vi.useFakeTimers();
    const { useGameStore } = await import('./useGameStore');
    const harvest: CyclesCard = {
      id: 'ai-harvest',
      name: 'Data Harvest',
      category: 'CYCLES',
      description: '',
      rarity: 'COMMON',
      amount: 5,
    };

    try {
      useGameStore.getState().resetToSetup();
      useGameStore.setState({
        phase: 'PHASE_ROLL',
        players: [player('human'), player('ai', { isHuman: false, hand: [harvest] })],
        currentPlayerIndex: 1,
        deck: [],
        discard: [],
        rollResult: [3, 4],
        rollTriggered: false,
      });

      useGameStore.getState().triggerRoll();
      expect(useGameStore.getState().rollTriggered).toBe(true);

      vi.advanceTimersByTime(10_000);
      let state = useGameStore.getState();
      expect(state.phase).toBe('PHASE_ROLL');
      expect(state.players[1].hand.some(card => card.id === harvest.id)).toBe(true);

      state.rollComplete();
      state = useGameStore.getState();
      expect(state.phase).toBe('DRAW');
      expect(state.rollTriggered).toBe(false);

      // A stale queued trigger cannot reopen the roll once completion moved the
      // turn into its post-animation draw phase.
      state.triggerRoll();
      expect(useGameStore.getState().rollTriggered).toBe(false);

      vi.advanceTimersByTime(899);
      expect(useGameStore.getState().phase).toBe('DRAW');

      vi.advanceTimersByTime(1);
      state = useGameStore.getState();
      expect(state.phase).toBe('MAIN');
      expect(state.players[1].hand.some(card => card.id === harvest.id)).toBe(true);

      vi.advanceTimersByTime(1_299);
      expect(useGameStore.getState().players[1].hand.some(card => card.id === harvest.id)).toBe(true);

      vi.advanceTimersByTime(1);
      expect(useGameStore.getState().players[1].hand.some(card => card.id === harvest.id)).toBe(false);
    } finally {
      useGameStore.getState().resetToSetup();
      vi.useRealTimers();
    }
  });
});
