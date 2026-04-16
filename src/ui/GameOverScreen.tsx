// src/ui/GameOverScreen.tsx
import { useEffect, useState } from 'react';
import { useGameStore } from '../state/useGameStore';

const STYLE = `
@keyframes go-flicker {
  0%, 89%, 100% { opacity: 1; }
  90%           { opacity: 0.3; }
  92%           { opacity: 1; }
  95%           { opacity: 0.5; }
  97%           { opacity: 1; }
}
@keyframes go-scan {
  0%   { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}
@keyframes go-fade-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.go-flicker  { animation: go-flicker 4s infinite; }
.go-fade-in  { animation: go-fade-in 0.6s ease forwards; }
.go-fade-in-2 { animation: go-fade-in 0.6s 0.2s ease both; }
.go-fade-in-3 { animation: go-fade-in 0.6s 0.4s ease both; }
.go-fade-in-4 { animation: go-fade-in 0.6s 0.6s ease both; }
.go-fade-in-5 { animation: go-fade-in 0.6s 0.8s ease both; }
`;

function useInjectStyle(css: string) {
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, [css]);
}

interface GameRecords { wins: number; losses: number; }

function readRecords(): GameRecords {
  try {
    const raw = localStorage.getItem('crg-records');
    if (raw) return JSON.parse(raw) as GameRecords;
  } catch { /* ignore */ }
  return { wins: 0, losses: 0 };
}

