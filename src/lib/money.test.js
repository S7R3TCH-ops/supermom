import { describe, it, expect } from 'vitest';
import { fmtMoney } from './money';
import { computeJobTotal } from './financialMath';

describe('fmtMoney', () => {
  it('always shows two decimals', () => {
    expect(fmtMoney(68)).toBe('$68.00');
    expect(fmtMoney(68.45)).toBe('$68.45');
    expect(fmtMoney('67.8')).toBe('$67.80');
  });
  it('dashes non-numbers', () => {
    expect(fmtMoney(undefined)).toBe('—');
    expect(fmtMoney('abc')).toBe('—');
  });
  it('taxed and untaxed jobs both render their exact grand total', () => {
    const taxed = { pricing_type: 'Flat', flat_rate: 60, tax_enabled: true };
    const plain = { pricing_type: 'Flat', flat_rate: 60, tax_enabled: false };
    expect(fmtMoney(computeJobTotal(taxed))).toBe('$67.80');
    expect(fmtMoney(computeJobTotal(plain))).toBe('$60.00');
  });
});
