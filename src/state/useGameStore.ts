// src/state/useGameStore.ts
import { create } from 'zustand';
import type { GameState, PlayerState, LogEntry, AIPersonality } from '../types/gameState';
import type { Card, CreditsCard, PositiveEventCard, NegativeEventCard, WarCard, DaemonCard, CounterCard } from '../types/cards';
import { initRNG, random } from '../lib/rng';
import { generateDeck } from '../data/deck';

// ── Module-level helpers ──────────────────────────────────────────────────────

// Written by applyCardEffect when a Quarantine shield absorbs an attack.
// Read (and cleared) by applyPlayCard so it can emit the right log entry.
let _quarantineBlockedBy: string | null = null;
// Written by applyCardEffect when a Cease & Desist cancels a WAR or EVENT_NEGATIVE.
let _negotiateBlockedBy: string | null = null;
// Written by applyCardEffect when a daemon immunity blocks a targeted attack.
let _daemonImmunityBlockedBy: string | null = null;
// Written by applyCardEffect when a WAR card resolves — captures both rolls and outcome.
let _warRollResult: { actorRoll: number; actorBase: number; actorBonus: number; targetRoll: number; actorWins: boolean; targetName: string } | null = null;
// Written by applyCardEffect when a targeted card resolves — captures the target's name.
let _lastTargetName: string | null = null;

