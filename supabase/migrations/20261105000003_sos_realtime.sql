-- ==============================================================================
-- GUARDIAN AI: INDEPENDENT SUPABASE EDITION - PHASE 4
-- Migration: 20261105000003_sos_realtime.sql
-- Description: Emergency SOS Creation, Resolution, Realtime Publications, and
--              Zero Child Self-Clear Security Enforcement.
-- ==============================================================================

-- 1. Enable Full Replica Identity on sos_alerts for filtered Realtime CDC updates
ALTER TABLE public.sos_alerts REPLICA IDENTITY FULL;

-- 2. Add sos_alerts to supabase_realtime publication
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sos_alerts;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- 3. Hardened RLS Policies for Emergency SOS Alerts (incorporating is_active_user)
DROP POLICY IF EXISTS "sos_alerts_select_policy" ON public.sos_alerts;
CREATE POLICY "sos_alerts_select_policy"
  ON public.sos_alerts FOR SELECT
  TO authenticated
  USING (
    public.is_active_user() AND (
      child_id = auth.uid() OR
      parent_uid = auth.uid() OR
      family_code = public.get_my_family_code() OR
      public.is_admin()
    )
  );

DROP POLICY IF EXISTS "sos_alerts_insert_policy" ON public.sos_alerts;
CREATE POLICY "sos_alerts_insert_policy"
  ON public.sos_alerts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user() AND (
      child_id = auth.uid() OR
      parent_uid = auth.uid() OR
      public.is_admin()
    )
  );

DROP POLICY IF EXISTS "sos_alerts_update_policy" ON public.sos_alerts;
CREATE POLICY "sos_alerts_update_policy"
  ON public.sos_alerts FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user() AND (
      parent_uid = auth.uid() OR
      public.is_admin()
    ) AND
    child_id <> auth.uid() AND
    status = 'active'
  )
  WITH CHECK (
    public.is_active_user() AND (
      parent_uid = auth.uid() OR
      public.is_admin()
    ) AND
    child_id <> auth.uid() AND
    status = 'resolved' AND
    resolved_by = auth.uid()
  );

DROP POLICY IF EXISTS "sos_alerts_delete_policy" ON public.sos_alerts;
CREATE POLICY "sos_alerts_delete_policy"
  ON public.sos_alerts FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );

-- ==============================================================================
-- 3.1 IMMUTABLE AUDIT & REOPENING PREVENTION TRIGGER REFINEMENT
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.enforce_sos_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id UUID;
  caller_role public.user_role;
  child_rec RECORD;
BEGIN
  -- 0. Universal Security Invariant: Resolved distress signals can NEVER be reopened
  IF TG_OP = 'UPDATE' AND OLD.status = 'resolved' AND NEW.status = 'active' THEN
    RAISE EXCEPTION 'Resolved emergency SOS alerts cannot be reopened.';
  END IF;

  caller_id := auth.uid();
  -- Internal system context (foreign key cascade/set null updates)
  IF caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM public.users WHERE id = caller_id;

  -- -------------------------------------------------------------
  -- INSERT: SOS Creation Verification
  -- -------------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    IF caller_role = 'child' THEN
      IF NEW.child_id <> caller_id THEN
        RAISE EXCEPTION 'Child users are strictly permitted to trigger emergency SOS for themselves only.';
      END IF;

      SELECT parent_id, family_code, full_name, display_name
      INTO child_rec
      FROM public.users
      WHERE id = caller_id;

      NEW.child_name := COALESCE(child_rec.full_name, child_rec.display_name, 'Child User');
      NEW.parent_uid := child_rec.parent_id;
      NEW.family_code := child_rec.family_code;
      NEW.status := 'active';
      NEW.resolved_by := NULL;
      NEW.resolved_at := NULL;

    ELSIF caller_role = 'parent' THEN
      SELECT parent_id, family_code, full_name, display_name
      INTO child_rec
      FROM public.users
      WHERE id = NEW.child_id AND parent_id = caller_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Parents can only dispatch emergency SOS for their authorized linked children.';
      END IF;

      NEW.parent_uid := caller_id;
      NEW.family_code := child_rec.family_code;
      NEW.child_name := COALESCE(child_rec.full_name, child_rec.display_name, NEW.child_name);
      NEW.status := 'active';
      NEW.resolved_by := NULL;
      NEW.resolved_at := NULL;

    ELSIF public.is_admin() THEN
      NEW.status := 'active';
      NEW.resolved_by := NULL;
      NEW.resolved_at := NULL;
    ELSE
      RAISE EXCEPTION 'Unauthorized to trigger emergency SOS.';
    END IF;

    RETURN NEW;

  -- -------------------------------------------------------------
  -- UPDATE: SOS Resolution Verification
  -- -------------------------------------------------------------
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'resolved' THEN
      IF caller_id = OLD.child_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Safety violation: Children are not permitted to resolve their own distress alerts.';
      END IF;

      IF OLD.parent_uid <> caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Permission denied: Only the authorized linked parent or system administrator can resolve this alert.';
      END IF;

      NEW.resolved_by := caller_id;
      NEW.resolved_at := timezone('utc'::text, now());
    END IF;

    NEW.child_id := OLD.child_id;
    NEW.parent_uid := OLD.parent_uid;
    NEW.family_code := OLD.family_code;
    NEW.created_at := OLD.created_at;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- ==============================================================================
