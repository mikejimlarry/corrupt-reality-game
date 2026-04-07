// src/game/scenes/GameScene.ts
import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  private tableText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    const { width, height } = this.scale;

    // ── Background grid lines (placeholder aesthetic) ──────────────────────
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x00ffcc, 0.06);

    for (let x = 0; x < width; x += 60) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, height);
    }
    for (let y = 0; y < height; y += 60) {
      graphics.moveTo(0, y);
      graphics.lineTo(width, y);
    }
    graphics.strokePath();

    // ── Centre glow ────────────────────────────────────────────────────────
    const glow = this.add.circle(width / 2, height / 2, 200, 0x00ffcc, 0.03);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.03, to: 0.08 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ── Placeholder label ──────────────────────────────────────────────────
    this.tableText = this.add.text(width / 2, height / 2, 'GAME TABLE', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#00ffcc',
      letterSpacing: 4,
    }).setOrigin(0.5).setAlpha(0.3);

    // Resize handler
    this.scale.on('resize', this.handleResize, this);
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    const { width, height } = gameSize;
    this.tableText.setPosition(width / 2, height / 2);
  }
}
