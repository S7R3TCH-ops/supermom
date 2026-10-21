import { describe, it, expect } from 'vitest';
import { resolveEmailFailureOutcome } from './invoiceEmailOutcome';

const none = { invoiceSentAt: null, receiptSentAt: null };

describe('resolveEmailFailureOutcome', () => {
  it('treats a newly stamped invoice_sent_at as sent even after a network error', () => {
    const after = { invoiceSentAt: '2026-10-16T00:25:02Z', receiptSentAt: null };
    expect(resolveEmailFailureOutcome({ before: none, after, status: null })).toBe('sent');
  });

  it('treats a newly stamped receipt_sent_at as sent (server decides receipt vs invoice)', () => {
    const before = { invoiceSentAt: '2026-10-01T10:00:00Z', receiptSentAt: null };
    const after = { invoiceSentAt: '2026-10-01T10:00:00Z', receiptSentAt: '2026-10-16T00:25:02Z' };
    expect(resolveEmailFailureOutcome({ before, after, status: null })).toBe('sent');
  });

  it('treats a re-send (stamp moved forward on an already-sent invoice) as sent', () => {
    const before = { invoiceSentAt: '2026-10-01T10:00:00Z', receiptSentAt: null };
    const after = { invoiceSentAt: '2026-10-16T00:25:02Z', receiptSentAt: null };
    expect(resolveEmailFailureOutcome({ before, after, status: 500 })).toBe('sent');
  });

  it('is unsure when nothing changed after a network-level error (no HTTP response)', () => {
    expect(resolveEmailFailureOutcome({ before: none, after: { ...none }, status: null })).toBe('unsure');
  });

  it('is unsure when the re-read itself failed and there was no HTTP response', () => {
    expect(resolveEmailFailureOutcome({ before: none, after: null, status: null })).toBe('unsure');
  });

  it('is unsure on gateway/timeout statuses with unchanged stamps', () => {
    for (const status of [408, 502, 503, 504]) {
      expect(resolveEmailFailureOutcome({ before: none, after: { ...none }, status })).toBe('unsure');
    }
  });

  it('keeps a real server error (500 with message) as error when nothing changed', () => {
    expect(resolveEmailFailureOutcome({ before: none, after: { ...none }, status: 500 })).toBe('error');
  });

  it('keeps a real HTTP error as error when the re-read failed', () => {
    expect(resolveEmailFailureOutcome({ before: none, after: null, status: 403 })).toBe('error');
  });

  it('does not compare against wall-clock time (only before vs after)', () => {
    const stamp = '2099-01-01T00:00:00Z';
    const same = { invoiceSentAt: stamp, receiptSentAt: null };
    expect(resolveEmailFailureOutcome({ before: same, after: { ...same }, status: null })).toBe('unsure');
  });
});
