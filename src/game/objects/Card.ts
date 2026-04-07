// src/game/objects/Card.ts
import Phaser from 'phaser';
import type { Card as CardData } from '../../types/cards';

export class Card extends Phaser.GameObjects.Container {
  private cardData: CardData;
  private face!: Phaser.GameObjects.Rectangle;
  private label!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, data: CardData) {
    super(scene, x, y);
    this.cardData = data;
    this.build();
    scene.add.existing(this);
  }

  private build() {
    // Placeholder card face — will be replaced with sprite art
    this.face = this.scene.add.rectangle(0, 0, 80, 112, 0x111122)
      .setStrokeStyle(1, 0x00ffcc);

    this.label = this.scene.add.text(0, 0, this.cardData.name, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#00ffcc',
      wordWrap: { width: 70 },
      align: 'center',
    }).setOrigin(0.5);

    this.add([this.face, this.label]);
    this.setSize(80, 112);
    this.setInteractive();
  }

  flipIn(onComplete?: () => void) {
    this.scene.tweens.add({
      targets: this,
      scaleX: { from: 0, to: 1 },
      duration: 200,
      ease: 'Back.easeOut',
      onComplete,
    });
  }
}
