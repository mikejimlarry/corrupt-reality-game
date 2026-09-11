// src/ui/WarResultOverlay.tsx
import React from 'react';
import { useGameStore } from '../state/useGameStore';
import { OverlayShell } from './OverlayShell';

const WAR_RESULT_CSS = `
@keyframes war-result-unfold {
  0%   { opacity: 0; transform: perspective(900px) rotateX(-55deg) scaleY(0.6); }
  60%  { opacity: 1; transform: perspective(900px) rotateX(6deg)   scaleY(1.01); }
  80%  { transform: perspective(900px) rotateX(-3deg) scaleY(0.99); }
  100% { opacity: 1; transform: perspective(900px) rotateX(0deg)   scaleY(1); }
}
.war-result-panel {
  animation: war-result-unfold 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
  transform-origin: top center;
}
`;
import { sfxNavClick } from '../lib/audio';

export const WarResultOverlay: React.FC = () => {
  const result          = useGameStore(s => s.warResultPending);
  const corruption      = useGameStore(s => s.globalCorruptionMode);
  const dismissWarResult = useGameStore(s => s.dismissWarResult);
  const reducedMotion = useGameStore(s => s.reducedMotion);

  if (!result) return null;

  const { humanWon, isTie, actorName, targetName, actorRoll, actorBonus, targetRoll, targetBonus,
    humanIsActor, humanCycleLoss, opponentCycleLoss, humanCyclesAfter, opponentCyclesAfter,
    tieCycleLoss } = result;

  const humanName     = humanIsActor ? actorName : targetName;
  const opponentName  = humanIsActor ? targetName : actorName;
  const humanRollBase = humanIsActor ? actorRoll : targetRoll;
  const humanBonus    = humanIsActor ? actorBonus : targetBonus;
  const oppRollBase   = humanIsActor ? targetRoll : actorRoll;
  const oppBonus      = humanIsActor ? targetBonus : actorBonus;
  const humanTotal    = humanRollBase + humanBonus;
  const oppTotal      = oppRollBase + oppBonus;
  const humanCyclesBefore = humanCyclesAfter + humanCycleLoss;
  const opponentCyclesBefore = opponentCyclesAfter + opponentCycleLoss;

  const WIN_ACCENT  = '#00ffcc';
  const LOSS_ACCENT = '#ff1e3c';
  const TIE_ACCENT  = '#ffaa00';
  const ACCENT      = isTie ? TIE_ACCENT : (humanWon ? WIN_ACCENT : LOSS_ACCENT);
  const DIM         = isTie ? '#554400' : (humanWon ? '#00ffcc22' : '#66000a');
  const baseAccent  = corruption && !humanWon ? LOSS_ACCENT : ACCENT;

  const headline = isTie ? 'DEADLOCK' : (humanWon ? 'DOMINANCE' : 'BREACH DETECTED');
  const winnerName = humanWon ? humanName : opponentName;
  const winnerTotal = humanWon ? humanTotal : oppTotal;
  const loserTotal = humanWon ? oppTotal : humanTotal;
  const describeLoss = (name: string, amount: number) => amount > 0
    ? `${name} loses ${amount} cycles.`
    : `${name} loses no cycles.`;
  const resultSummary = isTie
    ? tieCycleLoss != null && tieCycleLoss > 0
      ? `Rolls tied at ${humanTotal}. Both combatants lose ${tieCycleLoss} cycles.`
      : `Rolls tied at ${humanTotal}. No cycles are lost.`
    : `${winnerName} wins the roll, ${winnerTotal} to ${loserTotal}. ${describeLoss(humanName, humanCycleLoss)} ${describeLoss(opponentName, opponentCycleLoss)}`;

  const handleContinue = () => {
    sfxNavClick();
    dismissWarResult();
  };

  return (
    <>
    <style>{WAR_RESULT_CSS}</style>
    <OverlayShell
      ariaLabel="Conflict result"
      background={!humanWon && !isTie
        ? 'radial-gradient(circle, transparent 35%, color-mix(in srgb, var(--crg-corruption) 22%, transparent)), rgba(2,4,12,0.88)'
        : 'rgba(2,4,12,0.88)'}
      zIndex={350}
      maxWidth={400}
      panelClassName={reducedMotion ? undefined : 'war-result-panel'}
      panelStyle={{
          border: `1px solid ${baseAccent}55`,
          background: 'rgba(4,8,18,0.99)',
          padding: '2rem 2.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          boxShadow: `0 0 40px ${baseAccent}22`,
          position: 'relative',
          maxHeight: '100%',
          overflowY: 'auto',
          boxSizing: 'border-box',
      }}
    >

        {/* Headline */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', letterSpacing: 4, color: baseAccent, marginBottom: '0.5rem' }}>
            WAR RESOLVED
          </div>
          <div style={{
            fontSize: isTie ? '1.4rem' : '1.8rem',
            fontWeight: 'bold',
            letterSpacing: isTie ? 4 : 6,
            color: baseAccent,
            textShadow: `0 0 20px ${baseAccent}88`,
          }}>
            {headline}
          </div>
        </div>

        <p style={{
          margin: 0,
          color: 'var(--crg-body)',
          fontSize: '0.8rem',
          lineHeight: 1.6,
          textAlign: 'center',
        }}>
          {resultSummary}
        </p>

        {/* Roll comparison */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          borderTop: `1px solid ${DIM}`,
          borderBottom: `1px solid ${DIM}`,
          padding: '0.9rem 0',
        }}>
          {/* Human roll */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.75rem', letterSpacing: 2, color: WIN_ACCENT, marginBottom: '0.3rem' }}>
              {humanName}
            </div>
            <div style={{ fontSize: 'clamp(1.5rem, 7vw, 3rem)', color: humanWon && !isTie ? WIN_ACCENT : 'var(--crg-text)', fontWeight: 'bold' }}>
              {humanTotal}
            </div>
            {humanBonus > 0 && (
              <div style={{ fontSize: '0.75rem', color: WIN_ACCENT, letterSpacing: 2 }}>
                {humanRollBase} +{humanBonus}
              </div>
            )}
          </div>

          {/* VS */}
          <div style={{ fontSize: '0.75rem', color: 'var(--crg-muted)', letterSpacing: 2 }}>VS</div>

          {/* Opponent roll */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.75rem', letterSpacing: 2, color: LOSS_ACCENT, marginBottom: '0.3rem' }}>
              {opponentName}
            </div>
            <div style={{ fontSize: 'clamp(1.5rem, 7vw, 3rem)', color: !humanWon && !isTie ? LOSS_ACCENT : 'var(--crg-text)', fontWeight: 'bold' }}>
              {oppTotal}
            </div>
            {oppBonus > 0 && (
              <div style={{ fontSize: '0.75rem', color: LOSS_ACCENT, letterSpacing: 2 }}>
                {oppRollBase} +{oppBonus}
              </div>
            )}
          </div>
        </div>

        {/* Cycle losses */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', gap: '1rem',
            fontSize: '0.75rem', letterSpacing: 1,
            color: isTie ? TIE_ACCENT : WIN_ACCENT,
          }}>
            <span>{humanName}</span>
            <span>{humanCyclesBefore} → {humanCyclesAfter} ({humanCycleLoss > 0 ? `−${humanCycleLoss}` : 'NO LOSS'})</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', gap: '1rem',
            fontSize: '0.75rem', letterSpacing: 1,
            color: isTie ? TIE_ACCENT : LOSS_ACCENT,
          }}>
            <span>{opponentName}</span>
            <span>{opponentCyclesBefore} → {opponentCyclesAfter} ({opponentCycleLoss > 0 ? `−${opponentCycleLoss}` : 'NO LOSS'})</span>
          </div>
        </div>

        {/* Continue button */}
        <button
          type="button"
          onClick={handleContinue}
          style={{
            marginTop: '0.25rem',
            padding: '0.6rem 1.5rem',
            background: `${baseAccent}11`,
            border: `1px solid ${baseAccent}`,
            color: baseAccent,
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            letterSpacing: 4,
            cursor: 'pointer',
            alignSelf: 'flex-end',
            transition: 'all 0.15s',
            minHeight: 44,
          }}
          className="crg-btn-cyan"
        >
          CONTINUE →
        </button>
    </OverlayShell>
    </>
  );
};
