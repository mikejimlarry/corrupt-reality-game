// src/data/deck.ts
import type { Card, CardRarity } from '../types/cards';
import { random } from '../lib/rng';

let _id = 0;
const uid = () => `card_${++_id}`;

const common  = (n: number): CardRarity => n <= 3 ? 'COMMON' : n <= 5 ? 'UNCOMMON' : n <= 7 ? 'RARE' : 'LEGENDARY';

// ── Population (Data Harvest) ───────────────────────────────────────────────
const populationCards: Card[] = [
  ...Array(6).fill(null).map((_, i) => ({
    id: uid(), name: 'Data Harvest', category: 'POPULATION' as const,
    description: 'Extract raw data from the grid. Gain +5 population units.',
    rarity: 'COMMON' as const, amount: 5, cardNumber: i + 1,
    flavourText: 'The net provides. Always.',
  })),
  ...Array(4).fill(null).map((_, i) => ({
    id: uid(), name: 'Neural Uplink', category: 'POPULATION' as const,
    description: 'Synchronise node clusters. Gain +10 population units.',
    rarity: 'UNCOMMON' as const, amount: 10, cardNumber: i + 7,
    flavourText: 'Every mind a server. Every server, a weapon.',
  })),
  ...Array(2).fill(null).map((_, i) => ({
    id: uid(), name: 'Mass Assimilation', category: 'POPULATION' as const,
    description: 'Absorb unaligned factions into your collective. Gain +20 population units.',
    rarity: 'RARE' as const, amount: 20, cardNumber: i + 11,
    flavourText: 'Resistance is a deprecated function.',
  })),
];

// ── Positive Events ─────────────────────────────────────────────────────────
const positiveEvents: Card[] = [
  ...Array(4).fill(null).map((_, i) => ({
    id: uid(), name: 'Black Market Cache', category: 'EVENT_POSITIVE' as const,
    description: 'Locate a hidden supply drop. Gain +5 population units.',
    rarity: 'COMMON' as const, effect: 'GAIN', amount: 5, cardNumber: i + 13,
    flavourText: 'Someone left the back door open.',
  })),
  ...Array(2).fill(null).map((_, i) => ({
    id: uid(), name: 'Corporate Leak', category: 'EVENT_POSITIVE' as const,
    description: 'Exploit a data breach to boost your faction. Gain +10 population units.',
    rarity: 'UNCOMMON' as const, effect: 'GAIN', amount: 10, cardNumber: i + 17,
    flavourText: 'Their loss is your bandwidth.',
  })),
];

// ── Negative Events ─────────────────────────────────────────────────────────
const negativeEvents: Card[] = [
  ...Array(4).fill(null).map((_, i) => ({
    id: uid(), name: 'Malware Injection', category: 'EVENT_NEGATIVE' as const,
    description: 'Deploy corrupted code against a target. They lose 10 population units.',
    rarity: 'COMMON' as const, effect: 'DAMAGE', amount: 10, targetsOther: true,
    cardNumber: i + 19,
    flavourText: 'Polymorphic. Persistent. Lethal.',
  })),
  ...Array(3).fill(null).map((_, i) => ({
    id: uid(), name: 'System Crash', category: 'EVENT_NEGATIVE' as const,
    description: 'Force a critical failure in a target\'s infrastructure. They lose 15 population units.',
    rarity: 'UNCOMMON' as const, effect: 'DAMAGE', amount: 15, targetsOther: true,
    cardNumber: i + 23,
    flavourText: 'Fatal error. No recovery possible.',
  })),
  {
    id: uid(), name: 'Zero-Day Exploit', category: 'EVENT_NEGATIVE' as const,
    description: 'A vulnerability no one saw coming. Target loses 10 population and one improvement.',
    rarity: 'RARE' as const, effect: 'DAMAGE_IMPROVEMENT', amount: 10, targetsOther: true,
    cardNumber: 26,
    flavourText: 'Patch notes: too late.',
  },
  {
    id: uid(), name: 'The Corruption', category: 'EVENT_NEGATIVE' as const,
    description: 'Unleash the virus. Target loses 10 population. Corruption mode begins.',
    rarity: 'LEGENDARY' as const, effect: 'CORRUPTION', amount: 10, targetsOther: true,
    cardNumber: 27,
    flavourText: 'Once it spreads, nothing is clean.',
  },
];

