// src/game/objects/PlayerZone.ts
import Phaser from 'phaser';
import type { PlayerState } from '../../types/gameState';
import type { DaemonType } from '../../types/cards';

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
  FIREWALL:      '[FW] FIREWALL',
  ENCRYPTION:    '[EN] ENCRYPT',
  HARDENED_NODE: '[HN] H-NODE',
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
  // Daemon row items — rebuilt on every refresh
  private daemonItems: Phaser.GameObjects.GameObject[] = [];
  // AI card count label — updated on refresh
  private cardCountText?: Phaser.GameObjects.Text;
  private statusDotTween?: Phaser.Tweens.Tween;

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
    this.statusDotTween = this.scene.tweens.add({
      targets: this.statusDot, alpha: { from: 1, to: 0.3 },
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.add(this.statusDot);

    const statusLabel = this.txt(left + W - PAD - 14, top + PAD + 5, !p.eliminated ? 'ONLINE' : 'OFFLINE', {
      fontFamily: 'monospace', fontSize: '7px', color: accentHex, letterSpacing: 1,
    }).setOrigin(1, 0.5);
    this.add(statusLabel);

    // ── Player handle ────────────────────────────────────────────────────────
    const handle = this.txt(left + PAD, top + PAD + 2, `> ${p.name.toUpperCase()}`, {
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

    // ── Daemon row (built and refreshed dynamically) ──────────────────────────
    const impY = barY + barH + 22;

    // AI card count badge placeholder (right-aligned, updated on refresh)
    if (!p.isHuman) {
      this.cardCountText = this.txt(-left - PAD, impY + 8, `[${p.hand.length}] CARDS`, {
        fontFamily: 'monospace', fontSize: '7px', color: '#334455',
      }).setOrigin(1, 0.5);
      this.add(this.cardCountText);
    }

    this.buildDaemonRow(p.daemons);
    this.setSize(W, H);
  }

  private buildDaemonRow(daemons: DaemonType[]) {
    // Destroy previous daemon row items
    this.daemonItems.forEach(item => {
      this.remove(item, true);
    });
    this.daemonItems = [];

    const p = this.player;
    const accent = p.isHuman ? HUMAN_COLOR : AI_COLOR;
    const accentHex = p.isHuman ? '#00ffcc' : '#ff3366';
    const left = -W / 2, top = -H / 2;
    const barY = top + 42;
    const barH = 8;
    const impY = barY + barH + 22;

    if (daemons.length > 0) {
      daemons.forEach((imp, i) => {
        const label = IMP_LABEL[imp] ?? imp;
        const pill = this.scene.add.graphics();
        const pillX = left + PAD + i * 76;
        pill.fillStyle(accent, 0.12);
        pill.fillRoundedRect(pillX, impY, 70, 16, 3);
        pill.lineStyle(0.5, accent, 0.5);
        pill.strokeRoundedRect(pillX, impY, 70, 16, 3);
        this.add(pill);
        this.daemonItems.push(pill);

        const impText = this.txt(pillX + 35, impY + 8, label, {
          fontFamily: 'monospace', fontSize: '6px', color: accentHex,
        }).setOrigin(0.5);
        this.add(impText);
        this.daemonItems.push(impText);
      });
    } else {
      const noImp = this.txt(left + PAD, impY + 8, 'NO DAEMONS', {
        fontFamily: 'monospace', fontSize: '6px', color: '#223344', letterSpacing: 2,
      }).setOrigin(0, 0.5);
      this.add(noImp);
      this.daemonItems.push(noImp);
    }
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

    if (fillW > 6) {
      this.popBar.fillStyle(0xffffff, 0.4);
      this.popBar.fillRoundedRect(left + PAD + fillW - 4, barY + 1, 4, barH - 2, 2);
    }
  }

  refresh(player: PlayerState) {
    const prevCredits = this.player.credits;
    this.player = player;
    this.drawBar(player.credits);
    this.popLabel.setText(this.hidePop ? '???' : `${player.credits}`);
    this.buildDaemonRow(player.daemons);
    if (this.cardCountText) {
      this.cardCountText.setText(`[${player.hand.length}] CARDS`);
    }

    // Stop the status dot pulse once a player is eliminated
    if (player.eliminated && this.statusDotTween?.isPlaying()) {
      this.statusDotTween.stop();
      this.statusDot.setAlpha(0.25);
    }

    // Flash credit change
    const delta = player.credits - prevCredits;
    if (delta !== 0) this.flashCreditDelta(delta);
  }

  /** Flash a floating +/- delta number and briefly colour the credit label. */
  flashCreditDelta(delta: number) {
    const isGain  = delta > 0;
    const color   = isGain ? '#00ff88' : '#ff3355';
    const colorN  = isGain ? 0x00ff88  : 0xff3355;
    const label   = `${isGain ? '+' : ''}${delta}`;

    // Zone flash overlay
    const left = -W / 2, top = -H / 2;
    const flash = this.scene.add.graphics();
    flash.fillStyle(colorN, 0.22);
    flash.fillRoundedRect(left, top, W, H, 8);
    this.add(flash);
    this.scene.tweens.add({
      targets: flash, alpha: 0,
      duration: 500, ease: 'Quad.easeOut',
      onComplete: () => { this.remove(flash, true); },
    });

    // Floating delta text (world-space so rotation doesn't affect it)
    const wx = this.x + (W / 2 - PAD - 10) * Math.cos(Phaser.Math.DegToRad(this.angle))
                      - (-H / 2 + 46)       * Math.sin(Phaser.Math.DegToRad(this.angle));
    const wy = this.y + (W / 2 - PAD - 10) * Math.sin(Phaser.Math.DegToRad(this.angle))
                      + (-H / 2 + 46)       * Math.cos(Phaser.Math.DegToRad(this.angle));

    const floatTxt = this.scene.add.text(wx, wy, label, {
      fontFamily: 'monospace', fontSize: '16px', color,
      fontStyle: 'bold', resolution: window.devicePixelRatio,
    }).setOrigin(0.5).setDepth(100);

    this.scene.tweens.add({
      targets: floatTxt,
      y: floatTxt.y - 32,
      alpha: 0,
      duration: 750, ease: 'Quad.easeOut',
      onComplete: () => floatTxt.destroy(),
    });

    // Credit label colour flash
    this.popLabel.setStyle({ color });
    this.scene.time.delayedCall(400, () => {
      if (this.popLabel?.active) this.popLabel.setStyle({ color: '#ffffff' });
    });
  }

  /**
   * Show or hide the targeting highlight. When active, adds a pulsing red
   * border and makes the zone clickable.
   */
  setTargetable(active: boolean, onClick?: () => void) {
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

    const label = this.scene.add.text(0, H / 2 - 18, 'v  CLICK TO TARGET  v', {
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
