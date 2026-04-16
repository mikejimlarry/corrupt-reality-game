// src/state/useGameStore.ts
import { create } from 'zustand';
import type { GameState, PlayerState, LogEntry, AIPersonality } from '../types/gameState';
import type { Card, CreditsCard, PositiveEventCard, NegativeEventCard, WarCard, DaemonCard, CounterCard } from '../types/cards';
import { initRNG, random } from '../lib/rng';
import { generateDeck } from '../data/deck';

// ── Elimination helper ────────────────────────────────────────────────────────

function markEliminations(players: PlayerState[], keepHumanAlive = false): PlayerState[] {
  return players.map(p => {
    if (p.eliminated) return p;
    const shouldEliminate = p.credits <= 0 && (!keepHumanAlive || !p.isHuman);
    if (shouldEliminate) {
      if (!_eliminationOrder.includes(p.id)) _eliminationOrder.push(p.id);
      return { ...p, eliminated: true, daemons: [] };
    }
    return p;
  });
}

// ── Module-level helpers ──────────────────────────────────────────────────────

// When true, applyPlayCard skips the reactive-counter intercept (used when
// resolveCounterOpportunity re-invokes applyPlayCard after the human allows).
let _skipCounterCheck = false;

// Written by applyCardEffect when a Quarantine shield absorbs an attack.
// Read (and cleared) by applyPlayCard so it can emit the right log entry.
let _quarantineBlockedBy: string | null = null;
// Written by applyCardEffect when a System Interrupt cancels a WAR or Digital Crusade.
let _negotiateBlockedBy: string | null = null;
// Written by applyCardEffect when a daemon immunity blocks a targeted attack.
let _daemonImmunityBlockedBy: string | null = null;
// Written by applyCardEffect when a WAR card resolves — captures both rolls and outcome.
let _warRollResult: { actorRoll: number; actorBase: number; actorBonus: number; targetRoll: number; targetBase: number; targetBonus: number; actorWins: boolean; targetName: string } | null = null;
// Written by applyCardEffect when a targeted card resolves — captures the target's name.
let _lastTargetName: string | null = null;
// Tracks player ids in order of elimination; reset each game.
let _eliminationOrder: string[] = [];
// Guards against double-saving the game record when multiple set() paths fire.
let _recordSaved = false;

// ── localStorage win/loss record ──────────────────────────────────────────────

interface _SessionRecord { date: string; humanWon: boolean; turns: number; playerCount: number; corrupted: boolean; }
interface _GameRecords   { wins: number; losses: number; history: _SessionRecord[]; }

function saveGameRecord(humanWon: boolean, turns: number, playerCount: number, corrupted: boolean): void {
  try {
    const key = 'crg-records';
    const raw = localStorage.getItem(key);
    const existing: _GameRecords = raw ? JSON.parse(raw) : { wins: 0, losses: 0, history: [] };
    const record: _SessionRecord = { date: new Date().toISOString(), humanWon, turns, playerCount, corrupted };
    const history = [record, ...existing.history].slice(0, 20);
    localStorage.setItem(key, JSON.stringify({
      wins: existing.wins + (humanWon ? 1 : 0),
      losses: existing.losses + (humanWon ? 0 : 1),
      history,
    }));
  } catch { /* localStorage unavailable */ }
}

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

      // Quarantine — the target's shield absorbs the attack and is consumed.
      // Does NOT block Digital Crusade or M.A.D. (those require Cease & Desist or nothing).
      if (
        players[ti].quarantined &&
        neg.name !== 'Digital Crusade' &&
        neg.effect !== 'MUTUAL_DAMAGE'
      ) {
        _quarantineBlockedBy = players[ti].name;
        return players.map((p, i) => i === ti ? { ...p, quarantined: false } : p);
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
      // Roll 1d6 for each side; Firewall Surge (tacticalBonus) adds +N to each player's roll
      const actorBase   = Math.floor(random() * 6) + 1;
      const targetBase  = Math.floor(random() * 6) + 1;
      const actorBonus  = players[actorIndex].tacticalBonus;   // number of stacked Firewall Surges
      const targetBonus = players[ti].tacticalBonus;
      const actorRoll   = actorBase + actorBonus;
      const targetRoll  = targetBase + targetBonus;
      const actorWins   = actorRoll >= targetRoll; // ties go to the attacker
      _warRollResult = { actorRoll, actorBase, actorBonus, targetRoll, targetBase, targetBonus, actorWins, targetName: players[ti].name };
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
          return { ...p, credits: Math.max(0, p.credits - actorLoss), tacticalBonus: 0, daemons }; // clear tacticalBonus after use
        }
        if (i === ti) {
          let daemons = [...p.daemons];
          if (actorWins && w.loserLosesImprovement && daemons.length > 0)
            daemons.splice(Math.floor(random() * daemons.length), 1);
          return { ...p, credits: Math.max(0, p.credits - targetLoss), tacticalBonus: 0, daemons };
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
      // TACTICAL_ADVANTAGE (Firewall Surge) — adds +1 to the next WAR roll (stackable)
      if (cnt.counterType === 'TACTICAL_ADVANTAGE') {
        return players.map((p, i) => i === actorIndex ? { ...p, tacticalBonus: p.tacticalBonus + 1 } : p);
      }
      // NEGOTIATE (Cease & Desist) — block the next WAR or EVENT_NEGATIVE targeting this player
      // NEGOTIATE (System Interrupt) — block the next WAR or Digital Crusade targeting this player
      if (cnt.counterType === 'NEGOTIATE') {
        return players.map((p, i) => i === actorIndex ? { ...p, negotiating: true } : p);
      }
      return players;
    }

    default:
      return players;
  }
}

