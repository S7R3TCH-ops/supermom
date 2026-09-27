import { describe, it, expect, vi } from 'vitest';

// In-memory jobs table with a slow read so two concurrent patches genuinely
// interleave unless patchJobAiContext serializes them.
const db = { 'job-1': { ai_context: { keep: 1 } } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

vi.mock('../lib/supabase', () => {
  const from = () => {
    const state = { update: null, id: null };
    const b = {
      select: () => b,
      update: patch => { state.update = patch; return b; },
      eq: (col, val) => {
        if (col === 'id') state.id = val;
        if (state.update && col === 'business_id') {
          return sleep(1).then(() => {
            db[state.id] = { ...db[state.id], ...state.update };
            return { error: null };
          });
        }
        return b;
      },
      single: async () => {
        const snapshot = structuredClone(db[state.id]);
        await sleep(20);
        return { data: snapshot, error: null };
      },
    };
    return b;
  };
  return { supabase: { from }, authHeaders: async () => ({}) };
});
vi.mock('./currentBusiness', () => ({ getCurrentBusinessId: async () => 'biz-1' }));
vi.mock('../lib/errorTracking', () => ({ logClientError: () => {} }));

const { patchJobAiContext } = await import('./jobsRepo');

describe('patchJobAiContext', () => {
  it('concurrent patches to the same job both survive', async () => {
    await Promise.all([
      patchJobAiContext('job-1', { drive_to: { durationValue: 600 } }),
      patchJobAiContext('job-1', { drive_to_live: { durationValue: 900 } }),
    ]);
    expect(db['job-1'].ai_context).toEqual({
      keep: 1,
      drive_to: { durationValue: 600 },
      drive_to_live: { durationValue: 900 },
    });
  });

  it('a failed patch does not block the next one', async () => {
    const failing = patchJobAiContext('job-missing', { x: 1 }); // db row undefined → merge still works
    await failing.catch(() => {});
    await patchJobAiContext('job-1', { later: true });
    expect(db['job-1'].ai_context.later).toBe(true);
  });
});
