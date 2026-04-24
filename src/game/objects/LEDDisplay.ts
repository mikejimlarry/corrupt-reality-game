// src/game/objects/LEDDisplay.ts
import Phaser from 'phaser';
import { sfxDiceTick, sfxShowDiceRoll, sfxToast } from '../../lib/audio';
import { useGameStore } from '../../state/useGameStore';

const PANEL_W  = 340;
const PANEL_H  = 230;
const DIGIT_W  = 32;   // 43 × 0.75 — 25% smaller than previous
const DIGIT_H  = 50;   // 67 × 0.75 — 25% smaller than previous
const SEG_T    = 4;    // segment thickness scaled proportionally
const GAP      = 2;
const D_CX     = 76;   // horizontal distance from panel centre to each digit centre

// Derived vertical anchors — keep all layout relative to these
const DIGIT_TOP_Y   = -PANEL_H / 2 + 36;                  // top of digit area
const DIGIT_CY      = DIGIT_TOP_Y + DIGIT_H / 2;          // vertical centre of digits
const BELOW_DIGITS  = DIGIT_TOP_Y + DIGIT_H + 10;         // first row below digits
const SCREEN_BOTTOM = DIGIT_TOP_Y + DIGIT_H + 16;         // bottom edge of screen recess rect
const NAME_Y        = SCREEN_BOTTOM + 12;                  // war: player name labels (clear of border)
const BONUS_Y       = SCREEN_BOTTOM + 24;                  // war: tactical modifier labels

const COLOR_DIM         = 0x001508;
const COLOR_GREEN       = 0x00ff55;
const COLOR_AMBER       = 0xffaa00;
const COLOR_ORANGE      = 0xff8800;
const COLOR_CORRUPT     = 0xff1133;
const COLOR_CORRUPT_DIM = 0x150003;

// 7 segments: [top, topRight, botRight, bottom, botLeft, topLeft, middle]
const SEG_MAP: Record<string | number, boolean[]> = {
  '-': [false, false, false, false, false, false, true ],
  1:   [false, true,  true,  false, false, false, false],
  2:   [true,  true,  false, true,  true,  false, true ],
  3:   [true,  true,  true,  true,  false, false, true ],
  4:   [false, true,  true,  false, false, true,  true ],
  5:   [true,  false, true,  true,  false, true,  true ],
  6:   [true,  false, true,  true,  true,  true,  true ],
};

