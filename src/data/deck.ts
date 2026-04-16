// src/data/deck.ts
// 70-card deck matching Plague & Pestilence card counts and mechanics.
import type { Card, CardRarity } from '../types/cards';
import { random } from '../lib/rng';

let _id = 0;
const uid = () => `card_${++_id}`;
const common  = (n: number): CardRarity => n <= 3 ? 'COMMON' : n <= 5 ? 'UNCOMMON' : n <= 7 ? 'RARE' : 'LEGENDARY';

// ── CREDITS (12) ─────────────────────────────────────────────────────────────
// P&P: Fertility ×6 (+5), Plenty ×6 (+10)

const creditCards: Card[] = [
  // Data Harvest ×6 — P&P Fertility (+5)
  ...Array(6).fill(null).map(() => ({
    id: uid(), name: 'Data Harvest', category: 'CREDITS' as const,
    description: 'Extract raw data from the grid. Gain +5 credits.',
    rarity: 'COMMON' as const, amount: 5,
    flavourText: 'The net provides. Always.',
  })),
  // Neural Uplink ×6 — P&P Plenty (+10)
  ...Array(6).fill(null).map(() => ({
    id: uid(), name: 'Neural Uplink', category: 'CREDITS' as const,
    description: 'Synchronise node clusters. Gain +10 credits.',
    rarity: 'UNCOMMON' as const, amount: 10,
    flavourText: 'Every mind a server. Every server, a weapon.',
  })),
];

// ── EVENT_POSITIVE (6) ───────────────────────────────────────────────────────
// P&P base: Migration ×2 | New: Overclock ×2, Multitasking ×2

const positiveEvents: Card[] = [
  // Mass Assimilation ×2 — P&P Migration
  ...Array(2).fill(null).map(() => ({
    id: uid(), name: 'Mass Assimilation', category: 'EVENT_POSITIVE' as const,
    description: 'Absorb unaligned factions. Each opponent loses 5 credits; you gain 5 per opponent.',
    rarity: 'RARE' as const, effect: 'DRAIN_ALL', amount: 5,
    flavourText: 'Resistance is a deprecated function.',
  })),
  // Overclock ×2 — new card (doubles next Stability Roll gain)
  ...Array(2).fill(null).map(() => ({
    id: uid(), name: 'Overclock', category: 'EVENT_POSITIVE' as const,
    description: 'Push your systems to the limit. Your next Stability Roll gain is doubled.',
    rarity: 'RARE' as const, effect: 'OVERCLOCK', amount: 0,
    flavourText: 'Red-line everything. Deal with the consequences later.',
  })),
  // Multitasking ×2 — play two cards in one turn (no WAR or COUNTER as second card)
  ...Array(2).fill(null).map(() => ({
    id: uid(), name: 'Multitasking', category: 'EVENT_POSITIVE' as const,
    description: 'Run parallel processes. Play one additional card this turn (cannot be a Conflict or Countermeasure card).',
    rarity: 'RARE' as const, effect: 'EXTRA_PLAY', amount: 0,
    flavourText: 'Two threads. One clock cycle.',
  })),
];

// ── EVENT_NEGATIVE (30) ──────────────────────────────────────────────────────

