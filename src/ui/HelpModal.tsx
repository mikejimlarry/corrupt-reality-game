// src/ui/HelpModal.tsx
import React, { useState, useEffect, useCallback } from 'react';

const UNFOLD_CSS = `
@keyframes modal-unfold {
  0%   { transform: scaleY(0.01) perspective(700px) rotateX(25deg); opacity: 0; }
  55%  { transform: scaleY(1.03) perspective(700px) rotateX(-4deg); opacity: 1; }
  75%  { transform: scaleY(0.98) perspective(700px) rotateX(1.5deg); }
  100% { transform: scaleY(1)    perspective(0px)   rotateX(0deg);  opacity: 1; }
}
@keyframes modal-fold {
  0%   { transform: scaleY(1)    perspective(0px)   rotateX(0deg);  opacity: 1; }
  40%  { transform: scaleY(1.02) perspective(700px) rotateX(-3deg); opacity: 1; }
  100% { transform: scaleY(0.01) perspective(700px) rotateX(25deg); opacity: 0; }
}
@keyframes backdrop-in  { from { opacity: 0 } to { opacity: 1 } }
@keyframes backdrop-out { from { opacity: 1 } to { opacity: 0 } }
.modal-unfold  { animation: modal-unfold  0.45s cubic-bezier(0.23, 1, 0.32, 1) both; transform-origin: center center; }
.modal-fold    { animation: modal-fold    0.28s cubic-bezier(0.55, 0, 1, 0.45) both; transform-origin: center center; }
.backdrop-in   { animation: backdrop-in  0.25s ease both; }
.backdrop-out  { animation: backdrop-out 0.28s ease both; }
`;

// ── Colour palette matching Phaser card categories ────────────────────────────
const CAT_COLOR: Record<string, string> = {
  CREDITS:        '#00ff88',
  EVENT_POSITIVE: '#00ccff',
  EVENT_NEGATIVE: '#ff3355',
  WAR:            '#ff8800',
  COUNTER:        '#bb44ff',
  DAEMON:    '#00ffcc',
};

