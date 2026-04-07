// src/game/index.ts
import Phaser from 'phaser';
import { phaserConfig } from './config';

let gameInstance: Phaser.Game | null = null;

export const createGame = (): Phaser.Game => {
  if (gameInstance) return gameInstance;
  gameInstance = new Phaser.Game(phaserConfig);
  return gameInstance;
};

export const destroyGame = (): void => {
  gameInstance?.destroy(true);
  gameInstance = null;
};
