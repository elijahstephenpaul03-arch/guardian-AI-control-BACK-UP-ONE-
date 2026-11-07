import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";

async function runPhase1Validation() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI: SUPABASE EDITION - PHASE 1 ACTUAL POSTGRESQL VALIDATION");
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

  // 1. Setup Supabase Auth Mock Environment in PostgreSQL
  console.log("-> 1. Bootstrapping Supabase Auth environment in PostgreSQL...");
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS extensions;

    -- Emulate extensions.gen_random_uuid
    CREATE OR REPLACE FUNCTION extensions.gen_random_uuid()
    RETURNS UUID AS $$
      SELECT gen_random_uuid();
    $$ LANGUAGE sql;

    -- Emulate Supabase auth.users
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE,
      raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
      raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
      email_confirmed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Emulate Supabase auth.uid() and auth.jwt()
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

    -- Emulate supabase role 'authenticated' and 'anon'
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
  console.log("-> Supabase Auth schema & roles ready.\n");

  // Helper to switch session context
  async function asUser(userId: string | null, email: string | null = null, emailVerified: boolean = false, provider: string = "email") {
    await db.exec(`
      RESET ROLE;
      SELECT 
        set_config('request.jwt.claim.sub', '${userId || ""}', false),
        set_config('request.jwt.claim.email', '${email || ""}', false),
        set_config('request.jwt.claim.email_verified', '${emailVerified ? "true" : "false"}', false),
        set_config('request.jwt.claim.provider', '${provider}', false);
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

  // 2. Load and Apply Migration 1 (Initial Schema)
  console.log("-> 2. Executing Migration 1: 20261105000000_initial_schema.sql...");
  const migration1Sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000000_initial_schema.sql"), "utf8");
  await db.exec(migration1Sql);
  console.log("-> Migration 1 applied successfully.\n");

  // 3. Load and Apply Migration 2 (RLS Policies)
  console.log("-> 3. Executing Migration 2: 20261105000001_rls_policies.sql...");
  const migration2Sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000001_rls_policies.sql"), "utf8");
  await db.exec(migration2Sql);
  console.log("-> Migration 2 applied successfully.\n");

  // -------------------------------------------------------------------------
  // TEST SUITE 1: ADMIN REGISTRATION & TRUSTED IDENTITY
  // -------------------------------------------------------------------------
  console.log("--- TEST SUITE 1: ADMIN REGISTRATION & IDENTITY VERIFICATION ---");
  
  // 1.1 An unverified trusted email cannot become Admin
  await asSystem();
  const unverifiedAdminId = "11111111-0000-0000-0000-000000000001";
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES ('${unverifiedAdminId}', 'admin@guardianai.io', '{"role":"admin"}'::jsonb, NULL);
  `);
  const unverifiedAdminRow = (await db.query(`SELECT role FROM public.users WHERE id = '${unverifiedAdminId}'`)).rows[0] as any;
  report(
    "1.1 An unverified trusted email cannot become Admin",
    unverifiedAdminRow?.role === "parent",
    `Assigned role: ${unverifiedAdminRow?.role}`
  );

  // 1.2 User-supplied email_verified=true cannot grant Admin
  await asSystem();
  const spoofVerifiedAdminId = "11111111-0000-0000-0000-000000000002";
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES ('${spoofVerifiedAdminId}', 'admin@guardian.ai', '{"role":"admin","email_verified":true}'::jsonb, NULL);
  `);
  const spoofVerifiedRow = (await db.query(`SELECT role FROM public.users WHERE id = '${spoofVerifiedAdminId}'`)).rows[0] as any;
  report(
    "1.2 User-supplied email_verified=true cannot grant Admin",
    spoofVerifiedRow?.role === "parent",
    `Assigned role: ${spoofVerifiedRow?.role} (Client spoof ignored)`
  );

  // 1.3 A verified authorized administrator can receive Admin privileges
  await asSystem();
  const verifiedAdminId = "11111111-0000-0000-0000-000000000003";
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES ('${verifiedAdminId}', 'elijahstephenpaul03@gmail.com', '{"role":"admin"}'::jsonb, now());
  `);
  const verifiedAdminRow = (await db.query(`SELECT role FROM public.users WHERE id = '${verifiedAdminId}'`)).rows[0] as any;
  report(
    "1.3 A verified authorized administrator can receive Admin privileges",
    verifiedAdminRow?.role === "admin",
    `Assigned role: ${verifiedAdminRow?.role}`
  );

  // 1.4 An untrusted email cannot obtain Admin privileges
  await asSystem();
  const attackerId = "11111111-0000-0000-0000-000000000004";
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES ('${attackerId}', 'hacker@malicious.com', '{"role":"admin","email_verified":true}'::jsonb, now());
  `);
  const attackerRow = (await db.query(`SELECT role FROM public.users WHERE id = '${attackerId}'`)).rows[0] as any;
  report(
    "1.4 An untrusted email cannot obtain Admin privileges",
    attackerRow?.role === "parent",
    `Assigned role: ${attackerRow?.role}`
  );

  // 1.5 Administrator confirmation lifecycle: unverified trusted email confirms later -> upgraded to admin
  await asSystem();
  await db.exec(`
    UPDATE auth.users 
    SET email_confirmed_at = now() 
    WHERE id = '${unverifiedAdminId}';
  `);
  const upgradedAdminRow = (await db.query(`SELECT role FROM public.users WHERE id = '${unverifiedAdminId}'`)).rows[0] as any;
  report(
    "1.5 Administrator confirmation lifecycle promotes unverified admin upon email confirmation",
    upgradedAdminRow?.role === "admin",
    `Updated role: ${upgradedAdminRow?.role}`
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 2: USER ROLE ESCALATION & TAMPERING PREVENTION
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 2: ROLE ESCALATION & RELATIONSHIP TAMPERING ---");

  // 2.1 Attacker attempts to update their own role to 'admin'
  let roleEscalationBlocked = false;
  try {
    await asUser(attackerId, "hacker@malicious.com", true);
    await db.exec(`
      UPDATE public.users SET role = 'admin' WHERE id = '${attackerId}';
    `);
  } catch (err: any) {
    roleEscalationBlocked = err.message.includes("Users cannot modify user roles");
  }
  report(
    "2.1 Self-escalation to admin is blocked by trigger",
    roleEscalationBlocked
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 3: FAMILY & RELATIONSHIP ISOLATION
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 3: FAMILY SETUP & RELATIONSHIP INTEGRITY ---");
  
  // Create Parent Alice
  await asSystem();
  const aliceId = "22222222-0000-0000-0000-000000000001";
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES ('${aliceId}', 'alice@family.com', '{"role":"parent","full_name":"Alice Parent"}'::jsonb, now());
  `);

  // Alice creates family FAM-ALICE
  await asUser(aliceId, "alice@family.com", true);
  await db.exec(`
    INSERT INTO public.families (family_code, family_name, owner_parent_id, parent_email)
    VALUES ('FAM-ALICE', 'Alice Family Group', '${aliceId}', 'alice@family.com');
  `);
  await db.exec(`
    UPDATE public.users SET family_code = 'FAM-ALICE' WHERE id = '${aliceId}';
  `);
  const famCheck = (await db.query(`SELECT owner_parent_id FROM public.families WHERE family_code = 'FAM-ALICE'`)).rows[0] as any;
  report(
    "3.1 Parent Alice creates family FAM-ALICE",
    famCheck?.owner_parent_id === aliceId
  );

  // Create Child Bob linked to Alice
  await asSystem();
  const bobId = "33333333-0000-0000-0000-000000000001";
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES ('${bobId}', 'bob@family.com', '{"role":"child","full_name":"Bob Child"}'::jsonb, now());
  `);
  // Link Bob to Alice (performed by system / authorized onboarding)
  await asSystem();
  await db.exec(`
    UPDATE public.users SET parent_id = '${aliceId}', family_code = 'FAM-ALICE' WHERE id = '${bobId}';
  `);
  const bobCheck = (await db.query(`SELECT role, parent_id, family_code FROM public.users WHERE id = '${bobId}'`)).rows[0] as any;
  report(
    "3.2 Child Bob created with role child and linked to Alice",
    bobCheck?.role === "child" && bobCheck?.parent_id === aliceId && bobCheck?.family_code === "FAM-ALICE"
  );

  // Create Unrelated Parent Eve
  await asSystem();
  const eveId = "44444444-0000-0000-0000-000000000001";
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES ('${eveId}', 'eve@unrelated.com', '{"role":"parent","full_name":"Eve Intruder"}'::jsonb, now());
  `);
  await asUser(eveId, "eve@unrelated.com", true);
  await db.exec(`
    INSERT INTO public.families (family_code, family_name, owner_parent_id, parent_email)
    VALUES ('FAM-EVE', 'Eve Family Group', '${eveId}', 'eve@unrelated.com');
  `);

  // 3.3 Eve attempts to modify Alice's family
  let eveTamperBlocked = false;
  try {
    await asUser(eveId, "eve@unrelated.com", true);
    const res = await db.query(`
      UPDATE public.families SET family_name = 'Hacked' WHERE family_code = 'FAM-ALICE';
    `);
    // RLS policy will filter out rows (0 affected)
    eveTamperBlocked = (res as any).affectedRows === 0;
  } catch {
    eveTamperBlocked = true;
  }
  report(
    "3.3 Unrelated parent Eve cannot update Alice's family (RLS protected)",
    eveTamperBlocked
  );

  // 3.4 Bob attempts to modify his parent_id to Eve
  let bobChangeParentBlocked = false;
  try {
    await asUser(bobId, "bob@family.com", true);
    await db.exec(`
      UPDATE public.users SET parent_id = '${eveId}' WHERE id = '${bobId}';
    `);
  } catch (err: any) {
    bobChangeParentBlocked = err.message.includes("parent link without authorized parental confirmation");
  }

  report(
    "3.4 Child Bob cannot reassign parent_id to Eve (tamper trigger blocked)",
    bobChangeParentBlocked
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 4: SOS CREATION & RESOLUTION INTEGRITY (ZERO SELF-CLEAR)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 4: EMERGENCY SOS AUTHORIZATION & RESOLUTION ---");

  // 4.1 Child Bob triggers emergency SOS for himself
  await asUser(bobId, "bob@family.com", true);
  const sosInsertRes = await db.query(`
    INSERT INTO public.sos_alerts (child_id, child_name, location)
    VALUES ('${bobId}', 'Bob Child', '{"lat": 37.7749, "lng": -122.4194, "name": "San Francisco"}'::jsonb)
    RETURNING id, child_id, parent_uid, family_code, status;
  `);
  const activeAlert = sosInsertRes.rows[0] as any;
  report(
    "4.1 Child Bob triggers SOS for himself; trigger authoritatively populates Alice's parent_uid & FAM-ALICE",
    activeAlert?.child_id === bobId && activeAlert?.parent_uid === aliceId && activeAlert?.family_code === "FAM-ALICE" && activeAlert?.status === "active",
    `Alert ID: ${activeAlert?.id}, Parent: ${activeAlert?.parent_uid}`
  );

  const alertId = activeAlert?.id;

  // 4.2 Bob attempts to trigger SOS with another child's ID
  let spoofedSosBlocked = false;
  try {
    await asUser(bobId, "bob@family.com", true);
    await db.exec(`
      INSERT INTO public.sos_alerts (child_id, child_name, location)
      VALUES ('${aliceId}', 'Spoofed', '{"lat": 0, "lng": 0}'::jsonb);
    `);
  } catch (err: any) {
    spoofedSosBlocked = err.message.includes("Children may only trigger emergency SOS for themselves") ||
                         err.message.includes("Child users are strictly permitted");
  }
  report(
    "4.2 Child Bob attempting to trigger SOS for another user is REJECTED",
    spoofedSosBlocked
  );

  // 4.3 Child Bob attempts to resolve his own active SOS alert (Zero self-clear)
  let childSelfClearBlocked = false;
  try {
    await asUser(bobId, "bob@family.com", true);
    const updRes = await db.query(`
      UPDATE public.sos_alerts SET status = 'resolved' WHERE id = '${alertId}';
    `);
    // RLS policy denies row access (0 rows updated)
    childSelfClearBlocked = (updRes as any).affectedRows === 0;
  } catch (err: any) {
    childSelfClearBlocked = err.message.includes("Children are not permitted to resolve their own distress alerts") ||
                            err.message.includes("violates row-level security policy");
  }
  report(
    "4.3 Child Bob CANNOT resolve his own distress alert (Zero self-clear enforced)",
    childSelfClearBlocked
  );

  // 4.4 Unrelated Parent Eve attempts to resolve Alice's child's SOS alert
  let eveResolveBlocked = false;
  try {
    await asUser(eveId, "eve@unrelated.com", true);
    const eveRes = await db.query(`
      UPDATE public.sos_alerts SET status = 'resolved' WHERE id = '${alertId}';
    `);
    // RLS policy prevents update (0 rows affected)
    eveResolveBlocked = (eveRes as any).affectedRows === 0;
  } catch {
    eveResolveBlocked = true;
  }
  report(
    "4.4 Unrelated Parent Eve CANNOT resolve Bob's SOS alert (RLS protected)",
    eveResolveBlocked
  );

  // 4.5 Authorized Parent Alice resolves Bob's active SOS alert
  await asUser(aliceId, "alice@family.com", true);
  await db.exec(`
    UPDATE public.sos_alerts SET status = 'resolved' WHERE id = '${alertId}';
  `);
  const resolvedAlert = (await db.query(`SELECT status, resolved_by, resolved_at FROM public.sos_alerts WHERE id = '${alertId}'`)).rows[0] as any;
  report(
    "4.5 Authorized Parent Alice resolves Bob's alert; resolved_by and resolved_at are recorded",
    resolvedAlert?.status === "resolved" && resolvedAlert?.resolved_by === aliceId && Boolean(resolvedAlert?.resolved_at),
    `Status: ${resolvedAlert?.status}, ResolvedBy: ${resolvedAlert?.resolved_by}`
  );

  // 4.6 Attempt to reopen resolved distress alert is blocked
  let reopenBlocked = false;
  try {
    await asUser(aliceId, "alice@family.com", true);
    const reopenRes = await db.query(`
      UPDATE public.sos_alerts SET status = 'active' WHERE id = '${alertId}';
    `);
    reopenBlocked = (reopenRes as any).affectedRows === 0;
  } catch (err: any) {
    reopenBlocked = err.message.includes("Resolved emergency SOS alerts cannot be reopened") ||
                    err.message.includes("violates row-level security policy");
  }
  report(
    "4.6 Reopening resolved distress alert is blocked",
    reopenBlocked
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 5: DATA RETENTION & ANTI-PURGE CONSTRAINTS
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 5: DATA RETENTION & ANTI-PURGE INTEGRITY ---");

  // 5.1 Attempt to delete Child Bob while SOS alert exists
  let childDeleteBlocked = false;
  try {
    await asSystem();
    await db.exec(`
      DELETE FROM public.users WHERE id = '${bobId}';
    `);
  } catch (err: any) {
    // Foreign key constraint on sos_alerts(child_id) ON DELETE RESTRICT
    childDeleteBlocked = err.message.includes("violates foreign key constraint") ||
                         err.message.includes("fk_") ||
                         err.message.includes("sos_alerts_child_id_fkey");
  }
  report(
    "5.1 Child deletion BLOCKED while active/historical SOS emergency records exist (ON DELETE RESTRICT)",
    childDeleteBlocked
  );

  // 5.2 Parent Alice deleting account -> sets parent_uid = NULL on SOS alert without wiping the alert
  await asSystem();
  await db.exec(`
    -- First remove Alice's family to satisfy families.owner_parent_id RESTRICT
    DELETE FROM public.families WHERE family_code = 'FAM-ALICE';
    DELETE FROM public.users WHERE id = '${aliceId}';
  `);
  const preservedAlert = (await db.query(`SELECT id, child_id, parent_uid, status FROM public.sos_alerts WHERE id = '${alertId}'`)).rows[0] as any;
  report(
    "5.2 Parent account deletion sets parent_uid = NULL via ON DELETE SET NULL; emergency history is retained",
    preservedAlert !== undefined && preservedAlert?.parent_uid === null && preservedAlert?.child_id === bobId
  );

  console.log("\n===============================================================================");
  console.log(` PHASE 1 TEST TOTALS: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase1Validation().catch((err) => {
  console.error("Fatal Phase 1 Validation Error:", err);
  process.exit(1);
});
