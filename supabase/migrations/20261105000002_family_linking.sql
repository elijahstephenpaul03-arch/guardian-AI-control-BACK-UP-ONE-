-- ==============================================================================
-- GUARDIAN AI: INDEPENDENT SUPABASE EDITION - PHASE 3
-- Migration: 20261105000002_family_linking.sql
-- Description: Trusted Family Code Generation, Collision-Safe Code Management,
--              Child Family Linking Requests, Realtime Authorization, and
--              Atomic Parent Approval/Rejection Workflow.
-- ==============================================================================

-- 1. Helper function: Authoritative Active User Check (rejects disabled users in RLS)
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_uid UUID;
  is_disabled BOOLEAN;
BEGIN
  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT disabled INTO is_disabled FROM public.users WHERE id = caller_uid;
  IF is_disabled IS NULL OR is_disabled = TRUE THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- 2. Unique index to guarantee zero duplicate pending link requests for the same child & family
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_child_family_request 
  ON public.family_link_requests (child_uid, family_code) 
  WHERE status = 'pending';

-- 3. RLS Policy Hardening: Disabled Users Rejected by Database RLS
DROP POLICY IF EXISTS "families_select_policy" ON public.families;
CREATE POLICY "families_select_policy"
  ON public.families FOR SELECT
  TO authenticated
  USING (
    public.is_active_user() AND (
      owner_parent_id = auth.uid() OR
      family_code = public.get_my_family_code() OR
      public.is_admin()
    )
  );

DROP POLICY IF EXISTS "families_insert_policy" ON public.families;
CREATE POLICY "families_insert_policy"
  ON public.families FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user() AND (
      owner_parent_id = auth.uid() OR
      public.is_admin()
    )
  );

DROP POLICY IF EXISTS "families_update_policy" ON public.families;
CREATE POLICY "families_update_policy"
  ON public.families FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user() AND (
      owner_parent_id = auth.uid() OR
      public.is_admin()
    )
  )
  WITH CHECK (
    public.is_active_user() AND (
      owner_parent_id = auth.uid() OR
      public.is_admin()
    )
  );

DROP POLICY IF EXISTS "link_requests_select_policy" ON public.family_link_requests;
CREATE POLICY "link_requests_select_policy"
  ON public.family_link_requests FOR SELECT
  TO authenticated
  USING (
    public.is_active_user() AND (
      child_uid = auth.uid() OR
      parent_uid = auth.uid() OR
      public.is_admin()
    )
  );

DROP POLICY IF EXISTS "link_requests_insert_policy" ON public.family_link_requests;
CREATE POLICY "link_requests_insert_policy"
  ON public.family_link_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user() AND
    child_uid = auth.uid() AND
    status = 'pending'
  );

DROP POLICY IF EXISTS "link_requests_update_policy" ON public.family_link_requests;
CREATE POLICY "link_requests_update_policy"
  ON public.family_link_requests FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user() AND (
      parent_uid = auth.uid() OR
      child_uid = auth.uid() OR
      public.is_admin()
    )
  )
  WITH CHECK (
    public.is_active_user() AND (
      (parent_uid = auth.uid() AND status IN ('accepted', 'rejected', 'disconnected', 'pending')) OR
      (child_uid = auth.uid() AND status IN ('pending', 'cancelled')) OR
      public.is_admin()
    )
  );

