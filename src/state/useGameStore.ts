// src/state/useGameStore.ts
import { create } from 'zustand';
import type { GameState, PlayerState, LogEntry, AIPersonality } from '../types/gameState';
import type { Card, CreditsCard, PositiveEventCard, NegativeEventCard, WarCard, DaemonCard, CounterCard } from '../types/cards';
import { initRNG, random } from '../lib/rng';
import { generateDeck } from '../data/deck';
import { trackEvent } from '../lib/analytics';

// ── Corruption-first constraint ───────────────────────────────────────────────
// If a player has The Corruption card in their starting hand (cardsPlayed === 0),
// they must play it as their very first card — all other cards are locked.
export function mustPlayCorruptionFirst(
  player: PlayerState,
  gameStats: GameState['gameStats'],
): boolean {
  if ((gameStats.cardsPlayed[player.id] ?? 0) !== 0) return false;
  return player.hand.some(
    c => c.category === 'EVENT_NEGATIVE' && (c as NegativeEventCard).effect === 'CORRUPTION',
  );
}

// ── Elimination helper ────────────────────────────────────────────────────────

function markEliminations(
  players: PlayerState[],
  eliminationOrder: string[],
  keepHumanAlive = false,
): { players: PlayerState[]; eliminationOrder: string[] } {
  let order = eliminationOrder;
  const updated = players.map(p => {
    if (p.eliminated) return p;
    const shouldEliminate = p.credits <= 0 && (!keepHumanAlive || !p.isHuman);
    if (shouldEliminate) {
      if (!order.includes(p.id)) order = [...order, p.id];
      return { ...p, eliminated: true, daemons: [] };
    }
    return p;
  });
  return { players: updated, eliminationOrder: order };
}

// ── AI timer scheduler ────────────────────────────────────────────────────────

const _aiTimers = new Set<ReturnType<typeof setTimeout>>();
function scheduleAi(fn: () => void, delay: number): void {
  const id = setTimeout(() => { _aiTimers.delete(id); fn(); }, delay);
  _aiTimers.add(id);
}
function cancelAllAiTimers(): void { _aiTimers.forEach(clearTimeout); _aiTimers.clear(); }

// ── Card effect result ────────────────────────────────────────────────────────

type WarRollSnapshot = { actorRoll: number; actorBase: number; actorBonus: number; targetRoll: number; targetBase: number; targetBonus: number; actorWins: boolean; isTie?: boolean; tieCycleLoss?: number; targetName: string };
type CardEffectResult = {
  players: PlayerState[];
  quarantineBlockedBy: string | null;
  negotiateBlockedBy: string | null;
  daemonImmunityBlockedBy: string | null;
  warRollResult: WarRollSnapshot | null;
  lastTargetName: string | null;
};

