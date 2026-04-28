// src/ui/TutorialOverlay.tsx
import React from 'react';
import { useGameStore } from '../state/useGameStore';
import { TUTORIAL_STEPS } from '../data/tutorial';
import { sfxShowModal } from '../lib/audio';

export const TutorialOverlay: React.FC = () => {
  const tutorialStep = useGameStore(s => s.tutorialStep);
  const counterPending = useGameStore(s => s.counterPending);
  const warIncomingReveal = useGameStore(s => s.warIncomingReveal);
  const resetToSetup = useGameStore(s => s.resetToSetup);

  if (tutorialStep === null) return null;

  const step = TUTORIAL_STEPS[tutorialStep];
  if (!step) return null;

  const isComplete = tutorialStep === 8;
  const hidePanel = !isComplete && (counterPending !== null || warIncomingReveal !== null);

  if (isComplete) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(2,4,12,0.94)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 600, fontFamily: 'monospace',
      }}>
        <div style={{
          border: '1px solid #00ffcc55',
          background: 'rgba(5,10,20,0.99)',
          padding: '2.5rem 3rem',
          maxWidth: 420, width: '90%',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.45rem', letterSpacing: 6, color: '#00ffcc33', marginBottom: '1rem' }}>
            TUTORIAL COMPLETE
          </div>
          <div style={{ fontSize: '1.1rem', letterSpacing: 4, color: '#00ffcc', marginBottom: '1.5rem' }}>
            {step.title}
          </div>
          <p style={{
            fontSize: '0.7rem', color: '#557766', lineHeight: 1.8,
            letterSpacing: 1, margin: '0 0 2rem',
          }}>
            {step.body}
          </p>
          <button
            onClick={() => { sfxShowModal(); resetToSetup(); }}
            style={{
              padding: '0.65rem 2rem',
              background: '#00ffcc11',
              border: '1px solid #00ffcc',
              color: '#00ffcc',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              letterSpacing: 4,
              cursor: 'pointer',
            }}
            className="crg-btn-cyan"
          >
            RETURN TO SETUP →
          </button>
        </div>
      </div>
    );
  }

  if (hidePanel) return null;

  return (
    <div style={{
      position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: 50,
      fontFamily: 'monospace',
      pointerEvents: 'none',
      width: 'min(480px, 92vw)',
    }}>
      <div style={{
        background: 'rgba(2,4,12,0.88)',
        border: '1px solid #00ffcc33',
        padding: '0.6rem 1rem',
        display: 'flex', flexDirection: 'column', gap: '0.25rem',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.45rem', letterSpacing: 5, color: '#00ffcc44' }}>
            TUTORIAL · STEP {tutorialStep + 1} / 8
          </span>
          <span style={{ fontSize: '0.55rem', letterSpacing: 2, color: '#00ffcc99' }}>
            {step.title}
          </span>
        </div>
        <div style={{ height: '1px', background: '#00ffcc18', margin: '0.1rem 0' }} />
        <p style={{
          fontSize: '0.65rem', color: '#8baaa0', lineHeight: 1.6,
          letterSpacing: 0.5, margin: 0,
        }}>
          {step.body}
        </p>
        {step.hint && (
          <p style={{
            fontSize: '0.58rem', color: '#446655', lineHeight: 1.5,
            letterSpacing: 0.5, margin: 0,
          }}>
            ↳ {step.hint}
          </p>
        )}
      </div>
    </div>
  );
};
