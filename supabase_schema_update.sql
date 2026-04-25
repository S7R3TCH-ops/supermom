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

CREATE POLICY "Users can see their own integrations"
ON public.integrations FOR SELECT
TO authenticated
USING (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert their own integrations"
ON public.integrations FOR INSERT
TO authenticated
WITH CHECK (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));
