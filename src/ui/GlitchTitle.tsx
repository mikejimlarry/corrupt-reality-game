// src/ui/GlitchTitle.tsx
import React from 'react';

const CSS = `
  .cr-glitch {
    position: relative;
    color: #00ffcc;
    font-family: 'Doto', monospace;
    font-size: 3rem;
    font-weight: 700;
    letter-spacing: 4px;
    margin: 0;
    text-shadow:
      -2px 0 rgba(255, 0, 80, 0.8),
       2px 0 rgba(0, 255, 200, 0.5);
    animation: cr-glitch-base 7s infinite;
    user-select: none;
  }

  /* Coloured duplicate layers for the split-channel effect */
  .cr-glitch::before,
  .cr-glitch::after {
    content: attr(data-text);
    position: absolute;
    inset: 0;
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    letter-spacing: inherit;
    opacity: 0;
  }

  .cr-glitch::before { color: #ff0055; }
  .cr-glitch::after  { color: #00eeff; }

  /* ── Leet-speak character swap ───────────────────────────────────────────── */
  /* Each .cr-leet span wraps a leet digit. During glitch bursts the ::before  */
  /* fades the real letter in while the digit fades out, then back.            */
  .cr-leet {
    position: relative;
    display: inline-block;
    vertical-align: baseline;
  }

  /* The real letter overlaid on top */
  .cr-leet::before {
    content: attr(data-letter);
    position: absolute;
    inset: 0;
    text-align: center;
    color: inherit;
    opacity: 0;
    animation: cr-leet-show 7s infinite;
  }

  /* The leet digit */
  .cr-leet > span {
    display: inline-block;
    animation: cr-leet-hide 7s infinite;
  }

  /* Letter fades IN during glitch bursts */
  @keyframes cr-leet-show {
    0%, 88%, 100% { opacity: 0; }
    89%   { opacity: 1; }
    89.4% { opacity: 0; }
    90%   { opacity: 1; }
    90.8% { opacity: 0; }
    92%   { opacity: 1; }
    92.5% { opacity: 0; }
    93%   { opacity: 1; }
    94%   { opacity: 0; }
    95%   { opacity: 1; }
    95.6% { opacity: 0; }
    96%   { opacity: 1; }
    97%   { opacity: 0; }
  }

  /* Digit fades OUT during the same frames (inverse) */
  @keyframes cr-leet-hide {
    0%, 88%, 100% { opacity: 1; }
    89%   { opacity: 0; }
    89.4% { opacity: 1; }
    90%   { opacity: 0; }
    90.8% { opacity: 1; }
    92%   { opacity: 0; }
    92.5% { opacity: 1; }
    93%   { opacity: 0; }
    94%   { opacity: 1; }
    95%   { opacity: 0; }
    95.6% { opacity: 1; }
    96%   { opacity: 0; }
    97%   { opacity: 1; }
  }

  /* ── Base / main text animation ─────────────────────────────────────────── */
  @keyframes cr-glitch-base {
    0%, 88%, 100% {
      transform: none;
      text-shadow: -2px 0 rgba(255,0,80,0.8), 2px 0 rgba(0,255,200,0.5);
    }
    /* burst 1 */
    89% { transform: translate(-4px, 0) skewX(-3deg);
          text-shadow: -7px 0 rgba(255,0,80,0.95), 7px 0 rgba(0,255,200,0.85); }
    90% { transform: translate( 3px, 0) skewX( 2deg);
          text-shadow: -3px 0 rgba(255,0,80,0.70), 3px 0 rgba(0,255,200,0.60); }
    91% { transform: none;
          text-shadow: -2px 0 rgba(255,0,80,0.80), 2px 0 rgba(0,255,200,0.50); }
    /* burst 2 */
    92% { transform: translate(-5px, 1px);
          text-shadow: -9px 0 rgba(255,0,80,1.00), 9px 0 rgba(0,255,200,0.90); }
    93% { transform: translate( 2px,-1px) skewX(1.5deg);
          text-shadow: -4px 0 rgba(255,0,80,0.80), 4px 0 rgba(0,255,200,0.70); }
    94% { transform: none;
          text-shadow: -2px 0 rgba(255,0,80,0.80), 2px 0 rgba(0,255,200,0.50); }
    /* burst 3 */
    95% { transform: translate(-2px, 0);
          text-shadow: -6px 0 rgba(255,0,80,0.90), 6px 0 rgba(0,255,200,0.80); }
    96% { transform: translate( 1px, 0);
          text-shadow: -2px 0 rgba(255,0,80,0.80), 2px 0 rgba(0,255,200,0.50); }
    97% { transform: none;
          text-shadow: -2px 0 rgba(255,0,80,0.80), 2px 0 rgba(0,255,200,0.50); }
  }

  /* ── Red channel (::before) ─────────────────────────────────────────────── */
  @keyframes cr-glitch-before {
    0%, 88%, 100% { opacity: 0; transform: none; }
    89% { opacity: 0.85; transform: translate(-7px);
          clip-path: polygon(0 15%, 100% 15%, 100% 40%, 0 40%); }
    90% { opacity: 0.70; transform: translate( 5px);
          clip-path: polygon(0 60%, 100% 60%, 100% 82%, 0 82%); }
    91% { opacity: 0;    transform: none; }
    92% { opacity: 0.90; transform: translate(-9px);
          clip-path: polygon(0  5%, 100%  5%, 100% 28%, 0 28%); }
    93% { opacity: 0.60; transform: translate( 6px);
          clip-path: polygon(0 50%, 100% 50%, 100% 72%, 0 72%); }
    94% { opacity: 0;    transform: none; }
    95% { opacity: 0.80; transform: translate(-5px);
          clip-path: polygon(0 35%, 100% 35%, 100% 55%, 0 55%); }
    96% { opacity: 0.50; transform: translate( 3px);
          clip-path: polygon(0 70%, 100% 70%, 100% 90%, 0 90%); }
    97% { opacity: 0;    transform: none; }
  }

  /* ── Cyan channel (::after) ─────────────────────────────────────────────── */
  @keyframes cr-glitch-after {
    0%, 88%, 100% { opacity: 0; transform: none; }
    89% { opacity: 0.80; transform: translate( 8px);
          clip-path: polygon(0 58%, 100% 58%, 100% 82%, 0 82%); }
    90% { opacity: 0.65; transform: translate(-6px);
          clip-path: polygon(0 10%, 100% 10%, 100% 33%, 0 33%); }
    91% { opacity: 0;    transform: none; }
    92% { opacity: 0.85; transform: translate(10px);
          clip-path: polygon(0 68%, 100% 68%, 100% 90%, 0 90%); }
    93% { opacity: 0.55; transform: translate(-7px);
          clip-path: polygon(0 22%, 100% 22%, 100% 44%, 0 44%); }
    94% { opacity: 0;    transform: none; }
    95% { opacity: 0.75; transform: translate( 6px);
          clip-path: polygon(0 44%, 100% 44%, 100% 64%, 0 64%); }
    96% { opacity: 0.45; transform: translate(-4px);
          clip-path: polygon(0  2%, 100%  2%, 100% 18%, 0 18%); }
    97% { opacity: 0;    transform: none; }
  }
`;

// Wire the named keyframes to the pseudo-elements via a second <style> block
// because React can't inline ::before/::after animation names without a class.
const CSS_ANIM = `
  .cr-glitch::before { animation: cr-glitch-before 7s infinite; }
  .cr-glitch::after  { animation: cr-glitch-after  7s infinite; }
`;

/** Wraps a single leet-speak character so it glitches back to its real letter. */
function L({ letter, children }: { letter: string; children: string }) {
  return (
    <span className="cr-leet" data-letter={letter}>
      <span>{children}</span>
    </span>
  );
}

export const GlitchTitle: React.FC = () => (
  <>
    <style>{CSS}</style>
    <style>{CSS_ANIM}</style>
    <h1
      className="cr-glitch"
      data-text="C0RRUpT_R3ALiTY"
    >
      C<L letter="O">0</L>RRUP<L letter="T">T</L>{' '}R<L letter="E">E</L><L letter="A">4</L>LI<L letter="T">T</L>Y
    </h1>
  </>
);
