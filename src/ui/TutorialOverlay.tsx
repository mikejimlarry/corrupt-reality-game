// src/ui/TutorialOverlay.tsx
import React from 'react';
import { useGameStore } from '../state/useGameStore';
import { TUTORIAL_STEPS } from '../data/tutorial';
import { sfxNavClick } from '../lib/audio';

export const TutorialOverlay: React.FC = () => {
  const tutorialStep      = useGameStore(s => s.tutorialStep);
  const tutorialModalOpen = useGameStore(s => s.tutorialModalOpen);
  const counterPending    = useGameStore(s => s.counterPending);
  const warIncomingReveal = useGameStore(s => s.warIncomingReveal);
  const dismissTutorialModal = useGameStore(s => s.dismissTutorialModal);
  const resetToSetup         = useGameStore(s => s.resetToSetup);

  if (tutorialStep === null) return null;
  if (!tutorialModalOpen) return null;
  // Let the counter window have full focus
  if (counterPending !== null || warIncomingReveal !== null) return null;

  const step = TUTORIAL_STEPS[tutorialStep];
  if (!step) return null;

  const isComplete = tutorialStep === 8;

  const handleNext = () => {
    sfxNavClick();
    if (isComplete) {
      resetToSetup();
    } else {
      dismissTutorialModal();
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(2,4,12,0.82)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 400,
      fontFamily: 'monospace',
    }}>
      <div style={{
        border: '1px solid #00ffcc44',
        background: 'rgba(5,10,20,0.98)',
        padding: '2rem 2.5rem',
        maxWidth: 420,
        width: '90%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        {/* Step counter */}
        {!isComplete && (
          <div style={{ fontSize: '0.45rem', letterSpacing: 6, color: '#00ffcc33' }}>
            TUTORIAL · STEP {tutorialStep + 1} / 8
          </div>
        )}
        {isComplete && (
          <div style={{ fontSize: '0.45rem', letterSpacing: 6, color: '#00ffcc33' }}>
            TUTORIAL COMPLETE
          </div>
        )}

        {/* Title */}
        <div style={{ fontSize: '0.9rem', letterSpacing: 4, color: '#00ffcc' }}>
          {step.title}
        </div>

        {/* Body */}
        <p style={{
          fontSize: '0.7rem', color: '#8baaa0', lineHeight: 1.8,
          letterSpacing: 0.5, margin: 0,
        }}>
          {step.body}
        </p>

        {/* Hint */}
        {step.hint && (
          <p style={{
            fontSize: '0.62rem', color: '#446655', lineHeight: 1.6,
            letterSpacing: 0.5, margin: 0,
            borderLeft: '2px solid #00ffcc22',
            paddingLeft: '0.6rem',
          }}>
            {step.hint}
          </p>
        )}

        {/* Button */}
        <button
          onClick={handleNext}
          style={{
            marginTop: '0.25rem',
            padding: '0.6rem 1.5rem',
            background: '#00ffcc11',
            border: '1px solid #00ffcc',
            color: '#00ffcc',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            letterSpacing: 4,
            cursor: 'pointer',
            alignSelf: 'flex-end',
            transition: 'all 0.15s',
          }}
          className="crg-btn-cyan"
        >
          {isComplete ? 'RETURN TO SETUP →' : 'NEXT →'}
        </button>
      </div>
    </div>
  );
};
