// src/game/scenes/PreloadScene.ts
import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload() {
    const { width, height } = this.scale;

    // Loading bar background
    const barBg = this.add.rectangle(width / 2, height / 2, 400, 6, 0x222233);
    const bar = this.add.rectangle(width / 2 - 200, height / 2, 0, 6, 0x00ffcc);
    bar.setOrigin(0, 0.5);

    this.add.text(width / 2, height / 2 - 30, 'CORRUPT REALITY', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#00ffcc',
      letterSpacing: 6,
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      bar.width = 400 * value;
    });

    // Assets will be loaded here as they are created
    // e.g. this.load.image('card-back', 'assets/images/cards/card-back.png');
    void barBg; // suppress unused warning until real assets are added
  }

  create() {
    this.scene.start('GameScene');
  }
}