const CAT_LABEL: Record<string, string> = {
  CREDITS:        'CREDIT CARD',
  EVENT_POSITIVE: 'SYSTEM EVENT',
  EVENT_NEGATIVE: 'HACK PROTOCOL',
  WAR:            'GRID CONFLICT',
  COUNTER:        'COUNTERMEASURE',
  DAEMON:    'DAEMON',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface CardEntry {
  name: string;
  category: string;
  count: number;
  effect: string;
  note?: string;
}

// ── Card catalogue ────────────────────────────────────────────────────────────
const CARDS: CardEntry[] = [
  // Credits
  { name: 'Data Harvest',        category: 'CREDITS',        count: 6, effect: 'Gain +5 credits.' },
  { name: 'Neural Uplink',       category: 'CREDITS',        count: 6, effect: 'Gain +10 credits.' },
  // Positive events
  { name: 'Mass Assimilation',   category: 'EVENT_POSITIVE', count: 2, effect: 'Each opponent loses 5 credits; you gain 5 per opponent.' },
  { name: 'Overclock',           category: 'EVENT_POSITIVE', count: 2, effect: 'Adds +5 to your next Stability Roll total (or -5 in Corruption, reducing losses).' },
  // Negative events
  { name: 'Signal Theft',        category: 'EVENT_NEGATIVE', count: 2, effect: 'Steal 15 credits from a target.' },
  { name: 'Pestilence Protocol', category: 'EVENT_NEGATIVE', count: 6, effect: 'Target loses 5 credits.' },
  { name: 'Digital Crusade',     category: 'EVENT_NEGATIVE', count: 2, effect: 'Target loses 10 credits.' },
  { name: 'Data Drought',        category: 'EVENT_NEGATIVE', count: 3, effect: 'Target loses 10 credits.', note: 'Firewall immune' },
  { name: 'Data Famine',         category: 'EVENT_NEGATIVE', count: 3, effect: 'Target loses 10 credits.' },
  { name: 'Data Flood',          category: 'EVENT_NEGATIVE', count: 3, effect: 'Target loses 10 credits.', note: 'Encryption immune' },
  { name: 'Raid Protocol',       category: 'EVENT_NEGATIVE', count: 2, effect: 'Target loses 10 credits.', note: 'Hardened Node immune' },
  { name: 'System Quake',        category: 'EVENT_NEGATIVE', count: 3, effect: 'Target loses 5 credits and one daemon.' },
  { name: 'Inferno Protocol',    category: 'EVENT_NEGATIVE', count: 3, effect: 'Target loses 10 credits and one daemon.', note: 'Firewall immune' },
  { name: 'M.A.D.',              category: 'EVENT_NEGATIVE', count: 2, effect: 'You and the target each lose 15 credits.' },
  { name: 'Backdoor',            category: 'EVENT_NEGATIVE', count: 2, effect: 'Steal one daemon from a target.' },
  { name: 'Network Storm',       category: 'EVENT_NEGATIVE', count: 2, effect: 'Every opponent loses 10 credits and one daemon.' },
  { name: 'The Corruption',      category: 'EVENT_NEGATIVE', count: 1, effect: 'Target loses 10 credits. Corruption mode begins.' },
  // Wars
  { name: 'Proxy War',           category: 'WAR',            count: 4, effect: 'Attack a target. You lose 5 credits · Target loses 10 credits.' },
  { name: 'Grid War',            category: 'WAR',            count: 3, effect: 'Attack a target. You lose 10 credits · Target loses 20 credits and one daemon.' },
  // Counters
  { name: 'Firewall Surge',      category: 'COUNTER',        count: 4, effect: 'Your next WAR roll gets +1. Play before initiating a conflict.' },
  { name: 'Cease & Desist',      category: 'COUNTER',        count: 3, effect: 'Block the next Grid War, Proxy War, or Digital Crusade targeting you. Cannot block standard hack protocols or M.A.D.' },
  { name: 'Quarantine',          category: 'COUNTER',        count: 2, effect: 'Block the next hack protocol targeting you — except Digital Crusade and M.A.D. Cannot block WAR cards. One use.' },
  // Daemons
  { name: 'Firewall',            category: 'DAEMON',    count: 4, effect: '+1 credit per Stability Roll · Absorbs 1 Corruption loss per roll · Immune to Data Drought & Inferno Protocol.' },
  { name: 'Encryption',          category: 'DAEMON',    count: 3, effect: '+1 credit per Stability Roll · Absorbs 1 Corruption loss per roll · Immune to Data Flood.' },
  { name: 'Hardened Node',       category: 'DAEMON',    count: 5, effect: '+1 credit per Stability Roll · Absorbs 1 Corruption loss per roll · Immune to Raid Protocol · Reduces WAR losses by 5.' },
];

// ── Shared styles ─────────────────────────────────────────────────────────────
const mono = (extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: 'monospace', ...extra,
});

