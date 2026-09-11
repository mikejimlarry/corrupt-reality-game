import { useEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from 'react';

interface OverlayShellProps {
  children: ReactNode;
  ariaLabel: string;
  background: string;
  zIndex?: number;
  maxWidth?: number;
  panelClassName?: string;
  panelStyle?: CSSProperties;
  onBackdropClick?: () => void;
  onRequestClose?: () => void;
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
  onRequestClose,
}: OverlayShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onRequestClose);
  const stopPanelClick = (event: MouseEvent<HTMLDivElement>) => event.stopPropagation();

  useEffect(() => {
    closeRef.current = onRequestClose;
  }, [onRequestClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    if (!panel) return;

    const focusableSelector = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const focusFirst = () => {
      const first = panel.querySelector<HTMLElement>(focusableSelector);
      (first ?? panel).focus();
    };
    const frame = window.requestAnimationFrame(focusFirst);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeRef.current) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
        .filter(element => !element.hasAttribute('disabled') && element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

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
        ref={panelRef}
        tabIndex={-1}
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
