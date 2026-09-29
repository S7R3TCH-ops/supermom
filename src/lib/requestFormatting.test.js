import { describe, it, expect } from 'vitest';
import {
  deriveTitle,
  isActiveRequest,
  isFinishedRequest,
  isFinishedWithinCutoff,
  isRequestVisibleInAdmin,
  sortNeedsAttentionRequests,
  getAdminStatusPill,
  ADMIN_STATUS_PILLS,
  FINISHED_AUTO_HIDE_MS,
} from './requestFormatting';

describe('deriveTitle', () => {
  it('uses the first line when the body has multiple lines', () => {
    expect(deriveTitle('Invoice total looks wrong\nafter a partial payment')).toBe('Invoice total looks wrong');
  });

  it('uses the whole body when it is a single short line', () => {
    expect(deriveTitle('Add dark mode to the invoice PDF')).toBe('Add dark mode to the invoice PDF');
  });

  it('truncates a long single-line body to 80 chars with an ellipsis', () => {
    const long = 'a'.repeat(120);
    const title = deriveTitle(long);
    expect(title.length).toBe(80);
    expect(title.endsWith('…')).toBe(true);
  });

  it('falls back to "Untitled" for empty input', () => {
    expect(deriveTitle('')).toBe('Untitled');
    expect(deriveTitle('   ')).toBe('Untitled');
  });

  it('trims surrounding whitespace', () => {
    expect(deriveTitle('  Something broke  \n\nmore detail')).toBe('Something broke');
  });
});

describe('active vs finished request categorization', () => {
  it('categorizes new, triaged, and planned as active', () => {
    expect(isActiveRequest('new')).toBe(true);
    expect(isActiveRequest('triaged')).toBe(true);
    expect(isActiveRequest('planned')).toBe(true);
    expect(isActiveRequest('done')).toBe(false);
    expect(isActiveRequest('declined')).toBe(false);

    expect(isActiveRequest({ status: 'new' })).toBe(true);
    expect(isActiveRequest({ status: 'done' })).toBe(false);
  });

  it('categorizes done and declined as finished', () => {
    expect(isFinishedRequest('done')).toBe(true);
    expect(isFinishedRequest('declined')).toBe(true);
    expect(isFinishedRequest('new')).toBe(false);
    expect(isFinishedRequest('triaged')).toBe(false);

    expect(isFinishedRequest({ status: 'done' })).toBe(true);
    expect(isFinishedRequest({ status: 'declined' })).toBe(true);
    expect(isFinishedRequest({ status: 'planned' })).toBe(false);
  });
});

describe('72h cutoff filter boundary', () => {
  const baseNow = new Date('2026-09-29T12:00:00.000Z');

  it('shows finished request updated 71h 59m ago (within 72h window)', () => {
    const updatedMs = baseNow.getTime() - (71 * 60 + 59) * 60 * 1000;
    const req = { status: 'done', updated_at: new Date(updatedMs).toISOString() };

    expect(isFinishedWithinCutoff(req, baseNow)).toBe(true);
    expect(isRequestVisibleInAdmin(req, baseNow)).toBe(true);
  });

  it('hides finished request updated 72h 01m ago (older than 72h window)', () => {
    const updatedMs = baseNow.getTime() - (72 * 60 + 1) * 60 * 1000;
    const req = { status: 'done', updated_at: new Date(updatedMs).toISOString() };

    expect(isFinishedWithinCutoff(req, baseNow)).toBe(false);
    expect(isRequestVisibleInAdmin(req, baseNow)).toBe(false);
  });

  it('keeps a done request visible if updated_at was bumped by an admin reply', () => {
    // Created 10 days ago, closed 5 days ago, but admin replied 10 minutes ago
    const req = {
      status: 'done',
      created_at: new Date(baseNow.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date(baseNow.getTime() - 10 * 60 * 1000).toISOString(),
    };

    expect(isFinishedWithinCutoff(req, baseNow)).toBe(true);
    expect(isRequestVisibleInAdmin(req, baseNow)).toBe(true);
  });

  it('keeps a reopened request (triaged) Active regardless of age', () => {
    // Reopened request with old updated_at (e.g. 1 year ago) is still Active
    const req = {
      status: 'triaged',
      created_at: new Date(baseNow.getTime() - 365 * 24 * 3600 * 1000).toISOString(),
      updated_at: new Date(baseNow.getTime() - 365 * 24 * 3600 * 1000).toISOString(),
    };

    expect(isActiveRequest(req)).toBe(true);
    expect(isRequestVisibleInAdmin(req, baseNow)).toBe(true);
  });
});

describe('sortNeedsAttentionRequests', () => {
  it('sorts new first, then triaged, then planned, then oldest-first within status', () => {
    const reqs = [
      { id: 'p2', status: 'planned', created_at: '2026-09-25T10:00:00Z' },
      { id: 't2', status: 'triaged', created_at: '2026-09-26T12:00:00Z' },
      { id: 'n2', status: 'new', created_at: '2026-09-28T14:00:00Z' },
      { id: 'n1', status: 'new', created_at: '2026-09-27T08:00:00Z' }, // older new
      { id: 't1', status: 'triaged', created_at: '2026-09-24T09:00:00Z' }, // older triaged
      { id: 'p1', status: 'planned', created_at: '2026-09-20T11:00:00Z' }, // older planned
    ];

    const sorted = sortNeedsAttentionRequests(reqs);
    expect(sorted.map(r => r.id)).toEqual(['n1', 'n2', 't1', 't2', 'p1', 'p2']);
  });
});

describe('getAdminStatusPill', () => {
  it('maps each status to the designated pill label and styling', () => {
    expect(getAdminStatusPill('new').label).toBe('New');
    expect(getAdminStatusPill('triaged').label).toBe('Triaged');
    expect(getAdminStatusPill('planned').label).toBe('Planned');
    expect(getAdminStatusPill('done').label).toBe('✓ Done');
    expect(getAdminStatusPill('declined').label).toBe('Declined');
  });

  it('provides fallback for unknown status', () => {
    const fallback = getAdminStatusPill('custom_status');
    expect(fallback.label).toBe('custom_status');
    expect(fallback.bg).toBeDefined();
  });
});