// ── Circuit art SVG (mirrors the Phaser drawCircuit logic) ────────────────────
function CircuitArt({ seed, color }: { seed: number; color: string }) {
  const W = 182, H = 32;
  const rnd = (n: number) => { const v = Math.sin(seed + n * 127.1) * 43758.5; return v - Math.floor(v); };
  const count = 7;
  const nodes = Array.from({ length: count }, (_, i) => ({
    x: 6 + rnd(i * 3)     * (W - 12),
    y: 6 + rnd(i * 3 + 1) * (H - 12),
  }));

  const lines: React.ReactNode[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    if (rnd(i * 5 + 2) < 0.7) {
      const a = nodes[i], b = nodes[i + 1];
      const points = rnd(i * 7 + 3) > 0.5
        ? `M${a.x},${a.y} L${b.x},${a.y} L${b.x},${b.y}`
        : `M${a.x},${a.y} L${a.x},${b.y} L${b.x},${b.y}`;
      lines.push(<path key={i} d={points} stroke={color} strokeWidth={0.75} strokeOpacity={0.3} fill="none" />);
    }
  }

  const scanY = rnd(seed) * H;

  return (
    <svg width={W} height={H} style={{ display: 'block', borderRadius: 3, background: '#061420' }}>
      {lines}
      {nodes.map((n, i) => {
        const size = rnd(i * 11 + 4) > 0.7 ? 2.5 : 1.5;
        const alpha = 0.4 + rnd(i * 9 + 5) * 0.5;
        return <circle key={i} cx={n.x} cy={n.y} r={size} fill={color} fillOpacity={alpha} />;
      })}
      <line x1={0} y1={scanY} x2={W} y2={scanY} stroke="white" strokeWidth={0.5} strokeOpacity={0.04} />
    </svg>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CardTile({ card }: { card: CardEntry }) {
  const color = CAT_COLOR[card.category];
  const label = CAT_LABEL[card.category];
  const seed = card.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <div style={{
      background: '#080812',
      border: `1px solid ${color}33`,
      borderTop: `2px solid ${color}`,
      borderRadius: 6,
      padding: '0.65rem 0.75rem',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={mono({ color, fontSize: '0.72rem', letterSpacing: 2 })}>{label}</span>
        <span style={mono({ color: '#334455', fontSize: '0.6rem' })}>×{card.count}</span>
      </div>
      <div style={mono({ color: '#e0f0ff', fontSize: '0.85rem', fontWeight: 'bold' })}>{card.name}</div>
      <div style={{ marginTop: 2, marginBottom: 2 }}>
        <CircuitArt seed={seed} color={color} />
      </div>
      <div style={mono({ color: '#778899', fontSize: '0.65rem', lineHeight: 1.5 })}>{card.effect}</div>
      {card.note && (
        <div style={mono({ color: color, fontSize: '0.58rem', letterSpacing: 1, opacity: 0.7 })}>
          ⊘ {card.note}
        </div>
      )}
    </div>
  );
}

function RollTable() {
  const rows = [
    { range: '2 – 3', gain: '0', label: 'No gain' },
    { range: '4 – 5', gain: '+5', label: 'Low sequence' },
    { range: '6 – 8', gain: '+10', label: 'Stable sequence' },
    { range: '9 – 11', gain: '+15', label: 'Stability bonus' },
    { range: '12', gain: '+20', label: 'Peak stability' },
  ];
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', ...mono() }}>
      <thead>
        <tr>
          {['ROLL', 'CREDITS', 'STATUS'].map(h => (
            <th key={h} style={{ textAlign: 'left', fontSize: '0.6rem', letterSpacing: 2, color: '#446655', paddingBottom: 6, borderBottom: '1px solid #00ffcc22' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.range}>
            <td style={{ padding: '5px 0', fontSize: '0.75rem', color: '#00ffcc', width: 60 }}>{r.range}</td>
            <td style={{ fontSize: '0.8rem', color: r.gain === '0' ? '#446655' : '#00ff88', fontWeight: 'bold', width: 50 }}>{r.gain}</td>
            <td style={{ fontSize: '0.7rem', color: '#556677' }}>{r.label}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <div style={mono({ fontSize: '0.6rem', letterSpacing: 4, color: '#00ffcc', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '1px solid #00ffcc22' })}>
        {title}
      </div>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={mono({ color: '#778899', fontSize: '0.75rem', lineHeight: 1.7, margin: '0 0 0.75rem' })}>{children}</p>;
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: '0.4rem' }}>
      <span style={{ color: '#00ffcc', flexShrink: 0 }}>›</span>
      <span style={mono({ color: '#778899', fontSize: '0.75rem', lineHeight: 1.6 })}>{children}</span>
    </div>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#00ffcc' }}>{children}</span>;
}

// ── Tab content ───────────────────────────────────────────────────────────────

function TabHowToPlay() {
  return (
    <div>
      <Section title="OBJECTIVE">
        <P>Be the last faction standing with credits. Manage your resources, attack rivals with hack protocols and wars, deploy daemons to protect yourself — and survive until everyone else is eliminated.</P>
      </Section>

      <Section title="SETUP">
        <Bullet>Each player starts with <Highlight>50 credits</Highlight> (adjustable in options).</Bullet>
        <Bullet>Each player is dealt <Highlight>5 cards</Highlight> from the shuffled deck.</Bullet>
        <Bullet>The remaining cards form a face-down <Highlight>draw pile</Highlight> in the centre.</Bullet>
        <Bullet>The player with the highest single die roll goes first.</Bullet>
      </Section>

      <Section title="YOUR TURN">
        <Bullet><Highlight>1. Stability Roll</Highlight> — Roll two dice. Gain credits based on the table below. Each daemon you own adds <Highlight>+1 credit</Highlight> to any roll that produces a gain.</Bullet>
        <Bullet><Highlight>2. Draw</Highlight> — Draw cards from the pile until you hold 6.</Bullet>
        <Bullet><Highlight>3. Play or Discard</Highlight> — Play one card from your hand, or discard one. All played and discarded cards go face-up in the discard pile.</Bullet>
        <P>Once all players have gone, the round repeats. Play continues until only one faction remains.</P>
        <RollTable />
      </Section>

      <Section title="THE CORRUPTION">
        <P>
          When <Highlight>The Corruption</Highlight> card is played, the targeted player loses 10 credits and Corruption Mode begins — the entire board shifts red. Stability Rolls now deal damage instead of granting credits, using the same thresholds in reverse. Each daemon you own <Highlight>absorbs 1 credit of corruption loss</Highlight> per roll — enough daemons can negate a roll entirely.
        </P>
      </Section>

      <Section title="COUNTERMEASURES">
        <P>Some cards can be played <Highlight>reactively</Highlight> — out of turn — to cancel an incoming attack before it lands.</P>
        <Bullet><Highlight>Quarantine</Highlight> blocks any hack protocol (EVENT_NEGATIVE) aimed at you, <em>except</em> Digital Crusade and M.A.D.</Bullet>
        <Bullet><Highlight>Cease &amp; Desist</Highlight> blocks any Grid War, Proxy War, or Digital Crusade targeting you. It cannot block standard hack protocols or M.A.D.</Bullet>
        <P>When an AI targets you with a blockable attack and you hold the right counter, you will be prompted to play it or allow the attack through. <Highlight>Using a counter ends the attacker's turn immediately</Highlight> — they do not get to choose another card or action.</P>
      </Section>

      <Section title="ELIMINATION">
        <P>Any player whose credits reach <Highlight>0</Highlight> is immediately eliminated. If the <Highlight>Dead Man's Switch</Highlight> option is enabled, they may choose one last targeted negative card from their hand to play before they fall.</P>
      </Section>

      <Section title="WINNING">
        <P>The <Highlight>last player with credits</Highlight> wins the game.</P>
      </Section>
    </div>
  );
}

function TabCards() {
  const categories = ['CREDITS', 'EVENT_POSITIVE', 'EVENT_NEGATIVE', 'WAR', 'COUNTER', 'DAEMON'];
  const sectionTitle: Record<string, string> = {
    CREDITS:        'CREDIT CARDS',
    EVENT_POSITIVE: 'POSITIVE EVENTS',
    EVENT_NEGATIVE: 'NEGATIVE EVENTS / HACK PROTOCOLS',
    WAR:            'GRID CONFLICTS (WAR)',
    COUNTER:        'COUNTERMEASURES',
    DAEMON:    'DAEMONS',
  };

  return (
    <div>
      {categories.map(cat => {
        const cards = CARDS.filter(c => c.category === cat);
        const color = CAT_COLOR[cat];
        return (
          <div key={cat} style={{ marginBottom: '1.75rem' }}>
            <div style={mono({ fontSize: '0.6rem', letterSpacing: 4, color, marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: `1px solid ${color}33` })}>
              {sectionTitle[cat]}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.6rem' }}>
              {cards.map(card => <CardTile key={card.name} card={card} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TabOptions() {
  return (
    <div>
      <Section title="STARTING CREDITS">
        <P>Slide to choose how many credits each player starts with (30–100 in steps of 5, default 50). This sets the length and pace of the game.</P>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {[
            { range: '30–44', label: 'SHORT GAME', desc: 'Fast and brutal. One bad roll or hack protocol can swing the whole game.' },
            { range: '45–55', label: 'STANDARD', desc: 'The default experience. Balanced between speed and strategy.' },
            { range: '56–100', label: 'LONG GAME', desc: 'Drawn out warfare. Daemons matter more, and comebacks are possible.' },
          ].map(({ range, label, desc }) => (
            <div key={label} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: '#080812', border: '1px solid #00ffcc1a', borderRadius: 4, padding: '0.6rem 0.75rem' }}>
              <span style={mono({ color: '#00ffcc', fontSize: '0.75rem', fontWeight: 'bold', width: 44, flexShrink: 0 })}>{range}</span>
              <span>
                <div style={mono({ color: '#00ffcc', fontSize: '0.65rem', letterSpacing: 2, marginBottom: 3 })}>{label}</div>
                <div style={mono({ color: '#556677', fontSize: '0.68rem', lineHeight: 1.5 })}>{desc}</div>
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="HIDE CREDITS">
        <P>When enabled, the exact credit total for all players is hidden — only the bar is visible. You'll have to judge your rivals' strength by how full their bar is, not the number.</P>
        <P>Adds a layer of bluffing and uncertainty to every decision.</P>
      </Section>

      <Section title="DEAD MAN'S SWITCH">
        <P>When enabled, any player whose credits hit zero does not die silently. Before being eliminated, they may choose one targeted negative card from their hand to play as a final act. AI players pick automatically; the human player gets a choice.</P>
        <P>Makes endgame eliminations more dangerous — a desperate faction can still cause chaos on their way out. Best used in longer games or with experienced players.</P>
      </Section>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'howtoplay', label: 'HOW TO PLAY' },
  { id: 'cards',     label: 'CARDS' },
  { id: 'options',   label: 'OPTIONS' },
];

interface Props {
  onClose: () => void;
}

export const HelpModal: React.FC<Props> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('howtoplay');
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 280);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClose]);

  return (
    <>
      <style>{UNFOLD_CSS}</style>
      <div
        onClick={handleClose}
        className={closing ? 'backdrop-out' : 'backdrop-in'}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1.5rem',
        }}
      >
      {/* Modal panel */}
      <div
        onClick={e => e.stopPropagation()}
        className={closing ? 'modal-fold' : 'modal-unfold'}
        style={{
          background: '#05050f',
          border: '1px solid #00ffcc33',
          borderTop: '2px solid #00ffcc',
          borderRadius: 8,
          width: '100%', maxWidth: 760,
          maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'monospace',
          boxShadow: '0 0 60px #00ffcc0d',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem 0' }}>
          <div>
            <div style={{ color: '#00ffcc', fontSize: '0.65rem', letterSpacing: 6 }}>C O R R U P T · R E A L I T Y</div>
            <div style={{ color: '#334455', fontSize: '0.55rem', letterSpacing: 3, marginTop: 2 }}>FIELD MANUAL v1.0</div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'transparent', border: '1px solid #00ffcc33',
              color: '#446655', fontFamily: 'monospace', fontSize: '0.8rem',
              cursor: 'pointer', padding: '0.25rem 0.6rem',
              letterSpacing: 2,
            }}
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 2, padding: '0.75rem 1.25rem 0', borderBottom: '1px solid #00ffcc1a' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? '#00ffcc0d' : 'transparent',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab.id ? '#00ffcc' : 'transparent'}`,
                color: activeTab === tab.id ? '#00ffcc' : '#446655',
                fontFamily: 'monospace', fontSize: '0.65rem',
                letterSpacing: 3, cursor: 'pointer',
                padding: '0.4rem 0.75rem 0.6rem',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', padding: '1.25rem', flex: 1 }}>
          {activeTab === 'howtoplay' && <TabHowToPlay />}
          {activeTab === 'cards'     && <TabCards />}
          {activeTab === 'options'   && <TabOptions />}
        </div>
      </div>
      </div>
    </>
  );
};
