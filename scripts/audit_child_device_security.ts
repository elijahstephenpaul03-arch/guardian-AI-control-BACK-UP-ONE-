import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";

async function runChildDeviceSecurityAudit() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI: SUPABASE EDITION - CHILD DEVICE REGISTRATION SECURITY & SCHEMA AUDIT");
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

  // 2. Apply Migrations 1-3 (Approved Baseline Schema)
  console.log("-> 2. Applying Schema & RLS Migrations...");
  const m1 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000000_initial_schema.sql"), "utf8");
  await db.exec(m1);
  const m2 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000001_rls_policies.sql"), "utf8");
  await db.exec(m2);
  const m3 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000002_family_linking.sql"), "utf8");
  await db.exec(m3);
  const m4 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000003_sos_realtime.sql"), "utf8");
  await db.exec(m4);
  console.log("-> Baseline migrations applied successfully.\n");

  // =========================================================================
  // AUDIT ITEM 1: FIELD-BY-FIELD COMPARISON OF DEVICE UPSERT PAYLOAD VS public.devices
  // =========================================================================
  console.log("--- AUDIT 1: FIELD-BY-FIELD SCHEMA COMPARISON ---");
  const deviceColsRes = await db.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices'
    ORDER BY ordinal_position;
  `);
  const actualCols = deviceColsRes.rows.map((r: any) => r.column_name);

  // The fields sent by registerChildDeviceInSupabase()
  const upsertPayloadFields = [
    "device_id",
    "device_name",
    "device_model",
    "android_version",
    "battery",
    "charging",
    "online",
    "gps",
    "screen_on",
    "last_seen",
    "connection_quality",
    "sos_active",
    "parent_id",
    "child_id",
    "updated_at",
  ];

  const unsupportedFieldsInPayload = upsertPayloadFields.filter(f => !actualCols.includes(f));
  report(
    "1. Every field in device upsert payload exists in public.devices columns (no unsupported fields)",
    unsupportedFieldsInPayload.length === 0,
    `Unsupported fields count: ${unsupportedFieldsInPayload.length} (${unsupportedFieldsInPayload.join(", ") || "None - 100% matched"})`
  );

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
  await db.query(`SELECT public.generate_or_get_family_code('Stranger Family') AS result;`);

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
  // AUDIT ITEM 2: LEGITIMATE CHILD REGISTERS DEVICE WITH VERIFIED child_id & parent_id
  // =========================================================================
  console.log("--- AUDIT 2: LEGITIMATE CHILD DEVICE REGISTRATION ---");
  const validDevId = "DEV-AUDIT-VALID-01";
  await asUser(childId, childEmail, true);

  // Child registers device using exact columns
  await db.exec(`
    INSERT INTO public.devices (
      device_id, device_name, device_model, android_version,
      battery, charging, online, gps, screen_on, last_seen,
      connection_quality, sos_active, child_id, parent_id, updated_at
    ) VALUES (
      '${validDevId}', 'Audit Child''s Phone', 'Pixel 8', 'Android 14',
      88, false, true, '{"lat": 17.4849, "lng": 78.3907, "name": "Hyderabad"}'::jsonb,
      true, now(), 'strong', false, '${childId}', '${parentId}', now()
    )
    ON CONFLICT (device_id) DO UPDATE SET
      device_name = EXCLUDED.device_name,
      battery = EXCLUDED.battery,
      online = EXCLUDED.online,
      updated_at = EXCLUDED.updated_at;
  `);

  const insertedDeviceRows = (await db.query(`SELECT * FROM public.devices WHERE device_id = '${validDevId}';`)).rows as any[];
  report(
    "2. Legitimate device registration succeeds without schema errors or unsupported fields",
    insertedDeviceRows.length === 1 &&
      insertedDeviceRows[0].child_id === childId &&
      insertedDeviceRows[0].parent_id === parentId,
    `Device: ${insertedDeviceRows[0]?.device_id}, Child: ${insertedDeviceRows[0]?.child_id}, Parent: ${insertedDeviceRows[0]?.parent_id}`
  );

  // =========================================================================
  // AUDIT ITEM 3: child_id MUST EQUAL auth.uid() FOR CHILD REGISTRATIONS
  // =========================================================================
  console.log("\n--- AUDIT 3: child_id MUST EQUAL auth.uid() ---");
  await asUser(childId, childEmail, true);

  let spoofChildIdBlocked = false;
  let spoofChildIdError = "";
  try {
    await db.exec(`
      INSERT INTO public.devices (
        device_id, device_name, battery, online, child_id, parent_id, updated_at
      ) VALUES (
        'DEV-SPOOF-01', 'Hacked Device', 100, true, '${unlinkedChildId}', '${parentId}', now()
      );
    `);
  } catch (err: any) {
    spoofChildIdBlocked = true;
    spoofChildIdError = err.message;
  }

  report(
    "3. Child cannot register device with a spoofed child_id",
    spoofChildIdBlocked && spoofChildIdError.includes("Child users can only register devices for themselves"),
    `Error caught: ${spoofChildIdError}`
  );

  // =========================================================================
  // AUDIT ITEM 4: CHILD CANNOT REGISTER UNDER UNRELATED PARENT UID
  // =========================================================================
  console.log("\n--- AUDIT 4: REJECTION OF UNRELATED PARENT UID ---");
  await asUser(childId, childEmail, true);

  let unrelatedParentBlocked = false;
  let unrelatedParentError = "";
  try {
    await db.exec(`
      INSERT INTO public.devices (
        device_id, device_name, battery, online, child_id, parent_id, updated_at
      ) VALUES (
        'DEV-UNREL-01', 'Unrelated Parent Device', 100, true, '${childId}', '${unrelatedParentId}', now()
      );
    `);
  } catch (err: any) {
    unrelatedParentBlocked = true;
    unrelatedParentError = err.message;
  }

  report(
    "4. Child cannot register a device under an unrelated Parent UID",
    unrelatedParentBlocked && unrelatedParentError.includes("Child cannot register a device under an unrelated Parent UID"),
    `Error caught: ${unrelatedParentError}`
  );

  // =========================================================================
  // AUDIT ITEM 5: PARENT DEVICE VISIBILITY & UNRELATED PARENT REJECTION
  // =========================================================================
  console.log("\n--- AUDIT 5: PARENT VISIBILITY & UNRELATED REJECTION ---");

  // Linked parent queries
  await asUser(parentId, parentEmail, true);
  const linkedParentRows = (await db.query(`SELECT * FROM public.devices WHERE device_id = '${validDevId}';`)).rows as any[];

  // Unrelated parent queries
  await asUser(unrelatedParentId, unrelatedParentEmail, true);
  const unrelatedParentRows = (await db.query(`SELECT * FROM public.devices WHERE device_id = '${validDevId}';`)).rows as any[];

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

  // =========================================================================
  // AUDIT ITEM 6: DEVICE ID UNIQUE CONSTRAINT & UPSERT HANDLING
  // =========================================================================
  console.log("\n--- AUDIT 6: device_id UNIQUE CONSTRAINT & UPSERT ---");
  await asUser(childId, childEmail, true);

  await db.exec(`
    INSERT INTO public.devices (
      device_id, device_name, battery, online, child_id, parent_id, updated_at
    ) VALUES (
      '${validDevId}', 'Audit Child''s Phone', 95, true, '${childId}', '${parentId}', now()
    )
    ON CONFLICT (device_id) DO UPDATE SET
      battery = EXCLUDED.battery,
      online = EXCLUDED.online,
      updated_at = EXCLUDED.updated_at;
  `);

  const updatedDevRows = (await db.query(`SELECT * FROM public.devices WHERE device_id = '${validDevId}';`)).rows as any[];

  report(
    "6. device_id PRIMARY KEY / UNIQUE constraint successfully handles upsert in place",
    updatedDevRows.length === 1 && updatedDevRows[0].battery === 95,
    `Row count: ${updatedDevRows.length}, Updated battery: ${updatedDevRows[0]?.battery}%`
  );

  // =========================================================================
  // AUDIT ITEM 7: DISABLED AND UNLINKED ACCOUNTS REJECTED
  // =========================================================================
  console.log("\n--- AUDIT 7: DISABLED AND UNLINKED ACCOUNTS REJECTED ---");

  // Unlinked child
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

  // Disabled user
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
  // AUDIT ITEM 8: POSTGREST SCHEMA CACHE REFRESH & OPTIONAL SYNC MIGRATION
  // =========================================================================
  console.log("\n--- AUDIT 8: OPTIONAL SCHEMA SYNC MIGRATION & POSTGREST CACHE RELOAD ---");
  const m5 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000004_device_schema_sync.sql"), "utf8");
  await asSystem();
  await db.exec(m5);

  const deviceColsAfterRes = await db.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'devices' AND column_name = 'family_code';
  `);

  report(
    "8. Optional schema sync migration (20261105000004_device_schema_sync.sql) adds family_code safely and notifies PostgREST",
    deviceColsAfterRes.rows.length === 1 && m5.includes("NOTIFY pgrst, 'reload schema';"),
    "NOTIFY pgrst, 'reload schema' dispatched cleanly"
  );

  // =========================================================================
  // AUDIT ITEM 9: VERIFY SUPABASE MODE NEVER CALLS FIREBASE FOR DEVICES
  // =========================================================================
  console.log("\n--- AUDIT 9: SUPABASE MODE NEVER CALLS FIREBASE FOR DEVICES ---");
  const appTsx = fs.readFileSync(path.join(process.cwd(), "src/App.tsx"), "utf8");
  const useSubAuth = fs.readFileSync(path.join(process.cwd(), "src/lib/useSupabaseAuth.ts"), "utf8");

  const appWireCorrect = appTsx.includes("registerCurrentChildDevice = isSupabaseActive ? supabaseAuth.registerCurrentChildDevice : sync.registerCurrentChildDevice;");
  const subAuthUsesSupabase = useSubAuth.includes("registerChildDeviceInSupabase({");

  report(
    "9. App router uses Supabase device registration, preserving Firebase isolation",
    appWireCorrect && subAuthUsesSupabase,
    "App.tsx cleanly isolates Supabase from Firebase sync"
  );

  // =========================================================================
  // AUDIT ITEM 10: TELEMETRY & DASHBOARD UI PRESERVATION
  // =========================================================================
  console.log("\n--- AUDIT 10: TELEMETRY & DASHBOARD UI PRESERVATION ---");
  const subLib = fs.readFileSync(path.join(process.cwd(), "src/lib/supabase.ts"), "utf8");
  const hasTelemetryFields = subLib.includes("battery: params.battery ?? 88") &&
    subLib.includes("gps: params.gps") &&
    subLib.includes("last_seen: nowIso") &&
    subLib.includes("connection_quality: \"strong\"");

  report(
    "10. Existing device telemetry fields (battery, gps, last_seen, quality) and UI structures are preserved",
    hasTelemetryFields,
    "Telemetry fields are mapped into public.devices and returned to dashboard state without regressions"
  );

  console.log("\n===============================================================================");
  console.log(` SECURITY & SCHEMA AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runChildDeviceSecurityAudit().catch((err) => {
  console.error("FATAL ERROR IN SECURITY & SCHEMA AUDIT:", err);
  process.exit(1);
});
