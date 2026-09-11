import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeStorage } from './storage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('safeStorage', () => {
  it('falls back when the storage property is unavailable', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new DOMException('Storage is blocked');
      },
    });

    expect(safeStorage.get('missing', 'default')).toBe('default');
    expect(safeStorage.set('key', 'value')).toBe(false);
  });

  it('contains read, write, and parse failures', () => {
    const localStorage = {
      getItem: vi.fn(() => { throw new DOMException('Read failed'); }),
      setItem: vi.fn(() => { throw new DOMException('Quota exceeded'); }),
    } as unknown as Storage;
    vi.stubGlobal('window', { localStorage });

    expect(safeStorage.get('key', 'fallback')).toBe('fallback');
    expect(safeStorage.getJson('key', { valid: true })).toEqual({ valid: true });
    expect(safeStorage.set('key', 'value')).toBe(false);
  });

  it('validates persisted integers and JSON before returning them', () => {
    const values = new Map<string, string>([
      ['cycles', '55'],
      ['invalid-cycles', '53'],
      ['settings', '{"enabled":true}'],
    ]);
    const localStorage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn(),
    } as unknown as Storage;
    vi.stubGlobal('window', { localStorage });

    expect(safeStorage.getInteger('cycles', 50, 30, 100, 5)).toBe(55);
    expect(safeStorage.getInteger('invalid-cycles', 50, 30, 100, 5)).toBe(50);
    expect(safeStorage.getJson(
      'settings',
      { enabled: false },
      (value): value is { enabled: boolean } => (
        typeof value === 'object' && value !== null && typeof (value as { enabled?: unknown }).enabled === 'boolean'
      ),
    )).toEqual({ enabled: true });
  });
});
