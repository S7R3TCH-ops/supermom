-- Migration: Harden job date and time fields
-- Ensures data integrity at the source by preventing null schedules

-- 1. First, fill in any missing data with defaults (if any exist) to prevent migration failure
UPDATE public.jobs 
SET scheduled_date = CURRENT_DATE 
WHERE scheduled_date IS NULL;

UPDATE public.jobs 
SET scheduled_time = '10:00:00' 
WHERE scheduled_time IS NULL;

-- 2. Apply NOT NULL constraints
ALTER TABLE public.jobs 
  ALTER COLUMN scheduled_date SET NOT NULL,
  ALTER COLUMN scheduled_time SET NOT NULL;

-- 3. Ensure time format consistency for existing data (HH:mm:00)
-- Postgres 'time' type handles this internally, but we can verify our strings
-- if we ever cast them to text.
