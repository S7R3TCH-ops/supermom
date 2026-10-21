import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveEmailFailureOutcome, latestSentStamps } from './invoiceEmailOutcome';
import { decorateInvoiceWithBalances } from './invoiceBalances';

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

  it('success then failing resend with the server stamp unchanged is never sent', () => {
    // before holds the SERVER stamp from the first send's re-read; the failed resend leaves it alone
    const server = { invoiceSentAt: '2026-10-16T00:25:02.123+00:00', receiptSentAt: null };
    const reread = { invoiceSentAt: '2026-10-16T00:25:02.123Z', receiptSentAt: null }; // same instant, other format
    expect(resolveEmailFailureOutcome({ before: server, after: reread, status: null })).toBe('unsure');
    expect(resolveEmailFailureOutcome({ before: server, after: reread, status: 500 })).toBe('error');
  });

  it('a client-clock snapshot would poison the check (why before must be server stamps)', () => {
    const clientClock = { invoiceSentAt: '2026-10-16T00:25:09.000Z', receiptSentAt: null };
    const server = { invoiceSentAt: '2026-10-16T00:25:02.000Z', receiptSentAt: null };
    expect(resolveEmailFailureOutcome({ before: clientClock, after: server, status: null })).toBe('sent');
  });

  it('only forward movement counts: null->value and later are sent; earlier and value->null are not', () => {
    const t1 = '2026-10-16T00:25:02Z';
    const t2 = '2026-10-17T00:25:02Z';
    const o = (before, after, field = 'invoiceSentAt') => resolveEmailFailureOutcome({
      before: { invoiceSentAt: null, receiptSentAt: null, [field]: before },
      after: { invoiceSentAt: null, receiptSentAt: null, [field]: after },
      status: null,
    });
    expect(o(null, t1)).toBe('sent');
    expect(o(t1, t2)).toBe('sent');
    expect(o(null, t1, 'receiptSentAt')).toBe('sent');
    expect(o(t2, t1)).toBe('unsure');
    expect(o(t1, null)).toBe('unsure');
    expect(o(t1, null, 'receiptSentAt')).toBe('unsure');
  });

  it('unknown snapshot (before null) never reports sent', () => {
    const after = { invoiceSentAt: '2026-10-16T00:25:02Z', receiptSentAt: null };
    expect(resolveEmailFailureOutcome({ before: null, after, status: null })).toBe('unsure');
    expect(resolveEmailFailureOutcome({ before: null, after, status: 500 })).toBe('error');
  });

  it('does not compare against wall-clock time (only before vs after)', () => {
    const stamp = '2099-01-01T00:00:00Z';
    const same = { invoiceSentAt: stamp, receiptSentAt: null };
    expect(resolveEmailFailureOutcome({ before: same, after: { ...same }, status: null })).toBe('unsure');
  });
});

describe('latestSentStamps', () => {
  const inv = (...jobs) => ({ invoice_jobs: jobs.map(j => ({ jobs: j })) });

  it('returns nulls when no job has a stamp or there are no jobs', () => {
    expect(latestSentStamps(inv({ id: 'a' }))).toEqual({ invoiceSentAt: null, receiptSentAt: null });
    expect(latestSentStamps({})).toEqual({ invoiceSentAt: null, receiptSentAt: null });
  });

  it('takes the latest stamp per field regardless of invoice_jobs order', () => {
    const old = { id: 'a', invoice_sent_at: '2026-09-01T10:00:00Z' };
    const fresh = { id: 'b', invoice_sent_at: '2026-10-16T00:25:02Z', receipt_sent_at: '2026-10-17T00:00:00Z' };
    const expected = { invoiceSentAt: '2026-10-16T00:25:02Z', receiptSentAt: '2026-10-17T00:00:00Z' };
    expect(latestSentStamps(inv(old, fresh))).toEqual(expected);
    expect(latestSentStamps(inv(fresh, old))).toEqual(expected);
  });

  it('compares instants, not strings (offset formats)', () => {
    const a = { invoice_sent_at: '2026-10-16T01:00:00+00:00' };
    const b = { invoice_sent_at: '2026-10-15T23:30:00-05:00' }; // = 04:30Z, later
    expect(latestSentStamps(inv(a, b)).invoiceSentAt).toBe('2026-10-15T23:30:00-05:00');
  });
});

describe('sent-at stamps survive the invoice JSON read path', () => {
  it('decorateInvoiceWithBalances leaves invoice_jobs[].jobs (and their stamps) untouched', async () => {
    const sb = { from: () => {
      const b = { select: () => b, eq: () => b, is: () => b, order: () => b,
        then: (ok, err) => Promise.resolve({ data: [], error: null }).then(ok, err) };
      return b;
    } };
    const invoice = {
      id: 'inv-1', business_id: 'biz-1', client_id: 'c1', businesses: { id: 'biz-1' },
      invoice_jobs: [{ job_id: 'j1', jobs: { id: 'j1', invoice_sent_at: '2026-10-16T00:25:02Z', receipt_sent_at: null } }],
    };
    const out = await decorateInvoiceWithBalances(sb, invoice);
    expect(latestSentStamps(out)).toEqual({ invoiceSentAt: '2026-10-16T00:25:02Z', receiptSentAt: null });
  });

  it('api/invoice.ts handleJsonRead selects the stamp columns (regression: they were missing)', () => {
    const src = readFileSync(new URL('../../api/invoice.ts', import.meta.url), 'utf8');
    const body = src.slice(src.indexOf('async function handleJsonRead'), src.indexOf('async function handleEmail'));
    expect(body).toMatch(/invoice_jobs\(job_id, jobs\([^)]*invoice_sent_at[^)]*receipt_sent_at/);
  });
});
