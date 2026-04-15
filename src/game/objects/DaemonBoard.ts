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
  private cards: Phaser.GameObjects.Container[] = [];
  private color: number;
  private colorHex: string;

  constructor(scene: Phaser.Scene, x: number, y: number, color = 0xaa44ff, colorHex = '#aa44ff') {
    super(scene, x, y);
    this.color    = color;
    this.colorHex = colorHex;
    this.setDepth(22);
    scene.add.existing(this);
  }

  /** Redraws all cards from the current daemons array. */
  refresh(daemons: DaemonType[]) {
    this.cards.forEach(c => c.destroy());
    this.cards = [];

    if (daemons.length === 0) return;

    const totalW = daemons.length * CARD_W + (daemons.length - 1) * GAP;
    const startX = -totalW / 2 + CARD_W / 2;

    daemons.forEach((imp, i) => {
      const cx = startX + i * (CARD_W + GAP);
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

  /**
   * Returns the WORLD-SPACE position where the next card will land
   * (used to aim the playOut animation before refresh() is called).
   */
  getNextSlotWorld(): { x: number; y: number } {
    const n = this.cards.length;          // current count
    const nextTotal = n + 1;
    const totalW = nextTotal * CARD_W + (nextTotal - 1) * GAP;
    const startX = -totalW / 2 + CARD_W / 2;
    const slotLocalX = startX + n * (CARD_W + GAP);
    return { x: this.x + slotLocalX, y: this.y };
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