// targetIndex — when provided (human targeting), use it directly.
// When omitted (AI turn), fall back to a random live opponent.
function applyCardEffect(card: Card, players: PlayerState[], actorIndex: number, targetIndex?: number): PlayerState[] {
  const liveOpponents = players
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => i !== actorIndex && !p.eliminated);

  const resolveTarget = (): number => {
    if (targetIndex !== undefined) return targetIndex;
    return liveOpponents.length > 0
      ? liveOpponents[Math.floor(random() * liveOpponents.length)].i
      : -1;
  };

  switch (card.category) {
    case 'CREDITS':
      return players.map((p, i) =>
        i === actorIndex
          ? { ...p, credits: Math.min(200, p.credits + (card as CreditsCard).amount) }
          : p
      );

    case 'EVENT_POSITIVE': {
      const pos = card as PositiveEventCard;
      if (pos.effect === 'DRAIN_ALL') {
        // All live opponents each lose `amount`; actor gains amount × opponent count
        const liveCount = liveOpponents.length;
        const drained = players.map((p, i) =>
          (i === actorIndex || p.eliminated) ? p : { ...p, credits: Math.max(0, p.credits - pos.amount) }
        );
        return drained.map((p, i) =>
          i === actorIndex ? { ...p, credits: Math.min(200, p.credits + pos.amount * liveCount) } : p
        );
      }
      // OVERCLOCK — mark actor so their next Stability Roll is doubled
      if (pos.effect === 'OVERCLOCK') {
        return players.map((p, i) => i === actorIndex ? { ...p, overclocked: true } : p);
      }
      return players.map((p, i) =>
        i === actorIndex ? { ...p, credits: Math.min(200, p.credits + pos.amount) } : p
      );
    }

    case 'EVENT_NEGATIVE': {
      const neg = card as NegativeEventCard;

      // DAMAGE_ALL_DAEMON — hits every live opponent, no specific target (e.g. Network Storm)
      if (neg.effect === 'DAMAGE_ALL_DAEMON') {
        return players.map((p, i) => {
          if (i === actorIndex || p.eliminated) return p;
          const imps = [...p.daemons];
          if (imps.length > 0) imps.splice(Math.floor(random() * imps.length), 1);
          return { ...p, credits: Math.max(0, p.credits - neg.amount), daemons: imps };
        });
      }

      if (!neg.targetsOther || liveOpponents.length === 0) return players;
      const ti = resolveTarget();
      if (ti === -1) return players;
      _lastTargetName = players[ti].name;

      // Quarantine — the target's shield absorbs the attack and is consumed
      if (players[ti].quarantined) {
        _quarantineBlockedBy = players[ti].name;
        return players.map((p, i) => i === ti ? { ...p, quarantined: false } : p);
      }
      // Cease & Desist — broader diplomatic block also covers EVENT_NEGATIVE
      if (players[ti].negotiating) {
        _negotiateBlockedBy = players[ti].name;
        return players.map((p, i) => i === ti ? { ...p, negotiating: false } : p);
      }
      // Daemon immunity — target's daemon type blocks this specific card entirely
      if (neg.immuneDaemon && players[ti].daemons.includes(neg.immuneDaemon)) {
        _daemonImmunityBlockedBy = `${players[ti].name}'s ${neg.immuneDaemon.replace('_', ' ')}`;
        return players;
      }

      // STEAL — actor gains amount, target loses amount (e.g. Signal Theft / Pied Piper)
      if (neg.effect === 'STEAL') {
        return players.map((p, i) => {
          if (i === actorIndex) return { ...p, credits: Math.min(200, p.credits + neg.amount) };
          if (i === ti)         return { ...p, credits: Math.max(0, p.credits - neg.amount) };
          return p;
        });
      }

      // MUTUAL_DAMAGE — both actor and target take the hit (e.g. M.A.D.)
      if (neg.effect === 'MUTUAL_DAMAGE') {
        return players.map((p, i) => {
          if (i === actorIndex || i === ti)
            return { ...p, credits: Math.max(0, p.credits - neg.amount) };
          return p;
        });
      }

      // STEAL_DAEMON — take one random daemon from target, add to actor if not already held
      if (neg.effect === 'STEAL_DAEMON') {
        const targetImps = players[ti].daemons;
        if (targetImps.length === 0) return players; // nothing to steal
        const stolen = targetImps[Math.floor(random() * targetImps.length)];
        return players.map((p, i) => {
          if (i === ti)
            return { ...p, daemons: p.daemons.filter(imp => imp !== stolen) };
          if (i === actorIndex && !p.daemons.includes(stolen))
            return { ...p, daemons: [...p.daemons, stolen] };
          return p;
        });
      }

      // Standard single-target damage (with optional daemon removal)
      let next = players.map((p, i) =>
        i === ti ? { ...p, credits: Math.max(0, p.credits - neg.amount) } : p
      );
      if (neg.effect === 'DAMAGE_DAEMON' && next[ti].daemons.length > 0) {
        const imps = [...next[ti].daemons];
        imps.splice(Math.floor(random() * imps.length), 1);
        next = next.map((p, i) => i === ti ? { ...p, daemons: imps } : p);
      }
      return next;
    }

    case 'WAR': {
      const w = card as WarCard;
      if (liveOpponents.length === 0) return players;
      const ti = resolveTarget();
      if (ti === -1) return players;
      _lastTargetName = players[ti].name;
      // Cease & Desist — target's diplomatic block cancels the war entirely
      if (players[ti].negotiating) {
        _negotiateBlockedBy = players[ti].name;
        return players.map((p, i) => i === ti ? { ...p, negotiating: false } : p);
      }
      // Roll 1d6 for each side; Firewall Surge (tacticalBonus) adds +1 to actor's roll
      const actorBase  = Math.floor(random() * 6) + 1;
      const targetRoll = Math.floor(random() * 6) + 1;
      const actorBonus = players[actorIndex].tacticalBonus ? 1 : 0;
      const actorRoll  = actorBase + actorBonus;
      const actorWins  = actorRoll >= targetRoll; // ties go to the attacker
      _warRollResult = { actorRoll, actorBase, actorBonus, targetRoll, actorWins, targetName: players[ti].name };
      // Determine base credit losses based on who won
      let actorLoss  = actorWins ? w.winnerLoses : w.loserLoses;
      let targetLoss = actorWins ? w.loserLoses  : w.winnerLoses;
      // Hardened Node — reduces the loser's credit loss by 5 (min 0)
      if (!actorWins && players[actorIndex].daemons.includes('HARDENED_NODE'))
        actorLoss = Math.max(0, actorLoss - 5);
      if (actorWins && players[ti].daemons.includes('HARDENED_NODE'))
        targetLoss = Math.max(0, targetLoss - 5);
      return players.map((p, i) => {
        if (i === actorIndex) {
          let daemons = [...p.daemons];
          if (!actorWins && w.loserLosesImprovement && daemons.length > 0)
            daemons.splice(Math.floor(random() * daemons.length), 1);
          return { ...p, credits: Math.max(0, p.credits - actorLoss), tacticalBonus: false, daemons }; // clear tacticalBonus after use
        }
        if (i === ti) {
          let daemons = [...p.daemons];
          if (actorWins && w.loserLosesImprovement && daemons.length > 0)
            daemons.splice(Math.floor(random() * daemons.length), 1);
          return { ...p, credits: Math.max(0, p.credits - targetLoss), daemons };
        }
        return p;
      });
    }

    case 'DAEMON': {
      const imp = card as DaemonCard;
      const actor = players[actorIndex];
      if (actor.daemons.includes(imp.daemonType)) return players;
      return players.map((p, i) =>
        i === actorIndex ? { ...p, daemons: [...p.daemons, imp.daemonType] } : p
      );
    }

    case 'COUNTER': {
      const cnt = card as CounterCard;
      // SHIELD (Quarantine) — protect the actor from the next incoming targeted EVENT_NEGATIVE
      if (cnt.counterType === 'SHIELD') {
        return players.map((p, i) => i === actorIndex ? { ...p, quarantined: true } : p);
      }
      // TACTICAL_ADVANTAGE (Firewall Surge) — waive own war cost on the next WAR card played
      if (cnt.counterType === 'TACTICAL_ADVANTAGE') {
        return players.map((p, i) => i === actorIndex ? { ...p, tacticalBonus: true } : p);
      }
      // NEGOTIATE (Cease & Desist) — block the next WAR or EVENT_NEGATIVE targeting this player
      if (cnt.counterType === 'NEGOTIATE') {
        return players.map((p, i) => i === actorIndex ? { ...p, negotiating: true } : p);
      }
      return players;
    }

    default:
      return players;
  }
}

