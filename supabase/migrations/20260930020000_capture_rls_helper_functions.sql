-- Capture (no behavior change): is_admin() and my_business_id() are the
-- SECURITY DEFINER helpers every RLS policy depends on, but neither had a
-- CREATE FUNCTION in any committed migration (drift flagged in the 2026-09
-- audit, tasks.md #6). Definitions below are copied verbatim from prod
-- (pg_get_functiondef, pulled 2026-09-30), so re-running this on prod is a
-- no-op and a fresh project rebuilt from migrations gets the same helpers.
--
-- NOT hardened here on purpose: prod has proconfig = null, i.e. neither
-- function pins search_path (Supabase linter: function_search_path_mutable).
-- Pinning it changes behavior and is a separate, reviewed migration.
--
-- DOWN: intentionally none. These functions are load-bearing for every RLS
-- policy; dropping them would lock every user out.

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  select exists (
    select 1 from users where id = auth.uid() and role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.my_business_id()
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  select business_id from users where id = auth.uid();
$function$;
