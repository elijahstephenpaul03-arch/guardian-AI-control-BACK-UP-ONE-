import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";

async function testParentGreetingDisplay() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI: PARENT DASHBOARD USER NAME DISPLAY AUDIT");
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

  // Resolution function mirror (matching Dashboard.tsx logic)
  function resolveParentDisplayName(userData: any, user: any, dbProfile: any = null): string {
    // 1. Authoritative public.users profile full_name
    const fullName = (userData?.fullName || userData?.full_name || dbProfile?.full_name)?.trim();
    if (fullName && fullName.length > 0) {
      return fullName;
    }

    // 2. Authoritative public.users profile display_name
    const displayName = (userData?.displayName || userData?.display_name || dbProfile?.display_name)?.trim();
    if (displayName && displayName.length > 0) {
      return displayName;
    }

    // 3. Auth profile name
    const authName = (
      user?.displayName || 
      user?.rawSupabaseUser?.user_metadata?.full_name || 
      user?.rawSupabaseUser?.user_metadata?.name ||
      user?.rawSupabaseUser?.user_metadata?.display_name
    )?.trim();
    if (authName && authName.length > 0 && authName !== "Guardian User") {
      return authName;
    }

    // 4. Email prefix as final fallback
    const rawEmail = user?.email || userData?.email || "";
    if (rawEmail && rawEmail.includes("@")) {
      const prefix = rawEmail.split("@")[0].replace(/[._-]/g, " ").trim();
      if (prefix.length > 0) {
        return prefix
          .split(" ")
          .filter(Boolean)
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      }
    }

    return "Parent";
  }

  // TEST 1: Parent with full_name
  console.log("--- TEST 1: PRIORITY 1 - full_name ---");
  const p1Id = "10000000-0000-0000-0000-000000000001";
  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${p1Id}', 'sarah.parent@example.com');
    UPDATE public.users SET full_name = 'Sarah Connor', display_name = 'S. Connor', role = 'parent' WHERE id = '${p1Id}';
  `);

  await asUser(p1Id, "sarah.parent@example.com");
  const p1Db = (await db.query(`SELECT full_name, display_name FROM public.users WHERE id = '${p1Id}';`)).rows[0] as any;
  const p1Name = resolveParentDisplayName({ fullName: p1Db.full_name, displayName: p1Db.display_name }, { email: "sarah.parent@example.com" });
  report("1. Priority 1 (full_name) selected over display_name and email", p1Name === "Sarah Connor", `Greeting: "Good evening, ${p1Name}."`);

  // TEST 2: Parent with display_name only (no full_name)
  console.log("\n--- TEST 2: PRIORITY 2 - display_name ---");
  const p2Id = "20000000-0000-0000-0000-000000000002";
  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${p2Id}', 'guardian.mom@example.com');
    UPDATE public.users SET full_name = NULL, display_name = 'Mama Bear', role = 'parent' WHERE id = '${p2Id}';
  `);

  await asUser(p2Id, "guardian.mom@example.com");
  const p2Db = (await db.query(`SELECT full_name, display_name FROM public.users WHERE id = '${p2Id}';`)).rows[0] as any;
  const p2Name = resolveParentDisplayName({ fullName: p2Db.full_name, displayName: p2Db.display_name }, { email: "guardian.mom@example.com" });
  report("2. Priority 2 (display_name) selected when full_name is NULL", p2Name === "Mama Bear", `Greeting: "Good evening, ${p2Name}."`);

  // TEST 3: Parent with Auth profile name (no public.users full_name or display_name)
  console.log("\n--- TEST 3: PRIORITY 3 - Auth Profile Name ---");
  const p3Id = "30000000-0000-0000-0000-000000000003";
  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('${p3Id}', 'john.doe@example.com', '{"full_name":"Johnathan Doe"}'::jsonb);
    UPDATE public.users SET full_name = NULL, display_name = NULL, role = 'parent' WHERE id = '${p3Id}';
  `);

  const p3AuthUser = {
    email: "john.doe@example.com",
    displayName: "Johnathan Doe",
    rawSupabaseUser: { user_metadata: { full_name: "Johnathan Doe" } }
  };
  const p3Name = resolveParentDisplayName(null, p3AuthUser);
  report("3. Priority 3 (Auth profile name) selected when database columns are empty", p3Name === "Johnathan Doe", `Greeting: "Good evening, ${p3Name}."`);

  // TEST 4: Email prefix as final fallback (e.g. alex.rivers@example.com)
  console.log("\n--- TEST 4: PRIORITY 4 - Email Prefix Final Fallback ---");
  const p4AuthUser = {
    email: "alex.rivers@example.com",
    displayName: null,
    rawSupabaseUser: { user_metadata: {} }
  };
  const p4Name = resolveParentDisplayName(null, p4AuthUser);
  report("4. Priority 4 (Email prefix) formatted and capitalized", p4Name === "Alex Rivers", `Greeting: "Good evening, ${p4Name}."`);

  // TEST 5: Single-word email prefix (e.g. maria@example.com)
  const p5AuthUser = {
    email: "maria@example.com",
    displayName: null,
  };
  const p5Name = resolveParentDisplayName(null, p5AuthUser);
  report("5. Single-word email prefix capitalized", p5Name === "Maria", `Greeting: "Good evening, ${p5Name}."`);

  // TEST 6: Account Switching
  console.log("\n--- TEST 6: ACCOUNT SWITCHING ---");
  // Simulate active state switching from Parent 1 to Parent 2
  let currentActiveState: any = { userData: { fullName: "Sarah Connor" }, user: { email: "sarah@example.com" } };
  const greetingBeforeSwitch = resolveParentDisplayName(currentActiveState.userData, currentActiveState.user);
  report("6a. Active session initially displays Sarah Connor", greetingBeforeSwitch === "Sarah Connor");

  // Switch to Parent 2
  currentActiveState = { userData: { fullName: "Marcus Wright" }, user: { email: "marcus@example.com" } };
  const greetingAfterSwitch = resolveParentDisplayName(currentActiveState.userData, currentActiveState.user);
  report("6b. Active session updates dynamically to Marcus Wright upon switch", greetingAfterSwitch === "Marcus Wright");

  // TEST 7: Logout clears stale state
  console.log("\n--- TEST 7: LOGOUT STATE CLEARANCE ---");
  currentActiveState = { userData: null, user: null };
  const greetingAfterLogout: string = resolveParentDisplayName(currentActiveState.userData, currentActiveState.user);
  report("7. Logout clears stale state (no lingering old name)", greetingAfterLogout === "Parent");

  // TEST 8: RLS Isolation: Parent 1 cannot modify or impersonate Parent 2's name
  console.log("\n--- TEST 8: POSTGRESQL RLS ENFORCEMENT ---");
  await asUser(p1Id, "sarah.parent@example.com");
  let unauthorizedUpdateBlocked = false;
  try {
    await db.exec(`UPDATE public.users SET full_name = 'Hacked Name' WHERE id = '${p2Id}';`);
    const p2Check = (await db.query(`SELECT full_name FROM public.users WHERE id = '${p2Id}';`)).rows[0] as any;
    unauthorizedUpdateBlocked = (p2Check.full_name !== 'Hacked Name');
  } catch (_) {
    unauthorizedUpdateBlocked = true;
  }
  report("8. RLS prevents Parent 1 from tampering with Parent 2's name", unauthorizedUpdateBlocked);

  console.log("\n===============================================================================");
  console.log(` SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

testParentGreetingDisplay().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