function pickAiCard(ai: PlayerState): Card | null {
  if (ai.hand.length === 0) return null;
  switch (ai.personality) {
    case 'AGGRESSIVE': {
      const hasWar = ai.hand.some(c => c.category === 'WAR');
      // Play Firewall Surge just before going to war — waives own losses
      if (hasWar && !ai.tacticalBonus)
        return ai.hand.find(c => c.category === 'COUNTER' && (c as CounterCard).counterType === 'TACTICAL_ADVANTAGE')
          ?? ai.hand.find(c => c.category === 'WAR')
          ?? ai.hand.find(c => c.category === 'EVENT_NEGATIVE')
          ?? ai.hand[0];
      return ai.hand.find(c => c.category === 'WAR')
        ?? ai.hand.find(c => c.category === 'EVENT_NEGATIVE')
        ?? ai.hand[0];
    }
    case 'CAUTIOUS':
      // Play Cease & Desist when low on credits as a defensive shield
      return ai.hand.find(c => c.category === 'DAEMON')
        ?? ai.hand.find(c => c.category === 'CREDITS')
        ?? (ai.credits < 20
          ? ai.hand.find(c => c.category === 'COUNTER' && (c as CounterCard).counterType === 'NEGOTIATE')
          : undefined)
        ?? ai.hand[0];
    case 'TACTICAL': {
      const score = (c: Card): number => {
        if (c.category === 'WAR') return (c as WarCard).loserLoses;
        if (c.category === 'EVENT_NEGATIVE') return (c as NegativeEventCard).amount + 5;
        if (c.category === 'CREDITS') return (c as CreditsCard).amount;
        if (c.category === 'EVENT_POSITIVE') return (c as PositiveEventCard).amount;
        if (c.category === 'DAEMON') return 8;
        return 0;
      };
      return [...ai.hand].sort((a, b) => score(b) - score(a))[0];
    }
    default:
      return ai.hand[Math.floor(random() * ai.hand.length)];
  }
}

function cardLogText(card: Card, actorName: string): string {
  switch (card.category) {
    case 'CREDITS':
      return `${actorName} ran ${card.name} (+${(card as CreditsCard).amount} credits)`;
    case 'EVENT_POSITIVE': {
      const pos = card as PositiveEventCard;
      if (pos.effect === 'DRAIN_ALL')
        return `${actorName} deployed ${card.name} (drained ${pos.amount} credits from every opponent)`;
      if (pos.effect === 'OVERCLOCK')
        return `${actorName} activated ${card.name} — next roll is doubled`;
      return `${actorName} triggered ${card.name} (+${pos.amount} credits)`;
    }
    case 'EVENT_NEGATIVE': {
      const neg = card as NegativeEventCard;
      const tgt = _lastTargetName ?? 'target';
      if (neg.effect === 'STEAL')
        return `${actorName} deployed ${card.name} — stole ${neg.amount}¢ from ${tgt}`;
      if (neg.effect === 'MUTUAL_DAMAGE')
        return `${actorName} triggered M.A.D. — mutual ${neg.amount}¢ loss with ${tgt}`;
      if (neg.effect === 'STEAL_DAEMON')
        return `${actorName} deployed ${card.name} — stole a daemon from ${tgt}`;
      if (neg.effect === 'DAMAGE_ALL_DAEMON')
        return `${actorName} deployed ${card.name} — hit all opponents for ${neg.amount}¢`;
      if (neg.effect === 'CORRUPTION')
        return `${actorName} unleashed The Corruption — ${tgt} loses ${neg.amount}¢`;
      return `${actorName} deployed ${card.name} — ${tgt} loses ${neg.amount}¢`;
    }
    case 'WAR': {
      if (_warRollResult) {
        const { actorBase, actorBonus, actorRoll, targetRoll, actorWins, targetName } = _warRollResult;
        const actorRollStr = actorBonus > 0 ? `${actorBase}+${actorBonus}=${actorRoll}` : `${actorRoll}`;
        const winner = actorWins ? actorName : targetName;
        return `${actorName} played ${card.name} — rolled ${actorRollStr} vs ${targetName} ${targetRoll} — ${winner} wins`;
      }
      return `${actorName} played ${card.name}`;
    }
    case 'DAEMON': return `${actorName} deployed daemon ${card.name}`;
    case 'COUNTER': {
      const cnt = card as CounterCard;
      if (cnt.counterType === 'SHIELD')
        return `${actorName} activated ${card.name} — next hack blocked`;
      if (cnt.counterType === 'TACTICAL_ADVANTAGE')
        return `${actorName} activated ${card.name} — +1 to next WAR roll`;
      if (cnt.counterType === 'NEGOTIATE')
        return `${actorName} deployed ${card.name} — next war or hack will be cancelled`;
      return `${actorName} played ${card.name}`;
    }
  }
}

