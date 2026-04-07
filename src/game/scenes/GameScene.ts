// src/game/scenes/GameScene.ts
import Phaser from 'phaser';
import { Card, CARD_W, CARD_H } from '../objects/Card';
import { PlayerZone } from '../objects/PlayerZone';
import { CentreZone } from '../objects/CentreZone';
import { generateDeck } from '../../data/deck';
import { initRNG } from '../../lib/rng';
import type { PlayerState } from '../../types/gameState';

// ── Sample players for layout preview ───────────────────────────────────────
const SAMPLE_PLAYERS: PlayerState[] = [
  { id: 'p0', name: 'Ghost',      isHuman: true,  population: 50, hand: [], improvements: [], eliminated: false },
  { id: 'p1', name: 'Cipher',     isHuman: false, personality: 'AGGRESSIVE', population: 50, hand: Array(5).fill(null), improvements: ['FIREWALL'], eliminated: false },
  { id: 'p2', name: 'Null.Byte',  isHuman: false, personality: 'CAUTIOUS',   population: 50, hand: Array(5).fill(null), improvements: [], eliminated: false },
];

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    const { width, height } = this.scale;
    this.buildTable(width, height);
    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      this.children.removeAll(true);
      this.buildTable(size.width, size.height);
    });
  }

  private buildTable(width: number, height: number) {
    // ── 1. Background ──────────────────────────────────────────────────────
    this.drawBackground(width, height);

    // ── 2. AI player zones (top) ───────────────────────────────────────────
    const aiPlayers = SAMPLE_PLAYERS.filter(p => !p.isHuman);
    this.placeAIZones(aiPlayers, width, height);

    // ── 3. Centre zone ─────────────────────────────────────────────────────
    const centre = new CentreZone(this, width / 2, height * 0.46);
    centre.setDepth(1);

    // ── 4. Human player zone ───────────────────────────────────────────────
    const human = SAMPLE_PLAYERS.find(p => p.isHuman)!;
    const humanZone = new PlayerZone(this, width / 2, height * 0.72, human);
    humanZone.setDepth(1);

    // ── 5. Human hand (fan) ────────────────────────────────────────────────
    this.dealHand(width, height);

    // ── 6. Table dividers ──────────────────────────────────────────────────
    this.drawDividers(width, height);
  }

  // ── Background + grid ─────────────────────────────────────────────────────
  private drawBackground(width: number, height: number) {
    // Subtle grid
    const grid = this.add.graphics().setDepth(-2);
    grid.lineStyle(1, 0x00ffcc, 0.04);
    for (let x = 0; x < width; x += 60) { grid.moveTo(x, 0); grid.lineTo(x, height); }
    for (let y = 0; y < height; y += 60) { grid.moveTo(0, y); grid.lineTo(width, y); }
    grid.strokePath();

    // Table surface — slightly lighter panel in the centre play area
    const table = this.add.graphics().setDepth(-1);
    const tPad = 24;
    table.fillStyle(0x0d0d1a, 0.6);
    table.fillRoundedRect(tPad, height * 0.06, width - tPad * 2, height * 0.88, 12);
    table.lineStyle(1, 0x00ffcc, 0.08);
    table.strokeRoundedRect(tPad, height * 0.06, width - tPad * 2, height * 0.88, 12);

    // Ambient corner glows
    const glowTL = this.add.circle(0, 0, 180, 0x00ffcc, 0.025).setDepth(-1);
    const glowBR = this.add.circle(width, height, 180, 0x00ffcc, 0.025).setDepth(-1);
    this.tweens.add({ targets: [glowTL, glowBR], alpha: { from: 0.025, to: 0.055 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ── AI player zones ────────────────────────────────────────────────────────
  private placeAIZones(players: PlayerState[], width: number, height: number) {
    const count = players.length;
    const y = height * 0.14;

    if (count === 1) {
      new PlayerZone(this, width / 2, y, players[0]).setDepth(1);
    } else if (count === 2) {
      new PlayerZone(this, width * 0.28, y, players[0]).setDepth(1);
      new PlayerZone(this, width * 0.72, y, players[1]).setDepth(1);
    } else if (count === 3) {
      new PlayerZone(this, width * 0.2,  y, players[0]).setDepth(1);
      new PlayerZone(this, width * 0.5,  y, players[1]).setDepth(1);
      new PlayerZone(this, width * 0.8,  y, players[2]).setDepth(1);
    } else {
      // 4 or 5: two rows
      const row1 = players.slice(0, 3);
      const row2 = players.slice(3);
      row1.forEach((p, i) => new PlayerZone(this, width * (0.2 + i * 0.3), y,            p).setDepth(1));
      row2.forEach((p, i) => new PlayerZone(this, width * (0.35 + i * 0.3), y + 120, p).setDepth(1));
    }
  }

  // ── Human hand (fan layout) ────────────────────────────────────────────────
  private dealHand(width: number, height: number) {
    initRNG(12345);
    const deck = generateDeck();
    const hand = deck.slice(0, 6);

    const OVERLAP  = CARD_W * 0.68;
    const FAN_DEG  = 38;
    const ARC_DROP = 36;
    const count    = hand.length;
    const totalW   = (count - 1) * OVERLAP;
    const startX   = width / 2 - totalW / 2;
    const baseY    = height - CARD_H * 0.38;

    hand.forEach((cardData, i) => {
      const t       = count > 1 ? i / (count - 1) : 0.5;
      const c       = t - 0.5;
      const x       = startX + OVERLAP * i;
      const angle   = c * FAN_DEG;
      const yOffset = c * c * ARC_DROP * 4;

      const card = new Card(this, x, baseY + yOffset, cardData);
      card.setAngle(angle);
      card.setDepth(10 + i);
      card.dealIn(width / 2, height * 0.46, i * 70);
    });
  }

  // ── Table zone dividers ────────────────────────────────────────────────────
  private drawDividers(width: number, height: number) {
    const g = this.add.graphics().setDepth(0);
    g.lineStyle(1, 0x00ffcc, 0.12);

    // Horizontal line separating AI zone from centre
    const line1Y = height * 0.27;
    g.beginPath(); g.moveTo(40, line1Y); g.lineTo(width - 40, line1Y); g.strokePath();

    // Horizontal line separating centre from human zone
    const line2Y = height * 0.62;
    g.beginPath(); g.moveTo(40, line2Y); g.lineTo(width - 40, line2Y); g.strokePath();

    // Dotted scan line accent
    g.lineStyle(1, 0x00ffcc, 0.06);
    for (let x = 44; x < width - 40; x += 12) {
      g.beginPath(); g.moveTo(x, line1Y); g.lineTo(x + 6, line1Y); g.strokePath();
    }
  }
}
