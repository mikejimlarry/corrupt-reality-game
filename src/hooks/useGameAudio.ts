// src/hooks/useGameAudio.ts
// Subscribes to game state and fires chiptune SFX at the right moments.
import { useEffect, useRef } from 'react';
import { useGameStore } from '../state/useGameStore';
import {
  sfxDraw, sfxGain, sfxLoss, sfxAttack,
  sfxDaemon, sfxTurnStart, sfxWar, sfxRollStart,
  sfxWin, sfxGameOver, sfxWarWin, sfxWarLoss,
  sfxCorruptionActivate, sfxDaemonTerminated,
} from '../lib/audio';

export function useGameAudio() {
  const phase       = useGameStore(s => s.phase);
  const players     = useGameStore(s => s.players);
  const discard     = useGameStore(s => s.discard);
  const rollTriggered = useGameStore(s => s.rollTriggered);
  const corruption  = useGameStore(s => s.globalCorruptionMode);
  const winnerId    = useGameStore(s => s.winnerId);

  const warRollDisplay = useGameStore(s => s.warRollDisplay);

  const prevPhase         = useRef(phase);
  const prevDiscardLen    = useRef(discard.length);
  const prevCorruption    = useRef(corruption);
  const prevHandLen       = useRef<number | null>(null);
  const prevRollTriggered = useRef(rollTriggered);
  const prevWarRoll       = useRef(warRollDisplay);

  // Track per-player credits and daemon counts to detect changes
  const prevCredits = useRef<Map<string, number>>(new Map());
  const prevDaemons = useRef<Map<string, number>>(new Map());

  // ── Phase changes ────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === prevPhase.current) return;
    const prev = prevPhase.current;
    prevPhase.current = phase;

    if (phase === 'PHASE_ROLL' && prev !== 'SETUP') sfxTurnStart();
    if (phase === 'GAME_OVER') {
      const human = players.find(p => p.isHuman);
      if (winnerId && human?.id === winnerId) sfxWin();
      else sfxGameOver();
    }
  }, [phase, players, winnerId]);

  // ── WAR result — play win/loss sound from the human's perspective ────────
  useEffect(() => {
    if (warRollDisplay && !prevWarRoll.current) {
      const human = players.find(p => p.isHuman);
      if (human) {
        const humanIsActor = warRollDisplay.actorName === human.name;
        const humanIsTarget = warRollDisplay.targetName === human.name;
        if (humanIsActor || humanIsTarget) {
          const humanWon = humanIsActor ? warRollDisplay.actorWins : !warRollDisplay.actorWins;
          if (humanWon) sfxWarWin(); else sfxWarLoss();
        }
      }
    }
    prevWarRoll.current = warRollDisplay;
  }, [warRollDisplay, players]);

  // ── Roll triggered ────────────────────────────────────────────────────────
  useEffect(() => {
    if (rollTriggered && !prevRollTriggered.current) sfxRollStart();
    prevRollTriggered.current = rollTriggered;
  }, [rollTriggered]);

  // ── Corruption activated ─────────────────────────────────────────────────
  useEffect(() => {
    if (corruption && !prevCorruption.current) sfxCorruptionActivate();
    prevCorruption.current = corruption;
  }, [corruption]);

  // ── Discard pile changes → card played ───────────────────────────────────
  useEffect(() => {
    if (discard.length <= prevDiscardLen.current) {
      prevDiscardLen.current = discard.length;
      return;
    }
    prevDiscardLen.current = discard.length;
    const top = discard[discard.length - 1];
    if (!top) return;
    if (top.category === 'WAR') {
      sfxWar();
    } else if (top.category === 'EVENT_NEGATIVE') {
      sfxAttack();
    }
    // Other categories: no play sound (credit gain SFX covers those via credit change)
  }, [discard]);

  // ── Hand size increase → card drawn ─────────────────────────────────────
  useEffect(() => {
    const human = players.find(p => p.isHuman);
    const len = human?.hand.length ?? 0;
    if (prevHandLen.current !== null && len > prevHandLen.current) {
      sfxDraw();
    }
    prevHandLen.current = len;
  }, [players]);

  // ── Credit and daemon changes ─────────────────────────────────────────────
  useEffect(() => {
    let playedGain  = false;
    let playedLoss  = false;
    let playedDaemon = false;

    players.forEach(p => {
      const prevC = prevCredits.current.get(p.id) ?? p.credits;
      const prevD = prevDaemons.current.get(p.id) ?? p.daemons.length;

      if (p.credits > prevC && !playedGain) {
        sfxGain();
        playedGain = true;
      } else if (p.credits < prevC && !playedLoss) {
        sfxLoss();
        playedLoss = true;
      }

      if (p.daemons.length > prevD && !playedDaemon) {
        sfxDaemon();
        playedDaemon = true;
      } else if (p.daemons.length < prevD) {
        sfxDaemonTerminated();
      }

      prevCredits.current.set(p.id, p.credits);
      prevDaemons.current.set(p.id, p.daemons.length);
    });
  }, [players]);
}
