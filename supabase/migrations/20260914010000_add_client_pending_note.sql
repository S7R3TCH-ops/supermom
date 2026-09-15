-- Client note carry-forward: lets Sandra flag a completion note at job
-- wrap-up to carry forward to the client's NEXT booked job instead of it
-- dying with the completed job. Single in-flight value per client, not a
-- ledger — a second carried note before the first is consumed replaces it.
-- pending_note_source_job_id is informational only (which job it came from),
-- not used in any logic branch. No RLS policy needed: `clients` already has
-- RLS enabled and its existing policies are row-level, so they already cover
-- these new columns. See docs/superpowers/specs/2026-09-14-note-carry-forward-design.md.

ALTER TABLE public.clients ADD COLUMN pending_note text;
ALTER TABLE public.clients ADD COLUMN pending_note_source_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL;
