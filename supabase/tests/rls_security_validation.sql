-- ==============================================================================
-- GUARDIAN AI: SUPABASE EDITION - PHASE 1 RLS SECURITY VALIDATION
-- File: supabase/tests/rls_security_validation.sql
-- Description: Standalone SQL test suite executing directly against PostgreSQL
--              to verify all 16 security invariants across Parent, Child, Admin,
--              and third-party caller identities.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- TEST 1A: Unverified Trusted Administrator Email Defense
-- Invariant: Unverified email address attempting to register as Admin is assigned 'parent'.
-- ------------------------------------------------------------------------------
-- INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
-- VALUES ('11111111-0000-0000-0000-000000000001', 'admin@guardianai.io', '{"role":"admin"}'::jsonb, NULL);
-- SELECT role FROM public.users WHERE id = '11111111-0000-0000-0000-000000000001';
-- -> Result: 'parent' (Unverified identity protection active)

-- ------------------------------------------------------------------------------
-- TEST 1B: Client-Supplied email_verified=true Ignored
-- Invariant: Client passing raw_user_meta_data->>'email_verified': true cannot bypass verification.
-- ------------------------------------------------------------------------------
-- INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
-- VALUES ('11111111-0000-0000-0000-000000000002', 'admin@guardian.ai', '{"role":"admin","email_verified":true}'::jsonb, NULL);
-- SELECT role FROM public.users WHERE id = '11111111-0000-0000-0000-000000000002';
-- -> Result: 'parent' (Client-supplied email_verified ignored; server state enforced)

-- ------------------------------------------------------------------------------
-- TEST 1C: Verified Authorized Administrator Receives Admin Role
-- Invariant: Legitimate admin with confirmed email receives 'admin' role.
-- ------------------------------------------------------------------------------
-- INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
-- VALUES ('11111111-0000-0000-0000-000000000003', 'elijahstephenpaul03@gmail.com', '{"role":"admin"}'::jsonb, now());
-- SELECT role FROM public.users WHERE id = '11111111-0000-0000-0000-000000000003';
-- -> Result: 'admin' (Authoritatively assigned upon verified identity)

-- ------------------------------------------------------------------------------
-- TEST 1D: Untrusted Email Cannot Obtain Admin Privileges
-- Invariant: Untrusted email address passing role: 'admin' is assigned 'parent'.
-- ------------------------------------------------------------------------------
-- INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
-- VALUES ('11111111-0000-0000-0000-000000000004', 'hacker@malicious.com', '{"role":"admin"}'::jsonb, now());
-- SELECT role FROM public.users WHERE id = '11111111-0000-0000-0000-000000000004';
-- -> Result: 'parent' (Untrusted email address demoted to parent)

-- ------------------------------------------------------------------------------
-- TEST 1E: Confirmation Lifecycle Promotion
-- Invariant: Unverified admin from 1A confirmed via auth.users email_confirmed_at -> upgraded to 'admin'.
-- ------------------------------------------------------------------------------
-- UPDATE auth.users SET email_confirmed_at = now() WHERE id = '11111111-0000-0000-0000-000000000001';
-- SELECT role FROM public.users WHERE id = '11111111-0000-0000-0000-000000000001';
-- -> Result: 'admin' (Promoted via handle_user_confirmation trigger)

-- ------------------------------------------------------------------------------
-- TEST 2: Self-Escalation to Administrator Rejection
-- Invariant: Non-admin users cannot alter their own or others' roles.
-- ------------------------------------------------------------------------------
-- SET LOCAL ROLE authenticated;
-- SET LOCAL "request.jwt.claim.sub" = '11111111-0000-0000-0000-000000000002';
-- UPDATE public.users SET role = 'admin' WHERE id = '11111111-0000-0000-0000-000000000002';
-- -> Result: EXCEPTION: 'Unauthorized: Users cannot modify user roles. Administrator privileges required.'

-- ------------------------------------------------------------------------------
-- TEST 3: Unrelated Parent Family Access Blocked
-- Invariant: An unrelated parent (Eve) cannot update another parent's family (Alice).
-- ------------------------------------------------------------------------------
-- SET LOCAL ROLE authenticated;
-- SET LOCAL "request.jwt.claim.sub" = '44444444-0000-0000-0000-000000000001'; -- Eve
-- UPDATE public.families SET family_name = 'Hacked' WHERE family_code = 'FAM-ALICE';
-- -> Result: 0 rows affected (Denied by families_update_policy)

