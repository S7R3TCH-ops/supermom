import { describe, it, expect, afterEach, vi } from 'vitest';
import { scrollMainToTop } from './scrollTop';

describe('scrollMainToTop', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('resets window and every .sm-scroll container', () => {
    const a = { scrollTop: 500 };
    const b = { scrollTop: 90 };
    const scrollTo = vi.fn();
    const qsa = vi.fn(() => [a, b]);
    vi.stubGlobal('window', { scrollTo });
    vi.stubGlobal('document', { querySelectorAll: qsa });
    scrollMainToTop();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(qsa).toHaveBeenCalledWith('.sm-scroll');
    expect(a.scrollTop).toBe(0);
    expect(b.scrollTop).toBe(0);
  });

  it('is a no-op without a DOM', () => {
    expect(() => scrollMainToTop()).not.toThrow();
  });
});
