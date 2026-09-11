// src/ui/HelpModal.tsx
import React, { useState, useCallback } from 'react';
import { DECK_CATALOG, type DeckCatalogEntry } from '../data/deck';
import { useGameStore } from '../state/useGameStore';
import { OverlayShell } from './OverlayShell';

const UNFOLD_CSS = `
@keyframes modal-unfold {
  0%   { transform: scaleY(0) scaleX(0.04); opacity: 0; }
  40%  { transform: scaleY(1) scaleX(0.04); opacity: 1; }
  100% { transform: scaleY(1) scaleX(1);    opacity: 1; }
}
@keyframes modal-fold {
  0%   { transform: scaleY(1) scaleX(1);    opacity: 1; }
  55%  { transform: scaleY(1) scaleX(0.04); opacity: 1; }
  100% { transform: scaleY(0) scaleX(0.04); opacity: 0; }
}
@keyframes modal-contents-in  { from { opacity: 0 } to { opacity: 1 } }
@keyframes modal-contents-out { from { opacity: 1 } to { opacity: 0 } }
@keyframes backdrop-in  { from { opacity: 0 } to { opacity: 1 } }
@keyframes backdrop-out { from { opacity: 1 } to { opacity: 0 } }
.modal-unfold        { animation: modal-unfold  0.38s cubic-bezier(0.22, 1, 0.36, 1) both; transform-origin: center center; }
.modal-fold          { animation: modal-fold    0.28s cubic-bezier(0.55, 0, 1, 0.45) both; transform-origin: center center; }
.modal-contents-in   { animation: modal-contents-in  0.14s 0.32s ease both; }
.modal-contents-out  { animation: modal-contents-out 0.08s ease both; }
.backdrop-in         { animation: backdrop-in  0.22s ease both; }
.backdrop-out        { animation: backdrop-out 0.28s ease both; }
`;

// ── Colour palette matching Phaser card categories ────────────────────────────
const CAT_COLOR: Record<string, string> = {
  CYCLES:         '#00ff88',
  EVENT_POSITIVE: '#00ccff',
  EVENT_NEGATIVE: '#ff3355',
  WAR:            '#ff8800',
  COUNTER:        '#bb44ff',
  DAEMON:         '#00ffcc',
};

const CAT_LABEL: Record<string, string> = {
  CYCLES:         'CYCLES CARD',
  EVENT_POSITIVE: 'SYSTEM EVENT',
  EVENT_NEGATIVE: 'HACK PROTOCOL',
  WAR:            'WARFARE',
  COUNTER:        'COUNTERMEASURE',
  DAEMON:         'DAEMON',
};

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
    <svg width={W} height={H} style={{ display: 'block', borderRadius: 3, background: 'var(--crg-card)' }}>
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

