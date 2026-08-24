import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class TestAudio {
  static instances: TestAudio[] = [];

  readonly src: string;
  loop = false;
  volume = 1;
  currentTime = 0;
  paused = true;
  play = vi.fn(() => {
    this.paused = false;
    return Promise.resolve();
  });
  pause = vi.fn(() => {
    this.paused = true;
  });

  constructor(src: string) {
    this.src = src;
    TestAudio.instances.push(this);
  }
}

function storageStub(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    clear: () => values.clear(),
    key: index => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

describe('first-interaction audio unlock', () => {
  beforeEach(() => {
    vi.resetModules();
    TestAudio.instances = [];
    vi.stubGlobal('localStorage', storageStub());
    vi.stubGlobal('document', { baseURI: 'http://localhost/game/' });
    vi.stubGlobal('Audio', TestAudio);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('waits for click instead of attempting music on pointerdown', async () => {
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    const { listenForAudioUnlock } = await import('./audio');

    listenForAudioUnlock(target as unknown as Window);
    target.dispatchEvent(new Event('pointerdown'));
    expect(TestAudio.instances).toHaveLength(0);

    target.dispatchEvent(new Event('click'));
    expect(TestAudio.instances).toHaveLength(1);
    expect(TestAudio.instances[0].src).toMatch(/\/sfx\/music_bg\.mp3$/);
    expect(TestAudio.instances[0].play).toHaveBeenCalledOnce();

    target.dispatchEvent(new Event('click'));
    expect(TestAudio.instances[0].play).toHaveBeenCalledOnce();
  });

  it('also unlocks music for a keyboard-first visit', async () => {
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    const { listenForAudioUnlock } = await import('./audio');

    listenForAudioUnlock(target as unknown as Window);
    target.dispatchEvent(new Event('keydown'));

    expect(TestAudio.instances).toHaveLength(1);
    expect(TestAudio.instances[0].play).toHaveBeenCalledOnce();
  });
});
