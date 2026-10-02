import { describe, it, expect } from 'vitest';
import { routeNeedsUpdate, groupUpcomingByDay } from './routeChain';

const HOME = '1 Test St, Georgetown, ON';
const leg1 = { from_job_id: null, from_home: HOME };

describe('routeNeedsUpdate', () => {
  it('missing leg needs update', () => {
    expect(routeNeedsUpdate([{ id: 'a', ai_context: {} }], HOME)).toBe(true);
  });
  it('fresh chain does not', () => {
    const jobs = [
      { id: 'a', ai_context: { drive_to: leg1 } },
      { id: 'b', ai_context: { drive_to: { from_job_id: 'a' } } },
    ];
    expect(routeNeedsUpdate(jobs, HOME)).toBe(false);
  });
  it('home address changed -> leg 1 stale', () => {
    expect(routeNeedsUpdate([{ id: 'a', ai_context: { drive_to: { from_job_id: null, from_home: 'Georgetown, ON, Canada' } } }], HOME)).toBe(true);
  });
  it('previous job changed -> later leg stale', () => {
    const jobs = [
      { id: 'a', ai_context: { drive_to: leg1 } },
      { id: 'b', ai_context: { drive_to: { from_job_id: 'zzz' } } },
    ];
    expect(routeNeedsUpdate(jobs, HOME)).toBe(true);
  });
  it('no-route marker (false) is not stale', () => {
    expect(routeNeedsUpdate([{ id: 'a', ai_context: { drive_to: false } }], HOME)).toBe(false);
  });
});

describe('groupUpcomingByDay', () => {
  const mk = (id, date, hour, status = 'Scheduled') => ({
    id, status, raw: { scheduled_date: date }, start: new Date(`${date}T${hour}:00:00Z`),
  });
  it('skips today and the past, groups by day, sorts by start, caps at maxDays', () => {
    const jobs = [
      mk('today', '2026-10-02', '15'),
      mk('past', '2026-10-01', '15'),
      mk('d2b', '2026-10-04', '18'),
      mk('d2a', '2026-10-04', '14'),
      mk('d1', '2026-10-03', '14'),
      mk('far', '2026-10-20', '14'),
      mk('done', '2026-10-05', '14', 'Completed'),
    ];
    const out = groupUpcomingByDay(jobs, '2026-10-02', 7);
    expect(out.map(d => d.date)).toEqual(['2026-10-03', '2026-10-04']);
    expect(out[1].jobs.map(j => j.id)).toEqual(['d2a', 'd2b']);
  });
});