// ── AI turn pacing (ms) ───────────────────────────────────────────────────────
const AI_ROLL_DELAY    = 1600; // standby on PHASE_ROLL before triggering the roll
const AI_DRAW_DELAY    = 900;  // gap between roll-complete and the draw/play phase
const AI_CARD_DELAY    = 1300; // gap between drawing cards and picking one to play
const AI_ADVANCE_DELAY = 1400; // pause after a card resolves before the next turn

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
function applyCardEffect(card: Card, players: PlayerState[], actorIndex: number, targetIndex?: number, warTiePenalty?: boolean): CardEffectResult {
  const noFx = (p: PlayerState[]): CardEffectResult => ({
    players: p,
    quarantineBlockedBy: null,
    negotiateBlockedBy: null,
    daemonImmunityBlockedBy: null,
    warRollResult: null,
    lastTargetName: null,
  });

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
      return noFx(players.map((p, i) =>
        i === actorIndex
          ? { ...p, credits: Math.min(200, p.credits + (card as CreditsCard).amount) }
          : p
      ));

    case 'EVENT_POSITIVE': {
      const pos = card as PositiveEventCard;
      if (pos.effect === 'DRAIN_ALL') {
        // All live opponents each lose `amount`; actor gains amount × opponent count
        const liveCount = liveOpponents.length;
        const drained = players.map((p, i) =>
          (i === actorIndex || p.eliminated) ? p : { ...p, credits: Math.max(0, p.credits - pos.amount) }
        );
        return noFx(drained.map((p, i) =>
          i === actorIndex ? { ...p, credits: Math.min(200, p.credits + pos.amount * liveCount) } : p
        ));
      }
      // OVERCLOCK — mark actor so their next Stability Roll is doubled
      if (pos.effect === 'OVERCLOCK') {
        return noFx(players.map((p, i) => i === actorIndex ? { ...p, overclocked: true } : p));
      }
      return noFx(players.map((p, i) =>
        i === actorIndex ? { ...p, credits: Math.min(200, p.credits + pos.amount) } : p
      ));
    }

    case 'EVENT_NEGATIVE': {
      const neg = card as NegativeEventCard;

      // DAMAGE_ALL_DAEMON — hits every live opponent, no specific target (e.g. Network Storm)
      if (neg.effect === 'DAMAGE_ALL_DAEMON') {
        return noFx(players.map((p, i) => {
          if (i === actorIndex || p.eliminated) return p;
          const imps = [...p.daemons];
          if (imps.length > 0) imps.splice(Math.floor(random() * imps.length), 1);
          return { ...p, credits: Math.max(0, p.credits - neg.amount), daemons: imps };
        }));
      }

      if (!neg.targetsOther || liveOpponents.length === 0) return noFx(players);
      const ti = resolveTarget();
      if (ti === -1) return noFx(players);
      const lastTargetName = players[ti].name;

      // Quarantine — the target's shield absorbs the attack and is consumed.
      // Does NOT block Digital Crusade or M.A.D. (those require Cease & Desist or nothing).
      if (
        players[ti].quarantined &&
        neg.name !== 'Digital Crusade' &&
        neg.effect !== 'MUTUAL_DAMAGE'
      ) {
        return {
          ...noFx(players.map((p, i) => i === ti ? { ...p, quarantined: false } : p)),
          quarantineBlockedBy: players[ti].name,
          lastTargetName,
        };
      }
      // Daemon immunity — target's daemon type blocks this specific card entirely
      if (neg.immuneDaemon && players[ti].daemons.includes(neg.immuneDaemon)) {
        return {
          ...noFx(players),
          daemonImmunityBlockedBy: `${players[ti].name}'s ${neg.immuneDaemon.replace('_', ' ')}`,
          lastTargetName,
        };
      }

      // STEAL — actor gains amount, target loses amount (e.g. Signal Theft / Pied Piper)
      if (neg.effect === 'STEAL') {
        return {
          ...noFx(players.map((p, i) => {
            if (i === actorIndex) return { ...p, credits: Math.min(200, p.credits + neg.amount) };
            if (i === ti)         return { ...p, credits: Math.max(0, p.credits - neg.amount) };
            return p;
          })),
          lastTargetName,
        };
      }

      // MUTUAL_DAMAGE — both actor and target take the hit (e.g. M.A.D.)
      if (neg.effect === 'MUTUAL_DAMAGE') {
        return {
          ...noFx(players.map((p, i) => {
            if (i === actorIndex || i === ti)
              return { ...p, credits: Math.max(0, p.credits - neg.amount) };
            return p;
          })),
          lastTargetName,
        };
      }

      // STEAL_DAEMON — take one random daemon from target, add to actor if not already held.
      // Prefer daemons the actor doesn't own yet; fall back to any if all are duplicates.
      if (neg.effect === 'STEAL_DAEMON') {
        const targetImps = players[ti].daemons;
        if (targetImps.length === 0) return { ...noFx(players), lastTargetName };
        const preferredImps = targetImps.filter(imp => !players[actorIndex].daemons.includes(imp));
        const stealPool = preferredImps.length > 0 ? preferredImps : targetImps;
        const stolen = stealPool[Math.floor(random() * stealPool.length)];
        return {
          ...noFx(players.map((p, i) => {
            if (i === ti)
              return { ...p, daemons: p.daemons.filter(imp => imp !== stolen) };
            if (i === actorIndex && !p.daemons.includes(stolen))
              return { ...p, daemons: [...p.daemons, stolen] };
            return p;
          })),
          lastTargetName,
        };
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
      return { ...noFx(next), lastTargetName };
    }

    case 'WAR': {
      const w = card as WarCard;
      if (liveOpponents.length === 0) return noFx(players);
      const ti = resolveTarget();
      if (ti === -1) return noFx(players);
      const lastTargetName = players[ti].name;
      // Cease & Desist — target's diplomatic block cancels the war entirely
      if (players[ti].negotiating) {
        return {
          ...noFx(players.map((p, i) => i === ti ? { ...p, negotiating: false } : p)),
          negotiateBlockedBy: players[ti].name,
          lastTargetName,
        };
      }
      // Roll 1d6 for each side; Firewall Surge (tacticalBonus) adds +N to each player's roll.
      const actorBonus  = players[actorIndex].tacticalBonus;
      const targetBonus = players[ti].tacticalBonus;
      const actorBase  = Math.floor(random() * 6) + 1;
      const targetBase = Math.floor(random() * 6) + 1;
      const actorRoll  = actorBase + actorBonus;
      const targetRoll = targetBase + targetBonus;
      const isTie = actorRoll === targetRoll;
      const actorWins = !isTie && actorRoll > targetRoll;
      // Tie: both lose the winner's cycle amount when warTiePenalty is on, otherwise no loss.
      const tieCycleLoss = isTie ? (warTiePenalty ? w.winnerLoses : 0) : undefined;
      const warRollResult: WarRollSnapshot = { actorRoll, actorBase, actorBonus, targetRoll, targetBase, targetBonus, actorWins, isTie, tieCycleLoss, targetName: players[ti].name };
      // Determine credit losses — ties use tieCycleLoss (0 if penalty off), wins use normal schedule
      let actorLoss  = isTie ? (tieCycleLoss ?? 0) : (actorWins ? w.winnerLoses : w.loserLoses);
      let targetLoss = isTie ? (tieCycleLoss ?? 0) : (actorWins ? w.loserLoses  : w.winnerLoses);
      // Hardened Node — reduces the loser's credit loss by 5 (min 0); no effect on ties
      if (!isTie && !actorWins && players[actorIndex].daemons.includes('HARDENED_NODE'))
        actorLoss = Math.max(0, actorLoss - 5);
      if (!isTie && actorWins && players[ti].daemons.includes('HARDENED_NODE'))
        targetLoss = Math.max(0, targetLoss - 5);
      return {
        ...noFx(players.map((p, i) => {
          if (i === actorIndex) {
            return { ...p, credits: Math.max(0, p.credits - actorLoss), tacticalBonus: 0 };
          }
          if (i === ti) {
            return { ...p, credits: Math.max(0, p.credits - targetLoss), tacticalBonus: 0 };
          }
          return p;
        })),
        warRollResult,
        lastTargetName,
      };
    }

    case 'DAEMON': {
      const imp = card as DaemonCard;
      const actor = players[actorIndex];
      if (actor.daemons.includes(imp.daemonType)) return noFx(players);
      return noFx(players.map((p, i) =>
        i === actorIndex ? { ...p, daemons: [...p.daemons, imp.daemonType] } : p
      ));
    }

    case 'COUNTER': {
      const cnt = card as CounterCard;
      // SHIELD (Quarantine) — played via resolveCounterOpportunity which cancels the war
      // directly; this applyCardEffect path is a no-op fallback.
      if (cnt.counterType === 'SHIELD') {
        return noFx(players);
      }
      // TACTICAL_ADVANTAGE (Firewall Surge) — adds +1 to the next WAR roll (stackable)
      if (cnt.counterType === 'TACTICAL_ADVANTAGE') {
        return noFx(players.map((p, i) => i === actorIndex ? { ...p, tacticalBonus: p.tacticalBonus + 1 } : p));
      }
      // NEGOTIATE (Cease & Desist) — block the next WAR or EVENT_NEGATIVE targeting this player
      // NEGOTIATE (System Interrupt) — block the next WAR or Digital Crusade targeting this player
      if (cnt.counterType === 'NEGOTIATE') {
        return noFx(players.map((p, i) => i === actorIndex ? { ...p, negotiating: true } : p));
      }
      return noFx(players);
    }

    default:
      return noFx(players);
  }
}

