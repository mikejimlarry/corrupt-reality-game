import { describe, expect, it } from 'vitest';
import { initRNG, rollDie } from '../lib/rng';
import type { NegativeEventCard } from '../types/cards';
import type { GameState, PlayerState } from '../types/gameState';
import { markEliminations, mustPlayCorruptionFirst } from './gameRules';

const corruption: NegativeEventCard = {
  id: 'corruption',
  name: 'The Corruption',
  category: 'EVENT_NEGATIVE',
  description: '',
  rarity: 'LEGENDARY',
  effect: 'CORRUPTION',
  amount: 10,
  targetsOther: true,
};

function player(id: string, partial: Partial<PlayerState> = {}): PlayerState {
  return {
    id,
    name: id,
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

function stats(cardsPlayed: Record<string, number>): GameState['gameStats'] {
  return {
    cardsPlayed,
    eliminationOrder: [],
    damageDealt: {},
    warsWon: {},
    warsLost: {},
    daemonsLost: {},
    biggestRoll: {},
  };
}

describe('core game rules', () => {
  it('forces The Corruption only before the player has played a card', () => {
    const human = player('human', { hand: [corruption] });

    expect(mustPlayCorruptionFirst(human, stats({}))).toBe(true);
    expect(mustPlayCorruptionFirst(human, stats({ human: 1 }))).toBe(false);
  });

  it('records eliminations once and clears eliminated daemons', () => {
    const result = markEliminations([
      player('human'),
      player('ai', { cycles: 0, daemons: ['FIREWALL'] }),
    ], []);

    expect(result.players[1]).toMatchObject({ eliminated: true, daemons: [] });
    expect(result.eliminationOrder).toEqual(['ai']);
    expect(markEliminations(result.players, result.eliminationOrder).eliminationOrder).toEqual(['ai']);
  });

  it('can defer human elimination for Dead Man\'s Switch without sparing an AI', () => {
    const result = markEliminations([
      player('human', { cycles: 0 }),
      player('ai', { cycles: 0 }),
    ], [], true);

    expect(result.players[0].eliminated).toBe(false);
    expect(result.players[1].eliminated).toBe(true);
  });

  it('always produces inclusive d6 values', () => {
    initRNG(42);
    const rolls = Array.from({ length: 2_000 }, () => rollDie());

    expect(Math.min(...rolls)).toBe(1);
    expect(Math.max(...rolls)).toBe(6);
    expect(rolls.every(roll => Number.isInteger(roll) && roll >= 1 && roll <= 6)).toBe(true);
  });
});