// ── Log ID counter ────────────────────────────────────────────────────────────

let _logId = 0;
const makeLogEntry = (text: string, type: LogEntry['type']): LogEntry => ({
  id: `log_${++_logId}`,
  text,
  type,
  timestamp: Date.now(),
});

// ── Store interface ────────────────────────────────────────────────────────────

interface GameStore extends GameState {
  selectedCardId: string | null;
  hoveredCardId: string | null;
  turnNumber: number;
  rollResult: [number, number] | null;
  rollTriggered: boolean;
  pendingCardId: string | null;
  validTargetIds: string[];
  startGame(playerCount: number, playerName: string, startingPop: number, hidePpCounts: boolean, deadMansSwitch: boolean): void;
  resetToSetup(): void;
  setHoveredCard(id: string | null): void;
  addLog(text: string, type: LogEntry['type']): void;
  drawCard(): void;
  selectCard(id: string | null): void;
  playCard(cardId: string): void;
  applyPlayCard(cardId: string, targetIndex: number | undefined): void;
  discardCard(cardId: string): void;
  selectTarget(targetId: string): void;
  cancelTargeting(): void;
  resolveDeadMansSwitch(card: Card | null): void;
  endTurn(): void;
  advanceTurn(): void;
  triggerRoll(): void;
  rollComplete(): void;
  runAiTurn(): void;
}

// ── Default state ──────────────────────────────────────────────────────────────

const defaultState: GameState & { selectedCardId: string | null; hoveredCardId: string | null; turnNumber: number; rollResult: [number, number] | null; rollTriggered: boolean; pendingCardId: string | null; validTargetIds: string[] } = {
  phase: 'SETUP',
  players: [],
  deck: [],
  discard: [],
  currentPlayerIndex: 0,
  globalCorruptionMode: false,
  winnerId: null,
  log: [],
  gameSeed: 0,
  selectedCardId: null,
  hoveredCardId: null,
  turnNumber: 1,
  rollResult: null,
  rollTriggered: false,
  pendingCardId: null,
  validTargetIds: [],
  startingPop: 50,
  hidePpCounts: false,
  deadMansSwitch: false,
  deadMansSwitchPending: null,
};

// ── Cyberpunk AI names & personalities ────────────────────────────────────────