// ── War Cards ───────────────────────────────────────────────────────────────
const warCards: Card[] = [
  ...Array(4).fill(null).map((_, i) => ({
    id: uid(), name: 'Proxy War', category: 'WAR' as const,
    description: 'Instigate conflict. Winner loses 5 units. Loser loses 10 units.',
    rarity: 'COMMON' as const, winnerLoses: 5, loserLoses: 10, cardNumber: i + 28,
    flavourText: 'All wars are fought by someone else.',
  })),
  ...Array(2).fill(null).map((_, i) => ({
    id: uid(), name: 'Grid War', category: 'WAR' as const,
    description: 'Total network assault. Winner loses 5 units. Loser loses 20 units.',
    rarity: 'RARE' as const, winnerLoses: 5, loserLoses: 20, cardNumber: i + 32,
    flavourText: 'Scorched silicon.',
  })),
];

// ── Counter Cards ───────────────────────────────────────────────────────────
const counterCards: Card[] = [
  ...Array(4).fill(null).map((_, i) => ({
    id: uid(), name: 'Firewall Surge', category: 'COUNTER' as const,
    description: 'PASSIVE — Add or subtract 2 from any dice roll.',
    rarity: 'COMMON' as const, counterType: 'TACTICAL_ADVANTAGE' as const,
    cardNumber: i + 34,
    flavourText: 'Control the variance. Control the outcome.',
  })),
  ...Array(2).fill(null).map((_, i) => ({
    id: uid(), name: 'Cease & Desist', category: 'COUNTER' as const,
    description: 'INSTANT — Cancel a War or Hack card before it resolves.',
    rarity: 'UNCOMMON' as const, counterType: 'NEGOTIATE' as const,
    cardNumber: i + 38,
    flavourText: 'The most powerful line of code: null.',
  })),
];

// ── Improvements ────────────────────────────────────────────────────────────
const improvementCards: Card[] = [
  ...Array(3).fill(null).map((_, i) => ({
    id: uid(), name: 'Firewall', category: 'IMPROVEMENT' as const,
    description: '+1 Stability Roll · -1 Corruption Roll\nImmune to Malware & Crash events.',
    rarity: common(i + 3) as CardRarity, improvementType: 'FIREWALL' as const,
    prosperityBonus: 1, corruptionPenalty: -1, cardNumber: i + 40,
    flavourText: 'The first line of defence. And the last.',
  })),
  ...Array(3).fill(null).map((_, i) => ({
    id: uid(), name: 'Encryption', category: 'IMPROVEMENT' as const,
    description: '+1 Stability Roll · -1 Corruption Roll\nImmune to Data Flood events.',
    rarity: common(i + 3) as CardRarity, improvementType: 'ENCRYPTION' as const,
    prosperityBonus: 1, corruptionPenalty: -1, cardNumber: i + 43,
    flavourText: 'Unreadable. Untouchable.',
  })),
  ...Array(3).fill(null).map((_, i) => ({
    id: uid(), name: 'Hardened Node', category: 'IMPROVEMENT' as const,
    description: '+1 Stability Roll · -1 Corruption Roll\nReduces proxy war losses by 5.',
    rarity: common(i + 3) as CardRarity, improvementType: 'HARDENED_NODE' as const,
    prosperityBonus: 1, corruptionPenalty: -1, cardNumber: i + 46,
    flavourText: 'Built to survive the end of the net.',
  })),
];

export const generateDeck = (): Card[] => {
  const all = [
    ...populationCards,
    ...positiveEvents,
    ...negativeEvents,
    ...warCards,
    ...counterCards,
    ...improvementCards,
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
