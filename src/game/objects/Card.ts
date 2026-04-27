// src/game/objects/Card.ts
import Phaser from 'phaser';
import type { Card as CardData, CardCategory, CardRarity } from '../../types/cards';
import { useGameStore, mustPlayCorruptionFirst } from '../../state/useGameStore';
import { sfxCardSelect, sfxGlitch } from '../../lib/audio';

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

const GLITCH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*></?[]{}\\|';

// ── Card class ───────────────────────────────────────────────────────────────
export class Card extends Phaser.GameObjects.Container {
  readonly cardData: CardData;
  private isHovered      = false;
  private isSelected     = false;
  private isDealt        = false;
  private isInapplicable = false;
  private restX      = 0;
  private restY      = 0;
  private restScale  = 1;   // set from whatever scale was applied before dealIn
  private restDepth  = 0;
  private selectionGlow!: Phaser.GameObjects.Graphics;

  // Animated text refs
  private nameText!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private statLabel: Phaser.GameObjects.Text | null = null;
  private statRawValue = 0;
  private statPrefix   = '';
  private artAreaY     = 0;

  // Timers
  private dropoutTimer?: Phaser.Time.TimerEvent;

  // Corruption overlay
  private corruptLayer?: Phaser.GameObjects.Container;

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
    const animData = this.getStatAnimData();
    const pillW = 36, pillH = 16;
    const pillX = left + CARD_W - PAD - pillW;

    if (statText) {
      const pill = this.scene.add.graphics();
      pill.fillStyle(catColor, 0.25);
      pill.fillRoundedRect(pillX, nameRowCY - pillH / 2, pillW, pillH, 3);
      pill.lineStyle(1, catColor, 0.7);
      pill.strokeRoundedRect(pillX, nameRowCY - pillH / 2, pillW, pillH, 3);
      this.add(pill);

      const initialStat = animData ? `${animData.prefix}0` : statText;
      const stat = this.txt(
        pillX + pillW / 2, nameRowCY,
        initialStat,
        { fontFamily: 'monospace', fontSize: '9px', color: catHex, fontStyle: 'bold' }
      ).setOrigin(0.5);
      this.add(stat);

      if (animData) {
        this.statLabel     = stat;
        this.statRawValue  = animData.value;
        this.statPrefix    = animData.prefix;
      }
    }

    const nameWrap = statText
      ? CARD_W - PAD * 2 - pillW - 5
      : CARD_W - PAD * 2;
    this.nameText = this.txt(
      left + PAD, nameRowCY,
      '',
      { fontFamily: 'monospace', fontSize: '11px', color: '#ffffff',
        fontStyle: 'bold', wordWrap: { width: nameWrap } }
    ).setOrigin(0, 0.5);
    this.add(this.nameText);

    // ── Art area ──────────────────────────────────────────────────────────
    const artX = left + PAD;
    const artY = nameRowTop + NAME_ROW_H + GAP;
    this.artAreaY = artY;
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

    // Description starts empty — filled by typewriter after deal-in
    this.descText = this.txt(
      left + PAD + 4, effectY + 5,
      '',
      {
        fontFamily: 'monospace', fontSize: '8.5px', color: '#c8d8e8',
        wordWrap: { width: CARD_W - PAD * 2 - 8 }, lineSpacing: 1,
      }
    ).setOrigin(0, 0);
    this.add(this.descText);

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
      // Raise and lock in the lifted state (same treatment as hover).
      // Only capture restDepth when not already hovered — onHover() already
      // stored the correct fan depth before raising to 50, so overwriting here
      // would snapshot the elevated depth and prevent proper restore on deselect.
      if (!this.isHovered) this.restDepth = this.depth;
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

