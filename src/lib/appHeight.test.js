import { describe, it, expect, vi } from 'vitest';
import { resolveViewportHeight, applyAppHeight, installAppHeight, kickViewportGeometry } from './appHeight';

describe('resolveViewportHeight', () => {
  it('prefers visualViewport.height when present', () => {
    expect(resolveViewportHeight({ visualViewport: { height: 812 }, innerHeight: 900 })).toBe(812);
  });

  it('falls back to innerHeight when visualViewport is absent', () => {
    expect(resolveViewportHeight({ innerHeight: 640 })).toBe(640);
  });

  it('falls back to innerHeight when visualViewport.height is undefined', () => {
    expect(resolveViewportHeight({ visualViewport: {}, innerHeight: 700 })).toBe(700);
  });

  it('ignores visualViewport when the on-screen keyboard has shrunk it (delta > 150px)', () => {
    // innerHeight (layout viewport) stays put; visualViewport shrinks ~291px, as on
    // Android Chrome's default resizes-visual keyboard behavior.
    expect(resolveViewportHeight({ visualViewport: { height: 624 }, innerHeight: 915 })).toBe(915);
  });

  it('still tracks visualViewport for small, non-keyboard deltas (safe-area/toolbar, <=150px)', () => {
    expect(resolveViewportHeight({ visualViewport: { height: 812 }, innerHeight: 900 })).toBe(812);
  });
});

describe('applyAppHeight', () => {
  it('writes the resolved height as a px custom property on the document element', () => {
    const setProperty = vi.fn();
    const win = { visualViewport: { height: 780 }, innerHeight: 900 };
    const doc = { documentElement: { style: { setProperty } } };
    expect(applyAppHeight(win, doc)).toBe(780);
    expect(setProperty).toHaveBeenCalledWith('--app-height', '780px');
  });
});

describe('installAppHeight', () => {
  it('sets the value immediately and re-reads at cold-launch settle points (load, pageshow, visualViewport scroll)', () => {
    const setProperty = vi.fn();
    const winListeners = {};
    const vvListeners = {};
    const win = {
      innerHeight: 640,
      visualViewport: {
        height: 640,
        addEventListener: (evt, cb) => { vvListeners[evt] = cb; },
      },
      addEventListener: (evt, cb) => { winListeners[evt] = cb; },
      requestAnimationFrame: () => {},
      setTimeout: () => {},
    };
    const doc = { documentElement: { style: { setProperty } } };

    installAppHeight(win, doc);

    // Initial synchronous read happened.
    expect(setProperty).toHaveBeenCalledWith('--app-height', '640px');
    // The cold-launch and Reachability signals are all wired.
    expect(typeof winListeners.load).toBe('function');
    expect(typeof winListeners.pageshow).toBe('function');
    expect(typeof winListeners.resize).toBe('function');
    expect(typeof winListeners.orientationchange).toBe('function');
    expect(typeof vvListeners.resize).toBe('function');
    expect(typeof vvListeners.scroll).toBe('function'); // Reachability / toolbar

    // A later genuine event recomputes with the settled height.
    win.visualViewport.height = 812;
    vvListeners.scroll();
    expect(setProperty).toHaveBeenLastCalledWith('--app-height', '812px');
  });
});

describe('kickViewportGeometry', () => {
  const makeMeta = (content) => {
    let value = content;
    return {
      getAttribute: () => value,
      setAttribute: vi.fn((_, v) => { value = v; }),
      get value() { return value; },
    };
  };

  it('is a no-op when not in an iOS standalone PWA', () => {
    const meta = makeMeta('width=device-width, viewport-fit=cover');
    const doc = { querySelector: () => meta };
    kickViewportGeometry({ navigator: {} }, doc);
    expect(meta.setAttribute).not.toHaveBeenCalled();
  });

  it('is a no-op when the viewport meta has no viewport-fit=cover', () => {
    const meta = makeMeta('width=device-width, initial-scale=1');
    const doc = { querySelector: () => meta };
    const win = { navigator: { standalone: true }, requestAnimationFrame: vi.fn() };
    kickViewportGeometry(win, doc);
    expect(meta.setAttribute).not.toHaveBeenCalled();
    expect(win.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('toggles viewport-fit cover->auto->cover across two frames, then re-reads height', () => {
    const original = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
    const meta = makeMeta(original);
    const setProperty = vi.fn();
    const doc = { querySelector: () => meta, documentElement: { style: { setProperty } } };
    // Run rAF callbacks synchronously so we can observe the full cycle.
    const win = {
      navigator: { standalone: true },
      innerHeight: 700,
      requestAnimationFrame: (cb) => cb(),
    };

    kickViewportGeometry(win, doc);

    // First it switched cover -> auto...
    expect(meta.setAttribute).toHaveBeenNthCalledWith(1, 'content', original.replace('viewport-fit=cover', 'viewport-fit=auto'));
    // ...then restored the exact original (cover) on the next frame.
    expect(meta.setAttribute).toHaveBeenNthCalledWith(2, 'content', original);
    expect(meta.value).toBe(original);
    // ...and recomputed --app-height after the geometry change.
    expect(setProperty).toHaveBeenCalledWith('--app-height', '700px');
  });
});
