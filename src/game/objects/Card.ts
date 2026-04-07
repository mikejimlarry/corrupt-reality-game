// src/game/objects/Card.ts
import Phaser from 'phaser';
import type { Card as CardData, CardCategory, CardRarity } from '../../types/cards';

// ── Dimensions ───────────────────────────────────────────────────────────────
export const CARD_W = 150;
export const CARD_H = 210;
const PAD = 8;
const ART_H = 52;
const RADIUS = 8;

// ── Colour palettes ──────────────────────────────────────────────────────────
const CAT_COLOR: Record<CardCategory, number> = {
  POPULATION:    0x00ff88,
  EVENT_POSITIVE:0x00ccff,
  EVENT_NEGATIVE:0xff3355,
  WAR:           0xff8800,
  COUNTER:       0xbb44ff,
  IMPROVEMENT:   0x00ffcc,
};

const CAT_LABEL: Record<CardCategory, string> = {
  POPULATION:    'DATA HARVEST',
  EVENT_POSITIVE:'SYSTEM EVENT',
  EVENT_NEGATIVE:'HACK PROTOCOL',
  WAR:           'GRID CONFLICT',
  COUNTER:       'COUNTERMEASURE',
  IMPROVEMENT:   'INFRASTRUCTURE',
};

const RARITY_COLOR: Record<CardRarity, number> = {
  COMMON:    0x556677,
  UNCOMMON:  0x44aaff,
  RARE:      0xbb44ff,
  LEGENDARY: 0xffaa00,
};

const RARITY_TEXT_COLOR: Record<CardRarity, string> = {
  COMMON:    '#aabbcc',
  UNCOMMON:  '#44aaff',
  RARE:      '#bb44ff',
  LEGENDARY: '#ffaa00',
};