const negativeEvents: Card[] = [
  // Signal Theft ×2 — P&P Pied Piper (STEAL: actor +15, target -15)
  ...Array(2).fill(null).map(() => ({
    id: uid(), name: 'Signal Theft', category: 'EVENT_NEGATIVE' as const,
    description: 'Siphon bandwidth from a target faction. They lose 15 credits; you gain 15 credits.',
    rarity: 'RARE' as const, effect: 'STEAL', amount: 15, targetsOther: true,
    flavourText: 'Their signal. Your growth.',
  })),
  // Digital Crusade ×2 — P&P Crusade (10 damage to target)
  ...Array(2).fill(null).map(() => ({
    id: uid(), name: 'Digital Crusade', category: 'EVENT_NEGATIVE' as const,
    description: 'Launch a zealous network assault. Target loses 10 credits.',
    rarity: 'UNCOMMON' as const, effect: 'DAMAGE', amount: 10, targetsOther: true,
    flavourText: 'Holy war, encoded.',
  })),
  // Data Drought ×3 — P&P Drought (10 damage to target; Firewall immune)
  ...Array(3).fill(null).map(() => ({
    id: uid(), name: 'Data Drought', category: 'EVENT_NEGATIVE' as const,
    description: 'Cut off a faction\'s data supply. Target loses 10 credits. (Firewall immune)',
    rarity: 'COMMON' as const, effect: 'DAMAGE', amount: 10, targetsOther: true, immuneDaemon: 'FIREWALL' as const,
    flavourText: 'No packets. No future.',
  })),
  // System Quake ×3 — P&P Earthquake (5 damage + one daemon removed)
  ...Array(3).fill(null).map(() => ({
    id: uid(), name: 'System Quake', category: 'EVENT_NEGATIVE' as const,
    description: 'Critical system failure. Target loses 5 credits and one daemon.',
    rarity: 'UNCOMMON' as const, effect: 'DAMAGE_DAEMON', amount: 5, targetsOther: true,
    flavourText: 'The ground shifts. The build crumbles.',
  })),
  // Data Famine ×3 — P&P Famine (10 damage to target)
  ...Array(3).fill(null).map(() => ({
    id: uid(), name: 'Data Famine', category: 'EVENT_NEGATIVE' as const,
    description: 'Starve a faction\'s resource credits. Target loses 10 credits.',
    rarity: 'COMMON' as const, effect: 'DAMAGE', amount: 10, targetsOther: true,
    flavourText: 'Hunger is a weapon when you control the supply chain.',
  })),
  // Inferno Protocol ×3 — P&P Fire (10 damage + one daemon removed; Firewall immune)
  ...Array(3).fill(null).map(() => ({
    id: uid(), name: 'Inferno Protocol', category: 'EVENT_NEGATIVE' as const,
    description: 'Torch a faction\'s daemons. Target loses 10 credits and one daemon. (Firewall immune)',
    rarity: 'UNCOMMON' as const, effect: 'DAMAGE_DAEMON', amount: 10, targetsOther: true, immuneDaemon: 'FIREWALL' as const,
    flavourText: 'Burn rate: maximum.',
  })),
  // Data Flood ×3 — P&P Flood (10 damage to target; Encryption immune)
  ...Array(3).fill(null).map(() => ({
    id: uid(), name: 'Data Flood', category: 'EVENT_NEGATIVE' as const,
    description: 'Overwhelm a faction\'s buffers with junk traffic. Target loses 10 credits. (Encryption immune)',
    rarity: 'COMMON' as const, effect: 'DAMAGE', amount: 10, targetsOther: true, immuneDaemon: 'ENCRYPTION' as const,
    flavourText: 'Packet storm. Infinite loop.',
  })),
  // Network Storm ×2 — P&P Mongol Raid (10 damage + daemon removed from ALL opponents)
  ...Array(2).fill(null).map(() => ({
    id: uid(), name: 'Network Storm', category: 'EVENT_NEGATIVE' as const,
    description: 'Unleash chaos across all networks. Every opponent loses 10 credits and one daemon.',
    rarity: 'LEGENDARY' as const, effect: 'DAMAGE_ALL_DAEMON', amount: 10, targetsOther: false,
    flavourText: 'The storm does not choose its victims.',
  })),
  // Pestilence Protocol ×6 — P&P Pestilence (5 damage to target)
  ...Array(6).fill(null).map(() => ({
    id: uid(), name: 'Pestilence Protocol', category: 'EVENT_NEGATIVE' as const,
    description: 'Spread a slow-acting virus through a rival faction. Target loses 5 credits.',
    rarity: 'COMMON' as const, effect: 'DAMAGE', amount: 5, targetsOther: true,
    flavourText: 'Polymorphic. Persistent. Patient.',
  })),
  // Raid Protocol ×2 — P&P Viking Raid (10 damage to target; Hardened Node immune)
  ...Array(2).fill(null).map(() => ({
    id: uid(), name: 'Raid Protocol', category: 'EVENT_NEGATIVE' as const,
    description: 'Strike fast and hard at a rival faction. Target loses 10 credits. (Hardened Node immune)',
    rarity: 'UNCOMMON' as const, effect: 'DAMAGE', amount: 10, targetsOther: true, immuneDaemon: 'HARDENED_NODE' as const,
    flavourText: 'In and out before the firewall wakes.',
  })),
  // The Corruption ×1 — P&P Death Ship (10 damage; triggers Corruption mode)
  {
    id: uid(), name: 'The Corruption', category: 'EVENT_NEGATIVE' as const,
    description: 'Unleash the virus. Target loses 10 credits. Corruption mode begins.',
    rarity: 'LEGENDARY' as const, effect: 'CORRUPTION', amount: 10, targetsOther: true,
    flavourText: 'Once it spreads, nothing is clean.',
  },
  // Power Cycle ×2 — hard reset: target returns to starting credits, loses daemons, new hand
  ...Array(2).fill(null).map(() => ({
    id: uid(), name: 'Power Cycle', category: 'EVENT_NEGATIVE' as const,
    description: 'Force a full system reboot. Target\'s credits reset to starting amount, all daemons are purged, and their hand is replaced with 5 new cards.',
    rarity: 'LEGENDARY' as const, effect: 'POWER_CYCLE', amount: 0, targetsOther: true,
    flavourText: 'Have you tried turning it off and on again?',
  })),
  // M.A.D. ×2 — new card (both actor and target lose 15 credits)
  ...Array(2).fill(null).map(() => ({
    id: uid(), name: 'M.A.D.', category: 'EVENT_NEGATIVE' as const,
    description: 'Mutually Assured Destruction. You and the target each lose 15 credits.',
    rarity: 'RARE' as const, effect: 'MUTUAL_DAMAGE', amount: 15, targetsOther: true,
    flavourText: 'If I burn, you burn with me.',
  })),
  // Backdoor ×2 — new card (steal one daemon from target)
  ...Array(2).fill(null).map(() => ({
    id: uid(), name: 'Backdoor', category: 'EVENT_NEGATIVE' as const,
    description: 'Exploit a hidden vulnerability. Steal one daemon from a target.',
    rarity: 'RARE' as const, effect: 'STEAL_DAEMON', amount: 0, targetsOther: true,
    flavourText: 'Every wall has a crack. You just have to find it.',
  })),
];

