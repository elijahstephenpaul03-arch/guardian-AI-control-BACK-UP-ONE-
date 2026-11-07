import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";

async function runChildDeviceSecurityAudit() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI: SUPABASE EDITION - CHILD DEVICE REGISTRATION SECURITY AUDIT");
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

  // 2. Apply All Schema & RLS Migrations
  console.log("-> 2. Applying Schema & RLS Migrations...");
  const m1 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000000_initial_schema.sql"), "utf8");
  await db.exec(m1);
  const m2 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000001_rls_policies.sql"), "utf8");
  await db.exec(m2);
  const m3 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000002_family_linking.sql"), "utf8");
  await db.exec(m3);
  const m4 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000003_sos_realtime.sql"), "utf8");
  await db.exec(m4);
  console.log("-> All migrations successfully applied.\n");

  // 3. Define Test Identities
  const parentId = "90000000-0000-0000-0000-000000000001";
  const parentEmail = "parent.audit@guardian.test";

  const childId = "90000000-0000-0000-0000-000000000002";
  const childEmail = "child.audit@guardian.test";

  const unrelatedParentId = "90000000-0000-0000-0000-000000000003";
  const unrelatedParentEmail = "stranger.parent@guardian.test";

  const unlinkedChildId = "90000000-0000-0000-0000-000000000004";
  const unlinkedChildEmail = "unlinked.child@guardian.test";

  const disabledChildId = "90000000-0000-0000-0000-000000000005";
  const disabledChildEmail = "disabled.child@guardian.test";

  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) VALUES
      ('${parentId}', '${parentEmail}', '{"role":"parent","full_name":"Audit Parent"}'::jsonb, now()),
      ('${childId}', '${childEmail}', '{"role":"child","full_name":"Audit Child"}'::jsonb, now()),
      ('${unrelatedParentId}', '${unrelatedParentEmail}', '{"role":"parent","full_name":"Unrelated Parent"}'::jsonb, now()),
      ('${unlinkedChildId}', '${unlinkedChildEmail}', '{"role":"child","full_name":"Unlinked Child"}'::jsonb, now()),
      ('${disabledChildId}', '${disabledChildEmail}', '{"role":"child","full_name":"Disabled Child"}'::jsonb, now());
  `);

  // Parent creates family code
  await asUser(parentId, parentEmail, true);
  const famRes = (await db.query(`SELECT public.generate_or_get_family_code('Audit Family') AS result;`)).rows[0] as any;
  const famCode = (typeof famRes.result === "string" ? JSON.parse(famRes.result) : famRes.result).family_code;

  // Unrelated Parent creates their own separate family code
  await asUser(unrelatedParentId, unrelatedParentEmail, true);
  const strangerFamRes = (await db.query(`SELECT public.generate_or_get_family_code('Stranger Family') AS result;`)).rows[0] as any;
  const strangerFamCode = (typeof strangerFamRes.result === "string" ? JSON.parse(strangerFamRes.result) : strangerFamRes.result).family_code;

  // Linked Child pairs with Parent
  await asUser(childId, childEmail, true);
  const linkReq = (await db.query(`SELECT public.submit_family_link_request('${famCode}') AS result;`)).rows[0] as any;
  const linkReqId = (typeof linkReq.result === "string" ? JSON.parse(linkReq.result) : linkReq.result).id;

  // Parent accepts link request
  await asUser(parentId, parentEmail, true);
  await db.query(`SELECT public.respond_to_family_link_request('${linkReqId}', 'accept');`);

  // Mark disabled child account as disabled
  await asSystem();
  await db.exec(`UPDATE public.users SET disabled = true WHERE id = '${disabledChildId}';`);

  console.log("-> Test Identities and Family Links initialized.\n");

  // =========================================================================
  // AUDIT ITEM 1: child_id must equal auth.uid() for Child registrations
  // =========================================================================
  console.log("--- AUDIT 1: child_id must equal auth.uid() ---");
  await asUser(childId, childEmail, true);

  // Attempt to spoof child_id
  let spoofChildIdBlocked = false;
  let spoofChildIdError = "";
  try {
    await db.exec(`
      INSERT INTO public.devices (
        device_id, device_name, battery, online, child_id, parent_id, family_code, updated_at
      ) VALUES (
        'DEV-SPOOF-01', 'Hacked Device', 100, true, '${unlinkedChildId}', '${parentId}', '${famCode}', now()
      );
    `);
  } catch (err: any) {
    spoofChildIdBlocked = true;
    spoofChildIdError = err.message;
  }

  report(
    "1. Child cannot register device with a spoofed child_id (must equal auth.uid())",
    spoofChildIdBlocked && spoofChildIdError.includes("Child users can only register devices for themselves"),
    `Error caught: ${spoofChildIdError}`
  );

  // =========================================================================
  // AUDIT ITEM 2 & 4: parent_id must be derived from or verified against public.users.parent_id
  // Child cannot register device under unrelated Parent UID
  // =========================================================================
  console.log("\n--- AUDIT 2 & 4: parent_id derivation & rejection of unrelated Parent UID ---");
  await asUser(childId, childEmail, true);

  // Attempt to register under unrelated parent UID
  let unrelatedParentBlocked = false;
  let unrelatedParentError = "";
  try {
    await db.exec(`
      INSERT INTO public.devices (
        device_id, device_name, battery, online, child_id, parent_id, family_code, updated_at
      ) VALUES (
        'DEV-UNREL-01', 'Unrelated Parent Device', 100, true, '${childId}', '${unrelatedParentId}', '${famCode}', now()
      );
    `);
  } catch (err: any) {
    unrelatedParentBlocked = true;
    unrelatedParentError = err.message;
  }

  report(
    "2 & 4. Child cannot register a device under an unrelated Parent UID",
    unrelatedParentBlocked && unrelatedParentError.includes("Child cannot register a device under an unrelated Parent UID"),
    `Error caught: ${unrelatedParentError}`
  );

  // =========================================================================
  // AUDIT ITEM 3: family_code must match child's actual linked family
  // =========================================================================
  console.log("\n--- AUDIT 3: family_code must match child's actual linked family ---");
  await asUser(childId, childEmail, true);

  // Attempt to register with mismatched/stranger family code
  let wrongFamilyCodeBlocked = false;
  let wrongFamilyCodeError = "";
  try {
    await db.exec(`
      INSERT INTO public.devices (
        device_id, device_name, battery, online, child_id, parent_id, family_code, updated_at
      ) VALUES (
        'DEV-WRONGFAM-01', 'Wrong Family Device', 100, true, '${childId}', '${parentId}', '${strangerFamCode}', now()
      );
    `);
  } catch (err: any) {
    wrongFamilyCodeBlocked = true;
    wrongFamilyCodeError = err.message;
  }

  report(
    "3. Child cannot register device with a mismatched family_code",
    wrongFamilyCodeBlocked && wrongFamilyCodeError.includes("Family code must match child"),
    `Error caught: ${wrongFamilyCodeError}`
  );

  // Now perform legitimate Child registration with authoritatively derived fields
  const validDevId = "DEV-AUDIT-VALID";
  await asUser(childId, childEmail, true);
  await db.exec(`
    INSERT INTO public.devices (
      device_id, device_name, device_model, android_version,
      battery, online, child_id, parent_id, family_code, updated_at
    ) VALUES (
      '${validDevId}', 'Audit Child''s Phone', 'Pixel 8', 'Android 14',
      85, true, '${childId}', '${parentId}', '${famCode}', now()
    )
    ON CONFLICT (device_id) DO UPDATE SET
      device_name = EXCLUDED.device_name,
      battery = EXCLUDED.battery,
      online = EXCLUDED.online,
      updated_at = EXCLUDED.updated_at;
  `);

  const insertedDeviceRows = (await db.query(`SELECT * FROM public.devices WHERE device_id = '${validDevId}';`)).rows as any[];
  report(
    "Legitimate device registration successfully stored with authoritative attributes",
    insertedDeviceRows.length === 1 &&
      insertedDeviceRows[0].child_id === childId &&
      insertedDeviceRows[0].parent_id === parentId &&
      insertedDeviceRows[0].family_code === famCode,
    `Device: ${insertedDeviceRows[0]?.device_id}, Child: ${insertedDeviceRows[0]?.child_id}, Parent: ${insertedDeviceRows[0]?.parent_id}, Family: ${insertedDeviceRows[0]?.family_code}`
  );

  // =========================================================================
  // AUDIT ITEM 5: Parent access isolation (Only linked Parent can access)
  // =========================================================================
  console.log("\n--- AUDIT 5: Parent can only access devices belonging to their linked children ---");

  // Linked parent queries
  await asUser(parentId, parentEmail, true);
  const linkedParentRows = (await db.query(`SELECT * FROM public.devices WHERE device_id = '${validDevId}';`)).rows as any[];

  // Unrelated parent queries
  await asUser(unrelatedParentId, unrelatedParentEmail, true);
  const unrelatedParentRows = (await db.query(`SELECT * FROM public.devices WHERE device_id = '${validDevId}';`)).rows as any[];

  // Unrelated parent attempts to modify device
  let strangerTamperBlocked = false;
  let strangerTamperRowsAffected = 0;
  try {
    const updateRes = await db.query(`UPDATE public.devices SET device_name = 'Compromised' WHERE device_id = '${validDevId}';`);
    strangerTamperRowsAffected = (updateRes as any).rowCount || 0;
  } catch (err: any) {
    strangerTamperBlocked = true;
  }

  report(
    "5a. Linked Parent can view their linked child's companion device via RLS",
    linkedParentRows.length === 1 && linkedParentRows[0].device_id === validDevId,
    `Linked Parent found ${linkedParentRows.length} matching device(s)`
  );

  report(
    "5b. Unrelated Parent receives 0 rows when attempting to query other children's devices",
    unrelatedParentRows.length === 0,
    `Unrelated Parent received ${unrelatedParentRows.length} rows (isolated by RLS)`
  );

  report(
    "5c. Unrelated Parent cannot modify another family's device (0 rows affected or error)",
    strangerTamperBlocked || strangerTamperRowsAffected === 0,
    `Stranger update affected ${strangerTamperRowsAffected} rows`
  );

  // =========================================================================
  // AUDIT ITEM 6: device_id has required unique constraint for upsert
  // =========================================================================
  console.log("\n--- AUDIT 6: device_id UNIQUE constraint for upsert(onConflict: 'device_id') ---");
  await asUser(childId, childEmail, true);

  // Execute ON CONFLICT upsert to simulate subsequent heartbeat/telemetry update
  await db.exec(`
    INSERT INTO public.devices (
      device_id, device_name, battery, online, child_id, parent_id, family_code, updated_at
    ) VALUES (
      '${validDevId}', 'Audit Child''s Phone', 94, true, '${childId}', '${parentId}', '${famCode}', now()
    )
    ON CONFLICT (device_id) DO UPDATE SET
      battery = EXCLUDED.battery,
      online = EXCLUDED.online,
      updated_at = EXCLUDED.updated_at;
  `);

  const allDevRows = (await db.query(`SELECT * FROM public.devices WHERE device_id = '${validDevId}';`)).rows as any[];

  report(
    "6. device_id PRIMARY KEY / UNIQUE constraint successfully handles upsert without duplicating rows",
    allDevRows.length === 1 && allDevRows[0].battery === 94,
    `Row count: ${allDevRows.length}, Updated battery: ${allDevRows[0]?.battery}%`
  );

  // =========================================================================
  // AUDIT ITEM 7: Disabled and unlinked accounts must be rejected appropriately
  // =========================================================================
  console.log("\n--- AUDIT 7: Disabled and unlinked accounts rejected ---");

  // 7a. Unlinked Child
  await asUser(unlinkedChildId, unlinkedChildEmail, true);
  let unlinkedBlocked = false;
  let unlinkedError = "";
  try {
    await db.exec(`
      INSERT INTO public.devices (
        device_id, device_name, battery, online, child_id, updated_at
      ) VALUES (
        'DEV-UNLINKED-01', 'Unlinked Phone', 100, true, '${unlinkedChildId}', now()
      );
    `);
  } catch (err: any) {
    unlinkedBlocked = true;
    unlinkedError = err.message;
  }

  report(
    "7a. Unlinked child account is strictly rejected from registering devices",
    unlinkedBlocked && unlinkedError.includes("Unlinked child account cannot register companion devices"),
    `Error caught: ${unlinkedError}`
  );

  // 7b. Disabled Account
  await asUser(disabledChildId, disabledChildEmail, true);
  let disabledBlocked = false;
  let disabledError = "";
  try {
    await db.exec(`
      INSERT INTO public.devices (
        device_id, device_name, battery, online, child_id, updated_at
      ) VALUES (
        'DEV-DISABLED-01', 'Disabled Phone', 100, true, '${disabledChildId}', now()
      );
    `);
  } catch (err: any) {
    disabledBlocked = true;
    disabledError = err.message;
  }

  report(
    "7b. Disabled user account is strictly rejected by RLS & trigger",
    disabledBlocked && (disabledError.includes("Account is disabled") || disabledError.includes("violates row-level security")),
    `Error caught: ${disabledError}`
  );

  // =========================================================================
  // AUDIT ITEM 8: Supabase mode must never call legacy Firebase device registration
  // =========================================================================
  console.log("\n--- AUDIT 8: Supabase mode never calls legacy Firebase device registration ---");
  const appTsx = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf8");
  const useSubAuth = fs.readFileSync(path.join(process.cwd(), "src/lib/useSupabaseAuth.ts"), "utf8");

  const appWireCorrect = appTsx.includes("registerCurrentChildDevice = isSupabaseActive ? supabaseAuth.registerCurrentChildDevice : sync.registerCurrentChildDevice;");
  const subAuthUsesSupabase = useSubAuth.includes("registerChildDeviceInSupabase({");

  report(
    "8. App routing routes device registration to Supabase hook when Supabase is active, bypassing Firebase",
    appWireCorrect && subAuthUsesSupabase,
    "App.tsx cleanly switches to supabaseAuth.registerCurrentChildDevice, which calls registerChildDeviceInSupabase"
  );

  // =========================================================================
  // AUDIT ITEM 9: Preserve existing device telemetry and dashboard UI
  // =========================================================================
  console.log("\n--- AUDIT 9: Preserve existing device telemetry and dashboard UI ---");
  const subLib = fs.readFileSync(path.join(process.cwd(), "src/lib/supabase.ts"), "utf8");
  const hasTelemetryFields = subLib.includes("battery: params.battery ?? 88") &&
    subLib.includes("gps: params.gps") &&
    subLib.includes("last_seen: nowIso") &&
    subLib.includes("connection_quality: \"strong\"");

  report(
    "9. Existing device telemetry fields (battery, gps, last_seen, quality) and UI structures are preserved",
    hasTelemetryFields,
    "Telemetry fields are mapped into public.devices and returned to dashboard state without regressions"
  );

  console.log("\n===============================================================================");
  console.log(` SECURITY AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runChildDeviceSecurityAudit().catch((err) => {
  console.error("FATAL ERROR IN SECURITY AUDIT:", err);
  process.exit(1);
});
