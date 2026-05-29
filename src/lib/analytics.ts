declare global {
  interface Window {
    gtag?: (command: 'event', name: string, params?: Record<string, string | number | boolean>) => void;
  }
}

/**
 * Thin wrapper around GA4 gtag so callers don't need to know about window.gtag
 * or worry about it not being loaded yet. Silently no-ops if GA isn't present.
 */
export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
): void {
  try {
    window.gtag?.('event', name, params);
  } catch {
    // silently ignore — analytics must never break the game
  }
}
