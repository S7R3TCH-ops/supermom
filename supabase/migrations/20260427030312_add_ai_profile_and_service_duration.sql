-- Add AI Profile to the businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS ai_profile jsonb DEFAULT '{
  "style": "professional",
  "verbosity": "balanced",
  "reminders": ["pets", "keys", "vip"],
  "learning_notes": ""
}'::jsonb;

-- Add default_duration to services table
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS default_duration numeric DEFAULT 120;
