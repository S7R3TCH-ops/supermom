import { describe, it, expect, vi } from 'vitest';

vi.mock('./currentBusiness', () => ({ getCurrentBusinessId: async () => 'biz-1' }));
vi.mock('../lib/supabase', () => ({ supabase: { from: () => {} }, authHeaders: async () => ({}) }));

import { computeInvoiceDueDate } from './invoicesRepo';


describe('computeInvoiceDueDate', () => {
  it('sets due date to match the invoice date (job scheduled date)', () => {
    expect(computeInvoiceDueDate('2026-07-10')).toBe('2026-07-10');
    expect(computeInvoiceDueDate('2026-01-01')).toBe('2026-01-01');
    expect(computeInvoiceDueDate('2026-12-31')).toBe('2026-12-31');
  });

  it('preserves ISO date string without modifying day or timezone offset', () => {
    const scheduledDate = '2026-09-29';
    expect(computeInvoiceDueDate(scheduledDate)).toBe(scheduledDate);
  });
});
