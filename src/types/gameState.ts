// src/types/gameState.ts

import type { Card, ImprovementType } from './cards';

export type Phase =
  | 'SETUP'
  | 'PHASE_ROLL'
  | 'DRAW'
  | 'MAIN'
  | 'END_TURN'
  | 'GAME_OVER';

export type AIPersonality = 'AGGRESSIVE' | 'CAUTIOUS' | 'BALANCED';

export interface PlayerState {
  id: string;
  name: string;
  isHuman: boolean;
  personality?: AIPersonality;
  population: number;
  hand: Card[];
  improvements: ImprovementType[];
  eliminated: boolean;
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
}
