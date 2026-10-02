import { describe, it, expect } from 'vitest';
import { computeArrivalMs } from './dateUtils';

describe('computeArrivalMs', () => {
  const start = new Date('2026-10-01T22:30:00Z'); // 6:30 PM EDT
  const driveSecs = 7 * 60;

  it('future leave-by: arrives at job start, not now + drive', () => {
    const now = new Date('2026-10-01T21:16:00Z').getTime(); // 5:16 PM EDT
    expect(computeArrivalMs(driveSecs, start, now)).toBe(start.getTime());
  });

  it('leave-by passed (running late): arrives now + drive', () => {
    const now = new Date('2026-10-01T22:28:00Z').getTime();
    expect(computeArrivalMs(driveSecs, start, now)).toBe(now + driveSecs * 1000);
  });

  it('leaving exactly now: arrives at start either way', () => {
    const now = start.getTime() - driveSecs * 1000;
    expect(computeArrivalMs(driveSecs, start, now)).toBe(start.getTime());
  });
});
