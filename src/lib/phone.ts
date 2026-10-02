// Phone numbers: stored as E.164 (+16475550100, what phone contacts use), shown as
// (647) 555-0100. Free-form input is accepted and never blocked.
// api/_lib/phone.js is a plain-JS mirror for the JS serverless handlers; phone.test.js
// pins the two together, so change both.

/** Digits only, with a leading NANP country code `1` dropped from 11-digit numbers. */
export function phoneDigits(input: string | null | undefined): string {
  const d = String(input ?? '').replace(/\D/g, '');
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
}

/**
 * Normalise for storage. 10 digits (or 11 with a leading 1) -> `+1XXXXXXXXXX`.
 * An explicit `+` international number keeps its country code. Anything else is
 * kept as typed (trimmed) so odd entries are never lost or rejected. Empty -> null.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  const d = phoneDigits(raw);
  if (d.length === 10) return `+1${d}`;
  const all = raw.replace(/\D/g, '');
  if (raw.startsWith('+') && all.length >= 8 && all.length <= 15) return `+${all}`;
  return raw;
}

/** `(647) 555-0100` for any North American number, otherwise the value as stored. */
export function formatPhone(input: string | null | undefined): string {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  const d = phoneDigits(raw);
  if (d.length !== 10 || (raw.startsWith('+') && !raw.startsWith('+1'))) return raw;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
