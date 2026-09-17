-- Job pre-job notes gain an open/done state so Sandra can mark a visit's
-- to-do handled. NULL = open (default, no backfill); rendering is gated on
-- job_status = 'Scheduled' so historical Completed rows never light up.
-- No RLS change: jobs already has row-level policies that cover new columns
-- (same reasoning as 20260914010000_add_client_pending_note.sql).
ALTER TABLE public.jobs ADD COLUMN notes_resolved_at timestamptz;
