# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is one human player running a solo card-game session against one to four AI-controlled agents. They choose a handle, opponent count, difficulty, starting cycle total, and optional rules before entering a self-contained match.

## Product Purpose

Corrupt Reality is a cyberpunk survival card game built around calculated attacks, defensive preparation, resource pressure, and controlled randomness. The player's goal is to outlast every rival agent and finish as the final player with cycles remaining.

Success means the player can understand the current phase, make a meaningful tactical choice, resolve the turn without ambiguity, and immediately understand why the game state changed.

## Positioning

The defining mechanism is The Corruption: a legendary card can permanently invert the match's core economy so that future Stability Rolls drain cycles instead of granting them. Persistent daemons then change from economic advantages into protection against that damage, forcing players to reassess established positions mid-session.

The game combines that match-wide state change with reactive counters, targeted attacks, conflict dice-offs, and AI personalities that favour different card-selection strategies.

## Operating Context

- The canonical product is the browser game and installable PWA in the repository root. The separate Unity Android port is outside this product record.
- A match contains two to five agents: one human and one to four AI opponents.
- Play is organized into Stability or Corruption Rolls, drawing up to a six-card hand, playing cards, resolving reactions or targets, and advancing turns until one agent remains.
- A scripted tutorial teaches rolling, drawing, card play, daemons, attacks, counters, conflicts, Quarantine, and The Corruption through guided actions.
- Setup preferences, reduced-motion preference, win/loss history, and recent match records are stored locally in the browser.
- The web experience is designed for fullscreen play and supports desktop, tablet, and phone layouts, with landscape as the installed PWA orientation.

## Capabilities and Constraints

- Card categories include Cycles, positive and negative Events, Conflicts, Daemons, and Counters.
- Four AI personalities—Aggressive, Cautious, Tactical, and Balanced—influence automated card selection. Difficulty is independently configurable.
- Optional rules include Dead Man's Switch, a penalty for tied conflicts, and hiding exact opponent cycle totals.
- Players can pause, replay the same seed, change music, choose between two music tracks, view match statistics, and reduce animation.
- The game is client-side and single-player; it does not provide online multiplayer, user accounts, or cloud-synchronized progress.
- The production web implementation uses React, Phaser, Zustand, Vite, and TypeScript. Game rules live in the Zustand state layer while Phaser renders the table and React owns setup, HUD, overlays, and end-of-game UI.
- Public asset URLs must remain relative to the Vite base so the same build works when hosted below a path prefix.

## Brand Commitments

- The product name is **Corrupt Reality**.
- Cyberpunk system language is part of the product identity. Established terms such as agents, cycles, daemons, Stability Roll, Corruption Roll, Connect, and Reboot should remain internally consistent.
- The voice presents the player as an operative inside a failing network: terse, direct, and tactical rather than explanatory or whimsical.

## Evidence on Hand

- `README.md` documents the current rules, architecture, AI personalities, and local development workflow.
- `src/data/deck.ts` contains the playable card definitions and in-game rules copy.
- `src/data/tutorial.ts` contains the guided tutorial sequence.
- `src/state/useGameStore.ts` and its tests contain the authoritative web-game rules and state transitions.
- `public/icons/` contains the installable-app icon set; `public/sfx/` contains the current music and interface audio.
- `design/mockups/` contains setup-screen, card-system, and game-board layout studies. These are reference assets, not proof of the currently rendered implementation.
- The About screen attributes the two music tracks under the Pixabay Content License and describes the current UI sound pack as non-commercial prototyping material. Future work must preserve accurate attribution and must not imply broader rights without separate evidence.
- No testimonials, press coverage, pricing, sales claims, or audience benchmarks are established in the repository; future product surfaces must not fabricate them.

## Product Principles

1. Make every turn legible: the player should always know the phase, available action, target, and result.
2. Let tactics survive randomness: dice and draws create pressure, while daemons, counters, targeting, and optional rules preserve meaningful agency.
3. Make Corruption a genuine strategic reversal, not merely a palette or presentation change.
4. Teach through play and keep advanced interactions discoverable at the moment they become relevant.
5. Preserve a self-contained browser session with fast setup, local preferences, and immediate replay.

## Accessibility & Inclusion

- Reduced-motion mode must preserve all information and interaction while removing nonessential animation.
- Controls and overlays must remain reachable within safe areas and at compact phone, tablet, and desktop viewport sizes.
- Meaning must not depend on animation, glow, colour, or sound alone.
- No formal accessibility conformance target has been established yet.
