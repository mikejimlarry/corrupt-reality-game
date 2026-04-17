// src/game/objects/Card.ts
import Phaser from 'phaser';
import type { Card as CardData, CardCategory, CardRarity } from '../../types/cards';
import { useGameStore } from '../../state/useGameStore';
import { sfxCardSelect } from '../../lib/audio';

// ── Dimensions ───────────────────────────────────────────────────────────────
export const CARD_W = 150;
export const CARD_H = 210;
const PAD = 9;
const ART_H = 52;   // enlarged — now the primary visual zone
const RADIUS = 8;

// ── Colour palettes ──────────────────────────────────────────────────────────
const CAT_COLOR: Record<CardCategory, number> = {
  CREDITS:       0x00ff88,
  EVENT_POSITIVE:0x00ccff,
  EVENT_NEGATIVE:0xff3355,
  WAR:           0xff8800,
  COUNTER:       0xbb44ff,
  DAEMON:        0x00ffcc,
};

const CAT_LABEL: Record<CardCategory, string> = {
  CREDITS:       'DATA HARVEST',
  EVENT_POSITIVE:'SYSTEM EVENT',
  EVENT_NEGATIVE:'HACK PROTOCOL',
  WAR:           'WARFARE',
  COUNTER:       'COUNTERMEASURE',
  DAEMON:        'DAEMON',
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
  private isHovered  = false;
  private isSelected = false;
  private isDealt    = false;
  private restY      = 0;
  private restScale  = 1;   // set from whatever scale was applied before dealIn
  private restDepth  = 0;
  private selectionGlow!: Phaser.GameObjects.Graphics;

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
    const catColor    = CAT_COLOR[d.category];
    const catHex      = `#${catColor.toString(16).padStart(6, '0')}`;
    const rarityColor = RARITY_COLOR[d.rarity];
    const rarityHex   = RARITY_TEXT_COLOR[d.rarity];
    const left = -CARD_W / 2;
    const top  = -CARD_H / 2;

    // Row heights (measured downward from card top)
    const HEADER_H   = 18;  // category label + rarity badge bar
    const NAME_ROW_H = 22;  // card name + stat pill
    const GAP        = 4;   // generic vertical gap

    // ── Background ────────────────────────────────────────────────────────
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0d0d1f, 1);
    bg.fillRoundedRect(left, top, CARD_W, CARD_H, RADIUS);
    bg.lineStyle(1.5, catColor, 0.8);
    bg.strokeRoundedRect(left, top, CARD_W, CARD_H, RADIUS);
    this.add(bg);

    // ── Header bar: category label (left) + rarity badge (right) ─────────
    const headerBg = this.scene.add.graphics();
    headerBg.fillStyle(catColor, 0.18);
    headerBg.fillRoundedRect(left, top, CARD_W, HEADER_H, { tl: RADIUS, tr: RADIUS, bl: 0, br: 0 });
    headerBg.lineStyle(0.5, catColor, 0.4);
    headerBg.beginPath();
    headerBg.moveTo(left + PAD, top + HEADER_H);
    headerBg.lineTo(left + CARD_W - PAD, top + HEADER_H);
    headerBg.strokePath();
    this.add(headerBg);

    // Category label — left
    const catLabel = this.txt(
      left + PAD, top + HEADER_H / 2,
      CAT_LABEL[d.category],
      { fontFamily: 'monospace', fontSize: '7px', color: catHex, letterSpacing: 2 }
    ).setOrigin(0, 0.5);
    this.add(catLabel);

    // Rarity badge — right, horizontal pill
    const badgeW = 48, badgeH = 12;
    const badgeX = left + CARD_W - PAD - badgeW;
    const badgeY = top + (HEADER_H - badgeH) / 2;
    const badgeGfx = this.scene.add.graphics();
    badgeGfx.fillStyle(rarityColor, 0.22);
    badgeGfx.fillRoundedRect(badgeX, badgeY, badgeW, badgeH, 3);
    badgeGfx.lineStyle(1, rarityColor, 0.9);
    badgeGfx.strokeRoundedRect(badgeX, badgeY, badgeW, badgeH, 3);
    this.add(badgeGfx);
    const rarityLbl = this.txt(
      badgeX + badgeW / 2, badgeY + badgeH / 2,
      d.rarity,
      { fontFamily: 'monospace', fontSize: '7px', color: rarityHex }
    ).setOrigin(0.5);
    this.add(rarityLbl);

    // ── Name row: card name (left) + stat pill (right) ────────────────────
    const nameRowTop = top + HEADER_H + GAP;
    const nameRowCY  = nameRowTop + NAME_ROW_H / 2;

    const statText = this.getStatText(d);
    const pillW = 36, pillH = 16;
    const pillX = left + CARD_W - PAD - pillW;

    if (statText) {
      const pill = this.scene.add.graphics();
      pill.fillStyle(catColor, 0.25);
      pill.fillRoundedRect(pillX, nameRowCY - pillH / 2, pillW, pillH, 3);
      pill.lineStyle(1, catColor, 0.7);
      pill.strokeRoundedRect(pillX, nameRowCY - pillH / 2, pillW, pillH, 3);
      this.add(pill);
      const stat = this.txt(
        pillX + pillW / 2, nameRowCY,
        statText,
        { fontFamily: 'monospace', fontSize: '9px', color: catHex, fontStyle: 'bold' }
      ).setOrigin(0.5);
      this.add(stat);
    }

    const nameWrap = statText
      ? CARD_W - PAD * 2 - pillW - 5
      : CARD_W - PAD * 2;
    const name = this.txt(
      left + PAD, nameRowCY,
      d.name.toUpperCase(),
      { fontFamily: 'monospace', fontSize: '11px', color: '#ffffff',
        fontStyle: 'bold', wordWrap: { width: nameWrap } }
    ).setOrigin(0, 0.5);
    this.add(name);

    // ── Art area ──────────────────────────────────────────────────────────
    const artX = left + PAD;
    const artY = nameRowTop + NAME_ROW_H + GAP;
    const artW = CARD_W - PAD * 2;
    const art  = this.scene.add.graphics();
    art.fillStyle(0x061420, 1);
    art.fillRoundedRect(artX, artY, artW, ART_H, 4);
    this.add(art);

    this.drawCircuit(artX, artY, artW, ART_H, catColor);
    this.animateArt(artX, artY, artW, ART_H, catColor);

    // ── Description block ─────────────────────────────────────────────────
    const footerReserve = d.flavourText ? 24 + GAP : 0;
    const effectY   = artY + ART_H + GAP;
    const effectBot = top + CARD_H - PAD - footerReserve;
    const effectH   = Math.max(20, effectBot - effectY);

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
        fontFamily: 'monospace', fontSize: '8.5px', color: '#c8d8e8',
        wordWrap: { width: CARD_W - PAD * 2 - 8 }, lineSpacing: 1,
      }
    ).setOrigin(0, 0);
    this.add(desc);

    // ── Flavour text ──────────────────────────────────────────────────────
    if (d.flavourText) {
      const flavour = this.txt(
        left + PAD + 4, top + CARD_H - PAD,
        `"${d.flavourText}"`,
        { fontFamily: 'monospace', fontSize: '7px', color: '#4a5c6a',
          fontStyle: 'italic', wordWrap: { width: CARD_W - PAD * 2 - 8 } }
      ).setOrigin(0, 1);
      this.add(flavour);
    }

    // ── Interactivity ─────────────────────────────────────────────────────
    this.setSize(CARD_W, CARD_H);
    this.setInteractive();
    this.on('pointerover', this.onHover, this);
    this.on('pointerout', this.onOut, this);

    // Selection glow (hidden by default)
    const selGlow = this.scene.add.graphics();
    selGlow.lineStyle(3, 0x00ffcc, 0.85);
    selGlow.strokeRoundedRect(-CARD_W / 2 - 3, -CARD_H / 2 - 3, CARD_W + 6, CARD_H + 6, RADIUS + 2);
    selGlow.fillStyle(0x00ffcc, 0.05);
    selGlow.fillRoundedRect(-CARD_W / 2 - 3, -CARD_H / 2 - 3, CARD_W + 6, CARD_H + 6, RADIUS + 2);
    selGlow.setVisible(false);
    this.add(selGlow);
    this.selectionGlow = selGlow;

    // Click to select
    this.on('pointerdown', this.onClick, this);
  }

  setSelected(selected: boolean) {
    this.isSelected = selected;
    this.selectionGlow.setVisible(selected);

    if (selected) {
      // Raise and lock in the lifted state (same treatment as hover)
      this.restDepth = this.depth;
      this.scene.tweens.killTweensOf(this);
      this.scene.tweens.add({
        targets: this,
        y: this.restY - 30,
        scaleX: this.restScale * 1.08,
        scaleY: this.restScale * 1.08,
        duration: 150, ease: 'Quad.easeOut',
      });
      this.setDepth(50);
    } else {
      // Lower back to rest position on deselection
      this.isHovered = false;
      this.scene.tweens.killTweensOf(this);
      this.scene.tweens.add({
        targets: this,
        y: this.restY,
        scaleX: this.restScale,
        scaleY: this.restScale,
        duration: 150, ease: 'Quad.easeOut',
      });
      this.setDepth(this.restDepth);
    }
  }

  /** Update the rest-Y so hover lift/restore uses the correct target after a reposition tween. */
  updateRestY(y: number) {
    this.restY = y;
  }

  /** The scale at which this card sits at rest in the hand. */
  getRestScale(): number {
    return this.restScale;
  }

  /**
   * Reset selection state immediately (no tween, no killTweensOf).
   * Use this when a reposition tween is already in flight so we don't cancel it.
   */
  clearSelectionState() {
    this.isSelected = false;
    this.isHovered  = false;
    this.selectionGlow.setVisible(false);
  }

  private onClick() {
    // No isDealt guard here — selection should work immediately even during deal-in animation
    const store = useGameStore.getState();
    if (store.phase !== 'MAIN') return;
    const current = store.players[store.currentPlayerIndex];
    if (!current?.isHuman) return;

    // Daemon cards: block selection if the player already has this type active
    if (this.cardData.category === 'DAEMON') {
      const daemonType = (this.cardData as import('../../types/cards').DaemonCard).daemonType;
      if (daemonType && current.daemons.includes(daemonType)) return;
    }

    const newId = store.selectedCardId === this.cardData.id ? null : this.cardData.id;
    if (newId !== null) sfxCardSelect();
    store.selectCard(newId);
  }

  // ── Animated art layers ─────────────────────────────────────────────────
  private animateArt(artX: number, artY: number, artW: number, artH: number, catColor: number) {
    const seed = this.cardData.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const rnd  = (n: number) => { const v = Math.sin(seed + n * 127.1) * 43758.5453; return v - Math.floor(v); };

    // ── Glow pulse over the whole art area ──────────────────────────────
    const glow = this.scene.add.graphics();
    glow.fillStyle(catColor, 0.07);
    glow.fillRoundedRect(artX, artY, artW, artH, 4);
    this.add(glow);
    this.scene.tweens.add({
      targets: glow,
      alpha: { from: 0.3, to: 1.0 },
      duration: 1600 + rnd(seed * 3) * 1400,
      repeat: -1, yoyo: true,
      ease: 'Sine.easeInOut',
      delay: rnd(seed * 11) * 800,
    });

    // ── Scan line sweeping top → bottom ─────────────────────────────────
    const scanDurations: Partial<Record<CardCategory, number>> = {
      WAR: 650, EVENT_NEGATIVE: 580, CREDITS: 1100,
      EVENT_POSITIVE: 1000, COUNTER: 1300, DAEMON: 1900,
    };
    const scanDuration = scanDurations[this.cardData.category] ?? 1100;

    const scanLine = this.scene.add.graphics();
    scanLine.lineStyle(1, catColor, 0.22);
    scanLine.beginPath();
    scanLine.moveTo(artX, 0);
    scanLine.lineTo(artX + artW, 0);
    scanLine.strokePath();
    scanLine.y = artY;
    this.add(scanLine);
    this.scene.tweens.add({
      targets: scanLine,
      y: artY + artH,
      duration: scanDuration,
      repeat: -1,
      ease: 'Linear',
      delay: rnd(seed * 5) * scanDuration, // stagger start so cards don't sync
    });

    // ── Circuit node flicker ─────────────────────────────────────────────
    for (let i = 0; i < 7; i++) {
      const nx   = artX + 6 + rnd(i * 3)     * (artW - 12);
      const ny   = artY + 6 + rnd(i * 3 + 1) * (artH - 12);
      const size = rnd(i * 11 + 4) > 0.7 ? 3 : 2;
      const dot  = this.scene.add.graphics();
      dot.fillStyle(catColor, 1);
      dot.fillCircle(nx, ny, size);
      this.add(dot);
      this.scene.tweens.add({
        targets: dot,
        alpha: { from: 0.07, to: 0.9 },
        duration: 450 + rnd(i * 13 + 6) * 950,
        repeat: -1, yoyo: true,
        delay: rnd(i * 7 + 1) * 800,
        ease: 'Sine.easeInOut',
      });
    }

    // ── Data bead sliding across the art area ────────────────────────────
    const beadY = artY + artH * (0.2 + rnd(seed * 7) * 0.6);
    const bead  = this.scene.add.graphics();
    bead.fillStyle(catColor, 1);
    bead.fillCircle(0, 0, 1.5);
    bead.x = artX;
    bead.y = beadY;
    this.add(bead);
    this.scene.tweens.add({
      targets: bead,
      x: artX + artW,
      duration: 700 + rnd(seed * 9) * 700,
      repeat: -1, yoyo: true,
      ease: 'Sine.easeInOut',
    });
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────
  destroy(fromScene?: boolean) {
    // Kill tweens on all children (animated graphics) before they're destroyed
    this.scene?.tweens.killTweensOf(this);
    this.each((child: Phaser.GameObjects.GameObject) => {
      this.scene?.tweens.killTweensOf(child);
    });
    super.destroy(fromScene);
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
      case 'CREDITS':        return `+${d.amount}`;
      case 'EVENT_POSITIVE': return d.amount > 0 ? `+${d.amount}` : null;
      case 'EVENT_NEGATIVE': return d.amount > 0 ? `-${d.amount}` : null;
      case 'WAR':            return `W -${d.winnerLoses}`;
      default:               return null;
    }
  }

  // ── Hover effects ───────────────────────────────────────────────────────
  private tooltipTimer: ReturnType<typeof setTimeout> | null = null;

  private onHover() {
    if (this.isHovered || !this.isDealt) return;
    const { phase, players, currentPlayerIndex, selectedCardId } = useGameStore.getState();
    // Cards are inactive until the dice roll and draw are both done
    const isHuman = players[currentPlayerIndex]?.isHuman;
    if (!isHuman || phase === 'PHASE_ROLL' || phase === 'DRAW') return;
    // Don't lift other cards while one is selected
    if (selectedCardId !== null && selectedCardId !== this.cardData.id) return;
    this.isHovered = true;
    this.restDepth = this.depth;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      y: this.restY - 30,
      scaleX: this.restScale * 1.08,
      scaleY: this.restScale * 1.08,
      duration: 150, ease: 'Quad.easeOut',
    });
    this.setDepth(50);
    // Delay the tooltip so quick mouse passes don't trigger it
    this.tooltipTimer = setTimeout(() => {
      useGameStore.getState().setHoveredCard(this.cardData.id);
    }, 450);
  }

  private onOut() {
    if (!this.isHovered || this.isSelected) return;
    this.isHovered = false;
    if (this.tooltipTimer !== null) {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }
    useGameStore.getState().setHoveredCard(null);
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      y: this.restY,
      scaleX: this.restScale,
      scaleY: this.restScale,
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

  /** Animate the card flying to the discard pile, then call onComplete. */
  playOut(targetX: number, targetY: number, onComplete?: () => void) {
    this.setDepth(100);
    this.scene.tweens.killTweensOf(this);
    // Spin slightly toward centre for a natural "thrown" feel
    const spinDir = this.x < targetX ? 1 : -1;
    this.scene.tweens.add({
      targets: this,
      x: targetX, y: targetY,
      scaleX: this.restScale * 0.55,
      scaleY: this.restScale * 0.55,
      alpha: 0,
      angle: this.angle + spinDir * 20,
      duration: 380,
      ease: 'Quad.easeIn',
      onComplete,
    });
  }

  dealIn(fromX: number, fromY: number, delay = 0, targetAlpha = 1, onComplete?: () => void) {
    const targetX = this.x;
    const targetY = this.y;
    // Capture whatever scale was set externally (e.g. 1.25 for human cards)
    this.restScale = this.scaleX;
    this.setPosition(fromX, fromY).setAlpha(0).setScale(this.restScale * 0.5);
    this.scene.tweens.add({
      targets: this, x: targetX, y: targetY, alpha: targetAlpha,
      scaleX: this.restScale, scaleY: this.restScale,
      duration: 300, delay, ease: 'Quad.easeOut',
      onComplete: () => {
        this.isDealt = true;
        onComplete?.();
      },
    });
  }
}
