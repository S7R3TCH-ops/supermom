import { describe, it, expect } from 'vitest';
import { groupErrors, formatErrorLastSeen } from './errorGrouping';

describe('groupErrors', () => {
  it('collapses identical source + message into a single group with combined count and ids', () => {
    const rows = [
      {
        id: 'err-1',
        source: 'gemini',
        message: '429 Resource has been exhausted',
        severity: 'warning',
        created_at: '2026-09-29T10:00:00Z',
      },
      {
        id: 'err-2',
        source: 'gemini',
        message: '429 Resource has been exhausted',
        severity: 'error',
        created_at: '2026-09-29T11:00:00Z',
      },
      {
        id: 'err-3',
        source: 'gemini',
        message: '429 Resource has been exhausted',
        severity: 'error',
        created_at: '2026-09-29T10:30:00Z',
      },
    ];

    const groups = groupErrors(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].source).toBe('gemini');
    expect(groups[0].message).toBe('429 Resource has been exhausted');
    expect(groups[0].count).toBe(3);
    expect(groups[0].ids).toEqual(['err-1', 'err-2', 'err-3']);
    expect(groups[0].latestCreatedAt).toBe('2026-09-29T11:00:00Z');
    expect(groups[0].newestId).toBe('err-2');
  });

  it('does NOT collapse errors with different sources even if messages match', () => {
    const rows = [
      {
        id: 'err-1',
        source: 'gemini',
        message: 'Rate limit exceeded',
        created_at: '2026-09-29T10:00:00Z',
      },
      {
        id: 'err-2',
        source: 'supabase',
        message: 'Rate limit exceeded',
        created_at: '2026-09-29T11:00:00Z',
      },
    ];

    const groups = groupErrors(rows);
    expect(groups).toHaveLength(2);
    expect(groups.map(g => g.source)).toContain('gemini');
    expect(groups.map(g => g.source)).toContain('supabase');
  });

  it('does NOT collapse errors with different messages even if sources match', () => {
    const rows = [
      {
        id: 'err-1',
        source: 'api',
        message: 'Invoice not found',
        created_at: '2026-09-29T10:00:00Z',
      },
      {
        id: 'err-2',
        source: 'api',
        message: 'Client not found',
        created_at: '2026-09-29T11:00:00Z',
      },
    ];

    const groups = groupErrors(rows);
    expect(groups).toHaveLength(2);
  });

  it('sorts groups by latest timestamp descending (newest first)', () => {
    const rows = [
      {
        id: 'err-old',
        source: 'auth',
        message: 'Invalid credentials',
        created_at: '2026-09-28T09:00:00Z',
      },
      {
        id: 'err-new',
        source: 'push',
        message: 'Subscription expired',
        created_at: '2026-09-29T15:00:00Z',
      },
    ];

    const groups = groupErrors(rows);
    expect(groups).toHaveLength(2);
    expect(groups[0].source).toBe('push');
    expect(groups[1].source).toBe('auth');
  });

  it('handles empty or malformed input without error', () => {
    expect(groupErrors([])).toEqual([]);
    expect(groupErrors(null)).toEqual([]);
    expect(groupErrors([null, undefined, {}])).toHaveLength(1);
  });
});

describe('formatErrorLastSeen', () => {
  it('formats valid ISO date into short string', () => {
    const formatted = formatErrorLastSeen('2026-09-29T14:35:00Z');
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe('string');
  });

  it('handles empty input gracefully', () => {
    expect(formatErrorLastSeen('')).toBe('');
    expect(formatErrorLastSeen(null)).toBe('');
  });
});
