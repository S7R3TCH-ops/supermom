import { describe, it, expect } from 'vitest';
import {
  nearestIndex, scrollTopForIndex, parseHHMM, to12Hour, from12Hour, buildHHMM,
  parseISODate, daysInMonth, buildISODate, yearRange,
} from './wheelPicker';

describe('nearestIndex', () => {
  it('rounds to nearest item', () => {
    expect(nearestIndex(0, 40, 12)).toBe(0);
    expect(nearestIndex(38, 40, 12)).toBe(1);
    expect(nearestIndex(19, 40, 12)).toBe(0);
    expect(nearestIndex(21, 40, 12)).toBe(1);
  });
  it('clamps to bounds', () => {
    expect(nearestIndex(-50, 40, 12)).toBe(0);
    expect(nearestIndex(10000, 40, 12)).toBe(11);
  });
  it('handles empty list', () => {
    expect(nearestIndex(100, 40, 0)).toBe(0);
  });
});

describe('scrollTopForIndex', () => {
  it('is the inverse of nearestIndex at exact positions', () => {
    expect(scrollTopForIndex(0, 40)).toBe(0);
    expect(scrollTopForIndex(5, 40)).toBe(200);
  });
});

describe('parseHHMM / buildHHMM', () => {
  it('parses valid times', () => {
    expect(parseHHMM('09:30')).toEqual({ hour24: 9, minute: 30 });
    expect(parseHHMM('23:59')).toEqual({ hour24: 23, minute: 59 });
    expect(parseHHMM('00:00')).toEqual({ hour24: 0, minute: 0 });
  });
  it('rejects invalid/empty input', () => {
    expect(parseHHMM('')).toBeNull();
    expect(parseHHMM(null)).toBeNull();
    expect(parseHHMM('25:00')).toBeNull();
    expect(parseHHMM('bad')).toBeNull();
  });
  it('round-trips through buildHHMM', () => {
    expect(buildHHMM(9, 5)).toBe('09:05');
    expect(buildHHMM(0, 0)).toBe('00:00');
    expect(buildHHMM(23, 45)).toBe('23:45');
  });
});

describe('to12Hour / from12Hour', () => {
  it('converts midnight and noon correctly', () => {
    expect(to12Hour(0)).toEqual({ hour12: 12, ampm: 'AM' });
    expect(to12Hour(12)).toEqual({ hour12: 12, ampm: 'PM' });
  });
  it('converts standard hours', () => {
    expect(to12Hour(9)).toEqual({ hour12: 9, ampm: 'AM' });
    expect(to12Hour(21)).toEqual({ hour12: 9, ampm: 'PM' });
  });
  it('round-trips', () => {
    for (let h = 0; h < 24; h++) {
      const { hour12, ampm } = to12Hour(h);
      expect(from12Hour(hour12, ampm)).toBe(h);
    }
  });
});

describe('parseISODate / buildISODate', () => {
  it('parses valid dates', () => {
    expect(parseISODate('2026-07-22')).toEqual({ year: 2026, month: 7, day: 22 });
  });
  it('rejects invalid input', () => {
    expect(parseISODate('')).toBeNull();
    expect(parseISODate(null)).toBeNull();
    expect(parseISODate('not-a-date')).toBeNull();
  });
  it('round-trips through buildISODate', () => {
    expect(buildISODate(2026, 7, 22)).toBe('2026-07-22');
    expect(buildISODate(2026, 1, 5)).toBe('2026-01-05');
  });
});

describe('daysInMonth', () => {
  it('handles standard months', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
  });
  it('handles February in leap and non-leap years', () => {
    expect(daysInMonth(2024, 2)).toBe(29); // leap
    expect(daysInMonth(2026, 2)).toBe(28); // non-leap
  });
});

describe('yearRange', () => {
  it('returns 4 years centered just before the reference year', () => {
    expect(yearRange(2026)).toEqual([2025, 2026, 2027, 2028]);
  });
});
