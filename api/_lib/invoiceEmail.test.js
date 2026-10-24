import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  APP_ORIGIN, invoiceViewUrl, normalizeRecipient, safeAttachmentName, safeDisplayName,
  buildInvoiceEmailText, domainCanReceiveMail, stripControl, formatServiceDates,
} from './invoiceEmail.js';

describe('normalizeRecipient', () => {
  it('trims and lowercases a good address', () => {
    expect(normalizeRecipient('  Nma.Jerrye@Gmail.com ')).toEqual({ ok: true, email: 'nma.jerrye@gmail.com', domain: 'gmail.com' });
  });
  it.each(['', '   ', null, undefined, 'nope', 'a@b', 'a b@c.com', 'a@b.com, c@d.com', 'a@b.com;c@d.com', 'a..b@c.com'])('rejects %j', (v) => {
    expect(normalizeRecipient(v).ok).toBe(false);
  });
  it('flags provider-domain typos with a suggestion', () => {
    const r = normalizeRecipient('sam@gmial.com');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('sam@gmail.com');
  });
});

describe('domainCanReceiveMail timer', () => {
  it('clears its timeout so the event loop is not held open', async () => {
    const count = () => process.getActiveResourcesInfo().filter(r => r === 'Timeout').length;
    const before = count();
    await domainCanReceiveMail('example.com', 5000);
    expect(count()).toBeLessThanOrEqual(before);
  });
});

describe('domainCanReceiveMail', () => {
  it('fails open on a resolver that never answers', async () => {
    // 1ms timeout: the race resolves true before DNS can answer
    expect(await domainCanReceiveMail('example.com', 1)).toBe(true);
  });
});

describe('invoice email content', () => {
  it('links to the app on the sender domain', () => {
    expect(invoiceViewUrl('abc-123')).toBe(`${APP_ORIGIN}/i/abc-123`);
    expect(APP_ORIGIN).toContain('supermomforhire.com');
  });
  it('sanitises attachment and display names', () => {
    expect(safeAttachmentName('O\'Brien Smith/..', 'Invoice', '2026-064')).toBe('OBrienSmith_Invoice_2026-064.pdf');
    expect(safeAttachmentName(null, 'Receipt', '1')).toBe('Client_Receipt_1.pdf');
    expect(safeDisplayName('Sandra "Mom"\r\nBcc: x@y.com')).toBe('Sandra MomBcc: x@y.com');
    expect(safeDisplayName('')).toBe('Supermom for Hire');
    expect(stripControl('2026-1\r\nBcc: x@y.com')).toBe('2026-1Bcc: x@y.com');
  });
  it('plain-text part carries the link, number and payment info', () => {
    const t = buildInvoiceEmailText({ clientName: 'Nma', bizName: 'Supermom for Hire', bizEmail: 'sandra@supermomforhire.com', invoiceNumber: '2026-064', isReceipt: false, viewUrl: 'https://app.supermomforhire.com/i/x' });
    expect(t).toContain('https://app.supermomforhire.com/i/x');
    expect(t).toContain('#2026-064');
    expect(t).toContain('e-Transfer');
    const r = buildInvoiceEmailText({ clientName: 'Nma', bizName: 'B', invoiceNumber: '1', isReceipt: true, viewUrl: 'u' });
    expect(r).not.toContain('e-Transfer');
  });
});

describe('formatServiceDates', () => {
  it('formats a single day', () => {
    expect(formatServiceDates(['2026-10-14'])).toEqual({ label: 'Date of Service', text: 'October 14, 2026' });
  });
  it('dedupes, sorts and lists up to three days', () => {
    expect(formatServiceDates(['2026-10-21', '2026-10-14', '2026-10-14'])).toEqual({ label: 'Dates of Service', text: 'October 14, 2026, October 21, 2026' });
  });
  it('collapses four or more days to a range', () => {
    const r = formatServiceDates(['2026-10-28', '2026-10-07', '2026-10-14', '2026-10-21']);
    expect(r.text).toBe('October 7, 2026 – October 28, 2026 (4 services)');
  });
  it('ignores unusable dates and returns null when none are left', () => {
    expect(formatServiceDates([null, undefined, '', 'nope', '2026-99-01', '2026-00-10'])).toBeNull();
    expect(formatServiceDates(undefined)).toBeNull();
  });
  it('shows up in the plain-text part', () => {
    const t = buildInvoiceEmailText({ clientName: 'Nma', bizName: 'B', invoiceNumber: '1', isReceipt: true, viewUrl: 'u', service: formatServiceDates(['2026-10-14']) });
    expect(t).toContain('Date of Service: October 14, 2026');
  });
});

describe('api/invoice.ts handleEmail wiring (regression guards)', () => {
  const src = readFileSync(new URL('../invoice.ts', import.meta.url), 'utf8');
  it('sends a text part, bcc, validates the recipient, and no longer fakes success without credentials', () => {
    expect(src).toContain('text: buildInvoiceEmailText');
    expect(src).toContain('bcc: gmailUser');
    expect(src).toContain('normalizeRecipient(clientEmail)');
    expect(src).not.toContain('mock: true');
    expect(src).not.toContain('supermom-v2.vercel.app');
  });
  it('receipt header uses the same pink as the invoice header (Joel 2026-10-23)', () => {
    expect(src).toContain('const headerColor = pink;');
    expect(src).not.toContain('isReceipt ? green');
  });
});