// ── Card class ───────────────────────────────────────────────────────────────
export class Card extends Phaser.GameObjects.Container {
  readonly cardData: CardData;
  private isHovered = false;
  private isDealt = false;
  private restY = 0;
  private restDepth = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, data: CardData) {
    super(scene, x, y);
    this.cardData = data;
    this.restY = y;   // lock in rest position before any animation
    this.build();
    scene.add.existing(this);
  }

  // Sharp text helper — applies device pixel ratio resolution to every label
  private txt(x: number, y: number, content: string, style: Phaser.Types.GameObjects.Text.TextStyle) {
    return this.scene.add.text(x, y, content, {
      ...style,
      resolution: window.devicePixelRatio,
    });
  }

  private build() {
    const { cardData: d } = this;
    const catColor  = CAT_COLOR[d.category];
    const catHex    = `#${catColor.toString(16).padStart(6, '0')}`;
    const rarityColor = RARITY_COLOR[d.rarity];
    const rarityHex = RARITY_TEXT_COLOR[d.rarity];
    const left  = -CARD_W / 2;
    const top   = -CARD_H / 2;

    // ── Background ────────────────────────────────────────────────────────
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0d0d1f, 1);
    bg.fillRoundedRect(left, top, CARD_W, CARD_H, RADIUS);
    bg.lineStyle(1.5, catColor, 0.8);
    bg.strokeRoundedRect(left, top, CARD_W, CARD_H, RADIUS);
    this.add(bg);

    // ── Rarity badge (top-right) ──────────────────────────────────────────
    const badgeW = 54, badgeH = 13;
    const badgeX = left + CARD_W - PAD - badgeW;
    const badgeY = top + 5;
    const badge = this.scene.add.graphics();
    badge.fillStyle(rarityColor, 0.2);
    badge.fillRoundedRect(badgeX, badgeY, badgeW, badgeH, 4);
    badge.lineStyle(0.75, rarityColor, 0.8);
    badge.strokeRoundedRect(badgeX, badgeY, badgeW, badgeH, 4);
    this.add(badge);

    const rarityLabel = this.txt(
      badgeX + badgeW / 2, badgeY + badgeH / 2,
      d.rarity,
      { fontFamily: 'monospace', fontSize: '6px', color: rarityHex, letterSpacing: 1 }
    ).setOrigin(0.5);
    this.add(rarityLabel);

    // ── Card name ─────────────────────────────────────────────────────────
    const nameY = top + 24;
    const name = this.txt(
      left + PAD, nameY,
      d.name.toUpperCase(),
      { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff',
        fontStyle: 'bold', wordWrap: { width: CARD_W - PAD * 2 - badgeW - 4 } }
    ).setOrigin(0, 0.5);
    this.add(name);

    // ── Category label ────────────────────────────────────────────────────
    const catLabel = this.txt(
      left + PAD, nameY + 12,
      CAT_LABEL[d.category],
      { fontFamily: 'monospace', fontSize: '5.5px', color: catHex, letterSpacing: 2 }
    ).setOrigin(0, 0.5);
    this.add(catLabel);

    // ── Separator line ────────────────────────────────────────────────────
    const sepY = top + 44;
    const sep = this.scene.add.graphics();
    sep.lineStyle(0.5, catColor, 0.3);
    sep.beginPath();
    sep.moveTo(left + PAD, sepY);
    sep.lineTo(left + CARD_W - PAD, sepY);
    sep.strokePath();
    this.add(sep);

    // ── Art area ──────────────────────────────────────────────────────────
    const artX = left + PAD;
    const artY = sepY + 3;
    const artW = CARD_W - PAD * 2;
    const art = this.scene.add.graphics();
    art.fillStyle(0x061420, 1);
    art.fillRoundedRect(artX, artY, artW, ART_H, 4);
    this.add(art);

    // Circuit pattern inside art area
    this.drawCircuit(artX, artY, artW, ART_H, catColor);

    // ── Stat pill (population/war amounts) ───────────────────────────────
    const statText = this.getStatText(d);
    if (statText) {
      const pill = this.scene.add.graphics();
      const pillW = 42, pillH = 14;
      const pillX = left + CARD_W - PAD - pillW;
      const pillY = artY + ART_H - pillH - 3;
      pill.fillStyle(catColor, 0.2);
      pill.fillRoundedRect(pillX, pillY, pillW, pillH, 3);
      pill.lineStyle(0.75, catColor, 0.6);
      pill.strokeRoundedRect(pillX, pillY, pillW, pillH, 3);
      this.add(pill);

      const stat = this.txt(
        pillX + pillW / 2, pillY + pillH / 2,
        statText,
        { fontFamily: 'monospace', fontSize: '7px', color: catHex, fontStyle: 'bold' }
      ).setOrigin(0.5);
      this.add(stat);
    }

    // ── Effect block ──────────────────────────────────────────────────────
    const effectY = artY + ART_H + 5;
    const effectH = CARD_H - (effectY - top) - 18;
    const effectBg = this.scene.add.graphics();
    effectBg.fillStyle(0x12122a, 1);
    effectBg.fillRoundedRect(left + PAD, effectY, CARD_W - PAD * 2, effectH, 4);
    effectBg.lineStyle(0.5, catColor, 0.2);
    effectBg.strokeRoundedRect(left + PAD, effectY, CARD_W - PAD * 2, effectH, 4);
    this.add(effectBg);

    const desc = this.txt(
      left + PAD + 4, effectY + 5,
      d.description,
      {
        fontFamily: 'monospace', fontSize: '6px', color: '#99aabb',
        wordWrap: { width: CARD_W - PAD * 2 - 8 }, lineSpacing: 2,
      }
    ).setOrigin(0, 0);
    this.add(desc);

    // ── Footer: flavour text + card number ────────────────────────────────
    const footerY = top + CARD_H - 10;
    if (d.flavourText) {
      const flavour = this.txt(
        left + PAD, footerY,
        `"${d.flavourText}"`,
        { fontFamily: 'monospace', fontSize: '5px', color: '#33445566',
          fontStyle: 'italic', wordWrap: { width: CARD_W - PAD * 2 - 20 } }
      ).setOrigin(0, 1);
      this.add(flavour);
    }

    if (d.cardNumber !== undefined) {
      const num = this.txt(
        left + CARD_W - PAD, footerY,
        `#${String(d.cardNumber).padStart(3, '0')}`,
        { fontFamily: 'monospace', fontSize: '5px', color: '#334455' }
      ).setOrigin(1, 1);
      this.add(num);
    }

    // ── Interactivity ─────────────────────────────────────────────────────
    this.setSize(CARD_W, CARD_H);
    this.setInteractive();
    this.on('pointerover', this.onHover, this);
    this.on('pointerout', this.onOut, this);
  }

  // ── Circuit art pattern ─────────────────────────────────────────────────
  private drawCircuit(x: number, y: number, w: number, h: number, color: number) {
    const seed = this.cardData.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const rnd = (n: number) => { const v = Math.sin(seed + n * 127.1) * 43758.5; return v - Math.floor(v); };

    const count = 7;
    const nodes = Array.from({ length: count }, (_, i) => ({
      x: x + 6 + rnd(i * 3)     * (w - 12),
      y: y + 6 + rnd(i * 3 + 1) * (h - 12),
    }));

    const g = this.scene.add.graphics();

    // Lines between nodes (L-shaped routing)
    g.lineStyle(0.75, color, 0.3);
    for (let i = 0; i < nodes.length - 1; i++) {
      if (rnd(i * 5 + 2) < 0.7) {
        const a = nodes[i], b = nodes[i + 1];
        g.beginPath();
        g.moveTo(a.x, a.y);
        if (rnd(i * 7 + 3) > 0.5) {
          g.lineTo(b.x, a.y);
          g.lineTo(b.x, b.y);
        } else {
          g.lineTo(a.x, b.y);
          g.lineTo(b.x, b.y);
        }
        g.strokePath();
      }
    }

    // Nodes — filled circles, varying sizes
    nodes.forEach((node, i) => {
      const size = rnd(i * 11 + 4) > 0.7 ? 2.5 : 1.5;
      const alpha = 0.4 + rnd(i * 9 + 5) * 0.5;
      g.fillStyle(color, alpha);
      g.fillCircle(node.x, node.y, size);
    });

    // Dim horizontal scan line for atmosphere
    g.lineStyle(0.5, 0xffffff, 0.04);
    const scanY = y + rnd(seed) * h;
    g.beginPath();
    g.moveTo(x, scanY);
    g.lineTo(x + w, scanY);
    g.strokePath();

    this.add(g);
  }

  // ── Stat text helper ────────────────────────────────────────────────────
  private getStatText(d: CardData): string | null {
    switch (d.category) {
      case 'POPULATION':    return `+${d.amount} POP`;
      case 'EVENT_POSITIVE':return `+${d.amount} POP`;
      case 'EVENT_NEGATIVE':return `-${d.amount} POP`;
      case 'WAR':           return `W:-${d.winnerLoses}`;
      default:              return null;
    }
  }

  // ── Hover effects ───────────────────────────────────────────────────────
  private onHover() {
    if (this.isHovered || !this.isDealt) return;
    this.isHovered = true;
    this.restDepth = this.depth;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this, y: this.restY - 28, scaleX: 1.1, scaleY: 1.1,
      duration: 150, ease: 'Quad.easeOut',
    });
    this.setDepth(50);
  }

  private onOut() {
    if (!this.isHovered) return;
    this.isHovered = false;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this, y: this.restY, scaleX: 1, scaleY: 1,
      duration: 150, ease: 'Quad.easeOut',
    });
    this.setDepth(this.restDepth);
  }

  // ── Animations ──────────────────────────────────────────────────────────
  flipIn(onComplete?: () => void) {
    this.setScale(0, 1);
    this.scene.tweens.add({
      targets: this, scaleX: 1,
      duration: 220, ease: 'Back.easeOut',
      onComplete,
    });
  }

  dealIn(fromX: number, fromY: number, delay = 0, onComplete?: () => void) {
    const targetX = this.x;
    const targetY = this.y;
    this.setPosition(fromX, fromY).setAlpha(0).setScale(0.6);
    this.scene.tweens.add({
      targets: this, x: targetX, y: targetY, alpha: 1, scaleX: 1, scaleY: 1,
      duration: 300, delay, ease: 'Quad.easeOut',
      onComplete: () => {
        this.isDealt = true;
        onComplete?.();
      },
    });
  }
}