export class LEDDisplay extends Phaser.GameObjects.Container {
  private bezel!:         Phaser.GameObjects.Graphics;
  private screenBgs:      Phaser.GameObjects.Graphics[] = [];
  private headerTxt!:     Phaser.GameObjects.Text;
  private digit1Gfx!:    Phaser.GameObjects.Graphics;
  private digit2Gfx!:    Phaser.GameObjects.Graphics;
  private glow1!:         Phaser.GameObjects.Graphics;
  private glow2!:         Phaser.GameObjects.Graphics;
  private operatorTxt!:   Phaser.GameObjects.Text;
  private totalTxt!:      Phaser.GameObjects.Text;
  private name1Txt!:      Phaser.GameObjects.Text;
  private name2Txt!:      Phaser.GameObjects.Text;
  private statusTxt!:     Phaser.GameObjects.Text;
  private toastBg!:       Phaser.GameObjects.Graphics;
  private toastTxt!:      Phaser.GameObjects.Text;
  private daemonBonusTxt!: Phaser.GameObjects.Text;
  private standbyTween?:  Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.setDepth(200).setVisible(false).setAlpha(0);
    this.build();
    scene.add.existing(this);
  }

  private txt(x: number, y: number, str: string, style: Phaser.Types.GameObjects.Text.TextStyle) {
    return this.scene.add.text(x, y, str, { ...style, resolution: window.devicePixelRatio });
  }

  private build() {
    // ── Bezel ─────────────────────────────────────────────────────────────
    this.bezel = this.scene.add.graphics();
    this.bezel.fillStyle(0x070b0d, 1);
    this.bezel.fillRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 12);
    this.bezel.lineStyle(1.5, 0x00ffcc, 0.35);
    this.bezel.strokeRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 12);
    this.bezel.lineStyle(0.5, 0x00ffcc, 0.07);
    this.bezel.strokeRoundedRect(-PANEL_W / 2 + 5, -PANEL_H / 2 + 5, PANEL_W - 10, PANEL_H - 10, 9);
    this.add(this.bezel);

    // ── Corner screws ─────────────────────────────────────────────────────
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      const cx = sx * (PANEL_W / 2 - 14);
      const cy = sy * (PANEL_H / 2 - 14);
      const s = this.scene.add.graphics();
      s.fillStyle(0x1a2030, 1); s.fillCircle(cx, cy, 5);
      s.lineStyle(0.75, 0x334455, 0.8); s.strokeCircle(cx, cy, 5);
      s.lineStyle(0.75, 0x0a1420, 1);
      s.beginPath(); s.moveTo(cx - 3, cy); s.lineTo(cx + 3, cy); s.strokePath();
      s.beginPath(); s.moveTo(cx, cy - 3); s.lineTo(cx, cy + 3); s.strokePath();
      this.add(s);
    });

    // ── Screen recesses (aligned to digit area) ───────────────────────────
    const screenH = DIGIT_H + 24;
    [-D_CX, D_CX].forEach(cx => {
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x000a05, 1);
      bg.fillRoundedRect(cx - DIGIT_W / 2 - 16, DIGIT_TOP_Y - 8, DIGIT_W + 32, screenH, 6);
      bg.lineStyle(1, 0x003322, 1);
      bg.strokeRoundedRect(cx - DIGIT_W / 2 - 16, DIGIT_TOP_Y - 8, DIGIT_W + 32, screenH, 6);
      this.add(bg);
      this.screenBgs.push(bg);
    });

    // ── Header ────────────────────────────────────────────────────────────
    this.headerTxt = this.txt(0, -PANEL_H / 2 + 16, 'RNG · SEQUENCE · GENERATOR', {
      fontFamily: 'monospace', fontSize: '8px', color: '#00ffcc77', letterSpacing: 5,
    }).setOrigin(0.5);
    this.add(this.headerTxt);

    // ── Glow layers (behind digits) ───────────────────────────────────────
    this.glow1 = this.scene.add.graphics(); this.add(this.glow1);
    this.glow2 = this.scene.add.graphics(); this.add(this.glow2);

    // ── Digit graphics ────────────────────────────────────────────────────
    this.digit1Gfx = this.scene.add.graphics(); this.add(this.digit1Gfx);
    this.digit2Gfx = this.scene.add.graphics(); this.add(this.digit2Gfx);

    this.drawDigit(this.digit1Gfx, this.glow1, '-', COLOR_DIM, -D_CX);
    this.drawDigit(this.digit2Gfx, this.glow2, '-', COLOR_DIM,  D_CX);

    // ── Operator (vertically centred with digits) ─────────────────────────
    this.operatorTxt = this.txt(0, DIGIT_CY, '+', {
      fontFamily: 'monospace', fontSize: '22px', color: '#334455', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add(this.operatorTxt);

    // ── Total (one clear row below digits) ────────────────────────────────
    this.totalTxt = this.txt(0, BELOW_DIGITS + 6, '', {
      fontFamily: 'monospace', fontSize: '27px', color: '#334455', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add(this.totalTxt);

    // ── Player name labels (war mode only — shown below each die) ─────────
    this.name1Txt = this.txt(-D_CX, NAME_Y, '', {
      fontFamily: 'monospace', fontSize: '8px', color: '#ff8800cc', letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0);
    this.add(this.name1Txt);

    this.name2Txt = this.txt(D_CX, NAME_Y, '', {
      fontFamily: 'monospace', fontSize: '8px', color: '#ff8800cc', letterSpacing: 2,
    }).setOrigin(0.5).setAlpha(0);
    this.add(this.name2Txt);

    // ── Status / result lines (pinned to bottom of panel) ─────────────────
    this.statusTxt = this.txt(0, PANEL_H / 2 - 24, 'AWAITING INPUT', {
      fontFamily: 'monospace', fontSize: '8px', color: '#334455', letterSpacing: 4,
    }).setOrigin(0.5);
    this.add(this.statusTxt);

    // ── Credit toast (hidden until roll resolves) ─────────────────────────
    const TOAST_Y  = BELOW_DIGITS + 48;
    const TOAST_W  = 230;
    const TOAST_H  = 28;
    this.toastBg = this.scene.add.graphics();
    this.toastBg.setAlpha(0);
    this.add(this.toastBg);

    this.toastTxt = this.txt(0, TOAST_Y, '', {
      fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold',
      color: '#00ff55', letterSpacing: 2,
    }).setOrigin(0.5);
    this.toastTxt.setAlpha(0);
    this.add(this.toastTxt);

    this.daemonBonusTxt = this.txt(0, TOAST_Y + 26, '', {
      fontFamily: 'monospace', fontSize: '8px', color: '#00ffcc99', letterSpacing: 3,
    }).setOrigin(0.5).setAlpha(0);
    this.add(this.daemonBonusTxt);

    // store layout refs for reuse in roll()
    (this as any)._toastY = TOAST_Y;
    (this as any)._toastW = TOAST_W;
    (this as any)._toastH = TOAST_H;

    // ── Scanlines (skipped in reduced-motion mode) ────────────────────────
    if (!useGameStore.getState().reducedMotion) {
      const scan = this.scene.add.graphics();
      scan.lineStyle(1, 0x000000, 0.08);
      for (let ry = -PANEL_H / 2 + 6; ry < PANEL_H / 2 - 6; ry += 3) {
        scan.beginPath(); scan.moveTo(-PANEL_W / 2 + 6, ry);
        scan.lineTo(PANEL_W / 2 - 6, ry); scan.strokePath();
      }
      this.add(scan);
    }
  }

  // ── Draw a single hex-bevelled segment ───────────────────────────────────
  private drawHSeg(g: Phaser.GameObjects.Graphics, x: number, y: number, lit: boolean, color: number) {
    const W = DIGIT_W - GAP * 2, T = SEG_T, bevel = T / 2;
    g.fillStyle(lit ? color : COLOR_DIM, 1);
    g.fillPoints([
      { x: x + bevel, y }, { x: x + W - bevel, y },
      { x: x + W, y: y + bevel }, { x: x + W - bevel, y: y + T },
      { x: x + bevel, y: y + T }, { x, y: y + bevel },
    ], true);
    if (lit) { g.fillStyle(color, 0.1); g.fillRect(x - 4, y - 4, W + 8, T + 8); }
  }

  private drawVSeg(g: Phaser.GameObjects.Graphics, x: number, y: number, lit: boolean, color: number) {
    const H = DIGIT_H / 2 - SEG_T - GAP * 2, T = SEG_T, bevel = T / 2;
    g.fillStyle(lit ? color : COLOR_DIM, 1);
    g.fillPoints([
      { x: x + bevel, y }, { x: x + T, y: y + bevel },
      { x: x + T, y: y + H - bevel }, { x: x + bevel, y: y + H },
      { x, y: y + H - bevel }, { x, y: y + bevel },
    ], true);
    if (lit) { g.fillStyle(color, 0.1); g.fillRect(x - 4, y - 4, T + 8, H + 8); }
  }

  private drawDigit(
    g: Phaser.GameObjects.Graphics,
    glow: Phaser.GameObjects.Graphics,
    digit: number | '-',
    color: number,
    cx: number,
  ) {
    g.clear(); glow.clear();
    const segs = SEG_MAP[digit] ?? SEG_MAP['-'];
    const ox   = cx - DIGIT_W / 2;
    const oy   = DIGIT_TOP_Y;
    const halfH = DIGIT_H / 2, T = SEG_T;

    this.drawHSeg(g, ox + GAP,               oy + GAP,               segs[0], color);
    this.drawVSeg(g, ox + DIGIT_W - T - GAP, oy + T + GAP,           segs[1], color);
    this.drawVSeg(g, ox + DIGIT_W - T - GAP, oy + halfH + GAP,       segs[2], color);
    this.drawHSeg(g, ox + GAP,               oy + DIGIT_H - T - GAP, segs[3], color);
    this.drawVSeg(g, ox + GAP,               oy + halfH + GAP,       segs[4], color);
    this.drawVSeg(g, ox + GAP,               oy + T + GAP,           segs[5], color);
    this.drawHSeg(g, ox + GAP,               oy + halfH - T / 2,     segs[6], color);

    if (digit !== '-' && color !== COLOR_DIM) {
      glow.fillStyle(color, 0.04);
      glow.fillRoundedRect(cx - DIGIT_W / 2 - 16, oy - 6, DIGIT_W + 32, DIGIT_H + 12, 6);
    }
  }

  // ── Open animation — two-phase wipe using a Graphics mask ─────────────────
  // Phase 1 (152ms): mask expands vertically (scaleY 0→1 on the mask rect).
  // Phase 2 (228ms): mask expands horizontally (scaleX 0.04→1 on the mask rect).
  // The container itself stays at full scale so children always render correctly.
  private maskGfx?: Phaser.GameObjects.Graphics;

  private unfoldOpen(playSound = true) {
    // Remove any existing mask
    if (this.maskGfx) { this.maskGfx.destroy(); this.maskGfx = undefined; }
    this.clearMask();

    this.setAlpha(1);
    this.setVisible(true);
    if (playSound) sfxShowDiceRoll();

    // Reduced motion: skip the wipe animation entirely, signal immediately.
    if (useGameStore.getState().reducedMotion) {
      window.dispatchEvent(new CustomEvent('crg:led-open'));
      return;
    }

    const W = PANEL_W + 4, H = PANEL_H + 4;
    // Use the constructor directly (NOT scene.add.graphics) so the mask graphics
    // is NOT added to the scene display list — avoids rendering a visible white
    // rectangle over the LED while it's being used as a geometry mask.
    const mg = new Phaser.GameObjects.Graphics(this.scene);
    // Proxy object to drive the tween
    const proxy = { sy: 0.01, sx: 0.04 };

    const redraw = () => {
      mg.clear();
      mg.fillStyle(0xffffff);
      const w = W * proxy.sx;
      const h = H * proxy.sy;
      mg.fillRect(this.x - w / 2, this.y - h / 2, w, h);
    };
    redraw();

    const bitmapMask = mg.createGeometryMask();
    this.setMask(bitmapMask);
    this.maskGfx = mg;

    // Phase 1: expand vertically
    this.scene.tweens.add({
      targets: proxy, sy: 1,
      duration: 152, ease: 'Cubic.easeOut',
      onUpdate: redraw,
      onComplete: () => {
        // Phase 2: expand horizontally
        this.scene.tweens.add({
          targets: proxy, sx: 1,
          duration: 228, ease: 'Quad.easeOut',
          onUpdate: redraw,
          onComplete: () => {
            // Mask no longer needed once fully open
            this.clearMask();
            mg.destroy();
            this.maskGfx = undefined;
            // Signal React that the LED panel is fully open
            window.dispatchEvent(new CustomEvent('crg:led-open'));
          },
        });
      },
    });
  }

  // ── Close animation — two-phase wipe in reverse ───────────────────────────
  private foldClose(onComplete: () => void) {
    if (this.maskGfx) { this.maskGfx.destroy(); this.maskGfx = undefined; }
    this.clearMask();

    // Reduced motion: hide instantly.
    if (useGameStore.getState().reducedMotion) {
      this.setVisible(false);
      onComplete();
      return;
    }

    const W = PANEL_W + 4, H = PANEL_H + 4;
    // Same as unfoldOpen: avoid scene.add.graphics() to prevent visible white rect.
    const mg = new Phaser.GameObjects.Graphics(this.scene);
    const proxy = { sy: 1, sx: 1 };

    const redraw = () => {
      mg.clear();
      mg.fillStyle(0xffffff);
      const w = W * proxy.sx;
      const h = H * proxy.sy;
      mg.fillRect(this.x - w / 2, this.y - h / 2, w, h);
    };
    redraw();

    const bitmapMask = mg.createGeometryMask();
    this.setMask(bitmapMask);
    this.maskGfx = mg;

    // Phase 1: collapse horizontally
    this.scene.tweens.add({
      targets: proxy, sx: 0.04,
      duration: 154, ease: 'Quad.easeIn',
      onUpdate: redraw,
      onComplete: () => {
        // Phase 2: collapse vertically
        this.scene.tweens.add({
          targets: proxy, sy: 0.01,
          duration: 126, ease: 'Quad.easeIn',
          onUpdate: redraw,
          onComplete: () => {
            this.clearMask();
            mg.destroy();
            this.maskGfx = undefined;
            this.setVisible(false);
            onComplete();
          },
        });
      },
    });
  }

  // ── Swap teal ↔ red theme based on corruption mode ───────────────────────
  private applyTheme(isCorruption: boolean) {
    const accent       = isCorruption ? 0xff1133  : 0x00ffcc;
    const accentDim    = isCorruption ? '#ff113377' : '#00ffcc77';
    const screenFill   = isCorruption ? 0x0a0003  : 0x000a05;
    const screenBorder = isCorruption ? 0x330011  : 0x003322;

    this.bezel.clear();
    this.bezel.fillStyle(0x070b0d, 1);
    this.bezel.fillRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 12);
    this.bezel.lineStyle(1.5, accent, 0.35);
    this.bezel.strokeRoundedRect(-PANEL_W / 2, -PANEL_H / 2, PANEL_W, PANEL_H, 12);
    this.bezel.lineStyle(0.5, accent, 0.07);
    this.bezel.strokeRoundedRect(-PANEL_W / 2 + 5, -PANEL_H / 2 + 5, PANEL_W - 10, PANEL_H - 10, 9);

    this.screenBgs.forEach((bg, i) => {
      const cx = i === 0 ? -D_CX : D_CX;
      bg.clear();
      bg.fillStyle(screenFill, 1);
      bg.fillRoundedRect(cx - DIGIT_W / 2 - 16, DIGIT_TOP_Y - 8, DIGIT_W + 32, DIGIT_H + 24, 6);
      bg.lineStyle(1, screenBorder, 1);
      bg.strokeRoundedRect(cx - DIGIT_W / 2 - 16, DIGIT_TOP_Y - 8, DIGIT_W + 32, DIGIT_H + 24, 6);
    });

    this.headerTxt.setColor(accentDim);

    // Reset digit dim colour so unlit segments match the theme
    const dimColor = isCorruption ? COLOR_CORRUPT_DIM : COLOR_DIM;
    this.drawDigit(this.digit1Gfx, this.glow1, '-', dimColor, -D_CX);
    this.drawDigit(this.digit2Gfx, this.glow2, '-', dimColor,  D_CX);
  }

  // ── Fade panel in showing standby "- -" state ─────────────────────────────
  showStandby(playerName: string) {
    const isCorruption = useGameStore.getState().globalCorruptionMode;
    this.applyTheme(isCorruption);
    this.standbyTween?.stop();
    this.totalTxt.setText('').setColor('#334455');
    this.name1Txt.setText('').setAlpha(0);
    this.name2Txt.setText('').setAlpha(0);
    this.toastTxt.setText('').setAlpha(0);
    this.toastBg.clear().setAlpha(0);
    this.operatorTxt.setText('+').setColor('#334455');
    const scanColor = isCorruption ? '#ff113355' : '#00ffcc55';
    this.statusTxt.setText(`SCANNING · ${playerName.toUpperCase()}`).setColor(scanColor);

    this.unfoldOpen();

    // Slow pulse on both digit graphics to indicate "waiting" (skipped when reduced)
    if (!useGameStore.getState().reducedMotion) {
      this.standbyTween = this.scene.tweens.add({
        targets: [this.digit1Gfx, this.digit2Gfx],
        alpha: { from: 0.3, to: 0.9 },
        duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  // ── Run slot-machine animation then call onComplete ────────────────────────
  // warMode: true when showing a WAR conflict roll — omits the summed total and
  // uses "vs" between the dice instead of "+" since r1/r2 belong to different players.
  roll(r1: number, r2: number, playerName: string, creditDelta: number, isCorruption: boolean, onComplete: () => void, customToast?: string, warMode?: boolean, p2Name?: string, actorBonus?: number, targetBonus?: number, daemonCount?: number) {
    // WAR rolls skip showStandby so the panel may be hidden; check before forcing visible.
    const needsOpen = !this.visible;
    // Kill any in-progress tweens on this container.
    this.scene.tweens.killTweensOf(this);
    this.setVisible(true);
    this.setAlpha(1);
    this.standbyTween?.stop();
    this.digit1Gfx.setAlpha(1);
    this.digit2Gfx.setAlpha(1);

    const total    = r1 + r2;
    // Apply theme before anything else so bezel/screens match
    this.applyTheme(isCorruption);
    // War rolls use orange; corruption uses red; stability rolls use green/amber.
    const finalColor  = warMode ? COLOR_ORANGE : (isCorruption ? COLOR_CORRUPT      : (total <= 3 ? COLOR_AMBER : COLOR_GREEN));
    const finalHex    = warMode ? '#ff8800'    : (isCorruption ? '#ff1133'           : (total <= 3 ? '#ffaa00'   : '#00ff55'));
    const spinColor   = warMode ? COLOR_ORANGE : (isCorruption ? COLOR_CORRUPT       : COLOR_GREEN);
    const statusLabel = warMode
      ? '◆  CONFLICT RESOLVED'
      : (isCorruption
          ? (total <= 3  ? '◆  CORRUPTION MAX'    :
             total <= 5  ? '◆  SEVERE CORRUPTION' :
             total <= 8  ? '◆  CORRUPTION ACTIVE' :
             total <= 11 ? '◆  MILD CORRUPTION'   : '◆  CORRUPTION MINIMAL')
          : (total <= 3  ? '◆  NO GAIN'         :
             total <= 5  ? '◆  LOW SEQUENCE'    :
             total <= 8  ? '◆  STABLE SEQUENCE' :
             total <= 11 ? '◆  STABILITY BONUS' : '◆  PEAK STABILITY'));

    const genColor = warMode ? '#ff880066' : (isCorruption ? '#ff113366' : '#00ffcc66');
    this.statusTxt.setText(warMode ? 'CONFLICT PROTOCOL · EXECUTING' : `GENERATING · ${playerName.toUpperCase()}`).setColor(genColor);
    this.totalTxt.setText('').setColor('#334455');
    this.toastTxt.setText('').setAlpha(0);
    this.toastBg.setAlpha(0);
    this.daemonBonusTxt.setText('').setAlpha(0);
    // War mode uses "vs" between the two dice; normal rolls use "+"
    this.operatorTxt.setText(warMode ? 'vs' : '+').setColor('#334455');

    // ── War player name labels (with optional tactical bonus suffix) ──────
    const trim = (s: string) => s.length > 9 ? s.slice(0, 8) + '…' : s;
    const bonusSuffix = (b: number | undefined) => b && b !== 0 ? ` ${b > 0 ? '+' : ''}${b}` : '';
    if (warMode && p2Name) {
      this.name1Txt.setText(trim(playerName.toUpperCase()) + bonusSuffix(actorBonus)).setAlpha(0.75);
      this.name2Txt.setText(trim(p2Name.toUpperCase()) + bonusSuffix(targetBonus)).setAlpha(0.75);
    } else {
      this.name1Txt.setText('').setAlpha(0);
      this.name2Txt.setText('').setAlpha(0);
    }

    if (needsOpen) {
      // WAR roll — panel was hidden, play the unfold before the dice start
      this.unfoldOpen(true);
    }
    // Normal roll — panel already fully open from standby; scale/alpha reset above.

    const TOTAL_TICKS = 26;
    let   tick        = 0;
    let   d1Locked    = false;

    const doTick = () => {
      tick++;
      sfxDiceTick();
      const progress = tick / TOTAL_TICKS;
      const delay    = 35 + progress * progress * 280;

      // Digit 1 locks 5 ticks before digit 2 (builds suspense)
      if (!d1Locked && tick >= TOTAL_TICKS - 5) {
        d1Locked = true;
        this.drawDigit(this.digit1Gfx, this.glow1, r1, finalColor, -D_CX);
        this.operatorTxt.setColor(finalHex + 'aa');
      } else if (!d1Locked) {
        const shown = ((tick - 1) % 6) + 1;
        this.drawDigit(this.digit1Gfx, this.glow1, shown, spinColor, -D_CX);
      }

      if (tick < TOTAL_TICKS) {
        const shown2 = (tick % 6) + 1;
        this.drawDigit(this.digit2Gfx, this.glow2, shown2, spinColor, D_CX);
        this.scene.time.delayedCall(delay, doTick);
      } else {
        // ── Land digit 2 ──────────────────────────────────────────────────
        this.drawDigit(this.digit2Gfx, this.glow2, r2, finalColor, D_CX);
        this.operatorTxt.setColor(finalHex);

        // Show total after a short beat (skipped in war mode — no meaningful sum)
        this.scene.time.delayedCall(180, () => {
          if (!warMode) this.totalTxt.setText(`= ${total}`).setColor(finalHex);
          this.statusTxt.setText(statusLabel).setColor(finalHex);

          // ── Credit toast ───────────────────────────────────────────────
          const toastY = (this as any)._toastY as number;
          const toastW = (this as any)._toastW as number;
          const toastH = (this as any)._toastH as number;

          let toastLabel: string;
          let toastHex: string;
          let toastBgColor: number;

          if (customToast) {
            toastLabel   = customToast;
            toastHex     = warMode ? '#ff8800' : '#00ccff';
            toastBgColor = warMode ? 0x1a0800  : 0x00080f;
          } else if (creditDelta === 0) {
            toastLabel  = '◆  NO CYCLES';
            toastHex    = '#446655';
            toastBgColor = 0x111a15;
          } else if (isCorruption) {
            toastLabel  = `▼  ${creditDelta} CYCLES LOST`;
            toastHex    = '#ff3355';
            toastBgColor = 0x1a0508;
          } else {
            toastLabel  = `▲  ${creditDelta} CYCLES GAINED`;
            toastHex    = '#00ff55';
            toastBgColor = 0x0a1a10;
          }

          this.toastBg.clear();
          this.toastBg.fillStyle(toastBgColor, 1);
          this.toastBg.fillRoundedRect(-toastW / 2, toastY - toastH / 2, toastW, toastH, 4);
          this.toastBg.lineStyle(1, creditDelta === 0 ? 0x223322 : (isCorruption ? 0xff3355 : 0x00ff55), 0.5);
          this.toastBg.strokeRoundedRect(-toastW / 2, toastY - toastH / 2, toastW, toastH, 4);

          this.toastTxt.setText(toastLabel).setColor(toastHex);

          const showDaemonBonus = !warMode && !!daemonCount && daemonCount > 0;
          if (showDaemonBonus) {
            const label = isCorruption
              ? `◈ ${daemonCount} DAEMON ABSORBED`
              : `◈ +${daemonCount} DAEMON BOOST`;
            this.daemonBonusTxt.setText(label);
          }

          // Flash both digits 4× and play the toast sound
          sfxToast();
          this.scene.tweens.add({
            targets: [this.digit1Gfx, this.digit2Gfx],
            alpha: { from: 1, to: 0.1 },
            duration: 65, yoyo: true, repeat: 3,
            onComplete: () => {
              // Fade in the toast (and daemon bonus if active)
              const fadeTargets: Phaser.GameObjects.GameObject[] = [this.toastBg, this.toastTxt];
              if (showDaemonBonus) fadeTargets.push(this.daemonBonusTxt);
              this.scene.tweens.add({
                targets: fadeTargets,
                alpha: 1, duration: 200, ease: 'Quad.easeOut',
              });
              // Hold result, fold closed
              this.scene.time.delayedCall(1600, () => { this.foldClose(onComplete); });
            },
          });
        });
      }
    };

    // Give WAR rolls time for the unfold animation before the dice start ticking
    this.scene.time.delayedCall(needsOpen ? 360 : 120, doTick);
  }
}
