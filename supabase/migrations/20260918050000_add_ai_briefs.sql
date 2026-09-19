-- Cached AI-generated day/client briefs (v1: 'day' and 'client' kinds). One
-- row per (business_id, kind, subject_id) — content is the parsed JSON the
-- model returned, cached via inputs_hash so an unchanged input never
-- re-triggers generation. 'kind' is deliberately NOT check-constrained: a
-- new kind is a code-only addition (validated in the handler), not a
-- migration.
--
-- NOT auto-applied — run this in the Supabase SQL Editor manually, same as
-- every other migration in this repo. is_admin() / my_business_id() exist
-- live only (no committed migration defines them — see client_requests's
-- migration for the same note).

create table public.ai_briefs (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id),
  kind          text not null,        -- 'day' | 'client' today; validated in the handler, deliberately NO check constraint so a new kind is code-only, not a migration
  subject_id    uuid not null,        -- 'day' -> business_id; 'client' -> clients.id
  subject_date  date,                 -- 'day' -> the Toronto date it describes; null for 'client'
  content       jsonb not null,       -- the parsed JSON the model returned
  inputs_hash   text not null,        -- sha256 of the canonicalised input payload
  model         text not null,
  generated_at  timestamptz not null default now(),
  unique (business_id, kind, subject_id)
);

alter table public.ai_briefs enable row level security;

-- Read scoped like push_log: admin sees all, a business sees its own.
create policy ai_briefs_select on public.ai_briefs for select to authenticated
  using (is_admin() or business_id = my_business_id());
-- No insert/update/delete policy for authenticated: writes are service-role
-- only (the API layer that calls the model and caches the result).
