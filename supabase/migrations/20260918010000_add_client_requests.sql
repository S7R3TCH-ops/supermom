-- In-app bug / idea intake from business owners (Sandra). Replaces ad-hoc
-- texts. Rows are exported to second-brain by scripts/export-requests.mjs
-- (pull, service role, stamps exported_at) and Joel is emailed on submit by
-- api/ai/[action].js notify-request (stamps notified_at). Both timestamps
-- NULL past a threshold = the daily briefing cron alerts Joel (see design doc
-- 00-inbox/2026-09-17-supermom-request-pipeline-design.md).
--
-- NOT auto-applied — run this in the Supabase SQL Editor manually. is_admin()
-- / my_business_id() exist live only (no committed migration defines them).

create table if not exists public.client_requests (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id),
  submitted_by  uuid references public.users(id) on delete set null,
  kind          text not null check (kind in ('bug', 'idea')),
  title         text not null check (char_length(title) between 1 and 120),
  body          text not null check (char_length(body) between 1 and 4000),
  -- auto-captured by the sheet: { route, commit, user_agent, theme, standalone,
  -- viewport: {w,h}, app_height, job_id?, client_id? }. Never top-level clientId.
  context       jsonb,
  status        text not null default 'new'
                check (status in ('new', 'triaged', 'planned', 'done', 'declined')),
  admin_notes   text,
  notified_at   timestamptz,          -- set by notify-request after email sent
  exported_at   timestamptz,          -- set by export-requests.mjs after file written
  export_path   text,                 -- repo-relative path of the exported .md
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists client_requests_business_id_idx on public.client_requests (business_id);
create index if not exists client_requests_created_at_idx  on public.client_requests (created_at desc);
-- partial: the export script and the cron backstop both scan exactly this set
create index if not exists client_requests_unexported_idx  on public.client_requests (created_at)
  where exported_at is null or notified_at is null;

alter table public.client_requests enable row level security;

-- Owners/workers submit for their own business only. business_id is NOT
-- nullable here (unlike error_logs) — a request with no business is meaningless.
-- is_admin() branch matters: Joel's super-admin row has business_id NULL, so
-- my_business_id() is NULL for him and a plain equality check would reject his
-- own submissions (including while "viewing as" Sandra). Client-side
-- getCurrentBusinessId() already supplies the viewpoint business for admins.
create policy client_requests_insert on public.client_requests
  for insert to authenticated
  with check ((is_admin() or business_id = my_business_id()) and submitted_by = auth.uid());

-- Admin sees all; a business sees its own (v1.1 "my requests" list uses this).
create policy client_requests_select on public.client_requests
  for select to authenticated
  using (is_admin() or business_id = my_business_id());

-- Only admin (Joel) can change status/notes from the client. Service-role
-- writes (notify-request, export script) bypass RLS. No delete policy —
-- 'declined' is the soft-removal state; no deleted_at needed in v1.
create policy client_requests_update on public.client_requests
  for update to authenticated
  using (is_admin()) with check (is_admin());
