// src/game/objects/DeckPile.ts
import Phaser from 'phaser';

export class DeckPile extends Phaser.GameObjects.Container {
  private bg!: Phaser.GameObjects.Rectangle;
  private countText!: Phaser.GameObjects.Text;
  private label!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, count: number, labelText = 'DRAW') {
    super(scene, x, y);
    this.build(count, labelText);
    scene.add.existing(this);
  }

  private build(count: number, labelText: string) {
    this.bg = this.scene.add.rectangle(0, 0, 80, 112, 0x0d0d1a)
      .setStrokeStyle(1, 0x334455);

    this.label = this.scene.add.text(0, -20, labelText, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#334455',
      letterSpacing: 3,
    }).setOrigin(0.5);

    this.countText = this.scene.add.text(0, 10, `${count}`, {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#00ffcc',
    }).setOrigin(0.5);

    this.add([this.bg, this.label, this.countText]);
  }

  setCount(count: number) {
    this.countText.setText(`${count}`);
  }
}