function CardTile({ card }: { card: DeckCatalogEntry }) {
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
        <span style={mono({ color: 'var(--crg-muted)', fontSize: '0.75rem' })}>×{card.count}</span>
      </div>
      <div style={mono({ color: 'var(--crg-text)', fontSize: '0.9rem', fontWeight: 'bold' })}>{card.name}</div>
      <div style={{ marginTop: 2, marginBottom: 2 }}>
        <CircuitArt seed={seed} color={color} />
      </div>
      <div style={mono({ color: 'var(--crg-body)', fontSize: '0.75rem', lineHeight: 1.6 })}>{card.effect}</div>
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
          {['ROLL', 'CYCLES', 'STATUS'].map(h => (
            <th key={h} style={{ textAlign: 'left', fontSize: '0.75rem', letterSpacing: 2, color: 'var(--crg-muted)', paddingBottom: 6, borderBottom: '1px solid #00ffcc22' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.range}>
            <td style={{ padding: '5px 0', fontSize: '0.75rem', color: '#00ffcc', width: 60 }}>{r.range}</td>
            <td style={{ fontSize: '0.875rem', color: r.gain === '0' ? 'var(--crg-muted)' : '#00ff88', fontWeight: 'bold', width: 50 }}>{r.gain}</td>
            <td style={{ fontSize: '0.75rem', color: 'var(--crg-body)' }}>{r.label}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <div style={mono({ fontSize: '0.75rem', letterSpacing: 4, color: '#00ffcc', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '1px solid #00ffcc22' })}>
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
        <P>Be the last faction standing with cycles. Manage your resources, attack rivals with hack protocols and conflicts, deploy daemons to protect yourself — and survive until everyone else is eliminated.</P>
      </Section>

      <Section title="SETUP">
        <Bullet>Each player starts with <Highlight>50 cycles</Highlight> (adjustable in options).</Bullet>
        <Bullet>Each player is dealt <Highlight>5 cards</Highlight> from the shuffled deck.</Bullet>
        <Bullet>The remaining cards form a face-down <Highlight>draw pile</Highlight> in the centre.</Bullet>
        <Bullet>The player with the highest single die roll goes first.</Bullet>
      </Section>

      <Section title="YOUR TURN">
        <Bullet><Highlight>1. Stability Roll</Highlight> — Roll two dice. Gain cycles based on the table below. Each active daemon you own <Highlight>adds +1</Highlight> to your Stability Roll.</Bullet>
        <Bullet><Highlight>2. Draw</Highlight> — Draw cards from the pile until you hold 6.</Bullet>
        <Bullet><Highlight>3. Play or Discard</Highlight> — Play one card from your hand, or discard one. All played and discarded cards go face-up in the discard pile.</Bullet>
        <P>Once all players have gone, the round repeats. Play continues until only one faction remains.</P>
        <RollTable />
      </Section>

      <Section title="THE CORRUPTION">
        <P>
          When <Highlight>The Corruption</Highlight> card is played, the targeted player loses 10 cycles and Corruption Mode begins — the entire board shifts red. Stability Rolls now deal damage instead of granting cycles, using the same thresholds in reverse. Each active daemon you own <Highlight>subtracts -1</Highlight> from your Stability Roll — enough daemons can negate a roll entirely.
        </P>
      </Section>

      <Section title="COUNTERMEASURES">
        <P><Highlight>Quarantine</Highlight> is a proactive System Event — play it on your own turn to arm a standing block. The next Conflict or Digital Crusade targeting you is automatically cancelled and the card is consumed. It cannot block M.A.D.</P>
        <P><Highlight>System Interrupt</Highlight> is a reactive Countermeasure — when an AI declares war on you and you hold one, you are prompted to cancel the conflict before the dice roll. <Highlight>Cancelling ends the attacker's turn immediately.</Highlight></P>
        <P><Highlight>Firewall Surge</Highlight> does not cancel — it adds +1 to your Conflict roll. Play it before the dice roll to fight with an edge.</P>
      </Section>

      <Section title="ELIMINATION">
        <P>Any player whose cycles reach <Highlight>0</Highlight> is immediately eliminated. If the <Highlight>Dead Man's Switch</Highlight> option is enabled, they may choose one last targeted negative card from their hand to play before they fall.</P>
      </Section>

      <Section title="WINNING">
        <P>The <Highlight>last player with cycles</Highlight> wins the game.</P>
      </Section>
    </div>
  );
}

function TabCards() {
  const categories = ['CYCLES', 'EVENT_POSITIVE', 'EVENT_NEGATIVE', 'WAR', 'COUNTER', 'DAEMON'];
  const sectionTitle: Record<string, string> = {
    CYCLES:         'CYCLES CARDS',
    EVENT_POSITIVE: 'SYSTEM EVENTS',
    EVENT_NEGATIVE: 'HACK PROTOCOLS',
    WAR:            'WARFARE',
    COUNTER:        'COUNTERMEASURES',
    DAEMON:         'DAEMONS',
  };

  return (
    <div>
      {categories.map(cat => {
        const cards = DECK_CATALOG.filter(c => c.category === cat);
        const color = CAT_COLOR[cat];
        return (
          <div key={cat} style={{ marginBottom: '1.75rem' }}>
            <div style={mono({ fontSize: '0.75rem', letterSpacing: 4, color, marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: `1px solid ${color}33` })}>
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
      <Section title="STARTING CYCLES">
        <P>Slide to choose how many cycles each player starts with (30–100 in steps of 5, default 50). This sets the length and pace of the game.</P>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {[
            { range: '30–44', label: 'SHORT GAME', desc: 'Fast and brutal. One bad roll or hack protocol can swing the whole game.' },
            { range: '45–55', label: 'STANDARD', desc: 'The default experience. Balanced between speed and strategy.' },
            { range: '56–100', label: 'LONG GAME', desc: 'Drawn out warfare. Daemons matter more, and comebacks are possible.' },
          ].map(({ range, label, desc }) => (
            <div key={label} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: '#080812', border: '1px solid #00ffcc1a', borderRadius: 4, padding: '0.6rem 0.75rem' }}>
              <span style={mono({ color: '#00ffcc', fontSize: '0.75rem', fontWeight: 'bold', width: 44, flexShrink: 0 })}>{range}</span>
              <span>
                <div style={mono({ color: '#00ffcc', fontSize: '0.75rem', letterSpacing: 2, marginBottom: 3 })}>{label}</div>
                <div style={mono({ color: 'var(--crg-body)', fontSize: '0.75rem', lineHeight: 1.5 })}>{desc}</div>
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="HIDE CYCLES">
        <P>When enabled, the exact cycle total for all players is hidden — only the bar is visible. You'll have to judge your rivals' strength by how full their bar is, not the number.</P>
        <P>Adds a layer of bluffing and uncertainty to every decision.</P>
      </Section>

      <Section title="DEAD MAN'S SWITCH">
        <P>When enabled, any player whose cycles hit zero does not die silently. Before being eliminated, they may choose one targeted negative card from their hand to play as a final act. AI players pick automatically; the human player gets a choice.</P>
        <P>Makes endgame eliminations more dangerous — a desperate faction can still cause chaos on their way out. Best used in longer games or with experienced players.</P>
      </Section>

      <Section title="WAR TIE PENALTY">
        <P>Controls what happens when two players roll the same total in a Conflict. When disabled (default), a tie costs nothing — neither side pays.</P>
        <P>When enabled, both sides pay the winner's cycle penalty (e.g. -5 for Skirmish, -10 for Total Siege). Turns stalemates into a mutual cost, raising the stakes of every conflict.</P>
      </Section>
    </div>
  );
}

function TabInterface() {
  return (
    <div>
      <Section title="OVERVIEW">
        <P>The game board combines the animated Phaser table with a semantic React command layer. Pointer players can act directly on the table; keyboard and screen-reader players can open <Highlight>COMMANDS</Highlight> with the C key for the same turn actions, cards, and targets.</P>
      </Section>

      <Section title="TOP LEFT — CONTROLS">
        <Bullet><Highlight>? FIELD MANUAL</Highlight> — Opens this modal at any point during play.</Bullet>
        <Bullet><Highlight>♫ / ♪</Highlight> — Toggles background music on or off.</Bullet>
        <Bullet><Highlight>① / ②</Highlight> — Switches between the two music tracks. Only visible when music is on.</Bullet>
      </Section>

      <Section title="TOP RIGHT — SYSTEM">
        <Bullet><Highlight>Ⅱ PAUSE / ▶ RESUME</Highlight> — Halts or resumes the game. AI turns do not advance while paused.</Bullet>
        <Bullet><Highlight>✦</Highlight> — Toggles reduced-motion mode. Disables card animations, scanlines, and panel wipes.</Bullet>
      </Section>

      <Section title="TOP RIGHT — STATUS PANEL">
        <P>Shows the current turn number, game phase, whose turn it is, and a mini scoreboard for all players.</P>
        <Bullet>The <Highlight>▶</Highlight> dot marks the active player.</Bullet>
        <Bullet>The bar next to each name represents cycles relative to the starting total.</Bullet>
        <Bullet>Eliminated players appear struck-through and dimmed.</Bullet>
      </Section>

      <Section title="TOP RIGHT — PHASE PANELS">
        <P>Additional panels appear below the scoreboard depending on the active game phase:</P>
        <Bullet><Highlight>SELECT A TARGET</Highlight> (red, pulsing) — Choose a highlighted player zone on the board or select the same opponent in <Highlight>COMMANDS</Highlight>. <Highlight>✕ CANCEL</Highlight> aborts the card play (unavailable if the card is forced).</Bullet>
        <Bullet><Highlight>⟳ MULTITASKING</Highlight> — Appears after playing a Multitask card. Shows how many bonus plays remain. <Highlight>✓ DONE</Highlight> ends the turn early without using them.</Bullet>
        <Bullet><Highlight>TURN COMPLETE</Highlight> — Brief flash before the turn auto-advances.</Bullet>
      </Section>

      <Section title="CENTRE — ACTION BUTTONS">
        <P>Main action buttons anchor to the bottom-centre of the screen during your turn:</P>
        <Bullet><Highlight>BEGIN SEQUENCE</Highlight> — Tap to roll dice and collect cycles (Stability Roll phase).</Bullet>
        <Bullet><Highlight>DRAW CARD</Highlight> — Tap to draw up to your hand limit of 6 (Draw phase).</Bullet>
        <Bullet><Highlight>PLAY</Highlight> — Activates the selected card. Some cards require choosing a target first.</Bullet>
        <Bullet><Highlight>DISCARD</Highlight> — Removes the selected card from play with no effect and ends your turn.</Bullet>
      </Section>

      <Section title="YOUR HAND">
        <P>Cards fan out along the bottom of the screen during your Main phase.</P>
        <Bullet>Pointer users can hover a card to preview it and click to select it. In <Highlight>COMMANDS</Highlight>, each card is a labeled button with its rules and availability.</Bullet>
        <Bullet>Activate a selected card again to deselect it.</Bullet>
        <Bullet>Cards that can't be played in the current situation appear dimmed or tinted red.</Bullet>
        <Bullet>When <Highlight>The Corruption</Highlight> is in your opening hand it is auto-selected — you must play it before any other card.</Bullet>
      </Section>

      <Section title="BOTTOM RIGHT — SORT CONTROLS">
        <P>Visible during gameplay. Cycle through sort modes with the mode button; reverse order with <Highlight>⇅</Highlight>.</P>
        <Bullet><Highlight>DEF</Highlight> — Deal order (default).</Bullet>
        <Bullet><Highlight>TYPE</Highlight> — Grouped by card category.</Bullet>
        <Bullet><Highlight>VAL</Highlight> — Sorted by stat value, highest first.</Bullet>
        <Bullet><Highlight>A–Z</Highlight> — Alphabetical by card name.</Bullet>
        <Bullet>The <Highlight>⇅</Highlight> button reverses whichever mode is active. Both buttons light up when non-default.</Bullet>
      </Section>

      <Section title="BOTTOM LEFT — ACTIVITY LOG">
        <P>The strip at the bottom-left previews the latest event. Click it to expand the full scrollable log — card plays, roll results, combat outcomes, and turn markers are all recorded here.</P>
      </Section>

      <Section title="BOARD — PLAYER INFO BOXES">
        <P>Each player has an info box on the canvas showing their current state.</P>
        <Bullet>The <Highlight>cycle bar</Highlight> fills left-to-right and animates when cycles change. A flash of green means a gain; red means a loss.</Bullet>
        <Bullet>The large number on the right is the exact cycle total (shown as <Highlight>???</Highlight> in Hide Cycles mode).</Bullet>
        <Bullet>Active <Highlight>daemon pills</Highlight> appear along the bottom of the box.</Bullet>
        <Bullet>When targeting is required, valid boxes pulse with a red border and a target label. Activate one on the board or in <Highlight>COMMANDS</Highlight> to confirm.</Bullet>
      </Section>

      <Section title="POPUPS AND OVERLAYS">
        <P>Full-screen overlays appear during reactive moments and require a response before play continues:</P>
        <Bullet><Highlight>INCOMING WAR</Highlight> — An AI is declaring war on you. Play a counter card to block or boost, or take the hit.</Bullet>
        <Bullet><Highlight>PRE-CONFLICT PREPARATION</Highlight> — Before dice roll, each combatant may play Firewall Surge (+1 to roll).</Bullet>
        <Bullet><Highlight>CONFLICT DECLARATION</Highlight> — When you play a Warfare card, select two combatants. They each roll; the loser pays the cost.</Bullet>
        <Bullet><Highlight>DAEMON EXTRACTION / WAR SPOILS</Highlight> — Choose which daemon to steal or destroy after a Backdoor or Total Siege victory.</Bullet>
        <Bullet><Highlight>DEAD MAN'S SWITCH</Highlight> — Appears when an eliminated player may play one final card (if the option is enabled).</Bullet>
      </Section>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'howtoplay', label: 'HOW TO PLAY' },
  { id: 'interface', label: 'INTERFACE' },
  { id: 'cards',     label: 'CARDS' },
  { id: 'options',   label: 'OPTIONS' },
];

interface Props {
  onClose: () => void;
}

export const HelpModal: React.FC<Props> = ({ onClose }) => {
  const reducedMotion = useGameStore(s => s.reducedMotion);
  const [activeTab, setActiveTab] = useState('howtoplay');
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    if (reducedMotion) {
      onClose();
      return;
    }
    setClosing(true);
    setTimeout(onClose, 300);
  }, [onClose, reducedMotion]);

  return (
    <>
      <style>{UNFOLD_CSS}</style>
      <OverlayShell
        ariaLabel="Field Manual"
        background="rgba(0,0,0,0.75)"
        zIndex={500}
        maxWidth={760}
        onBackdropClick={handleClose}
        onRequestClose={handleClose}
        panelClassName={closing ? 'modal-fold backdrop-out' : 'modal-unfold backdrop-in'}
        panelStyle={{
          background: '#05050f',
          border: '1px solid #00ffcc33',
          borderTop: '2px solid #00ffcc',
          borderRadius: 8,
          display: 'flex', flexDirection: 'column',
          fontFamily: 'monospace',
          boxShadow: '0 0 60px #00ffcc0d',
        }}
      >
        <div className={closing ? 'modal-contents-out' : 'modal-contents-in'} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem 0' }}>
          <div>
            <div style={{ color: '#00ffcc', fontSize: '0.75rem', letterSpacing: 6 }}>C O R R U P T · R E A L I T Y</div>
            <div style={{ color: 'var(--crg-muted)', fontSize: '0.75rem', letterSpacing: 3, marginTop: 2 }}>FIELD MANUAL v1.0</div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="crg-btn-cyan"
            style={{
              background: 'transparent', border: '1px solid #00ffcc33',
              color: 'var(--crg-muted)', fontFamily: 'monospace', fontSize: '0.8rem',
              cursor: 'pointer', padding: '0.25rem 0.6rem',
              letterSpacing: 2, transition: 'all 0.15s',
            }}
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Tab bar */}
        <div role="tablist" aria-label="Field Manual sections" style={{ display: 'flex', gap: 2, padding: '0.75rem 1.25rem 0', borderBottom: '1px solid #00ffcc1a' }}>
          {TABS.map(tab => (
            <button
              type="button"
              key={tab.id}
              id={`manual-tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`manual-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const index = TABS.findIndex(item => item.id === activeTab);
                const nextIndex = event.key === 'Home' ? 0
                  : event.key === 'End' ? TABS.length - 1
                    : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
                const next = TABS[nextIndex];
                setActiveTab(next.id);
                document.getElementById(`manual-tab-${next.id}`)?.focus();
              }}
              style={{
                background: activeTab === tab.id ? '#00ffcc0d' : 'transparent',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab.id ? '#00ffcc' : 'transparent'}`,
                color: activeTab === tab.id ? '#00ffcc' : 'var(--crg-muted)',
                fontFamily: 'monospace', fontSize: '0.75rem',
                letterSpacing: 3, cursor: 'pointer',
                padding: '0.4rem 0.75rem 0.6rem', minHeight: 44,
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div
          id={`manual-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`manual-tab-${activeTab}`}
          tabIndex={0}
          style={{ overflowY: 'auto', padding: '1.25rem', flex: 1 }}
        >
          {activeTab === 'howtoplay' && <TabHowToPlay />}
          {activeTab === 'interface' && <TabInterface />}
          {activeTab === 'cards'     && <TabCards />}
          {activeTab === 'options'   && <TabOptions />}
        </div>
        </div>{/* end modal-contents */}
      </OverlayShell>
    </>
  );
};
