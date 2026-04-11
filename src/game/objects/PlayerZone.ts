// src/game/objects/PlayerZone.ts
import Phaser from 'phaser';
import type { PlayerState } from '../../types/gameState';

const W = 230;
const H = 108;
const PAD = 10;
const DPR = () => window.devicePixelRatio;

const HUMAN_COLOR  = 0x00ffcc;
const AI_COLOR     = 0xff3366;
const BAR_BG_COLOR = 0x1a1a2e;
const BAR_FG_COLOR_HUMAN = 0x00ffcc;
const BAR_FG_COLOR_AI    = 0xff3366;
const MAX_CREDITS = 200;

const IMP_LABEL: Record<string, string> = {
  FIREWALL:      '🔥 FIREWALL',
  ENCRYPTION:    '🔐 ENCRYPT',
  HARDENED_NODE: '🛡 H-NODE',
};

export class PlayerZone extends Phaser.GameObjects.Container {
  private popBar!:  Phaser.GameObjects.Graphics;
  private popLabel!: Phaser.GameObjects.Text;
  private statusDot!: Phaser.GameObjects.Arc;
  private player: PlayerState;
  private hidePop: boolean;
  private targetGlow?: Phaser.GameObjects.Graphics;
  private targetLabel?: Phaser.GameObjects.Text;
  private targetTween?: Phaser.Tweens.Tween;
  private targetLabelTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, player: PlayerState, hidePop = false) {
    super(scene, x, y);
    this.player = player;
    this.hidePop = hidePop;
    this.build();
    scene.add.existing(this);
  }

  private txt(x: number, y: number, str: string, style: Phaser.Types.GameObjects.Text.TextStyle) {
    return this.scene.add.text(x, y, str, { ...style, resolution: DPR() });
  }

  private build() {
    const p = this.player;
    const accent = p.isHuman ? HUMAN_COLOR : AI_COLOR;
    const accentHex = p.isHuman ? '#00ffcc' : '#ff3366';
    const left = -W / 2, top = -H / 2;

    // ── Background ──────────────────────────────────────────────────────────
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x080810, 1);
    bg.fillRoundedRect(left, top, W, H, 8);
    bg.lineStyle(1.5, accent, 0.7);
    bg.strokeRoundedRect(left, top, W, H, 8);
    this.add(bg);

    // Corner accent lines (top-left + bottom-right)
    const corner = this.scene.add.graphics();
    corner.lineStyle(2, accent, 1);
    corner.beginPath(); corner.moveTo(left + 2, top + 18); corner.lineTo(left + 2, top + 2); corner.lineTo(left + 18, top + 2); corner.strokePath();
    corner.beginPath(); corner.moveTo(-left - 2, -top - 18); corner.lineTo(-left - 2, -top - 2); corner.lineTo(-left - 18, -top - 2); corner.strokePath();
    this.add(corner);

    // ── Status dot ──────────────────────────────────────────────────────────
    this.statusDot = this.scene.add.circle(left + W - PAD - 5, top + PAD + 5, 4, accent, 1);
    this.scene.tweens.add({
      targets: this.statusDot, alpha: { from: 1, to: 0.3 },
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.add(this.statusDot);

    const statusLabel = this.txt(left + W - PAD - 14, top + PAD + 5, 'ONLINE', {
      fontFamily: 'monospace', fontSize: '7px', color: accentHex, letterSpacing: 1,
    }).setOrigin(1, 0.5);
    this.add(statusLabel);

    // ── Player handle ────────────────────────────────────────────────────────
    const handle = this.txt(left + PAD, top + PAD + 2, `▶ ${p.name.toUpperCase()}`, {
      fontFamily: 'monospace', fontSize: '10px', color: accentHex,
      fontStyle: 'bold', letterSpacing: 1,
    }).setOrigin(0, 0);
    this.add(handle);

    if (!p.isHuman) {
      const tag = this.txt(left + PAD, top + PAD + 18, p.personality ?? 'AI', {
        fontFamily: 'monospace', fontSize: '7px', color: '#556677', letterSpacing: 2,
      }).setOrigin(0, 0);
      this.add(tag);
    }

    // ── Population bar ────────────────────────────────────────────────────────
    const barY = top + 42;
    const barW = W - PAD * 2 - 36;
    const barH = 8;

    const barBg = this.scene.add.graphics();
    barBg.fillStyle(BAR_BG_COLOR, 1);
    barBg.fillRoundedRect(left + PAD, barY, barW, barH, 3);
    this.add(barBg);

    this.popBar = this.scene.add.graphics();
    this.drawBar(p.credits);
    this.add(this.popBar);

    // ── Population label ──────────────────────────────────────────────────────
    this.popLabel = this.txt(left + W - PAD, barY + barH / 2, this.hidePop ? '???' : `${p.credits}`, {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    this.add(this.popLabel);

    const popUnit = this.txt(left + W - PAD, barY + barH + 6, 'CREDITS', {
      fontFamily: 'monospace', fontSize: '7px', color: '#334455', letterSpacing: 3,
    }).setOrigin(1, 0);
    this.add(popUnit);

    // ── Separator ─────────────────────────────────────────────────────────────
    const sep = this.scene.add.graphics();
    sep.lineStyle(0.5, accent, 0.2);
    sep.beginPath();
    sep.moveTo(left + PAD, barY + barH + 14);
    sep.lineTo(-left - PAD, barY + barH + 14);
    sep.strokePath();
    this.add(sep);

    // ── Improvements ─────────────────────────────────────────────────────────
    const impY = barY + barH + 22;
    if (p.daemons.length > 0) {
      p.daemons.forEach((imp, i) => {
        const label = IMP_LABEL[imp] ?? imp;
        const pill = this.scene.add.graphics();
        const pillX = left + PAD + i * 76;
        pill.fillStyle(accent, 0.12);
        pill.fillRoundedRect(pillX, impY, 70, 16, 3);
        pill.lineStyle(0.5, accent, 0.5);
        pill.strokeRoundedRect(pillX, impY, 70, 16, 3);
        this.add(pill);

        const impText = this.txt(pillX + 35, impY + 8, label, {
          fontFamily: 'monospace', fontSize: '6px', color: accentHex,
        }).setOrigin(0.5);
        this.add(impText);
      });
    } else {
      const noImp = this.txt(left + PAD, impY + 8, 'NO DAEMONS', {
        fontFamily: 'monospace', fontSize: '6px', color: '#223344', letterSpacing: 2,
      }).setOrigin(0, 0.5);
      this.add(noImp);
    }

    // ── Card count badge (AI only) ────────────────────────────────────────────
    if (!p.isHuman) {
      const cards = this.txt(-left - PAD, impY + 8, `🃏 ${p.hand.length} CARDS`, {
        fontFamily: 'monospace', fontSize: '7px', color: '#334455',
      }).setOrigin(1, 0.5);
      this.add(cards);
    }

    this.setSize(W, H);
  }

  private drawBar(pop: number) {
    const p = this.player;
    const accent = p.isHuman ? BAR_FG_COLOR_HUMAN : BAR_FG_COLOR_AI;
    const left = -W / 2;
    const barY = -H / 2 + 42;
    const barW = W - PAD * 2 - 36;
    const barH = 8;
    const fillW = Math.max(2, (Math.min(pop, MAX_CREDITS) / MAX_CREDITS) * barW);

    this.popBar.clear();
    this.popBar.fillStyle(accent, 0.9);
    this.popBar.fillRoundedRect(left + PAD, barY, fillW, barH, 3);

    // Glow segment at the right edge of the bar
    if (fillW > 6) {
      this.popBar.fillStyle(0xffffff, 0.4);
      this.popBar.fillRoundedRect(left + PAD + fillW - 4, barY + 1, 4, barH - 2, 2);
    }
  }

  refresh(player: PlayerState) {
    this.player = player;
    this.drawBar(player.credits);
    this.popLabel.setText(this.hidePop ? '???' : `${player.credits}`);
  }

  /**
   * Show or hide the targeting highlight. When active, adds a pulsing red
   * border and makes the zone clickable. Pass null for onClick to deactivate.
   */
  setTargetable(active: boolean, onClick?: () => void) {
    // Clean up any existing highlight + listeners
    this.targetTween?.stop();
    this.targetLabelTween?.stop();
    this.targetGlow?.destroy();
    this.targetLabel?.destroy();
    this.targetGlow = undefined;
    this.targetLabel = undefined;
    this.removeInteractive();
    this.removeAllListeners('pointerdown');

    if (!active) return;

    const left = -W / 2, top = -H / 2;
    const TARGET_COLOR = 0xff3333;

    // Pulsing red border glow
    const glow = this.scene.add.graphics();
    glow.lineStyle(2.5, TARGET_COLOR, 0.9);
    glow.strokeRoundedRect(left - 3, top - 3, W + 6, H + 6, 10);
    glow.fillStyle(TARGET_COLOR, 0.08);
    glow.fillRoundedRect(left - 3, top - 3, W + 6, H + 6, 10);
    this.add(glow);
    this.targetGlow = glow;

    this.targetTween = this.scene.tweens.add({
      targets: glow,
      alpha: { from: 1, to: 0.25 },
      duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // "CLICK TO TARGET" label centred in zone
    const label = this.scene.add.text(0, H / 2 - 18, '▼  CLICK TO TARGET  ▼', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#ff4444',
      letterSpacing: 2,
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5);
    this.add(label);
    this.targetLabel = label;

    this.targetLabelTween = this.scene.tweens.add({
      targets: label,
      alpha: { from: 1, to: 0.3 },
      duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.setInteractive();
    if (onClick) {
      this.on('pointerdown', onClick);
      this.scene.input.setDefaultCursor('crosshair');
    }
  }
}
