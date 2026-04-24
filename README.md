# Corrupt Reality

A cyberpunk card game for 2–5 players (one human, the rest AI) built with React, Phaser 3, and Zustand.

## Gameplay

Each turn a player rolls two dice for a Stability Roll that gains or loses credits, draws up to six cards, then plays one card. The goal is to be the last player standing with credits above zero.

**Card categories**

| Category | Effect |
|---|---|
| Credits | Gain cycles (credits) |
| Event Positive | Drain all opponents, Overclock your next roll, or Multithread for extra plays |
| Event Negative | Damage, steal credits, steal daemons, or reset a target with Power Cycle |
| War | Force a dice-off against another player |
| Daemon | Install a persistent daemon that modifies future rolls or provides immunity |
| Counter | React to an incoming attack — shield, cancel, or boost your war roll |

**Corruption mode** activates when The Corruption card is drawn. All subsequent Stability Rolls deal damage instead of granting credits. Daemons protect you by absorbing some of the loss.

**Dead Man's Switch** (optional rule) — a player knocked to zero may fire one final negative card before elimination.

## Stack

- **React 19** — UI overlays, HUD, setup/game-over screens
- **Phaser 3** — card table, animated card objects, LED dice display, player zones
- **Zustand** — single game store; all rules live in `src/state/useGameStore.ts`
- **Vite + TypeScript** — build tooling

## Project structure

```
src/
  data/          card definitions and deck generation
  game/
    objects/     Phaser GameObjects (Card, PlayerZone, LEDDisplay, …)
    scenes/      GameScene — mounts Phaser, subscribes to store
  lib/           analytics, audio, RNG
  state/         useGameStore — full game rules, AI turns, timer scheduler
  types/         shared TypeScript types (GameState, cards, …)
  ui/            React components (HUD, overlays, SetupScreen, GameOverScreen)
```

## Running locally

```bash
npm install
npm run dev
```

```bash
npm run build   # type-check + Vite production build
npm run lint    # ESLint
```

## AI personalities

Each AI opponent is assigned one of three personalities that influence card selection: **Aggressive** (prefers WAR and damage cards), **Cautious** (prioritises daemons and credit income), **Tactical** (scores every card in hand and plays the highest-value option).

## Architecture notes

- All game logic is pure within the Zustand store — `applyCardEffect` returns a result struct rather than mutating shared state, and `markEliminations` threads elimination order through explicitly.
- AI pacing uses a centralized `scheduleAi` / `cancelAllAiTimers` scheduler so pending AI actions are cancelled cleanly on reset or new game.
- Phaser and React communicate through Zustand subscriptions; the scene never calls React methods directly.