function pickAiCard(
  ai: PlayerState,
  allPlayers: PlayerState[],
  actorIndex: number,
  startingPop: number,
  gameStats: GameState['gameStats'],
): Card | null {
  if (ai.hand.length === 0) return null;

  // Corruption-first constraint: if AI has The Corruption and hasn't played yet, must play it.
  if (mustPlayCorruptionFirst(ai, gameStats)) {
    return ai.hand.find(
      c => c.category === 'EVENT_NEGATIVE' && (c as NegativeEventCard).effect === 'CORRUPTION',
    ) ?? null;
  }

  const liveOpponents = allPlayers.filter((p, i) => i !== actorIndex && !p.eliminated);

  // Pre-compute useful hand lookups
  const powerCycleCard = ai.hand.find(c =>
    c.category === 'EVENT_NEGATIVE' && (c as NegativeEventCard).effect === 'POWER_CYCLE'
  );
  const multiThreadCard = ai.hand.find(c =>
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

  // Is there a high-impact follow-up card for after Multitask?
  const hasGoodFollowUp = ai.hand.some(c =>
    c.category === 'EVENT_NEGATIVE' && (c as NegativeEventCard).amount >= 10
  );

  // COUNTER cards are reactive by design — never play them as a generic fallback.
  // Explicit personality branches may still choose specific counter types intentionally.
  const nonCounterHand = ai.hand.filter(c => c.category !== 'COUNTER');
  const anyCard = nonCounterHand.length > 0
    ? nonCounterHand[Math.floor(random() * nonCounterHand.length)]
    : ai.hand[0] ?? null;

  switch (ai.personality) {
    case 'AGGRESSIVE': {
      // Use Power Cycle if target is significantly ahead AND has daemons
      if (powerCycleCard && richestOpponent &&
          richestOpponent.credits > startingPop * 1.3 &&
          richestOpponent.daemons.length > 0) {
        return powerCycleCard;
      }
      return ai.hand.find(c => c.category === 'WAR')
        ?? ai.hand.find(c => c.category === 'EVENT_NEGATIVE')
        ?? nonCounterHand[0] ?? ai.hand[0];
    }
    case 'CAUTIOUS':
      return ai.hand.find(c => c.category === 'DAEMON')
        ?? ai.hand.find(c => c.category === 'CREDITS')
        ?? nonCounterHand[0] ?? ai.hand[0];
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
          if (pos.effect === 'EXTRA_PLAY') return hasGoodFollowUp ? 15 : 0;
          return pos.amount;
        }
        if (c.category === 'CREDITS') return (c as CreditsCard).amount;
        if (c.category === 'DAEMON') return 8;
        return 0; // COUNTER cards score 0 — effectively excluded from proactive picks
      };
      return [...ai.hand].sort((a, b) => score(b) - score(a))[0];
    }
    case 'BALANCED': {
      // Desperate recovery: critically low credits → prioritise income first
      if (ai.credits < 15) {
        return ai.hand.find(c => c.category === 'CREDITS')
          ?? ai.hand.find(c =>
              c.category === 'EVENT_POSITIVE' &&
              (c as PositiveEventCard).effect !== 'OVERCLOCK' &&
              (c as PositiveEventCard).effect !== 'EXTRA_PLAY'
            )
          ?? nonCounterHand[0] ?? ai.hand[0];
      }
      // Opportunistic Power Cycle only when the target is a clear runaway leader
      if (powerCycleCard && powerCycleScore >= 30) return powerCycleCard;
      // Multitask when a high-damage follow-up exists
      if (multiThreadCard && hasGoodFollowUp && random() < 0.5) return multiThreadCard;
      // Adaptive: if behind → build resources; if ahead → press the attack
      const isAhead = richestOpponent ? ai.credits >= richestOpponent.credits : true;
      if (!isAhead) {
        return ai.hand.find(c => c.category === 'DAEMON')
          ?? ai.hand.find(c => c.category === 'CREDITS')
          ?? ai.hand.find(c => c.category === 'EVENT_POSITIVE')
          ?? nonCounterHand[0] ?? ai.hand[0];
      }
      if (random() < 0.65) {
        return ai.hand.find(c => c.category === 'EVENT_NEGATIVE')
          ?? ai.hand.find(c => c.category === 'WAR')
          ?? nonCounterHand[0] ?? ai.hand[0];
      }
      return anyCard;
    }
    default:
      return anyCard;
  }
}

