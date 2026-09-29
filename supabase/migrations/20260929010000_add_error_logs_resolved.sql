-- Error Log "done" state (tasks.md #12). Additive: one nullable column, one partial
-- index, one admin-only UPDATE policy. NOT auto-applied: Joel runs it in the Supabase SQL Editor.
alter table public.error_logs add column if not exists resolved_at timestamptz;

create index if not exists error_logs_unresolved_idx
  on public.error_logs (created_at desc) where resolved_at is null;

create policy error_logs_update on public.error_logs
  for update to authenticated
  using (is_admin()) with check (is_admin());

grant update (resolved_at) on public.error_logs to authenticated;

-- DOWN:
-- drop policy if exists error_logs_update on public.error_logs;
-- drop index if exists public.error_logs_unresolved_idx;
-- alter table public.error_logs drop column if exists resolved_at;
