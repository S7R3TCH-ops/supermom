import { describe, it, expect } from 'vitest';
import { allocatePayment, parsePaymentAmount } from './paymentWaterfall';

const t = (jobId, owing, date) => ({ jobId, owing, date });

describe('allocatePayment', () => {
  it('pays every target in full when amount is null', () => {
    expect(allocatePayment([t('a', 100, '2026-09-01'), t('b', 50.5, '2026-09-02')])).toEqual([
      { jobId: 'a', amount: 100, owing: 100, paidInFull: true },
      { jobId: 'b', amount: 50.5, owing: 50.5, paidInFull: true },
    ]);
  });

  it('fills the oldest job first, regardless of input order', () => {
    const out = allocatePayment([t('new', 100, '2026-09-10'), t('old', 80, '2026-09-01')], 120);
    expect(out).toEqual([
      { jobId: 'old', amount: 80, owing: 80, paidInFull: true },
      { jobId: 'new', amount: 40, owing: 100, paidInFull: false },
    ]);
  });

  it('stops once the money runs out — later jobs get nothing', () => {
    const out = allocatePayment([t('a', 100, '1'), t('b', 100, '2'), t('c', 100, '3')], 100);
    expect(out).toEqual([{ jobId: 'a', amount: 100, owing: 100, paidInFull: true }]);
  });

  it('partial within a single job', () => {
    expect(allocatePayment([t('a', 250, '1')], 99.99)).toEqual([
      { jobId: 'a', amount: 99.99, owing: 250, paidInFull: false },
    ]);
  });

  it('does not drift by a cent across many jobs', () => {
    const targets = Array.from({ length: 10 }, (_, i) => t(`j${i}`, 33.33, String(i)));
    const out = allocatePayment(targets, 333.3);
    expect(out).toHaveLength(10);
    expect(out.every(a => a.paidInFull)).toBe(true);
    expect(Math.round(out.reduce((s, a) => s + a.amount, 0) * 100)).toBe(33330);
  });

  it('rejects overpayment', () => {
    expect(() => allocatePayment([t('a', 250, '1')], 300)).toThrow(/more than the \$250\.00 owing/);
  });

  it('rejects zero, negative and NaN', () => {
    for (const bad of [0, -5, NaN]) expect(() => allocatePayment([t('a', 10, '1')], bad)).toThrow();
  });

  it('ignores targets with nothing owing', () => {
    expect(allocatePayment([t('a', 0, '1'), t('b', 10, '2')])).toEqual([
      { jobId: 'b', amount: 10, owing: 10, paidInFull: true },
    ]);
  });
});

describe('parsePaymentAmount', () => {
  it('blank means full payment', () => {
    expect(parsePaymentAmount('')).toBeNull();
    expect(parsePaymentAmount('   ')).toBeNull();
    expect(parsePaymentAmount(undefined)).toBeNull();
  });
  it('accepts dollar formats', () => {
    expect(parsePaymentAmount('120')).toBe(120);
    expect(parsePaymentAmount('$1,200.50')).toBe(1200.5);
    expect(parsePaymentAmount('.5')).toBe(0.5);
  });
  it('rejects junk, zero and sub-cent precision', () => {
    for (const bad of ['abc', '0', '0.00', '-5', '1.234', '12a']) expect(parsePaymentAmount(bad)).toBeNaN();
  });
});