export function GameOverScreen() {
  useInjectStyle(STYLE);

  const players       = useGameStore(s => s.players);
  const winnerId      = useGameStore(s => s.winnerId);
  const turnNumber    = useGameStore(s => s.turnNumber);
  const corruption    = useGameStore(s => s.globalCorruptionMode);
  const gameStats     = useGameStore(s => s.gameStats);
  const resetToSetup  = useGameStore(s => s.resetToSetup);

  const winner   = players.find(p => p.id === winnerId);
  const human    = players.find(p => p.isHuman);
  const humanWon = winner?.isHuman ?? false;

  const ACCENT  = corruption ? '#ff1e3c' : '#00ffcc';
  const DIM     = corruption ? '#661020' : '#00ffcc22';

  // Sort: winner first, then by credits descending, eliminated last
  const ranked = [...players].sort((a, b) => {
    if (a.id === winnerId) return -1;
    if (b.id === winnerId) return 1;
    if (a.eliminated && !b.eliminated) return 1;
    if (!a.eliminated && b.eliminated) return -1;
    return b.credits - a.credits;
  });

  // Elimination order for display (losers only, in order)
  const elimOrder = gameStats.eliminationOrder
    .map(id => players.find(p => p.id === id)?.name)
    .filter(Boolean) as string[];

  const [visible, setVisible] = useState(false);
  const [records, setRecords] = useState<GameRecords>({ wins: 0, losses: 0 });

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // Read updated records after the game record has been saved
    setRecords(readRecords());
  }, [winnerId]);

  if (!visible) return null;

  const totalGames = records.wins + records.losses;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(3,3,10,0.96)',
      zIndex: 20,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace',
      overflow: 'hidden',
    }}>

      {/* Scanline sweep */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0,
          height: 2, background: `${ACCENT}18`,
          animation: 'go-scan 3s linear infinite',
        }} />
      </div>

      {/* Vignette */}
      {corruption && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          boxShadow: 'inset 0 0 140px 60px rgba(200,0,30,0.4)',
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 1, width: 420, display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

        {/* Header */}
        <div className="go-flicker go-fade-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: 6, color: `${ACCENT}66`, marginBottom: '0.4rem' }}>
            SESSION TERMINATED
          </div>
          <div style={{
            fontSize: humanWon ? '2rem' : '1.6rem',
            fontWeight: 'bold',
            letterSpacing: humanWon ? 6 : 4,
            color: ACCENT,
            textShadow: `0 0 24px ${ACCENT}88`,
            lineHeight: 1.1,
          }}>
            {humanWon ? 'TASK COMPLETE' : 'FAILURE'}
          </div>
          <div style={{ fontSize: '0.7rem', color: `${ACCENT}88`, letterSpacing: 3, marginTop: '0.4rem' }}>
            {humanWon
              ? `${human?.name ?? 'YOU'} DOMINATES THE NET`
              : `${winner?.name ?? 'UNKNOWN'} CONTROLS THE NET`}
          </div>
        </div>

        {/* Meta row */}
        <div className="go-fade-in-2" style={{
          display: 'flex', justifyContent: 'center', gap: '1.5rem',
          fontSize: '0.6rem', letterSpacing: 3, color: `${ACCENT}55`,
          borderTop: `1px solid ${DIM}`, borderBottom: `1px solid ${DIM}`,
          padding: '0.5rem 0',
          flexWrap: 'wrap',
        }}>
          <span>TURNS: {turnNumber}</span>
          <span>AGENTS: {players.length}</span>
          {corruption && <span style={{ color: '#ff4466' }}>[!] CORRUPTED</span>}
          {totalGames > 0 && (
            <span style={{ color: humanWon ? '#00ffcc88' : '#ff446688' }}>
              W/L: {records.wins}/{records.losses}
            </span>
          )}
        </div>

        {/* Player standings */}
        <div className="go-fade-in-3" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ fontSize: '0.55rem', letterSpacing: 3, color: `${ACCENT}44`, marginBottom: '0.15rem' }}>
            FINAL STANDINGS
          </div>
          {ranked.map((p, i) => {
            const isWinner = p.id === winnerId;
            const rowAccent = isWinner ? ACCENT : p.eliminated ? '#334455' : '#556677';
            const cardsPlayed = gameStats.cardsPlayed[p.id] ?? 0;
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.4rem 0.65rem',
                background: isWinner ? `${ACCENT}0d` : 'transparent',
                border: `1px solid ${isWinner ? ACCENT + '44' : '#ffffff08'}`,
                borderRadius: 3,
                opacity: p.eliminated ? 0.55 : 1,
              }}>
                {/* Rank */}
                <span style={{ fontSize: '0.65rem', color: rowAccent, width: 16, textAlign: 'right', flexShrink: 0 }}>
                  {isWinner ? '*' : `#${i + 1}`}
                </span>

                {/* Name */}
                <span style={{
                  flex: 1, fontSize: '0.72rem', letterSpacing: 2,
                  color: isWinner ? ACCENT : p.eliminated ? '#445566' : '#aabbcc',
                  fontWeight: isWinner ? 'bold' : 'normal',
                }}>
                  {p.name}
                  {p.isHuman && <span style={{ fontSize: '0.5rem', color: `${ACCENT}55`, marginLeft: 5 }}>YOU</span>}
                </span>

                {/* Cards played */}
                <span style={{ fontSize: '0.55rem', color: `${rowAccent}88`, width: 36, textAlign: 'center' }}>
                  {cardsPlayed > 0 ? `${cardsPlayed}c` : '--'}
                </span>

                {/* Damage dealt */}
                <span style={{ fontSize: '0.55rem', color: `${rowAccent}88`, width: 40, textAlign: 'center' }}>
                  {(gameStats.damageDealt[p.id] ?? 0) > 0 ? `${gameStats.damageDealt[p.id]}↯` : '--'}
                </span>

                {/* Daemons */}
                <span style={{ fontSize: '0.6rem', color: rowAccent, letterSpacing: 1, width: 36, textAlign: 'center' }}>
                  {p.daemons.length > 0 ? `[D]×${p.daemons.length}` : '--'}
                </span>

                {/* Credits */}
                <span style={{ fontSize: '0.8rem', color: isWinner ? ACCENT : rowAccent, letterSpacing: 1, width: 44, textAlign: 'right', fontWeight: isWinner ? 'bold' : 'normal' }}>
                  {p.credits}¢
                </span>

                {/* Status badge */}
                <span style={{
                  fontSize: '0.5rem', letterSpacing: 1,
                  color: isWinner ? '#000' : p.eliminated ? '#ff334488' : `${ACCENT}66`,
                  background: isWinner ? ACCENT : 'transparent',
                  border: isWinner ? 'none' : `1px solid ${p.eliminated ? '#ff334433' : '#ffffff11'}`,
                  padding: '1px 5px', borderRadius: 2,
                  flexShrink: 0,
                }}>
                  {isWinner ? 'WIN' : p.eliminated ? 'DEAD' : 'ALIVE'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Elimination order */}
        {elimOrder.length > 0 && (
          <div className="go-fade-in-4" style={{
            fontSize: '0.55rem', color: `${ACCENT}33`, letterSpacing: 2,
            textAlign: 'center',
          }}>
            ELIMINATED: {elimOrder.join(' → ')}
          </div>
        )}

        {/* Reboot button */}
        <div className="go-fade-in-5" style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => resetToSetup()}
            style={{
              padding: '0.75rem 2.5rem',
              background: `${ACCENT}18`,
              border: `1px solid ${ACCENT}`,
              color: ACCENT,
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              letterSpacing: 5,
              cursor: 'pointer',
              textShadow: `0 0 10px ${ACCENT}66`,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = `${ACCENT}33`;
              (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${ACCENT}44`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = `${ACCENT}18`;
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            ↺ REBOOT GAME
          </button>
        </div>
      </div>
    </div>
  );
}
