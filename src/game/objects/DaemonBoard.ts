// src/game/objects/ImprovementBoard.ts
import Phaser from 'phaser';
import type { DaemonType } from '../../types/cards';

const IMP_LABEL: Record<DaemonType, string> = {
  FIREWALL:      'FIREWALL',
  ENCRYPTION:    'ENCRYPTION',
  HARDENED_NODE: 'HARDENED NODE',
};

const IMP_DESC: Record<DaemonType, string> = {
  FIREWALL:      '+STABILITY\n-CORRUPTION',
  ENCRYPTION:    '+STABILITY\n-DATA FLOOD',
  HARDENED_NODE: '+STABILITY\n-WAR LOSSES',
};

const CARD_W = 62;
const CARD_H = 80;
const GAP    = 6;

export class DaemonBoard extends Phaser.GameObjects.Container {
  private cards:       Phaser.GameObjects.Container[] = [];
  private daemonTypes: DaemonType[]                   = [];
  private color:    number;
  private colorHex: string;

  constructor(scene: Phaser.Scene, x: number, y: number, color = 0xaa44ff, colorHex = '#aa44ff') {
    super(scene, x, y);
    this.color    = color;
    this.colorHex = colorHex;
    this.setDepth(22);
    scene.add.existing(this);
  }

  /** Redraws cards, animating out any daemons that were removed. */
  refresh(daemons: DaemonType[]) {
    const removedIndices = this.getRemovedIndices(this.daemonTypes, daemons);

    if (removedIndices.length > 0) {
      const removedTypes = removedIndices.map(i => this.daemonTypes[i]);

      // Animate each removed card out
      removedIndices.forEach(i => {
        if (this.cards[i]) this.animateTerminate(this.cards[i]);
      });

      // Survivors — tween to new positions in the smaller layout
      const survivingCards = this.cards.filter((_, i) => !removedIndices.includes(i));
      const survivingTypes = this.daemonTypes.filter((_, i) => !removedIndices.includes(i));
      const newTotalW = daemons.length * CARD_W + Math.max(0, daemons.length - 1) * GAP;
      const newStartX = daemons.length > 0 ? -newTotalW / 2 + CARD_W / 2 : 0;

      survivingCards.forEach((card, si) => {
        this.scene.tweens.add({
          targets: card,
          x: newStartX + si * (CARD_W + GAP),
          duration: 300, ease: 'Quad.easeOut',
        });
      });

      this.cards       = survivingCards;
      this.daemonTypes = survivingTypes;

      this.showTerminatedAlert(removedTypes);
      return;
    }

    // No removals — standard full rebuild (add or first build)
    this.cards.forEach(c => c.destroy());
    this.cards       = [];
    this.daemonTypes = [];
    this.buildCards(daemons);
  }

  /**
   * Returns the WORLD-SPACE position where the next card will land
   * (used to aim the playOut animation before refresh() is called).
   */
  getNextSlotWorld(): { x: number; y: number } {
    const n = this.cards.length;
    const nextTotal = n + 1;
    const totalW = nextTotal * CARD_W + (nextTotal - 1) * GAP;
    const startX = -totalW / 2 + CARD_W / 2;
    const slotLocalX = startX + n * (CARD_W + GAP);
    return { x: this.x + slotLocalX, y: this.y };
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private buildCards(daemons: DaemonType[]) {
    this.daemonTypes = [...daemons];
    if (daemons.length === 0) return;

    const totalW = daemons.length * CARD_W + (daemons.length - 1) * GAP;
    const startX = -totalW / 2 + CARD_W / 2;

    daemons.forEach((imp, i) => {
      const cx  = startX + i * (CARD_W + GAP);
      const con = this.buildCard(imp, cx);
      con.setAlpha(0);
      this.scene.tweens.add({
        targets: con, alpha: 1,
        duration: 200, delay: i * 60, ease: 'Quad.easeOut',
      });
      this.add(con);
      this.cards.push(con);
    });
  }

  /** Glitch-burst and dissolve a card that is being removed. */
  private animateTerminate(card: Phaser.GameObjects.Container) {
    this.scene.tweens.killTweensOf(card);
    const startX = card.x;

    // Red flash overlay
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0xff1133, 0.55);
    overlay.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5);
    card.add(overlay);

