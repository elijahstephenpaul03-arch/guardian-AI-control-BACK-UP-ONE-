-- ==============================================================================
-- GUARDIAN AI: SUPABASE EDITION - DEVICE REGISTRATION RLS 42501 FIX (PHASE 6)
-- Migration: 20261105000006_fix_device_registration_rls.sql
-- Description: Replaces recursive and generic device RLS policies with ownership-safe,
--              high-performance policies.
--              Guarantees:
--              1. Child can register and update ONLY their own device (child_id = auth.uid()).
--              2. Child must be active (disabled = FALSE) and linked to parent.
--              3. Parent can manage devices ONLY for their verified linked children.
--              4. Parent CANNOT register themselves as a child device.
--              5. Unrelated parents receive 0 records and cannot modify devices.
--              6. Unlinked or disabled accounts are strictly rejected.
--              7. Admin access preserved via public.is_admin().
-- ==============================================================================

-- 1. Hardened Trigger: enforce_device_integrity with authoritative family_code backfill
CREATE OR REPLACE FUNCTION public.enforce_device_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID;
  caller_rec RECORD;
BEGIN
  caller_id := auth.uid();
  -- Internal system context bypass
  IF caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Must be active (not disabled)
  SELECT role, disabled, parent_id, family_code
  INTO caller_rec
  FROM public.users
  WHERE id = caller_id;

  IF caller_rec.role IS NULL OR caller_rec.disabled = TRUE THEN
    RAISE EXCEPTION 'Unauthorized: Account is disabled or does not exist.';
  END IF;

  IF caller_rec.role = 'child' THEN
    -- Invariant 1: child_id must strictly equal auth.uid()
    IF NEW.child_id IS NOT NULL AND NEW.child_id IS DISTINCT FROM caller_id THEN
      RAISE EXCEPTION 'Permission denied: Child users can only register devices for themselves.';
    END IF;
    NEW.child_id := caller_id;

    -- Invariant 7: Unlinked child cannot register devices
    IF caller_rec.parent_id IS NULL THEN
      RAISE EXCEPTION 'Unlinked child account cannot register companion devices. Connect to a family first.';
    END IF;

    -- Invariant 2 & 4: parent_id must match authoritative public.users.parent_id
    IF NEW.parent_id IS NOT NULL AND NEW.parent_id IS DISTINCT FROM caller_rec.parent_id THEN
      RAISE EXCEPTION 'Permission denied: Child cannot register a device under an unrelated Parent UID.';
    END IF;
    NEW.parent_id := caller_rec.parent_id;

    -- Ensure authoritative family_code is set
    IF NEW.family_code IS NULL THEN
      NEW.family_code := caller_rec.family_code;
    END IF;

  ELSIF caller_rec.role = 'parent' THEN
    -- Parents can only register/update devices for their own linked children
    IF NEW.child_id IS NULL OR NEW.child_id = caller_id THEN
      RAISE EXCEPTION 'Parents cannot register devices for themselves. Companion devices are reserved for linked children.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = NEW.child_id AND parent_id = caller_id AND role = 'child' AND disabled = FALSE
    ) THEN
      RAISE EXCEPTION 'Parents can only manage devices for their verified linked children.';
    END IF;

    NEW.parent_id := caller_id;
    IF NEW.family_code IS NULL THEN
      NEW.family_code := caller_rec.family_code;
    END IF;

  ELSIF public.is_admin() THEN
    -- Admin override
    NULL;
  ELSE
    RAISE EXCEPTION 'Unauthorized device registration.';
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_device_integrity ON public.devices;
CREATE TRIGGER trg_enforce_device_integrity
  BEFORE INSERT OR UPDATE ON public.devices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_device_integrity();

-- 2. Clean, Non-Recursive RLS Policies for public.devices

-- SELECT Policy
DROP POLICY IF EXISTS "devices_select_policy" ON public.devices;
CREATE POLICY "devices_select_policy"
  ON public.devices FOR SELECT
  TO authenticated
  USING (
    -- Child views own devices
    (
      child_id = auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = 'child' AND u.disabled = FALSE
      )
    )
    OR
    -- Parent views devices belonging to their verified linked children
    (
      parent_id = auth.uid() AND
      child_id <> auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = devices.child_id AND u.parent_id = auth.uid() AND u.role = 'child' AND u.disabled = FALSE
      )
    )
    OR
    public.is_admin()
  );

-- INSERT Policy
DROP POLICY IF EXISTS "devices_insert_policy" ON public.devices;
CREATE POLICY "devices_insert_policy"
  ON public.devices FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Child registers own device
    (
      child_id = auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = 'child'
          AND u.disabled = FALSE
          AND u.parent_id IS NOT NULL
          AND u.parent_id = devices.parent_id
      )
    )
    OR
    -- Parent registers device for a verified linked child (cannot register for self)
    (
      parent_id = auth.uid() AND
      child_id IS NOT NULL AND
      child_id <> auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = devices.child_id
          AND u.parent_id = auth.uid()
          AND u.role = 'child'
          AND u.disabled = FALSE
      )
    )
    OR
    public.is_admin()
  );

-- UPDATE Policy
DROP POLICY IF EXISTS "devices_update_policy" ON public.devices;
CREATE POLICY "devices_update_policy"
  ON public.devices FOR UPDATE
  TO authenticated
  USING (
    -- Child updates own device
    (
      child_id = auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = 'child'
          AND u.disabled = FALSE
          AND u.parent_id IS NOT NULL
          AND u.parent_id = devices.parent_id
      )
    )
    OR
    -- Parent updates linked child's device
    (
      parent_id = auth.uid() AND
      child_id <> auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = devices.child_id
          AND u.parent_id = auth.uid()
          AND u.role = 'child'
          AND u.disabled = FALSE
      )
    )
    OR
    public.is_admin()
  )
  WITH CHECK (
    (
      child_id = auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = 'child'
          AND u.disabled = FALSE
          AND u.parent_id IS NOT NULL
          AND u.parent_id = devices.parent_id
      )
    )
    OR
    (
      parent_id = auth.uid() AND
      child_id <> auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = devices.child_id
          AND u.parent_id = auth.uid()
          AND u.role = 'child'
          AND u.disabled = FALSE
      )
    )
    OR
    public.is_admin()
  );

-- DELETE Policy
DROP POLICY IF EXISTS "devices_delete_policy" ON public.devices;
CREATE POLICY "devices_delete_policy"
  ON public.devices FOR DELETE
  TO authenticated
  USING (
    (
      child_id = auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = 'child' AND u.disabled = FALSE
      )
    )
    OR
    (
      parent_id = auth.uid() AND
      child_id <> auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = devices.child_id AND u.parent_id = auth.uid() AND u.role = 'child' AND u.disabled = FALSE
      )
    )
    OR
    public.is_admin()
  );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
