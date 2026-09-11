export const COLORS = {
  signal: '#00ffcc',
  rival: '#ff3355',
  corruption: '#ff1e3c',
  conflict: '#ff8800',
  positive: '#00ccff',
  counter: '#bb44ff',
  cycle: '#00ff88',
  legendary: '#ffaa00',
  void: '#0a0a0f',
  panel: '#05050f',
  card: '#0d0d1f',
  text: '#aabbcc',
  body: '#8baaa0',
  muted: '#778899',
  white: '#ffffff',
} as const;

export const PHASER_COLORS = {
  signal: 0x00ffcc,
  rival: 0xff3355,
  corruption: 0xff1e3c,
  conflict: 0xff8800,
  positive: 0x00ccff,
  counter: 0xbb44ff,
  cycle: 0x00ff88,
  legendary: 0xffaa00,
  void: 0x0a0a0f,
  panel: 0x05050f,
  card: 0x0d0d1f,
  text: 0xaabbcc,
  body: 0x8baaa0,
  muted: 0x778899,
  white: 0xffffff,
} as const;

export const TYPE = {
  dom: { label: '0.75rem', body: '0.875rem', title: '1rem', headline: '1.1rem' },
  canvas: { label: '11px', body: '13px', title: '15px' },
} as const;

export const CONTROL = { minimum: 44, primary: 48 } as const;

export function alpha(hex: string, opacity: number): string {
  const normalized = hex.replace('#', '');
  const value = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${normalized}${value}`;
}