// ── WAR (7) ──────────────────────────────────────────────────────────────────
// P&P: Major War ×3 (winner -10, loser -20), Minor War ×4 (winner -5, loser -10)

const warCards: Card[] = [
  // Grid Conflict ×3 — P&P Major War
  ...Array(3).fill(null).map(() => ({
    id: uid(), name: 'Grid Conflict', category: 'WAR' as const,
    description: 'Total network assault. Winner loses 10 credits. Loser loses 20 credits and one daemon.',
    rarity: 'RARE' as const, winnerLoses: 10, loserLoses: 20, loserLosesImprovement: true,
    flavourText: 'Scorched silicon.',
  })),
  // Proxy Conflict ×4 — P&P Minor War
  ...Array(4).fill(null).map(() => ({
    id: uid(), name: 'Proxy Conflict', category: 'WAR' as const,
    description: 'Instigate a localised conflict. Winner loses 5 credits. Loser loses 10 credits.',
    rarity: 'COMMON' as const, winnerLoses: 5, loserLoses: 10,
    flavourText: 'All wars are fought by someone else.',
  })),
];

// ── COUNTER (9) ──────────────────────────────────────────────────────────────
// P&P base: Tactical Advantage ×4, Buy Indulgence ×3 | New: Quarantine ×2

const counterCards: Card[] = [
  // Firewall Surge ×4 — P&P Tactical Advantage (+1 to your war die roll)
  ...Array(4).fill(null).map(() => ({
    id: uid(), name: 'Firewall Surge', category: 'COUNTER' as const,
    description: 'INSTANT — Your next WAR roll gets +1. Play before initiating a conflict.',
    rarity: 'COMMON' as const, counterType: 'TACTICAL_ADVANTAGE' as const,
    flavourText: 'Control the variance. Control the outcome.',
  })),
  // System Interrupt ×3 — P&P Buy Indulgence (cancel a War or Digital Crusade)
  ...Array(3).fill(null).map(() => ({
    id: uid(), name: 'System Interrupt', category: 'COUNTER' as const,
    description: 'INSTANT — Cancel a Grid Conflict or Digital Crusade before it resolves.',
    rarity: 'UNCOMMON' as const, counterType: 'NEGOTIATE' as const,
    flavourText: 'The most powerful line of code: null.',
  })),
  // Quarantine ×2 — new card (SHIELD: block the next incoming targeted attack)
  ...Array(2).fill(null).map(() => ({
    id: uid(), name: 'Quarantine', category: 'COUNTER' as const,
    description: 'INSTANT — Block the next targeted attack against you. One use.',
    rarity: 'UNCOMMON' as const, counterType: 'SHIELD' as const,
    flavourText: 'Nothing gets in. Nothing gets out.',
  })),
];

