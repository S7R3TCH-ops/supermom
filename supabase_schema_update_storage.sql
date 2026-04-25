-- Create the bucket for job assets (photos and voice notes)
insert into storage.buckets (id, name, public)
values ('job-assets', 'job-assets', false)
on conflict (id) do nothing;

-- RLS for the bucket
-- Allow authenticated users to upload and view objects in the 'job-assets' bucket
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
