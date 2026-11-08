-- ==============================================================================
-- GUARDIAN AI: INDEPENDENT SUPABASE EDITION - PHASE 1 SCHEMA
-- Migration: 20261105000000_initial_schema.sql
-- Description: Core PostgreSQL types, tables, constraints, security functions,
--              triggers, and data retention rules.
-- ==============================================================================

-- 1. Native PostgreSQL UUID function is built-in (PostgreSQL 13+)

-- 2. Enumerated Domain Types
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'parent', 'child');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.request_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'disconnected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sos_status AS ENUM ('active', 'resolved');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Families Table
-- Family groups that associate parents and their connected children.
-- ON DELETE RESTRICT ensures family records and emergency histories cannot be accidentally wiped.
CREATE TABLE IF NOT EXISTS public.families (
  family_code TEXT PRIMARY KEY,
  family_name TEXT NOT NULL,
  owner_parent_id UUID NOT NULL,
  parent_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Primary Users Table (mirrors auth.users)
-- NO automatic DEFAULT 'parent' role: trusted assignment enforced via handle_new_user() trigger.
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  display_name TEXT,
  role public.user_role NOT NULL,
  family_code TEXT REFERENCES public.families(family_code) ON DELETE SET NULL,
  parent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Foreign key for families.owner_parent_id referencing public.users
DO $$ BEGIN
  ALTER TABLE public.families 
    ADD CONSTRAINT fk_families_owner_parent 
    FOREIGN KEY (owner_parent_id) REFERENCES public.users(id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enforce one owned family per Parent invariant
DO $$ BEGIN
  ALTER TABLE public.families 
    ADD CONSTRAINT uq_families_owner_parent 
    UNIQUE (owner_parent_id);
EXCEPTION
  WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- 5. Family Link Requests Table
-- Manages pairing requests from children to parents with state audit.
CREATE TABLE IF NOT EXISTS public.family_link_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code TEXT NOT NULL REFERENCES public.families(family_code) ON DELETE CASCADE,
  parent_uid UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  child_uid UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  child_name TEXT NOT NULL,
  child_email TEXT,
  status public.request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  responded_at TIMESTAMPTZ
);

-- 6. Child Profiles Table
-- Monitored child configurations managed by parents (screen time, app limits).
CREATE TABLE IF NOT EXISTS public.child_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  child_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  age INTEGER NOT NULL DEFAULT 10,
  avatar TEXT,
  screen_time_limit INTEGER NOT NULL DEFAULT 120,
  screen_time_used INTEGER NOT NULL DEFAULT 0,
  device_locked BOOLEAN NOT NULL DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  app_limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  categories_blocked TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Devices Table
-- Companion device telemetry state (GPS coordinates, battery, lock status).
CREATE TABLE IF NOT EXISTS public.devices (
  device_id TEXT PRIMARY KEY,
  device_name TEXT NOT NULL,
  device_model TEXT,
  android_version TEXT,
  battery INTEGER NOT NULL DEFAULT 100,
  charging BOOLEAN NOT NULL DEFAULT FALSE,
  online BOOLEAN NOT NULL DEFAULT TRUE,
  gps JSONB NOT NULL DEFAULT '{"lat": 0, "lng": 0, "name": "Unknown"}'::jsonb,
  screen_on BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  connection_quality TEXT DEFAULT 'strong',
  sos_active BOOLEAN NOT NULL DEFAULT FALSE,
  parent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  child_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  family_code TEXT REFERENCES public.families(family_code) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Emergency SOS Alerts Table
-- Critical safety distress alerts.
-- ON DELETE RESTRICT on child_id and SET NULL on parent/family guarantees emergency audit records are preserved.
CREATE TABLE IF NOT EXISTS public.sos_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  child_name TEXT NOT NULL,
  parent_uid UUID REFERENCES public.users(id) ON DELETE SET NULL,
  family_code TEXT REFERENCES public.families(family_code) ON DELETE SET NULL,
  location JSONB NOT NULL DEFAULT '{"lat": 0, "lng": 0, "name": "Unknown"}'::jsonb,
  status public.sos_status NOT NULL DEFAULT 'active',
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Activity Logs Table
-- Safety activity event stream. ON DELETE SET NULL preserves historical activity audit.
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  child_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  detail TEXT NOT NULL,
  app TEXT,
  duration INTEGER,
  category TEXT,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. Dangerous Events Table
-- Neural security threat / phishing / out-of-bounds telemetry.
CREATE TABLE IF NOT EXISTS public.dangerous_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  child_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  target TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 90,
  reason TEXT,
  action_taken TEXT,
  suggested_action TEXT,
  status TEXT DEFAULT 'blocked',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. Safe Zones Table
-- Geofencing boundaries managed by parents.
CREATE TABLE IF NOT EXISTS public.safe_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  radius INTEGER NOT NULL DEFAULT 200,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. Chat Messages Table
-- Guardian AI Counselor conversation logs.
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  child_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  grounding_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. Homework Tasks Table
CREATE TABLE IF NOT EXISTS public.homework (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 14. Daily Goals Table
CREATE TABLE IF NOT EXISTS public.daily_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  target_minutes INTEGER NOT NULL DEFAULT 60,
  completed_minutes INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 15. System Configuration Table
-- Platform maintenance, gateway status, and feature flags.
CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 16. Audit Logs Table
-- System-level administrative and security audit trail.
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- DATABASE INDEXES FOR REALTIME & QUERY PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_parent_id ON public.users(parent_id);
CREATE INDEX IF NOT EXISTS idx_users_family_code ON public.users(family_code);

CREATE INDEX IF NOT EXISTS idx_families_owner ON public.families(owner_parent_id);

CREATE INDEX IF NOT EXISTS idx_link_requests_parent ON public.family_link_requests(parent_uid);
CREATE INDEX IF NOT EXISTS idx_link_requests_child ON public.family_link_requests(child_uid);
CREATE INDEX IF NOT EXISTS idx_link_requests_status ON public.family_link_requests(status);

CREATE INDEX IF NOT EXISTS idx_child_profiles_parent ON public.child_profiles(parent_id);
CREATE INDEX IF NOT EXISTS idx_child_profiles_user ON public.child_profiles(child_user_id);

CREATE INDEX IF NOT EXISTS idx_devices_parent ON public.devices(parent_id);
CREATE INDEX IF NOT EXISTS idx_devices_child ON public.devices(child_id);
CREATE INDEX IF NOT EXISTS idx_devices_family ON public.devices(family_code);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_status ON public.sos_alerts(status);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_child ON public.sos_alerts(child_id);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_parent ON public.sos_alerts(parent_uid);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_family ON public.sos_alerts(family_code);

CREATE INDEX IF NOT EXISTS idx_activity_logs_parent ON public.activity_logs(parent_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_child ON public.activity_logs(child_id);

CREATE INDEX IF NOT EXISTS idx_dangerous_events_parent ON public.dangerous_events(parent_id);
CREATE INDEX IF NOT EXISTS idx_safe_zones_parent ON public.safe_zones(parent_id);
CREATE INDEX IF NOT EXISTS idx_homework_child ON public.homework(child_id);
CREATE INDEX IF NOT EXISTS idx_daily_goals_child ON public.daily_goals(child_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);

-- ==============================================================================
-- SECURITY DEFINER HELPER FUNCTIONS (Strict search_path = '' and Qualified Names)
-- ==============================================================================

-- Admin status verification: checks trusted verified email and public.users role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_uid UUID;
  caller_email TEXT;
  user_role_val public.user_role;
  is_verified BOOLEAN;
BEGIN
  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Check verified email status from trusted server-level claims only (never user_metadata)
  caller_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  is_verified := COALESCE(
    (auth.jwt() ->> 'email_verified')::boolean,
    (auth.jwt() -> 'app_metadata' ->> 'provider') = 'google',
    FALSE
  );

  -- 2. Verify authoritative role in public.users
  SELECT role INTO user_role_val FROM public.users WHERE id = caller_uid AND disabled = FALSE;
  IF user_role_val = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- 3. Trusted admin email with verified identity fallback
  IF caller_email IN ('elijahstephenpaul03@gmail.com', 'admin@guardianai.io', 'admin@guardian.ai') AND is_verified THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Authoritative Active User Check (rejects disabled users in RLS)
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

-- Fetch current user's role safely
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS public.user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_uid UUID;
  user_role_val public.user_role;
BEGIN
  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO user_role_val FROM public.users WHERE id = caller_uid;
  RETURN user_role_val;
END;
$$;

-- Fetch parent ID for authenticated caller (bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.get_my_parent_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT parent_id FROM public.users WHERE id = auth.uid();
$$;

-- Fetch family code for authenticated caller (bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.get_my_family_code()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT family_code FROM public.users WHERE id = auth.uid();
$$;

-- Verify if a given child UUID belongs to the authenticated parent (bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.is_my_child(c_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = c_id AND parent_id = auth.uid());
$$;

-- ==============================================================================
-- TRUSTED USER REGISTRATION & ROLE ASSIGNMENT TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested_role_text TEXT;
  assigned_role public.user_role;
  user_email TEXT;
  user_full_name TEXT;
  is_email_verified BOOLEAN;
BEGIN
  user_email := LOWER(COALESCE(NEW.email, ''));
  requested_role_text := LOWER(COALESCE(NEW.raw_user_meta_data ->> 'role', ''));
  user_full_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'fullName', '');

  -- Authoritative identity verification:
  -- Only trust server-managed email_confirmed_at or server-managed raw_app_meta_data.
  -- NEVER trust client-supplied raw_user_meta_data for verification or role authorization!
  is_email_verified := (NEW.email_confirmed_at IS NOT NULL) OR 
                       (COALESCE(NEW.raw_app_meta_data ->> 'provider', '') = 'google' AND NEW.email_confirmed_at IS NOT NULL);

  -- 1. Trusted Role Assignment Logic:
  -- Admin role is strictly restricted to trusted email addresses WITH verified identity
  IF user_email IN ('elijahstephenpaul03@gmail.com', 'admin@guardianai.io', 'admin@guardian.ai') THEN
    IF is_email_verified THEN
      assigned_role := 'admin';
    ELSE
      -- Unverified admin emails start as parent until email verification is completed
      assigned_role := 'parent';
    END IF;
  ELSIF requested_role_text = 'child' THEN
    assigned_role := 'child';
  ELSIF requested_role_text = 'parent' THEN
    assigned_role := 'parent';
  ELSE
    assigned_role := 'parent';
  END IF;

  -- 2. Insert into public.users
  INSERT INTO public.users (
    id,
    email,
    full_name,
    display_name,
    role,
    family_code,
    parent_id,
    disabled,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    user_full_name,
    user_full_name,
    assigned_role,
    NULL,
    NULL,
    FALSE,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = timezone('utc'::text, now());

  RETURN NEW;
END;
$$;

-- Trigger attached to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- ROLE & RELATIONSHIP MUTATION PROTECTION TRIGGER
-- ==============================================================================
-- Prevents users from escalating roles or tampering with parent_id / family_code.
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_user_mutations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- 1. Internal system context (auth.uid() IS NULL) or Administrator bypass
  IF auth.uid() IS NULL OR public.is_admin() THEN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
  END IF;

  -- 2. Role escalation protection: Non-admins cannot alter user roles
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Unauthorized: Users cannot modify user roles. Administrator privileges required.';
  END IF;

  -- 3. Account disablement protection: Only admins can disable user accounts
  IF OLD.disabled IS DISTINCT FROM NEW.disabled THEN
    RAISE EXCEPTION 'Unauthorized: Users cannot modify account status.';
  END IF;

  -- 4. Child parent_id protection: Children cannot arbitrarily reassign their parent_id
  IF OLD.role = 'child' AND OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
    -- Only allow if the new parent_id matches the authenticated caller (authorized parent adoption/unlinking)
    IF auth.uid() IS DISTINCT FROM NEW.parent_id AND auth.uid() IS DISTINCT FROM OLD.parent_id THEN
      RAISE EXCEPTION 'Unauthorized: Cannot reassign child parent link without authorized parental confirmation.';
    END IF;
  END IF;

  -- 5. Permanent Parent Family Code protection: Once set, a parent's family_code is permanent and immutable
  IF OLD.role = 'parent' AND OLD.family_code IS NOT NULL AND NEW.family_code IS DISTINCT FROM OLD.family_code THEN
    RAISE EXCEPTION 'Permanent invariant violation: Parent family_code is permanent and cannot be modified or cleared.';
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_mutations ON public.users;
CREATE TRIGGER trg_protect_user_mutations
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unauthorized_user_mutations();

-- ==============================================================================
-- PERMANENT FAMILY CODE & OWNERSHIP PROTECTION TRIGGER
-- ==============================================================================
-- Guarantees public.families.family_code and owner_parent_id are strictly immutable.
CREATE OR REPLACE FUNCTION public.prevent_family_code_mutations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- family_code is the permanent primary key and can NEVER be changed
  IF OLD.family_code IS DISTINCT FROM NEW.family_code THEN
    RAISE EXCEPTION 'Permanent invariant violation: Family code "%" is immutable and can never be changed.', OLD.family_code;
  END IF;

  -- owner_parent_id cannot be changed unless by explicit administrator operation
  IF OLD.owner_parent_id IS DISTINCT FROM NEW.owner_parent_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permanent invariant violation: Family owner_parent_id is permanent and cannot be modified automatically.';
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_family_mutations ON public.families;
CREATE TRIGGER trg_protect_family_mutations
  BEFORE UPDATE ON public.families
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_family_code_mutations();

-- ==============================================================================
-- AUTHORITATIVE SOS EMERGENCY INTEGRITY TRIGGER
-- ==============================================================================
-- Strictly validates SOS creation and guarantees resolution can only be performed
-- by the verified linked parent or admin (Zero child self-clear).
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
  caller_id := auth.uid();
  -- Internal system context (foreign key triggers, cascade/set null updates)
  IF caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO caller_role FROM public.users WHERE id = caller_id;

  -- -------------------------------------------------------------
  -- INSERT: SOS Creation Verification
  -- -------------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    IF caller_role = 'child' THEN
      -- Child can ONLY create SOS for themselves
      IF NEW.child_id <> caller_id THEN
        RAISE EXCEPTION 'Child users are strictly permitted to trigger emergency SOS for themselves only.';
      END IF;

      -- Authoritatively resolve parent_uid and family_code from public.users to prevent spoofing
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
      -- Parent can only trigger SOS for an authorized linked child
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
      -- Admin override
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
    -- Disallow re-activating resolved distress signals
    IF OLD.status = 'resolved' AND NEW.status = 'active' THEN
      RAISE EXCEPTION 'Resolved emergency SOS alerts cannot be reopened.';
    END IF;

    IF NEW.status = 'resolved' THEN
      -- Zero child self-clear: Children can NEVER resolve their own distress alert
      IF caller_id = OLD.child_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Safety violation: Children are not permitted to resolve their own distress alerts.';
      END IF;

      -- Must be authorized parent or admin
      IF OLD.parent_uid <> caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Permission denied: Only the authorized linked parent or system administrator can resolve this alert.';
      END IF;

      NEW.resolved_by := caller_id;
      NEW.resolved_at := timezone('utc'::text, now());
    END IF;

    -- Guarantee immutable audit identifiers
    NEW.child_id := OLD.child_id;
    NEW.parent_uid := OLD.parent_uid;
    NEW.family_code := OLD.family_code;
    NEW.created_at := OLD.created_at;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_sos_integrity ON public.sos_alerts;
CREATE TRIGGER trg_enforce_sos_integrity
  BEFORE INSERT OR UPDATE ON public.sos_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sos_integrity();

-- ==============================================================================
-- AUTHORITATIVE CHILD DEVICE INTEGRITY TRIGGER
-- ==============================================================================
-- Strictly validates companion device registrations and guarantees:
-- 1. child_id must strictly equal auth.uid() for Child registrations.
-- 2. parent_id must be authoritatively resolved from public.users.parent_id (zero spoofing).
-- 3. family_code must be authoritatively resolved from public.users.family_code.
-- 4. Unlinked children (parent_id IS NULL) are rejected.
-- 5. Disabled accounts are rejected.
-- 6. Parents can only manage devices for their linked children.
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

  ELSIF caller_rec.role = 'parent' THEN
    -- Parents can only register/update devices for their own linked children
    IF NEW.child_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.child_id AND parent_id = caller_id) THEN
        RAISE EXCEPTION 'Parents can only manage devices for their verified linked children.';
      END IF;
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

-- ==============================================================================
-- EMAIL CONFIRMATION UPGRADE TRIGGER
-- ==============================================================================
-- Promotes pre-authorized admin emails to admin ONLY after verification in auth.users
CREATE OR REPLACE FUNCTION public.handle_user_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    IF LOWER(NEW.email) IN ('elijahstephenpaul03@gmail.com', 'admin@guardianai.io', 'admin@guardian.ai') THEN
      UPDATE public.users 
      SET role = 'admin', updated_at = timezone('utc'::text, now()) 
      WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_confirmation();

-- ==============================================================================
-- RESTRICTED FUNCTION EXECUTION PERMISSIONS
-- ==============================================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_user_confirmation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_unauthorized_user_mutations() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_family_code_mutations() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_sos_integrity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_device_integrity() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_auth_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_parent_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_parent_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_family_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_family_code() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_my_child(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_child(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_active_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;

