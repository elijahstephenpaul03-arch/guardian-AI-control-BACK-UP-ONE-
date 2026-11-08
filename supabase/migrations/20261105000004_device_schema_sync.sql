-- ==============================================================================
-- GUARDIAN AI: INDEPENDENT SUPABASE EDITION - DEVICE SCHEMA SYNCHRONIZATION
-- Migration: 20261105000004_device_schema_sync.sql
-- Description: Synchronizes public.devices schema with safe family_code column
--              addition (if desired by database administrator), backfills authoritative
--              family links from public.users, and refreshes the PostgREST schema cache.
-- ==============================================================================

-- 1. Safely add family_code column to public.devices if not already present
ALTER TABLE public.devices 
  ADD COLUMN IF NOT EXISTS family_code TEXT REFERENCES public.families(family_code) ON DELETE SET NULL;

-- 2. Performance index on family_code
CREATE INDEX IF NOT EXISTS idx_devices_family ON public.devices(family_code);

-- 3. Backfill family_code from authoritative public.users child records
UPDATE public.devices d
SET family_code = u.family_code
FROM public.users u
WHERE d.child_id = u.id AND d.family_code IS NULL AND u.family_code IS NOT NULL;

-- 4. Reload PostgREST schema cache so any newly added columns are immediately recognized
NOTIFY pgrst, 'reload schema';
