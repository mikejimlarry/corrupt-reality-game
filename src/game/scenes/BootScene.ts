// src/game/scenes/BootScene.ts
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Load minimal assets needed for the preload screen itself
  }

  create() {
    this.scene.start('PreloadScene');
  }
}
