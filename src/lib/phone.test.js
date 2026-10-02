import { describe, it, expect } from 'vitest';
import * as ts from './phone';
import * as js from '../../api/_lib/phone.js';

const CASES = [
  '6475550100', '(647) 555-0100', '647-555-0100', '647.555.0100', '+1 647 555 0100',
  '1-647-555-0100', '16475550100', ' 647 555 0100 ', '+44 20 7946 0958', '555-0100',
  '647 555 0100 x12', '', null, undefined, 'abc',
];

describe('phone', () => {
  it('every common way of typing the same number normalises to one E.164 value', () => {
    for (const v of ['6475550100', '(647) 555-0100', '647-555-0100', '647.555.0100', '+1 647 555 0100', '1-647-555-0100', '16475550100', ' 647 555 0100 ']) {
      expect(ts.normalizePhone(v)).toBe('+16475550100');
    }
  });
  it('keeps international and odd entries instead of rejecting them', () => {
    expect(ts.normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
    expect(ts.normalizePhone('555-0100')).toBe('555-0100');
    expect(ts.normalizePhone('')).toBeNull();
    expect(ts.normalizePhone(null)).toBeNull();
  });
  it('formats any North American form for display, leaves others alone', () => {
    expect(ts.formatPhone('+16475550100')).toBe('(647) 555-0100');
    expect(ts.formatPhone('6475550100')).toBe('(647) 555-0100');
    expect(ts.formatPhone('+442079460958')).toBe('+442079460958');
    expect(ts.formatPhone('555-0100')).toBe('555-0100');
    expect(ts.formatPhone(null)).toBe('');
  });
  it('phoneDigits matches old and new storage formats for duplicate checks', () => {
    expect(ts.phoneDigits('+16475550100')).toBe(ts.phoneDigits('(647) 555-0100'));
    expect(ts.phoneDigits('6475550100')).toBe('6475550100');
  });
  it('JS mirror in api/_lib matches the TS module', () => {
    for (const c of CASES) {
      expect(js.normalizePhone(c)).toBe(ts.normalizePhone(c));
      expect(js.formatPhone(c)).toBe(ts.formatPhone(c));
      expect(js.phoneDigits(c)).toBe(ts.phoneDigits(c));
    }
  });
});
