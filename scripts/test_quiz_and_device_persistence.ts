import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";

async function runQuizAndDevicePersistenceTest() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI: SUPABASE EDITION - DEVICE RLS 42501 & QUIZ PERSISTENCE AUDIT");
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
  const parent1Id = "66a15189-8419-45e1-9dfc-d5f2d0ed22e6"; // Authoritative parent from hosted DB
  const parent1Email = "parent1@guardian.ai";
  const fam1Code = "3WPAZN"; // Authoritative permanent Family Code from hosted DB

  const child1Id = "c00379b3-4014-44ad-8428-69b38e9851e8"; // Authoritative child from hosted DB
  const child1Email = "futurecompany852@gmail.com";

  const parent2Id = "22222222-2222-2222-2222-222222222222";
  const parent2Email = "unrelated.parent@guardian.ai";
  const fam2Code = "UNREL9";

  const child2Id = "33333333-3333-3333-3333-333333333333";
  const child2Email = "unrelated.child@guardian.ai";

  const disabledChildId = "44444444-4444-4444-4444-444444444444";
  const unlinkedChildId = "55555555-5555-5555-5555-555555555555";

  // Insert Auth users with authoritative metadata roles
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) VALUES
      ('${parent1Id}', '${parent1Email}', '{"role":"parent","full_name":"Parent Smith"}'::jsonb, now()),
      ('${child1Id}', '${child1Email}', '{"role":"child","full_name":"Child Smith"}'::jsonb, now()),
      ('${parent2Id}', '${parent2Email}', '{"role":"parent","full_name":"Parent Jones"}'::jsonb, now()),
      ('${child2Id}', '${child2Email}', '{"role":"child","full_name":"Child Jones"}'::jsonb, now()),
      ('${disabledChildId}', 'disabled.child@guardian.ai', '{"role":"child","full_name":"Disabled Child"}'::jsonb, now()),
      ('${unlinkedChildId}', 'unlinked.child@guardian.ai', '{"role":"child","full_name":"Unlinked Child"}'::jsonb, now())
    ON CONFLICT (id) DO NOTHING;
  `);

  // Insert Families
  await db.exec(`
    INSERT INTO public.families (family_code, owner_parent_id, parent_email, family_name) VALUES
      ('${fam1Code}', '${parent1Id}', '${parent1Email}', 'Smith Family'),
      ('${fam2Code}', '${parent2Id}', '${parent2Email}', 'Jones Family')
    ON CONFLICT (family_code) DO NOTHING;
  `);

  // Insert public.users records
  await db.exec(`
    INSERT INTO public.users (id, email, role, full_name, parent_id, family_code, disabled) VALUES
      ('${parent1Id}', '${parent1Email}', 'parent', 'Parent Smith', NULL, '${fam1Code}', FALSE),
      ('${child1Id}', '${child1Email}', 'child', 'Child Smith', '${parent1Id}', '${fam1Code}', FALSE),
      ('${parent2Id}', '${parent2Email}', 'parent', 'Parent Jones', NULL, '${fam2Code}', FALSE),
      ('${child2Id}', '${child2Email}', 'child', 'Child Jones', '${parent2Id}', '${fam2Code}', FALSE),
      ('${disabledChildId}', 'disabled.child@guardian.ai', 'child', 'Disabled Child', '${parent1Id}', '${fam1Code}', TRUE),
      ('${unlinkedChildId}', 'unlinked.child@guardian.ai', 'child', 'Unlinked Child', NULL, NULL, FALSE)
    ON CONFLICT (id) DO UPDATE SET
      parent_id = EXCLUDED.parent_id,
      family_code = EXCLUDED.family_code,
      disabled = EXCLUDED.disabled;
  `);

  console.log("   Test accounts successfully initialized.\n");

  // =========================================================================
  // TEST SECTION A: DEVICE REGISTRATION RLS 42501 FIX
  // =========================================================================
  console.log("--- PART A: DEVICE REGISTRATION RLS AUDIT ---");
  const device1Id = `DEV-${child1Id.slice(0, 4).toUpperCase()}-TEST1`;

  // Test 1: Authoritative Child 1 registers own device (INSERT policy)
  await asUser(child1Id, child1Email, true);
  let child1InsertError: string | null = null;
  try {
    await db.exec(`
      INSERT INTO public.devices (
        device_id, device_name, device_model, android_version,
        battery, charging, online, child_id, parent_id, family_code, updated_at
      ) VALUES (
        '${device1Id}', 'Child 1 Phone', 'Pixel 8', 'Guardian OS 2.4',
        88, false, true, '${child1Id}', '${parent1Id}', '${fam1Code}', now()
      );
    `);
  } catch (err: any) {
    child1InsertError = err.message;
  }

  report(
    "Test 1: Child registers own device without RLS 42501 error",
    child1InsertError === null,
    child1InsertError || "Success"
  );

  // Test 2: Child 1 updates own device (UPDATE policy)
  let child1UpdateError: string | null = null;
  try {
    await db.exec(`
      UPDATE public.devices
      SET battery = 95, updated_at = now()
      WHERE device_id = '${device1Id}';
    `);
  } catch (err: any) {
    child1UpdateError = err.message;
  }

  const updatedDev = (await db.query(`SELECT battery FROM public.devices WHERE device_id = '${device1Id}';`)).rows[0] as any;
  report(
    "Test 2: Child updates own device telemetry without RLS 42501 error",
    child1UpdateError === null && updatedDev?.battery === 95,
    `Battery: ${updatedDev?.battery}%`
  );

  // Test 3: Linked Parent 1 can SELECT and view Child 1's device
  await asUser(parent1Id, parent1Email, true);
  const p1Devices = (await db.query(`SELECT * FROM public.devices WHERE parent_id = '${parent1Id}';`)).rows as any[];
  report(
    "Test 3: Linked Parent 1 views Child 1's device via RLS",
    p1Devices.length === 1 && p1Devices[0].device_id === device1Id,
    `Found ${p1Devices.length} device(s)`
  );

  // Test 4: Parent CANNOT register themselves as a Child device
  let parentSelfBlocked = false;
  let parentSelfErr = "";
  try {
    await db.exec(`
      INSERT INTO public.devices (
        device_id, device_name, child_id, parent_id, family_code
      ) VALUES (
        'DEV-PARENT-SELF', 'Parent Phone', '${parent1Id}', '${parent1Id}', '${fam1Code}'
      );
    `);
  } catch (err: any) {
    parentSelfBlocked = true;
    parentSelfErr = err.message;
  }
  report(
    "Test 4: Parent cannot register themselves as a Child device",
    parentSelfBlocked && (parentSelfErr.includes("Parents cannot register devices for themselves") || parentSelfErr.includes("row-level security")),
    parentSelfErr
  );

  // Test 5: Unrelated Parent 2 receives ZERO rows for Child 1's device
  await asUser(parent2Id, parent2Email, true);
  const p2ForeignDevices = (await db.query(`SELECT * FROM public.devices WHERE device_id = '${device1Id}';`)).rows as any[];
  report(
    "Test 5: Unrelated Parent 2 receives 0 rows for foreign device (RLS isolation)",
    p2ForeignDevices.length === 0,
    `Returned ${p2ForeignDevices.length} rows`
  );

  // Test 6: Spoofed child_id is rejected by RLS
  await asUser(child2Id, child2Email, true);
  let spoofedChildBlocked = false;
  let spoofedChildErr = "";
  try {
    await db.exec(`
      INSERT INTO public.devices (
        device_id, device_name, child_id, parent_id, family_code
      ) VALUES (
        'DEV-SPOOF-CHILD', 'Spoofed Device', '${child1Id}', '${parent2Id}', '${fam2Code}'
      );
    `);
  } catch (err: any) {
    spoofedChildBlocked = true;
    spoofedChildErr = err.message;
  }
  report(
    "Test 6: Child cannot register device with a spoofed child_id",
    spoofedChildBlocked && (spoofedChildErr.includes("row-level security") || spoofedChildErr.includes("Permission denied")),
    spoofedChildErr
  );

  // Test 7: Spoofed parent_id is rejected by RLS
  let spoofedParentBlocked = false;
  let spoofedParentErr = "";
  try {
    await db.exec(`
      INSERT INTO public.devices (
        device_id, device_name, child_id, parent_id, family_code
      ) VALUES (
        'DEV-SPOOF-PARENT', 'Spoofed Parent Device', '${child2Id}', '${parent1Id}', '${fam2Code}'
      );
    `);
  } catch (err: any) {
    spoofedParentBlocked = true;
    spoofedParentErr = err.message;
  }
  report(
    "Test 7: Child cannot register device under an unrelated parent_id",
    spoofedParentBlocked && (spoofedParentErr.includes("row-level security") || spoofedParentErr.includes("Permission denied")),
    spoofedParentErr
  );

  // Test 8: Disabled Child is rejected by RLS
  await asUser(disabledChildId, "disabled.child@guardian.ai", true);
  let disabledBlocked = false;
  let disabledErr = "";
  try {
    await db.exec(`
      INSERT INTO public.devices (
        device_id, device_name, child_id, parent_id, family_code
      ) VALUES (
        'DEV-DISABLED', 'Disabled Device', '${disabledChildId}', '${parent1Id}', '${fam1Code}'
      );
    `);
  } catch (err: any) {
    disabledBlocked = true;
    disabledErr = err.message;
  }
  report(
    "Test 8: Disabled Child account is rejected by RLS/trigger",
    disabledBlocked,
    disabledErr
  );

  // Test 9: Unlinked Child is rejected
  await asUser(unlinkedChildId, "unlinked.child@guardian.ai", true);
  let unlinkedBlocked = false;
  let unlinkedErr = "";
  try {
    await db.exec(`
      INSERT INTO public.devices (
        device_id, device_name, child_id, parent_id, family_code
      ) VALUES (
        'DEV-UNLINKED', 'Unlinked Device', '${unlinkedChildId}', NULL, NULL
      );
    `);
  } catch (err: any) {
    unlinkedBlocked = true;
    unlinkedErr = err.message;
  }
  report(
    "Test 9: Unlinked Child account cannot register companion devices",
    unlinkedBlocked,
    unlinkedErr
  );

  // Test 10: Cross-account device ID collision is rejected
  await asUser(child2Id, child2Email, true);
  let collisionBlocked = false;
  let collisionErr = "";
  try {
    await db.exec(`
      UPDATE public.devices
      SET child_id = '${child2Id}', battery = 50
      WHERE device_id = '${device1Id}';
    `);
  } catch (err: any) {
    collisionBlocked = true;
    collisionErr = err.message;
  }
  await asUser(child1Id, child1Email, true);
  const hijackedDev = (await db.query(`SELECT child_id, battery FROM public.devices WHERE device_id = '${device1Id}';`)).rows[0] as any;
  report(
    "Test 10: Device cannot be hijacked by an unrelated child (RLS UPDATE isolation)",
    hijackedDev?.child_id === child1Id && hijackedDev?.battery === 95,
    `Owner remains: ${hijackedDev?.child_id}, Battery remains: ${hijackedDev?.battery}%`
  );

  // =========================================================================
  // TEST SECTION B: CYBER-SMART QUIZ PERSISTENCE AUDIT
  // =========================================================================
  console.log("\n--- PART B: CYBER-SMART QUIZ PERSISTENCE AUDIT ---");
  await asUser(child1Id, child1Email, true);

  // Test 11: Quiz Answer 1 creates 1 record in child_quiz_history
  const q1Id = "q-pass-1";
  await db.exec(`
    INSERT INTO public.child_quiz_history (
      child_id, question_id, category, difficulty_level, selected_option_index, is_correct, answered_at
    ) VALUES (
      '${child1Id}', '${q1Id}', 'passwords', 1, 0, true, now()
    );
  `);
  const histCount1 = (await db.query(`SELECT count(*)::int as cnt FROM public.child_quiz_history WHERE child_id = '${child1Id}';`)).rows[0] as any;
  report(
    "Test 11: First quiz answer creates a record in child_quiz_history",
    histCount1?.cnt === 1,
    `Records in history: ${histCount1?.cnt}`
  );

  // Test 12: Quiz Answer 1 upserts child_quiz_progress with accuracy, streak, etc.
  await db.exec(`
    INSERT INTO public.child_quiz_progress (
      child_id, current_level, questions_attempted, correct_count, incorrect_count,
      accuracy_percentage, streak, weak_concepts, exhausted_question_ids, current_cycle, updated_at
    ) VALUES (
      '${child1Id}', 1, 1, 1, 0, 100.00, 1, '{}', ARRAY['${q1Id}'], 1, now()
    )
    ON CONFLICT (child_id) DO UPDATE SET
      current_level = EXCLUDED.current_level,
      questions_attempted = EXCLUDED.questions_attempted,
      correct_count = EXCLUDED.correct_count,
      incorrect_count = EXCLUDED.incorrect_count,
      accuracy_percentage = EXCLUDED.accuracy_percentage,
      streak = EXCLUDED.streak,
      weak_concepts = EXCLUDED.weak_concepts,
      exhausted_question_ids = EXCLUDED.exhausted_question_ids,
      current_cycle = EXCLUDED.current_cycle,
      updated_at = EXCLUDED.updated_at;
  `);

  const prog1 = (await db.query(`SELECT * FROM public.child_quiz_progress WHERE child_id = '${child1Id}';`)).rows[0] as any;
  report(
    "Test 12: Progress record initialized with attempted: 1, streak: 1, accuracy: 100%",
    prog1?.questions_attempted === 1 && prog1?.streak === 1 && Number(prog1?.accuracy_percentage) === 100,
    `Attempted: ${prog1?.questions_attempted}, Streak: ${prog1?.streak}, Accuracy: ${prog1?.accuracy_percentage}%`
  );

  // Test 13: Second quiz answer (incorrect) updates progress and records history
  const q2Id = "q-phish-1";
  await db.exec(`
    INSERT INTO public.child_quiz_history (
      child_id, question_id, category, difficulty_level, selected_option_index, is_correct, answered_at
    ) VALUES (
      '${child1Id}', '${q2Id}', 'phishing', 1, 1, false, now()
    );
  `);
  await db.exec(`
    UPDATE public.child_quiz_progress
    SET questions_attempted = 2,
        correct_count = 1,
        incorrect_count = 1,
        accuracy_percentage = 50.00,
        streak = 0,
        weak_concepts = ARRAY['phishing'],
        exhausted_question_ids = ARRAY['${q1Id}', '${q2Id}'],
        updated_at = now()
    WHERE child_id = '${child1Id}';
  `);

  const histCount2 = (await db.query(`SELECT count(*)::int as cnt FROM public.child_quiz_history WHERE child_id = '${child1Id}';`)).rows[0] as any;
  const prog2 = (await db.query(`SELECT * FROM public.child_quiz_progress WHERE child_id = '${child1Id}';`)).rows[0] as any;
  report(
    "Test 13: Second answer updates progress (streak reset to 0, weak_concept added) and appends history",
    histCount2?.cnt === 2 && prog2?.streak === 0 && prog2?.weak_concepts?.includes("phishing"),
    `History count: ${histCount2?.cnt}, Streak: ${prog2?.streak}, Weak concepts: ${JSON.stringify(prog2?.weak_concepts)}`
  );

  // Test 14: Restoring progress query returns persisted exhausted questions
  const restoredProg = (await db.query(`SELECT exhausted_question_ids FROM public.child_quiz_progress WHERE child_id = '${child1Id}';`)).rows[0] as any;
  report(
    "Test 14: Refresh restoration retrieves persistent exhausted question IDs",
    restoredProg?.exhausted_question_ids?.length === 2 && restoredProg?.exhausted_question_ids?.includes(q1Id),
    `Exhausted IDs: ${JSON.stringify(restoredProg?.exhausted_question_ids)}`
  );

  // Test 15: Linked Parent 1 can read Child 1's quiz progress
  await asUser(parent1Id, parent1Email, true);
  const p1ChildQuiz = (await db.query(`SELECT * FROM public.child_quiz_progress WHERE child_id = '${child1Id}';`)).rows as any[];
  report(
    "Test 15a: Linked Parent 1 can read Child 1's quiz progress",
    p1ChildQuiz.length === 1 && p1ChildQuiz[0].child_id === child1Id,
    `Parent found ${p1ChildQuiz.length} progress record(s)`
  );

  // Test 15b: Unrelated Parent 2 CANNOT read Child 1's quiz progress (RLS isolation)
  await asUser(parent2Id, parent2Email, true);
  const p2ChildQuiz = (await db.query(`SELECT * FROM public.child_quiz_progress WHERE child_id = '${child1Id}';`)).rows as any[];
  report(
    "Test 15b: Unrelated Parent 2 receives 0 rows for Child 1's quiz progress",
    p2ChildQuiz.length === 0,
    `Returned ${p2ChildQuiz.length} rows (RLS isolated)`
  );

  console.log("\n===============================================================================");
  console.log(` SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runQuizAndDevicePersistenceTest().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
