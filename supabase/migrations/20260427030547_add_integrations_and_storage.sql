-- Create integrations table
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  service_name text NOT NULL, -- e.g. 'google_calendar'
  refresh_token text NOT NULL,
  calendar_id text DEFAULT 'primary',
  created_at timestamptz DEFAULT now(),
  UNIQUE(business_id, service_name)
);

-- Enable RLS
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Create Policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can see their own integrations') THEN
    CREATE POLICY "Users can see their own integrations"
    ON public.integrations FOR SELECT
    TO authenticated
    USING (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own integrations') THEN
    CREATE POLICY "Users can insert their own integrations"
    ON public.integrations FOR INSERT
    TO authenticated
    WITH CHECK (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));
  END IF;
END
$$;

-- Create the bucket for job assets (photos and voice notes)
-- Note: inserting into storage.buckets requires appropriate permissions
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-assets', 'job-assets', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for the bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload job assets'
  ) THEN
    CREATE POLICY "Authenticated users can upload job assets"
    ON storage.objects FOR INSERT
    WITH CHECK ( bucket_id = 'job-assets' AND auth.role() = 'authenticated' );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view job assets'
  ) THEN
    CREATE POLICY "Authenticated users can view job assets"
    ON storage.objects FOR SELECT
    USING ( bucket_id = 'job-assets' AND auth.role() = 'authenticated' );
  END IF;
END
$$;