const AI_NAMES = ['Ghost', 'Cipher', 'Null.Byte', 'Phantom'];
const AI_PERSONALITIES: AIPersonality[] = ['AGGRESSIVE', 'CAUTIOUS', 'TACTICAL'];

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => ({
  ...defaultState,

  startGame: (playerCount: number, playerName = 'You', startingPop = 50, hidePpCounts = false, deadMansSwitch = false) => {
    const seed = initRNG();

    // Deal initial hands
    const deck = generateDeck();
    const players: PlayerState[] = Array.from({ length: playerCount }, (_, i) => ({
      id: `player_${i}`,
      name: i === 0 ? playerName : AI_NAMES[i] ?? `Agent ${i}`,
      isHuman: i === 0,
      personality: i === 0 ? undefined : AI_PERSONALITIES[(i - 1) % AI_PERSONALITIES.length],
      credits: startingPop,
      hand: [],
      daemons: [],
      eliminated: false,
      quarantined: false,
      overclocked: false,
      tacticalBonus: false,
      negotiating: false,
    }));

    // Deal 5 cards to each player (round-robin so distribution is fair)
    let deckCursor = 0;
    for (let i = 0; i < 5; i++) {
      for (let p = 0; p < players.length; p++) {
        if (deckCursor < deck.length) {
          players[p].hand.push(deck[deckCursor++]);
        }
      }
    }
    const remainingDeck = deck.slice(deckCursor);

    const firstRoll: [number, number] = [Math.ceil(random() * 6), Math.ceil(random() * 6)];
    set({
      ...defaultState,
      phase: 'PHASE_ROLL',
      players,
      deck: remainingDeck,
      discard: [],
      gameSeed: seed,
      currentPlayerIndex: 0,
      turnNumber: 1,
      selectedCardId: null,
      rollResult: firstRoll,
      rollTriggered: false,
      startingPop,
      hidePpCounts,
      deadMansSwitch,
    });

    get().addLog('Game started. Welcome to Corrupt Reality.', 'turn');
    get().addLog(`${players[0].name}'s turn — Begin the sequence.`, 'turn');
  },

  resetToSetup: () => set({ ...defaultState, selectedCardId: null, hoveredCardId: null, turnNumber: 1 }),

  setHoveredCard: (id) => set({ hoveredCardId: id }),

  addLog: (text, type) => set(state => ({
    log: [...state.log, makeLogEntry(text, type)],
  })),

  drawCard: () => {
    const state = get();
    if (state.phase !== 'DRAW') return;

    const actorIndex = state.currentPlayerIndex;
    const currentHandSize = state.players[actorIndex].hand.length;
    const TARGET_HAND = 6;
    const needed = Math.max(0, TARGET_HAND - currentHandSize);

    // Already at target — skip straight to MAIN
    if (needed === 0) {
      set({ phase: 'MAIN' });
      return;
    }

    let deck = [...state.deck];
    let discard = [...state.discard];
    let players = state.players.map(p => ({ ...p, hand: [...p.hand] }));
    let drawn = 0;

    for (let n = 0; n < needed; n++) {
      if (deck.length === 0) {
        if (discard.length === 0) break;
        deck = [...discard].sort(() => random() - 0.5);
        discard = [];
        get().addLog('Deck exhausted — reshuffling discard pile.', 'effect');
      }
      const [card, ...rest] = deck;
      deck = rest;
      players[actorIndex].hand.push(card);
      drawn++;
    }

    set({ deck, discard, players, phase: 'MAIN' });
    get().addLog(
      `${state.players[actorIndex].name} drew ${drawn} card${drawn !== 1 ? 's' : ''}.`,
      'turn',
    );
  },

  selectCard: (id: string | null) => set({ selectedCardId: id }),

  playCard: (cardId: string) => {
    const state = get();
    if (state.phase !== 'MAIN') return;

    const actorIndex = state.currentPlayerIndex;
    const actor = state.players[actorIndex];
    const card = actor.hand.find(c => c.id === cardId);
    if (!card) return;

    const liveOpponents = state.players.filter((p, i) => i !== actorIndex && !p.eliminated);

    // Human players must select a target for targeting cards
    const needsTarget =
      actor.isHuman &&
      liveOpponents.length > 0 &&
      (
        (card.category === 'EVENT_NEGATIVE' && (card as NegativeEventCard).targetsOther) ||
        card.category === 'WAR'
      );

    if (needsTarget) {
      set({
        phase: 'TARGETING',
        pendingCardId: cardId,
        validTargetIds: liveOpponents.map(p => p.id),
      });
      return;
    }

    // AI or non-targeting cards — apply immediately
    get().applyPlayCard(cardId, undefined);
  },

  // Internal helper — applies a card with an optional resolved target index.
  // Called by both playCard (AI/non-targeting) and selectTarget (human).
  applyPlayCard: (cardId: string, targetIndex: number | undefined) => {
    const state = get();
    const actorIndex = state.currentPlayerIndex;
    const actor = state.players[actorIndex];
    const card = actor.hand.find(c => c.id === cardId);
    if (!card) return;

    const handAfter = actor.hand.filter(c => c.id !== cardId);
    let players = state.players.map((p, i) =>
      i === actorIndex ? { ...p, hand: handAfter } : p
    );

    _quarantineBlockedBy = null;
    _negotiateBlockedBy = null;
    _daemonImmunityBlockedBy = null;
    _warRollResult = null;
    _lastTargetName = null;
    players = applyCardEffect(card, players, actorIndex, targetIndex);
    const blockedBy = _quarantineBlockedBy;
    const negotiateBlockedBy = _negotiateBlockedBy;
    const daemonBlockedBy = _daemonImmunityBlockedBy;
    _quarantineBlockedBy = null;
    _negotiateBlockedBy = null;
    _daemonImmunityBlockedBy = null;

    const isCorruption = card.category === 'EVENT_NEGATIVE' && (card as NegativeEventCard).effect === 'CORRUPTION';
    const globalCorruptionMode = isCorruption ? true : state.globalCorruptionMode;
    let discard = [...state.discard, card];

    // ── Dead Man's Switch — players who just hit 0 may fire one last negative card ──
    // AI players auto-pick; the human player gets a choice overlay.
    let humanDmsPending: { playerIndex: number; eligibleCards: NegativeEventCard[] } | null = null;

    if (state.deadMansSwitch) {
      for (let i = 0; i < players.length; i++) {
        const wasAlive = !state.players[i].eliminated;
        if (!wasAlive || players[i].credits > 0) continue;

        const eligibleCards = players[i].hand.filter(
          c => c.category === 'EVENT_NEGATIVE' && (c as NegativeEventCard).targetsOther
        ) as NegativeEventCard[];
        if (eligibleCards.length === 0) continue;

        if (players[i].isHuman) {
          // Human — pause and show overlay (only capture first one)
          if (!humanDmsPending) humanDmsPending = { playerIndex: i, eligibleCards };
        } else {
          // AI — auto-play a random eligible card
          const lastCard = eligibleCards[Math.floor(random() * eligibleCards.length)];
          players = players.map((p, idx) =>
            idx === i ? { ...p, hand: p.hand.filter(c => c.id !== lastCard.id) } : p
          );
          players = applyCardEffect(lastCard, players, i);
          discard = [...discard, lastCard];
          get().addLog(`💀 ${players[i].name} triggers Dead Man's Switch — plays ${lastCard.name}!`, 'effect');
        }
      }
    }

    get().addLog(cardLogText(card, actor.name), 'card');
    _warRollResult = null;
    _lastTargetName = null;
    if (blockedBy) get().addLog(`${blockedBy}'s Quarantine absorbed the attack!`, 'effect');
    if (negotiateBlockedBy) get().addLog(`${negotiateBlockedBy}'s Cease & Desist cancelled the attack!`, 'effect');
    if (daemonBlockedBy) get().addLog(`${daemonBlockedBy} blocked the attack!`, 'effect');

    if (humanDmsPending) {
      // Mark AI eliminations now; keep the human's eliminated flag clear until they resolve
      players = players.map((p) => ({
        ...p,
        eliminated: p.eliminated || (!p.isHuman && p.credits <= 0),
      }));
      set({
        players, discard, globalCorruptionMode,
        phase: 'MAIN',
        selectedCardId: null,
        pendingCardId: null,
        validTargetIds: [],
        deadMansSwitchPending: humanDmsPending,
      });
      return; // advanceTurn fires after overlay resolves
    }

    players = players.map(p => ({ ...p, eliminated: p.eliminated || p.credits <= 0 }));

    const alive = players.filter(p => !p.eliminated);
    const winnerId = alive.length === 1 ? alive[0].id : null;

    if (winnerId) get().addLog(`${alive[0].name} wins the game!`, 'turn');

    const isHuman = state.players[actorIndex]?.isHuman ?? false;

    set({
      players, discard, globalCorruptionMode, winnerId,
      phase: winnerId ? 'GAME_OVER' : (isHuman ? 'END_TURN' : 'MAIN'),
      selectedCardId: null,
      pendingCardId: null,
      validTargetIds: [],
      deadMansSwitchPending: null,
    });

    // AI players advance automatically after the card fly-out animation settles.
    if (!winnerId && !isHuman) setTimeout(() => get().advanceTurn(), 950);
  },

  selectTarget: (targetId: string) => {
    const state = get();
    if (state.phase !== 'TARGETING' || !state.pendingCardId) return;
    const targetIndex = state.players.findIndex(p => p.id === targetId);
    if (targetIndex === -1) return;
    get().applyPlayCard(state.pendingCardId, targetIndex);
  },

  cancelTargeting: () => {
    if (get().phase !== 'TARGETING') return;
    set({ phase: 'MAIN', pendingCardId: null, validTargetIds: [] });
  },

  resolveDeadMansSwitch: (card: Card | null) => {
    const state = get();
    if (!state.deadMansSwitchPending) return;

    const { playerIndex } = state.deadMansSwitchPending;
    let players = state.players.map(p => ({ ...p }));
    let discard = [...state.discard];

    if (card) {
      players = players.map((p, i) =>
        i === playerIndex ? { ...p, hand: p.hand.filter(c => c.id !== card.id) } : p
      );
      players = applyCardEffect(card, players, playerIndex);
      discard = [...discard, card];
      get().addLog(`💀 ${state.players[playerIndex].name} triggers Dead Man's Switch — plays ${card.name}!`, 'effect');
    } else {
      get().addLog(`💀 ${state.players[playerIndex].name} goes quietly.`, 'effect');
    }

    // Now mark all remaining eliminations (including the DMS player)
    players = players.map(p => ({ ...p, eliminated: p.eliminated || p.credits <= 0 }));
    const alive = players.filter(p => !p.eliminated);
    const winnerId = alive.length === 1 ? alive[0].id : null;
    if (winnerId) get().addLog(`${alive[0].name} wins the game!`, 'turn');

    const humanResolved = state.players[state.deadMansSwitchPending.playerIndex]?.isHuman ?? false;

    set({
      players, discard, winnerId,
      phase: winnerId ? 'GAME_OVER' : (humanResolved ? 'END_TURN' : 'MAIN'),
      deadMansSwitchPending: null,
    });

    if (!winnerId && !humanResolved) setTimeout(() => get().advanceTurn(), 950);
  },

  discardCard: (cardId: string) => {
    const state = get();
    if (state.phase !== 'MAIN') return;

    const actorIndex = state.currentPlayerIndex;
    const actor = state.players[actorIndex];
    const card = actor.hand.find(c => c.id === cardId);
    if (!card) return;

    const handAfter = actor.hand.filter(c => c.id !== cardId);
    const players = state.players.map((p, i) =>
      i === actorIndex ? { ...p, hand: handAfter } : p
    );
    const discard = [...state.discard, card];

    set({ players, discard, selectedCardId: null, phase: 'END_TURN' });
    get().addLog(`${actor.name} discarded ${card.name}.`, 'card');
  },

  endTurn: () => {
    if (get().phase !== 'END_TURN') return;
    get().advanceTurn();
  },

  advanceTurn: () => {
    const state = get();
    if (state.phase === 'GAME_OVER') return;

    const { players, currentPlayerIndex, turnNumber } = state;
    const total = players.length;

    // Find next non-eliminated player
    let nextIndex = (currentPlayerIndex + 1) % total;
    let loops = 0;
    while (players[nextIndex].eliminated && loops < total) {
      nextIndex = (nextIndex + 1) % total;
      loops++;
    }

    // If all are eliminated somehow, do nothing
    if (players[nextIndex].eliminated) return;

    const wrappedAround = nextIndex <= currentPlayerIndex;
    const newTurnNumber = wrappedAround ? turnNumber + 1 : turnNumber;
    const roll: [number, number] = [Math.ceil(random() * 6), Math.ceil(random() * 6)];

    set({
      currentPlayerIndex: nextIndex,
      phase: 'PHASE_ROLL',
      turnNumber: newTurnNumber,
      rollResult: roll,
      rollTriggered: false,
      selectedCardId: null,
    });

    const nextPlayer = players[nextIndex];
    get().addLog(`${nextPlayer.name}'s turn — sequence pending.`, 'turn');

    // AI auto-triggers the roll after the standby display has had time to appear
    if (!nextPlayer.isHuman) {
      setTimeout(() => get().triggerRoll(), 900);
    }
  },

  triggerRoll: () => {
    if (get().phase !== 'PHASE_ROLL') return;
    set({ rollTriggered: true });
  },

  rollComplete: () => {
    const state = get();
    if (state.phase !== 'PHASE_ROLL') return;

    const [r1, r2] = state.rollResult ?? [3, 3];
    const total = r1 + r2;
    const actorIndex = state.currentPlayerIndex;
    let players = state.players;

    const inCorruption = state.globalCorruptionMode;

    // Prosperity roll table:  ≤3 → 0 | 4-5 → +5 | 6-8 → +10 | 9-11 → +15 | 12 → +20
    // Corruption roll table:  ≤3 → 0 | 4-5 → −5 | 6-8 → −10 | 9-11 → −15 | 12 → −20
    const baseAmount =
      total <= 3  ? 0  :
      total <= 5  ? 5  :
      total <= 8  ? 10 :
      total <= 11 ? 15 : 20;

    const rollLabel = inCorruption
      ? (total <= 3  ? 'Corruption held — no losses'  :
         total <= 5  ? 'Corruption surge'             :
         total <= 8  ? 'System corrupted'             :
         total <= 11 ? 'Critical corruption'          : 'Total corruption')
      : (total <= 3  ? 'Low sequence — no gain'       :
         total <= 5  ? 'Low sequence'                 :
         total <= 8  ? 'Stable sequence'              :
         total <= 11 ? 'Stability bonus'              : 'Peak stability');

    // Each daemon shifts the effective roll total (+1 stability / -1 corruption)
    const daemonCount = players[actorIndex]?.daemons.length ?? 0;
    const isOverclocked = players[actorIndex]?.overclocked ?? false;

    // Apply daemon shift first, then overclock shift (+5 stability / -5 corruption)
    const afterDaemons = inCorruption
      ? Math.max(2, total - daemonCount)
      : Math.min(12, total + daemonCount);
    const overclockShift = isOverclocked ? (inCorruption ? -5 : 5) : 0;
    const effectiveTotal = inCorruption
      ? Math.max(2, afterDaemons + overclockShift)
      : Math.min(12, afterDaemons + overclockShift);

    const effectiveBase =
      effectiveTotal <= 3  ? 0  :
      effectiveTotal <= 5  ? 5  :
      effectiveTotal <= 8  ? 10 :
      effectiveTotal <= 11 ? 15 : 20;

    const finalAmount = effectiveBase;

    // Clear the overclocked flag whether or not the roll produced an effect
    if (isOverclocked) {
      players = players.map((p, i) => i === actorIndex ? { ...p, overclocked: false } : p);
    }

    const sign        = inCorruption ? '-5' : '+5';
    const overclock   = isOverclocked  ? ` [OVERCLOCK ${sign}: ${afterDaemons}->${effectiveTotal}]` : '';
    const daemonNote  = daemonCount > 0 ? ` [${daemonCount} DAEMON ${inCorruption ? 'SHIELD' : 'BOOST'}: ${total}->${afterDaemons}]` : '';

    const rawBase = total <= 3 ? 0 : total <= 5 ? 5 : total <= 8 ? 10 : total <= 11 ? 15 : 20;
    if (finalAmount > 0 || (inCorruption && rawBase > 0)) {
      if (inCorruption) {
        players = players.map((p, i) =>
          i === actorIndex ? { ...p, credits: Math.max(0, p.credits - finalAmount) } : p
        );
        const lossNote = finalAmount === 0 ? 'losses fully absorbed' : `lost ${finalAmount} credits`;
        get().addLog(`${rollLabel} — ${lossNote}. (${r1}+${r2}=${total})${overclock}${daemonNote}`, 'effect');
      } else {
        players = players.map((p, i) =>
          i === actorIndex ? { ...p, credits: Math.min(200, p.credits + finalAmount) } : p
        );
        get().addLog(`${rollLabel} — gained ${finalAmount} credits. (${r1}+${r2}=${total})${overclock}${daemonNote}`, 'effect');
      }
    } else {
      get().addLog(`${rollLabel}. (${r1}+${r2}=${total})`, 'roll');
    }

    set({ rollTriggered: false, players });

    const currentPlayer = players[actorIndex];
    if (currentPlayer.isHuman) {
      set({ phase: 'DRAW' });
    } else {
      setTimeout(() => get().runAiTurn(), 400);
    }
  },

  runAiTurn: () => {
    const state = get();
    if (state.phase === 'GAME_OVER') return;

    const actorIndex = state.currentPlayerIndex;
    const actor = state.players[actorIndex];
    if (actor.isHuman) return;

    // Draw cards until hand reaches 6
    const TARGET_HAND = 6;
    const needed = Math.max(0, TARGET_HAND - actor.hand.length);

    let deck = [...state.deck];
    let discard = [...state.discard];
    const players = state.players.map(p => ({ ...p, hand: [...p.hand] }));

    for (let n = 0; n < needed; n++) {
      if (deck.length === 0) {
        if (discard.length === 0) break;
        deck = [...discard].sort(() => random() - 0.5);
        discard = [];
      }
      if (deck.length === 0) break;
      const [card, ...rest] = deck;
      deck = rest;
      players[actorIndex].hand.push(card);
    }

    if (players[actorIndex].hand.length === 0) {
      get().advanceTurn();
      return;
    }

    set({ deck, discard, players, phase: 'MAIN' });

    setTimeout(() => {
      const currentState = get();
      const currentActor = currentState.players[currentState.currentPlayerIndex];
      const card = pickAiCard(currentActor);
      if (!card) {
        get().advanceTurn();
        return;
      }
      // AI skips the TARGETING phase — applyPlayCard picks a random target internally
      get().applyPlayCard(card.id, undefined);
    }, 700);
  },
}));
