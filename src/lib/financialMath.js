// Single source of truth for computing a job's total from raw DB fields.
//
// Field conventions (from CLAUDE.md):
//   flat_rate   = $/hr rate for Hourly jobs (NewJobSheet never writes hourly_rate)
//   total_amount = booking-time estimate; never updated after completion — don't use as actual total
//   actual_duration = completed hours (use over estimated_hours for completed jobs)
//
// For a completed hourly job: flat_rate × actual_duration + additional_cost + hst_amount
export function computeJobTotal(job) {
  const src = job?.raw ?? job;
  let base = 0;

  if (src?.pricing_type === 'Hourly') {
    // flat_rate stores $/hr; hourly_rate is null in practice — keep as fallback
    const rate = Number(src.flat_rate || src.hourly_rate || 0);
    const hours = Number(src.actual_duration || src.estimated_hours || 0);
    base = (rate > 0 && hours > 0) ? rate * hours : Number(src.total_amount || 0);
  } else {
    base = Number(src?.total_amount || src?.flat_rate || 0);
  }

  return base + Number(src?.additional_cost || 0) + Number(src?.hst_amount || 0);
}
