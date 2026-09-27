import { describe, it, expect } from 'vitest';
import {
  buildPaymentPreview,
  buildPaymentReceipt,
  getLastPaymentRound,
} from './paymentPreview';

describe('buildPaymentPreview', () => {
  const jobs2 = [
    { jobId: 'j1', owing: 100, date: '2026-09-23' },
    { jobId: 'j2', owing: 50, date: '2026-09-25' },
  ];

  it('blank amount (full payment across 2 jobs)', () => {
    const preview = buildPaymentPreview(jobs2, '');
    expect(preview.summary).toBe('Pays all 2 jobs in full ($150.00).');
    expect(preview.lines).toEqual([
      '✓ Sep 23 — paid in full ($100.00)',
      '✓ Sep 25 — paid in full ($50.00)',
    ]);

    const previewNull = buildPaymentPreview(jobs2, null);
    expect(previewNull.summary).toBe('Pays all 2 jobs in full ($150.00).');
  });

  it('full amount across 2 jobs', () => {
    const preview = buildPaymentPreview(jobs2, 150);
    expect(preview.summary).toBe('Pays all 2 jobs in full ($150.00).');
    expect(preview.lines).toEqual([
      '✓ Sep 23 — paid in full ($100.00)',
      '✓ Sep 25 — paid in full ($50.00)',
    ]);
  });

  it('partial amount across 2 jobs', () => {
    const preview = buildPaymentPreview(jobs2, 120);
    expect(preview.summary).toBeNull();
    expect(preview.lines).toEqual([
      '✓ Sep 23 — paid in full ($100.00)',
      '◐ Sep 25 — $20.00 of $50.00 (still owes $30.00)',
    ]);
  });

  it('single job partial', () => {
    const preview = buildPaymentPreview([{ jobId: 'j1', owing: 100, date: '2026-09-23' }], 40);
    expect(preview.summary).toBeNull();
    expect(preview.lines).toEqual([
      '◐ Sep 23 — $40.00 of $100.00 (still owes $60.00)',
    ]);

    const fullOne = buildPaymentPreview([{ jobId: 'j1', owing: 100, date: '2026-09-23' }], null);
    expect(fullOne.summary).toBe('Pays in full ($100.00).');
    expect(fullOne.lines).toEqual([
      '✓ Sep 23 — paid in full ($100.00)',
    ]);
  });

  it('empty targets', () => {
    const preview = buildPaymentPreview([], 50);
    expect(preview.summary).toBeNull();
    expect(preview.lines).toEqual([]);
  });
});

describe('buildPaymentReceipt', () => {
  it('receipt breakdown', () => {
    const allocations = [
      { jobId: 'j1', amount: 100, owing: 100, paidInFull: true },
      { jobId: 'j2', amount: 50, owing: 80, paidInFull: false },
    ];
    const targets = [
      { id: 'j1', owing: 100, scheduled_date: '2026-09-23' },
      { id: 'j2', owing: 80, scheduled_date: '2026-09-25' },
    ];
    const receipt = buildPaymentReceipt(allocations, 150, targets);
    expect(receipt.title).toBe('Payment recorded: $150.00');
    expect(receipt.lines).toEqual([
      '✓ Sep 23 — paid in full ($100.00)',
      '◐ Sep 25 — $50.00 of $80.00 (still owes $30.00)',
    ]);
  });
});

describe('getLastPaymentRound', () => {
  it('two payments 5s apart + one 60s earlier -> only last two included', () => {
    const payments = [
      { id: 'p1', invoice_id: 'inv-1', amount: 40, created_at: '2026-09-27T14:00:00.000Z', payment_date: '2026-09-27' },
      { id: 'p2', invoice_id: 'inv-1', amount: 70, created_at: '2026-09-27T14:00:55.000Z', payment_date: '2026-09-27' },
      { id: 'p3', invoice_id: 'inv-1', amount: 50, created_at: '2026-09-27T14:01:00.000Z', payment_date: '2026-09-27' },
    ];

    const round = getLastPaymentRound(payments, 'inv-1');
    expect(round).not.toBeNull();
    expect(round.amount).toBe(120);
    expect(round.count).toBe(2);
    expect(round.dateStr).toBe('Sep 27');
  });

  it('payment on a different invoice, newer than the rest -> sentence ignores it', () => {
    const payments = [
      { id: 'p1', invoice_id: 'inv-1', amount: 40, created_at: '2026-09-27T14:00:00.000Z', payment_date: '2026-09-27' },
      { id: 'p2', invoice_id: 'inv-1', amount: 70, created_at: '2026-09-27T14:00:55.000Z', payment_date: '2026-09-27' },
      { id: 'p3', invoice_id: 'inv-1', amount: 50, created_at: '2026-09-27T14:01:00.000Z', payment_date: '2026-09-27' },
      { id: 'p4', invoice_id: 'inv-OTHER', amount: 999, created_at: '2026-09-27T14:05:00.000Z', payment_date: '2026-09-27' },
    ];

    const round = getLastPaymentRound(payments, 'inv-1');
    expect(round).not.toBeNull();
    expect(round.amount).toBe(120);
    expect(round.count).toBe(2);
    expect(round.dateStr).toBe('Sep 27');
  });

  it('empty array or null -> returns null', () => {
    expect(getLastPaymentRound([], 'inv-1')).toBeNull();
    expect(getLastPaymentRound(null, 'inv-1')).toBeNull();
    expect(getLastPaymentRound([{ id: 'p1', invoice_id: 'inv-other', created_at: '2026-09-27T14:00:00.000Z' }], 'inv-1')).toBeNull();
  });
});