  /** Update the rest position so subsequent tweens (hover, inapplicable) land correctly. */
  updateRestPosition(x: number, y: number) {
    this.restX = x;
    this.restY = y;
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

  /**
   * Mark this card as inapplicable (unplayable in the current context).
   * Inapplicable cards are dimmed and pushed slightly below the fan baseline.
   * Hover and click are both suppressed while inapplicable.
   */
  setInapplicable(v: boolean) {
    if (this.isInapplicable === v) return;
    this.isInapplicable = v;
    this.scene.tweens.killTweensOf(this);
    if (v) {
      // Force out of any hover / selection state visually
      this.isHovered = false;
      this.isSelected = false;
      this.selectionGlow.setVisible(false);
      this.scene.tweens.add({
        targets: this,
        x: this.restX, y: this.restY,
        alpha: 0.85,
        scaleX: this.restScale * 0.9,
        scaleY: this.restScale * 0.9,
        duration: 200, ease: 'Quad.easeOut',
      });
    } else {
      this.scene.tweens.add({
        targets: this,
        x: this.restX, y: this.restY,
        alpha: 1,
        scaleX: this.restScale,
        scaleY: this.restScale,
        duration: 200, ease: 'Quad.easeOut',
      });
    }
  }

  /** Apply or remove the corruption visual variant. */
  setCorrupted(v: boolean) {
    if (v && !this.corruptLayer) {
      const con = this.scene.add.container(0, 0);
      this.add(con);
      this.corruptLayer = con;

      // Offset red border — slightly inside the normal border
      const borderGfx = this.scene.add.graphics();
      borderGfx.lineStyle(1.5, 0xff1133, 0.7);
      borderGfx.strokeRoundedRect(-CARD_W / 2 + 3, -CARD_H / 2 + 3, CARD_W - 6, CARD_H - 6, RADIUS - 2);
      // Second border slightly outside, creating a doubled-frame glitch
      borderGfx.lineStyle(1, 0xff3355, 0.35);
      borderGfx.strokeRoundedRect(-CARD_W / 2 - 2, -CARD_H / 2 - 2, CARD_W + 4, CARD_H + 4, RADIUS + 2);
      // Subtle red tint fill
      borderGfx.fillStyle(0xff0000, 0.04);
      borderGfx.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, RADIUS);
      con.add(borderGfx);

      // Garbled text fragment in the art area
      const chars = '!@#$%^&*<>/?\\|{}[]01';
      const garble = Array.from({ length: 10 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join('');
      const glitchText = this.scene.add.text(
        -CARD_W / 2 + 10, this.artAreaY + 6,
        garble,
        { fontFamily: 'monospace', fontSize: '7px', color: '#ff335555',
          resolution: window.devicePixelRatio }
      );
      con.add(glitchText);

      // Pulse the corruption layer
      this.scene.tweens.add({
        targets: con,
        alpha: { from: 0.5, to: 1 },
        duration: 900, repeat: -1, yoyo: true, ease: 'Sine.easeInOut',
      });

    } else if (!v && this.corruptLayer) {
      this.scene.tweens.killTweensOf(this.corruptLayer);
      (this.corruptLayer as unknown as Phaser.GameObjects.Container).destroy(true);
      this.corruptLayer = undefined;
    }
  }

  private onClick() {
    if (this.isInapplicable) return;
    // No isDealt guard here — selection should work immediately even during deal-in animation
    const store = useGameStore.getState();
    if (store.phase !== 'MAIN') return;
    const current = store.players[store.currentPlayerIndex];
    if (!current?.isHuman) return;

    // Corruption-first: if the player must play The Corruption as their first card,
    // block selection of every other card.
    if (mustPlayCorruptionFirst(current, store.gameStats)) {
      const isCorruptionCard = this.cardData.category === 'EVENT_NEGATIVE' &&
        (this.cardData as import('../../types/cards').NegativeEventCard).effect === 'CORRUPTION';
      if (!isCorruptionCard) return;
    }

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
    const seed    = this.cardData.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const rnd     = (n: number) => { const v = Math.sin(seed + n * 127.1) * 43758.5453; return v - Math.floor(v); };
    const reduced = useGameStore.getState().reducedMotion;

    // ── Glow (static when reduced, pulsing otherwise) ────────────────────
    const glow = this.scene.add.graphics();
    glow.fillStyle(catColor, 0.07);
    glow.fillRoundedRect(artX, artY, artW, artH, 4);
    this.add(glow);
    if (!reduced) {
      this.scene.tweens.add({
        targets: glow,
        alpha: { from: 0.3, to: 1.0 },
        duration: 1600 + rnd(seed * 3) * 1400,
        repeat: -1, yoyo: true,
        ease: 'Sine.easeInOut',
        delay: rnd(seed * 11) * 800,
      });
    }

    if (!reduced) {
      // ── Scan line sweeping top → bottom ───────────────────────────────
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
        delay: rnd(seed * 5) * scanDuration,
      });
    }

    // ── Circuit nodes (static when reduced, flickering otherwise) ────────
    for (let i = 0; i < 7; i++) {
      const nx   = artX + 6 + rnd(i * 3)     * (artW - 12);
      const ny   = artY + 6 + rnd(i * 3 + 1) * (artH - 12);
      const size = rnd(i * 11 + 4) > 0.7 ? 3 : 2;
      const dot  = this.scene.add.graphics();
      dot.fillStyle(catColor, reduced ? 0.4 : 1);
      dot.fillCircle(nx, ny, size);
      this.add(dot);
      if (!reduced) {
        this.scene.tweens.add({
          targets: dot,
          alpha: { from: 0.07, to: 0.9 },
          duration: 450 + rnd(i * 13 + 6) * 950,
          repeat: -1, yoyo: true,
          delay: rnd(i * 7 + 1) * 800,
          ease: 'Sine.easeInOut',
        });
      }
    }

    if (!reduced) {
      // ── Data bead sliding across the art area ─────────────────────────
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
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────
  destroy(fromScene?: boolean) {
    this.dropoutTimer?.remove(false);
    this.dropoutTimer = undefined;
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

  private getStatAnimData(): { prefix: string; value: number } | null {
    const d = this.cardData;
    switch (d.category) {
      case 'CREDITS':        return { prefix: '+', value: d.amount };
      case 'EVENT_POSITIVE': return d.amount > 0 ? { prefix: '+', value: d.amount } : null;
      case 'EVENT_NEGATIVE': return d.amount > 0 ? { prefix: '-', value: d.amount } : null;
      default:               return null;
    }
  }

  // ── Hover effects ───────────────────────────────────────────────────────
  private tooltipTimer: ReturnType<typeof setTimeout> | null = null;

  private onHover() {
    if (this.isHovered || !this.isDealt || this.isInapplicable) return;
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
      // useGameStore.getState().setHoveredCard(this.cardData.id); // tooltip disabled
    }, 450);
  }

  private onOut() {
    if (!this.isHovered || this.isSelected) return;
    this.isHovered = false;
    if (this.tooltipTimer !== null) {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }
    // useGameStore.getState().setHoveredCard(null); // tooltip disabled
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

  /** Animate the card flying to the discard pile with a glitch burst, then call onComplete. */
  playOut(targetX: number, targetY: number, onComplete?: () => void) {
    sfxGlitch();
    this.setDepth(100);
    this.scene.tweens.killTweensOf(this);
    this.dropoutTimer?.remove(false);
    this.dropoutTimer = undefined;

    const spinDir = this.x < targetX ? 1 : -1;
    const startX  = this.x;

    // Chromatic aberration layers — red ghost left, cyan ghost right
    const redLayer = this.scene.add.graphics();
    redLayer.fillStyle(0xff2244, 0.28);
    redLayer.fillRoundedRect(-CARD_W / 2 - 5, -CARD_H / 2, CARD_W, CARD_H, RADIUS);

    const cyanLayer = this.scene.add.graphics();
    cyanLayer.fillStyle(0x00eeff, 0.28);
    cyanLayer.fillRoundedRect(-CARD_W / 2 + 5, -CARD_H / 2, CARD_W, CARD_H, RADIUS);

    this.addAt(cyanLayer, 0);
    this.addAt(redLayer, 0);

    // Horizontal jitter sequence, then fly
    this.x = startX + 7;
    this.scene.time.delayedCall(40,  () => { if (this.active) this.x = startX - 6; });
    this.scene.time.delayedCall(80,  () => { if (this.active) this.x = startX + 3; });
    this.scene.time.delayedCall(120, () => {
      if (!this.active) return;
      this.x = startX;
      redLayer.destroy();
      cyanLayer.destroy();
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
    });
  }

  dealIn(fromX: number, fromY: number, delay = 0, targetAlpha = 1, onComplete?: () => void) {
    const targetX = this.x;
    const targetY = this.y;
    // Capture whatever scale was set externally (e.g. 1.25 for human cards)
    this.restScale = this.scaleX;
    this.restX = targetX;
    this.restY = targetY;
    this.setPosition(fromX, fromY).setAlpha(0).setScale(this.restScale * 0.5);
    this.scene.tweens.add({
      targets: this, x: targetX, y: targetY, alpha: targetAlpha,
      scaleX: this.restScale, scaleY: this.restScale,
      duration: 300, delay, ease: 'Quad.easeOut',
      onComplete: () => {
        this.isDealt = true;
        if (!useGameStore.getState().reducedMotion) {
          this.startNameScramble();
          this.startTypewriter();
          this.startStatCountUp();
          this.startDropout();
        } else {
          // Reduced motion: populate text instantly
          this.descText.setText(this.cardData.description);
          if (this.statLabel) {
            this.statLabel.setText(`${this.statPrefix}${this.statRawValue}`);
          }
        }
        onComplete?.();
      },
    });
  }

  // ── Name scramble → resolve ─────────────────────────────────────────────
  private startNameScramble() {
    if (!this.scene || !this.active) return;
    const realName   = this.cardData.name.toUpperCase();
    const steps      = 14;
    let   iteration  = 0;

    this.scene.time.addEvent({
      delay: 38,
      repeat: steps - 1,
      callback: () => {
        if (!this.active) return;
        iteration++;
        const revealed = Math.floor((iteration / steps) * realName.length);
        const scrambled = realName.split('').map((ch, i) => {
          if (i < revealed || ch === ' ') return ch;
          return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
        }).join('');
        this.nameText.setText(scrambled);
        if (iteration >= steps) this.nameText.setText(realName);
      },
    });
  }

  // ── Description typewriter ──────────────────────────────────────────────
  private startTypewriter() {
    if (!this.scene || !this.active) return;
    const full = this.cardData.description;
    let   i    = 0;

    this.scene.time.addEvent({
      delay: 14,
      repeat: full.length - 1,
      callback: () => {
        if (!this.active) return;
        i++;
        this.descText.setText(full.slice(0, i));
      },
    });
  }

  // ── Stat count-up from 0 ────────────────────────────────────────────────
  private startStatCountUp() {
    if (!this.statLabel || !this.scene || !this.active) return;
    const target  = this.statRawValue;
    const prefix  = this.statPrefix;
    const steps   = 10;
    let   current = 0;

    this.scene.time.addEvent({
      delay: 30,
      repeat: steps - 1,
      callback: () => {
        if (!this.active || !this.statLabel) return;
        current++;
        const val = Math.round((current / steps) * target);
        this.statLabel.setText(`${prefix}${val}`);
        if (current >= steps) this.statLabel.setText(`${prefix}${target}`);
      },
    });
  }

  // ── Occasional signal dropout ───────────────────────────────────────────
  private startDropout() {
    if (!this.scene || !this.active) return;

    // Overlay that covers the card and briefly flashes opaque
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 1);
    overlay.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, RADIUS);
    overlay.setAlpha(0);
    this.add(overlay);

    const flash = () => {
      if (!this.active || !this.scene) return;
      overlay.setAlpha(0.88);
      this.scene.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: 90,
        ease: 'Linear',
        onComplete: scheduleNext,
      });
    };

    const scheduleNext = () => {
      if (!this.active || !this.scene) return;
      const delay = 5000 + Math.random() * 14000;
      this.dropoutTimer = this.scene.time.addEvent({ delay, callback: flash });
    };

    scheduleNext();
  }
}
