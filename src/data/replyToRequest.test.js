import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'owner-user-123' } } })),
      },
      from: () => ({
        insert: (data) => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'msg-1', ...data }, error: null }),
          }),
        }),
      }),
    },
    authHeaders: vi.fn(async () => ({ Authorization: 'Bearer test-token' })),
  };
});

vi.mock('../lib/errorTracking', () => ({
  logClientError: vi.fn(),
}));

vi.mock('./currentBusiness', () => ({
  getCurrentBusinessId: vi.fn(async () => 'biz-123'),
}));

const { replyToRequest } = await import('./requestsRepo');

describe('replyToRequest reopen notification', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
  });

  it('fires /api/ai/notify-request-reopened after inserting the owner reply', async () => {
    await replyToRequest('req-1', 'biz-123', 'Still seeing this on my end');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('/api/ai/notify-request-reopened');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({
      requestId: 'req-1',
      replyBody: 'Still seeing this on my end',
    });
  });

  it('does not insert or notify for a blank reply', async () => {
    const result = await replyToRequest('req-1', 'biz-123', '   ');
    expect(result).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
