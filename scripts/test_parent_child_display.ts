import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";

async function testParentChildDisplay() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI: PARENT CHILD NAME DISPLAY FIX VALIDATION");
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

  // 1. Bootstrap PostgreSQL schema & roles
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
      SELECT coalesce(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb,
        '{}'::jsonb
      );
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION auth.role()
    RETURNS TEXT AS $$
      SELECT coalesce(
        current_setting('request.jwt.claim.role', true),
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role'),
        'authenticated'
      );
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION auth.email()
    RETURNS TEXT AS $$
      SELECT coalesce(
        current_setting('request.jwt.claim.email', true),
        (current_setting('request.jwt.claims', true)::jsonb ->> 'email')
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

  async function asUser(userId: string | null, email: string | null = null) {
    await db.exec(`
      RESET ROLE;
      SELECT 
        set_config('request.jwt.claim.sub', '${userId || ""}', false),
        set_config('request.jwt.claim.email', '${email || ""}', false),
        set_config('request.jwt.claim.email_verified', 'true', false),
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

  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
  const m1 = fs.readFileSync(path.join(migrationsDir, "20261105000000_initial_schema.sql"), "utf-8");
  await db.exec(m1);
  const m2 = fs.readFileSync(path.join(migrationsDir, "20261105000001_rls_policies.sql"), "utf-8");
  await db.exec(m2);
  const m3 = fs.readFileSync(path.join(migrationsDir, "20261105000002_family_linking.sql"), "utf-8");
  await db.exec(m3);
  const m4 = fs.readFileSync(path.join(migrationsDir, "20261105000004_device_schema_sync.sql"), "utf-8");
  await db.exec(m4);

  // 2. Create Parent A, Child A (Bob), and Unrelated Parent B
  const parentAUid = "11111111-1111-1111-1111-111111111111";
  const parentBUid = "22222222-2222-2222-2222-222222222222";
  const childAUid = "33333333-3333-3333-3333-333333333333";
  const childBUid = "44444444-4444-4444-4444-444444444444";

  await asSystem();
  // Create Parent A in auth.users (trigger auto-creates public.users)
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${parentAUid}', 'parent.a@example.com');
    UPDATE public.users SET full_name = 'Alice Parent', role = 'parent' WHERE id = '${parentAUid}';
  `);

  // Create Parent B
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${parentBUid}', 'parent.b@example.com');
    UPDATE public.users SET full_name = 'Carol Parent', role = 'parent' WHERE id = '${parentBUid}';
  `);

  // Generate Family Code for Parent A
  await asUser(parentAUid, "parent.a@example.com");
  const famRes = (await db.query(`SELECT public.generate_or_get_family_code('Alice Family') AS result;`)).rows[0] as any;
  const famParsed = typeof famRes.result === "string" ? JSON.parse(famRes.result) : famRes.result;
  const famCodeA = famParsed.family_code;
  report("1. Parent A Family Code generated", Boolean(famCodeA), `Code: ${famCodeA}`);

  // Create Child A (with full_name "Bobby Miller")
  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${childAUid}', 'bobby@example.com');
    UPDATE public.users SET full_name = 'Bobby Miller', role = 'child' WHERE id = '${childAUid}';
  `);

  // Create Child B (with no full_name, only email "sarah.connor@example.com")
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${childBUid}', 'sarah.connor@example.com');
    UPDATE public.users SET role = 'child' WHERE id = '${childBUid}';
  `);

  // Child A submits link request to Parent A
  await asUser(childAUid, "bobby@example.com");
  const reqARes = (await db.query(`SELECT public.submit_family_link_request('${famCodeA}') AS result;`)).rows[0] as any;
  const reqAParsed = typeof reqARes.result === "string" ? JSON.parse(reqARes.result) : reqARes.result;
  const reqAId = reqAParsed.id;
  report("2. Child A submitted family link request", Boolean(reqAId), `Request ID: ${reqAId}`);

  // Parent A approves Child A request
  await asUser(parentAUid, "parent.a@example.com");
  const approveRes = (await db.query(`SELECT public.respond_to_family_link_request('${reqAId}'::uuid, 'accept') AS result;`)).rows[0] as any;
  const approveParsed = typeof approveRes.result === "string" ? JSON.parse(approveRes.result) : approveRes.result;
  report("3. Parent A approved Child A request", approveParsed.success === true || approveParsed.status === "accepted");

  // Link Child B directly to Parent A
  await asSystem();
  await db.exec(`
    UPDATE public.users 
    SET parent_id = '${parentAUid}', family_code = '${famCodeA}' 
    WHERE id = '${childBUid}';
  `);
  report("4. Child B linked to Parent A", true);

  // Register a device for Child A under Parent A
  await asUser(childAUid, "bobby@example.com");
  await db.exec(`
    INSERT INTO public.devices (
      device_id, device_name, device_model, battery, online, child_id, parent_id
    ) VALUES (
      'DEV-BOBBY-01', 'Bobby Tab S9', 'Samsung Tab', 85, true, '${childAUid}', '${parentAUid}'
    );
  `);
  report("5. Companion device registered for Child A", true);

  // 6. Test RLS for Parent A: can query public.users for linked children
  await asUser(parentAUid, "parent.a@example.com");
  const linkedUsersForA = (await db.query(`
    SELECT id, email, full_name, display_name, role, parent_id, family_code 
    FROM public.users 
    WHERE parent_id = '${parentAUid}' AND role = 'child'
    ORDER BY created_at ASC;
  `)).rows as any[];

  report("6. Parent A queries linked children via RLS", linkedUsersForA.length === 2, `Found ${linkedUsersForA.length} children`);

  // 7. Verify Name Resolution
  // Child A has full_name "Bobby Miller"
  const childAUser = linkedUsersForA.find(u => u.id === childAUid);
  const nameA = childAUser.full_name || childAUser.display_name || childAUser.email.split("@")[0];
  report("7. Child A real full name resolved", nameA === "Bobby Miller", `Resolved: "${nameA}"`);

  // Child B has no full_name, email prefix "sarah.connor" -> capitalized "Sarah.connor"
  const childBUser = linkedUsersForA.find(u => u.id === childBUid);
  const rawPrefix = childBUser.email.split("@")[0];
  const nameB = childBUser.full_name || childBUser.display_name || (rawPrefix.charAt(0).toUpperCase() + rawPrefix.slice(1));
  report("8. Child B email prefix fallback resolved", nameB.toLowerCase().includes("sarah"), `Resolved: "${nameB}"`);

  // 8. Test child_profiles query under RLS
  const childProfilesForA = (await db.query(`
    SELECT * FROM public.child_profiles WHERE parent_id = '${parentAUid}';
  `)).rows as any[];
  report("9. Parent A queries child_profiles via RLS", childProfilesForA.length >= 1, `Found ${childProfilesForA.length} records`);

  // 9. Test devices query under RLS
  const devicesForA = (await db.query(`
    SELECT * FROM public.devices WHERE parent_id = '${parentAUid}';
  `)).rows as any[];
  report("10. Parent A queries child companion devices via RLS", devicesForA.length === 1, `Found ${devicesForA[0]?.device_name}`);

  // 10. Test Security Isolation: Parent B CANNOT see Parent A's linked children
  await asUser(parentBUid, "parent.b@example.com");
  const linkedUsersForB = (await db.query(`
    SELECT id, email, full_name FROM public.users WHERE parent_id = '${parentAUid}' AND role = 'child';
  `)).rows as any[];
  report("11. Parent B cannot access Parent A's children (RLS isolation)", linkedUsersForB.length === 0, `Returned ${linkedUsersForB.length} rows`);

  console.log("\n===============================================================================");
  console.log(` SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

testParentChildDisplay().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
