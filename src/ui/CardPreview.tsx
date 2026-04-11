// src/ui/CardPreview.tsx
// Hover preview card — shown at bottom-left when the player hovers a card in hand.
import { useGameStore } from '../state/useGameStore';
import type { Card as CardData, CardCategory, CardRarity } from '../types/cards';

const CAT_COLOR: Record<CardCategory, string> = {
  CREDITS:        '#00ff88',
  EVENT_POSITIVE: '#00ccff',
  EVENT_NEGATIVE: '#ff3355',
  WAR:            '#ff8800',
  COUNTER:        '#bb44ff',
  DAEMON:         '#00ffcc',
};

const CAT_LABEL: Record<CardCategory, string> = {
  CREDITS:        'DATA HARVEST',
  EVENT_POSITIVE: 'SYSTEM EVENT',
  EVENT_NEGATIVE: 'HACK PROTOCOL',
  WAR:            'GRID CONFLICT',
  COUNTER:        'COUNTERMEASURE',
  DAEMON:         'DAEMON',
};

const RARITY_COLOR: Record<CardRarity, string> = {
  COMMON:    '#aabbcc',
  UNCOMMON:  '#44aaff',
  RARE:      '#bb44ff',
  LEGENDARY: '#ffaa00',
};

// Seeded pseudo-RNG matching the Phaser card art
function rnd(seed: number, n: number) {
  const v = Math.sin(seed + n * 127.1) * 43758.5;
  return v - Math.floor(v);
}

function CircuitArt({ seed, color }: { seed: number; color: string }) {
  const W = 198, H = 38;
  const count = 7;
  const nodes = Array.from({ length: count }, (_, i) => ({
    x: 6 + rnd(seed, i * 3)     * (W - 12),
    y: 6 + rnd(seed, i * 3 + 1) * (H - 12),
  }));

  const lines: { x1: number; y1: number; xm: number; ym: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    if (rnd(seed, i * 5 + 2) < 0.7) {
      const a = nodes[i], b = nodes[i + 1];
      if (rnd(seed, i * 7 + 3) > 0.5) {
        lines.push({ x1: a.x, y1: a.y, xm: b.x, ym: a.y, x2: b.x, y2: b.y });
      } else {
        lines.push({ x1: a.x, y1: a.y, xm: a.x, ym: b.y, x2: b.x, y2: b.y });
      }
    }
  }
  const scanY = 4 + rnd(seed, seed) * (H - 8);

  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <rect width={W} height={H} rx={4} fill="#061420" />
      {lines.map((l, i) => (
        <polyline key={i}
          points={`${l.x1},${l.y1} ${l.xm},${l.ym} ${l.x2},${l.y2}`}
          fill="none" stroke={color} strokeWidth={0.75} opacity={0.3} />
      ))}
      {nodes.map((n, i) => {
        const size = rnd(seed, i * 11 + 4) > 0.7 ? 2.5 : 1.5;
        const alpha = 0.4 + rnd(seed, i * 9 + 5) * 0.5;
        return <circle key={i} cx={n.x} cy={n.y} r={size} fill={color} opacity={alpha} />;
      })}
      <line x1={0} y1={scanY} x2={W} y2={scanY} stroke="#ffffff" strokeWidth={0.5} opacity={0.04} />
    </svg>
  );
}

function statText(card: CardData): string | null {
  switch (card.category) {
    case 'CREDITS':        return `+${card.amount}`;
    case 'EVENT_POSITIVE': return card.amount > 0 ? `+${card.amount}` : null;
    case 'EVENT_NEGATIVE': return card.amount > 0 ? `-${card.amount}` : null;
    case 'WAR':            return `W -${card.winnerLoses}`;
    default:               return null;
  }
}

export function CardPreview() {
  const hoveredCardId = useGameStore(s => s.hoveredCardId);
  const players       = useGameStore(s => s.players);
  const phase         = useGameStore(s => s.phase);

  if (!hoveredCardId || phase === 'SETUP' || phase === 'GAME_OVER') return null;

  const human = players.find(p => p.isHuman);
  const card  = human?.hand.find(c => c.id === hoveredCardId);
  if (!card) return null;

  const accent  = CAT_COLOR[card.category];
  const rarity  = RARITY_COLOR[card.rarity];
  const seed    = card.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const stat    = statText(card);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        zIndex: 10,
        width: 214,
        background: '#0d0d1f',
        border: `1.5px solid ${accent}cc`,
        borderRadius: 10,
        fontFamily: 'monospace',
        overflow: 'hidden',
        boxShadow: `0 0 24px 4px ${accent}22, 0 2px 8px rgba(0,0,0,0.7)`,
        pointerEvents: 'none',
        // Slide up animation via a transform trick
        animation: 'card-preview-in 0.15s ease-out',
      }}
    >
      <style>{`
        @keyframes card-preview-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Category stripe */}
      <div style={{
        background: `${accent}22`,
        borderBottom: `1px solid ${accent}44`,
        padding: '5px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 8, color: accent, letterSpacing: 3 }}>
          {CAT_LABEL[card.category]}
        </span>
        <span style={{
          fontSize: 7, color: rarity, letterSpacing: 1,
          border: `1px solid ${rarity}66`,
          borderRadius: 3, padding: '1px 5px',
          background: `${rarity}18`,
        }}>
          {card.rarity}
        </span>
      </div>

      {/* Card name */}
      <div style={{ padding: '8px 10px 4px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#ffffff', fontWeight: 'bold', letterSpacing: 1 }}>
          {card.name.toUpperCase()}
        </span>
        {stat && (
          <span style={{
            fontSize: 10, color: accent, fontWeight: 'bold',
            background: `${accent}20`, border: `1px solid ${accent}55`,
            borderRadius: 3, padding: '1px 5px', marginLeft: 'auto',
          }}>
            {stat}
          </span>
        )}
      </div>

      {/* Circuit art */}
      <div style={{ padding: '0 8px 4px' }}>
        <CircuitArt seed={seed} color={accent} />
      </div>

      {/* Separator */}
      <div style={{ margin: '0 10px', height: 1, background: `${accent}22` }} />

      {/* Description */}
      <div style={{ padding: '6px 10px', fontSize: 9, color: '#c8d8e8', lineHeight: 1.6 }}>
        {card.description}
      </div>

      {/* Flavour text */}
      {card.flavourText && (
        <div style={{
          padding: '4px 10px 8px',
          fontSize: 8, color: '#4a5c6a', fontStyle: 'italic', lineHeight: 1.5,
          borderTop: `1px solid ${accent}15`,
        }}>
          "{card.flavourText}"
        </div>
      )}
    </div>
  );
}
