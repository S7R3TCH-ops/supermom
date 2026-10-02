// Plain-JS mirror of src/lib/phone.ts for the JS serverless handlers (a JS handler
// importing the TS chain is unproven on Vercel, see api/_lib/jobMoney.js). Keep in
// sync: src/lib/phone.test.js pins the two together.

export function phoneDigits(input) {
  const d = String(input ?? '').replace(/\D/g, '');
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
}

export function normalizePhone(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  const d = phoneDigits(raw);
  if (d.length === 10) return `+1${d}`;
  const all = raw.replace(/\D/g, '');
  if (raw.startsWith('+') && all.length >= 8 && all.length <= 15) return `+${all}`;
  return raw;
}

export function formatPhone(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  const d = phoneDigits(raw);
  if (d.length !== 10 || (raw.startsWith('+') && !raw.startsWith('+1'))) return raw;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
