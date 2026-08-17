import { describe, it, expect } from 'vitest';
import { isKeyboardOpen } from './useKeyboardFocus';

// F1 (2026-08-16 audit): the old implementation captured `fullHeight = vv.height`
// once at mount and compared future resizes against that frozen baseline. Any
// legitimate non-keyboard resize (rotation, nav-bar show/hide) after mount made
// the baseline stale, latching `isFocused` wrong for the component's lifetime.
// `isKeyboardOpen` replaces that with the same stateless signal appHeight.js's
// `resolveViewportHeight` uses — every call is independent of prior calls.
describe('isKeyboardOpen', () => {
  it('is false when visualViewport is absent', () => {
    expect(isKeyboardOpen({ innerHeight: 900 })).toBe(false);
  });

  it('is false when the delta is small (safe-area/toolbar, <=150px)', () => {
    expect(isKeyboardOpen({ visualViewport: { height: 812 }, innerHeight: 900 })).toBe(false);
  });

  it('is true when the delta looks like an on-screen keyboard (>150px)', () => {
    expect(isKeyboardOpen({ visualViewport: { height: 624 }, innerHeight: 915 })).toBe(true);
  });

  it('does not latch onto a stale baseline across repeated calls', () => {
    const win = { visualViewport: { height: 900 }, innerHeight: 900 };
    expect(isKeyboardOpen(win)).toBe(false);

    // A non-keyboard resize shrinks both dimensions together (e.g. rotation) —
    // a frozen-baseline implementation would have compared against the original
    // 900px and misfired here. The stateless signal reads live values each call.
    win.innerHeight = 700;
    win.visualViewport.height = 700;
    expect(isKeyboardOpen(win)).toBe(false);

    // Keyboard opens on top of the new geometry.
    win.visualViewport.height = 450;
    expect(isKeyboardOpen(win)).toBe(true);
  });
});
