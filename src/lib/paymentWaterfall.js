// Pure helpers for recording one lump payment against several outstanding jobs
// (invoice "Record Payment" panel). Math is done in integer cents so a
// waterfall across many jobs never drifts by a floating-point cent.

const toCents = n => Math.round(Number(n) * 100);

/**
 * Parses the amount Sandra typed. Blank → null (meaning "pay the full selected
 * total"). Anything that isn't a positive number of dollars → NaN.
 * Accepts "$120", "120.5", "1,200.00".
 */
export function parsePaymentAmount(input) {
  const s = String(input ?? '').trim().replace(/[$,\s]/g, '');
  if (s === '') return null;
  if (!/^\d+(\.\d{0,2})?$|^\.\d{1,2}$/.test(s)) return NaN;
  const n = Number(s);
  return n > 0 ? n : NaN;
}

/**
 * Splits a payment across jobs, oldest scheduled_date first, filling each job's
 * owing before moving on. Overpayment is rejected (overpay → client credit only
 * happens via recordPayment on a single job).
 *
 * @param {{jobId: string, owing: number, date?: string}[]} targets - jobs with owing > 0
 * @param {number|null} amount - dollars; null = pay every target in full
 * @returns {{jobId: string, amount: number, owing: number, paidInFull: boolean}[]}
 *   only jobs that receive money, amounts rounded to cents
 */
export function allocatePayment(targets, amount = null) {
  const ordered = [...targets]
    .filter(t => toCents(t.owing) > 0)
    .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
  const totalOwing = ordered.reduce((s, t) => s + toCents(t.owing), 0);

  let remaining;
  if (amount === null || amount === undefined) {
    remaining = totalOwing;
  } else {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be a positive number');
    remaining = toCents(amount);
    if (remaining > totalOwing) {
      throw new Error(`Payment $${(remaining / 100).toFixed(2)} is more than the $${(totalOwing / 100).toFixed(2)} owing`);
    }
  }

  const allocations = [];
  for (const t of ordered) {
    if (remaining <= 0) break;
    const owing = toCents(t.owing);
    const apply = Math.min(owing, remaining);
    remaining -= apply;
    allocations.push({ jobId: t.jobId, amount: apply / 100, owing: owing / 100, paidInFull: apply === owing });
  }
  return allocations;
}
