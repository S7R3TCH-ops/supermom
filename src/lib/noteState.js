// Job-note visibility v2 — derives whether a job's pre-job note (job_notes) is
// still an open action item or already handled. Pure, takes the raw jobs-row
// shape only (job_notes, job_status, notes_resolved_at) — JobDetailSheet and
// PostJobSheet already hold raw-decorated rows and pass `job` directly; Home's
// hero cards and JobCard hold DisplayJob and pass `job.raw`. No dual-shape
// normalizing here (design doc §3.1).
//
// Status-gated on job_status === 'Scheduled' so Completed/Cancelled jobs never
// render a TO DO pill regardless of notes_resolved_at — this is what keeps the
// migration a bare nullable ADD COLUMN with no backfill.

export function isNoteOpen(job) {
  return !!job?.job_notes?.trim() && job?.job_status === 'Scheduled' && !job?.notes_resolved_at;
}

export function isNoteDone(job) {
  return !!job?.job_notes?.trim() && job?.job_status === 'Scheduled' && !!job?.notes_resolved_at;
}
