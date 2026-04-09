// src/game/scenes/GameScene.ts
import Phaser from 'phaser';
import { Card, CARD_W, CARD_H } from '../objects/Card';
import { CardBack } from '../objects/CardBack';
import { PlayerZone } from '../objects/PlayerZone';
import { CentreZone, DISCARD_LOCAL_CX, DISCARD_LOCAL_CY } from '../objects/CentreZone';
import { LEDDisplay } from '../objects/LEDDisplay';
import { DaemonBoard } from '../objects/DaemonBoard';
import { useGameStore } from '../../state/useGameStore';
import type { Card as CardData } from '../../types/cards';
import type { PlayerState } from '../../types/gameState';


export class GameScene extends Phaser.Scene {
  private unsubscribeStore?: () => void;
  private humanCardObjects: Card[] = [];
  private playerZoneMap = new Map<string, PlayerZone>();
  private centreZone?: CentreZone;
  private ledDisplay?: LEDDisplay;
  private humanDaemonBoard?: DaemonBoard;
  private aiDaemonBoards = new Map<string, DaemonBoard>();
  private aiCardBackObjects = new Map<string, CardBack[]>();

  constructor() {
    super({ key: 'GameScene' });
  }

  /** Full scene wipe + rebuild. Always call this instead of removeAll+buildTable directly. */
  private rebuildScene(width: number, height: number) {
    this.humanCardObjects = [];
    this.playerZoneMap.clear();
    this.humanDaemonBoard = undefined;
    this.aiDaemonBoards.clear();
    this.aiCardBackObjects.clear();
    this.children.removeAll(true);  // destroys everything including old ledDisplay
    this.buildTable(width, height);
    // Recreate LED display on top of the fresh scene
    this.ledDisplay = new LEDDisplay(this, width / 2, height / 2);
  }

