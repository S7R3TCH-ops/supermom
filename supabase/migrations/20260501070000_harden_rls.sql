-- Migration: Harden RLS for all core tables
-- Ensures all tables have RLS enabled and proper owner-scoped policies.

-- 1. BUSINESSES
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can see their own business') THEN
    CREATE POLICY "Owners can see their own business" ON public.businesses FOR SELECT TO authenticated
    USING (id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can update their own business') THEN
    CREATE POLICY "Owners can update their own business" ON public.businesses FOR UPDATE TO authenticated
    USING (id IN (SELECT business_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

-- 2. USERS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can see themselves and others in same business') THEN
    CREATE POLICY "Users can see themselves and others in same business" ON public.users FOR SELECT TO authenticated
    USING (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update themselves') THEN
    CREATE POLICY "Users can update themselves" ON public.users FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- 3. CLIENTS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their business clients') THEN
    CREATE POLICY "Users can manage their business clients" ON public.clients FOR ALL TO authenticated
    USING (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

-- 4. JOBS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their business jobs') THEN
    CREATE POLICY "Users can manage their business jobs" ON public.jobs FOR ALL TO authenticated
    USING (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

-- 5. PAYMENTS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their business payments') THEN
    CREATE POLICY "Users can manage their business payments" ON public.payments FOR ALL TO authenticated
    USING (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

-- 6. EXPENSE_LOG
ALTER TABLE public.expense_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their business expenses') THEN
    CREATE POLICY "Users can manage their business expenses" ON public.expense_log FOR ALL TO authenticated
    USING (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

-- 7. INVOICES
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their business invoices') THEN
    CREATE POLICY "Users can manage their business invoices" ON public.invoices FOR ALL TO authenticated
    USING (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

-- 8. JOB_TEMPLATES
ALTER TABLE public.job_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their business job templates') THEN
    CREATE POLICY "Users can manage their business job templates" ON public.job_templates FOR ALL TO authenticated
    USING (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;
