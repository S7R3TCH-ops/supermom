// Pure helpers for the invoice/receipt email (api/invoice.ts handleEmail).
// Kept out of invoice.ts so the deliverability-relevant bits are unit-testable.

import { promises as dns } from 'node:dns';

// Links in the body and the logo must live on the sender's own domain
// (supermomforhire.com); mail mixing a vercel.app host with a supermomforhire.com
// sender scores worse with spam filters.
export const APP_ORIGIN = 'https://app.supermomforhire.com';

export function invoiceViewUrl(invoiceId) {
  return `${APP_ORIGIN}/i/${encodeURIComponent(String(invoiceId))}`;
}

// Mistyped versions of the big mailbox providers. A client address with one of
// these domains is almost certainly a typo, and sending to it is a silent loss.
const DOMAIN_TYPOS = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmaill.com': 'gmail.com',
  'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotnail.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com', 'hotmail.co': 'hotmail.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.con': 'yahoo.com',
  'outlok.com': 'outlook.com', 'outllook.com': 'outlook.com', 'outlook.con': 'outlook.com',
  'icloud.con': 'icloud.com', 'iclod.com': 'icloud.com',
};

const ADDRESS_RE = /^[a-z0-9._%+'-]+@([a-z0-9-]+\.)+[a-z]{2,}$/;

/**
 * Validate and normalise a single recipient address.
 * Rejects lists (comma/semicolon/space), malformed addresses, and obvious
 * provider-domain typos. Does not prove the mailbox exists.
 * @returns {{ ok: true, email: string, domain: string } | { ok: false, reason: string }}
 */
export function normalizeRecipient(raw) {
  const email = String(raw ?? '').trim().toLowerCase();
  if (!email) return { ok: false, reason: 'No email address on file' };
  if (email.length > 254 || !ADDRESS_RE.test(email) || email.includes('..')) {
    return { ok: false, reason: 'That email address looks invalid - fix it on the client first' };
  }
  const domain = email.split('@')[1];
  const fix = DOMAIN_TYPOS[domain];
  if (fix) {
    return { ok: false, reason: `Email domain looks mistyped (did you mean ${email.split('@')[0]}@${fix}?)` };
  }
  return { ok: true, email, domain };
}

/**
 * True unless DNS positively says the domain cannot receive mail. Fails OPEN on
 * timeouts/resolver errors so a DNS blip never blocks a real invoice.
 */
export async function domainCanReceiveMail(domain, timeoutMs = 3000) {
  const lookup = (async () => {
    try {
      const mx = await dns.resolveMx(domain);
      return mx.length > 0;
    } catch (err) {
      if (err?.code !== 'ENODATA' && err?.code !== 'ENOTFOUND') throw err;
      // RFC 5321: a domain with no MX falls back to its A/AAAA record.
      try {
        return (await dns.resolve4(domain)).length > 0;
      } catch (err4) {
        if (err4?.code === 'ENODATA' || err4?.code === 'ENOTFOUND') return false;
        throw err4;
      }
    }
  })();
  let timer;
  const timeout = new Promise(resolve => { timer = setTimeout(() => resolve(true), timeoutMs); });
  try {
    return await Promise.race([lookup, timeout]);
  } catch {
    return true;
  } finally {
    // An uncleared timer keeps the serverless function alive for the full timeout.
    clearTimeout(timer);
  }
}

// Display name goes inside a quoted From header: drop quotes, backslashes and
// control characters (header-injection / malformed-header guard).
export function safeDisplayName(name, fallback = 'Supermom for Hire') {
  const cleaned = [...stripControl(name)]
    .filter(ch => ch !== '"' && ch !== '\\')
    .join('')
    .trim();
  return cleaned || fallback;
}

// Drop CR/LF and other control characters (header-injection guard for Subject etc.).
export function stripControl(value) {
  return [...String(value ?? '')].filter(ch => ch.charCodeAt(0) >= 32).join('');
}

export function safeAttachmentName(clientLastName, docLabel, invoiceNumber) {
  const clean = s => String(s ?? '').replace(/[^A-Za-z0-9-]+/g, '');
  const last = clean(clientLastName) || 'Client';
  return `${last}_${docLabel}_${clean(invoiceNumber) || 'document'}.pdf`;
}

// Plain-text alternative. HTML-only mail with a lone attachment is a classic
// spam signature; multipart/alternative with a real text body is not.
export function buildInvoiceEmailText({ clientName, bizName, bizEmail, invoiceNumber, isReceipt, viewUrl }) {
  const docLabel = isReceipt ? 'Receipt' : 'Invoice';
  const biz = bizName || 'Supermom for Hire';
  const lines = [
    `Hi ${clientName || 'there'},`,
    '',
    isReceipt
      ? `Your receipt #${invoiceNumber} from ${biz} is attached as a PDF. Your payment has been received in full - thank you!`
      : `Your invoice #${invoiceNumber} from ${biz} is attached as a PDF.`,
    '',
    `You can also view it online: ${viewUrl}`,
  ];
  if (!isReceipt) {
    lines.push('', `Payment: e-Transfer to ${bizEmail || 'sandra@supermomforhire.com'}`, `Reference: Invoice #${invoiceNumber}`);
  }
  lines.push('', 'Questions? Just reply to this email.', '', `${biz} - Georgetown, ON`);
  return lines.join('\n');
}
