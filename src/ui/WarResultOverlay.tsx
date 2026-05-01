// src/ui/WarResultOverlay.tsx
import React from 'react';
import { useGameStore } from '../state/useGameStore';
import { sfxNavClick } from '../lib/audio';

export const WarResultOverlay: React.FC = () => {
  const result          = useGameStore(s => s.warResultPending);
  const corruption      = useGameStore(s => s.globalCorruptionMode);
  const dismissWarResult = useGameStore(s => s.dismissWarResult);

  if (!result) return null;

  const { humanWon, isTie, actorName, targetName, actorRoll, actorBonus, targetRoll, targetBonus,
    humanIsActor, humanCycleLoss, opponentCycleLoss, tieCycleLoss } = result;

  const humanName     = humanIsActor ? actorName : targetName;
  const opponentName  = humanIsActor ? targetName : actorName;
  const humanRollBase = humanIsActor ? actorRoll : targetRoll;
  const humanBonus    = humanIsActor ? actorBonus : targetBonus;
  const oppRollBase   = humanIsActor ? targetRoll : actorRoll;
  const oppBonus      = humanIsActor ? targetBonus : actorBonus;
  const humanTotal    = humanRollBase + humanBonus;
  const oppTotal      = oppRollBase + oppBonus;

  const WIN_ACCENT  = '#00ffcc';
  const LOSS_ACCENT = '#ff1e3c';
  const TIE_ACCENT  = '#ffaa00';
  const ACCENT      = isTie ? TIE_ACCENT : (humanWon ? WIN_ACCENT : LOSS_ACCENT);
  const DIM         = isTie ? '#554400' : (humanWon ? '#00ffcc22' : '#66000a');
  const baseAccent  = corruption && !humanWon ? LOSS_ACCENT : ACCENT;

  const headline = isTie ? 'DEADLOCK' : (humanWon ? 'DOMINANCE' : 'BREACH DETECTED');

  const handleContinue = () => {
    sfxNavClick();
    dismissWarResult();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(2,4,12,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 350,
      fontFamily: 'monospace',
    }}>
      {/* Vignette for loss */}
      {!humanWon && !isTie && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          boxShadow: 'inset 0 0 120px 50px rgba(200,0,30,0.35)',
        }} />
      )}

      <div style={{
        border: `1px solid ${baseAccent}55`,
        background: 'rgba(4,8,18,0.99)',
        padding: '2rem 2.5rem',
        maxWidth: 400,
        width: '90%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        boxShadow: `0 0 40px ${baseAccent}22`,
        position: 'relative',
      }}>

        {/* Headline */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.45rem', letterSpacing: 6, color: `${baseAccent}55`, marginBottom: '0.5rem' }}>
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
            <div style={{ fontSize: '0.5rem', letterSpacing: 3, color: `${WIN_ACCENT}66`, marginBottom: '0.3rem' }}>
              {humanName}
            </div>
            <div style={{ fontSize: '2rem', color: humanWon && !isTie ? WIN_ACCENT : '#aabbcc', fontWeight: 'bold' }}>
              {humanTotal}
            </div>
            {humanBonus > 0 && (
              <div style={{ fontSize: '0.5rem', color: `${WIN_ACCENT}55`, letterSpacing: 2 }}>
                {humanRollBase} +{humanBonus}
              </div>
            )}
          </div>

          {/* VS */}
          <div style={{ fontSize: '0.65rem', color: '#334455', letterSpacing: 2 }}>VS</div>

          {/* Opponent roll */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.5rem', letterSpacing: 3, color: `${LOSS_ACCENT}55`, marginBottom: '0.3rem' }}>
              {opponentName}
            </div>
            <div style={{ fontSize: '2rem', color: !humanWon && !isTie ? LOSS_ACCENT : '#aabbcc', fontWeight: 'bold' }}>
              {oppTotal}
            </div>
            {oppBonus > 0 && (
              <div style={{ fontSize: '0.5rem', color: `${LOSS_ACCENT}44`, letterSpacing: 2 }}>
                {oppRollBase} +{oppBonus}
              </div>
            )}
          </div>
        </div>

        {/* Cycle losses */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {isTie && tieCycleLoss != null && tieCycleLoss > 0 && (
            <div style={{ fontSize: '0.62rem', color: `${TIE_ACCENT}bb`, letterSpacing: 2, textAlign: 'center' }}>
              BOTH LOSE {tieCycleLoss} CYCLES
            </div>
          )}
          {!isTie && (
            <>
              {humanCycleLoss > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '0.6rem', letterSpacing: 2,
                  color: humanWon ? `${WIN_ACCENT}77` : `${LOSS_ACCENT}cc`,
                }}>
                  <span>{humanName}</span>
                  <span>-{humanCycleLoss} ⟳</span>
                </div>
              )}
              {opponentCycleLoss > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '0.6rem', letterSpacing: 2,
                  color: humanWon ? `${WIN_ACCENT}cc` : `${LOSS_ACCENT}77`,
                }}>
                  <span>{opponentName}</span>
                  <span>-{opponentCycleLoss} ⟳</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Continue button */}
        <button
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
          }}
          className="crg-btn-cyan"
        >
          CONTINUE →
        </button>
      </div>
    </div>
  );
};
