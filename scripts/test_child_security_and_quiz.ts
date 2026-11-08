import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";
import { 
  CYBER_QUIZ_BANK, 
  CATEGORY_LABELS, 
  QuizCategory, 
  QuizQuestion 
} from "../src/data/cyberQuizBank";
import { 
  createDefaultProgress, 
  getNextQuizQuestion, 
  recordQuizAnswer,
  resetQuizCycle,
  ChildQuizProgress
} from "../src/lib/cyberQuizEngine";

async function runChildSecurityAndQuizAudit() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI: SUPABASE EDITION - CHILD PORTAL SECURITY & ADAPTIVE QUIZ AUDIT");
  console.log("===============================================================================\n");

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

  // =========================================================================
  // TEST GROUP 1: QUESTION BANK INTEGRITY & CATEGORY COVERAGE (PART B.1)
  // =========================================================================
  console.log("-> 1. Auditing Cyber-Smart Question Bank (55 questions, 10 categories)...");

  report(
    "Total question count >= 50",
    CYBER_QUIZ_BANK.length >= 50,
    `Found ${CYBER_QUIZ_BANK.length} unique questions`
  );

  const REQUIRED_CATEGORIES: QuizCategory[] = [
    "password_security",
    "phishing",
    "social_privacy",
    "cyberbullying",
    "gaming_scams",
    "ai_deepfakes",
    "personal_info",
    "digital_footprint",
    "safe_downloads",
    "stranger_safety"
  ];

  const categoryCounts: Record<string, number> = {};
  for (const q of CYBER_QUIZ_BANK) {
    categoryCounts[q.category] = (categoryCounts[q.category] || 0) + 1;
  }

  for (const cat of REQUIRED_CATEGORIES) {
    const count = categoryCounts[cat] || 0;
    report(
      `Category coverage: ${CATEGORY_LABELS[cat]} (${cat})`,
      count >= 4,
      `${count} questions found`
    );
  }

  // Difficulty level distribution
  const level1Count = CYBER_QUIZ_BANK.filter(q => q.difficulty === 1).length;
  const level2Count = CYBER_QUIZ_BANK.filter(q => q.difficulty === 2).length;
  const level3Count = CYBER_QUIZ_BANK.filter(q => q.difficulty === 3).length;

  report("Difficulty distribution Level 1 (Beginner)", level1Count >= 15, `${level1Count} questions`);
  report("Difficulty distribution Level 2 (Intermediate)", level2Count >= 15, `${level2Count} questions`);
  report("Difficulty distribution Level 3 (Advanced)", level3Count >= 15, `${level3Count} questions`);

  // Verify explanation schema completeness
  let allExplanationsComplete = true;
  let allFollowUpsComplete = true;
  for (const q of CYBER_QUIZ_BANK) {
    if (!q.explanation?.whyCorrectSafe || !q.explanation?.otherOptionsUnsafe || !q.explanation?.realWorldExample) {
      allExplanationsComplete = false;
      break;
    }
    const fPrompt = (q.explanation.followUpQuestion as any)?.question || (q.explanation.followUpQuestion as any)?.prompt;
    if (!q.explanation?.followUpQuestion || !fPrompt || q.explanation.followUpQuestion.options.length < 2) {
      allFollowUpsComplete = false;
      break;
    }
  }

  report("All questions contain whyCorrectSafe, otherOptionsUnsafe & realWorldExample", allExplanationsComplete);
  report("All questions contain interactive followUpQuestion with options", allFollowUpsComplete);

  // =========================================================================
  // TEST GROUP 2: ADAPTIVE QUIZ ROTATION & PROGRESSION (PART B.2 & B.3)
  // =========================================================================
  console.log("\n-> 2. Auditing Quiz Rotation, Non-Repetition & Adaptive Leveling...");

  let testProgress = createDefaultProgress("child-test-123");
  const encounteredIds = new Set<string>();

  // Answer 15 questions sequentially and check for non-repetition
  let duplicatesFound = false;
  for (let i = 0; i < 15; i++) {
    const nextQ = getNextQuizQuestion(testProgress);
    if (encounteredIds.has(nextQ.id)) {
      duplicatesFound = true;
      break;
    }
    encounteredIds.add(nextQ.id);

    // Simulate answering correctly
    const correctIdx = nextQ.options.findIndex(o => o.isCorrect);
    const result = await recordQuizAnswer("child-test-123", nextQ, correctIdx, testProgress);
    testProgress = result.updatedProgress;
  }

  report("Question rotation has zero repetition across 15 attempts", !duplicatesFound, `${encounteredIds.size} distinct questions`);
  report("Correct streak increments properly", testProgress.streak === 15, `Streak: ${testProgress.streak}`);
  report("Accuracy percentage computed accurately", testProgress.accuracyPercentage === 100, `Accuracy: ${testProgress.accuracyPercentage}%`);
  report("Adaptive Leveling promoted child from Level 1 to Level 3", testProgress.currentLevel === 3, `Current Level: ${testProgress.currentLevel}`);

  // Test full cycle rollover when all questions are exhausted
  const allIds = CYBER_QUIZ_BANK.map(q => q.id);
  const exhaustedProgress: ChildQuizProgress = {
    ...testProgress,
    exhaustedQuestionIds: [...allIds.slice(0, 54)],
    currentCycle: 1
  };

  const lastQ = CYBER_QUIZ_BANK.find(q => q.id === allIds[54])!;
  const rolloverResult = await recordQuizAnswer("child-test-123", lastQ, 0, exhaustedProgress);
  report(
    "Cycle advances to #2 when all 55 questions in bank are exhausted",
    rolloverResult.updatedProgress.currentCycle === 2 && rolloverResult.updatedProgress.exhaustedQuestionIds.length === 0,
    `Cycle: ${rolloverResult.updatedProgress.currentCycle}, Exhausted Count: ${rolloverResult.updatedProgress.exhaustedQuestionIds.length}`
  );

  // =========================================================================
  // TEST GROUP 3: SUPABASE DATABASE RLS & SCHEMA INTEGRITY (PART A.2 & B.5)
  // =========================================================================
  console.log("\n-> 3. Bootstrapping Supabase Auth, Public Tables & Quiz RLS in PostgreSQL (PGlite)...");

  const db = new PGlite();

  // Create auth and public base tables
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS extensions;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
    END
    $$;

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
      SELECT NULL::uuid;
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN AS $$
      SELECT false;
    $$ LANGUAGE sql STABLE;

    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE,
      raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
      raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
      email_confirmed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.users (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT,
      role TEXT DEFAULT 'parent',
      parent_id UUID REFERENCES public.users(id),
      family_id UUID,
      full_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "users_select_policy" ON public.users FOR SELECT TO authenticated
      USING (id = auth.uid() OR parent_id = auth.uid());
  `);

  // Run the new cyber quiz migration
  const migrationPath = path.resolve(process.cwd(), "supabase/migrations/20261105000005_cyber_smart_quiz.sql");
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  await db.exec(migrationSql);

  // Setup test users: Parent A, Child A (linked to Parent A), Parent B, Child B (linked to Parent B)
  const parentAUid = "11111111-1111-1111-1111-111111111111";
  const childAUid  = "22222222-2222-2222-2222-222222222222";
  const parentBUid = "33333333-3333-3333-3333-333333333333";
  const childBUid  = "44444444-4444-4444-4444-444444444444";

  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES
      ('${parentAUid}', 'parenta@guardian.local'),
      ('${childAUid}',  'childa@guardian.local'),
      ('${parentBUid}', 'parentb@guardian.local'),
      ('${childBUid}',  'childb@guardian.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (id, email, role, parent_id) VALUES
      ('${parentAUid}', 'parenta@guardian.local', 'parent', NULL),
      ('${childAUid}',  'childa@guardian.local',  'child',  '${parentAUid}'),
      ('${parentBUid}', 'parentb@guardian.local', 'parent', NULL),
      ('${childBUid}',  'childb@guardian.local',  'child',  '${parentBUid}')
    ON CONFLICT (id) DO NOTHING;

    GRANT SELECT ON public.users TO authenticated;
  `);

  // Helper to test as authenticated user
  async function testAsUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
    await db.exec(`
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
        SELECT '${uid}'::uuid;
      $$ LANGUAGE sql STABLE;
      SET ROLE authenticated;
    `);
    try {
      return await fn();
    } finally {
      await db.exec(`RESET ROLE;`);
    }
  }

  // RLS Test 1: Child A inserts own quiz progress
  console.log("-> 3.1 Testing Child A inserting own quiz progress...");
  let childAInsertOk = false;
  try {
    await testAsUser(childAUid, async () => {
      await db.exec(`
        INSERT INTO public.child_quiz_progress (
          child_id, current_level, questions_attempted, correct_count, incorrect_count, accuracy_percentage, streak
        ) VALUES (
          '${childAUid}', 1, 5, 4, 1, 80.0, 3
        );
      `);
    });
    childAInsertOk = true;
  } catch (err: any) {
    console.error("Child A insert error:", err.message);
  }
  report("RLS: Child A can insert own child_quiz_progress", childAInsertOk);

  // RLS Test 2: Child A attempting to insert or update Child B's quiz progress -> MUST FAIL
  console.log("-> 3.2 Testing Child A attempting to insert Child B's quiz progress (Tampering)...");
  let childATamperBlocked = false;
  try {
    await testAsUser(childAUid, async () => {
      await db.exec(`
        INSERT INTO public.child_quiz_progress (
          child_id, current_level, questions_attempted, correct_count, incorrect_count, accuracy_percentage, streak
        ) VALUES (
          '${childBUid}', 1, 10, 10, 0, 100.0, 10
        );
      `);
    });
  } catch (err: any) {
    childATamperBlocked = true;
  }
  report("RLS: Child A is BLOCKED from inserting Child B's quiz progress", childATamperBlocked);

  // RLS Test 3: Child A can select own quiz progress
  console.log("-> 3.3 Testing Child A selecting own quiz progress...");
  let childAReadOk = false;
  await testAsUser(childAUid, async () => {
    const res = await db.query(`SELECT * FROM public.child_quiz_progress WHERE child_id = '${childAUid}';`);
    childAReadOk = res.rows.length === 1;
  });
  report("RLS: Child A can read own quiz progress", childAReadOk);

  // RLS Test 4: Child A CANNOT read Child B's quiz progress
  console.log("-> 3.4 Testing Child A attempting to read Child B's quiz progress...");
  let childAForbiddenReadBlocked = false;
  await testAsUser(childAUid, async () => {
    const res = await db.query(`SELECT * FROM public.child_quiz_progress WHERE child_id = '${childBUid}';`);
    childAForbiddenReadBlocked = res.rows.length === 0;
  });
  report("RLS: Child A cannot read Child B's quiz progress (0 rows returned)", childAForbiddenReadBlocked);

  // RLS Test 5: Parent A can read linked Child A's quiz progress
  console.log("-> 3.5 Testing Parent A reading linked Child A's quiz progress...");
  let parentACanReadChildA = false;
  await testAsUser(parentAUid, async () => {
    const res = await db.query(`SELECT * FROM public.child_quiz_progress WHERE child_id = '${childAUid}';`);
    parentACanReadChildA = res.rows.length === 1;
  });
  report("RLS: Parent A can read linked Child A's quiz progress", parentACanReadChildA);

  // RLS Test 6: Parent B CANNOT read unlinked Child A's quiz progress
  console.log("-> 3.6 Testing Parent B attempting to read unlinked Child A's quiz progress...");
  let parentBCannotReadChildA = false;
  await testAsUser(parentBUid, async () => {
    const res = await db.query(`SELECT * FROM public.child_quiz_progress WHERE child_id = '${childAUid}';`);
    parentBCannotReadChildA = res.rows.length === 0;
  });
  report("RLS: Parent B cannot read unlinked Child A's quiz progress (0 rows returned)", parentBCannotReadChildA);

  // RLS Test 7: Child A recording quiz history record
  console.log("-> 3.7 Testing Child A inserting quiz history entry...");
  let childAHistoryInsertOk = false;
  try {
    await testAsUser(childAUid, async () => {
      await db.exec(`
        INSERT INTO public.child_quiz_history (
          child_id, question_id, category, difficulty_level, selected_option_index, is_correct
        ) VALUES (
          '${childAUid}', 'pass_01', 'password_security', 1, 1, true
        );
      `);
    });
    childAHistoryInsertOk = true;
  } catch (err: any) {
    console.error("Child A history insert error:", err.message);
  }
  report("RLS: Child A can record own quiz history entry", childAHistoryInsertOk);

  // RLS Test 8: Child A attempting to insert quiz history for Child B -> MUST FAIL
  console.log("-> 3.8 Testing Child A attempting to insert quiz history for Child B...");
  let childAHistoryTamperBlocked = false;
  try {
    await testAsUser(childAUid, async () => {
      await db.exec(`
        INSERT INTO public.child_quiz_history (
          child_id, question_id, category, difficulty_level, selected_option_index, is_correct
        ) VALUES (
          '${childBUid}', 'pass_01', 'password_security', 1, 1, true
        );
      `);
    });
  } catch (err: any) {
    childAHistoryTamperBlocked = true;
  }
  report("RLS: Child A cannot insert quiz history for Child B", childAHistoryTamperBlocked);

  console.log("\n===============================================================================");
  console.log(` AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runChildSecurityAndQuizAudit().catch((err) => {
  console.error("Fatal error during audit:", err);
  process.exit(1);
});