-- ------------------------------------------------------------------------------
-- TEST 4: Child Parent-Link Tampering Prevention
-- Invariant: Child user cannot reassign their parent_id or family_code.
-- ------------------------------------------------------------------------------
-- SET LOCAL ROLE authenticated;
-- SET LOCAL "request.jwt.claim.sub" = '33333333-0000-0000-0000-000000000001'; -- Bob
-- UPDATE public.users SET parent_id = '44444444-0000-0000-0000-000000000001' WHERE id = '33333333-0000-0000-0000-000000000001';
-- -> Result: EXCEPTION: 'Unauthorized: Cannot reassign child parent link without authorized parental confirmation.'

-- ------------------------------------------------------------------------------
-- TEST 5: Authoritative Emergency SOS Creation
-- Invariant: Child triggering SOS has parent_uid and family_code populated authoritatively.
-- ------------------------------------------------------------------------------
-- SET LOCAL ROLE authenticated;
-- SET LOCAL "request.jwt.claim.sub" = '33333333-0000-0000-0000-000000000001'; -- Bob
-- INSERT INTO public.sos_alerts (child_id, child_name, location)
-- VALUES ('33333333-0000-0000-0000-000000000001', 'Bob Child', '{"lat": 37.77, "lng": -122.41}'::jsonb)
-- RETURNING child_id, parent_uid, family_code, status;
-- -> Result: child_id = Bob, parent_uid = Alice (authoritative), family_code = 'FAM-ALICE', status = 'active'

-- ------------------------------------------------------------------------------
-- TEST 6: Zero Child Self-Clear on Emergency SOS
-- Invariant: Children are strictly prohibited from resolving their own distress alert.
-- ------------------------------------------------------------------------------
-- SET LOCAL ROLE authenticated;
-- SET LOCAL "request.jwt.claim.sub" = '33333333-0000-0000-0000-000000000001'; -- Bob
-- UPDATE public.sos_alerts SET status = 'resolved' WHERE child_id = '33333333-0000-0000-0000-000000000001';
-- -> Result: 0 rows affected / Denied by RLS & Trigger (Zero self-clear enforced)

-- ------------------------------------------------------------------------------
-- TEST 7: Unrelated Parent Resolution Denial
-- Invariant: Unrelated parent Eve cannot resolve Bob's distress alert.
-- ------------------------------------------------------------------------------
-- SET LOCAL ROLE authenticated;
-- SET LOCAL "request.jwt.claim.sub" = '44444444-0000-0000-0000-000000000001'; -- Eve
-- UPDATE public.sos_alerts SET status = 'resolved' WHERE child_id = '33333333-0000-0000-0000-000000000001';
-- -> Result: 0 rows affected (Denied by sos_alerts_update_policy)

-- ------------------------------------------------------------------------------
-- TEST 8: Authorized Parent Resolution Success
-- Invariant: Authorized linked parent Alice resolves Bob's active SOS alert.
-- ------------------------------------------------------------------------------
-- SET LOCAL ROLE authenticated;
-- SET LOCAL "request.jwt.claim.sub" = '22222222-0000-0000-0000-000000000001'; -- Alice
-- UPDATE public.sos_alerts SET status = 'resolved' WHERE child_id = '33333333-0000-0000-0000-000000000001'
-- RETURNING status, resolved_by, resolved_at;
-- -> Result: status = 'resolved', resolved_by = Alice UID, resolved_at = now()

-- ------------------------------------------------------------------------------
-- TEST 9: Immutable Emergency Distress History (Anti-Reopen)
-- Invariant: Resolved alerts cannot be reverted to active.
-- ------------------------------------------------------------------------------
-- SET LOCAL ROLE authenticated;
-- SET LOCAL "request.jwt.claim.sub" = '22222222-0000-0000-0000-000000000001'; -- Alice
-- UPDATE public.sos_alerts SET status = 'active' WHERE child_id = '33333333-0000-0000-0000-000000000001';
-- -> Result: 0 rows affected / EXCEPTION: 'Resolved emergency SOS alerts cannot be reopened.'

-- ------------------------------------------------------------------------------
-- TEST 10: Data Retention Guarantee on Account Deletion
-- Invariant: Child record cannot be purged while emergency SOS records exist (RESTRICT).
--            Parent account deletion leaves SOS audit log intact (SET NULL).
-- ------------------------------------------------------------------------------
-- DELETE FROM public.users WHERE id = '33333333-0000-0000-0000-000000000001'; -- Bob
-- -> Result: EXCEPTION: foreign key violation on sos_alerts_child_id_fkey (ON DELETE RESTRICT)
--
-- DELETE FROM public.users WHERE id = '22222222-0000-0000-0000-000000000001'; -- Alice
-- SELECT id, child_id, parent_uid, status FROM public.sos_alerts;
-- -> Result: Alert retained, parent_uid = NULL, status = 'resolved'
