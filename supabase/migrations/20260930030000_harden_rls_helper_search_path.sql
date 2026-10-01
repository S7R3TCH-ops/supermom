-- Harden: pin search_path on the two SECURITY DEFINER RLS helpers.
-- Prod had proconfig = null for both (pulled 2026-09-30; see
-- 20260930020000_capture_rls_helper_functions.sql), so each resolved the
-- unqualified `users` via the caller's search_path (Supabase linter:
-- function_search_path_mutable). pg_temp is listed LAST on purpose so a
-- temp table can never shadow public.users. Function bodies are unchanged;
-- auth.uid() is already schema-qualified.
--
-- Apply AFTER the capture migration. Run in Supabase SQL Editor, then verify:
--   select proname, proconfig from pg_proc
--   where pronamespace = 'public'::regnamespace
--     and proname in ('is_admin','my_business_id');
-- Expect proconfig = {"search_path=public, pg_temp"} on both rows, then log in
-- as the QA owner and as an admin and confirm pages still load.
--
-- DOWN (instant rollback, restores the pre-migration state):
--   ALTER FUNCTION public.is_admin() RESET search_path;
--   ALTER FUNCTION public.my_business_id() RESET search_path;

ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.my_business_id() SET search_path = public, pg_temp;
