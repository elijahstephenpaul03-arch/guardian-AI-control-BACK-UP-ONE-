import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";

async function runPhase21CrudTestSuite() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI: SUPABASE EDITION - PHASE 2.1 CRUD & RLS INTEGRATION TEST SUITE");
  console.log(" Modules: Safe Zones, Homework, Daily Goals, Activity Logs, Dangerous Events, System Config");
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

  // 2. Apply all schema migrations in order
  console.log("-> 2. Applying Schema & RLS Migrations (0 to 6)...");
  const migrations = [
    "20261105000000_initial_schema.sql",
    "20261105000001_rls_policies.sql",
    "20261105000002_family_linking.sql",
    "20261105000003_sos_realtime.sql",
    "20261105000004_device_schema_sync.sql",
    "20261105000005_cyber_smart_quiz.sql",
    "20261105000006_fix_device_registration_rls.sql"
  ];

  for (const mig of migrations) {
    const migPath = path.join(process.cwd(), "supabase", "migrations", mig);
    if (fs.existsSync(migPath)) {
      const sql = fs.readFileSync(migPath, "utf-8");
      await db.exec(sql);
      console.log(`   Applied: ${mig}`);
    } else {
      console.warn(`   Missing migration: ${mig}`);
    }
  }

  // 3. Setup Authoritative Identities
  console.log("\n-> 3. Seeding Test Families and Accounts...");
  const parent1Id = "66a15189-8419-45e1-9dfc-d5f2d0ed22e6";
  const parent1Email = "parent1@guardian.ai";
  const fam1Code = "3WPAZN";

  const child1Id = "c00379b3-4014-44ad-8428-69b38e9851e8";
  const child1Email = "futurecompany852@gmail.com";

  const parent2Id = "22222222-2222-2222-2222-222222222222";
  const parent2Email = "unrelated.parent@guardian.ai";
  const fam2Code = "UNREL9";

  const child2Id = "33333333-3333-3333-3333-333333333333";
  const child2Email = "unrelated.child@guardian.ai";

  const adminId = "99999999-9999-9999-9999-999999999999";
  const adminEmail = "admin@guardian.ai";

  await db.exec(`RESET ROLE;`);
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES 
      ('${parent1Id}', '${parent1Email}', '{"role": "parent", "full_name": "Elijah Stephen"}'),
      ('${child1Id}', '${child1Email}', '{"role": "child", "full_name": "Leo Paul"}'),
      ('${parent2Id}', '${parent2Email}', '{"role": "parent", "full_name": "Sarah Connor"}'),
      ('${child2Id}', '${child2Email}', '{"role": "child", "full_name": "John Connor"}'),
      ('${adminId}', '${adminEmail}', '{"role": "admin", "full_name": "Root Administrator"}')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.families (family_code, family_name, owner_parent_id, parent_email)
    VALUES 
      ('${fam1Code}', 'Elijah Family', '${parent1Id}', '${parent1Email}'),
      ('${fam2Code}', 'Connor Family', '${parent2Id}', '${parent2Email}')
    ON CONFLICT (family_code) DO NOTHING;

    INSERT INTO public.users (id, email, role, full_name, family_code, parent_id, disabled)
    VALUES
      ('${parent1Id}', '${parent1Email}', 'parent', 'Elijah Stephen', '${fam1Code}', NULL, false),
      ('${child1Id}', '${child1Email}', 'child', 'Leo Paul', '${fam1Code}', '${parent1Id}', false),
      ('${parent2Id}', '${parent2Email}', 'parent', 'Sarah Connor', '${fam2Code}', NULL, false),
      ('${child2Id}', '${child2Email}', 'child', 'John Connor', '${fam2Code}', '${parent2Id}', false),
      ('${adminId}', '${adminEmail}', 'admin', 'Root Administrator', NULL, NULL, false)
    ON CONFLICT (id) DO UPDATE SET 
      parent_id = EXCLUDED.parent_id,
      family_code = EXCLUDED.family_code;
  `);

  console.log("\n===============================================================================");
  console.log(" MODULE 1: SAFE ZONES CRUD & RLS VERIFICATION");
  console.log("===============================================================================");

  // 1.1 Parent 1 creates Safe Zone
  await asUser(parent1Id, parent1Email, true);
  let szId = "";
  try {
    const res = await db.query<{ id: string; name: string }>(`
      INSERT INTO public.safe_zones (parent_id, name, radius, lat, lng, active)
      VALUES ('${parent1Id}', 'Home Perimeter', 250, 17.4849, 78.3907, true)
      RETURNING id, name;
    `);
    szId = res.rows[0]?.id;
    report("Parent 1 creates Safe Zone", Boolean(szId), `Created zone ID: ${szId}`);
  } catch (err: any) {
    report("Parent 1 creates Safe Zone", false, err.message);
  }

  // 1.2 Parent 1 updates Safe Zone
  try {
    const res = await db.query<{ radius: number }>(`
      UPDATE public.safe_zones
      SET radius = 350
      WHERE id = '${szId}'
      RETURNING radius;
    `);
    report("Parent 1 updates Safe Zone radius", res.rows[0]?.radius === 350, `New radius: ${res.rows[0]?.radius}`);
  } catch (err: any) {
    report("Parent 1 updates Safe Zone radius", false, err.message);
  }

  // 1.3 Child 1 (linked) can read Parent 1's Safe Zone
  await asUser(child1Id, child1Email, true);
  try {
    const res = await db.query<{ id: string; name: string }>(`
      SELECT id, name FROM public.safe_zones WHERE id = '${szId}';
    `);
    report("Linked Child 1 can read Parent 1's Safe Zone", res.rows.length === 1, `Found: ${res.rows[0]?.name}`);
  } catch (err: any) {
    report("Linked Child 1 can read Parent 1's Safe Zone", false, err.message);
  }

  // 1.4 Unrelated Parent 2 CANNOT read Parent 1's Safe Zone
  await asUser(parent2Id, parent2Email, true);
  try {
    const res = await db.query(`SELECT id FROM public.safe_zones WHERE id = '${szId}';`);
    report("Unrelated Parent 2 cannot read Parent 1's Safe Zone (RLS isolation)", res.rows.length === 0, `Rows visible: ${res.rows.length}`);
  } catch (err: any) {
    report("Unrelated Parent 2 cannot read Parent 1's Safe Zone (RLS isolation)", false, err.message);
  }

  // 1.5 Unrelated Parent 2 CANNOT update or delete Parent 1's Safe Zone
  try {
    const res = await db.query(`UPDATE public.safe_zones SET name = 'Hacked' WHERE id = '${szId}';`);
    report("Unrelated Parent 2 cannot update Parent 1's Safe Zone", res.affectedRows === 0, `Affected rows: ${res.affectedRows}`);
  } catch (err: any) {
    report("Unrelated Parent 2 cannot update Parent 1's Safe Zone", true, `Blocked by RLS: ${err.message}`);
  }

  // 1.6 Parent 1 deletes Safe Zone
  await asUser(parent1Id, parent1Email, true);
  try {
    const res = await db.query(`DELETE FROM public.safe_zones WHERE id = '${szId}';`);
    report("Parent 1 can delete their own Safe Zone", res.affectedRows === 1, `Deleted row count: ${res.affectedRows}`);
  } catch (err: any) {
    report("Parent 1 can delete their own Safe Zone", false, err.message);
  }

  console.log("\n===============================================================================");
  console.log(" MODULE 2: HOMEWORK TASKS CRUD & RLS VERIFICATION");
  console.log("===============================================================================");

  // 2.1 Parent 1 creates Homework task for Child 1
  let hwId = "";
  try {
    const res = await db.query<{ id: string; title: string }>(`
      INSERT INTO public.homework (child_id, title, subject, due_date, completed, notes)
      VALUES ('${child1Id}', 'Complete Chapter 4 Algebra', 'Mathematics', now() + interval '2 days', false, 'Pages 80-84')
      RETURNING id, title;
    `);
    hwId = res.rows[0]?.id;
    report("Parent 1 creates Homework for linked Child 1", Boolean(hwId), `Created task ID: ${hwId}`);
  } catch (err: any) {
    report("Parent 1 creates Homework for linked Child 1", false, err.message);
  }

  // 2.2 Child 1 reads and completes Homework task
  await asUser(child1Id, child1Email, true);
  try {
    const res = await db.query<{ id: string; title: string }>(`
      SELECT id, title FROM public.homework WHERE id = '${hwId}';
    `);
    report("Child 1 can read assigned Homework", res.rows.length === 1, `Found: ${res.rows[0]?.title}`);

    const updateRes = await db.query<{ completed: boolean }>(`
      UPDATE public.homework
      SET completed = true
      WHERE id = '${hwId}'
      RETURNING completed;
    `);
    report("Child 1 marks Homework completed", updateRes.rows[0]?.completed === true, `Completed: ${updateRes.rows[0]?.completed}`);
  } catch (err: any) {
    report("Child 1 reads and completes Homework", false, err.message);
  }

  // 2.3 Unrelated Parent 2 CANNOT read or update Child 1's Homework
  await asUser(parent2Id, parent2Email, true);
  try {
    const readRes = await db.query(`SELECT id FROM public.homework WHERE id = '${hwId}';`);
    report("Unrelated Parent 2 cannot read Child 1's Homework", readRes.rows.length === 0, `Rows visible: ${readRes.rows.length}`);

    const writeRes = await db.query(`UPDATE public.homework SET title = 'Hacked HW' WHERE id = '${hwId}';`);
    report("Unrelated Parent 2 cannot update Child 1's Homework", writeRes.affectedRows === 0, `Affected rows: ${writeRes.affectedRows}`);
  } catch (err: any) {
    report("Unrelated Parent 2 cannot touch Child 1's Homework", true, `Blocked: ${err.message}`);
  }

  // 2.4 Parent 1 deletes Homework
  await asUser(parent1Id, parent1Email, true);
  try {
    const res = await db.query(`DELETE FROM public.homework WHERE id = '${hwId}';`);
    report("Parent 1 can delete completed Homework", res.affectedRows === 1, `Deleted row count: ${res.affectedRows}`);
  } catch (err: any) {
    report("Parent 1 can delete completed Homework", false, err.message);
  }

  console.log("\n===============================================================================");
  console.log(" MODULE 3: DAILY GOALS CRUD & RLS VERIFICATION");
  console.log("===============================================================================");

  // 3.1 Child 1 creates Daily Goal
  await asUser(child1Id, child1Email, true);
  let goalId = "";
  try {
    const res = await db.query<{ id: string; title: string }>(`
      INSERT INTO public.daily_goals (child_id, title, category, target_minutes, completed_minutes, completed)
      VALUES ('${child1Id}', 'Practice Coding on Khan Academy', 'learning', 45, 0, false)
      RETURNING id, title;
    `);
    goalId = res.rows[0]?.id;
    report("Child 1 creates Daily Goal", Boolean(goalId), `Goal ID: ${goalId}`);
  } catch (err: any) {
    report("Child 1 creates Daily Goal", false, err.message);
  }

  // 3.2 Child 1 updates Daily Goal progress
  try {
    const res = await db.query<{ completed_minutes: number; completed: boolean }>(`
      UPDATE public.daily_goals
      SET completed_minutes = 45, completed = true
      WHERE id = '${goalId}'
      RETURNING completed_minutes, completed;
    `);
    report("Child 1 updates Daily Goal progress to completed", res.rows[0]?.completed === true && res.rows[0]?.completed_minutes === 45, `Minutes: ${res.rows[0]?.completed_minutes}`);
  } catch (err: any) {
    report("Child 1 updates Daily Goal progress", false, err.message);
  }

  // 3.3 Parent 1 can read Child 1's Daily Goal
  await asUser(parent1Id, parent1Email, true);
  try {
    const res = await db.query<{ id: string; title: string }>(`
      SELECT id, title FROM public.daily_goals WHERE id = '${goalId}';
    `);
    report("Parent 1 can read linked Child 1's Daily Goal", res.rows.length === 1, `Found: ${res.rows[0]?.title}`);
  } catch (err: any) {
    report("Parent 1 can read linked Child 1's Daily Goal", false, err.message);
  }

  // 3.4 Unrelated Parent 2 CANNOT read or update Child 1's Daily Goal
  await asUser(parent2Id, parent2Email, true);
  try {
    const readRes = await db.query(`SELECT id FROM public.daily_goals WHERE id = '${goalId}';`);
    report("Unrelated Parent 2 cannot read Child 1's Daily Goal", readRes.rows.length === 0, `Rows visible: ${readRes.rows.length}`);

    const writeRes = await db.query(`UPDATE public.daily_goals SET title = 'Hacked Goal' WHERE id = '${goalId}';`);
    report("Unrelated Parent 2 cannot update Child 1's Daily Goal", writeRes.affectedRows === 0, `Affected rows: ${writeRes.affectedRows}`);
  } catch (err: any) {
    report("Unrelated Parent 2 cannot touch Child 1's Daily Goal", true, `Blocked: ${err.message}`);
  }

  console.log("\n===============================================================================");
  console.log(" MODULE 4: ACTIVITY LOGS CRUD & RLS VERIFICATION");
  console.log("===============================================================================");

  // 4.1 Child 1 records Activity Log
  await asUser(child1Id, child1Email, true);
  let logId = "";
  try {
    const res = await db.query<{ id: string; type: string }>(`
      INSERT INTO public.activity_logs (parent_id, child_id, type, detail, app, duration, category, status)
      VALUES ('${parent1Id}', '${child1Id}', 'app', 'Launched Duolingo language lesson', 'Duolingo', 20, 'education', 'normal')
      RETURNING id, type;
    `);
    logId = res.rows[0]?.id;
    report("Child 1 records Activity Log", Boolean(logId), `Log ID: ${logId}`);
  } catch (err: any) {
    report("Child 1 records Activity Log", false, err.message);
  }

  // 4.2 Parent 1 reads Child 1's Activity Log
  await asUser(parent1Id, parent1Email, true);
  try {
    const res = await db.query<{ id: string; detail: string }>(`
      SELECT id, detail FROM public.activity_logs WHERE id = '${logId}';
    `);
    report("Parent 1 reads linked Child 1's Activity Log", res.rows.length === 1, `Detail: ${res.rows[0]?.detail}`);
  } catch (err: any) {
    report("Parent 1 reads linked Child 1's Activity Log", false, err.message);
  }

  // 4.3 Unrelated Parent 2 CANNOT read Child 1's Activity Log
  await asUser(parent2Id, parent2Email, true);
  try {
    const res = await db.query(`SELECT id FROM public.activity_logs WHERE id = '${logId}';`);
    report("Unrelated Parent 2 cannot read Child 1's Activity Log", res.rows.length === 0, `Rows visible: ${res.rows.length}`);
  } catch (err: any) {
    report("Unrelated Parent 2 cannot read Child 1's Activity Log", false, err.message);
  }

  console.log("\n===============================================================================");
  console.log(" MODULE 5: DANGEROUS EVENTS CRUD & RLS VERIFICATION");
  console.log("===============================================================================");

  // 5.1 System / Child records Dangerous Event
  await asUser(child1Id, child1Email, true);
  let eventId = "";
  try {
    const res = await db.query<{ id: string; target: string }>(`
      INSERT INTO public.dangerous_events (
        parent_id, child_id, category, target, risk_level, confidence, 
        reason, action_taken, suggested_action, status
      )
      VALUES (
        '${parent1Id}', '${child1Id}', 'phishing', 'https://fake-login-bank.xyz', 
        'high', 98, 'Deceptive login form detected in browser frame', 
        'Blocked DNS and navigation', 'Warn child about credential requests', 'blocked'
      )
      RETURNING id, target;
    `);
    eventId = res.rows[0]?.id;
    report("Child device records Dangerous Event", Boolean(eventId), `Event ID: ${eventId}`);
  } catch (err: any) {
    report("Child device records Dangerous Event", false, err.message);
  }

  // 5.2 Parent 1 reads Dangerous Event
  await asUser(parent1Id, parent1Email, true);
  try {
    const res = await db.query<{ id: string; target: string; risk_level: string }>(`
      SELECT id, target, risk_level FROM public.dangerous_events WHERE id = '${eventId}';
    `);
    report("Parent 1 reads Dangerous Event", res.rows.length === 1 && res.rows[0]?.risk_level === "high", `Target: ${res.rows[0]?.target}`);
  } catch (err: any) {
    report("Parent 1 reads Dangerous Event", false, err.message);
  }

  // 5.3 Unrelated Parent 2 CANNOT read Dangerous Event
  await asUser(parent2Id, parent2Email, true);
  try {
    const res = await db.query(`SELECT id FROM public.dangerous_events WHERE id = '${eventId}';`);
    report("Unrelated Parent 2 cannot read Child 1's Dangerous Event", res.rows.length === 0, `Rows visible: ${res.rows.length}`);
  } catch (err: any) {
    report("Unrelated Parent 2 cannot read Child 1's Dangerous Event", false, err.message);
  }

  console.log("\n===============================================================================");
  console.log(" MODULE 6: SYSTEM CONFIGURATION CRUD & RLS VERIFICATION");
  console.log("===============================================================================");

  // 6.1 Public / Authenticated read is permitted
  await asUser(child1Id, child1Email, true);
  try {
    const res = await db.query(`SELECT key, value FROM public.system_config;`);
    report("Authenticated user can read system_config", Array.isArray(res.rows), `Read succeeded (${res.rows.length} rows)`);
  } catch (err: any) {
    report("Authenticated user can read system_config", false, err.message);
  }

  // 6.2 Non-admin (Child 1) CANNOT update system_config
  try {
    await db.query(`
      INSERT INTO public.system_config (key, value)
      VALUES ('platform_config', '{"hacked": true}'::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
    `);
    report("Child 1 rejected from updating system_config", false, "Should have been rejected by RLS");
  } catch (err: any) {
    report("Child 1 rejected from updating system_config", true, `Blocked by RLS: ${err.message}`);
  }

  // 6.3 Non-admin (Parent 1) CANNOT update system_config
  await asUser(parent1Id, parent1Email, true);
  try {
    await db.query(`
      INSERT INTO public.system_config (key, value)
      VALUES ('platform_config', '{"hacked_by_parent": true}'::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
    `);
    report("Parent 1 rejected from updating system_config", false, "Should have been rejected by RLS");
  } catch (err: any) {
    report("Parent 1 rejected from updating system_config", true, `Blocked by RLS: ${err.message}`);
  }

  // 6.4 Admin CAN update system_config
  await asUser(adminId, adminEmail, true);
  try {
    await db.query(`
      INSERT INTO public.system_config (key, value, updated_at)
      VALUES ('platform_config', '{"emergencyBroadcast": {"active": true, "message": "Platform Maintenance Notice"}, "maxScreenTimeCap": 300}'::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
    `);
    const checkRes = await db.query<{ key: string; value: any }>(`
      SELECT key, value FROM public.system_config WHERE key = 'platform_config';
    `);
    const cap = checkRes.rows[0]?.value?.maxScreenTimeCap;
    report("Admin successfully updates system_config", cap === 300, `Screen time cap: ${cap}`);
  } catch (err: any) {
    report("Admin successfully updates system_config", false, err.message);
  }

  console.log("\n===============================================================================");
  console.log(` FINAL RESULTS: Passed: ${passed} | Failed: ${failed}`);
  console.log("===============================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase21CrudTestSuite().catch(err => {
  console.error("FATAL ERROR in Phase 2.1 Test Suite:", err);
  process.exit(1);
});