  create() {
    const { width, height } = this.scale;
    this.rebuildScene(width, height);

    // Rebuild on window resize — but ignore the spurious resize Phaser fires
    // immediately after scene creation (which would double-animate the deal).
    let resizeReady = false;
    this.time.delayedCall(300, () => { resizeReady = true; });
    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      if (!resizeReady) return;
      this.rebuildScene(size.width, size.height);
    });

    // Subscribe to store changes
    let prevPlayers = useGameStore.getState().players;
    let prevSelectedCardId = useGameStore.getState().selectedCardId;
    let prevPhase = useGameStore.getState().phase;
    let prevHandStr = '';
    let prevPopImpStr = '';
    let prevDeckLen = useGameStore.getState().deck.length;
    let prevDiscardLen = useGameStore.getState().discard.length;
    let prevTurnNumber = useGameStore.getState().turnNumber ?? 1;
    let prevRollTriggered = false;
    let prevCurrentPlayerIndex = useGameStore.getState().currentPlayerIndex;
    let prevCorruption = useGameStore.getState().globalCorruptionMode;

    this.unsubscribeStore = useGameStore.subscribe(state => {
      const { players, selectedCardId } = state;

      // ── Corruption mode — shift background from near-black to dark red ──
      if (state.globalCorruptionMode !== prevCorruption) {
        prevCorruption = state.globalCorruptionMode;
        const targetColor = state.globalCorruptionMode ? 0x0d0003 : 0x050510;
        this.cameras.main.setBackgroundColor(targetColor);
      }
      const { width: w, height: h } = this.scale;
      let handUpdated = false;
      let rebuilt = false;

      // ── Player / table changes ──────────────────────────────────────────
      if (players !== prevPlayers) {
        const countChanged = players.length !== prevPlayers.length;
        prevPlayers = players;

        if (countChanged) {
          // Full scene rebuild — reset all incremental tracking
          prevSelectedCardId = selectedCardId;
          prevHandStr = '';
          prevPopImpStr = '';
          this.rebuildScene(w, h);
          rebuilt = true;
          handUpdated = true;
        } else {
          // Incremental updates — hand and pop/daemon only
          const human = players.find(p => p.isHuman);
          const newHandStr = human ? human.hand.map(c => c.id).join(',') : '';
          if (newHandStr !== prevHandStr) {
            prevHandStr = newHandStr;
            if (human) {
              this.updateHumanHand(human.hand, w, h);
              handUpdated = true;
            }
          }

          const newPopImpStr = players.map(p => `${p.id}:${p.credits}:${p.daemons.join('|')}`).join(';');
          if (newPopImpStr !== prevPopImpStr) {
            prevPopImpStr = newPopImpStr;
            players.forEach(player => {
              const zone = this.playerZoneMap.get(player.id);
              if (zone) zone.refresh(player);
              // Refresh AI daemon boards (human board is refreshed via playOut callback)
              if (!player.isHuman) {
                this.aiDaemonBoards.get(player.id)?.refresh(player.daemons);
              }
            });
          }
        }
      }

      // ── Selected card ───────────────────────────────────────────────────
      // Skip when the hand was just updated — updateHumanHand clears selection
      // state on remaining cards without killing their reposition tweens.
      if (!rebuilt && !handUpdated && selectedCardId !== prevSelectedCardId) {
        prevSelectedCardId = selectedCardId;
        this.humanCardObjects.forEach(card => {
          card.setSelected(card.cardData.id === selectedCardId);
        });
      }
      if (handUpdated) prevSelectedCardId = selectedCardId;

      // ── Active player changed — dim inactive players ────────────────────
      if (state.currentPlayerIndex !== prevCurrentPlayerIndex || rebuilt) {
        prevCurrentPlayerIndex = state.currentPlayerIndex;
        this.applyPlayerDim(state.players, state.currentPlayerIndex);
      }

      // ── Phase change ────────────────────────────────────────────────────
      if (state.phase !== prevPhase) {
        prevPhase = state.phase;
        this.centreZone?.setPhase(state.phase);
        if (!handUpdated) {
          this.applyHandDim();
        }

        // ── Targeting — highlight valid target zones and make them clickable ──
        if (state.phase === 'TARGETING') {
          this.playerZoneMap.forEach((zone, playerId) => {
            const isValid = state.validTargetIds.includes(playerId);
            zone.setTargetable(isValid, isValid
              ? () => useGameStore.getState().selectTarget(playerId)
              : undefined
            );
          });
        } else {
          // Clear all target highlights when leaving TARGETING
          this.playerZoneMap.forEach(zone => {
            zone.setTargetable(false);
            this.input.setDefaultCursor('default');
          });
        }
        // Show LED standby after table/AI-hand animations settle (~650ms)
        if (state.phase === 'PHASE_ROLL') {
          const currentPlayer = state.players[state.currentPlayerIndex];
          if (currentPlayer) {
            this.time.delayedCall(650, () => {
              // Only show if still in PHASE_ROLL (not already rolled)
              if (useGameStore.getState().phase === 'PHASE_ROLL') {
                this.ledDisplay?.showStandby(currentPlayer.name);
              }
            });
          }
        }
      }

      // ── LED roll — fires when player (or AI) triggers the roll ──────────
      if (state.rollTriggered && !prevRollTriggered) {
        prevRollTriggered = true;
        const currentPlayer = state.players[state.currentPlayerIndex];
        if (state.rollResult !== null && currentPlayer) {
          this.ledDisplay?.roll(
            state.rollResult[0], state.rollResult[1], currentPlayer.name,
            () => { useGameStore.getState().rollComplete(); },
          );
        }
      }
      if (!state.rollTriggered) prevRollTriggered = false;

      // Update centre zone pile counts and turn number
      if (state.deck.length !== prevDeckLen) {
        prevDeckLen = state.deck.length;
        this.centreZone?.setDrawCount(state.deck.length);
      }
      if (state.discard.length !== prevDiscardLen) {
        prevDiscardLen = state.discard.length;
        this.centreZone?.setDiscardCount(state.discard.length);

        // When an AI plays a card, animate their card back flying to the discard pile
        const actor = state.players[state.currentPlayerIndex];
        if (!actor?.isHuman && state.discard.length > 0) {
          const topCard = state.discard[state.discard.length - 1];
          this.animateAiCardPlay(actor.id, topCard, w, h);
        }
      }
      const turnNumber = state.turnNumber ?? 1;
      if (turnNumber !== prevTurnNumber) {
        prevTurnNumber = turnNumber;
        this.centreZone?.setTurn(turnNumber);
      }
    });

    this.events.on('destroy', () => this.unsubscribeStore?.());
  }

  /** Return live store players when a game is active. */
  private getPlayers(): PlayerState[] {
    const { phase, players } = useGameStore.getState();
    if (phase !== 'SETUP' && players.length > 0) return players;
    return [];
  }

  private buildTable(width: number, height: number) {
    // ── 1. Background — always visible, even on the setup screen ──────────
    this.drawBackground(width, height);

    // Nothing else is rendered until the game starts
    const { phase } = useGameStore.getState();
    if (phase === 'SETUP') return;

    const players   = this.getPlayers();
    const aiPlayers = players.filter(p => !p.isHuman);
    const human     = players.find(p => p.isHuman);
    if (!human) return; // guard: shouldn't happen in active game

    // ── 2. AI player zones (top / left / right) ────────────────────────────
    this.placeAIZones(aiPlayers, width, height);

    // ── 3. AI hands ────────────────────────────────────────────────────────
    this.dealAIHands(aiPlayers, width, height);

    // ── 4. Centre zone ─────────────────────────────────────────────────────
    const centre = new CentreZone(this, width / 2, height * 0.46);
    centre.setDepth(1);
    this.centreZone = centre;

    // Sync initial pile counts from store
    const initState = useGameStore.getState();
    centre.setDrawCount(initState.deck.length);
    centre.setDiscardCount(initState.discard.length);
    centre.setPhase(initState.phase);
    centre.setTurn(initState.turnNumber ?? 1);

    // ── 5. Human player zone (bottom) — larger than AI zones ──────────────
    const { hidePpCounts } = useGameStore.getState();
    const humanZone = new PlayerZone(this, width / 2, height - 58, human, hidePpCounts);
    humanZone.setScale(1.3);
    humanZone.setDepth(25);
    this.playerZoneMap.set(human.id, humanZone);

    // ── 6. Improvement boards — one per player ─────────────────────────────
    const midY = height * 0.46;
    // Human: just above the player zone, below the hand
    this.humanDaemonBoard = new DaemonBoard(this, width / 2, height - 58 - 118);

    // AI boards keyed by player id
    if (aiPlayers[0]) {
      const b = new DaemonBoard(this, width / 2, height * 0.30);
      this.aiDaemonBoards.set(aiPlayers[0].id, b);
    }
    if (aiPlayers[1]) {
      const b = new DaemonBoard(this, 250, midY);
      this.aiDaemonBoards.set(aiPlayers[1].id, b);
    }
    if (aiPlayers[2]) {
      const b = new DaemonBoard(this, width - 250, midY);
      this.aiDaemonBoards.set(aiPlayers[2].id, b);
    }

    // Populate with any existing daemons (mid-game rebuild)
    players.forEach(p => {
      if (p.isHuman) {
        this.humanDaemonBoard?.refresh(p.daemons);
      } else {
        this.aiDaemonBoards.get(p.id)?.refresh(p.daemons);
      }
    });

    // ── 7. Human hand (fan) ────────────────────────────────────────────────
    this.updateHumanHand(human.hand, width, height);

    // ── 8. Table dividers ──────────────────────────────────────────────────
    this.drawDividers(aiPlayers.length, width, height);
  }

  // ── Player dim — fades inactive player zones and card backs ─────────────
  private applyPlayerDim(players: PlayerState[], activeIndex: number) {
    const DIM   = 0.25;
    const FULL  = 1;
    const DURATION = 350;

    players.forEach((player, i) => {
      const isActive = i === activeIndex;
      const target   = isActive ? FULL : DIM;

      // Player info zone
      const zone = this.playerZoneMap.get(player.id);
      if (zone) {
        this.tweens.add({ targets: zone, alpha: target, duration: DURATION, ease: 'Sine.easeInOut' });
      }

      // AI card backs
      if (!player.isHuman) {
        const backs = this.aiCardBackObjects.get(player.id) ?? [];
        backs.forEach(back => {
          this.tweens.add({ targets: back, alpha: target, duration: DURATION, ease: 'Sine.easeInOut' });
        });
      }
    });
  }

  // ── Hand dim helper — reads current store state and tweens alpha ──────────
  private applyHandDim() {
    const { phase, players, currentPlayerIndex } = useGameStore.getState();
    const isHuman = players[currentPlayerIndex]?.isHuman;
    // Dim during PHASE_ROLL and DRAW — cards are non-interactive until MAIN
    const shouldDim = isHuman && (phase === 'PHASE_ROLL' || phase === 'DRAW');
    const targetAlpha = shouldDim ? 0.3 : 1;
    this.humanCardObjects.forEach(card => {
      // Only add an alpha tween; don't kill other tweens (e.g. hover y/scale)
      this.tweens.add({
        targets: card, alpha: targetAlpha,
        duration: 250, ease: 'Sine.easeInOut',
      });
    });
  }

  // ── Human hand (fan layout) — larger cards, clearly visible ──────────────
  private updateHumanHand(hand: CardData[], width: number, height: number) {
    if (hand.length === 0) {
      this.humanCardObjects.forEach(c => c.destroy());
      this.humanCardObjects = [];
      return;
    }

    // Determine target alpha based on current phase
    const { phase, players, currentPlayerIndex } = useGameStore.getState();
    const isHuman  = players[currentPlayerIndex]?.isHuman;
    const shouldDim = isHuman && (phase === 'PHASE_ROLL' || phase === 'DRAW');
    const targetAlpha = shouldDim ? 0.3 : 1;

    // Fan layout constants
    const SCALE    = 1.25;
    const OVERLAP  = CARD_W * SCALE * 0.62;
    const FAN_DEG  = 32;
    const ARC_DROP = 28;
    const count    = hand.length;
    const totalW   = (count - 1) * OVERLAP;
    const startX   = width / 2 - totalW / 2;
    const zoneTop  = height - 58 - 70;
    const baseY    = zoneTop - 10 - (CARD_H * SCALE) / 2;

    // Determine whether this is a full deal (game start) or a partial draw.
    // Full deal: none of the incoming cards match an existing card object.
    const existingIds = new Set(this.humanCardObjects.map(c => c.cardData.id));
    const incomingIds = new Set(hand.map(c => c.id));
    const isFullDeal  = !hand.some(c => existingIds.has(c.id));

    // Animate out cards that are no longer in the hand (played / discarded)
    const zoneX        = width / 2;
    const zoneY        = height * 0.46;
    const discardWorldX = zoneX + DISCARD_LOCAL_CX;
    const discardWorldY = zoneY + DISCARD_LOCAL_CY;

    this.humanCardObjects = this.humanCardObjects.filter(obj => {
      if (!incomingIds.has(obj.cardData.id)) {
        const cardData = obj.cardData;

        if (cardData.category === 'DAEMON') {
          // Fly to the daemon board slot rather than the discard pile
          const slot = this.humanDaemonBoard?.getNextSlotWorld()
            ?? { x: discardWorldX, y: discardWorldY };
          obj.playOut(slot.x, slot.y, () => {
            obj.destroy();
            // Refresh board now the card has arrived
            const imps = useGameStore.getState().players.find(p => p.isHuman)?.daemons ?? [];
            this.humanDaemonBoard?.refresh(imps);
          });
        } else {
          obj.playOut(discardWorldX, discardWorldY, () => {
            obj.destroy();
            this.centreZone?.setDiscardTop(cardData);
          });
        }
        return false;
      }
      return true;
    });

    // Build the new ordered array and animate each card into place
    let newCardDealIndex = 0;
    const nextCardObjects: Card[] = [];

    hand.forEach((cardData, i) => {
      const t       = count > 1 ? i / (count - 1) : 0.5;
      const c       = t - 0.5;
      const targetX = startX + OVERLAP * i;
      const targetY = baseY + c * c * ARC_DROP * 4;
      const targetAngle = c * FAN_DEG;
      const targetDepth = 10 + i;

      const existing = this.humanCardObjects.find(obj => obj.cardData.id === cardData.id);

      if (existing) {
        // Existing card — clear any selection state then tween to new fan position.
        // clearSelectionState() intentionally does NOT kill tweens so the reposition
        // tween below is not cancelled by a simultaneous selectedCardId → null change.
        existing.clearSelectionState();
        existing.updateRestY(targetY);
        existing.setDepth(targetDepth);
        this.tweens.killTweensOf(existing);
        this.tweens.add({
          targets: existing,
          x: targetX, y: targetY,
          angle: targetAngle,
          alpha: targetAlpha,
          duration: 350, ease: 'Quad.easeOut',
        });
        nextCardObjects.push(existing);
      } else {
        // New card — create and deal in
        const card = new Card(this, targetX, targetY, cardData);
        card.setScale(SCALE);
        card.setAngle(targetAngle);
        card.setDepth(targetDepth);
        // Stagger only on a full initial deal; single drawn cards arrive immediately
        const delay = isFullDeal ? newCardDealIndex * 70 : 0;
        card.dealIn(width / 2, height * 0.46, delay, targetAlpha);
        newCardDealIndex++;
        nextCardObjects.push(card);
      }
    });

    this.humanCardObjects = nextCardObjects;
  }

  // ── Background + grid ─────────────────────────────────────────────────────
  private drawBackground(width: number, height: number) {
    const grid = this.add.graphics().setDepth(-2);
    grid.lineStyle(1, 0x00ffcc, 0.04);
    for (let x = 0; x < width; x += 60) { grid.moveTo(x, 0); grid.lineTo(x, height); }
    for (let y = 0; y < height; y += 60) { grid.moveTo(0, y); grid.lineTo(width, y); }
    grid.strokePath();

    const table = this.add.graphics().setDepth(-1);
    const tPad = 24;
    table.fillStyle(0x0d0d1a, 0.6);
    table.fillRoundedRect(tPad, height * 0.06, width - tPad * 2, height * 0.88, 12);
    table.lineStyle(1, 0x00ffcc, 0.08);
    table.strokeRoundedRect(tPad, height * 0.06, width - tPad * 2, height * 0.88, 12);

    const glowTL = this.add.circle(0, 0, 180, 0x00ffcc, 0.025).setDepth(-1);
    const glowBR = this.add.circle(width, height, 180, 0x00ffcc, 0.025).setDepth(-1);
    this.tweens.add({ targets: [glowTL, glowBR], alpha: { from: 0.025, to: 0.055 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ── AI player zones: up to 3 seats (top / left / right) ──────────────────
  private placeAIZones(players: PlayerState[], width: number, height: number) {
    const midY = height * 0.46;
    const [p1, p2, p3] = players;

    const { hidePpCounts: hidePop } = useGameStore.getState();

    // Top: zone sits below the card peek strip
    if (p1) {
      const zone = new PlayerZone(this, width / 2, height * 0.18, p1, hidePop);
      zone.setDepth(25);
      this.playerZoneMap.set(p1.id, zone);
    }

    // Left: zone nudged away from edge so it's fully visible
    if (p2) {
      const zone = new PlayerZone(this, 130, midY, p2, hidePop);
      zone.setAngle(-90);
      zone.setDepth(25);
      this.playerZoneMap.set(p2.id, zone);
    }

    // Right: mirror of left
    if (p3) {
      const zone = new PlayerZone(this, width - 130, midY, p3, hidePop);
      zone.setAngle(90);
      zone.setDepth(25);
      this.playerZoneMap.set(p3.id, zone);
    }
  }

  // ── AI hands ──────────────────────────────────────────────────────────────
  private dealAIHands(players: PlayerState[], width: number, height: number) {
    const midY = height * 0.46;
    const [p1, p2, p3] = players;

    // Compute initial dim alpha for each AI player based on who is currently active.
    // If it's the human's turn all AI backs deal in dim; otherwise only the active
    // AI arrives at full alpha and the rest are dim.
    const { currentPlayerIndex, players: allPlayers } = useGameStore.getState();
    const DIM = 0.25;
    const aiDealAlpha = (aiPlayer: PlayerState): number => {
      const idx = allPlayers.findIndex(p => p.id === aiPlayer.id);
      return idx === currentPlayerIndex ? 1 : DIM;
    };

    // Player 2 (top) — card backs peek from top edge, flat row with fan rotation
    if (p1) {
      const cardCount = p1.hand.length || 5;
      const OVERLAP = CARD_W * 0.55, FAN_DEG = 18;
      const totalW  = (cardCount - 1) * OVERLAP;
      const startX  = width / 2 - totalW / 2;
      const baseY   = -(CARD_H / 2 - 44);
      const p1Backs: CardBack[] = [];
      const p1Alpha = aiDealAlpha(p1);

      for (let i = 0; i < cardCount; i++) {
        const t = cardCount > 1 ? i / (cardCount - 1) : 0.5;
        const c = t - 0.5;
        const back = new CardBack(this, startX + OVERLAP * i, baseY);
        back.setAngle(c * FAN_DEG + 180);
        back.setDepth(5 + i);
        back.dealIn(width / 2, height * 0.46, i * 55, p1Alpha);
        p1Backs.push(back);
      }
      this.aiCardBackObjects.set(p1.id, p1Backs);
    }

    // Player 3 (left) — card backs peek from left edge
    if (p2) {
      const cardCount = p2.hand.length || 5;
      const OVERLAP = CARD_W * 0.55, FAN_DEG = 20, ARC_DROP = 16;
      const totalH  = (cardCount - 1) * OVERLAP;
      const startY  = midY - totalH / 2;
      const baseX   = -(CARD_H / 2 - 40);
      const p2Backs: CardBack[] = [];
      const p2Alpha = aiDealAlpha(p2);

      for (let i = 0; i < cardCount; i++) {
        const t = cardCount > 1 ? i / (cardCount - 1) : 0.5;
        const c = t - 0.5;
        const back = new CardBack(this, baseX + c * c * ARC_DROP * 4, startY + OVERLAP * i);
        back.setAngle(-(c * FAN_DEG) - 90);
        back.setDepth(5 + i);
        back.dealIn(width / 2, height * 0.46, 120 + i * 55, p2Alpha);
        p2Backs.push(back);
      }
      this.aiCardBackObjects.set(p2.id, p2Backs);
    }

    // Player 4 (right) — card backs peek from right edge
    if (p3) {
      const cardCount = p3.hand.length || 5;
      const OVERLAP = CARD_W * 0.55, FAN_DEG = 20, ARC_DROP = 16;
      const totalH  = (cardCount - 1) * OVERLAP;
      const startY  = midY - totalH / 2;
      const baseX   = width + CARD_H / 2 - 40;
      const p3Backs: CardBack[] = [];
      const p3Alpha = aiDealAlpha(p3);

      for (let i = 0; i < cardCount; i++) {
        const t = cardCount > 1 ? i / (cardCount - 1) : 0.5;
        const c = t - 0.5;
        const back = new CardBack(this, baseX - c * c * ARC_DROP * 4, startY + OVERLAP * i);
        back.setAngle((c * FAN_DEG) + 90);
        back.setDepth(5 + i);
        back.dealIn(width / 2, height * 0.46, 240 + i * 55, p3Alpha);
        p3Backs.push(back);
      }
      this.aiCardBackObjects.set(p3.id, p3Backs);
    }
  }

  // ── AI card play animation ────────────────────────────────────────────────
  private animateAiCardPlay(playerId: string, topCard: CardData, width: number, height: number) {
    const backs = this.aiCardBackObjects.get(playerId);
    if (!backs || backs.length === 0) {
      // No card backs left to animate — just update the discard face
      this.centreZone?.setDiscardTop(topCard);
      return;
    }

    // Take the middle-most card so it looks naturally selected from the hand
    const midIdx = Math.floor(backs.length / 2);
    const [back] = backs.splice(midIdx, 1);
    this.aiCardBackObjects.set(playerId, backs);

    const centerX = width / 2;
    const centerY = height * 0.46;

    // Step 1 — pull the card visibly out from the edge
    back.setDepth(50);
    back.liftOut(centerX, centerY, () => {
      // Step 2 — brief pause so the player can see the card being "chosen"
      this.time.delayedCall(300, () => {
        const discardWorldX = centerX + DISCARD_LOCAL_CX;
        const discardWorldY = centerY + DISCARD_LOCAL_CY;
        back.playOut(discardWorldX, discardWorldY, () => {
          back.destroy();
          this.centreZone?.setDiscardTop(topCard);
        });
      });
    });
  }

  // ── Table zone dividers — adapts to AI count ─────────────────────────────
  private drawDividers(aiCount: number, width: number, height: number) {
    const g = this.add.graphics().setDepth(0);
    g.lineStyle(1, 0x00ffcc, 0.12);

    const hasSides = aiCount >= 2;
    const leftX    = hasSides ? 210 : 40;
    const rightX   = hasSides ? width - 210 : width - 40;
    const topDivY  = height * 0.26;
    const botDivY  = height * 0.72;

    // Top horizontal
    if (aiCount >= 1) {
      g.beginPath(); g.moveTo(leftX, topDivY); g.lineTo(rightX, topDivY); g.strokePath();
    }

    // Bottom horizontal
    g.beginPath(); g.moveTo(leftX, botDivY); g.lineTo(rightX, botDivY); g.strokePath();

    // Left vertical (only when left AI seat is active)
    if (hasSides) {
      g.beginPath(); g.moveTo(leftX, topDivY); g.lineTo(leftX, botDivY); g.strokePath();
    }

    // Right vertical (only when right AI seat is active)
    if (aiCount >= 3) {
      g.beginPath(); g.moveTo(rightX, topDivY); g.lineTo(rightX, botDivY); g.strokePath();
    }

    // Dotted scan accent on top horizontal
    if (aiCount >= 1) {
      g.lineStyle(1, 0x00ffcc, 0.06);
      for (let x = leftX + 4; x < rightX; x += 12) {
        g.beginPath(); g.moveTo(x, topDivY); g.lineTo(x + 6, topDivY); g.strokePath();
      }
    }

    // Corner brackets at divider intersections
    if (hasSides) {
      const bracketSize = 10;
      g.lineStyle(1.5, 0x00ffcc, 0.35);
      const corners: [number, number, number, number][] = [
        [leftX,  topDivY,  1,  1],
        [rightX, topDivY, -1,  1],
        [leftX,  botDivY,  1, -1],
        [rightX, botDivY, -1, -1],
      ];
      corners.forEach(([cx, cy, dx, dy]) => {
        g.beginPath();
        g.moveTo(cx + dx * bracketSize, cy);
        g.lineTo(cx, cy);
        g.lineTo(cx, cy + dy * bracketSize);
        g.strokePath();
      });
    }
  }
}
