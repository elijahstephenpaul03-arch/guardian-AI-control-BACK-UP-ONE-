import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";

async function runDeviceRlsEdgeCasesTest() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI: SUPABASE EDITION - DEVICE RLS ERROR & OWNERSHIP EDGE-CASE AUDIT");
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
  const m4 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000003_sos_realtime.sql"), "utf8");
  await db.exec(m4);
  const m5 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000004_device_schema_sync.sql"), "utf8");
  await db.exec(m5);
  console.log("-> Migrations applied successfully.\n");

  // 3. Define Test Identities
  const parent1Id = "71000000-0000-0000-0000-000000000001";
  const parent1Email = "parent1.edge@guardian.test";

  const child1Id = "71000000-0000-0000-0000-000000000002";
  const child1Email = "child1.edge@guardian.test";

  const child2Id = "71000000-0000-0000-0000-000000000003";
  const child2Email = "child2.edge@guardian.test";

  const parent2Id = "71000000-0000-0000-0000-000000000004";
  const parent2Email = "parent2.edge@guardian.test";

  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) VALUES
      ('${parent1Id}', '${parent1Email}', '{"role":"parent","full_name":"Parent 1"}'::jsonb, now()),
      ('${child1Id}', '${child1Email}', '{"role":"child","full_name":"Child 1"}'::jsonb, now()),
      ('${child2Id}', '${child2Email}', '{"role":"child","full_name":"Child 2"}'::jsonb, now()),
      ('${parent2Id}', '${parent2Email}', '{"role":"parent","full_name":"Unrelated Parent 2"}'::jsonb, now());
  `);

  // Parent 1 Family
  await asUser(parent1Id, parent1Email, true);
  const fam1Res = (await db.query(`SELECT public.generate_or_get_family_code('Edge Family 1') AS result;`)).rows[0] as any;
  const fam1Code = (typeof fam1Res.result === "string" ? JSON.parse(fam1Res.result) : fam1Res.result).family_code;

  // Parent 2 Family
  await asUser(parent2Id, parent2Email, true);
  const fam2Res = (await db.query(`SELECT public.generate_or_get_family_code('Edge Family 2') AS result;`)).rows[0] as any;
  const fam2Code = (typeof fam2Res.result === "string" ? JSON.parse(fam2Res.result) : fam2Res.result).family_code;

  // Child 1 links to Parent 1
  await asUser(child1Id, child1Email, true);
  const linkReq1 = (await db.query(`SELECT public.submit_family_link_request('${fam1Code}') AS result;`)).rows[0] as any;
  const linkReq1Id = (typeof linkReq1.result === "string" ? JSON.parse(linkReq1.result) : linkReq1.result).id;
  await asUser(parent1Id, parent1Email, true);
  await db.query(`SELECT public.respond_to_family_link_request('${linkReq1Id}', 'accept');`);

  // Child 2 links to Parent 2
  await asUser(child2Id, child2Email, true);
  const linkReq2 = (await db.query(`SELECT public.submit_family_link_request('${fam2Code}') AS result;`)).rows[0] as any;
  const linkReq2Id = (typeof linkReq2.result === "string" ? JSON.parse(linkReq2.result) : linkReq2.result).id;
  await asUser(parent2Id, parent2Email, true);
  await db.query(`SELECT public.respond_to_family_link_request('${linkReq2Id}', 'accept');`);

  console.log("-> Test Identities and Family Links initialized.\n");

  // =========================================================================
  // INVESTIGATION CAUSE 4 & 5: EXISTING DEVICE_ID CONFLICT TRIGGERING UPDATE POLICY
  // =========================================================================
  console.log("--- INVESTIGATION 4 & 5: EXISTING DEVICE_ID UPDATE CONFLICT ---");
  const device1Id = "DEV-COLLISION-TEST";

  // Step A: Child 1 registers DEV-COLLISION-TEST
  await asUser(child1Id, child1Email, true);
  await db.exec(`
    INSERT INTO public.devices (
      device_id, device_name, device_model, android_version,
      battery, charging, online, child_id, parent_id, updated_at
    ) VALUES (
      '${device1Id}', 'Child 1 Phone', 'Pixel 8', 'Android 14',
      90, false, true, '${child1Id}', '${parent1Id}', now()
    )
    ON CONFLICT (device_id) DO UPDATE SET
      battery = EXCLUDED.battery,
      updated_at = EXCLUDED.updated_at;
  `);

  const dev1Check = (await db.query(`SELECT * FROM public.devices WHERE device_id = '${device1Id}';`)).rows as any[];
  report(
    "Step A: Child 1 registers DEV-COLLISION-TEST successfully",
    dev1Check.length === 1 && dev1Check[0].child_id === child1Id,
    `Device owner: ${dev1Check[0]?.child_id}`
  );

  // Step B: Child 2 attempts to upsert DEV-COLLISION-TEST (simulating stale shared localStorage GUA_DEVICE_ID)
  await asUser(child2Id, child2Email, true);
  let crossUserUpsertFailed = false;
  let crossUserError = "";
  try {
    await db.exec(`
      INSERT INTO public.devices (
        device_id, device_name, device_model, android_version,
        battery, charging, online, child_id, parent_id, updated_at
      ) VALUES (
        '${device1Id}', 'Child 2 Phone', 'Galaxy S24', 'Android 14',
        75, false, true, '${child2Id}', '${parent2Id}', now()
      )
      ON CONFLICT (device_id) DO UPDATE SET
        battery = EXCLUDED.battery,
        child_id = EXCLUDED.child_id,
        parent_id = EXCLUDED.parent_id,
        updated_at = EXCLUDED.updated_at;
    `);
  } catch (err: any) {
    crossUserUpsertFailed = true;
    crossUserError = err.message;
  }

  report(
    "Step B: Cross-user upsert on existing device_id is correctly rejected by RLS (Root cause confirmed)",
    crossUserUpsertFailed && (crossUserError.includes("row-level security") || crossUserError.includes("42501")),
    `Error caught: ${crossUserError}`
  );

  // Step C: Child 2 registers with a fresh child-scoped device ID
  const device2Id = "DEV-CH2-UNIQUE-01";
  await asUser(child2Id, child2Email, true);
  await db.exec(`
    INSERT INTO public.devices (
      device_id, device_name, device_model, android_version,
      battery, charging, online, child_id, parent_id, updated_at
    ) VALUES (
      '${device2Id}', 'Child 2 Phone', 'Galaxy S24', 'Android 14',
      88, false, true, '${child2Id}', '${parent2Id}', now()
    )
    ON CONFLICT (device_id) DO UPDATE SET
      battery = EXCLUDED.battery,
      updated_at = EXCLUDED.updated_at;
  `);

  const dev2Check = (await db.query(`SELECT * FROM public.devices WHERE device_id = '${device2Id}';`)).rows as any[];
  report(
    "Step C: Child 2 registers with their own child-scoped device ID successfully",
    dev2Check.length === 1 && dev2Check[0].child_id === child2Id,
    `Device owner: ${dev2Check[0]?.child_id}`
  );

  // =========================================================================
  // INVESTIGATION CAUSE 2 & 3: auth.uid() == child_id and parent_id derived authoritatively
  // =========================================================================
  console.log("\n--- INVESTIGATION 2 & 3: child_id & parent_id DERIVATION ---");
  await asUser(child1Id, child1Email, true);

  // Child 1 telemetry heartbeat update on their own device (UPDATE policy)
  await db.exec(`
    INSERT INTO public.devices (
      device_id, device_name, battery, online, child_id, parent_id, updated_at
    ) VALUES (
      '${device1Id}', 'Child 1 Phone', 99, true, '${child1Id}', '${parent1Id}', now()
    )
    ON CONFLICT (device_id) DO UPDATE SET
      battery = EXCLUDED.battery,
      online = EXCLUDED.online,
      updated_at = EXCLUDED.updated_at;
  `);

  const updatedDev1 = (await db.query(`SELECT battery FROM public.devices WHERE device_id = '${device1Id}';`)).rows[0] as any;
  report(
    "Existing-device telemetry update succeeds under RLS UPDATE policy when child_id matches auth.uid()",
    updatedDev1?.battery === 99,
    `Updated battery: ${updatedDev1?.battery}%`
  );

  // =========================================================================
  // INVESTIGATION CAUSE 1: PARENT SESSION CALLING DEVICE REGISTRATION
  // =========================================================================
  console.log("\n--- INVESTIGATION 1: PARENT SESSION DEVICE REGISTRATION GUARD ---");
  await asUser(parent1Id, parent1Email, true);

  // If a parent attempts to register themselves as a child device (child_id = parent1Id)
  let parentSelfDeviceBlocked = false;
  let parentSelfError = "";
  try {
    await db.exec(`
      INSERT INTO public.devices (
        device_id, device_name, battery, online, child_id, parent_id, updated_at
      ) VALUES (
        'DEV-PARENT-SELF', 'Parent Laptop', 100, true, '${parent1Id}', '${parent1Id}', now()
      );
    `);
  } catch (err: any) {
    parentSelfDeviceBlocked = true;
    parentSelfError = err.message;
  }

  report(
    "Parent session attempting to register themselves as a child device is rejected by trigger",
    parentSelfDeviceBlocked && parentSelfError.includes("Parents can only manage devices for their verified linked children"),
    `Error caught: ${parentSelfError}`
  );

  // Parent 1 can view Child 1's device
  const p1Devices = (await db.query(`SELECT * FROM public.devices WHERE parent_id = '${parent1Id}';`)).rows as any[];
  report(
    "Linked Parent 1 can query and view Child 1's companion device via RLS",
    p1Devices.length === 1 && p1Devices[0].device_id === device1Id,
    `Parent 1 found ${p1Devices.length} device(s)`
  );

  // Parent 1 CANNOT view Child 2's device
  const p1ForeignDevices = (await db.query(`SELECT * FROM public.devices WHERE device_id = '${device2Id}';`)).rows as any[];
  report(
    "Parent 1 CANNOT view Child 2's companion device (RLS isolation)",
    p1ForeignDevices.length === 0,
    `Query returned ${p1ForeignDevices.length} rows (isolated by RLS)`
  );

  console.log("\n===============================================================================");
  console.log(` EDGE-CASE AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runDeviceRlsEdgeCasesTest().catch((err) => {
  console.error("FATAL ERROR IN EDGE-CASE AUDIT:", err);
  process.exit(1);
});
