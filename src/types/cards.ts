// src/types/cards.ts

export type CardCategory =
  | 'CREDITS'
  | 'EVENT_POSITIVE'
  | 'EVENT_NEGATIVE'
  | 'WAR'
  | 'COUNTER'
  | 'DAEMON';

export type CardRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';

export interface BaseCard {
  id: string;
  name: string;
  category: CardCategory;
  description: string;
  rarity: CardRarity;
  flavourText?: string;
  cardNumber?: number;
}

export interface CreditsCard extends BaseCard {
  category: 'CREDITS';
  amount: number;
}

export interface PositiveEventCard extends BaseCard {
  category: 'EVENT_POSITIVE';
  effect: string;
  amount: number;
}

export interface NegativeEventCard extends BaseCard {
  category: 'EVENT_NEGATIVE';
  effect: string;
  amount: number;
  targetsOther: boolean;
  /** If set, a target who owns this daemon type is completely immune to this card. */
  immuneDaemon?: 'FIREWALL' | 'ENCRYPTION' | 'HARDENED_NODE';
}

export interface WarCard extends BaseCard {
  category: 'WAR';
  winnerLoses: number;
  loserLoses: number;
  /** When true the loser also loses one random daemon (Grid Conflict). */
  loserLosesImprovement?: boolean;
}

export interface CounterCard extends BaseCard {
  category: 'COUNTER';
  counterType: 'TACTICAL_ADVANTAGE' | 'NEGOTIATE' | 'SHIELD';
}

export type DaemonType = 'FIREWALL' | 'ENCRYPTION' | 'HARDENED_NODE';

export interface DaemonCard extends BaseCard {
  category: 'DAEMON';
  daemonType: DaemonType;
  prosperityBonus: number;
  corruptionPenalty: number;
}

export type Card =
  | CreditsCard
  | PositiveEventCard
  | NegativeEventCard
  | WarCard
  | CounterCard
  | DaemonCard;
