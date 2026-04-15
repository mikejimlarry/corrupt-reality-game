// src/ui/AboutModal.tsx
import React from 'react';

interface Props {
  onClose: () => void;
}

export const AboutModal: React.FC<Props> = ({ onClose }) => (
  <div
    style={{
      position: 'fixed', inset: 0,
      background: 'rgba(2,4,12,0.96)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 500,
      fontFamily: 'monospace',
    }}
    onClick={onClose}
  >
    <div
      style={{
        border: '1px solid #00ffcc33',
        background: 'rgba(5,10,20,0.98)',
        padding: '2rem 2.5rem',
        maxWidth: 480,
        width: '90%',
        color: '#00ffcc',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ fontSize: '0.5rem', letterSpacing: 6, color: '#00ffcc44', marginBottom: '0.4rem' }}>
        SYSTEM INFO
      </div>
      <h2 style={{ margin: '0 0 1.5rem', fontSize: '1rem', letterSpacing: 4, color: '#00ffcc' }}>
        CORRUPT REALITY
      </h2>

      {/* Game blurb */}
      <p style={{ fontSize: '0.65rem', color: '#446655', letterSpacing: 1, lineHeight: 1.8, margin: '0 0 1.5rem' }}>
        A cyberpunk card game of survival, corruption, and calculated betrayal.
        Outmanoeuvre rival agents, deploy daemons, and be the last operative standing
        when the system collapses.
      </p>

      <div style={{ borderBottom: '1px solid #00ffcc11', marginBottom: '1.5rem' }} />

      {/* Credits */}
      <div style={{ fontSize: '0.5rem', letterSpacing: 4, color: '#00ffcc33', marginBottom: '0.75rem' }}>
        CREDITS
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '1.5rem' }}>

        <div>
          <div style={{ fontSize: '0.55rem', color: '#557766', letterSpacing: 2, marginBottom: '0.2rem' }}>
            GAME DESIGN &amp; DEVELOPMENT
          </div>
          <div style={{ fontSize: '0.7rem', color: '#00ffcc99', letterSpacing: 1 }}>
            Corrupt Reality Team
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.55rem', color: '#557766', letterSpacing: 2, marginBottom: '0.2rem' }}>
            BACKGROUND MUSIC
          </div>
          <div style={{ fontSize: '0.7rem', color: '#00ffcc99', letterSpacing: 1, marginBottom: '0.25rem' }}>
            "The Mountain" — Suspense / Cyberpunk
          </div>
          <div style={{ fontSize: '0.6rem', color: '#446655', letterSpacing: 0.5, lineHeight: 1.7 }}>
            by{' '}
            <a
              href="https://pixabay.com/music/ambient-suspense-cyberpunk-375986/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#00ffcc66', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              Pixabay / Ambient Suspense Cyberpunk
            </a>
            <br />
            Licensed under the{' '}
            <a
              href="https://pixabay.com/service/license-summary/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#00ffcc66', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              Pixabay Content License
            </a>
            . Free for commercial and non-commercial use.
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.55rem', color: '#557766', letterSpacing: 2, marginBottom: '0.2rem' }}>
            UI SOUND EFFECTS
          </div>
          <div style={{ fontSize: '0.6rem', color: '#446655', letterSpacing: 0.5, lineHeight: 1.7 }}>
            Steam Deck UI SFX Pack — Valve Corporation.<br />
            Used for non-commercial game audio prototyping.
          </div>
        </div>

      </div>

      <div style={{ borderBottom: '1px solid #00ffcc11', marginBottom: '1.5rem' }} />

      {/* Version */}
      <div style={{ fontSize: '0.5rem', color: '#334455', letterSpacing: 2, marginBottom: '1.5rem' }}>
        VERSION 0.1.0 &nbsp;·&nbsp; BUILT WITH REACT + PHASER 3
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        style={{
          width: '100%',
          background: 'transparent',
          border: '1px solid #00ffcc33',
          color: '#446655',
          fontFamily: 'monospace',
          fontSize: '0.65rem', letterSpacing: 3,
          padding: '0.5rem',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.color = '#00ffcc';
          (e.currentTarget as HTMLElement).style.borderColor = '#00ffcc66';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.color = '#446655';
          (e.currentTarget as HTMLElement).style.borderColor = '#00ffcc33';
        }}
      >
        CLOSE
      </button>
    </div>
  </div>
);
