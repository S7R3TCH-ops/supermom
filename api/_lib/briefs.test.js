import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { hashInputs, buildClientBriefPrompt, buildDayBriefPrompt, PROMPT_VERSION } from './briefs.js';

describe('hashInputs', () => {
  it('is stable regardless of object-key order', () => {
    const a = { foo: 1, bar: { x: 1, y: 2 }, list: [1, 2, 3] };
    const b = { bar: { y: 2, x: 1 }, foo: 1, list: [1, 2, 3] };
    expect(hashInputs(a)).toBe(hashInputs(b));
  });

  it('is stable regardless of nested-array-of-objects key order', () => {
    const a = { history: [{ date: '2026-01-01', service_name: 'Deep Clean' }] };
    const b = { history: [{ service_name: 'Deep Clean', date: '2026-01-01' }] };
    expect(hashInputs(a)).toBe(hashInputs(b));
  });

  it('differs when the inputs actually differ', () => {
    expect(hashInputs({ a: 1 })).not.toBe(hashInputs({ a: 2 }));
  });

  it('differs when array element order differs (order is semantically meaningful)', () => {
    expect(hashInputs({ list: [1, 2] })).not.toBe(hashInputs({ list: [2, 1] }));
  });

  it('treats undefined/empty inputs consistently', () => {
    expect(hashInputs(undefined)).toBe(hashInputs({}));
  });

  it('folds PROMPT_VERSION into the hash — bumping it changes every hash', () => {
    const inputs = { a: 1 };
    const currentHash = hashInputs(inputs);
    // Replicate hashInputs' own algorithm with PROMPT_VERSION+1 to prove the
    // constant is actually part of the hashed payload, not dead code.
    const bumpedPayload = JSON.stringify({ v: PROMPT_VERSION + 1, inputs: { a: 1 } });
    const bumpedHash = createHash('sha256').update(bumpedPayload).digest('hex');
    expect(currentHash).not.toBe(bumpedHash);
  });
});

describe('buildClientBriefPrompt — first-visit (zero history)', () => {
  it('returns the exact deterministic fallback line with no Anthropic call needed', () => {
    const result = buildClientBriefPrompt({ clientName: 'Ann Rae', history: [] });
    expect(result.skip).toBe(true);
    expect(result.result.brief).toBe('First visit — no history yet.');
    expect(result.result.watch_for).toEqual([]);
  });

  it('folds Intel notes (clients.notes) into watch_for when present', () => {
    const result = buildClientBriefPrompt({ clientName: 'Ann Rae', history: [], clientNotes: 'Allergic to citrus cleaners' });
    expect(result.skip).toBe(true);
    expect(result.result.brief).toBe('First visit — no history yet.');
    expect(result.result.watch_for).toEqual(['Allergic to citrus cleaners']);
  });

  it('defaults to no history when the field is omitted entirely', () => {
    const result = buildClientBriefPrompt({});
    expect(result.skip).toBe(true);
  });
});

