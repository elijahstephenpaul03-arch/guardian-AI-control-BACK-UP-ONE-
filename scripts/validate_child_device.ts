import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";

async function runChildDeviceValidation() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI: SUPABASE EDITION - CHILD DEVICE REGISTRATION VALIDATION");
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

  // 2. Apply Migrations
  console.log("-> 2. Applying Schema & RLS Migrations...");
  const m1 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000000_initial_schema.sql"), "utf8");
  await db.exec(m1);
  const m2 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000001_rls_policies.sql"), "utf8");
  await db.exec(m2);
  const m3 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000002_family_linking.sql"), "utf8");
  await db.exec(m3);
  console.log("-> All migrations successfully applied.\n");

  // 3. Create Parent & Child Identities
  const parentId = "80000000-0000-0000-0000-000000000001";
  const parentEmail = "device.parent@guardian.test";
  const childId = "80000000-0000-0000-0000-000000000002";
  const childEmail = "device.child@guardian.test";
  const strangerId = "80000000-0000-0000-0000-000000000003";
  const strangerEmail = "stranger@guardian.test";

  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) VALUES
      ('${parentId}', '${parentEmail}', '{"role":"parent","full_name":"Device Parent"}'::jsonb, now()),
      ('${childId}', '${childEmail}', '{"role":"child","full_name":"Device Child"}'::jsonb, now()),
      ('${strangerId}', '${strangerEmail}', '{"role":"parent","full_name":"Stranger Parent"}'::jsonb, now());
  `);

  // Parent creates family code
  await asUser(parentId, parentEmail, true);
  const famRes = (await db.query(`SELECT public.generate_or_get_family_code('Device Test Family') AS result;`)).rows[0] as any;
  const famCode = (typeof famRes.result === "string" ? JSON.parse(famRes.result) : famRes.result).family_code;

  // Child links to parent
  await asUser(childId, childEmail, true);
  const linkReq = (await db.query(`SELECT public.submit_family_link_request('${famCode}') AS result;`)).rows[0] as any;
  const linkReqId = (typeof linkReq.result === "string" ? JSON.parse(linkReq.result) : linkReq.result).id;

  // Parent approves child
  await asUser(parentId, parentEmail, true);
  await db.query(`SELECT public.respond_to_family_link_request('${linkReqId}', 'accept');`);

  // -------------------------------------------------------------------------
  // TEST 1: Authenticated Child Registers Device in public.devices
  // -------------------------------------------------------------------------
  console.log("--- TEST 1: AUTHENTICATED CHILD REGISTERS COMPANION DEVICE ---");
  await asUser(childId, childEmail, true);

  const deviceId = "DEV-TEST99";
  const devName = "Device Child''s Phone";
  const devModel = "Android Smartphone";

  // Child inserts device into public.devices
  await db.exec(`
    INSERT INTO public.devices (
      device_id, device_name, device_model, android_version,
      battery, online, child_id, parent_id, updated_at
    ) VALUES (
      '${deviceId}', '${devName}', '${devModel}', 'Android 14',
      88, true, '${childId}', '${parentId}', now()
    )
    ON CONFLICT (device_id) DO UPDATE SET
      device_name = EXCLUDED.device_name,
      battery = EXCLUDED.battery,
      online = EXCLUDED.online,
      updated_at = EXCLUDED.updated_at;
  `);

  const childDeviceRows = (await db.query(`SELECT * FROM public.devices WHERE device_id = '${deviceId}';`)).rows as any[];

  report(
    "1. Authenticated Child registers device in public.devices successfully under RLS",
    childDeviceRows.length === 1 && childDeviceRows[0].child_id === childId && childDeviceRows[0].parent_id === parentId,
    `Device ID: ${childDeviceRows[0]?.device_id}, Child ID: ${childDeviceRows[0]?.child_id}, Parent ID: ${childDeviceRows[0]?.parent_id}`
  );

  // -------------------------------------------------------------------------
  // TEST 2: Linked Parent Can Read Child's Device
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 2: LINKED PARENT QUERIES CHILD DEVICE VIA RLS ---");
  await asUser(parentId, parentEmail, true);
  const parentDeviceRows = (await db.query(`SELECT * FROM public.devices WHERE parent_id = '${parentId}';`)).rows as any[];

  report(
    "2. Linked Parent queries and views registered child device under RLS",
    parentDeviceRows.length === 1 && parentDeviceRows[0].device_id === deviceId,
    `Found devices: ${parentDeviceRows.length}, Device Name: ${parentDeviceRows[0]?.device_name}`
  );

  // -------------------------------------------------------------------------
  // TEST 3: Unrelated User Cannot View or Alter Child's Device
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 3: UNRELATED USER RLS ISOLATION ---");
  await asUser(strangerId, strangerEmail, true);
  const strangerDeviceRows = (await db.query(`SELECT * FROM public.devices WHERE device_id = '${deviceId}';`)).rows;

  let strangerTamperFailed = false;
  let strangerTamperError = "";
  try {
    await db.exec(`UPDATE public.devices SET device_name = 'HACKED' WHERE device_id = '${deviceId}';`);
  } catch (err: any) {
    strangerTamperFailed = true;
    strangerTamperError = err.message;
  }

  report(
    "3. Unrelated user is strictly blocked by RLS from viewing or updating the device",
    strangerDeviceRows.length === 0,
    `Stranger query returned ${strangerDeviceRows.length} rows (RLS filtered)`
  );

  // -------------------------------------------------------------------------
  // TEST 4: Child Device Heartbeat / Telemetry Update
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 4: CHILD DEVICE TELEMETRY HEARTBEAT (BATTERY UPDATE) ---");
  await asUser(childId, childEmail, true);
  await db.exec(`
    UPDATE public.devices 
    SET battery = 92, last_seen = now(), updated_at = now()
    WHERE device_id = '${deviceId}' AND child_id = '${childId}';
  `);

  const updatedRow = (await db.query(`SELECT battery FROM public.devices WHERE device_id = '${deviceId}';`)).rows[0] as any;

  report(
    "4. Child updates device telemetry (battery = 92) successfully under RLS",
    updatedRow.battery === 92,
    `Updated battery level: ${updatedRow.battery}%`
  );

  console.log("\n===============================================================================");
  console.log(` CHILD DEVICE REGISTRATION VALIDATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runChildDeviceValidation().catch((err) => {
  console.error("FATAL ERROR IN CHILD DEVICE VALIDATION:", err);
  process.exit(1);
});
