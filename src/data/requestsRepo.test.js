import { describe, it, expect, vi, beforeEach } from 'vitest';

let dbInserts = [];
let dbUpdates = [];

vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'admin-user-123' } } })),
      },
      from: (table) => {
        return {
          insert: (data) => {
            dbInserts.push({ table, data });
            return Promise.resolve({ data, error: null });
          },
          update: (patch) => {
            return {
              eq: (col, val) => {
                dbUpdates.push({ table, patch, col, val });
                return Promise.resolve({ error: null });
              },
            };
          },
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      },
    },
    authHeaders: vi.fn(async () => ({ Authorization: 'Bearer test-token' })),
  };
});

vi.mock('./currentBusiness', () => ({
  getCurrentBusinessId: vi.fn(async () => 'biz-123'),
}));

vi.mock('../lib/errorTracking', () => ({
  logClientError: vi.fn(),
}));

const { saveRequestAdmin } = await import('./requestsRepo');

describe('saveRequestAdmin notify dispatching', () => {
  beforeEach(() => {
    dbInserts = [];
    dbUpdates = [];
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
  });

  it('calls /api/ai/notify-request-done when status becomes done from new (with replyBody)', async () => {
    await saveRequestAdmin('req-1', 'biz-123', {
      status: 'done',
      oldStatus: 'new',
      replyBody: 'Fixed in latest release',
    });

    // Check message inserted
    expect(dbInserts).toHaveLength(1);
    expect(dbInserts[0]).toEqual({
      table: 'request_messages',
      data: {
        request_id: 'req-1',
        business_id: 'biz-123',
        author_role: 'admin',
        author_id: 'admin-user-123',
        body: 'Fixed in latest release',
      },
    });

    // Check request status updated
    expect(dbUpdates).toHaveLength(1);
    expect(dbUpdates[0].table).toBe('client_requests');
    expect(dbUpdates[0].patch.status).toBe('done');
    expect(dbUpdates[0].val).toBe('req-1');

    // Check fetch called with notify-request-done
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('/api/ai/notify-request-done');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({
      requestId: 'req-1',
      replyBody: 'Fixed in latest release',
    });
  });

  it('calls /api/ai/notify-request-done when status becomes done from new without replyBody', async () => {
    await saveRequestAdmin('req-1', 'biz-123', {
      status: 'done',
      oldStatus: 'new',
      replyBody: '',
    });

    expect(dbInserts).toHaveLength(0);
    expect(dbUpdates).toHaveLength(1);
    expect(dbUpdates[0].patch.status).toBe('done');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('/api/ai/notify-request-done');
    expect(JSON.parse(opts.body)).toEqual({
      requestId: 'req-1',
      replyBody: null,
    });
  });

  it('calls /api/ai/notify-request-reply and bumps updated_at when status stays done (or triaged) and replyBody provided', async () => {
    await saveRequestAdmin('req-2', 'biz-123', {
      status: 'done',
      oldStatus: 'done',
      replyBody: 'Follow up on the fix',
    });

    // Message inserted
    expect(dbInserts).toHaveLength(1);
    expect(dbInserts[0].data.body).toBe('Follow up on the fix');

    // Bumps updated_at on client_requests even though status did not change
    expect(dbUpdates).toHaveLength(1);
    expect(dbUpdates[0].table).toBe('client_requests');
    expect(dbUpdates[0].patch.updated_at).toBeDefined();
    expect(dbUpdates[0].patch.status).toBeUndefined();
    expect(dbUpdates[0].val).toBe('req-2');

    // Notification dispatched to notify-request-reply
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('/api/ai/notify-request-reply');
    expect(JSON.parse(opts.body)).toEqual({
      requestId: 'req-2',
      replyBody: 'Follow up on the fix',
    });
  });

  it('calls neither endpoint when status changes from new to triaged with no replyBody', async () => {
    await saveRequestAdmin('req-3', 'biz-123', {
      status: 'triaged',
      oldStatus: 'new',
      replyBody: '',
    });

    expect(dbInserts).toHaveLength(0);
    expect(dbUpdates).toHaveLength(1);
    expect(dbUpdates[0].patch.status).toBe('triaged');

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