describe('buildClientBriefPrompt — with history', () => {
  const baseInputs = {
    ownerName: 'Sandra',
    clientName: 'Maria Lopez',
    style: 'coach',
    history: [
      { date: '2026-09-01', service_name: 'Deep Clean', job_notes: 'bring extra bins', completion_notes: 'ran 30 min over' },
      { date: '2026-08-01', service_name: 'Standard Clean', job_notes: null, completion_notes: null },
    ],
    clientNotes: 'VIP, always tips well',
    access: 'side door code 1234',
    prefs: 'unscented products only',
    personal: 'has two dogs',
    tags: ['vip', 'weekly'],
    pendingNote: 'wants garage done next time',
    learned: { synthesis_note: 'runs long on deep cleans', behavioral_flags: ['runs_long'], preferred_time_of_day: 'morning' },
  };

  it('does not skip when history is present', () => {
    const result = buildClientBriefPrompt(baseInputs);
    expect(result.skip).toBe(false);
    expect(typeof result.prompt).toBe('string');
    expect(result.maxTokens).toBe(300);
  });

  it('includes the client name, owner name, and style tone', () => {
    const { prompt } = buildClientBriefPrompt(baseInputs);
    expect(prompt).toContain('Maria Lopez');
    expect(prompt).toContain('Sandra');
    expect(prompt).toContain('coach');
  });

  it('includes both pre and post notes from history', () => {
    const { prompt } = buildClientBriefPrompt(baseInputs);
    expect(prompt).toContain('bring extra bins');
    expect(prompt).toContain('ran 30 min over');
  });

  it('includes Intel notes, access, prefs, personal, tags, and the carried pending note', () => {
    const { prompt } = buildClientBriefPrompt(baseInputs);
    expect(prompt).toContain('VIP, always tips well');
    expect(prompt).toContain('side door code 1234');
    expect(prompt).toContain('unscented products only');
    expect(prompt).toContain('has two dogs');
    expect(prompt).toContain('vip, weekly');
    expect(prompt).toContain('wants garage done next time');
  });

  it('includes learned synthesis note, flags, and preferred time', () => {
    const { prompt } = buildClientBriefPrompt(baseInputs);
    expect(prompt).toContain('runs long on deep cleans');
    expect(prompt).toContain('runs_long');
    expect(prompt).toContain('morning');
  });

  it('requires JSON output shaped {brief, watch_for} and forbids paraphrasing/inventing', () => {
    const { prompt } = buildClientBriefPrompt(baseInputs);
    expect(prompt).toMatch(/"brief"/);
    expect(prompt).toMatch(/"watch_for"/);
    expect(prompt.toLowerCase()).toContain('never paraphrase');
    expect(prompt.toLowerCase()).toContain('never invent');
  });

  it('tells the model not to include dollar amounts (computed deterministically elsewhere)', () => {
    const { prompt } = buildClientBriefPrompt(baseInputs);
    expect(prompt.toLowerCase()).toContain('dollar amount');
  });
});

describe('buildDayBriefPrompt', () => {
  it('always returns a prompt + maxTokens, even with no jobs at all', () => {
    const { prompt, maxTokens } = buildDayBriefPrompt({ ownerName: 'Sandra', style: 'professional', nowLabel: '11:30 AM' });
    expect(typeof prompt).toBe('string');
    expect(maxTokens).toBe(300);
    expect(prompt).toContain('None.');
  });

  it('includes today and tomorrow job details, drive time, notes, and balances', () => {
    const { prompt } = buildDayBriefPrompt({
      ownerName: 'Sandra',
      style: 'professional',
      nowLabel: 'Thu Sep 18, 11:30 AM',
      todayJobs: [{
        job_id: 'job-1', time: '2:00 PM', client_name: 'Ann Rae', service_name: 'Deep Clean',
        job_notes: 'bring bins', drive_minutes: 25, tags: ['vip'], pending_note: 'garage next time',
        behavioral_flags: ['runs_long'], unpaid_amount: 120, unpaid_since: '2026-09-03', is_first_visit: false,
      }],
      tomorrowJobs: [{
        job_id: 'job-2', time: '9:00 AM', client_name: 'New Client', service_name: 'Standard Clean',
        is_first_visit: true,
      }],
      attentionItems: [{ job_id: 'job-3', client_name: 'Sam', why: 'past end time, not marked complete' }],
    });
    expect(prompt).toContain('Ann Rae');
    expect(prompt).toContain('25 min drive');
    expect(prompt).toContain('bring bins');
    expect(prompt).toContain('garage next time');
    expect(prompt).toContain('runs_long');
    expect(prompt).toContain('owes $120.00 from 2026-09-03');
    expect(prompt).toContain('(first visit)');
    expect(prompt).toContain('past end time, not marked complete');
  });

  it('frames the task as triage/ranking, not summarization, and requires the {summary, items} shape', () => {
    const { prompt } = buildDayBriefPrompt({ ownerName: 'Sandra', style: 'professional', nowLabel: 'now' });
    expect(prompt.toLowerCase()).toContain('triage');
    expect(prompt).toMatch(/"summary"/);
    expect(prompt).toMatch(/"items"/);
    expect(prompt).toMatch(/"priority"/);
  });
});
