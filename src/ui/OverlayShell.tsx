import type { CSSProperties, MouseEvent, ReactNode } from 'react';

interface OverlayShellProps {
  children: ReactNode;
  ariaLabel: string;
  background: string;
  zIndex?: number;
  maxWidth?: number;
  panelClassName?: string;
  panelStyle?: CSSProperties;
  onBackdropClick?: () => void;
}

/**
 * Viewport-safe shell for state-dependent game dialogs. The backdrop never
 * scrolls the game underneath it; the panel itself becomes scrollable whenever
 * its content is taller than the available safe-area-adjusted viewport.
 */
export function OverlayShell({
  children,
  ariaLabel,
  background,
  zIndex = 200,
  maxWidth = 480,
  panelClassName,
  panelStyle,
  onBackdropClick,
}: OverlayShellProps) {
  const stopPanelClick = (event: MouseEvent<HTMLDivElement>) => event.stopPropagation();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: 'max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))',
        background,
        fontFamily: 'monospace',
      }}
    >
      <div
        className={panelClassName}
        onClick={stopPanelClick}
        style={{
          width: '100%',
          maxWidth,
          maxHeight: '100%',
          overflowX: 'hidden',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          boxSizing: 'border-box',
          ...panelStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
