# Guardian AI: Supabase Edition – Architecture & Security Model (Phase 1)

## 1. Relational Entities & Hierarchy
- `public.users`: Mirrors `auth.users`, maintains strictly checked `role` (`'admin' | 'parent' | 'child'`), `family_code`, and `parent_id`.
- `public.families`: Family container referencing `owner_parent_id`. `ON DELETE RESTRICT` protects against accidental deletion of the family tree.
- `public.family_link_requests`: Tracks child-to-parent pairing requests with auditable states (`pending`, `accepted`, `rejected`, `cancelled`, `disconnected`).
- `public.child_profiles`: Monitored child configurations (screen time limits, lock flags, application restrictions).
- `public.devices`: Companion device telemetry (GPS, battery, screen status, connection quality).
- `public.sos_alerts`: Emergency distress signals. Enforces immutable child, parent, and family relationships with `ON DELETE RESTRICT` and `ON DELETE SET NULL`.
- `public.activity_logs`: Chronological telemetry of internet, gaming, and app usage.
- `public.dangerous_events`: AI-flagged threats, phishing, and geofence boundary events.
- `public.safe_zones`: Geofencing coordinates and radiuses.
- `public.chat_messages`: Guardian AI Counselor dialogues.
- `public.homework`: Child homework assignments with completion toggles.
- `public.daily_goals`: Daily health and study goals.
- `public.system_config`: Platform status, feature flags, and maintenance toggles.
- `public.audit_logs`: Security and administrative audit trail.

---

## 2. Core Security Invariants (Phase 1 Corrections)

### 2.1 User Role Security
- **No Default Assumption**: Removed `DEFAULT 'parent'` on `public.users.role`.
- **Registration Verification**: `public.handle_new_user()` trigger strictly validates incoming metadata. The `'admin'` role is granted only to verified trusted email addresses (`elijahstephenpaul03@gmail.com`, `admin@guardianai.io`, `admin@guardian.ai`). Any unverified admin request is demoted to `'parent'`.
- **Role Escalation Block**: `public.prevent_unauthorized_user_mutations()` trigger rejects any client attempt to modify `role` or `disabled` status.
- **Link Integrity**: Children cannot modify `parent_id` or `family_code` without authorized parent confirmation.

### 2.2 Hardened Admin Security
- `public.is_admin()` and all helper functions are declared `SECURITY DEFINER` with `SET search_path = ''`.
- All table and function calls are fully schema-qualified (`public.users`, `auth.uid()`, etc.) to prevent search-path hijacking.
- Admin status is verified via authenticated JWT claims or internal database state.

### 2.3 Authoritative Emergency SOS
- **Creation**:
  - A child user can ONLY create an SOS alert for themselves (`child_id = auth.uid()`). The trigger authoritatively injects their verified `parent_id` and `family_code` from `public.users`.
  - A parent can ONLY create an SOS alert for an authorized linked child (`parent_id = auth.uid()`).
- **Resolution**:
  - The trigger and RLS policy forbid children from resolving distress alerts (Zero child self-clear).
  - Only the authorized linked parent (`parent_uid = auth.uid()`) or an admin can resolve an active alert.
  - Setting `status = 'resolved'` automatically stamps `resolved_by = auth.uid()` and `resolved_at = now()`.

### 2.4 Data Retention & Anti-Purge Protection
- `public.sos_alerts.child_id` uses `ON DELETE RESTRICT`, preventing accidental removal of users while emergency records exist.
- `parent_uid` and `family_code` use `ON DELETE SET NULL` so that emergency audit logs remain permanently preserved even if family links change.
- `public.audit_logs.user_id` uses `ON DELETE SET NULL`.
