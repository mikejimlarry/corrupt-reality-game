// src/game/scenes/GameScene.ts
import Phaser from 'phaser';
import { Card, CARD_W, CARD_H } from '../objects/Card';
import { CardBack } from '../objects/CardBack';
import { PlayerZone } from '../objects/PlayerZone';
import { CentreZone, DISCARD_LOCAL_CX, DISCARD_LOCAL_CY } from '../objects/CentreZone';
import { LEDDisplay } from '../objects/LEDDisplay';
import { DaemonBoard } from '../objects/DaemonBoard';
import { useGameStore } from '../../state/useGameStore';
import { sfxCorruptionReveal } from '../../lib/audio';
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
  private overclockVisual?: Phaser.GameObjects.Container;
  // seat index: 0=top, 1=left, 2=right — set during buildTable
  private aiPlayerSeat = new Map<string, number>();

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
    this.aiPlayerSeat.clear();
    this.overclockVisual = undefined;
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
    let prevAiHandStr = '';
    let prevDeckLen = useGameStore.getState().deck.length;
    let prevDiscardLen = useGameStore.getState().discard.length;
    let prevTurnNumber = useGameStore.getState().turnNumber ?? 1;
    let prevRollTriggered = false;
    let prevCorruptionReveal = false;
    let prevCurrentPlayerIndex = useGameStore.getState().currentPlayerIndex;
    let prevCorruption = useGameStore.getState().globalCorruptionMode;
    // Track per-player credits for delta animation
    const prevCreditsMap = new Map<string, number>(
      useGameStore.getState().players.map(p => [p.id, p.credits])
    );
    let prevPendingOverclockCard: import('../../types/cards').Card | null = null;

    this.unsubscribeStore = useGameStore.subscribe(state => {
      const { players, selectedCardId } = state;
      // Snapshot human credits BEFORE the player block updates prevCreditsMap,
      // so we can detect whether this tick reduced the human's total.
      const humanSnap = players.find(p => p.isHuman);
      const humanCreditsBefore = prevCreditsMap.get(humanSnap?.id ?? '') ?? (humanSnap?.credits ?? 0);

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
              // Credit delta — trigger flash before refresh (which also flashes, but
              // we want the world-space floating number from the zone method)
              const prev = prevCreditsMap.get(player.id);
              if (prev !== undefined) prevCreditsMap.set(player.id, player.credits);
              else prevCreditsMap.set(player.id, player.credits);
              if (zone) zone.refresh(player);
              // Refresh AI daemon boards
              if (!player.isHuman) {
                this.aiDaemonBoards.get(player.id)?.refresh(player.daemons);
              }
            });
          }

          // ── Sync AI hand card-back counts when AI draws/plays ─────────────
          const newAiHandStr = players.filter(p => !p.isHuman)
            .map(p => `${p.id}:${p.hand.length}`).join(';');
          if (newAiHandStr !== prevAiHandStr) {
            prevAiHandStr = newAiHandStr;
            players.filter(p => !p.isHuman).forEach(aiPlayer => {
              this.syncAiCardBacks(aiPlayer, w, h);
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
        const leavingTargeting = prevPhase === 'TARGETING';
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
          // Shrink hand cards by 10%, anchoring to bottom-centre
          this.humanCardObjects.forEach(card => {
            const s = card.getRestScale() * 0.9;
            const dy = (card.getRestScale() - s) * (CARD_H / 2);
            this.tweens.killTweensOf(card);
            this.tweens.add({
              targets: card, scaleX: s, scaleY: s, y: card.y + dy,
              duration: 200, ease: 'Quad.easeOut',
            });
          });
        } else {
          // Clear all target highlights
          this.playerZoneMap.forEach(zone => {
            zone.setTargetable(false);
            this.input.setDefaultCursor('default');
          });
          // Only restore hand scale when actually leaving TARGETING — not on every phase change
          if (leavingTargeting && !handUpdated) {
            this.humanCardObjects.forEach(card => {
              const s = card.getRestScale();
              const dy = -(s * 0.1 * (CARD_H / 2));
              this.tweens.killTweensOf(card);
              this.tweens.add({
                targets: card, scaleX: s, scaleY: s, y: card.y + dy,
                duration: 200, ease: 'Quad.easeOut',
              });
            });
          }
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
          const [r1, r2] = state.rollResult;
          const rawTotal  = r1 + r2;
          const inCorruption = state.globalCorruptionMode;
          const daemonCount  = currentPlayer.daemons.length;
          const isOverclocked = (currentPlayer as any).overclocked ?? false;
          const afterDaemons = inCorruption
            ? Math.max(2, rawTotal - daemonCount)
            : Math.min(12, rawTotal + daemonCount);
          const overclockShift = isOverclocked ? (inCorruption ? -5 : 5) : 0;
          const effectiveTotal = inCorruption
            ? Math.max(2, afterDaemons + overclockShift)
            : Math.min(12, afterDaemons + overclockShift);
          const creditDelta =
            effectiveTotal <= 3  ? 0  :
            effectiveTotal <= 5  ? 5  :
            effectiveTotal <= 8  ? 10 :
            effectiveTotal <= 11 ? 15 : 20;
          this.ledDisplay?.roll(
            r1, r2, currentPlayer.name, creditDelta, inCorruption,
            () => { useGameStore.getState().rollComplete(); },
          );
        }
      }
      if (!state.rollTriggered) prevRollTriggered = false;

      // ── Corruption card reveal — fires when Corruption is drawn ───────────
      if (state.corruptionReveal && !prevCorruptionReveal) {
        prevCorruptionReveal = true;
        this.showCorruptionReveal(w, h);
      }
      if (!state.corruptionReveal) prevCorruptionReveal = false;

      // ── Overclock card visual ────────────────────────────────────────────────
      const pendingOC = (state as any).pendingOverclockCard ?? null;
      if (pendingOC !== prevPendingOverclockCard) {
        prevPendingOverclockCard = pendingOC;
        if (pendingOC) {
          this.time.delayedCall(340, () => this.showOverclockCard(pendingOC, w, h));
        } else {
          this.hideOverclockCard();
        }
      }

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

          // Show attack warning if the human's credits went down this tick
          const humanNow = state.players.find(p => p.isHuman);
          if (humanNow && humanNow.credits < humanCreditsBefore) {
            this.time.delayedCall(380, () => {
              this.flashIncomingAttack(actor.name, w, h);
            });
          }
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
    // Human: just above the player zone, below the hand (cyan to match human zone)
    this.humanDaemonBoard = new DaemonBoard(this, width / 2, height - 58 - 118, 0x00ffcc, '#00ffcc');

    // AI boards — red/pink to match AI zone accent
    if (aiPlayers[0]) {
      const b = new DaemonBoard(this, width / 2, height * 0.30, 0x00ffcc, '#00ffcc');
      this.aiDaemonBoards.set(aiPlayers[0].id, b);
    }
    if (aiPlayers[1]) {
      const b = new DaemonBoard(this, 250, midY, 0x00ffcc, '#00ffcc');
      this.aiDaemonBoards.set(aiPlayers[1].id, b);
    }
    if (aiPlayers[2]) {
      const b = new DaemonBoard(this, width - 250, midY, 0x00ffcc, '#00ffcc');
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

    // Restore overclock visual on rebuild (e.g. window resize)
    const pendingOC = useGameStore.getState().pendingOverclockCard;
    if (pendingOC) this.showOverclockCard(pendingOC, width, height);
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
    // Dim during AI turns and during PHASE_ROLL/DRAW on human turns
    const shouldDim = !isHuman || phase === 'PHASE_ROLL' || phase === 'DRAW';
    const targetAlpha = shouldDim ? 0.55 : 1;
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

    // Determine target alpha — dim during AI turns and PHASE_ROLL/DRAW
    const { phase, players, currentPlayerIndex } = useGameStore.getState();
    const isHuman  = players[currentPlayerIndex]?.isHuman;
    const shouldDim = !isHuman || phase === 'PHASE_ROLL' || phase === 'DRAW';
    const targetAlpha = shouldDim ? 0.55 : 1;

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
            const pendingOCId = (useGameStore.getState() as any).pendingOverclockCard?.id;
            if (pendingOCId !== cardData.id) {
              this.centreZone?.setDiscardTop(cardData);
            }
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

  // ── Corruption card reveal — shown centre-screen when drawn ──────────────
  private showCorruptionReveal(width: number, height: number) {
    sfxCorruptionReveal();
    const cx = width / 2;
    const cy = height * 0.46;
    const dpr = window.devicePixelRatio;

    const con = this.add.container(cx, cy);
    con.setDepth(300);

    const bg = this.add.graphics();
    bg.fillStyle(0x0d0003, 1);
    bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
    bg.lineStyle(2, 0xff3355, 0.9);
    bg.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
    bg.fillStyle(0xff3355, 0.35);
    bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, 20, { tl: 8, tr: 8, bl: 0, br: 0 });
    bg.fillStyle(0xff3355, 0.04);
    bg.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8);
    con.add(bg);

    con.add(this.add.text(0, -CARD_H / 2 + 11, 'HACK PROTOCOL', {
      fontFamily: 'monospace', fontSize: '8px', color: '#ff3355', resolution: dpr,
    }).setOrigin(0.5));

    con.add(this.add.text(0, -14, 'THE\nCORRUPTION', {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
      align: 'center', lineSpacing: 4, resolution: dpr,
    }).setOrigin(0.5));

    con.add(this.add.text(0, CARD_H / 2 - 52, 'CORRUPTION\nMODE BEGINS', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ff3355',
      align: 'center', lineSpacing: 3, resolution: dpr,
    }).setOrigin(0.5));

    con.add(this.add.text(0, CARD_H / 2 - 16, '"Once it spreads,\nnothing is clean."', {
      fontFamily: 'monospace', fontSize: '7px', color: '#663344',
      fontStyle: 'italic', align: 'center', lineSpacing: 2, resolution: dpr,
    }).setOrigin(0.5));

    // Scale in from zero
    con.setScale(0);
    con.setAlpha(0);
    this.tweens.add({
      targets: con, scaleX: 1, scaleY: 1, alpha: 1,
      duration: 350, ease: 'Back.easeOut',
    });

    // Hold, then fly to the discard pile and clear the flag
    const discardWorldX = cx + DISCARD_LOCAL_CX;
    const discardWorldY = cy + DISCARD_LOCAL_CY;
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: con,
        x: discardWorldX, y: discardWorldY,
        scaleX: 0.3, scaleY: 0.3, alpha: 0,
        duration: 400, ease: 'Quad.easeIn',
        onComplete: () => {
          con.destroy();
          useGameStore.getState().corruptionRevealComplete();
        },
      });
    });
  }

  // ── Overclock card visual — shown on table while Overclock is pending ────────
  private showOverclockCard(cardData: import('../../types/cards').Card, width: number, height: number) {
    if (this.overclockVisual) {
      this.tweens.killTweensOf(this.overclockVisual);
      this.overclockVisual.destroy();
      this.overclockVisual = undefined;
    }

    const cx = width * 0.70;
    const cy = height * 0.73;
    const W = 118, H = 64;

    const con = this.add.container(cx, cy);
    con.setDepth(12);
    con.setAlpha(0);

    // Dark background
    const bg = this.add.graphics();
    bg.fillStyle(0x060c18, 0.96);
    bg.fillRoundedRect(-W / 2, -H / 2, W, H, 6);
    bg.lineStyle(1.5, 0x00ccff, 0.75);
    bg.strokeRoundedRect(-W / 2, -H / 2, W, H, 6);
    con.add(bg);

    // Outer glow (animated)
    const glow = this.add.graphics();
    glow.lineStyle(3, 0x00ccff, 0.35);
    glow.strokeRoundedRect(-W / 2 - 2, -H / 2 - 2, W + 4, H + 4, 8);
    con.add(glow);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.25, to: 1 },
      duration: 900, repeat: -1, yoyo: true,
      ease: 'Sine.easeInOut',
    });

    // Title
    const dpr = window.devicePixelRatio;
    con.add(this.add.text(0, -H / 2 + 13, '⚡  OVERCLOCK', {
      fontFamily: 'monospace', fontSize: '10px', color: '#00ccff',
      fontStyle: 'bold', resolution: dpr,
    }).setOrigin(0.5));

    con.add(this.add.text(0, -H / 2 + 27, cardData.name.toUpperCase(), {
      fontFamily: 'monospace', fontSize: '8px', color: '#5588aa',
      resolution: dpr,
    }).setOrigin(0.5));

    con.add(this.add.text(0, -H / 2 + 41, 'PENDING — NEXT ROLL', {
      fontFamily: 'monospace', fontSize: '7px', color: '#334455',
      resolution: dpr,
    }).setOrigin(0.5));

    con.add(this.add.text(0, -H / 2 + 53, 'ROLL SHIFTED +5', {
      fontFamily: 'monospace', fontSize: '7px', color: '#00ccff55',
      resolution: dpr,
    }).setOrigin(0.5));

    // Entrance animation
    this.tweens.add({
      targets: con,
      alpha: 1,
      scaleX: { from: 0.55, to: 1 },
      scaleY: { from: 0.55, to: 1 },
      duration: 320,
      ease: 'Back.easeOut',
    });

    this.overclockVisual = con;
  }

  private hideOverclockCard() {
    if (!this.overclockVisual) return;
    const con = this.overclockVisual;
    this.overclockVisual = undefined;
    this.tweens.killTweensOf(con);
    con.list.forEach(child => this.tweens.killTweensOf(child));
    this.tweens.add({
      targets: con,
      alpha: 0,
      scaleX: 0.65, scaleY: 0.65,
      duration: 280, ease: 'Quad.easeIn',
      onComplete: () => con.destroy(),
    });
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
      this.aiPlayerSeat.set(p1.id, 0);
    }

    // Left: zone nudged away from edge so it's fully visible
    if (p2) {
      const zone = new PlayerZone(this, 130, midY, p2, hidePop);
      zone.setAngle(-90);
      zone.setDepth(25);
      this.playerZoneMap.set(p2.id, zone);
      this.aiPlayerSeat.set(p2.id, 1);
    }

    // Right: mirror of left
    if (p3) {
      const zone = new PlayerZone(this, width - 130, midY, p3, hidePop);
      zone.setAngle(90);
      zone.setDepth(25);
      this.playerZoneMap.set(p3.id, zone);
      this.aiPlayerSeat.set(p3.id, 2);
    }
  }

  // ── AI hands ──────────────────────────────────────────────────────────────

  /**
   * Compute the world-space position and angle for every card in an N-card fan
   * for the given seat (0 = top, 1 = left, 2 = right).
   */
  private computeAiHandLayout(
    seat: number, count: number, width: number, height: number,
  ): Array<{ x: number; y: number; angle: number }> {
    const midY    = height * 0.46;
    const OVERLAP = CARD_W * 0.55;
    const result: Array<{ x: number; y: number; angle: number }> = [];

    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      const c = t - 0.5;
      let x: number, y: number, angle: number;

      if (seat === 0) {
        // Top — horizontal fan peeking from top edge
        const FAN_DEG = 18;
        const totalW  = (count - 1) * OVERLAP;
        const startX  = width / 2 - totalW / 2;
        x     = startX + OVERLAP * i;
        y     = -(CARD_H / 2 - 44);
        angle = c * FAN_DEG + 180;
      } else if (seat === 1) {
        // Left — vertical fan with quadratic arc
        const FAN_DEG = 20, ARC_DROP = 16;
        const totalH  = (count - 1) * OVERLAP;
        const startY  = midY - totalH / 2;
        x     = -(CARD_H / 2 - 40) + c * c * ARC_DROP * 4;
        y     = startY + OVERLAP * i;
        angle = -(c * FAN_DEG) - 90;
      } else {
        // Right — vertical fan (mirrored)
        const FAN_DEG = 20, ARC_DROP = 16;
        const totalH  = (count - 1) * OVERLAP;
        const startY  = midY - totalH / 2;
        x     = width + CARD_H / 2 - 40 - c * c * ARC_DROP * 4;
        y     = startY + OVERLAP * i;
        angle = (c * FAN_DEG) + 90;
      }
      result.push({ x, y, angle });
    }
    return result;
  }

  /** Smooth-tween all backs for a player into the correct positions for their current count. */
  private repositionAiCardBacks(playerId: string, width: number, height: number) {
    const backs = this.aiCardBackObjects.get(playerId);
    if (!backs || backs.length === 0) return;
    const seat      = this.aiPlayerSeat.get(playerId) ?? 0;
    const positions = this.computeAiHandLayout(seat, backs.length, width, height);
    backs.forEach((back, i) => {
      const pos = positions[i];
      this.tweens.killTweensOf(back);
      this.tweens.add({
        targets: back,
        x: pos.x, y: pos.y, angle: pos.angle,
        duration: 220, ease: 'Quad.easeOut',
      });
      back.setDepth(5 + i);
    });
  }

  private dealAIHands(players: PlayerState[], width: number, height: number) {
    const midY = height * 0.46;
    const { currentPlayerIndex, players: allPlayers } = useGameStore.getState();
    const DIM = 0.25;
    const aiDealAlpha = (aiPlayer: PlayerState): number => {
      const idx = allPlayers.findIndex(p => p.id === aiPlayer.id);
      return idx === currentPlayerIndex ? 1 : DIM;
    };

    const staggerBase = [0, 120, 240];
    players.forEach((p, si) => {
      if (!p) return;
      const seat      = this.aiPlayerSeat.get(p.id) ?? si;
      const cardCount = p.hand.length || 5;
      const positions = this.computeAiHandLayout(seat, cardCount, width, height);
      const alpha     = aiDealAlpha(p);
      const pBacks: CardBack[] = [];

      for (let i = 0; i < cardCount; i++) {
        const pos  = positions[i];
        const back = new CardBack(this, pos.x, pos.y);
        back.setAngle(pos.angle);
        back.setDepth(5 + i);
        back.dealIn(width / 2, midY, staggerBase[si] + i * 55, alpha);
        pBacks.push(back);
      }
      this.aiCardBackObjects.set(p.id, pBacks);
    });
  }

  // ── Sync AI card backs to exactly match hand.length ───────────────────────
  private syncAiCardBacks(aiPlayer: PlayerState, width: number, height: number) {
    const backs  = this.aiCardBackObjects.get(aiPlayer.id) ?? [];
    const target = aiPlayer.hand.length;
    const seat   = this.aiPlayerSeat.get(aiPlayer.id) ?? 0;
    const midY   = height * 0.46;

    if (backs.length === target) return;

    if (backs.length > target) {
      // Remove excess backs (defensive — animateAiCardPlay handles the normal case)
      const removed = backs.splice(target);
      removed.forEach(b => {
        this.tweens.killTweensOf(b);
        this.tweens.add({
          targets: b, alpha: 0, scaleX: 0.5, scaleY: 0.5,
          duration: 180, onComplete: () => b.destroy(),
        });
      });
      // Reposition the survivors
      this.repositionAiCardBacks(aiPlayer.id, width, height);
    } else {
      // Add new backs — first slide existing ones to their new positions in the
      // larger layout, then deal in the fresh cards on top
      const existingCount = backs.length;
      const targetPositions = this.computeAiHandLayout(seat, target, width, height);

      // Reposition existing backs to their slots in the new layout
      backs.forEach((back, i) => {
        const pos = targetPositions[i];
        this.tweens.killTweensOf(back);
        this.tweens.add({
          targets: back,
          x: pos.x, y: pos.y, angle: pos.angle,
          duration: 220, ease: 'Quad.easeOut',
        });
        back.setDepth(5 + i);
      });

      // Deal in the new backs
      for (let n = existingCount; n < target; n++) {
        const pos  = targetPositions[n];
        const back = new CardBack(this, pos.x, pos.y);
        back.setAngle(pos.angle);
        back.setDepth(5 + n);
        back.dealIn(width / 2, midY, (n - existingCount) * 60, 0.25);
        backs.push(back);
      }
    }

    this.aiCardBackObjects.set(aiPlayer.id, backs);
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

    // Reposition remaining backs into the tighter N-1 fan once the card has lifted
    this.time.delayedCall(320, () => this.repositionAiCardBacks(playerId, width, height));

    const centerX = width / 2;
    const centerY = height * 0.46;

    // Step 1 — pull the card visibly out from the edge
    back.setDepth(50);
    back.liftOut(centerX, centerY, () => {
      // Step 2 — flash the card name so the player knows what was played
      this.flashAiCardBanner(topCard, centerX, centerY - 80);
      // Step 3 — brief pause then fly to destination
      this.time.delayedCall(600, () => {
        if (topCard.category === 'DAEMON') {
          // Daemon cards fly to the daemon board, not the discard pile
          const board = this.aiDaemonBoards.get(playerId);
          const destX = board ? board.x : centerX;
          const destY = board ? board.y : centerY;
          back.playOut(destX, destY, () => back.destroy());
          // The daemon board itself is refreshed by the store subscription
        } else {
          const discardWorldX = centerX + DISCARD_LOCAL_CX;
          const discardWorldY = centerY + DISCARD_LOCAL_CY;
          back.playOut(discardWorldX, discardWorldY, () => {
            back.destroy();
            this.centreZone?.setDiscardTop(topCard);
          });
        }
      });
    });
  }

  // ── AI card reveal banner — brief overlay showing which card the AI played ──
  private flashAiCardBanner(card: CardData, x: number, y: number) {
    const CAT_COLORS: Record<string, number> = {
      CREDITS:        0x00ff88,
      EVENT_POSITIVE: 0x00ccff,
      EVENT_NEGATIVE: 0xff3355,
      WAR:            0xff8800,
      COUNTER:        0xbb44ff,
      DAEMON:         0x00ffcc,
    };
    const CAT_LABELS: Record<string, string> = {
      CREDITS:        'DATA HARVEST',
      EVENT_POSITIVE: 'SYSTEM EVENT',
      EVENT_NEGATIVE: 'HACK PROTOCOL',
      WAR:            'GRID CONFLICT',
      COUNTER:        'COUNTERMEASURE',
      DAEMON:         'DAEMON',
    };

    const catColor = CAT_COLORS[card.category] ?? 0x00ffcc;
    const catHex   = `#${catColor.toString(16).padStart(6, '0')}`;
    const BW = 230, BH = 58;

    const con = this.add.container(x, y).setDepth(200).setAlpha(0);

    const bg = this.add.graphics();
    bg.fillStyle(0x08080f, 0.96);
    bg.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 7);
    bg.lineStyle(1.5, catColor, 0.9);
    bg.strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 7);
    // Thin top accent stripe
    bg.fillStyle(catColor, 0.18);
    bg.fillRoundedRect(-BW / 2, -BH / 2, BW, 14, { tl: 7, tr: 7, bl: 0, br: 0 });
    con.add(bg);

    const catLbl = this.add.text(0, -BH / 2 + 7, `${CAT_LABELS[card.category] ?? card.category}`, {
      fontFamily: 'monospace', fontSize: '7px', color: catHex, letterSpacing: 3,
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5);
    con.add(catLbl);

    const nameLbl = this.add.text(0, -BH / 2 + 30, card.name.toUpperCase(), {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
      resolution: window.devicePixelRatio,
    }).setOrigin(0.5);
    con.add(nameLbl);

    const agentLbl = this.add.text(-BW / 2 + 8, BH / 2 - 6, '>> AI PLAYS', {
      fontFamily: 'monospace', fontSize: '7px', color: `${catHex}88`, letterSpacing: 2,
      resolution: window.devicePixelRatio,
    }).setOrigin(0, 1);
    con.add(agentLbl);

    // Fade in → hold → fade out
    this.tweens.add({
      targets: con, alpha: 1,
      duration: 150, ease: 'Quad.easeOut',
      onComplete: () => {
        this.time.delayedCall(1450, () => {
          this.tweens.add({
            targets: con, alpha: 0,
            duration: 200, ease: 'Quad.easeIn',
            onComplete: () => con.destroy(),
          });
        });
      },
    });
  }

  // ── Incoming-attack warning — fired when an AI card costs the human credits ──
  private flashIncomingAttack(attackerName: string, width: number, height: number) {
    const dpr = window.devicePixelRatio;

    // Full-screen red flash
    const flash = this.add.rectangle(width / 2, height / 2, width, height, 0xff0022, 0.18);
    flash.setDepth(185).setAlpha(0);
    this.tweens.add({
      targets: flash,
      alpha: { from: 0.18, to: 0 },
      duration: 1100,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });

    // Red vignette border pulse (four thin edge rectangles)
    const edgeAlpha = 0.55;
    const edgeW = 18;
    const edges = [
      this.add.rectangle(width / 2, edgeW / 2,      width,  edgeW, 0xff1133, edgeAlpha),
      this.add.rectangle(width / 2, height - edgeW / 2, width, edgeW, 0xff1133, edgeAlpha),
      this.add.rectangle(edgeW / 2,      height / 2, edgeW, height, 0xff1133, edgeAlpha),
      this.add.rectangle(width - edgeW / 2, height / 2, edgeW, height, 0xff1133, edgeAlpha),
    ];
    edges.forEach(e => e.setDepth(186).setAlpha(0));
    this.tweens.add({
      targets: edges,
      alpha: { from: edgeAlpha, to: 0 },
      duration: 1400,
      ease: 'Quad.easeOut',
      onComplete: () => edges.forEach(e => e.destroy()),
    });

    // Warning banner — slides up from the bottom of the screen
    const BW = 340, BH = 56;
    const bx = width / 2;
    const byTarget = height - 90;
    const con = this.add.container(bx, byTarget + 70).setDepth(190).setAlpha(0);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a0005, 0.97);
    bg.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 6);
    bg.lineStyle(1.5, 0xff1e3c, 0.9);
    bg.strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 6);
    bg.fillStyle(0xff1e3c, 0.18);
    bg.fillRoundedRect(-BW / 2, -BH / 2, BW, 11, { tl: 6, tr: 6, bl: 0, br: 0 });
    con.add(bg);

    con.add(this.add.text(0, -11, '⚠  INCOMING ATTACK', {
      fontFamily: 'monospace', fontSize: '9px', color: '#ff3355',
      letterSpacing: 4, resolution: dpr,
    }).setOrigin(0.5));

    con.add(this.add.text(0, 8, `${attackerName.toUpperCase()} TARGETED YOU`, {
      fontFamily: 'monospace', fontSize: '8px', color: '#ff1e3c88',
      letterSpacing: 2, resolution: dpr,
    }).setOrigin(0.5));

    // Slide in
    this.tweens.add({
      targets: con,
      y: byTarget, alpha: 1,
      duration: 300, ease: 'Back.easeOut',
    });
    // Hold then slide out
    this.time.delayedCall(2400, () => {
      this.tweens.add({
        targets: con,
        y: byTarget + 28, alpha: 0,
        duration: 320, ease: 'Quad.easeIn',
        onComplete: () => con.destroy(),
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
