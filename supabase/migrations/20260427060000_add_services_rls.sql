-- Migration: Add RLS policies for services catalog
-- Ensures business owners can manage their own catalog

-- Enable RLS if not already
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Users can see services for their business
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can see their own business services') THEN
    CREATE POLICY "Users can see their own business services"
    ON public.services FOR SELECT
    TO authenticated
    USING (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));
  END IF;

  -- 2. INSERT: Users can add services to their business
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own business services') THEN
    CREATE POLICY "Users can insert their own business services"
    ON public.services FOR INSERT
    TO authenticated
    WITH CHECK (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));
  END IF;

  -- 3. UPDATE: Users can update services in their business
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own business services') THEN
    CREATE POLICY "Users can update their own business services"
    ON public.services FOR UPDATE
    TO authenticated
    USING (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));
  END IF;

  -- 4. DELETE: Users can delete services in their business
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own business services') THEN
    CREATE POLICY "Users can delete their own business services"
    ON public.services FOR DELETE
    TO authenticated
    USING (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));
  END IF;
END
$$;
