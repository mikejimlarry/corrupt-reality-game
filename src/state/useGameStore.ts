// src/state/useGameStore.ts
import { create } from 'zustand';
import type { GameState, PlayerState, LogEntry } from '../types/gameState';

import { initRNG, random } from '../lib/rng';

let _logId = 0;
const makeLogEntry = (text: string, type: LogEntry['type']): LogEntry => ({
  id: `log_${++_logId}`,
  text,
  type,
  timestamp: Date.now(),
});

interface GameStore extends GameState {
  startGame: (playerCount: number, playerName?: string) => void;
  resetToSetup: () => void;
  addLog: (text: string, type: LogEntry['type']) => void;
}

const defaultState: GameState = {
  phase: 'SETUP',
  players: [],
  deck: [],
  discard: [],
  currentPlayerIndex: 0,
  globalCorruptionMode: false,
  winnerId: null,
  log: [],
  gameSeed: 0,
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...defaultState,

  startGame: (playerCount: number, playerName = 'You') => {
    const seed = initRNG();
    const players: PlayerState[] = Array.from({ length: playerCount }, (_, i) => ({
      id: `player_${i}`,
      name: i === 0 ? playerName : `Agent ${i}`,
      isHuman: i === 0,
      personality: i === 0 ? undefined : (['AGGRESSIVE', 'CAUTIOUS', 'BALANCED'] as const)[Math.floor(random() * 3)],
      population: 50,
      hand: [],
      improvements: [],
      eliminated: false,
    }));

    set({
      ...defaultState,
      phase: 'PHASE_ROLL',
      players,
      gameSeed: seed,
    });

    get().addLog('Game started. Welcome to Corrupt Reality.', 'turn');
  },

  resetToSetup: () => set({ ...defaultState }),

  addLog: (text, type) => set(state => ({
    log: [...state.log, makeLogEntry(text, type)],
  })),
}));
