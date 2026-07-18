import { describe, it, expect, vi } from 'vitest';
import { resolveViewportHeight, applyAppHeight, installAppHeight } from './appHeight';

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
