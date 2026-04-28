// src/data/tutorial.ts
// Step definitions and hand-building for the scripted tutorial.

export interface TutorialStep {
  title: string;
  body: string;
  hint?: string;
}

export const TUTORIAL_STEPS: Record<number, TutorialStep> = {
  0: {
    title: 'ROLL THE DICE',
    body: 'Each turn opens with a Stability Roll. Higher totals earn more cycles. Click BEGIN SEQUENCE to start the roll.',
  },
  1: {
    title: 'DRAW YOUR HAND',
    body: 'The roll is done. Now click DRAW CARD to fill your hand to 6 cards.',
    hint: 'The DRAW CARD button appears at the bottom of the screen.',
  },
  2: {
    title: 'PLAY A CARD',
    body: 'Your hand is ready. Play DATA HARVEST to gain +5 cycles.',
    hint: 'Click the card in your hand, then click PLAY CARD.',
  },
  3: {
    title: 'DEPLOY A DAEMON',
    body: 'Now play FIREWALL — a persistent daemon that boosts your roll each turn and blocks certain attacks.',
    hint: 'Click Firewall in your hand, then click PLAY CARD.',
  },
  4: {
    title: 'AI AGENT\'S TURN',
    body: 'The AI agent is taking its turn. Watch it play a CREDITS card — the same mechanics you just used.',
  },
  5: {
    title: 'ATTACK AN OPPONENT',
    body: 'Roll and draw, then play MEMORY LEAK to drain 5 cycles from the AI agent.',
    hint: 'Click the card, click PLAY CARD, then click the target.',
  },
  6: {
    title: 'INCOMING CONFLICT',
    body: 'The AI is launching a Conflict. A counter window will appear — use FIREWALL SURGE for +1 to your roll, or decline to proceed.',
  },
  7: {
    title: 'ARM A QUARANTINE',
    body: 'Roll and draw, then play QUARANTINE to arm a standing block. The next conflict targeting you is automatically cancelled.',
    hint: 'Quarantine arms on you — no target selection needed.',
  },
  8: {
    title: 'QUARANTINE ARMED',
    body: 'The AI is attacking again. Your Quarantine block will fire automatically — no action needed.',
  },
  9: {
    title: 'TUTORIAL COMPLETE',
    body: 'You\'ve seen every core mechanic: rolling, drawing, credits, daemons, attacks, counters, and Quarantine blocks. Ready to run the net for real?',
  },
};

/** Cards that the human MUST play at each step (undefined = no restriction). */
export const TUTORIAL_REQUIRED_CARD: Record<number, string | undefined> = {
  2: 'Data Harvest',
  3: 'Firewall',
  5: 'Memory Leak',
  7: 'Quarantine',
};

/** Cards the AI is scripted to play at each step (undefined = normal AI logic). */
export const TUTORIAL_AI_CARD: Record<number, string | undefined> = {
  4: 'Neural Uplink',
  6: 'Skirmish',
  8: 'Skirmish',
};
