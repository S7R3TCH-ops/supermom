-- Migration: Add unique constraints to clients to prevent duplicates
-- Scoped by business_id

-- 1. Unique Email per business (only for non-null emails)
CREATE UNIQUE INDEX IF NOT EXISTS clients_business_email_idx ON public.clients (business_id, email) 
WHERE (email IS NOT NULL AND deleted_at IS NULL);

-- 2. Unique Name + Phone per business (to allow same name if phone is different, but prevent exact matches)
CREATE UNIQUE INDEX IF NOT EXISTS clients_business_name_phone_idx ON public.clients (business_id, first_name, last_name, phone) 
WHERE (deleted_at IS NULL);
