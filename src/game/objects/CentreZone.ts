// src/game/objects/CentreZone.ts
import Phaser from 'phaser';
import type { Card as CardData, CardCategory } from '../../types/cards';

const W = 400;
const H = 200;
// Card area: 80 × 112 = exactly 5:7 — matches the playing card aspect ratio.
// Label zone sits below the card area with enough room to breathe.
const PILE_W      = 80;
const PILE_CARD_H = 112;   // card area height only
const PILE_H      = 158;   // card area (112) + label zone (46)
const ACCENT = 0x00ffcc;
const DPR = () => window.devicePixelRatio;

// Local coords of the discard pile top-card rect
const DISCARD_X = W / 2 - PILE_W - 16;          // 104
const DISCARD_Y = -PILE_H / 2;                   // -79
// Exposed as offsets from the container centre for world-position use
export const DISCARD_LOCAL_CX = DISCARD_X + PILE_W / 2;          // 144
export const DISCARD_LOCAL_CY = DISCARD_Y + PILE_CARD_H / 2;     // -23

const CAT_COLOR: Record<CardCategory, number> = {
  CREDITS:          0x00ff88,
  EVENT_POSITIVE: 0x00ccff,
  EVENT_NEGATIVE: 0xff4466,
  WAR:            0xff2200,
  DAEMON:         0xaa44ff,
  COUNTER:        0xffaa00,
};

