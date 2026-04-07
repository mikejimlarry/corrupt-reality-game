// src/game/scenes/GameScene.ts
import Phaser from 'phaser';
import { Card, CARD_W, CARD_H } from '../objects/Card';
import { generateDeck } from '../../data/deck';
import { initRNG } from '../../lib/rng';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    const { width, height } = this.scale;

    // ── Background grid ────────────────────────────────────────────────────
    this.drawGrid(width, height);

    // ── Centre glow ────────────────────────────────────────────────────────
    const glow = this.add.circle(width / 2, height / 2, 220, 0x00ffcc, 0.03);
    this.tweens.add({
      targets: glow, alpha: { from: 0.03, to: 0.07 },
      duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // ── Render a sample hand of 5 cards ───────────────────────────────────
    initRNG(12345);
    const deck = generateDeck();
    const hand = deck.slice(0, 5);

    const spread = Math.min(hand.length * (CARD_W + 12), width * 0.8);
    const startX = width / 2 - spread / 2 + CARD_W / 2;
    const baseY = height - CARD_H / 2 - 20;
    const fanAngle = 16; // total fan spread in degrees

    hand.forEach((cardData, i) => {
      const t = hand.length > 1 ? i / (hand.length - 1) : 0.5;
      const x = startX + (spread - CARD_W) * t;
      const angle = (t - 0.5) * fanAngle;
      const yOffset = Math.abs(t - 0.5) * 12;

      const card = new Card(this, x, baseY + yOffset, cardData);
      card.setAngle(angle);
      card.dealIn(width / 2, height / 2, i * 80);
    });

    // ── Resize handler ─────────────────────────────────────────────────────
    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      this.drawGrid(size.width, size.height);
    });
  }

  private drawGrid(width: number, height: number) {
    // Clear and redraw on resize
    const key = 'grid';
    if (this.children.getByName(key)) {
      (this.children.getByName(key) as Phaser.GameObjects.Graphics).clear();
    }
    const g = (this.children.getByName(key) as Phaser.GameObjects.Graphics | null)
      ?? this.add.graphics().setName(key).setDepth(-1);

    g.lineStyle(1, 0x00ffcc, 0.05);
    for (let x = 0; x < width; x += 60) { g.moveTo(x, 0); g.lineTo(x, height); }
    for (let y = 0; y < height; y += 60) { g.moveTo(0, y); g.lineTo(width, y); }
    g.strokePath();
  }
}
