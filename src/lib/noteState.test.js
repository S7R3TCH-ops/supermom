import { describe, it, expect } from 'vitest';
import { isNoteOpen, isNoteDone } from './noteState';

describe('isNoteOpen', () => {
  it('true for a Scheduled job with a note and no resolved timestamp', () => {
    expect(isNoteOpen({ job_notes: 'Bring extra bins', job_status: 'Scheduled', notes_resolved_at: null })).toBe(true);
  });

  it('false once notes_resolved_at is set', () => {
    expect(isNoteOpen({ job_notes: 'Bring extra bins', job_status: 'Scheduled', notes_resolved_at: '2026-09-18T10:00:00Z' })).toBe(false);
  });

  it('false for a Completed job even with notes_resolved_at null (status-gated)', () => {
    expect(isNoteOpen({ job_notes: 'Bring extra bins', job_status: 'Completed', notes_resolved_at: null })).toBe(false);
  });

  it('false for a Cancelled job', () => {
    expect(isNoteOpen({ job_notes: 'Bring extra bins', job_status: 'Cancelled', notes_resolved_at: null })).toBe(false);
  });

  it('false when job_notes is empty', () => {
    expect(isNoteOpen({ job_notes: '', job_status: 'Scheduled', notes_resolved_at: null })).toBe(false);
  });

  it('false when job_notes is whitespace only', () => {
    expect(isNoteOpen({ job_notes: '   ', job_status: 'Scheduled', notes_resolved_at: null })).toBe(false);
  });

  it('false when job_notes is null/undefined', () => {
    expect(isNoteOpen({ job_notes: null, job_status: 'Scheduled', notes_resolved_at: null })).toBe(false);
    expect(isNoteOpen({ job_status: 'Scheduled', notes_resolved_at: null })).toBe(false);
  });

  it('defensive on a null/undefined job', () => {
    expect(isNoteOpen(null)).toBe(false);
    expect(isNoteOpen(undefined)).toBe(false);
  });
});

describe('isNoteDone', () => {
  it('true for a Scheduled job with a note and a resolved timestamp', () => {
    expect(isNoteDone({ job_notes: 'Bring extra bins', job_status: 'Scheduled', notes_resolved_at: '2026-09-18T10:00:00Z' })).toBe(true);
  });

  it('false when still open (no resolved timestamp)', () => {
    expect(isNoteDone({ job_notes: 'Bring extra bins', job_status: 'Scheduled', notes_resolved_at: null })).toBe(false);
  });

  it('false for a Completed job even with notes_resolved_at set (status-gated)', () => {
    expect(isNoteDone({ job_notes: 'Bring extra bins', job_status: 'Completed', notes_resolved_at: '2026-09-18T10:00:00Z' })).toBe(false);
  });

  it('false when job_notes is empty', () => {
    expect(isNoteDone({ job_notes: '', job_status: 'Scheduled', notes_resolved_at: '2026-09-18T10:00:00Z' })).toBe(false);
  });

  it('defensive on a null/undefined job', () => {
    expect(isNoteDone(null)).toBe(false);
    expect(isNoteDone(undefined)).toBe(false);
  });
});
