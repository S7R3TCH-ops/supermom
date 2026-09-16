-- Fix: "Users can update themselves" policy (20260501070000_harden_rls.sql) only
-- checked `id = auth.uid()` in USING/WITH CHECK. RLS is row-level, not column-level,
-- so any authenticated user could UPDATE their own business_id or role to escalate
-- into another business or to admin. Confirmed via pg_policies before this fix.
--
-- Tighten WITH CHECK to also require business_id and role stay whatever they
-- already are on the row -- self-edits (name, email, prefs) still work,
-- self-escalation does not. Admin/service-role writes (server-side, service key)
-- bypass RLS entirely and are unaffected.

DROP POLICY IF EXISTS "Users can update themselves" ON public.users;

CREATE POLICY "Users can update themselves" ON public.users FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND business_id = (SELECT business_id FROM public.users WHERE id = auth.uid())
  AND role = (SELECT role FROM public.users WHERE id = auth.uid())
);
