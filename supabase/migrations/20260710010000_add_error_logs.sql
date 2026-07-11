-- ─────────────────────────────────────────────────────────────────────────────
-- Error tracking: client + server error capture, no new serverless function.
--
-- ⚠️  NOT APPLIED — migrations are not auto-applied to the live DB (CLAUDE.md).
-- ⚠️  Joel must run this manually in the Supabase SQL Editor before the app
--     code that inserts into error_logs is deployed (inserts will just fail
--     silently — logClientError/logServerError both swallow errors — but no
--     data will be captured until this exists).
--
-- Relies on the live is_admin() / my_business_id() SECURITY DEFINER helpers
-- documented in CLAUDE.md's "RLS policy state" section. Those aren't in any
-- committed migration yet (pending: "export live RLS state to a committed
-- migration") — this migration assumes they already exist live.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  source text not null check (source in ('client', 'server')),
  severity text not null default 'error' check (severity in ('warning', 'error', 'critical')),
  message text not null,
  stack text,
  context jsonb,
  created_at timestamptz not null default now()
);

create index if not exists error_logs_business_id_idx on public.error_logs (business_id);
create index if not exists error_logs_created_at_idx on public.error_logs (created_at desc);

alter table public.error_logs enable row level security;

-- Authenticated app users can log an error for their own business (or no
-- business, e.g. a crash before business context resolves). Server-side
-- inserts go through the service role key, which bypasses RLS entirely.
create policy error_logs_insert on public.error_logs
  for insert
  to authenticated
  with check (business_id is null or business_id = my_business_id());

-- Read access: admins see everything, business owners see their own errors.
create policy error_logs_select on public.error_logs
  for select
  to authenticated
  using (is_admin() or business_id = my_business_id());

-- No update/delete policy — append-only from the app. Prune old rows with a
-- manual SQL delete (e.g. `delete from error_logs where created_at < now() - interval '90 days'`)
-- if the table grows large; no automated retention job exists yet.
