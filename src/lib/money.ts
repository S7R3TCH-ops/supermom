// Single money formatter for per-job amounts: always two decimals, so the same
// job reads the same on every screen (Schedule, Home, cards, Finance lists).
export function fmtMoney(v: unknown): string {
  const n = typeof v === 'number' ? v : parseFloat(v as string);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '—';
}
