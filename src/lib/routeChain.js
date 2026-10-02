// Pure helpers for the static (home-based) drive chain. No React, no network.

/**
 * True when any Scheduled job's stored `ai_context.drive_to` leg is missing or
 * was measured from a different origin than the chain would use now.
 * `homeAddress` is the address the chain starts from (already defaulted by caller).
 * Legs written before `from_job_id` existed recompute once.
 */
export function routeNeedsUpdate(scheduledJobs, homeAddress) {
  return scheduledJobs.some((j, i) => {
    const driveTo = j.ai_context?.drive_to;
    if (driveTo === undefined) return true;
    if (driveTo && typeof driveTo === 'object') {
      if (i === 0) return driveTo.from_job_id !== null || driveTo.from_home !== homeAddress;
      return driveTo.from_job_id !== scheduledJobs[i - 1].id;
    }
    return false;
  });
}

/**
 * Scheduled jobs after `todayKey` (YYYY-MM-DD) within the next `maxDays` days,
 * grouped per day and sorted by start. Today is excluded on purpose: today's
 * chain is handled separately and layered with live GPS.
 */
export function groupUpcomingByDay(jobs, todayKey, maxDays = 7) {
  const todayMs = Date.parse(`${todayKey}T00:00:00Z`);
  const byDate = new Map();
  for (const j of jobs || []) {
    const date = j?.raw?.scheduled_date;
    if (!date || j.status !== 'Scheduled' || !j.start) continue;
    const diffDays = Math.round((Date.parse(`${date}T00:00:00Z`) - todayMs) / 86400000);
    if (!(diffDays >= 1 && diffDays <= maxDays)) continue;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(j);
  }
  return [...byDate.keys()].sort().map(date => ({
    date,
    jobs: byDate.get(date).sort((a, b) => a.start - b.start),
  }));
}
