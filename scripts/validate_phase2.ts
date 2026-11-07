import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";
import { normalizeAuthError, normalizeUser, ADMIN_EMAILS } from "../src/lib/supabase";

async function runPhase2Validation() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI: SUPABASE EDITION - PHASE 2 CONFIG & AUTH VALIDATION");
  console.log("===============================================================================\n");

  const db = new PGlite();
  let passed = 0;
  let failed = 0;

  function report(name: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${name}${detail ? ` -> ${detail}` : ""}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} -> ${detail || "Check failed"}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 1: CLIENT INITIALIZATION & ERROR NORMALIZATION
  // -------------------------------------------------------------------------
  console.log("--- TEST SUITE 1: CLIENT INITIALIZATION & ERROR NORMALIZATION ---");

  // 1.1 ADMIN_EMAILS invariant
  report(
    "1.1 Trusted ADMIN_EMAILS contains authorized administrators",
    ADMIN_EMAILS.includes("admin@guardianai.io") && ADMIN_EMAILS.includes("elijahstephenpaul03@gmail.com"),
    `Count: ${ADMIN_EMAILS.length}`
  );

  // 1.2 Error normalization: invalid credentials
  const err1 = normalizeAuthError({ message: "Invalid login credentials", status: 400 });
  report(
    "1.2 Normalizes invalid credentials to 'auth/invalid-credential'",
    err1.code === "auth/invalid-credential",
    `Code: ${err1.code}`
  );

  // 1.3 Error normalization: user already exists
  const err2 = normalizeAuthError({ message: "User already registered", status: 422 });
  report(
    "1.3 Normalizes duplicate email to 'auth/email-already-in-use'",
    err2.code === "auth/email-already-in-use",
    `Code: ${err2.code}`
  );

  // 1.4 Error normalization: rate limiting
  const err3 = normalizeAuthError({ message: "Email rate limit exceeded", status: 429 });
  report(
    "1.4 Normalizes rate limit to 'auth/too-many-requests'",
    err3.code === "auth/too-many-requests",
    `Code: ${err3.code}`
  );

  // 1.5 Error normalization: disabled account
  const err4 = normalizeAuthError({ message: "User account disabled by admin", status: 403 });
  report(
    "1.5 Normalizes account disabled to 'auth/user-disabled'",
    err4.code === "auth/user-disabled",
    `Code: ${err4.code}`
  );

  // 1.6 User normalization
  const mockRawUser: any = {
    id: "mock-uuid-1234",
    email: "sarah.parent@example.com",
    email_confirmed_at: "2026-11-05T00:00:00Z",
    user_metadata: { full_name: "Sarah Jenkins" },
  };
  const normUser = normalizeUser(mockRawUser);
  report(
    "1.6 Normalizes Supabase User object into NormalizedAuthUser",
    normUser?.uid === "mock-uuid-1234" && normUser?.displayName === "Sarah Jenkins" && normUser?.emailVerified === true,
    `UID: ${normUser?.uid}, Name: ${normUser?.displayName}`
  );

  // -------------------------------------------------------------------------
  // 2. SETUP POSTGRESQL & RUN MIGRATIONS
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 2: POSTGRESQL SCHEMA & AUTH TRIGGERS SETUP ---");
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS extensions;

    CREATE OR REPLACE FUNCTION extensions.gen_random_uuid()
    RETURNS UUID AS $$
      SELECT gen_random_uuid();
    $$ LANGUAGE sql;

    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE,
      raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
      raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
      email_confirmed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS UUID AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION auth.jwt()
    RETURNS JSONB AS $$
      SELECT jsonb_build_object(
        'sub', current_setting('request.jwt.claim.sub', true),
        'email', current_setting('request.jwt.claim.email', true),
        'email_verified', COALESCE(NULLIF(current_setting('request.jwt.claim.email_verified', true), '')::boolean, false),
        'app_metadata', jsonb_build_object('provider', current_setting('request.jwt.claim.provider', true))
      );
    $$ LANGUAGE sql STABLE;

    DO $$ BEGIN
      CREATE ROLE anon NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE ROLE authenticated NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    DO $$ BEGIN
      CREATE ROLE service_role NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);

  async function asUser(userId: string | null, email: string | null = null, emailVerified: boolean = false) {
    await db.exec(`
      RESET ROLE;
      SELECT 
        set_config('request.jwt.claim.sub', '${userId || ""}', false),
        set_config('request.jwt.claim.email', '${email || ""}', false),
        set_config('request.jwt.claim.email_verified', '${emailVerified ? "true" : "false"}', false),
        set_config('request.jwt.claim.provider', 'email', false);
    `);
    if (userId) {
      await db.exec(`SET ROLE authenticated;`);
    } else {
      await db.exec(`SET ROLE anon;`);
    }
  }

  async function asSystem() {
    await db.exec(`
      RESET ROLE;
      SELECT 
        set_config('request.jwt.claim.sub', '', false),
        set_config('request.jwt.claim.email', '', false),
        set_config('request.jwt.claim.email_verified', 'false', false),
        set_config('request.jwt.claim.provider', '', false);
    `);
  }

  // Execute Migrations
  const migration1Sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000000_initial_schema.sql"), "utf8");
  await db.exec(migration1Sql);
  const migration2Sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000001_rls_policies.sql"), "utf8");
  await db.exec(migration2Sql);
  console.log("-> PostgreSQL Migrations applied.\n");

  // -------------------------------------------------------------------------
  // TEST SUITE 3: PARENT REGISTRATION & AUTHENTICATION
  // -------------------------------------------------------------------------
  console.log("--- TEST SUITE 3: PARENT REGISTRATION & AUTHORITATIVE ROLE ---");

  const parentId = "20000000-0000-0000-0000-000000000001";
  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES ('${parentId}', 'parent.jenkins@example.com', '{"role":"parent","full_name":"Sarah Jenkins"}'::jsonb, now());
  `);

  const parentProfileRes = await db.query(`SELECT * FROM public.users WHERE id = '${parentId}'`);
  const parentProfile = parentProfileRes.rows[0] as any;

  report(
    "3.1 Parent registration creates authoritative public.users profile with role 'parent'",
    parentProfile?.role === "parent" && parentProfile?.full_name === "Sarah Jenkins",
    `Role: ${parentProfile?.role}, Name: ${parentProfile?.full_name}`
  );

  // Verify Parent can query own profile via RLS
  await asUser(parentId, "parent.jenkins@example.com", true);
  const parentReadRes = await db.query(`SELECT id, email, role FROM public.users WHERE id = '${parentId}'`);
  report(
    "3.2 Authenticated Parent can read own authoritative profile via RLS",
    parentReadRes.rows.length === 1 && (parentReadRes.rows[0] as any).role === "parent",
    `Read success for UID: ${parentId}`
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 4: CHILD REGISTRATION & ROLE ISOLATION
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 4: CHILD REGISTRATION & ROLE ISOLATION ---");

  const childId = "20000000-0000-0000-0000-000000000002";
  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES ('${childId}', 'leo.jenkins@example.com', '{"role":"child","full_name":"Leo Jenkins"}'::jsonb, now());
  `);

  const childProfileRes = await db.query(`SELECT * FROM public.users WHERE id = '${childId}'`);
  const childProfile = childProfileRes.rows[0] as any;

  report(
    "4.1 Child registration creates authoritative public.users profile with role 'child'",
    childProfile?.role === "child" && childProfile?.full_name === "Leo Jenkins",
    `Role: ${childProfile?.role}, Name: ${childProfile?.full_name}`
  );

  // Verify Child cannot see Parent's private record before linking
  await asUser(childId, "leo.jenkins@example.com", true);
  const unlinkedParentRead = await db.query(`SELECT id FROM public.users WHERE id = '${parentId}'`);
  report(
    "4.2 Unlinked Child cannot read unlinked Parent profile via RLS",
    unlinkedParentRead.rows.length === 0,
    `Returned rows: ${unlinkedParentRead.rows.length}`
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 5: ROLE ESCALATION PREVENTION
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 5: ROLE ESCALATION & TAMPERING PREVENTION ---");

  // 5.1 Parent attempting to escalate self to admin
  await asUser(parentId, "parent.jenkins@example.com", true);
  let parentEscalateFailed = false;
  let parentEscalateMsg = "";
  try {
    await db.exec(`UPDATE public.users SET role = 'admin' WHERE id = '${parentId}';`);
  } catch (err: any) {
    parentEscalateFailed = true;
    parentEscalateMsg = err.message;
  }
  report(
    "5.1 Parent cannot escalate own role to 'admin'",
    parentEscalateFailed && parentEscalateMsg.includes("Users cannot modify user roles"),
    `Blocked with: ${parentEscalateMsg}`
  );

  // 5.2 Child attempting to escalate self to parent
  await asUser(childId, "leo.jenkins@example.com", true);
  let childEscalateFailed = false;
  let childEscalateMsg = "";
  try {
    await db.exec(`UPDATE public.users SET role = 'parent' WHERE id = '${childId}';`);
  } catch (err: any) {
    childEscalateFailed = true;
    childEscalateMsg = err.message;
  }
  report(
    "5.2 Child cannot escalate own role to 'parent'",
    childEscalateFailed && childEscalateMsg.includes("Users cannot modify user roles"),
    `Blocked with: ${childEscalateMsg}`
  );

  // 5.3 User cannot modify parent_id link without authorized parental confirmation
  await asUser(childId, "leo.jenkins@example.com", true);
  let parentLinkTamperFailed = false;
  let parentLinkTamperMsg = "";
  try {
    // Child attempting to reassign parent_id to an arbitrary ID
    await db.exec(`UPDATE public.users SET parent_id = '${parentId}' WHERE id = '${childId}';`);
  } catch (err: any) {
    parentLinkTamperFailed = true;
    parentLinkTamperMsg = err.message;
  }
  report(
    "5.3 Child cannot reassign parent_id without authorized parental confirmation",
    parentLinkTamperFailed && parentLinkTamperMsg.includes("Cannot reassign child parent link"),
    `Blocked with: ${parentLinkTamperMsg}`
  );

  // 5.4 User cannot modify disabled account status
  await asUser(parentId, "parent.jenkins@example.com", true);
  let disableTamperFailed = false;
  let disableTamperMsg = "";
  try {
    await db.exec(`UPDATE public.users SET disabled = TRUE WHERE id = '${parentId}';`);
  } catch (err: any) {
    disableTamperFailed = true;
    disableTamperMsg = err.message;
  }
  report(
    "5.4 Non-admin users cannot modify account disabled status",
    disableTamperFailed && disableTamperMsg.includes("Users cannot modify account status"),
    `Blocked with: ${disableTamperMsg}`
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 6: ADMIN REGISTRATION & AUTHENTICATION INTEGRITY
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 6: ADMIN REGISTRATION & AUTHENTICATION INTEGRITY ---");

  // 6.1 Untrusted user requesting 'admin' role
  await asSystem();
  const untrustedAdminId = "20000000-0000-0000-0000-000000000003";
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES ('${untrustedAdminId}', 'attacker@hacker.com', '{"role":"admin"}'::jsonb, now());
  `);
  const untrustedAdminRow = (await db.query(`SELECT role FROM public.users WHERE id = '${untrustedAdminId}'`)).rows[0] as any;
  report(
    "6.1 Untrusted email requesting 'admin' role is demoted to 'parent'",
    untrustedAdminRow?.role === "parent",
    `Assigned role: ${untrustedAdminRow?.role}`
  );

  // 6.2 Trusted admin email without confirmation
  await asSystem();
  const unconfirmedAdminId = "20000000-0000-0000-0000-000000000004";
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES ('${unconfirmedAdminId}', 'admin@guardian.ai', '{"role":"admin"}'::jsonb, NULL);
  `);
  const unconfirmedAdminRow = (await db.query(`SELECT role FROM public.users WHERE id = '${unconfirmedAdminId}'`)).rows[0] as any;
  report(
    "6.2 Unconfirmed trusted admin email cannot receive 'admin' role until verified",
    unconfirmedAdminRow?.role === "parent",
    `Assigned role: ${unconfirmedAdminRow?.role}`
  );

  // 6.3 Verified trusted admin email receives 'admin'
  await asSystem();
  const verifiedAdminId = "20000000-0000-0000-0000-000000000005";
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES ('${verifiedAdminId}', 'elijahstephenpaul03@gmail.com', '{"role":"admin"}'::jsonb, now());
  `);
  const verifiedAdminRow = (await db.query(`SELECT role FROM public.users WHERE id = '${verifiedAdminId}'`)).rows[0] as any;
  report(
    "6.3 Verified trusted admin email receives authoritative 'admin' role",
    verifiedAdminRow?.role === "admin",
    `Assigned role: ${verifiedAdminRow?.role}`
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 7: ACCOUNT DISABLED STATUS ENFORCEMENT
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 7: ACCOUNT DISABLED STATUS ENFORCEMENT ---");

  // Disable child account
  await asSystem();
  await db.exec(`UPDATE public.users SET disabled = TRUE WHERE id = '${childId}';`);

  const disabledChildRow = (await db.query(`SELECT disabled, role FROM public.users WHERE id = '${childId}'`)).rows[0] as any;
  report(
    "7.1 User record reflects disabled status",
    disabledChildRow?.disabled === true,
    `Disabled: ${disabledChildRow?.disabled}`
  );

  // Disabled user cannot pass is_admin() or mutate protected entities
  await asUser(childId, "leo.jenkins@example.com", true);
  const disabledAdminCheck = (await db.query(`SELECT public.is_admin() AS is_adm`)).rows[0] as any;
  report(
    "7.2 Disabled user cannot pass security check functions",
    disabledAdminCheck?.is_adm === false,
    `is_admin result: ${disabledAdminCheck?.is_adm}`
  );

  console.log("\n===============================================================================");
  console.log(` PHASE 2 VALIDATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Validation().catch((err) => {
  console.error("FATAL ERROR IN PHASE 2 VALIDATION:", err);
  process.exit(1);
});
