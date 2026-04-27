// src/ui/UpdateBanner.tsx
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '10px 20px',
        background: 'rgba(5,5,20,0.97)',
        border: '1px solid #00ffcc44',
        borderRadius: 6,
        boxShadow: '0 0 24px rgba(0,255,204,0.12)',
        fontFamily: 'monospace',
        fontSize: 11,
        letterSpacing: 2,
        color: '#00ffcc',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: '#667788' }}>▲ UPDATE AVAILABLE</span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          background: 'none',
          border: '1px solid #00ffcc66',
          borderRadius: 4,
          color: '#00ffcc',
          fontFamily: 'monospace',
          fontSize: 11,
          letterSpacing: 2,
          padding: '4px 12px',
          cursor: 'pointer',
        }}
      >
        RELOAD
      </button>
    </div>
  );
}