-- ==============================================================================
-- 4. TRUSTED FAMILY CODE MANAGEMENT DATABASE FUNCTION
-- ==============================================================================
-- Atomically generates or returns the parent's Family Code.
-- Invariants:
-- - Re-entrant & idempotent: Never generates a new code during ordinary login or refresh.
-- - Existing family_code and owner_parent_id are never overwritten.
-- - Collision-safe generation using uppercase unambiguous alphanumeric characters.
-- - Validates caller role and prevents disabled or unauthorized users.
CREATE OR REPLACE FUNCTION public.generate_or_get_family_code(p_family_name TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_uid UUID;
  caller_role public.user_role;
  caller_email TEXT;
  caller_name TEXT;
  existing_fam RECORD;
  user_fam_code TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code TEXT;
  attempt INT := 0;
  resolved_family_name TEXT;
BEGIN
  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Account is disabled. Please contact your platform administrator.';
  END IF;

  SELECT role, email, COALESCE(full_name, display_name, 'Parent'), family_code 
  INTO caller_role, caller_email, caller_name, user_fam_code 
  FROM public.users 
  WHERE id = caller_uid;

  IF caller_role != 'parent' THEN
    RAISE EXCEPTION 'Unauthorized: Only verified parent accounts can manage Family Codes. Admin and child accounts do not receive family codes.';
  END IF;

  -- Acquire transaction advisory lock on caller UUID to serialize concurrent requests
  PERFORM pg_advisory_xact_lock(hashtext('family_generation_' || caller_uid::text));

  -- 1. Check if caller already owns a family record in public.families
  SELECT family_code, family_name, owner_parent_id, parent_email, created_at
  INTO existing_fam
  FROM public.families
  WHERE owner_parent_id = caller_uid
  LIMIT 1;

  IF existing_fam.family_code IS NOT NULL THEN
    -- Ensure parent's user record references their owned family code
    IF user_fam_code IS DISTINCT FROM existing_fam.family_code THEN
      UPDATE public.users 
      SET family_code = existing_fam.family_code, updated_at = timezone('utc'::text, now())
      WHERE id = caller_uid;
    END IF;

    RETURN jsonb_build_object(
      'family_code', existing_fam.family_code,
      'family_name', existing_fam.family_name,
      'owner_parent_id', existing_fam.owner_parent_id,
      'parent_email', existing_fam.parent_email,
      'created_at', existing_fam.created_at,
      'is_new', FALSE
    );
  END IF;

  -- 2. Check if caller's user record has a family_code set
  IF user_fam_code IS NOT NULL AND user_fam_code != '' THEN
    SELECT family_code, family_name, owner_parent_id, parent_email, created_at
    INTO existing_fam
    FROM public.families
    WHERE family_code = user_fam_code;

    IF existing_fam.family_code IS NOT NULL THEN
      IF existing_fam.owner_parent_id IS DISTINCT FROM caller_uid THEN
        RAISE EXCEPTION 'Ownership conflict: Family code "%" is registered to another parent account (%). Refusing to overwrite.', 
          user_fam_code, existing_fam.owner_parent_id;
      END IF;

      RETURN jsonb_build_object(
        'family_code', existing_fam.family_code,
        'family_name', existing_fam.family_name,
        'owner_parent_id', existing_fam.owner_parent_id,
        'parent_email', existing_fam.parent_email,
        'created_at', existing_fam.created_at,
        'is_new', FALSE
      );
    END IF;
  END IF;

  -- 3. Collision-Safe Atomic Code Generation
  resolved_family_name := COALESCE(NULLIF(TRIM(p_family_name), ''), caller_name || '''s Family');

  LOOP
    attempt := attempt + 1;
    IF attempt > 25 THEN
      RAISE EXCEPTION 'Unable to allocate a unique family code after multiple attempts. Please try again.';
    END IF;

    new_code := '';
    FOR i IN 1..6 LOOP
      new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    BEGIN
      INSERT INTO public.families (family_code, family_name, owner_parent_id, parent_email)
      VALUES (new_code, resolved_family_name, caller_uid, caller_email);
      EXIT; -- Insertion succeeded without collision
    EXCEPTION
      WHEN unique_violation THEN
        -- Check if caller already has a family created by concurrent execution
        SELECT family_code, family_name, owner_parent_id, parent_email, created_at
        INTO existing_fam
        FROM public.families
        WHERE owner_parent_id = caller_uid;

        IF existing_fam.family_code IS NOT NULL THEN
          UPDATE public.users 
          SET family_code = existing_fam.family_code, updated_at = timezone('utc'::text, now())
          WHERE id = caller_uid;

          RETURN jsonb_build_object(
            'family_code', existing_fam.family_code,
            'family_name', existing_fam.family_name,
            'owner_parent_id', existing_fam.owner_parent_id,
            'parent_email', existing_fam.parent_email,
            'created_at', existing_fam.created_at,
            'is_new', FALSE
          );
        END IF;

        -- Code collision encountered; retry loop with next random code
        CONTINUE;
    END;
  END LOOP;

  -- Update parent's user record with newly created family code
  UPDATE public.users 
  SET family_code = new_code, updated_at = timezone('utc'::text, now())
  WHERE id = caller_uid;

  RETURN jsonb_build_object(
    'family_code', new_code,
    'family_name', resolved_family_name,
    'owner_parent_id', caller_uid,
    'parent_email', caller_email,
    'created_at', timezone('utc'::text, now()),
    'is_new', TRUE
  );
END;
$$;

-- ==============================================================================
-- 5. TRUSTED CHILD FAMILY LINK REQUEST FUNCTION
-- ==============================================================================
-- Validates family existence, child role, and creates pending family_link_requests.
-- Does NOT modify parent_id until authorized parental approval.
CREATE OR REPLACE FUNCTION public.submit_family_link_request(p_family_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_uid UUID;
  caller_role public.user_role;
  caller_name TEXT;
  caller_email TEXT;
  current_parent_id UUID;
  clean_code TEXT;
  target_family RECORD;
  existing_req RECORD;
  new_req_id UUID;
BEGIN
  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Account is disabled. Please contact your platform administrator.';
  END IF;

  SELECT role, email, COALESCE(full_name, display_name, 'Child Explorer'), parent_id
  INTO caller_role, caller_email, caller_name, current_parent_id
  FROM public.users
  WHERE id = caller_uid;

  IF caller_role != 'child' THEN
    RAISE EXCEPTION 'Unauthorized: Only child accounts can submit connection requests via Family Code.';
  END IF;

  IF current_parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'Child account is already linked to an active family. Please disconnect first before linking to another family.';
  END IF;

  clean_code := UPPER(TRIM(p_family_code));
  IF clean_code IS NULL OR clean_code = '' THEN
    RAISE EXCEPTION 'Please enter a valid 6-character Family Code.';
  END IF;

  -- 1. Verify that the target family exists in public.families
  SELECT family_code, family_name, owner_parent_id, parent_email
  INTO target_family
  FROM public.families
  WHERE family_code = clean_code;

  IF target_family.family_code IS NULL THEN
    RAISE EXCEPTION 'Invalid Family Code: No family found matching "%". Please verify the code with your parent.', clean_code;
  END IF;

  -- 2. Check for existing pending request to avoid duplicates
  SELECT id, family_code, parent_uid, child_uid, status, created_at
  INTO existing_req
  FROM public.family_link_requests
  WHERE child_uid = caller_uid AND family_code = clean_code AND status = 'pending';

  IF existing_req.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'id', existing_req.id,
      'family_code', existing_req.family_code,
      'parent_uid', existing_req.parent_uid,
      'child_uid', existing_req.child_uid,
      'status', existing_req.status,
      'created_at', existing_req.created_at,
      'is_duplicate', TRUE,
      'message', 'A connection request to this family is already pending approval.'
    );
  END IF;

  -- 3. Insert pending request record
  new_req_id := gen_random_uuid();
  INSERT INTO public.family_link_requests (
    id,
    family_code,
    parent_uid,
    child_uid,
    child_name,
    child_email,
    status,
    created_at
  ) VALUES (
    new_req_id,
    clean_code,
    target_family.owner_parent_id,
    caller_uid,
    caller_name,
    caller_email,
    'pending',
    timezone('utc'::text, now())
  );

  RETURN jsonb_build_object(
    'id', new_req_id,
    'family_code', clean_code,
    'parent_uid', target_family.owner_parent_id,
    'child_uid', caller_uid,
    'child_name', caller_name,
    'child_email', caller_email,
    'status', 'pending',
    'created_at', timezone('utc'::text, now()),
    'is_duplicate', FALSE
  );
END;
$$;

-- ==============================================================================
-- 6. TRUSTED PARENT APPROVAL & REJECTION DATABASE FUNCTION
-- ==============================================================================
-- Atomically processes parent's approval or rejection of a connection request.
-- On acceptance:
-- - Sets request status to 'accepted'.
-- - Atomically links child's public.users record (parent_id = parent_uid, family_code = family_code).
-- - Ensures a child_profiles record exists under the parent.
-- - Cancels any conflicting pending requests from the child to other families.
-- - Preserves audit log in public.activity_logs.
CREATE OR REPLACE FUNCTION public.respond_to_family_link_request(p_request_id UUID, p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_uid UUID;
  req RECORD;
  clean_action TEXT;
  parent_name TEXT;
  now_ts TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Account is disabled. Please contact your platform administrator.';
  END IF;

  clean_action := LOWER(TRIM(p_action));
  IF clean_action != 'accept' AND clean_action != 'reject' THEN
    RAISE EXCEPTION 'Invalid action "%". Expected "accept" or "reject".', p_action;
  END IF;

  SELECT id, family_code, parent_uid, child_uid, child_name, child_email, status
  INTO req
  FROM public.family_link_requests
  WHERE id = p_request_id;

  IF req.id IS NULL THEN
    RAISE EXCEPTION 'Connection request not found.';
  END IF;

  -- Verify caller authorization: Only designated parent or admin can respond
  IF req.parent_uid IS DISTINCT FROM caller_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: You are not authorized to respond to connection requests for this family.';
  END IF;

  IF req.status != 'pending' THEN
    RAISE EXCEPTION 'Request is no longer pending (current status: %).', req.status;
  END IF;

  IF clean_action = 'accept' THEN
    -- 1. Mark request accepted
    UPDATE public.family_link_requests
    SET status = 'accepted', responded_at = now_ts
    WHERE id = p_request_id;

    -- 2. Atomically link child user
    UPDATE public.users
    SET 
      parent_id = req.parent_uid,
      family_code = req.family_code,
      updated_at = now_ts
    WHERE id = req.child_uid;

    -- 3. Ensure child profile exists under parent
    INSERT INTO public.child_profiles (
      id,
      parent_id,
      child_user_id,
      name,
      age,
      avatar,
      screen_time_limit,
      screen_time_used,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      req.parent_uid,
      req.child_uid,
      req.child_name,
      10,
      '👦',
      120,
      0,
      now_ts,
      now_ts
    )
    ON CONFLICT DO NOTHING;

    -- 4. Cancel any other pending requests for this child
    UPDATE public.family_link_requests
    SET status = 'cancelled', responded_at = now_ts
    WHERE child_uid = req.child_uid AND id != p_request_id AND status = 'pending';

    -- 5. Record activity log for parent
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
      req.parent_uid,
      req.child_uid,
      'system',
      'Family Node Linked: ' || req.child_name || ' was successfully connected to your Guardian AI family network.',
      'family_link',
      'active',
      now_ts
    );

    RETURN jsonb_build_object(
      'success', TRUE,
      'status', 'accepted',
      'request_id', p_request_id,
      'child_uid', req.child_uid,
      'family_code', req.family_code,
      'message', 'Child successfully linked to family network.'
    );

  ELSE -- clean_action = 'reject'
    UPDATE public.family_link_requests
    SET status = 'rejected', responded_at = now_ts
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
      'success', TRUE,
      'status', 'rejected',
      'request_id', p_request_id,
      'child_uid', req.child_uid,
      'family_code', req.family_code,
      'message', 'Connection request declined.'
    );
  END IF;
END;
$$;

-- ==============================================================================
-- 7. TRUSTED DISCONNECT / UNLINK FUNCTION
-- ==============================================================================
-- Safely unlinks a child from the parent's family while retaining historical
-- safety telemetry, emergency SOS records, and activity logs.
CREATE OR REPLACE FUNCTION public.unlink_child(p_child_uid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_uid UUID;
  child_rec RECORD;
  now_ts TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Account is disabled. Please contact your platform administrator.';
  END IF;

  SELECT id, full_name, parent_id, family_code
  INTO child_rec
  FROM public.users
  WHERE id = p_child_uid;

  IF child_rec.id IS NULL THEN
    RAISE EXCEPTION 'Child account not found.';
  END IF;

  -- Only linked parent or admin can unlink
  IF child_rec.parent_id IS DISTINCT FROM caller_uid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only the linked parent or platform administrator can disconnect this child account.';
  END IF;

  -- Atomically unlink child
  UPDATE public.users
  SET parent_id = NULL, family_code = NULL, updated_at = now_ts
  WHERE id = p_child_uid;

  -- Mark connection request disconnected
  UPDATE public.family_link_requests
  SET status = 'disconnected', responded_at = now_ts
  WHERE child_uid = p_child_uid AND parent_uid = child_rec.parent_id AND status = 'accepted';

  -- Add audit log entry
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
    caller_uid,
    p_child_uid,
    'system',
    'Family Node Disconnected: ' || COALESCE(child_rec.full_name, 'Child') || ' was disconnected from family network. Historical records and SOS telemetry retained.',
    'family_link',
    'disconnected',
    now_ts
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'child_uid', p_child_uid,
    'message', 'Child successfully disconnected from family network.'
  );
END;
$$;
