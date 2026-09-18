// Toronto-timezone helpers for server-side (api/) code. This project's clock
// rule is "America/Toronto everywhere, always" (CLAUDE.md) — never system tz.
//
// torontoDateStr mirrors the inline copy already living in api/briefing/daily.js
// (not refactored to import from here in this change — out of scope for the
// lockscreen-push build; the approved SMS-reminders design (2026-09-17,
// second-brain/99-archive/) already plans that consolidation when it's built).
//
// torontoToUtc composes a date+time pair into a real UTC-aware Date, reusing
// src/lib/dateUtils.js's composeTorontoISO (DST-safe via Intl, no hardcoded
// offsets) — api/ files already import directly from src/lib (see
// api/invoice.ts → src/lib/invoiceBalances.js, api/_lib/invoicePdf.ts →
// src/lib/financialMath.js), so this is the same established precedent.

import { composeTorontoISO } from '../../src/lib/dateUtils.js';

/** 'YYYY-MM-DD' for today in Toronto, or `offsetDays` away from today. */
export function torontoDateStr(offsetDays = 0) {
  const base = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  if (offsetDays === 0) return base;
  const d = new Date(base + 'T12:00:00');
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Composes a Toronto-local date ('YYYY-MM-DD') + time ('HH:MM' or 'HH:MM:SS')
 * into a real UTC-aware Date object. Returns null if dateStr is falsy or
 * unparseable — callers must handle that (e.g. a job with no scheduled_time).
 */
export function torontoToUtc(dateStr, timeStr) {
  const iso = composeTorontoISO(dateStr, timeStr);
  return iso ? new Date(iso) : null;
}
