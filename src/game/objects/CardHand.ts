// src/game/objects/CardHand.ts
// Manages a fan/arc layout of cards in a player's hand

import Phaser from 'phaser';
import { Card } from './Card';
import type { Card as CardData } from '../../types/cards';

export class CardHand extends Phaser.GameObjects.Container {
  private cards: Card[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    scene.add.existing(this);
  }

  setCards(dataList: CardData[]) {
    // Remove existing cards
    this.cards.forEach(c => c.destroy());
    this.cards = [];

    const count = dataList.length;
    const spread = Math.min(count * 60, 400);
    const startX = -spread / 2;

    dataList.forEach((data, i) => {
      const x = count > 1 ? startX + (spread / (count - 1)) * i : 0;
      const fanAngle = count > 1 ? ((i / (count - 1)) - 0.5) * 20 : 0;

      const card = new Card(this.scene, x, 0, data);
      card.setAngle(fanAngle);
      this.cards.push(card);
      this.add(card);

      card.on('pointerover', () => {
        this.scene.tweens.add({ targets: card, y: -20, duration: 150, ease: 'Quad.easeOut' });
      });
      card.on('pointerout', () => {
        this.scene.tweens.add({ targets: card, y: 0, duration: 150, ease: 'Quad.easeOut' });
      });
    });
  }
}
