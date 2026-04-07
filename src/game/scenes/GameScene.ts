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

    // ── Render a sample hand of 6 cards ───────────────────────────────────
    initRNG(12345);
    const deck = generateDeck();
    const hand = deck.slice(0, 6);

    // Fan layout — mirrors Wargrum style:
    //   tight overlap, strong rotation, parabolic arc drop at edges,
    //   cards partially clipped by bottom edge
    const OVERLAP  = CARD_W * 0.68;      // how far apart each card steps
    const FAN_DEG  = 38;                 // total rotation spread (±19°)
    const ARC_DROP = 36;                 // how much lower edge cards sit
    const count    = hand.length;
    const totalW   = (count - 1) * OVERLAP;
    const startX   = width / 2 - totalW / 2;
    const baseY    = height - CARD_H * 0.38; // show top ~62% of cards

    hand.forEach((cardData, i) => {
      const t       = count > 1 ? i / (count - 1) : 0.5; // 0→1 left to right
      const c       = t - 0.5;                             // -0.5→0.5 centred
      const x       = startX + OVERLAP * i;
      const angle   = c * FAN_DEG;
      const yOffset = c * c * ARC_DROP * 4;               // parabolic drop

      const card = new Card(this, x, baseY + yOffset, cardData);
      card.setAngle(angle);
      card.setDepth(i);                                    // left-to-right stacking
      card.dealIn(width / 2, height / 2, i * 70);
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
