// src/game/objects/CardBack.ts
import Phaser from 'phaser';
import { CARD_W, CARD_H } from './Card';

const BORDER_COLOR  = 0x1a3a4a;
const ACCENT_COLOR  = 0x00ffcc;
const PATTERN_COLOR = 0x0d2233;

export class CardBack extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.build();
    scene.add.existing(this);
  }

  private build() {
    const left = -CARD_W / 2;
    const top  = -CARD_H / 2;

    // ── Background ────────────────────────────────────────────────────────
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x080812, 1);
    bg.fillRoundedRect(left, top, CARD_W, CARD_H, 8);
    bg.lineStyle(1.5, BORDER_COLOR, 1);
    bg.strokeRoundedRect(left, top, CARD_W, CARD_H, 8);
    this.add(bg);

    // ── Inner border inset ────────────────────────────────────────────────
    const inset = 6;
    const ib = this.scene.add.graphics();
    ib.lineStyle(0.75, ACCENT_COLOR, 0.12);
    ib.strokeRoundedRect(left + inset, top + inset, CARD_W - inset * 2, CARD_H - inset * 2, 5);
    this.add(ib);

    // ── Circuit tile pattern ──────────────────────────────────────────────
    this.drawCircuitPattern(left + inset + 2, top + inset + 2, CARD_W - inset * 2 - 4, CARD_H - inset * 2 - 4);

    // ── Central emblem ────────────────────────────────────────────────────
    this.drawEmblem();

    // ── Corner brackets ───────────────────────────────────────────────────
    const bracket = this.scene.add.graphics();
    bracket.lineStyle(1.5, ACCENT_COLOR, 0.5);
    const bSize = 10;
    const bInset = 9;
    [
      [left + bInset,       top + bInset,        1,  1],
      [left + CARD_W - bInset, top + bInset,     -1,  1],
      [left + bInset,       top + CARD_H - bInset, 1, -1],
      [left + CARD_W - bInset, top + CARD_H - bInset, -1, -1],
    ].forEach(([cx, cy, dx, dy]) => {
      bracket.beginPath();
      bracket.moveTo(cx + dx * bSize, cy);
      bracket.lineTo(cx, cy);
      bracket.lineTo(cx, cy + dy * bSize);
      bracket.strokePath();
    });
    this.add(bracket);

    this.setSize(CARD_W, CARD_H);
  }

  private drawCircuitPattern(x: number, y: number, w: number, h: number) {
    const g = this.scene.add.graphics();
    g.lineStyle(0.5, PATTERN_COLOR, 1);

    const step = 18;
    const cols = Math.ceil(w / step);
    const rows = Math.ceil(h / step);

    // Horizontal + vertical grid segments (not all, pseudo-random by position)
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= cols; col++) {
        const px = x + col * step;
        const py = y + row * step;
        const hash = (col * 7 + row * 13) % 5;

        if (hash < 3 && col < cols) {
          g.beginPath(); g.moveTo(px, py); g.lineTo(px + step, py); g.strokePath();
        }
        if (hash < 2 && row < rows) {
          g.beginPath(); g.moveTo(px, py); g.lineTo(px, py + step); g.strokePath();
        }
        // Occasional node dot
        if ((col * 3 + row * 5) % 8 === 0) {
          g.fillStyle(PATTERN_COLOR, 1);
          g.fillCircle(px, py, 1.5);
        }
      }
    }
    this.add(g);
  }

  private drawEmblem() {
    const g = this.scene.add.graphics();

    // Outer hexagon ring
    const r1 = 28;
    g.lineStyle(1, ACCENT_COLOR, 0.25);
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      if (i === 0) g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      else g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    }
    g.closePath(); g.strokePath();

    // Inner diamond
    const r2 = 16;
    g.lineStyle(1.5, ACCENT_COLOR, 0.5);
    g.beginPath();
    g.moveTo(0, -r2); g.lineTo(r2, 0); g.lineTo(0, r2); g.lineTo(-r2, 0);
    g.closePath(); g.strokePath();

    // Diamond fill glow
    g.fillStyle(ACCENT_COLOR, 0.06);
    g.beginPath();
    g.moveTo(0, -r2); g.lineTo(r2, 0); g.lineTo(0, r2); g.lineTo(-r2, 0);
    g.closePath(); g.fillPath();

    // Spokes from center to hexagon vertices
    g.lineStyle(0.5, ACCENT_COLOR, 0.15);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      g.strokePath();
    }

    // Centre dot
    g.fillStyle(ACCENT_COLOR, 0.8);
    g.fillCircle(0, 0, 2.5);

    this.add(g);

    // "CR" monogram
    const label = this.scene.add.text(0, r2 + 12, 'C·R', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#00ffcc',
      letterSpacing: 4,
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5).setAlpha(0.45);
    this.add(label);

    // Pulse ring animation
    const pulse = this.scene.add.circle(0, 0, r1, ACCENT_COLOR, 0);
    pulse.setStrokeStyle(1, ACCENT_COLOR, 0.4);
    this.scene.tweens.add({
      targets: pulse,
      scaleX: 1.6, scaleY: 1.6,
      alpha: { from: 0.4, to: 0 },
      duration: 2200, repeat: -1, ease: 'Quad.easeOut',
    });
    this.add(pulse);
  }

  // Deals in from a position with a flip animation.
  // targetAlpha defaults to 1 but can be set lower (e.g. 0.25) so the card
  // arrives already dimmed when it's not the active player's turn.
  dealIn(fromX: number, fromY: number, delay = 0, targetAlpha = 1) {
    const targetX = this.x;
    const targetY = this.y;
    this.setPosition(fromX, fromY).setAlpha(0).setScale(0.6);
    this.scene.tweens.add({
      targets: this, x: targetX, y: targetY, alpha: targetAlpha, scaleX: 1, scaleY: 1,
      duration: 280, delay, ease: 'Quad.easeOut',
    });
  }

  /**
   * Pull the card out from behind the edge toward (centerX, centerY) to
   * simulate an AI "selecting" the card from their hand.
   */
  liftOut(centerX: number, centerY: number, onComplete: () => void) {
    const dx = centerX - this.x;
    const dy = centerY - this.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      x: this.x + (dx / len) * 55,
      y: this.y + (dy / len) * 55,
      scaleX: 1.12, scaleY: 1.12,
      angle: 0,
      duration: 280, ease: 'Back.easeOut',
      onComplete,
    });
  }

  /** Fly the card to (targetX, targetY), shrink and fade — mirrors Card.playOut. */
  playOut(targetX: number, targetY: number, onComplete?: () => void) {
    this.setDepth(100);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      x: targetX, y: targetY,
      scaleX: 0.55, scaleY: 0.55,
      alpha: 0, angle: 0,
      duration: 420, ease: 'Quad.easeIn',
      onComplete,
    });
  }
}