    // Horizontal jitter then dissolve
    card.x = startX + 5;
    this.scene.time.delayedCall(40,  () => { if (card.active) card.x = startX - 4; });
    this.scene.time.delayedCall(80,  () => { if (card.active) card.x = startX + 2; });
    this.scene.time.delayedCall(120, () => {
      if (!card.active) return;
      card.x = startX;
      this.scene.tweens.add({
        targets: card,
        alpha: 0, scaleX: 0.8, scaleY: 0.8,
        duration: 300, ease: 'Quad.easeIn',
        onComplete: () => card.destroy(),
      });
    });
  }

  /** Terminal-style alert that floats above the board briefly. */
  private showTerminatedAlert(types: DaemonType[]) {
    const names = types.map(t => IMP_LABEL[t]).join(', ');
    const dpr   = window.devicePixelRatio;
    const BW = 148, BH = 38;

    const con = this.scene.add.container(this.x, this.y - CARD_H / 2 - 26);
    con.setDepth(200).setAlpha(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x120006, 0.97);
    bg.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 5);
    bg.lineStyle(1.5, 0xff1133, 0.9);
    bg.strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 5);
    bg.fillStyle(0xff1133, 0.18);
    bg.fillRoundedRect(-BW / 2, -BH / 2, BW, 11, { tl: 5, tr: 5, bl: 0, br: 0 });
    con.add(bg);

    con.add(this.scene.add.text(0, -BH / 2 + 6, '⚠  DAEMON TERMINATED', {
      fontFamily: 'monospace', fontSize: '7px', color: '#ff3355',
      letterSpacing: 2, resolution: dpr,
    }).setOrigin(0.5));

    con.add(this.scene.add.text(0, BH / 2 - 9, `${names.toUpperCase()} PURGED`, {
      fontFamily: 'monospace', fontSize: '6px', color: '#ff333566',
      resolution: dpr,
    }).setOrigin(0.5));

    // Fade in, hold, then drift up and fade out
    this.scene.tweens.add({
      targets: con, alpha: 1,
      duration: 150, ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.time.delayedCall(1600, () => {
          this.scene.tweens.add({
            targets: con, alpha: 0, y: con.y - 14,
            duration: 350, ease: 'Quad.easeIn',
            onComplete: () => con.destroy(),
          });
        });
      },
    });
  }

  /** Returns indices in `prev` that have no match in `next`. */
  private getRemovedIndices(prev: DaemonType[], next: DaemonType[]): number[] {
    const removed: number[] = [];
    const pool = [...next];
    for (let i = 0; i < prev.length; i++) {
      const idx = pool.indexOf(prev[i]);
      if (idx >= 0) pool.splice(idx, 1);
      else removed.push(i);
    }
    return removed;
  }

  private buildCard(imp: DaemonType, cx: number): Phaser.GameObjects.Container {
    const con = this.scene.add.container(cx, 0);
    const dpr = window.devicePixelRatio;
    const c   = this.color;
    const ch  = this.colorHex;

    // Background + border
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0d0d1f, 1);
    bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5);
    bg.lineStyle(1.5, c, 0.85);
    bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5);
    // Top colour strip
    bg.fillStyle(c, 0.35);
    bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, 9,
      { tl: 5, tr: 5, bl: 0, br: 0 });
    // Inner glow
    bg.fillStyle(c, 0.04);
    bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5);
    con.add(bg);

    // Category icon
    con.add(this.scene.add.text(0, -CARD_H / 2 + 16, '[D]', {
      fontFamily: 'monospace', fontSize: '8px', color: ch, resolution: dpr,
    }).setOrigin(0.5));

    // Name
    con.add(this.scene.add.text(0, -CARD_H / 2 + 30, IMP_LABEL[imp], {
      fontFamily: 'monospace', fontSize: '7px', color: '#ffffff', fontStyle: 'bold',
      wordWrap: { width: CARD_W - 8 }, align: 'center', resolution: dpr,
    }).setOrigin(0.5, 0));

    // Description
    con.add(this.scene.add.text(0, CARD_H / 2 - 8, IMP_DESC[imp], {
      fontFamily: 'monospace', fontSize: '5px', color: ch,
      wordWrap: { width: CARD_W - 8 }, align: 'center', lineSpacing: 1, resolution: dpr,
    }).setOrigin(0.5, 1));

    // Active dot
    const dot = this.scene.add.graphics();
    dot.fillStyle(c, 0.7);
    dot.fillCircle(-CARD_W / 2 + 7, -CARD_H / 2 + 5, 2.5);
    con.add(dot);

    return con;
  }
}
