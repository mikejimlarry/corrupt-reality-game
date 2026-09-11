/**
 * Small, defensive wrapper around Web Storage.
 *
 * Safari private mode, embedded browsers, storage quotas, and server-side test
 * environments can all make `localStorage` throw. Preferences should degrade
 * to their defaults instead of preventing the game from booting.
 */
function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const safeStorage = {
  get(key: string, fallback = ''): string {
    try {
      return storage()?.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },

  set(key: string, value: string): boolean {
    try {
      const target = storage();
      if (!target) return false;
      target.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },

  getInteger(key: string, fallback: number, min: number, max: number, step = 1): number {
    const value = Number(this.get(key, ''));
    return Number.isInteger(value) && value >= min && value <= max && (value - min) % step === 0
      ? value
      : fallback;
  },

  getJson<T>(key: string, fallback: T, isValid?: (value: unknown) => value is T): T {
    try {
      const raw = storage()?.getItem(key);
      if (!raw) return fallback;
      const value: unknown = JSON.parse(raw);
      if (!isValid) return value as T;
      return isValid(value) ? value : fallback;
    } catch {
      return fallback;
    }
  },
};
