import { describe, it, expect } from 'vitest';
import { decideSwipeAxis, resolveSwipeCommit } from './daySwipeGesture';

describe('decideSwipeAxis', () => {
  it('stays undecided under the threshold on both axes', () => {
    expect(decideSwipeAxis(3, 3)).toBe(null);
  });

  it('resolves horizontal once dx clears the threshold and dominates dy', () => {
    expect(decideSwipeAxis(9, 2)).toBe('horizontal');
  });

  it('resolves vertical once dy clears the threshold and dominates dx', () => {
    expect(decideSwipeAxis(2, 9)).toBe('vertical');
  });

  it('prefers horizontal on a tie past threshold (matches WeekStrip: dy must strictly exceed dx)', () => {
    expect(decideSwipeAxis(9, 9)).toBe('horizontal');
  });

  it('resolves horizontal for a pure leftward drag', () => {
    expect(decideSwipeAxis(-9, 1)).toBe('horizontal');
  });

  it('respects a custom decide threshold', () => {
    expect(decideSwipeAxis(15, 1, 20)).toBe(null);
    expect(decideSwipeAxis(25, 1, 20)).toBe('horizontal');
  });
});

describe('resolveSwipeCommit', () => {
  it('does not commit under the threshold', () => {
    expect(resolveSwipeCommit(49)).toEqual({ committed: false, delta: 0 });
    expect(resolveSwipeCommit(-49)).toEqual({ committed: false, delta: 0 });
  });

  it('does not commit exactly at the threshold', () => {
    expect(resolveSwipeCommit(50)).toEqual({ committed: false, delta: 0 });
  });

  it('commits next (delta +1) on a leftward drag past threshold', () => {
    expect(resolveSwipeCommit(-51)).toEqual({ committed: true, delta: 1 });
  });

  it('commits previous (delta -1) on a rightward drag past threshold', () => {
    expect(resolveSwipeCommit(51)).toEqual({ committed: true, delta: -1 });
  });

  it('respects a custom commit threshold', () => {
    expect(resolveSwipeCommit(-80, 100)).toEqual({ committed: false, delta: 0 });
    expect(resolveSwipeCommit(-120, 100)).toEqual({ committed: true, delta: 1 });
  });
});
