import { describe, it, expect, vi } from 'vitest';

let rows = [];

// Chainable, thenable query builder: filters apply in JS so the test exercises the
// real fetchClientByContact flow (name query, then phone comparison).
vi.mock('../lib/supabase', () => {
  const builder = () => {
    const filters = [];
    const b = {
      select: () => b,
      eq: (col, val) => { filters.push(r => r[col] === val); return b; },
      is: (col, val) => { filters.push(r => (r[col] ?? null) === val); return b; },
      maybeSingle: async () => ({ data: rows.filter(r => filters.every(f => f(r)))[0] ?? null, error: null }),
      then: (res) => res({ data: rows.filter(r => filters.every(f => f(r))), error: null }),
    };
    return b;
  };
  return { supabase: { from: () => builder() }, authHeaders: vi.fn() };
});
vi.mock('./currentBusiness', () => ({ getCurrentBusinessId: vi.fn(async () => 'biz-1') }));
vi.mock('./ai', () => ({ summarizeCarriedNote: vi.fn() }));

import { fetchClientByContact } from './clientsRepo';

const base = { business_id: 'biz-1', first_name: 'Ann', last_name: 'Rae', deleted_at: null, email: null };

describe('fetchClientByContact phone matching', () => {
  it('matches the same number across stored/typed formats', async () => {
    rows = [{ ...base, id: 'old', phone: '(647) 555-0100' }];
    for (const typed of ['+16475550100', '647-555-0100', '1 647 555 0100', '6475550100']) {
      const hit = await fetchClientByContact({ first_name: 'Ann', last_name: 'Rae', phone: typed });
      expect(hit?.id).toBe('old');
    }
  });
  it('does not match a different number', async () => {
    rows = [{ ...base, id: 'old', phone: '+16475550100' }];
    expect(await fetchClientByContact({ first_name: 'Ann', last_name: 'Rae', phone: '6475550199' })).toBeNull();
  });
  it('no phone given still matches only a phoneless row', async () => {
    rows = [{ ...base, id: 'withPhone', phone: '+16475550100' }];
    expect(await fetchClientByContact({ first_name: 'Ann', last_name: 'Rae', phone: null })).toBeNull();
    rows = [{ ...base, id: 'noPhone', phone: null }];
    expect((await fetchClientByContact({ first_name: 'Ann', last_name: 'Rae', phone: null }))?.id).toBe('noPhone');
  });
});