function cardLogText(card: Card, actorName: string, lastTargetName: string | null, warRollResult: WarRollSnapshot | null): string {
  switch (card.category) {
    case 'CREDITS':
      return `${actorName} ran ${card.name} (+${(card as CreditsCard).amount} cycles)`;
    case 'EVENT_POSITIVE': {
      const pos = card as PositiveEventCard;
      if (pos.effect === 'DRAIN_ALL')
        return `${actorName} deployed ${card.name} (drained ${pos.amount} cycles from every opponent)`;
      if (pos.effect === 'OVERCLOCK')
        return `${actorName} activated ${card.name} — next roll is doubled`;
      if (pos.effect === 'EXTRA_PLAY')
        return `${actorName} activated ${card.name} — plays an additional card this turn`;
      return `${actorName} triggered ${card.name} (+${pos.amount} cycles)`;
    }
    case 'EVENT_NEGATIVE': {
      const neg = card as NegativeEventCard;
      const tgt = lastTargetName ?? 'target';
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
      if (warRollResult) {
        const { actorBase, actorBonus, actorRoll, targetBase, targetBonus, targetRoll, actorWins, isTie, tieCycleLoss, targetName } = warRollResult;
        const actorRollStr  = actorBonus  > 0 ? `${actorBase}+${actorBonus}=${actorRoll}`  : `${actorRoll}`;
        const targetRollStr = targetBonus > 0 ? `${targetBase}+${targetBonus}=${targetRoll}` : `${targetRoll}`;
        if (isTie) {
          const penalty = tieCycleLoss ? ` — both lose ${tieCycleLoss}¢` : ' — no losses';
          return `${actorName} played ${card.name} — rolled ${actorRollStr} vs ${targetName} ${targetRollStr} — TIE${penalty}`;
        }
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

export type HandSortMode = 'DEFAULT' | 'TYPE' | 'VALUE' | 'ALPHA';

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
  /** Accumulated player ids in elimination order — reset each game, committed to gameStats at game-over. */
  eliminationOrder: string[];
  /** Guards against double-saving the game record when multiple set() paths can reach game-over. */
  recordSaved: boolean;
  handSortMode: HandSortMode;
  handSortReverse: boolean;
  setHandSort(mode: HandSortMode, reverse: boolean): void;
  clearWarRollDisplay(): void;
  togglePause(): void;
  setReducedMotion(v: boolean): void;
  startGame(playerCount: number, playerName: string, startingPop: number, hidePpCounts: boolean, deadMansSwitch: boolean, warTiePenalty: boolean): void;
  resetToSetup(): void;
  setHoveredCard(id: string | null): void;
  addLog(text: string, type: LogEntry['type']): void;
  drawCard(): void;
  selectCard(id: string | null): void;
  playCard(cardId: string): void;
  applyPlayCard(cardId: string, targetIndex: number | undefined, skipCounterCheck?: boolean): void;
  discardCard(cardId: string): void;
  /** Cancel remaining Multitask extra plays and end the human's turn. */
  cancelExtraPlays(): void;
  selectTarget(targetId: string): void;
  cancelTargeting(): void;
  resolveDeadMansSwitch(card: Card | null): void;
  resolveDaemonSteal(daemon: import('../types/cards').DaemonType | null): void;
  resolveWarLoot(daemon: import('../types/cards').DaemonType): void;
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

const defaultState: GameState & { selectedCardId: string | null; hoveredCardId: string | null; turnNumber: number; rollResult: [number, number] | null; rollTriggered: boolean; pendingCardId: string | null; validTargetIds: string[]; corruptionReveal: boolean; corruptionPendingTarget: boolean; eliminationOrder: string[]; recordSaved: boolean; handSortMode: HandSortMode; handSortReverse: boolean } = {
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
  eliminationOrder: [],
  recordSaved: false,
  startingPop: 50,
  hidePpCounts: false,
  deadMansSwitch: false,
  warTiePenalty: false,
  deadMansSwitchPending: null,
  daemonStealPending: null,
  warLootPending: null,
  warPickPending: null,
  warPrePending: null,
  pendingOverclockCard: null,
  counterPending: null,
  paused: false,
  extraPlayPending: 0,
  gameStats: { cardsPlayed: {}, eliminationOrder: [], damageDealt: {} },
  warRollDisplay: null,
  postCorruptionTargetIndex: null,
  // Placeholder — real value initialised from localStorage in the store body below.
  reducedMotion: false,
  handSortMode: 'DEFAULT',
  handSortReverse: false,
};

// ── Cyberpunk AI names & personalities ────────────────────────────────────────

const AI_NAMES = ['Ghost', 'Cipher', 'Null.Byte', 'Phantom'];
const AI_PERSONALITIES: AIPersonality[] = ['AGGRESSIVE', 'CAUTIOUS', 'TACTICAL'];

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => ({
  ...defaultState,
  // Persisted UI preference — intentionally NOT in defaultState so startGame never resets it.
  reducedMotion: localStorage.getItem('crg-reduced-motion') === 'true',

  startGame: (playerCount: number, playerName = 'You', startingPop = 50, hidePpCounts = false, deadMansSwitch = false, warTiePenalty = false) => {
    cancelAllAiTimers();
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
      reducedMotion: get().reducedMotion, // preserve user preference across game resets
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
      warTiePenalty,
      eliminationOrder: [],
      recordSaved: false,
      gameStats: { cardsPlayed: {}, eliminationOrder: [], damageDealt: {} },
    });

    get().addLog('Game started. Welcome to Corrupt Reality.', 'turn');
    get().addLog(`${players[0].name}'s turn — Begin the sequence.`, 'turn');
  },

  resetToSetup: () => { cancelAllAiTimers(); set({ ...defaultState, reducedMotion: get().reducedMotion, selectedCardId: null, hoveredCardId: null, turnNumber: 1 }); },

  setReducedMotion: (v: boolean) => {
    localStorage.setItem('crg-reduced-motion', String(v));
    set({ reducedMotion: v });
  },

  setHandSort: (mode, reverse) => set({ handSortMode: mode, handSortReverse: reverse }),

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
          scheduleAi(() => { if (!get().paused) get().triggerRoll(); }, AI_ROLL_DELAY);
        } else if (phase === 'MAIN') {
          scheduleAi(() => {
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
              : pickAiCard(actor, s.players, s.currentPlayerIndex, s.startingPop, s.gameStats);
            if (!card) {
              set({ extraPlayPending: 0, phase: 'END_TURN' });
              scheduleAi(() => { if (!get().paused) get().advanceTurn(); }, AI_ADVANCE_DELAY);
              return;
            }
            get().applyPlayCard(card.id, undefined);
          }, AI_CARD_DELAY);
        } else if (phase === 'END_TURN') {
          scheduleAi(() => { if (!get().paused) get().advanceTurn(); }, AI_ADVANCE_DELAY);
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

      trackEvent('corruption_triggered', { triggered_by: actorIsHuman ? 'human' : 'ai' });

      if (actorIsHuman && liveOps.length > 0) {
        // Human: show reveal first, then prompt for target selection
        set({ deck, discard, players, phase: 'MAIN', corruptionReveal: true, globalCorruptionMode: true, corruptionPendingTarget: true });
      } else {
        // AI: apply damage to a random live opponent immediately before the reveal
        let corruptionTargetIdx: number | null = null;
        if (liveOps.length > 0) {
          const { i: ti } = liveOps[Math.floor(random() * liveOps.length)];
          corruptionTargetIdx = ti;
          players = players.map((p, i) =>
            i === ti ? { ...p, credits: Math.max(0, p.credits - 10) } : p
          );
        }
        set({ deck, discard, players, phase: 'MAIN', corruptionReveal: true, globalCorruptionMode: true, postCorruptionTargetIndex: corruptionTargetIdx });
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

    // During an extra play (Multitask), WAR/COUNTER/Multitask cards are not allowed
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
        // Only two live players — no pick needed, resolve immediately
        if (livePlayers.length === 2) {
          set({ warPickPending: { cardId, availablePlayers: livePlayers } });
          get().resolveWarPick(livePlayers[0].playerIndex, livePlayers[1].playerIndex);
          return;
        }
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
  applyPlayCard: (cardId: string, targetIndex: number | undefined, skipCounterCheck = false) => {
    const state = get();
    const actorIndex = state.currentPlayerIndex;
    const actor = state.players[actorIndex];
    const card = actor.hand.find(c => c.id === cardId);
    if (!card) return;

    trackEvent('card_played', { card_name: card.name, card_category: card.category, is_human: actor.isHuman });

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
          gameStats: { cardsPlayed: newCardsPlayed, eliminationOrder: prevStats.eliminationOrder, damageDealt: prevStats.damageDealt },
        });
        get().addLog(`${actor.name} played Backdoor — choose which daemon to steal.`, 'card');
        return;
      }
    }

    // ── WAR counter opportunity — when AI targets human with a WAR card ───────
    // Give the human a chance to play a counter card before the war resolves.
    // All COUNTER card types are eligible: NEGOTIATE (cancel), TACTICAL_ADVANTAGE
    // (+1 roll), SHIELD (cancel — Quarantine blocks the war). Skip if human already
    // has the negotiating flag active (System Interrupt already armed).
    if (!skipCounterCheck && !actor.isHuman && card.category === 'WAR') {
      const liveOpponents = state.players
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => i !== actorIndex && !p.eliminated);
      if (liveOpponents.length > 0) {
        const targetI = liveOpponents[Math.floor(random() * liveOpponents.length)].i;
        const target  = state.players[targetI];
        if (target.isHuman && !target.negotiating) {
          const eligibleCounters = target.hand.filter(c =>
            c.category === 'COUNTER'
          ) as CounterCard[];
          if (eligibleCounters.length > 0) {
            trackEvent('counter_opportunity_shown', { eligible_count: eligibleCounters.length });
            set({ counterPending: { type: 'WAR', attackerIndex: actorIndex, cardId, targetIndex: targetI, eligibleCounters } });
            return; // resume via resolveCounterOpportunity
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
        const elim0 = markEliminations(players, state.eliminationOrder);
        players = elim0.players;
        const alive = players.filter(p => !p.eliminated);
        const winnerId = alive.length <= 1 ? (alive[0]?.id ?? null) : null;
        if (alive.length === 1) get().addLog(`${alive[0].name} wins the game!`, 'turn');
        get().addLog(`${actor.name} deployed Power Cycle — ${target.name} reset to ${state.startingPop}¢, daemons purged, hand replaced!`, 'card');
        if (winnerId && !state.recordSaved) {
          saveGameRecord(
            players.find(p => p.isHuman)?.id === winnerId,
            state.turnNumber,
            state.players.length,
            state.globalCorruptionMode,
          );
        }
        set({
          players, deck, discard, winnerId, extraPlayPending: 0,
          eliminationOrder: elim0.eliminationOrder,
          recordSaved: winnerId ? true : state.recordSaved,
          phase: winnerId ? 'GAME_OVER' : (actor.isHuman ? 'END_TURN' : 'MAIN'),
          selectedCardId: null, pendingCardId: null, validTargetIds: [],
          gameStats: {
            cardsPlayed: newCardsPlayed,
            eliminationOrder: winnerId ? elim0.eliminationOrder : prevStats.eliminationOrder,
            damageDealt: prevStats.damageDealt,
          },
        });
        if (!winnerId && !actor.isHuman) scheduleAi(() => { if (!get().paused) get().advanceTurn(); }, AI_ADVANCE_DELAY);
      }
      return;
    }

    const creditsBefore = players.map(p => p.credits);
    const fx = applyCardEffect(card, players, actorIndex, targetIndex);
    players = fx.players;
    const damageByCard = creditsBefore.reduce((sum, before, i) => {
      if (i === actorIndex) return sum;
      return sum + Math.max(0, before - players[i].credits);
    }, 0);
    const newDamageDealt = damageByCard > 0
      ? { ...prevStats.damageDealt, [actor.id]: (prevStats.damageDealt[actor.id] ?? 0) + damageByCard }
      : prevStats.damageDealt;
    const capturedWarRoll = fx.warRollResult;
    const blockedBy = fx.quarantineBlockedBy;
    const negotiateBlockedBy = fx.negotiateBlockedBy;
    const daemonBlockedBy = fx.daemonImmunityBlockedBy;

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
          players = applyCardEffect(lastCard, players, i).players;
          discard = [...discard, lastCard];
          get().addLog(`💀 ${players[i].name} triggers Dead Man's Switch — plays ${lastCard.name}!`, 'effect');
        }
      }
    }

    const cardLog = cardLogText(card, actor.name, fx.lastTargetName, fx.warRollResult);
    if (blockedBy) get().addLog(`${blockedBy}'s Quarantine absorbed the attack!`, 'effect');
    if (negotiateBlockedBy) get().addLog(`${negotiateBlockedBy}'s System Interrupt cancelled the attack!`, 'effect');
    if (daemonBlockedBy) get().addLog(`${daemonBlockedBy} blocked the attack!`, 'effect');
    // WAR log deferred to clearWarRollDisplay() so it appears after the dice animation.
    // For blocked wars (no capturedWarRoll) there is no animation, so log immediately.
    if (!capturedWarRoll) get().addLog(cardLog, 'card');

    if (humanDmsPending) {
      // Mark AI eliminations now; keep the human's eliminated flag clear until they resolve
      const elim1 = markEliminations(players, state.eliminationOrder, true);
      players = elim1.players;
      set({
        players, discard, globalCorruptionMode,
        phase: 'MAIN',
        selectedCardId: null,
        pendingCardId: null,
        validTargetIds: [],
        deadMansSwitchPending: humanDmsPending,
        eliminationOrder: elim1.eliminationOrder,
        warRollDisplay: null,
        gameStats: { cardsPlayed: newCardsPlayed, eliminationOrder: prevStats.eliminationOrder, damageDealt: newDamageDealt },
      });
      return; // advanceTurn fires after overlay resolves
    }

    const elim2 = markEliminations(players, state.eliminationOrder);
    players = elim2.players;

    const alive = players.filter(p => !p.eliminated);
    const winnerId = alive.length <= 1 ? (alive[0]?.id ?? null) : null;

    if (alive.length === 1) get().addLog(`${alive[0].name} wins the game!`, 'turn');

    const isHuman = state.players[actorIndex]?.isHuman ?? false;

    const isExtraPlayCard =
      card.category === 'EVENT_POSITIVE' &&
      (card as PositiveEventCard).effect === 'EXTRA_PLAY';

    if (isExtraPlayCard && !winnerId) {
      // Multitask — randomly grant 1 or 2 extra card plays
      const extraCount = Math.floor(random() * 2) + 1;
      set({
        players, discard, globalCorruptionMode,
        extraPlayPending: extraCount,
        phase: 'MAIN',
        selectedCardId: null, pendingCardId: null, validTargetIds: [],
        deadMansSwitchPending: null,
        eliminationOrder: elim2.eliminationOrder,
        pendingOverclockCard: state.pendingOverclockCard,
        gameStats: { cardsPlayed: newCardsPlayed, eliminationOrder: prevStats.eliminationOrder, damageDealt: newDamageDealt },
      });
      get().addLog(`${actor.name} activated Multitask — ${extraCount} extra play${extraCount > 1 ? 's' : ''} granted!`, 'effect');
      // AI immediately picks a valid extra card (no redraw)
      if (!isHuman) {
        scheduleAi(() => {
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
            scheduleAi(() => { if (!get().paused) get().advanceTurn(); }, AI_ADVANCE_DELAY);
            return;
          }
          get().applyPlayCard(card2.id, undefined);
        }, AI_CARD_DELAY);
      }
      return;
    }

    // If this card was played as an extra play (from Multitask), decrement the counter
    const newExtraPlays = (state.extraPlayPending > 0 && !isExtraPlayCard)
      ? state.extraPlayPending - 1
      : 0;

    // Whether the current actor still has more extra plays after this card
    const moreExtraPlays = newExtraPlays > 0 && !winnerId;

    if (winnerId && !state.recordSaved) {
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
      eliminationOrder: elim2.eliminationOrder,
      recordSaved: winnerId ? true : state.recordSaved,
      phase: alive.length <= 1 ? 'GAME_OVER' : (moreExtraPlays ? 'MAIN' : (isHuman ? 'END_TURN' : 'MAIN')),
      selectedCardId: null,
      pendingCardId: null,
      validTargetIds: [],
      deadMansSwitchPending: null,
      pendingOverclockCard: isHumanOverclock ? card : state.pendingOverclockCard,
      warRollDisplay: capturedWarRoll ? {
        r1: capturedWarRoll.actorBase,
        r2: capturedWarRoll.targetBase,
        actorBonus: capturedWarRoll.actorBonus,
        targetBonus: capturedWarRoll.targetBonus,
        actorName: actor.name,
        targetName: capturedWarRoll.targetName,
        actorWins: capturedWarRoll.actorWins,
        logText: cardLog,
      } : null,
      gameStats: {
        cardsPlayed: newCardsPlayed,
        eliminationOrder: winnerId ? elim2.eliminationOrder : prevStats.eliminationOrder,
        damageDealt: newDamageDealt,
      },
    });

    // AI continues — either play another extra card or advance turn.
    // For WAR cards (capturedWarRoll !== null) the turn advance is deferred:
    // clearWarRollDisplay() fires once the LED dice animation completes, then
    // calls advanceTurn(). Advancing here would race the animation.
    if (!winnerId && !isHuman) {
      if (moreExtraPlays) {
        scheduleAi(() => {
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
            scheduleAi(() => { if (!get().paused) get().advanceTurn(); }, AI_ADVANCE_DELAY);
            return;
          }
          get().applyPlayCard(card2.id, undefined);
        }, AI_CARD_DELAY);
      } else if (!capturedWarRoll) {
        // Non-WAR card: advance after the card animation has had time to play out
        scheduleAi(() => { if (!get().paused) get().advanceTurn(); }, AI_ADVANCE_DELAY);
      }
      // WAR card (capturedWarRoll set): clearWarRollDisplay() handles the advance
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
      const elim = markEliminations(players, state.eliminationOrder);
      players = elim.players;
      const alive = players.filter(p => !p.eliminated);
      const winnerId = alive.length <= 1 ? (alive[0]?.id ?? null) : null;
      if (alive.length === 1) get().addLog(`${alive[0].name} wins the game!`, 'turn');
      if (winnerId && !state.recordSaved) {
        saveGameRecord(
          players.find(p => p.isHuman)?.id === winnerId,
          state.turnNumber,
          state.players.length,
          state.globalCorruptionMode,
        );
      }
      set({
        players,
        phase: winnerId ? 'GAME_OVER' : 'END_TURN',
        selectedCardId: null,
        pendingCardId: null,
        validTargetIds: [],
        corruptionPendingTarget: false,
        winnerId,
        eliminationOrder: elim.eliminationOrder,
        recordSaved: winnerId ? true : state.recordSaved,
        postCorruptionTargetIndex: winnerId ? null : targetIndex,
        gameStats: winnerId
          ? { ...state.gameStats, eliminationOrder: elim.eliminationOrder }
          : state.gameStats,
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
      players = applyCardEffect(card, players, playerIndex).players;
      discard = [...discard, card];
      get().addLog(`💀 ${state.players[playerIndex].name} triggers Dead Man's Switch — plays ${card.name}!`, 'effect');
    } else {
      get().addLog(`💀 ${state.players[playerIndex].name} goes quietly.`, 'effect');
    }

    // Now mark all remaining eliminations (including the DMS player)
    const elim = markEliminations(players, state.eliminationOrder);
    players = elim.players;
    const alive = players.filter(p => !p.eliminated);
    const winnerId = alive.length <= 1 ? (alive[0]?.id ?? null) : null;
    if (alive.length === 1) get().addLog(`${alive[0].name} wins the game!`, 'turn');

    const humanResolved = state.players[state.deadMansSwitchPending.playerIndex]?.isHuman ?? false;

    if (winnerId && !state.recordSaved) {
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
      eliminationOrder: elim.eliminationOrder,
      recordSaved: winnerId ? true : state.recordSaved,
      gameStats: winnerId
        ? { ...state.gameStats, eliminationOrder: elim.eliminationOrder }
        : state.gameStats,
    });

    if (!winnerId && !humanResolved) scheduleAi(() => { if (!get().paused) get().advanceTurn(); }, AI_ADVANCE_DELAY);
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

    const elim = markEliminations(players, state.eliminationOrder);
    players = elim.players;
    const alive = players.filter(p => !p.eliminated);
    const winnerId = alive.length === 1 ? alive[0].id : null;

    if (winnerId && !state.recordSaved) {
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
      eliminationOrder: elim.eliminationOrder,
      recordSaved: winnerId ? true : state.recordSaved,
      gameStats: winnerId
        ? { ...state.gameStats, eliminationOrder: elim.eliminationOrder }
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
      // Human chose to allow — proceed with the original WAR card at the pre-resolved target.
      set({ counterPending: null });
      get().applyPlayCard(cardId, targetIndex, true);
      return;
    }

    const attacker   = state.players[attackerIndex];
    const attackCard = attacker?.hand.find(c => c.id === cardId);
    const human      = state.players.find(p => p.isHuman);
    const counterCard = human?.hand.find(c => c.id === counterCardId) as CounterCard | undefined;
    if (!attackCard || !counterCard) { set({ counterPending: null }); return; }

    trackEvent('counter_used', { counter_type: counterCard.counterType, attack_card: attackCard.name });

    if (counterCard.counterType === 'TACTICAL_ADVANTAGE') {
      // Firewall Surge in a WAR — boost human's roll but let the war proceed.
      const players = state.players.map(p =>
        p.isHuman
          ? { ...p, hand: p.hand.filter(c => c.id !== counterCardId), tacticalBonus: p.tacticalBonus + 1 }
          : p
      );
      const discard = [...state.discard, counterCard];
      set({ players, discard, counterPending: null });
      get().addLog(`${human!.name} plays ${counterCard.name} — +1 to their war roll!`, 'effect');
      // Let the WAR resolve at the pre-resolved target with the bonus now applied.
      get().applyPlayCard(cardId, targetIndex, true);
    } else {
      // NEGOTIATE or SHIELD — cancel the war entirely.
      const players = state.players.map((p, i) => {
        if (i === attackerIndex) return { ...p, hand: p.hand.filter(c => c.id !== cardId) };
        if (p.isHuman)           return { ...p, hand: p.hand.filter(c => c.id !== counterCardId) };
        return p;
      });
      const discard = [...state.discard, attackCard, counterCard];
      set({ players, discard, counterPending: null, phase: 'MAIN', selectedCardId: null, validTargetIds: [] });
      get().addLog(`${attacker.name} played ${attackCard.name} — blocked by ${human!.name}'s ${counterCard.name}!`, 'effect');
      scheduleAi(() => { if (!get().paused) get().advanceTurn(); }, AI_ADVANCE_DELAY);
    }
  },

  finalizeWarResolution: (warCard: import('../types/cards').WarCard, p1Index: number, p2Index: number) => {
    const state = get();
    const actorIndex = state.currentPlayerIndex;
    let players = state.players;
    let discard = state.discard;
    const prevStatsWar = state.gameStats;

    const warCreditsBefore = players.map(p => p.credits);
    const warFx = applyCardEffect(warCard, players, p1Index, p2Index, state.warTiePenalty);
    players = warFx.players;
    const warDamageByCard = warCreditsBefore.reduce((sum, before, i) => {
      if (i === p1Index) return sum;
      return sum + Math.max(0, before - players[i].credits);
    }, 0);
    const capturedWarRoll = warFx.warRollResult;
    const negotiateBlockedBy = warFx.negotiateBlockedBy;

    const warCardLog = cardLogText(warCard, state.players[actorIndex].name, warFx.lastTargetName, warFx.warRollResult);
    if (negotiateBlockedBy) get().addLog(`${negotiateBlockedBy}'s Cease & Desist cancelled the war!`, 'effect');
    if (!capturedWarRoll) get().addLog(warCardLog, 'card');

    // ── Daemon loot (Total Siege) — winner picks which daemon the loser loses ─
    let warLootPending: import('../types/gameState').GameState['warLootPending'] = null;
    if (capturedWarRoll && !capturedWarRoll.isTie && warCard.loserLosesImprovement) {
      const loserIndex = capturedWarRoll.actorWins ? p2Index : p1Index;
      const loserDaemons = players[loserIndex].daemons;
      if (loserDaemons.length === 1) {
        // Only one daemon — remove it automatically, no choice needed
        players = players.map((p, i) => i === loserIndex ? { ...p, daemons: [] } : p);
      } else if (loserDaemons.length > 1) {
        const winnerIndex = capturedWarRoll.actorWins ? p1Index : p2Index;
        if (players[winnerIndex].isHuman) {
          // Human winner gets to pick
          warLootPending = { loserIndex, availableDaemons: [...loserDaemons] };
        } else {
          // AI winner — remove a random daemon
          const idx = Math.floor(random() * loserDaemons.length);
          players = players.map((p, i) => i === loserIndex
            ? { ...p, daemons: p.daemons.filter((_, di) => di !== idx) } : p);
        }
      }
    }

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
          players = applyCardEffect(lastCard, players, i).players;
          discard = [...discard, lastCard];
          get().addLog(`💀 ${players[i].name} triggers Dead Man's Switch — plays ${lastCard.name}!`, 'effect');
        }
      }
    }

    const warDisplayPayload = capturedWarRoll ? {
      r1: capturedWarRoll.actorBase,
      r2: capturedWarRoll.targetBase,
      actorBonus: capturedWarRoll.actorBonus,
      targetBonus: capturedWarRoll.targetBonus,
      actorName: state.players[actorIndex].name,
      targetName: capturedWarRoll.targetName,
      actorWins: capturedWarRoll.actorWins,
      isTie: capturedWarRoll.isTie,
      tieCycleLoss: capturedWarRoll.tieCycleLoss,
      logText: warCardLog,
    } : null;

    const actorId = state.players[actorIndex]?.id;
    const warCardsPlayed = actorId
      ? { ...prevStatsWar.cardsPlayed, [actorId]: (prevStatsWar.cardsPlayed[actorId] ?? 0) + 1 }
      : prevStatsWar.cardsPlayed;
    const warDamageDealt = actorId && warDamageByCard > 0
      ? { ...prevStatsWar.damageDealt, [actorId]: (prevStatsWar.damageDealt[actorId] ?? 0) + warDamageByCard }
      : prevStatsWar.damageDealt;

    if (humanDmsPending) {
      const elim1 = markEliminations(players, state.eliminationOrder, true);
      players = elim1.players;
      set({
        players, discard,
        phase: 'MAIN',
        selectedCardId: null,
        pendingCardId: null,
        validTargetIds: [],
        deadMansSwitchPending: humanDmsPending,
        warLootPending,
        eliminationOrder: elim1.eliminationOrder,
        warRollDisplay: warDisplayPayload,
        gameStats: { cardsPlayed: warCardsPlayed, eliminationOrder: prevStatsWar.eliminationOrder, damageDealt: warDamageDealt },
      });
      return;
    }

    const elim2 = markEliminations(players, state.eliminationOrder);
    players = elim2.players;
    const alive = players.filter(p => !p.eliminated);
    const winnerId = alive.length === 1 ? alive[0].id : null;
    if (winnerId) get().addLog(`${alive[0].name} wins the game!`, 'turn');

    if (winnerId && !state.recordSaved) {
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
      eliminationOrder: elim2.eliminationOrder,
      recordSaved: winnerId ? true : state.recordSaved,
      warLootPending,
      warRollDisplay: warDisplayPayload,
      gameStats: {
        cardsPlayed: warCardsPlayed,
        eliminationOrder: winnerId ? elim2.eliminationOrder : prevStatsWar.eliminationOrder,
        damageDealt: warDamageDealt,
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
    get().addLog(`${actor.name} ended Multitask early.`, 'effect');
  },

  endTurn: () => {
    const state = get();
    if (state.phase !== 'END_TURN') return;
    if (state.warRollDisplay !== null) return; // wait for war dice roll to finish
    get().advanceTurn();
  },

  advanceTurn: () => {
    const state = get();
    if (state.phase === 'GAME_OVER') return;

    const { players, currentPlayerIndex, turnNumber, postCorruptionTargetIndex } = state;
    const total = players.length;

    let nextIndex: number;
    // After a Corruption card targets a player, that player goes next
    if (postCorruptionTargetIndex !== null && !players[postCorruptionTargetIndex].eliminated) {
      nextIndex = postCorruptionTargetIndex;
    } else {
      // Find next non-eliminated player in rotation
      nextIndex = (currentPlayerIndex + 1) % total;
      let loops = 0;
      while (players[nextIndex].eliminated && loops < total) {
        nextIndex = (nextIndex + 1) % total;
        loops++;
      }
      // If all are eliminated somehow, do nothing
      if (players[nextIndex].eliminated) return;
    }

    const wrappedAround = nextIndex <= currentPlayerIndex;
    const newTurnNumber = wrappedAround ? turnNumber + 1 : turnNumber;
    if (wrappedAround) trackEvent('turn_played', { turn_number: newTurnNumber });
    const roll: [number, number] = [Math.ceil(random() * 6), Math.ceil(random() * 6)];

    set({
      currentPlayerIndex: nextIndex,
      phase: 'PHASE_ROLL',
      turnNumber: newTurnNumber,
      rollResult: roll,
      rollTriggered: false,
      selectedCardId: null,
      postCorruptionTargetIndex: null,
    });

    const nextPlayer = players[nextIndex];
    get().addLog(`${nextPlayer.name}'s turn — sequence pending.`, 'turn');

    // AI auto-triggers the roll after the standby display has had time to appear
    if (!nextPlayer.isHuman) {
      scheduleAi(() => { if (!get().paused) get().triggerRoll(); }, AI_ROLL_DELAY);
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
        const lossNote = finalAmount === 0 ? 'losses fully absorbed' : `lost ${finalAmount} cycles`;
        get().addLog(`${rollLabel} — ${lossNote}. (${r1}+${r2}=${total})${overclock}${daemonNote}`, 'effect');
      } else {
        players = players.map((p, i) =>
          i === actorIndex ? { ...p, credits: Math.min(200, p.credits + finalAmount) } : p
        );
        get().addLog(`${rollLabel} — gained ${finalAmount} cycles. (${r1}+${r2}=${total})${overclock}${daemonNote}`, 'effect');
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
            players = applyCardEffect(lastCard, players, actorIndex).players;
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

      const elim = markEliminations(players, state.eliminationOrder);
      players = elim.players;
      const alive = players.filter(p => !p.eliminated);
      const winnerId = alive.length <= 1 ? (alive[0]?.id ?? null) : null;
      if (alive.length === 1) get().addLog(`${alive[0].name} wins the game!`, 'turn');

      if (winnerId && !state.recordSaved) {
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
        eliminationOrder: elim.eliminationOrder,
        recordSaved: winnerId ? true : state.recordSaved,
        gameStats: winnerId
          ? { ...state.gameStats, eliminationOrder: elim.eliminationOrder }
          : state.gameStats,
      });
      if (alive.length > 1) scheduleAi(() => { if (!get().paused) get().advanceTurn(); }, AI_ADVANCE_DELAY);
      return;
    }

    // ── Normal flow — actor still alive, proceed to draw / AI card phase ─────
    if (actor.isHuman) {
      set({ phase: 'DRAW' });
    } else {
      scheduleAi(() => { if (!get().paused) get().runAiTurn(); }, AI_DRAW_DELAY);
    }
  },

  clearWarRollDisplay: () => {
    const display = get().warRollDisplay;
    trackEvent('war_resolved', { winner_name: display?.actorWins ? display.actorName : display?.targetName ?? 'unknown' });
    // Flush the deferred WAR log entry now that the animation has finished
    if (display?.logText) get().addLog(display.logText, 'card');
    set({ warRollDisplay: null });
    // If the human winner still needs to pick which daemon the loser loses, wait for that first
    if (get().warLootPending) return;
    if (get().phase !== 'GAME_OVER') {
      scheduleAi(() => { if (!get().paused) get().advanceTurn(); }, 300);
    }
  },

  resolveWarLoot: (daemon) => {
    const state = get();
    if (!state.warLootPending) return;
    const { loserIndex } = state.warLootPending;
    const players = state.players.map((p, i) => i === loserIndex
      ? { ...p, daemons: p.daemons.filter(d => d !== daemon) }
      : p
    );
    get().addLog(`${state.players[loserIndex].name} loses ${daemon.replace('_', ' ')} daemon as war spoils`, 'effect');
    set({ players, warLootPending: null });
    if (state.phase !== 'GAME_OVER') {
      scheduleAi(() => { if (!get().paused) get().advanceTurn(); }, 300);
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

    scheduleAi(() => {
      if (get().paused) return; // ← guard: paused between draw and card pick
      const currentState = get();
      const currentActor = currentState.players[currentState.currentPlayerIndex];
      const card = pickAiCard(currentActor, currentState.players, currentState.currentPlayerIndex, currentState.startingPop, currentState.gameStats);
      if (!card) {
        if (!get().paused) get().advanceTurn();
        return;
      }
      // AI skips the TARGETING phase — applyPlayCard picks a random target internally
      get().applyPlayCard(card.id, undefined);
    }, AI_CARD_DELAY);
  },
}));