-- 4. TRUSTED EMERGENCY SOS CREATION DATABASE FUNCTION
-- ==============================================================================
-- Authoritatively creates an SOS alert.
-- Invariants:
-- - Child can only trigger SOS for themselves.
-- - Resolves parent_uid and family_code strictly from PostgreSQL database records.
-- - Never trusts client-supplied parent UID or family code.
-- - Rejects unlinked children from triggering orphan alerts.
CREATE OR REPLACE FUNCTION public.trigger_emergency_sos(
  p_child_id UUID DEFAULT NULL,
  p_location JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_uid UUID;
  caller_role public.user_role;
  effective_child_id UUID;
  child_rec RECORD;
  resolved_location JSONB;
  new_alert_id UUID := gen_random_uuid();
  now_ts TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to trigger emergency distress signal.';
  END IF;

  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Account is disabled. Cannot transmit emergency distress signals.';
  END IF;

  SELECT role INTO caller_role FROM public.users WHERE id = caller_uid;

  resolved_location := COALESCE(
    p_location, 
    '{"lat": 0, "lng": 0, "name": "Location unavailable"}'::jsonb
  );

  -- 1. Child Triggering SOS
  IF caller_role = 'child' THEN
    effective_child_id := caller_uid;

    -- Child cannot specify a different child_id
    IF p_child_id IS NOT NULL AND p_child_id <> caller_uid THEN
      RAISE EXCEPTION 'Safety violation: Child users are strictly permitted to trigger emergency SOS for themselves only.';
    END IF;

    SELECT id, full_name, display_name, email, parent_id, family_code
    INTO child_rec
    FROM public.users
    WHERE id = caller_uid;

    IF child_rec.parent_id IS NULL THEN
      RAISE EXCEPTION 'Cannot dispatch SOS: Child account is not linked to any active family network. Please connect using your family code first.';
    END IF;

    INSERT INTO public.sos_alerts (
      id,
      child_id,
      child_name,
      parent_uid,
      family_code,
      location,
      status,
      created_at
    ) VALUES (
      new_alert_id,
      caller_uid,
      COALESCE(child_rec.full_name, child_rec.display_name, 'Child Explorer'),
      child_rec.parent_id,
      child_rec.family_code,
      resolved_location,
      'active',
      now_ts
    );

    -- Record critical activity log for parent
    INSERT INTO public.activity_logs (
      id,
      parent_id,
      child_id,
      type,
      detail,
      category,
      status,
      created_at
    ) VALUES (
      gen_random_uuid(),
      child_rec.parent_id,
      caller_uid,
      'sos',
      '🚨 EMERGENCY SOS: ' || COALESCE(child_rec.full_name, 'Child') || ' triggered distress signal on companion device.',
      'emergency',
      'severe',
      now_ts
    );

  -- 2. Parent Triggering SOS for linked child
  ELSIF caller_role = 'parent' THEN
    IF p_child_id IS NULL THEN
      RAISE EXCEPTION 'Missing target child ID.';
    END IF;

    SELECT id, full_name, display_name, parent_id, family_code
    INTO child_rec
    FROM public.users
    WHERE id = p_child_id AND parent_id = caller_uid;

    IF child_rec.id IS NULL THEN
      RAISE EXCEPTION 'Permission denied: Parents can only dispatch emergency SOS for their authorized linked children.';
    END IF;

    INSERT INTO public.sos_alerts (
      id,
      child_id,
      child_name,
      parent_uid,
      family_code,
      location,
      status,
      created_at
    ) VALUES (
      new_alert_id,
      child_rec.id,
      COALESCE(child_rec.full_name, child_rec.display_name, 'Child Explorer'),
      caller_uid,
      child_rec.family_code,
      resolved_location,
      'active',
      now_ts
    );

  -- 3. Administrator Override
  ELSIF public.is_admin() THEN
    IF p_child_id IS NULL THEN
      RAISE EXCEPTION 'Missing target child ID for administrator SOS dispatch.';
    END IF;

    SELECT id, full_name, display_name, parent_id, family_code
    INTO child_rec
    FROM public.users
    WHERE id = p_child_id;

    IF child_rec.id IS NULL THEN
      RAISE EXCEPTION 'Target child account not found.';
    END IF;

    INSERT INTO public.sos_alerts (
      id,
      child_id,
      child_name,
      parent_uid,
      family_code,
      location,
      status,
      created_at
    ) VALUES (
      new_alert_id,
      child_rec.id,
      COALESCE(child_rec.full_name, child_rec.display_name, 'Child Explorer'),
      child_rec.parent_id,
      child_rec.family_code,
      resolved_location,
      'active',
      now_ts
    );

  ELSE
    RAISE EXCEPTION 'Unauthorized to trigger emergency distress alerts.';
  END IF;

  RETURN jsonb_build_object(
    'id', new_alert_id,
    'child_id', child_rec.id,
    'child_name', COALESCE(child_rec.full_name, child_rec.display_name, 'Child Explorer'),
    'parent_uid', COALESCE(child_rec.parent_id, caller_uid),
    'family_code', child_rec.family_code,
    'location', resolved_location,
    'status', 'active',
    'created_at', now_ts
  );
END;
$$;

-- ==============================================================================
-- 5. TRUSTED EMERGENCY SOS RESOLUTION DATABASE FUNCTION
-- ==============================================================================
-- Atomically marks an emergency SOS alert as resolved.
-- Invariants:
-- - Only authorized linked parent or admin can resolve.
-- - Children cannot resolve alerts (zero child self-clear).
-- - Unrelated parents cannot resolve alerts.
-- - Cannot reopen resolved emergency alerts.
-- - Records resolved_by and resolved_at automatically.
CREATE OR REPLACE FUNCTION public.resolve_emergency_sos(p_alert_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_uid UUID;
  alert_rec RECORD;
  now_ts TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Account is disabled. Cannot perform emergency operations.';
  END IF;

  SELECT id, child_id, child_name, parent_uid, family_code, status, location
  INTO alert_rec
  FROM public.sos_alerts
  WHERE id = p_alert_id;

  IF alert_rec.id IS NULL THEN
    RAISE EXCEPTION 'Emergency SOS alert not found.';
  END IF;

  IF alert_rec.status = 'resolved' THEN
    RAISE EXCEPTION 'Emergency SOS alert is already resolved and cannot be modified.';
  END IF;

  -- 1. Zero child self-clear: Children can NEVER resolve distress alerts
  IF alert_rec.child_id = caller_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Safety violation: Children are not permitted to resolve their own distress alerts.';
  END IF;

  -- 2. Authorization check: Must be the designated parent or admin
  IF alert_rec.parent_uid IS DISTINCT FROM caller_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: Only the authorized linked parent or administrator can resolve this emergency alert.';
  END IF;

  -- 3. Atomically update status
  UPDATE public.sos_alerts
  SET 
    status = 'resolved',
    resolved_by = caller_uid,
    resolved_at = now_ts
  WHERE id = p_alert_id;

  -- 4. Record audit log entry
  IF alert_rec.parent_uid IS NOT NULL THEN
    INSERT INTO public.activity_logs (
      id,
      parent_id,
      child_id,
      type,
      detail,
      category,
      status,
      created_at
    ) VALUES (
      gen_random_uuid(),
      alert_rec.parent_uid,
      alert_rec.child_id,
      'sos',
      'Emergency SOS distress alert resolved by parent.',
      'emergency',
      'resolved',
      now_ts
    );
  END IF;

  RETURN jsonb_build_object(
    'id', p_alert_id,
    'child_id', alert_rec.child_id,
    'child_name', alert_rec.child_name,
    'parent_uid', alert_rec.parent_uid,
    'family_code', alert_rec.family_code,
    'status', 'resolved',
    'resolved_by', caller_uid,
    'resolved_at', now_ts,
    'message', 'Emergency distress alert marked resolved by parent.'
  );
END;
$$;
