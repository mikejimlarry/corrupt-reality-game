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
    hint: 'Click the card in your hand, then click PLAY.',
  },
  3: {
    title: 'AI AGENT\'S TURN',
    body: 'The AI agent takes its turn now. Watch how it plays its hand — the same mechanics you just used.',
  },
  4: {
    title: 'DEPLOY A DAEMON',
    body: 'Back to your turn. Roll and draw, then play FIREWALL — a persistent daemon that boosts your roll each turn and blocks certain attacks.',
    hint: 'Click Firewall in your hand, then click PLAY.',
  },
  5: {
    title: 'AI AGENT\'S TURN',
    body: 'The AI agent takes another turn. After it finishes, you\'ll get to launch your first attack.',
  },
  6: {
    title: 'ATTACK AN OPPONENT',
    body: 'Roll and draw, then play MEMORY LEAK to drain 5 cycles from the AI agent.',
    hint: 'Click the card, click PLAY, then click the target.',
  },
  7: {
    title: 'LAUNCH A WAR',
    body: 'You have a SKIRMISH card. WAR cards force two players into a dice-off — higher roll wins, both sides take cycle losses. Before the roll, each combatant can play FIREWALL SURGE to boost their result. Play SKIRMISH now.',
    hint: 'With only one opponent, the combatants are picked automatically.',
  },
  8: {
    title: 'INCOMING CONFLICT',
    body: 'The AI is launching a Conflict. A counter window will appear — use FIREWALL SURGE for +1 to your roll, or decline to proceed.',
  },
  9: {
    title: 'ARM A QUARANTINE',
    body: 'Roll and draw, then play QUARANTINE to arm a standing block. The next conflict targeting you is automatically cancelled.',
    hint: 'Quarantine arms on you — no target selection needed.',
  },
  10: {
    title: 'QUARANTINE ARMED',
    body: 'The AI is attacking again. Your Quarantine block will fire automatically — no action needed.',
  },
  11: {
    title: 'THE CORRUPTION',
    body: 'This turn you\'ll draw THE CORRUPTION — a Legendary card that triggers automatically when drawn. It deals -10 cycles to a target you choose, then permanently shifts all Stability Rolls to Corruption Rolls that drain cycles instead of earning them. Daemons now shield you from corruption damage.',
    hint: 'Roll and draw. The Corruption triggers automatically and will prompt you to pick a target.',
  },
  12: {
    title: 'TUTORIAL COMPLETE',
    body: 'You\'ve seen every core mechanic: rolling, drawing, cycles, daemons, attacks, counters, WAR dice-offs, Quarantine blocks, and Corruption. Ready to run the net for real?',
  },
};

/** Cards that the human MUST play at each step (undefined = no restriction). */
export const TUTORIAL_REQUIRED_CARD: Record<number, string | undefined> = {
  2: 'Data Harvest',
  4: 'Firewall',
  6: 'Memory Leak',
  7: 'Skirmish',
  9: 'Quarantine',
};

/** Cards the AI is scripted to play at each step (undefined = normal AI logic). */
export const TUTORIAL_AI_CARD: Record<number, string | undefined> = {
  3: 'Neural Uplink',
  5: 'Data Harvest',
  8: 'Skirmish',
  10: 'Skirmish',
};
