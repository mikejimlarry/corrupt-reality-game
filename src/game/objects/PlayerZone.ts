// src/game/objects/PlayerZone.ts
import Phaser from 'phaser';
import type { PlayerState } from '../../types/gameState';

export class PlayerZone extends Phaser.GameObjects.Container {
  private bg!: Phaser.GameObjects.Rectangle;
  private nameText!: Phaser.GameObjects.Text;
  private popText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, player: PlayerState) {
    super(scene, x, y);
    this.build(player);
    scene.add.existing(this);
  }

  private build(player: PlayerState) {
    this.bg = this.scene.add.rectangle(0, 0, 160, 80, 0x0d0d1a)
      .setStrokeStyle(1, player.isHuman ? 0x00ffcc : 0xff3366);

    this.nameText = this.scene.add.text(0, -20, player.name.toUpperCase(), {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: player.isHuman ? '#00ffcc' : '#ff3366',
      letterSpacing: 2,
    }).setOrigin(0.5);

    this.popText = this.scene.add.text(0, 10, `POP: ${player.population}`, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.add([this.bg, this.nameText, this.popText]);
  }

  update(player: PlayerState) {
    this.popText.setText(`POP: ${player.population}`);
  }
}
