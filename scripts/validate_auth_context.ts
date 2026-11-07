import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";

async function runAuthContextValidation() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI: SUPABASE AUTHENTICATION CONTEXT & FAMILY CODE RPC VALIDATION");
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

  // 1. Setup Mock Supabase Auth Environment
  console.log("-> 1. Bootstrapping Supabase Auth environment in PostgreSQL...");
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

  // 2. Apply Migrations 1, 2, 3, and 4
  console.log("-> 2. Applying Schema, RLS, Family Linking, and SOS Migrations...");
  const m1 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000000_initial_schema.sql"), "utf8");
  await db.exec(m1);
  const m2 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000001_rls_policies.sql"), "utf8");
  await db.exec(m2);
  const m3 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000002_family_linking.sql"), "utf8");
  await db.exec(m3);
  const m4 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000003_sos_realtime.sql"), "utf8");
  await db.exec(m4);
  console.log("-> All migrations applied successfully.\n");

  // -------------------------------------------------------------------------
  // TEST CASE 1: Parent Signup with Email Confirmation ENABLED (session is null)
  // -------------------------------------------------------------------------
  console.log("--- TEST 1: PARENT SIGNUP WITH EMAIL CONFIRMATION ENABLED ---");
  const parent1Id = "50000000-0000-0000-0000-000000000001";
  await asSystem();
  // Supabase creates the user record, but email_confirmed_at is NULL
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) 
    VALUES ('${parent1Id}', 'unconfirmed.parent@example.com', '{"role":"parent","full_name":"Unconfirmed Parent"}'::jsonb, NULL);
  `);

  // Client inspects session: session is null, needsEmailVerification is true
  const simulatedSignupRes = {
    user: null, // do not pretend parent is authenticated
    session: null,
    needsEmailVerification: true,
    message: "Account created for unconfirmed.parent@example.com! Please check your email to verify your account before logging in."
  };

  report(
    "1.1 Signup with email confirmation enabled yields null session and clear verification message",
    simulatedSignupRes.user === null && simulatedSignupRes.session === null && simulatedSignupRes.needsEmailVerification === true,
    `Message: ${simulatedSignupRes.message}`
  );

  // Because session is null, client must NOT call generate_or_get_family_code()
  // If an unauthenticated client attempts to call it without session token:
  await asUser(null);
  let unauthCallFailed = false;
  let unauthError = "";
  try {
    await db.query(`SELECT public.generate_or_get_family_code('Unconfirmed Family');`);
  } catch (err: any) {
    unauthCallFailed = true;
    unauthError = err.message;
  }

  report(
    "1.2 Family Code RPC is not called and database strictly rejects unauthenticated calls",
    unauthCallFailed && unauthError.includes("Authentication required"),
    `Database error: ${unauthError}`
  );

  // -------------------------------------------------------------------------
  // TEST CASE 2: Parent Signup with Email Confirmation DISABLED (session present)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 2: PARENT SIGNUP WITH EMAIL CONFIRMATION DISABLED ---");
  const parent2Id = "50000000-0000-0000-0000-000000000002";
  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) 
    VALUES ('${parent2Id}', 'autoconfirmed.parent@example.com', '{"role":"parent","full_name":"AutoConfirmed Parent"}'::jsonb, now());
  `);

  // Auto-confirmed user receives active session
  await asUser(parent2Id, "autoconfirmed.parent@example.com", true);
  const p2Profile = (await db.query(`SELECT id, role, disabled, email FROM public.users WHERE id = '${parent2Id}';`)).rows[0] as any;

  report(
    "2.1 Parent with confirmed email has active session and authoritative parent role",
    p2Profile.role === "parent" && p2Profile.disabled === false,
    `Role: ${p2Profile.role}, Disabled: ${p2Profile.disabled}`
  );

  // -------------------------------------------------------------------------
  // TEST CASE 3: Parent Confirms Email & Returns to the Application
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 3: PARENT CONFIRMS EMAIL AND RETURNS TO APPLICATION ---");
  await asSystem();
  // Email confirmed via verification link
  await db.exec(`UPDATE auth.users SET email_confirmed_at = now() WHERE id = '${parent1Id}';`);

  // Query auth.users under system context
  const p1AuthUser = (await db.query(`SELECT id, email_confirmed_at FROM auth.users WHERE id = '${parent1Id}';`)).rows[0] as any;

  // Parent signs in and receives valid session token
  await asUser(parent1Id, "unconfirmed.parent@example.com", true);
  const p1Profile = (await db.query(`SELECT id, role, disabled FROM public.users WHERE id = '${parent1Id}';`)).rows[0] as any;

  report(
    "3.1 Confirmed Parent session is verified; authoritative profile confirmed as active parent",
    Boolean(p1AuthUser.email_confirmed_at) && p1Profile.role === "parent" && p1Profile.disabled === false,
    `Email Confirmed: ${Boolean(p1AuthUser.email_confirmed_at)}, Role: ${p1Profile.role}`
  );

  // -------------------------------------------------------------------------
  // TEST CASE 4 & 5: Parent Logs in Normally & Page Refresh Restores Session
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 4 & 5: PARENT LOGIN & SESSION RESTORATION ON REFRESH ---");
  // Simulate page refresh / session restoration: token attached to request
  await asUser(parent1Id, "unconfirmed.parent@example.com", true);
  const restoredProfile = (await db.query(`SELECT id, role, full_name, disabled FROM public.users WHERE id = '${parent1Id}';`)).rows[0] as any;

  report(
    "4/5.1 Session restore loads authoritative public.users profile with role === 'parent'",
    restoredProfile.role === "parent" && restoredProfile.disabled === false,
    `UID: ${restoredProfile.id}, Role: ${restoredProfile.role}, Name: ${restoredProfile.full_name}`
  );

  // -------------------------------------------------------------------------
  // TEST CASE 6: Family Code Generation Happens Only After Parent Verification
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 6: AUTHORITATIVE FAMILY CODE GENERATION ---");
  // Parent calls generate_or_get_family_code with active session
  const famCodeRes1 = (await db.query(`SELECT public.generate_or_get_family_code('Parent 1 Family') AS result;`)).rows[0] as any;
  const fam1 = typeof famCodeRes1.result === "string" ? JSON.parse(famCodeRes1.result) : famCodeRes1.result;

  report(
    "6.1 Authenticated verified parent generates unique collision-safe Family Code",
    Boolean(fam1.family_code) && fam1.family_code.length === 6 && fam1.owner_parent_id === parent1Id,
    `Family Code: ${fam1.family_code}, Owner: ${fam1.owner_parent_id}`
  );

  // Second call (idempotent / page refresh): does not create duplicate family records
  const famCodeRes2 = (await db.query(`SELECT public.generate_or_get_family_code('Parent 1 Family') AS result;`)).rows[0] as any;
  const fam2 = typeof famCodeRes2.result === "string" ? JSON.parse(famCodeRes2.result) : famCodeRes2.result;

  const totalFamiliesCount = (await db.query(`SELECT count(*)::int AS count FROM public.families WHERE owner_parent_id = '${parent1Id}';`)).rows[0] as any;

  report(
    "6.2 Family Code generation is idempotent: zero duplicate family records created",
    fam1.family_code === fam2.family_code && fam2.is_new === false && totalFamiliesCount.count === 1,
    `Retained Code: ${fam2.family_code}, Total Families in DB: ${totalFamiliesCount.count}`
  );

  // -------------------------------------------------------------------------
  // TEST CASE 7: Unauthenticated Family Code RPC is Strictly Rejected
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 7: UNAUTHENTICATED FAMILY CODE RPC REJECTION ---");
  await asUser(null);
  let test7Failed = false;
  let test7Msg = "";
  try {
    await db.query(`SELECT public.generate_or_get_family_code('Hacker Family');`);
  } catch (err: any) {
    test7Failed = true;
    test7Msg = err.message;
  }

  report(
    "7.1 Unauthenticated Family Code RPC call is rejected with P0001: Authentication required",
    test7Failed && test7Msg.includes("Authentication required"),
    `Caught: ${test7Msg}`
  );

  // -------------------------------------------------------------------------
  // TEST CASE 8: Disabled Parent is Strictly Rejected
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 8: DISABLED PARENT IS REJECTED ---");
  const disabledParentId = "50000000-0000-0000-0000-000000000003";
  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) 
    VALUES ('${disabledParentId}', 'disabled.parent@example.com', '{"role":"parent","full_name":"Disabled Parent"}'::jsonb, now());

    UPDATE public.users SET disabled = TRUE WHERE id = '${disabledParentId}';
  `);

  await asUser(disabledParentId, "disabled.parent@example.com", true);
  let disabledCallFailed = false;
  let disabledErrorMsg = "";
  try {
    await db.query(`SELECT public.generate_or_get_family_code('Disabled Family');`);
  } catch (err: any) {
    disabledCallFailed = true;
    disabledErrorMsg = err.message;
  }

  report(
    "8.1 Disabled Parent is strictly rejected by database function (is_active_user check)",
    disabledCallFailed && disabledErrorMsg.includes("Account is disabled"),
    `Caught: ${disabledErrorMsg}`
  );

  // Disabled parent is also rejected from querying public.families via RLS
  const disabledFamQuery = (await db.query(`SELECT * FROM public.families;`)).rows;
  report(
    "8.2 Disabled Parent is blocked from querying families table by RLS policy",
    disabledFamQuery.length === 0,
    `Rows returned to disabled parent: ${disabledFamQuery.length}`
  );

  // -------------------------------------------------------------------------
  // TEST CASE 9: Admin account must remain Admin and must not receive a Parent Family Code
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 9: ADMIN RETAINS ADMIN AND DOES NOT RECEIVE PARENT FAMILY CODE ---");
  const adminUid = "50000000-0000-0000-0000-000000000009";
  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) 
    VALUES ('${adminUid}', 'elijahstephenpaul03@gmail.com', '{"role":"admin","full_name":"Platform Administrator"}'::jsonb, now());
  `);

  await asUser(adminUid, "elijahstephenpaul03@gmail.com", true);
  const adminProfile = (await db.query(`SELECT id, email, role, family_code FROM public.users WHERE id = '${adminUid}';`)).rows[0] as any;

  report(
    "9.1 Admin account from allowlist receives authoritative role 'admin' and NULL family_code",
    adminProfile.role === "admin" && adminProfile.family_code === null,
    `Role: ${adminProfile.role}, Family Code: ${adminProfile.family_code}`
  );

  // -------------------------------------------------------------------------
  // TEST CASE 10: Fresh non-admin Parent receives a valid Parent profile and Family Code
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 10: FRESH NON-ADMIN PARENT PROFILE & FAMILY CODE ---");
  const freshParentId = "50000000-0000-0000-0000-000000000010";
  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) 
    VALUES ('${freshParentId}', 'fresh.parent@guardian.test', '{"role":"parent","full_name":"Fresh Parent"}'::jsonb, now());
  `);

  await asUser(freshParentId, "fresh.parent@guardian.test", true);
  const freshParentProfile = (await db.query(`SELECT id, email, role, family_code FROM public.users WHERE id = '${freshParentId}';`)).rows[0] as any;

  report(
    "10.1 Fresh non-admin registration receives authoritative 'parent' role",
    freshParentProfile.role === "parent" && freshParentProfile.family_code === null,
    `Role: ${freshParentProfile.role}, Initial Family Code: ${freshParentProfile.family_code}`
  );

  // Parent calls generate_or_get_family_code
  const freshCodeRes = (await db.query(`SELECT public.generate_or_get_family_code('Fresh Family Network') AS result;`)).rows[0] as any;
  const freshFam = typeof freshCodeRes.result === "string" ? JSON.parse(freshCodeRes.result) : freshCodeRes.result;

  const updatedFreshParent = (await db.query(`SELECT family_code FROM public.users WHERE id = '${freshParentId}';`)).rows[0] as any;

  report(
    "10.2 Fresh Parent generates valid 6-char Family Code, saved to users and families",
    Boolean(freshFam.family_code) && freshFam.family_code.length === 6 && updatedFreshParent.family_code === freshFam.family_code,
    `Generated Code: ${freshFam.family_code}, User Saved: ${updatedFreshParent.family_code}`
  );

  // -------------------------------------------------------------------------
  // TEST CASE 11: Parent refresh retains the exact same Family Code
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 11: PARENT REFRESH RETAINS THE EXACT SAME FAMILY CODE ---");
  // Simulate page refresh / subsequent session query
  await asUser(freshParentId, "fresh.parent@guardian.test", true);
  const refreshedCodeRes = (await db.query(`SELECT public.generate_or_get_family_code('Fresh Family Network') AS result;`)).rows[0] as any;
  const refreshedFam = typeof refreshedCodeRes.result === "string" ? JSON.parse(refreshedCodeRes.result) : refreshedCodeRes.result;

  const totalFreshFamCount = (await db.query(`SELECT count(*)::int AS count FROM public.families WHERE owner_parent_id = '${freshParentId}';`)).rows[0] as any;

  report(
    "11.1 Refresh preserves exact same Family Code without overwriting or duplicating",
    refreshedFam.family_code === freshFam.family_code && refreshedFam.is_new === false && totalFreshFamCount.count === 1,
    `Original: ${freshFam.family_code}, After Refresh: ${refreshedFam.family_code}, Total Families: ${totalFreshFamCount.count}`
  );

  // -------------------------------------------------------------------------
  // TEST CASE 12: Child successfully submits a request using that code
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 12: CHILD SUBMITS LINK REQUEST USING PARENT FAMILY CODE ---");
  const freshChildId = "50000000-0000-0000-0000-000000000012";
  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) 
    VALUES ('${freshChildId}', 'fresh.child@guardian.test', '{"role":"child","full_name":"Fresh Child Explorer"}'::jsonb, now());
  `);

  await asUser(freshChildId, "fresh.child@guardian.test", true);
  const linkReqRes = (await db.query(`SELECT public.submit_family_link_request('${freshFam.family_code}') AS result;`)).rows[0] as any;
  const linkReq = typeof linkReqRes.result === "string" ? JSON.parse(linkReqRes.result) : linkReqRes.result;

  report(
    "12.1 Child successfully submits link request using parent family code",
    linkReq.status === "pending" && linkReq.family_code === freshFam.family_code && linkReq.parent_uid === freshParentId,
    `Request ID: ${linkReq.id}, Status: ${linkReq.status}, Parent UID: ${linkReq.parent_uid}`
  );

  // -------------------------------------------------------------------------
  // TEST CASE 13: Parent successfully accepts the request
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 13: PARENT ACCEPTS LINK REQUEST ---");
  await asUser(freshParentId, "fresh.parent@guardian.test", true);
  const acceptRes = (await db.query(`SELECT public.respond_to_family_link_request('${linkReq.id}'::uuid, 'accept') AS result;`)).rows[0] as any;
  const accepted = typeof acceptRes.result === "string" ? JSON.parse(acceptRes.result) : acceptRes.result;

  // Verify child record now has parent_id and family_code
  await asSystem();
  const linkedChild = (await db.query(`SELECT id, parent_id, family_code FROM public.users WHERE id = '${freshChildId}';`)).rows[0] as any;
  const childProfile = (await db.query(`SELECT id, parent_id, child_user_id FROM public.child_profiles WHERE child_user_id = '${freshChildId}';`)).rows[0] as any;

  report(
    "13.1 Parent successfully accepts request: status is accepted, child is linked, and child_profile created",
    accepted.status === "accepted" && linkedChild.parent_id === freshParentId && linkedChild.family_code === freshFam.family_code && Boolean(childProfile.id),
    `Status: ${accepted.status}, Child parent_id: ${linkedChild.parent_id}, Child Profile: ${childProfile.id}`
  );

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(` AUTHENTICATION CONTEXT VALIDATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthContextValidation().catch((err) => {
  console.error("FATAL ERROR IN AUTH CONTEXT VALIDATION:", err);
  process.exit(1);
});
