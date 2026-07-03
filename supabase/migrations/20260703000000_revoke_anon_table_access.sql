-- ─────────────────────────────────────────────────────────────────────────────
-- SEC-1 (RLS half): remove anonymous browser access to tenant tables.
--
-- ⚠️  NOT APPLIED — migrations are not auto-applied to the live DB (CLAUDE.md).
-- ⚠️  Joel must run this manually in the Supabase SQL Editor, AND ONLY AFTER
--     the audit-fixes branch is deployed. Order matters:
--
--   1. Deploy the branch first. The public /i/:id invoice page now reads via
--      GET /api/invoice?id=X&format=json (service role) — it no longer needs
--      the anon key to SELECT invoices/clients/businesses/jobs/payments.
--      Running this migration BEFORE deploying breaks every shared invoice link.
--
--   2. Inspect what anon can currently see (there are ZERO anon policies in
--      committed migrations, so whatever exists lives only in the dashboard):
--
--        SELECT tablename, policyname, roles, cmd, qual
--        FROM pg_policies
--        WHERE schemaname = 'public'
--          AND ('anon' = ANY(roles) OR 'public' = ANY(roles));
--
--      • Policies with roles = {anon}: this migration's DO block drops them.
--      • Policies with roles = {public}: NOT dropped automatically — 'public'
--        includes 'authenticated', so dropping could break the logged-in app.
--        Review each manually; if one exists only to serve the old anon
--        invoice read, recreate it as TO authenticated instead.
--
--   3. Run this migration.
--
--   4. Verify: open a /i/:id link in a private window (must load), log in as
--      Sandra and load Home/Clients/Finance (must load), download invoice PDF.
-- ─────────────────────────────────────────────────────────────────────────────

-- Belt: even if an anon SELECT policy survives or is re-added later, anon has
-- no table privilege at all, so reads fail regardless of policy state.
-- authenticated + service_role grants are untouched.
REVOKE ALL ON TABLE
  public.invoices,
  public.invoice_jobs,
  public.clients,
  public.businesses,
  public.jobs,
  public.payments
FROM anon;

-- Suspenders: drop any policy scoped specifically to the anon role on those
-- tables (no-op if none exist).
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('invoices', 'invoice_jobs', 'clients', 'businesses', 'jobs', 'payments')
      AND roles = '{anon}'::name[]
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    RAISE NOTICE 'Dropped anon policy % on %.%', pol.policyname, pol.schemaname, pol.tablename;
  END LOOP;
END $$;
