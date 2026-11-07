-- ==============================================================================
-- GUARDIAN AI: INDEPENDENT SUPABASE EDITION - PHASE 1 RLS POLICIES
-- Migration: 20261105000001_rls_policies.sql
-- Description: Complete Row Level Security policies for all tables, protecting
--              Parent, Child, Admin, and third-party access vectors.
-- ==============================================================================

-- 1. Enable Row Level Security Across All Exposed Tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_link_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dangerous_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safe_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1b. Force Row Level Security (Guarantees policies apply to all roles)
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.families FORCE ROW LEVEL SECURITY;
ALTER TABLE public.family_link_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.child_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.devices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sos_alerts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dangerous_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.safe_zones FORCE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.homework FORCE ROW LEVEL SECURITY;
ALTER TABLE public.daily_goals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.system_config FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

-- 2. Explicit Database Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Anonymous users can only query system configuration (e.g. gateway status before login)
GRANT SELECT ON public.system_config TO anon;

-- Authenticated users have scoped operational access through RLS policies
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
REVOKE ALL ON public.audit_logs FROM anon;

-- ==============================================================================
-- 3. USERS TABLE POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
CREATE POLICY "users_select_policy"
  ON public.users FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR
    parent_id = auth.uid() OR
    id = public.get_my_parent_id() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
