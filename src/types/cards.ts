// src/types/cards.ts

export type CardCategory =
  | 'POPULATION'
  | 'EVENT_POSITIVE'
  | 'EVENT_NEGATIVE'
  | 'WAR'
  | 'COUNTER'
  | 'IMPROVEMENT';

export interface BaseCard {
  id: string;
  name: string;
  category: CardCategory;
  description: string;
}

export interface PopulationCard extends BaseCard {
  category: 'POPULATION';
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
}

export interface WarCard extends BaseCard {
  category: 'WAR';
  winnerLoses: number;
  loserLoses: number;
}

export interface CounterCard extends BaseCard {
  category: 'COUNTER';
  counterType: 'TACTICAL_ADVANTAGE' | 'NEGOTIATE';
}

export type ImprovementType = 'FIREWALL' | 'ENCRYPTION' | 'HARDENED_NODE';

export interface ImprovementCard extends BaseCard {
  category: 'IMPROVEMENT';
  improvementType: ImprovementType;
  prosperityBonus: number;
  corruptionPenalty: number;
}

export type Card =
  | PopulationCard
  | PositiveEventCard
  | NegativeEventCard
  | WarCard
  | CounterCard
  | ImprovementCard;
