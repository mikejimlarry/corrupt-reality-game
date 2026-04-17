// src/types/gameState.ts

import type { Card, CounterCard, DaemonType, NegativeEventCard, WarCard } from './cards';

export type Phase =
  | 'SETUP'
  | 'PHASE_ROLL'
  | 'DRAW'
  | 'MAIN'
  | 'TARGETING'
  | 'END_TURN'
  | 'GAME_OVER';

export type AIPersonality = 'AGGRESSIVE' | 'CAUTIOUS' | 'BALANCED' | 'TACTICAL';

export interface PlayerState {
  id: string;
  name: string;
  isHuman: boolean;
  personality?: AIPersonality;
  credits: number;
  hand: Card[];
  daemons: DaemonType[];
  eliminated: boolean;
  /** Set by Quarantine — blocks the next incoming targeted EVENT_NEGATIVE, then clears. */
  quarantined: boolean;
  /** Set by Overclock — doubles the gain on the player's next Stability Roll, then clears. */
  overclocked: boolean;
  /** Set by Firewall Surge — adds +1 per stack to this player's next CONFLICT roll. */
  tacticalBonus: number;
  /** Set by System Interrupt — blocks the next incoming WAR or Digital Crusade targeting this player. */
  negotiating: boolean;
}

export interface LogEntry {
  id: string;
  text: string;
  type: 'turn' | 'roll' | 'card' | 'combat' | 'effect';
  timestamp: number;
}

export interface GameState {
  phase: Phase;
  players: PlayerState[];
  deck: Card[];
  discard: Card[];
  currentPlayerIndex: number;
  globalCorruptionMode: boolean;
  winnerId: string | null;
  log: LogEntry[];
  gameSeed: number;
  /** Starting credit count for every player (30 / 50 / 70). */
  startingPop: number;
  /** When true the numeric credit total is hidden in player zones — bars only. */
  hidePpCounts: boolean;
  /** When true a player who just hits 0 may play one last negative card before elimination. */
  deadMansSwitch: boolean;
  /** Non-null when the human player has triggered Dead Man's Switch and must choose a card. */
  deadMansSwitchPending: { playerIndex: number; eligibleCards: NegativeEventCard[] } | null;
  /** Non-null when the human played Backdoor against a target with multiple daemons — player must choose which to steal. */
  daemonStealPending: { targetIndex: number; availableDaemons: DaemonType[] } | null;
  /** Non-null when the human played a WAR card — must pick two combatants before the war resolves. */
  warPickPending: { cardId: string; availablePlayers: Array<{ id: string; name: string; playerIndex: number }> } | null;
  /** Non-null when combatants have been chosen and are preparing pre-war cards. */
  warPrePending: { card: WarCard; p1Index: number; p2Index: number; step: 1 | 2 } | null;
  /** Non-null while a human player's Overclock card is waiting to be consumed by the next roll. */
  pendingOverclockCard: import('./cards').Card | null;
  /** When true, all AI timers are suspended and no AI actions fire. */
  paused: boolean;
  /** Number of extra card plays remaining for the current player (from Multitasking). 0 = none. */
  extraPlayPending: number;
  /** Accumulated per-game statistics — reset each new game. */
  gameStats: {
    /** Number of cards played per player, keyed by player id. */
    cardsPlayed: Record<string, number>;
    /** Player ids in order of elimination (first eliminated = index 0). */
    eliminationOrder: string[];
    /** Total credits dealt as damage to other players, keyed by player id. */
    damageDealt: Record<string, number>;
  };
  /** Non-null when a WAR card just resolved — scene shows a dice-roll animation then clears this. */
  warRollDisplay: { r1: number; r2: number; actorName: string; targetName: string; actorWins: boolean; logText: string } | null;
  /** When set, the next advanceTurn call routes to this player index (first turn after Corruption card). */
  postCorruptionTargetIndex: number | null;
  /**
   * Non-null when an AI played a targeted EVENT_NEGATIVE or WAR at the human and they
   * have a reactive counter card in hand — pauses the AI turn so the human can respond.
   */
  counterPending: {
    /** Whether the incoming threat is a hack-protocol attack or a WAR card. */
    type: 'ATTACK' | 'WAR';
    attackerIndex: number;
    /** ID of the attacker's card (still in their hand until resolved). */
    cardId: string;
    /** Pre-resolved target index — always the human player. */
    targetIndex: number;
    /** Counter cards the human can play to respond. */
    eligibleCounters: CounterCard[];
  } | null;
}
