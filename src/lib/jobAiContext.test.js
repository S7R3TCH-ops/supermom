import { describe, it, expect } from 'vitest';
import {
  SYSTEM_AI_CONTEXT_KEYS,
  PER_JOB_AI_CONTEXT_KEYS,
  omitKeys,
  mergeAiContextForJobSave,
} from './jobAiContext';

describe('mergeAiContextForJobSave', () => {
  const fresh = {
    gcal_event_id: 'evFresh',
    gcal_sync_status: 'synced',
    gcal_last_sync: '2026-10-12T00:00:00Z',
    template_id: 't1',
    occurrence_index: 3,
    drive_to: { duration: '8 mins' },
  };

  it('keeps the current gcal_event_id when the snapshot is stale or missing it', () => {
    expect(mergeAiContextForJobSave(fresh, { payment_method: 'Cash' }).gcal_event_id).toBe('evFresh');
    expect(mergeAiContextForJobSave(fresh, { gcal_event_id: 'evStale' }).gcal_event_id).toBe('evFresh');
  });

  it('keeps every system key from the fresh row', () => {
    const merged = mergeAiContextForJobSave(fresh, { template_id: 'other', occurrence_index: 99 });
    for (const k of SYSTEM_AI_CONTEXT_KEYS) expect(merged[k]).toBe(fresh[k]);
  });

  it('lets the caller own everything else, including deleting a key by omission', () => {
    const merged = mergeAiContextForJobSave(fresh, { payment_method: 'Cash', recurrence_rule: 'Weekly' });
    expect(merged.payment_method).toBe('Cash');
    expect(merged.recurrence_rule).toBe('Weekly');
    expect('drive_to' in merged).toBe(false); // omitted => cleared (reschedule behaviour)
  });

  it('does not invent system keys the fresh row never had', () => {
    expect('gcal_event_id' in mergeAiContextForJobSave({}, { gcal_event_id: 'x' })).toBe(false);
    expect(mergeAiContextForJobSave(null, { a: 1 })).toEqual({ a: 1 });
  });
});

describe('omitKeys / PER_JOB_AI_CONTEXT_KEYS', () => {
  it('strips per-visit keys but leaves business fields', () => {
    const out = omitKeys(
      { gcal_event_id: 'e', drive_to: {}, drive_to_live: {}, clock_in_time: 1, payment_method: 'Cash' },
      PER_JOB_AI_CONTEXT_KEYS,
    );
    expect(out).toEqual({ payment_method: 'Cash' });
  });
  it('tolerates null', () => {
    expect(omitKeys(null, ['a'])).toEqual({});
  });
});
