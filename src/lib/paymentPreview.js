import { allocatePayment } from './paymentWaterfall';

const DEFAULT_ROUND_WINDOW_MS = 10_000;

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Formats a date string ('2026-09-23' or ISO timestamp) as 'Mmm D' (e.g. 'Sep 23').
 * If the string is already a formatted label (e.g. 'Tue Sep 23'), returns it directly.
 */
export function formatPreviewDate(val, { withWeekday = false } = {}) {
  if (!val) return '';
  if (typeof val === 'string' && !/^\d{4}-\d{2}-\d{2}/.test(val)) {
    return val;
  }
  const dateObj = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)
    ? (() => {
        const [y, m, d] = val.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      })()
    : new Date(val);

  if (Number.isNaN(dateObj.getTime())) return String(val);

  const m = SHORT_MONTHS[dateObj.getUTCMonth()];
  const d = dateObj.getUTCDate();
  if (withWeekday) {
    const w = SHORT_DAYS[dateObj.getUTCDay()];
    return `${w} ${m} ${d}`;
  }
  return `${m} ${d}`;
}

/**
 * Builds live preview of how a payment amount will allocate across target jobs.
 *
 * @param {Array<{jobId?: string, id?: string, owing: number, date?: string, scheduled_date?: string}>} targets
 * @param {number|string|null} amount
 * @returns {{ summary: string|null, lines: string[] }}
 */
export function buildPaymentPreview(targets, amount = null) {
  if (!targets || targets.length === 0) {
    return { summary: null, lines: [] };
  }

  const normalizedTargets = targets.map(t => ({
    jobId: t.jobId || t.id,
    owing: Number(t.owing) || 0,
    date: t.date || t.scheduled_date || '',
  }));

  const totalOwing = Math.round(
    normalizedTargets.filter(t => t.owing > 0.001).reduce((s, t) => s + t.owing * 100, 0)
  ) / 100;

  const isBlank = amount === null || amount === undefined || (typeof amount === 'string' && amount.trim() === '');
  const numAmount = isBlank ? null : Number(amount);
  const isFullPay = isBlank || (Number.isFinite(numAmount) && Math.round(numAmount * 100) >= Math.round(totalOwing * 100));

  const summary = isFullPay
    ? targets.length === 1
      ? `Pays in full ($${totalOwing.toFixed(2)}).`
      : `Pays all ${targets.length} jobs in full ($${totalOwing.toFixed(2)}).`
    : null;

  const allocations = allocatePayment(normalizedTargets, isBlank ? null : numAmount);
  const targetMap = new Map(normalizedTargets.map(t => [t.jobId, t]));

  const lines = allocations.map(a => {
    const t = targetMap.get(a.jobId);
    const dateStr = formatPreviewDate(t?.date);
    const prefix = dateStr ? `${dateStr} — ` : '';
    if (a.paidInFull) {
      return `✓ ${prefix}paid in full ($${a.amount.toFixed(2)})`;
    }
    const stillOwes = Math.max(0, Math.round((a.owing - a.amount) * 100) / 100);
    return `◐ ${prefix}$${a.amount.toFixed(2)} of $${a.owing.toFixed(2)} (still owes $${stillOwes.toFixed(2)})`;
  });

  return { summary, lines };
}

/**
 * Builds persistent receipt breakdown shown after recording a payment.
 *
 * @param {Array<{jobId: string, amount: number, owing: number, paidInFull: boolean}>} allocations
 * @param {number|null} totalAmount
 * @param {Array<{jobId?: string, id?: string, date?: string, scheduled_date?: string}>} targets
 * @returns {{ title: string, lines: string[] }}
 */
export function buildPaymentReceipt(allocations, totalAmount, targets = []) {
  const targetMap = new Map((targets || []).map(t => [t.jobId || t.id, t]));
  const lines = (allocations || []).map(a => {
    const t = targetMap.get(a.jobId);
    const dateStr = formatPreviewDate(t?.date || t?.scheduled_date || a.date);
    const prefix = dateStr ? `${dateStr} — ` : '';
    if (a.paidInFull) {
      return `✓ ${prefix}paid in full ($${a.amount.toFixed(2)})`;
    }
    const stillOwes = Math.max(0, Math.round((a.owing - a.amount) * 100) / 100);
    return `◐ ${prefix}$${a.amount.toFixed(2)} of $${a.owing.toFixed(2)} (still owes $${stillOwes.toFixed(2)})`;
  });

  const total = totalAmount != null
    ? Number(totalAmount)
    : (allocations || []).reduce((s, a) => s + (Number(a.amount) || 0), 0);

  return {
    title: 'Payment recorded: $' + (Number.isFinite(total) ? total : 0).toFixed(2),
    lines,
  };
}

/**
 * Finds and aggregates the most recent round of payments for an invoice.
 * Payments in the same round share a created_at timestamp within windowMs of the newest.
 *
 * @param {Array<{invoice_id: string, created_at: string, amount: number|string, payment_date?: string, is_void?: boolean}>} payments
 * @param {string} invoiceId
 * @param {number} [windowMs=LAST_ROUND_WINDOW_MS]
 * @returns {{ amount: number, dateStr: string, count: number } | null}
 */
export function getLastPaymentRound(payments, invoiceId, windowMs = DEFAULT_ROUND_WINDOW_MS) {
  if (!Array.isArray(payments) || payments.length === 0 || !invoiceId) {
    return null;
  }
  const matching = payments.filter(
    p => p && p.invoice_id === invoiceId && p.created_at && !p.is_void
  );
  if (matching.length === 0) return null;

  const ts = p => new Date(p.created_at).getTime();
  const valid = matching.filter(p => !Number.isNaN(ts(p)));
  if (valid.length === 0) return null;

  const latestTs = Math.max(...valid.map(ts));
  const roundPayments = valid.filter(p => latestTs - ts(p) <= windowMs);
  if (roundPayments.length === 0) return null;

  const amount = Math.round(roundPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100;
  const newestPayment = roundPayments.reduce((latest, p) => ts(p) > ts(latest) ? p : latest, roundPayments[0]);
  const dateStr = formatPreviewDate(newestPayment.payment_date || newestPayment.created_at);

  return { amount, dateStr, count: roundPayments.length };
}