function pickAiCard(
  ai: PlayerState,
  allPlayers: PlayerState[],
  actorIndex: number,
  startingPop: number,
): Card | null {
  if (ai.hand.length === 0) return null;

  const liveOpponents = allPlayers.filter((p, i) => i !== actorIndex && !p.eliminated);

  // Pre-compute useful hand lookups
  const powerCycleCard = ai.hand.find(c =>
    c.category === 'EVENT_NEGATIVE' && (c as NegativeEventCard).effect === 'POWER_CYCLE'
  );
  const multitaskingCard = ai.hand.find(c =>
    c.category === 'EVENT_POSITIVE' && (c as PositiveEventCard).effect === 'EXTRA_PLAY'
  );

  // Richest live opponent — target for Power Cycle
  const richestOpponent = liveOpponents.length > 0
    ? liveOpponents.reduce((best, p) => p.credits > best.credits ? p : best, liveOpponents[0])
    : null;

  // Power Cycle score: how much benefit vs resetting them to startingPop
  const powerCycleScore = richestOpponent
    ? Math.max(0, richestOpponent.credits - startingPop) + richestOpponent.daemons.length * 10
    : 0;

  // Is there a high-impact follow-up card for after Multitasking?
  const hasGoodFollowUp = ai.hand.some(c =>
    c.category === 'EVENT_NEGATIVE' && (c as NegativeEventCard).amount >= 10
  );

  switch (ai.personality) {
    case 'AGGRESSIVE': {
      // Use Power Cycle if target is significantly ahead AND has daemons
      if (powerCycleCard && richestOpponent &&
          richestOpponent.credits > startingPop * 1.3 &&
          richestOpponent.daemons.length > 0) {
        return powerCycleCard;
      }
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
      // Play System Interrupt when low on credits as a defensive shield
      return ai.hand.find(c => c.category === 'DAEMON')
        ?? ai.hand.find(c => c.category === 'CREDITS')
        ?? (ai.credits < 20
          ? ai.hand.find(c => c.category === 'COUNTER' && (c as CounterCard).counterType === 'NEGOTIATE')
          : undefined)
        ?? ai.hand[0];
    case 'TACTICAL': {
      const score = (c: Card): number => {
        if (c.category === 'WAR') return (c as WarCard).loserLoses;
        if (c.category === 'EVENT_NEGATIVE') {
          const neg = c as NegativeEventCard;
          if (neg.effect === 'POWER_CYCLE') return powerCycleScore;
          return neg.amount + 5;
        }
        if (c.category === 'EVENT_POSITIVE') {
          const pos = c as PositiveEventCard;
          // Score Multitasking based on whether a strong follow-up card exists
          if (pos.effect === 'EXTRA_PLAY') return hasGoodFollowUp ? 15 : 0;
          return pos.amount;
        }
        if (c.category === 'CREDITS') return (c as CreditsCard).amount;
        if (c.category === 'DAEMON') return 8;
        return 0;
      };
      return [...ai.hand].sort((a, b) => score(b) - score(a))[0];
    }
    default:
      // BALANCED — also play Multitasking if a follow-up is available
      if (multitaskingCard && hasGoodFollowUp && random() < 0.6) return multitaskingCard;
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
      if (pos.effect === 'EXTRA_PLAY')
        return `${actorName} activated ${card.name} — plays an additional card this turn`;
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
        const { actorBase, actorBonus, actorRoll, targetBase, targetBonus, targetRoll, actorWins, targetName } = _warRollResult;
        const actorRollStr  = actorBonus  > 0 ? `${actorBase}+${actorBonus}=${actorRoll}`  : `${actorRoll}`;
        const targetRollStr = targetBonus > 0 ? `${targetBase}+${targetBonus}=${targetRoll}` : `${targetRoll}`;
        const winner = actorWins ? actorName : targetName;
        return `${actorName} played ${card.name} — rolled ${actorRollStr} vs ${targetName} ${targetRollStr} — ${winner} wins`;
      }
      return `${actorName} played ${card.name}`;
    }
    case 'DAEMON': return `${actorName} deployed daemon ${card.name}`;
    case 'COUNTER': {
      const cnt = card as CounterCard;
      if (cnt.counterType === 'SHIELD')
        return `${actorName} activated ${card.name} — next hack blocked`;
      if (cnt.counterType === 'TACTICAL_ADVANTAGE')
        return `${actorName} activated ${card.name} — +1 to next CONFLICT roll`;
      if (cnt.counterType === 'NEGOTIATE')
        return `${actorName} deployed ${card.name} — next CONFLICT or Digital Crusade will be cancelled`;
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
  corruptionReveal: boolean;
  corruptionPendingTarget: boolean;
  pendingCardId: string | null;
  validTargetIds: string[];
  togglePause(): void;
  startGame(playerCount: number, playerName: string, startingPop: number, hidePpCounts: boolean, deadMansSwitch: boolean): void;
  resetToSetup(): void;
  setHoveredCard(id: string | null): void;
  addLog(text: string, type: LogEntry['type']): void;
  drawCard(): void;
  selectCard(id: string | null): void;
  playCard(cardId: string): void;
  applyPlayCard(cardId: string, targetIndex: number | undefined): void;
  discardCard(cardId: string): void;
  /** Cancel remaining Multitasking extra plays and end the human's turn. */
  cancelExtraPlays(): void;
  selectTarget(targetId: string): void;
  cancelTargeting(): void;
  resolveDeadMansSwitch(card: Card | null): void;
  resolveDaemonSteal(daemon: import('../types/cards').DaemonType | null): void;
  resolveWarPick(p1Index: number, p2Index: number): void;
  cancelWarPick(): void;
  playWarPreCard(cardId: string): void;
  passWarPre(): void;
  cancelWarPre(): void;
  finalizeWarResolution(warCard: import('../types/cards').WarCard, p1Index: number, p2Index: number): void;
  resolveCounterOpportunity(counterCardId: string | null): void;
  endTurn(): void;
  advanceTurn(): void;
  triggerRoll(): void;
  rollComplete(): void;
  corruptionRevealComplete(): void;
  runAiTurn(): void;
}

// ── Default state ──────────────────────────────────────────────────────────────

const defaultState: GameState & { selectedCardId: string | null; hoveredCardId: string | null; turnNumber: number; rollResult: [number, number] | null; rollTriggered: boolean; pendingCardId: string | null; validTargetIds: string[]; corruptionReveal: boolean; corruptionPendingTarget: boolean } = {
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
  corruptionReveal: false,
  corruptionPendingTarget: false,
  pendingCardId: null,
  validTargetIds: [],
  startingPop: 50,
  hidePpCounts: false,
  deadMansSwitch: false,
  deadMansSwitchPending: null,
  daemonStealPending: null,
  warPickPending: null,
  warPrePending: null,
  pendingOverclockCard: null,
  counterPending: null,
  paused: false,
  extraPlayPending: 0,
  gameStats: { cardsPlayed: {}, eliminationOrder: [] },
};

// ── Cyberpunk AI names & personalities ────────────────────────────────────────

const AI_NAMES = ['Ghost', 'Cipher', 'Null.Byte', 'Phantom'];
const AI_PERSONALITIES: AIPersonality[] = ['AGGRESSIVE', 'CAUTIOUS', 'TACTICAL'];

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => ({
  ...defaultState,

  startGame: (playerCount: number, playerName = 'You', startingPop = 50, hidePpCounts = false, deadMansSwitch = false) => {
    _eliminationOrder = [];
    _recordSaved = false;
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
      tacticalBonus: 0,
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
      gameStats: { cardsPlayed: {}, eliminationOrder: [] },
    });

    get().addLog('Game started. Welcome to Corrupt Reality.', 'turn');
    get().addLog(`${players[0].name}'s turn — Begin the sequence.`, 'turn');
  },

  resetToSetup: () => set({ ...defaultState, selectedCardId: null, hoveredCardId: null, turnNumber: 1 }),

  togglePause: () => {
    const nowPaused = !get().paused;
    set({ paused: nowPaused });
    if (!nowPaused) {
      // Resume — restart the AI action chain from wherever it stopped
      const state = get();
      const currentPlayer = state.players[state.currentPlayerIndex];
      if (!currentPlayer?.isHuman && state.phase !== 'GAME_OVER') {
        const phase = state.phase;
        if (phase === 'PHASE_ROLL') {
          setTimeout(() => { if (!get().paused) get().triggerRoll(); }, 900);
        } else if (phase === 'MAIN') {
          setTimeout(() => {
            if (get().paused) return;
            const s = get();
            const actor = s.players[s.currentPlayerIndex];
            const eligibles = s.extraPlayPending > 0
              ? actor.hand.filter(c =>
                  c.category !== 'WAR' && c.category !== 'COUNTER' &&
                  !(c.category === 'EVENT_POSITIVE' && (c as PositiveEventCard).effect === 'EXTRA_PLAY')
                )
              : actor.hand;
            const card = s.extraPlayPending > 0
              ? (eligibles[Math.floor(random() * eligibles.length)] ?? null)
              : pickAiCard(actor, s.players, s.currentPlayerIndex, s.startingPop);
            if (!card) {
              set({ extraPlayPending: 0, phase: 'END_TURN' });
              setTimeout(() => { if (!get().paused) get().advanceTurn(); }, 950);
              return;
            }
            get().applyPlayCard(card.id, undefined);
          }, 700);
        } else if (phase === 'END_TURN') {
          setTimeout(() => { if (!get().paused) get().advanceTurn(); }, 950);
        }
      }
    }
  },

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

    let corruptionCard: Card | null = null;

    for (let n = 0; n < needed; n++) {
      if (deck.length === 0) {
        if (discard.length === 0) break;
        deck = [...discard].sort(() => random() - 0.5);
        discard = [];
        get().addLog('Deck exhausted — reshuffling discard pile.', 'effect');
      }
      const [card, ...rest] = deck;
      deck = rest;

      // Corruption card: auto-play immediately — never enters hand
      if (card.category === 'EVENT_NEGATIVE' && (card as NegativeEventCard).effect === 'CORRUPTION') {
        corruptionCard = card;
        discard = [...discard, card];
      } else {
        players[actorIndex].hand.push(card);
        drawn++;
      }
    }

    if (corruptionCard) {
      get().addLog(
        `${state.players[actorIndex].name} drew The Corruption — virus unleashed!`,
        'card',
      );
      const actorIsHuman = state.players[actorIndex].isHuman;
      const liveOps = players
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => i !== actorIndex && !p.eliminated);

      if (actorIsHuman && liveOps.length > 0) {
        // Human: show reveal first, then prompt for target selection
        set({ deck, discard, players, phase: 'MAIN', corruptionReveal: true, globalCorruptionMode: true, corruptionPendingTarget: true });
      } else {
        // AI: apply damage to a random live opponent immediately before the reveal
        if (liveOps.length > 0) {
          const { i: ti } = liveOps[Math.floor(random() * liveOps.length)];
          players = players.map((p, i) =>
            i === ti ? { ...p, credits: Math.max(0, p.credits - 10) } : p
          );
        }
        set({ deck, discard, players, phase: 'MAIN', corruptionReveal: true, globalCorruptionMode: true });
      }
    } else {
      set({ deck, discard, players, phase: 'MAIN' });
      get().addLog(
        `${state.players[actorIndex].name} drew ${drawn} card${drawn !== 1 ? 's' : ''}.`,
        'turn',
      );
    }
  },

  selectCard: (id: string | null) => set({ selectedCardId: id }),

  playCard: (cardId: string) => {
    const state = get();
    if (state.phase !== 'MAIN') return;

    const actorIndex = state.currentPlayerIndex;
    const actor = state.players[actorIndex];

    // During an extra play (Multitasking), WAR/COUNTER/Multitasking cards are not allowed
    if (state.extraPlayPending > 0) {
      const card = actor.hand.find(c => c.id === cardId);
      if (!card) return;
      if (
        card.category === 'WAR' ||
        card.category === 'COUNTER' ||
        (card.category === 'EVENT_POSITIVE' && (card as PositiveEventCard).effect === 'EXTRA_PLAY')
      ) return; // silently block — UI should grey these out
    }
    const card = actor.hand.find(c => c.id === cardId);
    if (!card) return;

    const liveOpponents = state.players.filter((p, i) => i !== actorIndex && !p.eliminated);

    // WAR cards — human picks any two live players (including themselves) to go to war
    if (actor.isHuman && card.category === 'WAR') {
      const livePlayers = state.players
        .map((p, i) => ({ id: p.id, name: p.name, playerIndex: i }))
        .filter((_, i) => !state.players[i].eliminated);
      if (livePlayers.length >= 2) {
        set({ warPickPending: { cardId, availablePlayers: livePlayers } });
        return;
      }
    }

    // Human players must select a target for single-target negative event cards
    const needsTarget =
      actor.isHuman &&
      liveOpponents.length > 0 &&
      card.category === 'EVENT_NEGATIVE' &&
      (card as NegativeEventCard).targetsOther;

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

    // Pre-compute updated card-play stats (used in every commit-path set() call below)
    const prevStats = state.gameStats;
    const newCardsPlayed = { ...prevStats.cardsPlayed, [actor.id]: (prevStats.cardsPlayed[actor.id] ?? 0) + 1 };

    // ── Backdoor: human gets to pick which daemon to steal when target has >1 ──
    if (
      actor.isHuman &&
      card.category === 'EVENT_NEGATIVE' &&
      (card as NegativeEventCard).effect === 'STEAL_DAEMON' &&
      targetIndex !== undefined
    ) {
      const targetDaemons = state.players[targetIndex].daemons;
      if (targetDaemons.length > 1) {
        const handAfterBackdoor = actor.hand.filter(c => c.id !== cardId);
        const playersWithoutCard = state.players.map((p, i) =>
          i === actorIndex ? { ...p, hand: handAfterBackdoor } : p
        );
        set({
          players: playersWithoutCard,
          phase: 'MAIN',
          selectedCardId: null,
          pendingCardId: null,
          validTargetIds: [],
          daemonStealPending: { targetIndex, availableDaemons: [...targetDaemons] },
          gameStats: { cardsPlayed: newCardsPlayed, eliminationOrder: prevStats.eliminationOrder },
        });
        get().addLog(`${actor.name} played Backdoor — choose which daemon to steal.`, 'card');
        return;
      }
    }

    // ── Reactive counter opportunity — pause before applying the effect ──────
    // If an AI is about to hit the human with a targeted EVENT_NEGATIVE and the
    // human holds a Quarantine (SHIELD) or Cease & Desist (NEGOTIATE) card,
    // give them a chance to play it reactively before the damage lands.
    if (!_skipCounterCheck && !actor.isHuman && card.category === 'EVENT_NEGATIVE') {
      const neg = card as NegativeEventCard;
      // Quarantine only works against regular hack protocols — not Digital Crusade or M.A.D.
      const quarantineEligible = neg.name !== 'Digital Crusade' && neg.effect !== 'MUTUAL_DAMAGE';
      if (neg.targetsOther && quarantineEligible) {
        const liveOpponents = state.players
          .map((p, i) => ({ p, i }))
          .filter(({ p, i }) => i !== actorIndex && !p.eliminated);
        if (liveOpponents.length > 0) {
          const targetI = liveOpponents[Math.floor(random() * liveOpponents.length)].i;
          const target  = state.players[targetI];
          // Only intercept when the target is human and isn't already auto-shielded
          if (target.isHuman && !target.quarantined && !target.negotiating) {
            // Only SHIELD (Quarantine) can block EVENT_NEGATIVE — Cease & Desist is WAR/Crusade only
            const eligibleCounters = target.hand.filter(c =>
              c.category === 'COUNTER' &&
              (c as CounterCard).counterType === 'SHIELD'
            ) as CounterCard[];
            if (eligibleCounters.length > 0) {
              set({ counterPending: { attackerIndex: actorIndex, cardId, targetIndex: targetI, eligibleCounters } });
              return; // resume via resolveCounterOpportunity
            }
          } else if (!target.isHuman && !target.quarantined) {
            // AI reactive Quarantine — personality-based decision to use a SHIELD card
            const shieldCard = target.hand.find(c =>
              c.category === 'COUNTER' && (c as CounterCard).counterType === 'SHIELD'
            ) as CounterCard | undefined;
            const shouldDefend = shieldCard && (() => {
              switch (target.personality) {
                case 'CAUTIOUS':   return true;
                case 'AGGRESSIVE': return false;
                case 'TACTICAL':   return neg.amount >= 10 || neg.effect === 'STEAL_DAEMON';
                default:           return random() < 0.5;
              }
            })();
            if (shouldDefend && shieldCard) {
              // Consume the AI's Quarantine card, mark them as shielded, then re-apply the attack
              // The quarantined flag means applyCardEffect will absorb and clear it automatically
              const updatedPlayers = state.players.map((p, i) =>
                i === targetI
                  ? { ...p, quarantined: true, hand: p.hand.filter(c => c.id !== shieldCard.id) }
                  : p
              );
              set({ players: updatedPlayers, discard: [...state.discard, shieldCard] });
              get().addLog(
                `${target.name} reactively activated ${shieldCard.name} — incoming attack will be absorbed!`,
                'effect',
              );
              _skipCounterCheck = true;
              get().applyPlayCard(cardId, targetI);
              _skipCounterCheck = false;
              return;
            }
          }
        }
      }
    }

    const handAfter = actor.hand.filter(c => c.id !== cardId);
    let players = state.players.map((p, i) =>
      i === actorIndex ? { ...p, hand: handAfter } : p
    );

    // ── Power Cycle — hard reset: target's credits, daemons, and hand ────────
    if (card.category === 'EVENT_NEGATIVE' && (card as NegativeEventCard).effect === 'POWER_CYCLE') {
      const liveOppIndices = state.players
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => i !== actorIndex && !p.eliminated)
        .map(({ i }) => i);
      const ti = targetIndex ?? (liveOppIndices.length > 0
        ? liveOppIndices[Math.floor(random() * liveOppIndices.length)]
        : -1);
      if (ti !== -1) {
        const target = state.players[ti];
        let deck = [...state.deck];
        // Discard actor's card + target's entire hand
        let discard = [...state.discard, card, ...target.hand];
        // Draw 5 new cards for the target
        const newHand: Card[] = [];
        for (let n = 0; n < 5; n++) {
          if (deck.length === 0) {
            if (discard.length === 0) break;
            deck = [...discard].sort(() => random() - 0.5);
            discard = [];
          }
          const [drawn, ...rest] = deck;
          deck = rest;
          newHand.push(drawn);
        }
        players = players.map((p, i) => {
          if (i === ti) return { ...p, credits: state.startingPop, daemons: [], hand: newHand };
          return p;
        });
        players = markEliminations(players);
        const alive = players.filter(p => !p.eliminated);
        const winnerId = alive.length <= 1 ? (alive[0]?.id ?? null) : null;
        if (alive.length === 1) get().addLog(`${alive[0].name} wins the game!`, 'turn');
        get().addLog(`${actor.name} deployed Power Cycle — ${target.name} reset to ${state.startingPop}¢, daemons purged, hand replaced!`, 'card');
        if (winnerId && !_recordSaved) {
          _recordSaved = true;
          saveGameRecord(
            players.find(p => p.isHuman)?.id === winnerId,
            state.turnNumber,
            state.players.length,
            state.globalCorruptionMode,
          );
        }
        set({
          players, deck, discard, winnerId, extraPlayPending: 0,
          phase: winnerId ? 'GAME_OVER' : (actor.isHuman ? 'END_TURN' : 'MAIN'),
          selectedCardId: null, pendingCardId: null, validTargetIds: [],
          gameStats: {
            cardsPlayed: newCardsPlayed,
            eliminationOrder: winnerId ? [..._eliminationOrder] : prevStats.eliminationOrder,
          },
        });
        if (!winnerId && !actor.isHuman) setTimeout(() => { if (!get().paused) get().advanceTurn(); }, 950);
      }
      return;
    }

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
    const isHumanOverclock =
      actor.isHuman &&
      card.category === 'EVENT_POSITIVE' &&
      (card as PositiveEventCard).effect === 'OVERCLOCK';
    let discard = isHumanOverclock ? [...state.discard] : [...state.discard, card];

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
    if (negotiateBlockedBy) get().addLog(`${negotiateBlockedBy}'s System Interrupt cancelled the attack!`, 'effect');
    if (daemonBlockedBy) get().addLog(`${daemonBlockedBy} blocked the attack!`, 'effect');

    if (humanDmsPending) {
      // Mark AI eliminations now; keep the human's eliminated flag clear until they resolve
      players = markEliminations(players, true);
      set({
        players, discard, globalCorruptionMode,
        phase: 'MAIN',
        selectedCardId: null,
        pendingCardId: null,
        validTargetIds: [],
        deadMansSwitchPending: humanDmsPending,
        gameStats: { cardsPlayed: newCardsPlayed, eliminationOrder: prevStats.eliminationOrder },
      });
      return; // advanceTurn fires after overlay resolves
    }

    players = markEliminations(players);

    const alive = players.filter(p => !p.eliminated);
    const winnerId = alive.length <= 1 ? (alive[0]?.id ?? null) : null;

    if (alive.length === 1) get().addLog(`${alive[0].name} wins the game!`, 'turn');

    const isHuman = state.players[actorIndex]?.isHuman ?? false;

    const isExtraPlayCard =
      card.category === 'EVENT_POSITIVE' &&
      (card as PositiveEventCard).effect === 'EXTRA_PLAY';

    if (isExtraPlayCard && !winnerId) {
      // Multitasking — randomly grant 1 or 2 extra card plays
      const extraCount = Math.floor(random() * 2) + 1;
      set({
        players, discard, globalCorruptionMode,
        extraPlayPending: extraCount,
        phase: 'MAIN',
        selectedCardId: null, pendingCardId: null, validTargetIds: [],
        deadMansSwitchPending: null,
        pendingOverclockCard: state.pendingOverclockCard,
        gameStats: { cardsPlayed: newCardsPlayed, eliminationOrder: prevStats.eliminationOrder },
      });
      get().addLog(`${actor.name} activated Multitasking — ${extraCount} extra play${extraCount > 1 ? 's' : ''} granted!`, 'effect');
      // AI immediately picks a valid extra card (no redraw)
      if (!isHuman) {
        setTimeout(() => {
          if (get().paused) return;
          const s = get();
          const aiActor = s.players[s.currentPlayerIndex];
          const eligibles = aiActor.hand.filter(
            c => c.category !== 'WAR' && c.category !== 'COUNTER' &&
              !(c.category === 'EVENT_POSITIVE' && (c as PositiveEventCard).effect === 'EXTRA_PLAY')
          );
          const card2 = eligibles.length > 0
            ? eligibles[Math.floor(random() * eligibles.length)]
            : null;
          if (!card2) {
            set({ extraPlayPending: 0, phase: 'END_TURN' });
            setTimeout(() => { if (!get().paused) get().advanceTurn(); }, 950);
            return;
          }
          get().applyPlayCard(card2.id, undefined);
        }, 700);
      }
      return;
    }

    // If this card was played as an extra play (from Multitasking), decrement the counter
    const newExtraPlays = (state.extraPlayPending > 0 && !isExtraPlayCard)
      ? state.extraPlayPending - 1
      : 0;

    // Whether the current actor still has more extra plays after this card
    const moreExtraPlays = newExtraPlays > 0 && !winnerId;

    if (winnerId && !_recordSaved) {
      _recordSaved = true;
      saveGameRecord(
        players.find(p => p.isHuman)?.id === winnerId,
        state.turnNumber,
        state.players.length,
        state.globalCorruptionMode || isCorruption,
      );
    }

    set({
      players, discard, globalCorruptionMode, winnerId,
      extraPlayPending: newExtraPlays,
      phase: alive.length <= 1 ? 'GAME_OVER' : (moreExtraPlays ? 'MAIN' : (isHuman ? 'END_TURN' : 'MAIN')),
      selectedCardId: null,
      pendingCardId: null,
      validTargetIds: [],
      deadMansSwitchPending: null,
      pendingOverclockCard: isHumanOverclock ? card : state.pendingOverclockCard,
      gameStats: {
        cardsPlayed: newCardsPlayed,
        eliminationOrder: winnerId ? [..._eliminationOrder] : prevStats.eliminationOrder,
      },
    });

    // AI continues — either play another extra card or advance turn
    if (!winnerId && !isHuman) {
      if (moreExtraPlays) {
        setTimeout(() => {
          if (get().paused) return;
          const s = get();
          const aiActor = s.players[s.currentPlayerIndex];
          const eligibles = aiActor.hand.filter(
            c => c.category !== 'WAR' && c.category !== 'COUNTER' &&
              !(c.category === 'EVENT_POSITIVE' && (c as PositiveEventCard).effect === 'EXTRA_PLAY')
          );
          const card2 = eligibles.length > 0
            ? eligibles[Math.floor(random() * eligibles.length)]
            : null;
          if (!card2) {
            set({ extraPlayPending: 0, phase: 'END_TURN' });
            setTimeout(() => { if (!get().paused) get().advanceTurn(); }, 950);
            return;
          }
          get().applyPlayCard(card2.id, undefined);
        }, 700);
      } else {
        setTimeout(() => { if (!get().paused) get().advanceTurn(); }, 950);
      }
    }
  },

  selectTarget: (targetId: string) => {
    const state = get();
    if (state.phase !== 'TARGETING') return;
    const targetIndex = state.players.findIndex(p => p.id === targetId);
    if (targetIndex === -1) return;

    // Corruption targeting — card is already discarded, apply damage directly
    if (state.corruptionPendingTarget) {
      const actorIndex = state.currentPlayerIndex;
      const targetName = state.players[targetIndex].name;
      let players = state.players.map((p, i) =>
        i === targetIndex ? { ...p, credits: Math.max(0, p.credits - 10) } : p
      );
      get().addLog(`${state.players[actorIndex].name} unleashed The Corruption — ${targetName} loses 10¢`, 'effect');
      players = markEliminations(players);
      const alive = players.filter(p => !p.eliminated);
      const winnerId = alive.length <= 1 ? (alive[0]?.id ?? null) : null;
      if (alive.length === 1) get().addLog(`${alive[0].name} wins the game!`, 'turn');
      set({
        players,
        phase: winnerId ? 'GAME_OVER' : 'END_TURN',
        selectedCardId: null,
        pendingCardId: null,
        validTargetIds: [],
        corruptionPendingTarget: false,
        winnerId,
      });
      return;
    }

    if (!state.pendingCardId) return;
    get().applyPlayCard(state.pendingCardId, targetIndex);
  },

  cancelTargeting: () => {
    const state = get();
    if (state.phase !== 'TARGETING') return;
    // Corruption targeting cannot be cancelled
    if (state.corruptionPendingTarget) return;
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
    players = markEliminations(players);
    const alive = players.filter(p => !p.eliminated);
    const winnerId = alive.length <= 1 ? (alive[0]?.id ?? null) : null;
    if (alive.length === 1) get().addLog(`${alive[0].name} wins the game!`, 'turn');

    const humanResolved = state.players[state.deadMansSwitchPending.playerIndex]?.isHuman ?? false;

    if (winnerId && !_recordSaved) {
      _recordSaved = true;
      saveGameRecord(
        players.find(p => p.isHuman)?.id === winnerId,
        state.turnNumber,
        state.players.length,
        state.globalCorruptionMode,
      );
    }

    set({
      players, discard, winnerId,
      phase: alive.length <= 1 ? 'GAME_OVER' : (humanResolved ? 'END_TURN' : 'MAIN'),
      deadMansSwitchPending: null,
      gameStats: winnerId
        ? { ...state.gameStats, eliminationOrder: [..._eliminationOrder] }
        : state.gameStats,
    });

    if (!winnerId && !humanResolved) setTimeout(() => { if (!get().paused) get().advanceTurn(); }, 950);
  },

  resolveDaemonSteal: (daemon) => {
    const state = get();
    if (!state.daemonStealPending) return;
    const { targetIndex, availableDaemons } = state.daemonStealPending;
    const actorIndex = state.currentPlayerIndex;

    const stolen = daemon ?? availableDaemons[0]; // null = skip (no daemons to steal)
    let players = state.players.map((p, i) => {
      if (i === targetIndex)
        return { ...p, daemons: p.daemons.filter(d => d !== stolen) };
      if (i === actorIndex && !p.daemons.includes(stolen))
        return { ...p, daemons: [...p.daemons, stolen] };
      return p;
    });

    if (daemon) {
      get().addLog(`${state.players[actorIndex].name} stole ${stolen} from ${state.players[targetIndex].name}.`, 'effect');
    }

    players = markEliminations(players);
    const alive = players.filter(p => !p.eliminated);
    const winnerId = alive.length === 1 ? alive[0].id : null;

    if (winnerId && !_recordSaved) {
      _recordSaved = true;
      saveGameRecord(
        players.find(p => p.isHuman)?.id === winnerId,
        state.turnNumber,
        state.players.length,
        state.globalCorruptionMode,
      );
    }

    set({
      players,
      winnerId,
      phase: winnerId ? 'GAME_OVER' : 'END_TURN',
      daemonStealPending: null,
      gameStats: winnerId
        ? { ...state.gameStats, eliminationOrder: [..._eliminationOrder] }
        : state.gameStats,
    });
  },

  resolveWarPick: (p1Index: number, p2Index: number) => {
    const state = get();
    if (!state.warPickPending) return;
    const { cardId } = state.warPickPending;

    const actorIndex = state.currentPlayerIndex;
    const actor = state.players[actorIndex];
    const card = actor.hand.find(c => c.id === cardId);
    if (!card) return;

    const warCard = card as import('../types/cards').WarCard;

    // Remove WAR card from actor's hand and add to discard
    const handAfter = actor.hand.filter(c => c.id !== cardId);
    let players = state.players.map((p, i) =>
      i === actorIndex ? { ...p, hand: handAfter } : p
    );
    let discard = [...state.discard, card];

    // ── Auto-process AI combatants' pre-war cards ──────────────────────────────
    const autoPlayPreWar = (pi: number, pls: PlayerState[], dis: Card[]): [PlayerState[], Card[]] => {
      const p = pls[pi];
      const surgeCards = p.hand.filter(
        c => c.category === 'COUNTER' && (c as CounterCard).counterType === 'TACTICAL_ADVANTAGE'
      );
      // AGGRESSIVE / TACTICAL: play all surge cards. CAUTIOUS: none. Others: play one.
      const toPlay = (p.personality === 'AGGRESSIVE' || p.personality === 'TACTICAL')
        ? surgeCards
        : p.personality === 'CAUTIOUS' ? []
        : surgeCards.slice(0, 1);
      if (toPlay.length === 0) return [pls, dis];
      const playIds = new Set(toPlay.map(c => c.id));
      const newPls = pls.map((q, i) => i === pi
        ? { ...q, hand: q.hand.filter(c => !playIds.has(c.id)), tacticalBonus: q.tacticalBonus + toPlay.length }
        : q
      );
      const newDis = [...dis, ...toPlay];
      get().addLog(
        `${p.name} plays ${toPlay.length} Firewall Surge${toPlay.length > 1 ? 's' : ''} — +${toPlay.length} to roll`,
        'effect',
      );
      return [newPls, newDis];
    };

    const isP1Human = state.players[p1Index].isHuman;
    const isP2Human = state.players[p2Index].isHuman;

    if (!isP1Human) [players, discard] = autoPlayPreWar(p1Index, players, discard);
    if (!isP2Human) [players, discard] = autoPlayPreWar(p2Index, players, discard);

    // If both AI — resolve the war immediately (no overlay needed)
    if (!isP1Human && !isP2Human) {
      set({ players, discard, warPickPending: null, selectedCardId: null });
      get().finalizeWarResolution(warCard, p1Index, p2Index);
      return;
    }

    // At least one human combatant — open pre-war overlay for their step
    const step: 1 | 2 = isP1Human ? 1 : 2;
    set({
      players, discard,
      warPickPending: null,
      selectedCardId: null,
      warPrePending: { card: warCard, p1Index, p2Index, step },
    });
  },

  cancelWarPick: () => set({ warPickPending: null, selectedCardId: null }),

  playWarPreCard: (cardId: string) => {
    const state = get();
    if (!state.warPrePending) return;
    const { p1Index, p2Index, step } = state.warPrePending;
    const combatantIndex = step === 1 ? p1Index : p2Index;

    const combatant = state.players[combatantIndex];
    const card = combatant.hand.find(c => c.id === cardId);
    if (!card || card.category !== 'COUNTER') return;

    const cnt = card as CounterCard;

    // Remove from combatant's hand and discard
    let players = state.players.map((p, i) =>
      i === combatantIndex ? { ...p, hand: p.hand.filter(c => c.id !== cardId) } : p
    );
    const discard = [...state.discard, card];

    if (cnt.counterType === 'TACTICAL_ADVANTAGE') {
      // Stack bonus on this combatant
      players = players.map((p, i) =>
        i === combatantIndex ? { ...p, tacticalBonus: p.tacticalBonus + 1 } : p
      );
      set({ players, discard });
      get().addLog(
        `${combatant.name} plays Firewall Surge — roll bonus now +${players[combatantIndex].tacticalBonus}`,
        'effect',
      );
    } else if (cnt.counterType === 'NEGOTIATE') {
      // Cease & Desist — cancel the war entirely
      set({ players, discard, warPrePending: null, selectedCardId: null, phase: 'END_TURN' });
      get().addLog(`${combatant.name} plays Cease & Desist — war cancelled!`, 'effect');
    }
  },

  passWarPre: () => {
    const state = get();
    if (!state.warPrePending) return;
    const { card, p1Index, p2Index } = state.warPrePending;
    set({ warPrePending: null });
    get().finalizeWarResolution(card, p1Index, p2Index);
  },

  cancelWarPre: () => {
    // Abort mid-pre-war — return to MAIN (WAR card was already discarded)
    set({ warPrePending: null, selectedCardId: null, phase: 'END_TURN' });
  },

  // ── Reactive counter resolution ────────────────────────────────────────────
  resolveCounterOpportunity: (counterCardId: string | null) => {
    const state = get();
    const pending = state.counterPending;
    if (!pending) return;

    const { attackerIndex, cardId, targetIndex } = pending;

    if (counterCardId === null) {
      // Human chose to allow the attack — re-run applyPlayCard with skip flag
      // and the pre-resolved target so the effect applies normally.
      set({ counterPending: null });
      _skipCounterCheck = true;
      get().applyPlayCard(cardId, targetIndex);
      _skipCounterCheck = false;
    } else {
      // Human played a counter card — block the attack entirely.
      const attacker  = state.players[attackerIndex];
      const attackCard = attacker?.hand.find(c => c.id === cardId);
      const human     = state.players.find(p => p.isHuman);
      const counterCard = human?.hand.find(c => c.id === counterCardId) as CounterCard | undefined;
      if (!attackCard || !counterCard) { set({ counterPending: null }); return; }

      // Remove both cards from their owners' hands
      let players = state.players.map((p, i) => {
        if (i === attackerIndex) return { ...p, hand: p.hand.filter(c => c.id !== cardId) };
        if (p.isHuman)           return { ...p, hand: p.hand.filter(c => c.id !== counterCardId) };
        return p;
      });

      const discard = [...state.discard, attackCard, counterCard];

      set({
        players,
        discard,
        counterPending: null,
        phase: 'MAIN',
        selectedCardId: null,
        validTargetIds: [],
      });

      get().addLog(`${attacker.name} played ${attackCard.name} — blocked by ${human!.name}'s ${counterCard.name}!`, 'effect');

      // Resume the AI's turn
      setTimeout(() => { if (!get().paused) get().advanceTurn(); }, 950);
    }
  },

  finalizeWarResolution: (warCard: import('../types/cards').WarCard, p1Index: number, p2Index: number) => {
    const state = get();
    const actorIndex = state.currentPlayerIndex;
    let players = state.players;
    let discard = state.discard;

    _warRollResult = null;
    _negotiateBlockedBy = null;
    players = applyCardEffect(warCard, players, p1Index, p2Index);
    const negotiateBlockedBy = _negotiateBlockedBy;
    _negotiateBlockedBy = null;

    get().addLog(cardLogText(warCard, state.players[actorIndex].name), 'card');
    _warRollResult = null;
    if (negotiateBlockedBy) get().addLog(`${negotiateBlockedBy}'s Cease & Desist cancelled the war!`, 'effect');

    // Dead Man's Switch check
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
          if (!humanDmsPending) humanDmsPending = { playerIndex: i, eligibleCards };
        } else {
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

    if (humanDmsPending) {
      players = markEliminations(players, true);
      set({
        players, discard,
        phase: 'MAIN',
        selectedCardId: null,
        pendingCardId: null,
        validTargetIds: [],
        deadMansSwitchPending: humanDmsPending,
      });
      return;
    }

    players = markEliminations(players);
    const alive = players.filter(p => !p.eliminated);
    const winnerId = alive.length === 1 ? alive[0].id : null;
    if (winnerId) get().addLog(`${alive[0].name} wins the game!`, 'turn');

    // Track war card as played by the initiating actor
    const actorId = state.players[actorIndex]?.id;
    const prevStatsWar = state.gameStats;
    const warCardsPlayed = actorId
      ? { ...prevStatsWar.cardsPlayed, [actorId]: (prevStatsWar.cardsPlayed[actorId] ?? 0) + 1 }
      : prevStatsWar.cardsPlayed;

    if (winnerId && !_recordSaved) {
      _recordSaved = true;
      saveGameRecord(
        players.find(p => p.isHuman)?.id === winnerId,
        state.turnNumber,
        state.players.length,
        state.globalCorruptionMode,
      );
    }

    set({
      players, discard, winnerId,
      phase: winnerId ? 'GAME_OVER' : 'END_TURN',
      selectedCardId: null,
      pendingCardId: null,
      validTargetIds: [],
      gameStats: {
        cardsPlayed: warCardsPlayed,
        eliminationOrder: winnerId ? [..._eliminationOrder] : prevStatsWar.eliminationOrder,
      },
    });
  },

  discardCard: (cardId: string) => {
    const state = get();
    if (state.phase !== 'MAIN') return;

    const actorIndex = state.currentPlayerIndex;
    const actor = state.players[actorIndex];
    const card = actor.hand.find(c => c.id === cardId);
    if (!card) return;

    // The Corruption cannot be discarded — it must be played
    if (card.category === 'EVENT_NEGATIVE' && (card as NegativeEventCard).effect === 'CORRUPTION') return;

    const handAfter = actor.hand.filter(c => c.id !== cardId);
    const players = state.players.map((p, i) =>
      i === actorIndex ? { ...p, hand: handAfter } : p
    );
    const discard = [...state.discard, card];

    set({ players, discard, selectedCardId: null, extraPlayPending: 0, phase: 'END_TURN' });
    get().addLog(`${actor.name} discarded ${card.name}.`, 'card');
  },

  cancelExtraPlays: () => {
    const state = get();
    if (state.phase !== 'MAIN' || state.extraPlayPending === 0) return;
    const actor = state.players[state.currentPlayerIndex];
    if (!actor.isHuman) return; // AI never calls this
    set({ extraPlayPending: 0, phase: 'END_TURN', selectedCardId: null });
    get().addLog(`${actor.name} ended Multitasking early.`, 'effect');
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
      setTimeout(() => { if (!get().paused) get().triggerRoll(); }, 900);
    }
  },

  triggerRoll: () => {
    if (get().phase !== 'PHASE_ROLL') return;
    set({ rollTriggered: true });
  },

  corruptionRevealComplete: () => {
    const state = get();
    if (state.corruptionPendingTarget) {
      // Human drew The Corruption — reveal done, now pick a target
      const actorIndex = state.currentPlayerIndex;
      const liveOpponents = state.players.filter((p, i) => i !== actorIndex && !p.eliminated);
      set({
        corruptionReveal: false,
        phase: 'TARGETING',
        validTargetIds: liveOpponents.map(p => p.id),
      });
    } else {
      set({ corruptionReveal: false });
    }
  },

  rollComplete: () => {
    const state = get();
    if (state.phase !== 'PHASE_ROLL') return;

    const [r1, r2] = state.rollResult ?? [3, 3];
    const total = r1 + r2;
    const actorIndex = state.currentPlayerIndex;
    let players = state.players;

    const inCorruption = state.globalCorruptionMode;

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

    const ocDiscard = (isOverclocked && state.pendingOverclockCard)
      ? [...state.discard, state.pendingOverclockCard]
      : state.discard;
    set({ rollTriggered: false, players, discard: ocDiscard, pendingOverclockCard: null });

    const actor = players[actorIndex];

    // ── Actor eliminated by this roll — skip draw, handle DMS / game-over ────
    if (actor.credits <= 0) {
      let discard = [...state.discard];
      let humanDmsPending: { playerIndex: number; eligibleCards: NegativeEventCard[] } | null = null;

      if (state.deadMansSwitch) {
        const eligibleCards = actor.hand.filter(
          c => c.category === 'EVENT_NEGATIVE' && (c as NegativeEventCard).targetsOther
        ) as NegativeEventCard[];

        if (eligibleCards.length > 0) {
          if (actor.isHuman) {
            humanDmsPending = { playerIndex: actorIndex, eligibleCards };
          } else {
            const lastCard = eligibleCards[Math.floor(random() * eligibleCards.length)];
            players = players.map((p, idx) =>
              idx === actorIndex ? { ...p, hand: p.hand.filter(c => c.id !== lastCard.id) } : p
            );
            players = applyCardEffect(lastCard, players, actorIndex);
            discard = [...discard, lastCard];
            get().addLog(`💀 ${actor.name} triggers Dead Man's Switch — plays ${lastCard.name}!`, 'effect');
          }
        }
      }

      if (humanDmsPending) {
        players = players.map(p => ({
          ...p,
          eliminated: p.eliminated || (!p.isHuman && p.credits <= 0),
        }));
        set({ players, discard, rollTriggered: false, phase: 'MAIN', deadMansSwitchPending: humanDmsPending });
        return;
      }

      players = players.map(p => {
        if (!p.eliminated && p.credits <= 0) {
          if (!_eliminationOrder.includes(p.id)) _eliminationOrder.push(p.id);
          return { ...p, eliminated: true, daemons: [] };
        }
        return p;
      });
      const alive = players.filter(p => !p.eliminated);
      const winnerId = alive.length <= 1 ? (alive[0]?.id ?? null) : null;
      if (alive.length === 1) get().addLog(`${alive[0].name} wins the game!`, 'turn');

      if (winnerId && !_recordSaved) {
        _recordSaved = true;
        saveGameRecord(
          players.find(p => p.isHuman)?.id === winnerId,
          state.turnNumber,
          state.players.length,
          state.globalCorruptionMode,
        );
      }

      set({
        players, discard, rollTriggered: false, winnerId,
        phase: alive.length <= 1 ? 'GAME_OVER' : 'PHASE_ROLL',
        gameStats: winnerId
          ? { ...state.gameStats, eliminationOrder: [..._eliminationOrder] }
          : state.gameStats,
      });
      if (alive.length > 1) setTimeout(() => { if (!get().paused) get().advanceTurn(); }, 950);
      return;
    }

    // ── Normal flow — actor still alive, proceed to draw / AI card phase ─────
    if (actor.isHuman) {
      set({ phase: 'DRAW' });
    } else {
      setTimeout(() => { if (!get().paused) get().runAiTurn(); }, 400);
    }
  },

  runAiTurn: () => {
    if (get().paused) return; // ← guard: don't start a new AI turn while paused
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
      if (!get().paused) get().advanceTurn();
      return;
    }

    set({ deck, discard, players, phase: 'MAIN' });

    setTimeout(() => {
      if (get().paused) return; // ← guard: paused between draw and card pick
      const currentState = get();
      const currentActor = currentState.players[currentState.currentPlayerIndex];
      const card = pickAiCard(currentActor, currentState.players, currentState.currentPlayerIndex, currentState.startingPop);
      if (!card) {
        if (!get().paused) get().advanceTurn();
        return;
      }
      // AI skips the TARGETING phase — applyPlayCard picks a random target internally
      get().applyPlayCard(card.id, undefined);
    }, 700);
  },
}));
