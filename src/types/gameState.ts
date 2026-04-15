// src/types/gameState.ts

import type { Card, DaemonType, NegativeEventCard, WarCard } from './cards';

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
  /** Set by Firewall Surge — adds +1 per stack to this player's next WAR roll. */
  tacticalBonus: number;
  /** Set by Cease & Desist — blocks the next incoming WAR or EVENT_NEGATIVE targeting this player. */
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
}
