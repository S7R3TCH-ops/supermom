-- Add AI Profile to the businesses table for "learning" user style
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS ai_profile jsonb DEFAULT '{
  "style": "professional",
  "verbosity": "balanced",
  "reminders": ["pets", "keys", "vip"],
  "learning_notes": ""
}'::jsonb;