CREATE POLICY "users_insert_policy"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "users_update_policy" ON public.users;
CREATE POLICY "users_update_policy"
  ON public.users FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid() OR
    parent_id = auth.uid() OR
    public.is_admin()
  )
  WITH CHECK (
    id = auth.uid() OR
    parent_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "users_delete_policy" ON public.users;
CREATE POLICY "users_delete_policy"
  ON public.users FOR DELETE
  TO authenticated
  USING (
    id = auth.uid() OR
    public.is_admin()
  );

-- ==============================================================================
-- 4. FAMILIES TABLE POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "families_select_policy" ON public.families;
CREATE POLICY "families_select_policy"
  ON public.families FOR SELECT
  TO authenticated
  USING (
    owner_parent_id = auth.uid() OR
    family_code = public.get_my_family_code() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "families_insert_policy" ON public.families;
CREATE POLICY "families_insert_policy"
  ON public.families FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_parent_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "families_update_policy" ON public.families;
CREATE POLICY "families_update_policy"
  ON public.families FOR UPDATE
  TO authenticated
  USING (
    owner_parent_id = auth.uid() OR
    public.is_admin()
  )
  WITH CHECK (
    owner_parent_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "families_delete_policy" ON public.families;
CREATE POLICY "families_delete_policy"
  ON public.families FOR DELETE
  TO authenticated
  USING (
    owner_parent_id = auth.uid() OR
    public.is_admin()
  );

-- ==============================================================================
-- 5. FAMILY LINK REQUESTS TABLE POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "link_requests_select_policy" ON public.family_link_requests;
CREATE POLICY "link_requests_select_policy"
  ON public.family_link_requests FOR SELECT
  TO authenticated
  USING (
    child_uid = auth.uid() OR
    parent_uid = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "link_requests_insert_policy" ON public.family_link_requests;
CREATE POLICY "link_requests_insert_policy"
  ON public.family_link_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    child_uid = auth.uid() AND
    status = 'pending'
  );

DROP POLICY IF EXISTS "link_requests_update_policy" ON public.family_link_requests;
CREATE POLICY "link_requests_update_policy"
  ON public.family_link_requests FOR UPDATE
  TO authenticated
  USING (
    parent_uid = auth.uid() OR
    child_uid = auth.uid() OR
    public.is_admin()
  )
  WITH CHECK (
    (parent_uid = auth.uid() AND status IN ('accepted', 'rejected', 'disconnected', 'pending')) OR
    (child_uid = auth.uid() AND status IN ('pending', 'cancelled')) OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "link_requests_delete_policy" ON public.family_link_requests;
CREATE POLICY "link_requests_delete_policy"
  ON public.family_link_requests FOR DELETE
  TO authenticated
  USING (
    child_uid = auth.uid() OR
    parent_uid = auth.uid() OR
    public.is_admin()
  );

-- ==============================================================================
-- 6. CHILD PROFILES TABLE POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "child_profiles_select_policy" ON public.child_profiles;
CREATE POLICY "child_profiles_select_policy"
  ON public.child_profiles FOR SELECT
  TO authenticated
  USING (
    parent_id = auth.uid() OR
    child_user_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "child_profiles_insert_policy" ON public.child_profiles;
CREATE POLICY "child_profiles_insert_policy"
  ON public.child_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    parent_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "child_profiles_update_policy" ON public.child_profiles;
CREATE POLICY "child_profiles_update_policy"
  ON public.child_profiles FOR UPDATE
  TO authenticated
  USING (
    parent_id = auth.uid() OR
    public.is_admin()
  )
  WITH CHECK (
    parent_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "child_profiles_delete_policy" ON public.child_profiles;
CREATE POLICY "child_profiles_delete_policy"
  ON public.child_profiles FOR DELETE
  TO authenticated
  USING (
    parent_id = auth.uid() OR
    public.is_admin()
  );

-- ==============================================================================
-- 7. DEVICES TABLE POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "devices_select_policy" ON public.devices;
CREATE POLICY "devices_select_policy"
  ON public.devices FOR SELECT
  TO authenticated
  USING (
    public.is_active_user() AND (
      child_id = auth.uid() OR
      parent_id = auth.uid() OR
      public.is_admin()
    )
  );

DROP POLICY IF EXISTS "devices_insert_policy" ON public.devices;
CREATE POLICY "devices_insert_policy"
  ON public.devices FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_user() AND (
      child_id = auth.uid() OR
      parent_id = auth.uid() OR
      public.is_admin()
    )
  );

DROP POLICY IF EXISTS "devices_update_policy" ON public.devices;
CREATE POLICY "devices_update_policy"
  ON public.devices FOR UPDATE
  TO authenticated
  USING (
    public.is_active_user() AND (
      child_id = auth.uid() OR
      parent_id = auth.uid() OR
      public.is_admin()
    )
  )
  WITH CHECK (
    public.is_active_user() AND (
      child_id = auth.uid() OR
      parent_id = auth.uid() OR
      public.is_admin()
    )
  );

DROP POLICY IF EXISTS "devices_delete_policy" ON public.devices;
CREATE POLICY "devices_delete_policy"
  ON public.devices FOR DELETE
  TO authenticated
  USING (
    public.is_active_user() AND (
      child_id = auth.uid() OR
      parent_id = auth.uid() OR
      public.is_admin()
    )
  );

-- ==============================================================================
-- 8. EMERGENCY SOS ALERTS TABLE POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "sos_alerts_select_policy" ON public.sos_alerts;
CREATE POLICY "sos_alerts_select_policy"
  ON public.sos_alerts FOR SELECT
  TO authenticated
  USING (
    child_id = auth.uid() OR
    parent_uid = auth.uid() OR
    family_code = public.get_my_family_code() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "sos_alerts_insert_policy" ON public.sos_alerts;
CREATE POLICY "sos_alerts_insert_policy"
  ON public.sos_alerts FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Child self-creation or parent creation for authorized child, guarded further by trigger
    child_id = auth.uid() OR
    parent_uid = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "sos_alerts_update_policy" ON public.sos_alerts;
CREATE POLICY "sos_alerts_update_policy"
  ON public.sos_alerts FOR UPDATE
  TO authenticated
  USING (
    -- Only authorized parent or admin can resolve; child is explicitly forbidden
    (parent_uid = auth.uid() OR public.is_admin()) AND
    child_id <> auth.uid() AND
    status = 'active'
  )
  WITH CHECK (
    (parent_uid = auth.uid() OR public.is_admin()) AND
    child_id <> auth.uid() AND
    status = 'resolved' AND
    resolved_by = auth.uid()
  );

DROP POLICY IF EXISTS "sos_alerts_delete_policy" ON public.sos_alerts;
CREATE POLICY "sos_alerts_delete_policy"
  ON public.sos_alerts FOR DELETE
  TO authenticated
  USING (
    parent_uid = auth.uid() OR
    public.is_admin()
  );

-- ==============================================================================
-- 9. ACTIVITY LOGS TABLE POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "activity_logs_select_policy" ON public.activity_logs;
CREATE POLICY "activity_logs_select_policy"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (
    parent_id = auth.uid() OR
    child_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "activity_logs_insert_policy" ON public.activity_logs;
CREATE POLICY "activity_logs_insert_policy"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    parent_id = auth.uid() OR
    child_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "activity_logs_delete_policy" ON public.activity_logs;
CREATE POLICY "activity_logs_delete_policy"
  ON public.activity_logs FOR DELETE
  TO authenticated
  USING (
    parent_id = auth.uid() OR
    public.is_admin()
  );

-- ==============================================================================
-- 10. DANGEROUS EVENTS TABLE POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "dangerous_events_select_policy" ON public.dangerous_events;
CREATE POLICY "dangerous_events_select_policy"
  ON public.dangerous_events FOR SELECT
  TO authenticated
  USING (
    parent_id = auth.uid() OR
    child_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "dangerous_events_insert_policy" ON public.dangerous_events;
CREATE POLICY "dangerous_events_insert_policy"
  ON public.dangerous_events FOR INSERT
  TO authenticated
  WITH CHECK (
    parent_id = auth.uid() OR
    child_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "dangerous_events_delete_policy" ON public.dangerous_events;
CREATE POLICY "dangerous_events_delete_policy"
  ON public.dangerous_events FOR DELETE
  TO authenticated
  USING (
    parent_id = auth.uid() OR
    public.is_admin()
  );

-- ==============================================================================
-- 11. SAFE ZONES TABLE POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "safe_zones_select_policy" ON public.safe_zones;
CREATE POLICY "safe_zones_select_policy"
  ON public.safe_zones FOR SELECT
  TO authenticated
  USING (
    parent_id = auth.uid() OR
    parent_id = public.get_my_parent_id() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "safe_zones_insert_policy" ON public.safe_zones;
CREATE POLICY "safe_zones_insert_policy"
  ON public.safe_zones FOR INSERT
  TO authenticated
  WITH CHECK (
    parent_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "safe_zones_update_policy" ON public.safe_zones;
CREATE POLICY "safe_zones_update_policy"
  ON public.safe_zones FOR UPDATE
  TO authenticated
  USING (
    parent_id = auth.uid() OR
    public.is_admin()
  )
  WITH CHECK (
    parent_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "safe_zones_delete_policy" ON public.safe_zones;
CREATE POLICY "safe_zones_delete_policy"
  ON public.safe_zones FOR DELETE
  TO authenticated
  USING (
    parent_id = auth.uid() OR
    public.is_admin()
  );

-- ==============================================================================
-- 12. CHAT MESSAGES TABLE POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "chat_messages_select_policy" ON public.chat_messages;
CREATE POLICY "chat_messages_select_policy"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    parent_id = auth.uid() OR
    child_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "chat_messages_insert_policy" ON public.chat_messages;
CREATE POLICY "chat_messages_insert_policy"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    parent_id = auth.uid() OR
    child_id = auth.uid() OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "chat_messages_delete_policy" ON public.chat_messages;
CREATE POLICY "chat_messages_delete_policy"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (
    parent_id = auth.uid() OR
    child_id = auth.uid() OR
    public.is_admin()
  );

-- ==============================================================================
-- 13. HOMEWORK TABLE POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "homework_select_policy" ON public.homework;
CREATE POLICY "homework_select_policy"
  ON public.homework FOR SELECT
  TO authenticated
  USING (
    child_id = auth.uid() OR
    public.is_my_child(child_id) OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "homework_insert_policy" ON public.homework;
CREATE POLICY "homework_insert_policy"
  ON public.homework FOR INSERT
  TO authenticated
  WITH CHECK (
    child_id = auth.uid() OR
    public.is_my_child(child_id) OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "homework_update_policy" ON public.homework;
CREATE POLICY "homework_update_policy"
  ON public.homework FOR UPDATE
  TO authenticated
  USING (
    child_id = auth.uid() OR
    public.is_my_child(child_id) OR
    public.is_admin()
  )
  WITH CHECK (
    child_id = auth.uid() OR
    public.is_my_child(child_id) OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "homework_delete_policy" ON public.homework;
CREATE POLICY "homework_delete_policy"
  ON public.homework FOR DELETE
  TO authenticated
  USING (
    child_id = auth.uid() OR
    public.is_my_child(child_id) OR
    public.is_admin()
  );

-- ==============================================================================
-- 14. DAILY GOALS TABLE POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "daily_goals_select_policy" ON public.daily_goals;
CREATE POLICY "daily_goals_select_policy"
  ON public.daily_goals FOR SELECT
  TO authenticated
  USING (
    child_id = auth.uid() OR
    public.is_my_child(child_id) OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "daily_goals_insert_policy" ON public.daily_goals;
CREATE POLICY "daily_goals_insert_policy"
  ON public.daily_goals FOR INSERT
  TO authenticated
  WITH CHECK (
    child_id = auth.uid() OR
    public.is_my_child(child_id) OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "daily_goals_update_policy" ON public.daily_goals;
CREATE POLICY "daily_goals_update_policy"
  ON public.daily_goals FOR UPDATE
  TO authenticated
  USING (
    child_id = auth.uid() OR
    public.is_my_child(child_id) OR
    public.is_admin()
  )
  WITH CHECK (
    child_id = auth.uid() OR
    public.is_my_child(child_id) OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "daily_goals_delete_policy" ON public.daily_goals;
CREATE POLICY "daily_goals_delete_policy"
  ON public.daily_goals FOR DELETE
  TO authenticated
  USING (
    child_id = auth.uid() OR
    public.is_my_child(child_id) OR
    public.is_admin()
  );


-- ==============================================================================
-- 15. SYSTEM CONFIGURATION TABLE POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "system_config_select_policy" ON public.system_config;
CREATE POLICY "system_config_select_policy"
  ON public.system_config FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "system_config_admin_write" ON public.system_config;
CREATE POLICY "system_config_admin_write"
  ON public.system_config FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ==============================================================================
-- 16. AUDIT LOGS TABLE POLICIES
-- ==============================================================================
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_select_policy"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_policy"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL OR
    public.is_admin()
  );

DROP POLICY IF EXISTS "audit_logs_admin_modify" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_modify"
  ON public.audit_logs FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "audit_logs_admin_delete" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_delete"
  ON public.audit_logs FOR DELETE
  TO authenticated
  USING (public.is_admin());
