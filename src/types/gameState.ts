// src/types/gameState.ts

import type { Card, DaemonType, NegativeEventCard } from './cards';

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
}