// ── DAEMONS (12) ─────────────────────────────────────────────────────────────
// P&P: Aqueduct ×4, Sewers ×3, City Walls ×5

const daemonCards: Card[] = [
  // Firewall ×4 — P&P Aqueduct (+1 Prosperity, -1 Plague; immune to Drought & Fire)
  ...Array(4).fill(null).map((_, i) => ({
    id: uid(), name: 'Firewall', category: 'DAEMON' as const,
    description: '+1 to Stability Roll\n-1 to Corruption Roll\nImmune to Data Drought and Inferno Protocol.',
    rarity: common(i + 2) as CardRarity, daemonType: 'FIREWALL' as const,
    prosperityBonus: 1, corruptionPenalty: -1,
    flavourText: 'The first line of defence. And the last.',
  })),
  // Encryption ×3 — P&P Sewers (+1 Prosperity, -1 Plague; immune to Flood)
  ...Array(3).fill(null).map((_, i) => ({
    id: uid(), name: 'Encryption', category: 'DAEMON' as const,
    description: '+1 to Stability Roll\n-1 to Corruption Roll\nImmune to Data Flood.',
    rarity: common(i + 2) as CardRarity, daemonType: 'ENCRYPTION' as const,
    prosperityBonus: 1, corruptionPenalty: -1,
    flavourText: 'Unreadable. Untouchable.',
  })),
  // Hardened Node ×5 — P&P City Walls (+1 Prosperity, -1 Plague; immune to Viking Raid & war losses)
  ...Array(5).fill(null).map((_, i) => ({
    id: uid(), name: 'Hardened Node', category: 'DAEMON' as const,
    description: '+1 to Stability Roll\n-1 to Corruption Roll\nImmune to Raid Protocol.\nReduces war losses by 5.',
    rarity: common(i + 1) as CardRarity, daemonType: 'HARDENED_NODE' as const,
    prosperityBonus: 1, corruptionPenalty: -1,
    flavourText: 'Built to survive the end of the net.',
  })),
];

// ── Assembly & shuffle ────────────────────────────────────────────────────────

export const generateDeck = (): Card[] => {
  const all = [
    ...creditCards,    // 12
    ...positiveEvents, //  6
    ...negativeEvents, // 32
    ...warCards,       //  7
    ...counterCards,   //  9
    ...daemonCards,    // 12  → total: 78
  ];
  return shuffle(all);
};

export const shuffle = <T>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