export class CentreZone extends Phaser.GameObjects.Container {
  private drawCountLabel!: Phaser.GameObjects.Text;
  private discardCountLabel!: Phaser.GameObjects.Text;
  private phaseLabel!: Phaser.GameObjects.Text;
  private turnLabel!: Phaser.GameObjects.Text;
  private discardFaceContainer?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.build();
    scene.add.existing(this);
  }

  private txt(x: number, y: number, str: string, style: Phaser.Types.GameObjects.Text.TextStyle) {
    return this.scene.add.text(x, y, str, { ...style, resolution: DPR() });
  }

  private build() {
    // ── Outer frame ──────────────────────────────────────────────────────────
    const frame = this.scene.add.graphics();
    frame.lineStyle(1, ACCENT, 0.15);
    frame.strokeRoundedRect(-W / 2, -H / 2, W, H, 10);
    this.add(frame);

    // ── Draw pile ─────────────────────────────────────────────────────────────
    this.buildPile(-W / 2 + 16, -PILE_H / 2, 'DRAW', true);
    // Count label: 12px below card area bottom
    this.drawCountLabel = this.txt(-W / 2 + 16 + PILE_W / 2, DISCARD_Y + PILE_CARD_H + 12, '54', {
      fontFamily: 'monospace', fontSize: '18px', color: '#00ffcc', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.add(this.drawCountLabel);

    // ── Discard pile ──────────────────────────────────────────────────────────
    this.buildPile(W / 2 - PILE_W - 16, -PILE_H / 2, 'DISCARD', false);
    // Count label: 12px below card area bottom
    this.discardCountLabel = this.txt(W / 2 - PILE_W / 2 - 16, DISCARD_Y + PILE_CARD_H + 12, '0', {
      fontFamily: 'monospace', fontSize: '18px', color: '#334455', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.add(this.discardCountLabel);

    // ── Centre protocol zone ──────────────────────────────────────────────────
    this.buildProtocolZone();

    // ── Phase / turn labels ───────────────────────────────────────────────────
    this.phaseLabel = this.txt(0, -H / 2 + 10, 'STABILITY PHASE', {
      fontFamily: 'monospace', fontSize: '8px', color: '#00ffcc', letterSpacing: 3,
    }).setOrigin(0.5);
    this.add(this.phaseLabel);

    this.turnLabel = this.txt(0, H / 2 - 10, 'TURN 1', {
      fontFamily: 'monospace', fontSize: '7px', color: '#334455', letterSpacing: 2,
    }).setOrigin(0.5);
    this.add(this.turnLabel);
  }

  private buildPile(x: number, y: number, label: string, isDraw: boolean) {
    const accent = isDraw ? ACCENT : 0x334455;

    const g = this.scene.add.graphics();

    // Stack effect (offset rectangles — card area only)
    for (let i = 2; i >= 0; i--) {
      g.fillStyle(isDraw ? 0x0d1520 : 0x0a0a12, 1);
      g.fillRoundedRect(x + i * 2, y + i * 2, PILE_W, PILE_CARD_H, 6);
      g.lineStyle(0.75, accent, isDraw ? 0.3 - i * 0.08 : 0.1);
      g.strokeRoundedRect(x + i * 2, y + i * 2, PILE_W, PILE_CARD_H, 6);
    }

    // Circuit pattern on top card (draw pile only)
    if (isDraw) {
      const cx = x + PILE_W / 2;
      const cy = y + PILE_CARD_H / 2;
      g.lineStyle(0.5, ACCENT, 0.25);
      // Simple diamond
      g.beginPath();
      g.moveTo(cx, cy - 18); g.lineTo(cx + 14, cy);
      g.lineTo(cx, cy + 18); g.lineTo(cx - 14, cy);
      g.closePath(); g.strokePath();
      g.fillStyle(ACCENT, 0.08);
      g.beginPath();
      g.moveTo(cx, cy - 18); g.lineTo(cx + 14, cy);
      g.lineTo(cx, cy + 18); g.lineTo(cx - 14, cy);
      g.closePath(); g.fillPath();
    }

    this.add(g);

    // "DRAW" / "DISCARD" label — sits just above the pile
    const lbl = this.txt(x + PILE_W / 2, y - 6, label, {
      fontFamily: 'monospace', fontSize: '7px',
      color: isDraw ? '#00ffcc' : '#334455', letterSpacing: 3,
    }).setOrigin(0.5, 1);
    this.add(lbl);
  }

  private buildProtocolZone() {
    const zW = 140, zH = 110;
    const g = this.scene.add.graphics();

    // Background
    g.fillStyle(0x060610, 1);
    g.fillRoundedRect(-zW / 2, -zH / 2, zW, zH, 8);
    g.lineStyle(1, ACCENT, 0.2);
    g.strokeRoundedRect(-zW / 2, -zH / 2, zW, zH, 8);

    // Corner ticks
    const tick = 12;
    g.lineStyle(1.5, ACCENT, 0.6);
    [[-zW/2, -zH/2], [zW/2, -zH/2], [-zW/2, zH/2], [zW/2, zH/2]].forEach(([cx, cy], i) => {
      const sx = cx === -zW/2 ? 1 : -1;
      const sy = cy === -zH/2 ? 1 : -1;
      g.beginPath();
      g.moveTo(cx + sx * tick, cy); g.lineTo(cx, cy); g.lineTo(cx, cy + sy * tick);
      g.strokePath();
      void i;
    });

    // Central diamond
    g.lineStyle(1, ACCENT, 0.4);
    g.beginPath();
    g.moveTo(0, -22); g.lineTo(18, 0); g.lineTo(0, 22); g.lineTo(-18, 0);
    g.closePath(); g.strokePath();

    // Inner dot
    g.fillStyle(ACCENT, 0.6);
    g.fillCircle(0, 0, 3);

    this.add(g);

    // "PLAY ZONE" label
    const label = this.txt(0, zH / 2 - 14, 'ACTIVE PROTOCOL', {
      fontFamily: 'monospace', fontSize: '6px', color: '#00ffcc44', letterSpacing: 3,
    }).setOrigin(0.5);
    this.add(label);

    // Pulse animation on the centre dot
    const dot = this.scene.add.circle(0, 0, 8, ACCENT, 0);
    dot.setStrokeStyle(1, ACCENT, 0.3);
    this.scene.tweens.add({
      targets: dot, scaleX: 2.5, scaleY: 2.5, alpha: { from: 0.3, to: 0 },
      duration: 1800, repeat: -1, ease: 'Quad.easeOut',
    });
    this.add(dot);
  }

  setDrawCount(n: number) {
    this.drawCountLabel.setText(`${n}`);
    this.drawCountLabel.setColor(n > 0 ? '#00ffcc' : '#334455');
  }

  setDiscardCount(n: number) {
    this.discardCountLabel.setText(`${n}`);
  }

  setPhase(phase: string) {
    this.phaseLabel.setText(phase);
  }

  setTurn(turn: number) {
    this.turnLabel.setText(`TURN ${turn}`);
  }

  /** Show the top card of the discard pile face-up on the pile. Pass null to clear. */
  setDiscardTop(card: CardData | null) {
    // Remove previous face-up card
    this.discardFaceContainer?.destroy();
    this.discardFaceContainer = undefined;
    if (!card) return;

    const catColor = CAT_COLOR[card.category];
    const catHex   = `#${catColor.toString(16).padStart(6, '0')}`;
    const cardW    = PILE_W - 4;
    const cardH    = PILE_CARD_H - 4;

    const con = this.scene.add.container(DISCARD_X + 2 + cardW / 2, DISCARD_Y + 2 + cardH / 2);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0d0d1f, 1);
    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 5);
    bg.lineStyle(1.5, catColor, 0.85);
    bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 5);
    con.add(bg);

    // Category colour strip at top
    const stripH = 8;
    const strip = this.scene.add.graphics();
    strip.fillStyle(catColor, 0.35);
    strip.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, stripH, { tl: 5, tr: 5, bl: 0, br: 0 });
    con.add(strip);

    // Card name
    const name = this.scene.add.text(0, -cardH / 2 + stripH + 6, card.name.toUpperCase(), {
      fontFamily: 'monospace', fontSize: '7px', color: '#ffffff',
      fontStyle: 'bold', wordWrap: { width: cardW - 8 },
      resolution: DPR(),
    }).setOrigin(0.5, 0);
    con.add(name);

    // Category label
    const cat = this.scene.add.text(0, cardH / 2 - 10, card.category.replace('_', ' '), {
      fontFamily: 'monospace', fontSize: '5px', color: catHex,
      letterSpacing: 1, resolution: DPR(),
    }).setOrigin(0.5, 1);
    con.add(cat);

    // Inner glow
    const glow = this.scene.add.graphics();
    glow.fillStyle(catColor, 0.04);
    glow.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 5);
    con.add(glow);

    con.setAlpha(0);
    this.scene.tweens.add({ targets: con, alpha: 1, duration: 200, ease: 'Quad.easeOut' });

    this.add(con);
    this.discardFaceContainer = con;
  }
}
