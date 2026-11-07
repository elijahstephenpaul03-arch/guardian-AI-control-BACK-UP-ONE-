import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";

async function runFamilyCodeStabilityValidation() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI: PERMANENT FAMILY CODE STABILITY VALIDATION SUITE");
  console.log(" Critical System Invariant: Parent Family Code must NEVER change automatically");
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
  console.log("-> 2. Applying Database Schema, RLS, and Family Code Invariant Migrations...");
  const m1 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000000_initial_schema.sql"), "utf8");
  await db.exec(m1);
  const m2 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000001_rls_policies.sql"), "utf8");
  await db.exec(m2);
  const m3 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000002_family_linking.sql"), "utf8");
  await db.exec(m3);
  const m4 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000003_sos_realtime.sql"), "utf8");
  await db.exec(m4);
  console.log("-> All migrations successfully applied.\n");

  // Summary log of tested codes
  const stabilityReportTable: Array<{
    testNumber: number;
    testName: string;
    originalCode: string;
    finalCode: string;
    match: boolean;
  }> = [];

  // =========================================================================
  // TEST 1: Parent login 100 consecutive times
  // =========================================================================
  console.log("--- TEST 1: PARENT LOGIN 100 CONSECUTIVE TIMES ---");
  const parent1Id = "70000000-0000-0000-0000-000000000001";
  const parent1Email = "stability.parent1@guardian.test";
  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES ('${parent1Id}', '${parent1Email}', '{"role":"parent","full_name":"Stability Parent 1"}'::jsonb, now());
  `);

  // Initial code generation
  await asUser(parent1Id, parent1Email, true);
  const initRes1 = (await db.query(`SELECT public.generate_or_get_family_code('Parent 1 Network') AS result;`)).rows[0] as any;
  const initialCode1 = (typeof initRes1.result === "string" ? JSON.parse(initRes1.result) : initRes1.result).family_code;

  let allMatch1 = true;
  let finalCode1 = initialCode1;

  for (let i = 1; i <= 100; i++) {
    // Simulate login: session restoration + profile fetch + family code resolution
    await asUser(parent1Id, parent1Email, true);
    const userRow = (await db.query(`SELECT family_code FROM public.users WHERE id = '${parent1Id}';`)).rows[0] as any;
    const famRow = (await db.query(`SELECT family_code FROM public.families WHERE owner_parent_id = '${parent1Id}';`)).rows[0] as any;
    
    // Also simulate RPC call on login if invoked
    const rpcRes = (await db.query(`SELECT public.generate_or_get_family_code() AS result;`)).rows[0] as any;
    const rpcCode = (typeof rpcRes.result === "string" ? JSON.parse(rpcRes.result) : rpcRes.result).family_code;

    if (userRow.family_code !== initialCode1 || famRow.family_code !== initialCode1 || rpcCode !== initialCode1) {
      allMatch1 = false;
      finalCode1 = userRow.family_code;
      break;
    }
    finalCode1 = rpcCode;
  }

  const familiesCount1 = (await db.query(`SELECT count(*)::int AS count FROM public.families WHERE owner_parent_id = '${parent1Id}';`)).rows[0] as any;

  report(
    "1. Parent login 100 consecutive times: Code remains permanent and unchanged",
    allMatch1 && initialCode1 === finalCode1 && familiesCount1.count === 1,
    `Original Code: ${initialCode1} | Final Code: ${finalCode1} | Iterations: 100 | Families in DB: ${familiesCount1.count}`
  );

  stabilityReportTable.push({
    testNumber: 1,
    testName: "Parent login 100 consecutive times",
    originalCode: initialCode1,
    finalCode: finalCode1,
    match: initialCode1 === finalCode1,
  });

  // =========================================================================
  // TEST 2: Parent refresh 100 times
  // =========================================================================
  console.log("\n--- TEST 2: PARENT REFRESH 100 TIMES ---");
  const parent2Id = "70000000-0000-0000-0000-000000000002";
  const parent2Email = "stability.parent2@guardian.test";
  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES ('${parent2Id}', '${parent2Email}', '{"role":"parent","full_name":"Stability Parent 2"}'::jsonb, now());
  `);

  await asUser(parent2Id, parent2Email, true);
  const initRes2 = (await db.query(`SELECT public.generate_or_get_family_code('Parent 2 Network') AS result;`)).rows[0] as any;
  const initialCode2 = (typeof initRes2.result === "string" ? JSON.parse(initRes2.result) : initRes2.result).family_code;

  let allMatch2 = true;
  let finalCode2 = initialCode2;

  for (let i = 1; i <= 100; i++) {
    // Simulate page refresh: client mounts and calls generate_or_get_family_code
    const refreshRes = (await db.query(`SELECT public.generate_or_get_family_code() AS result;`)).rows[0] as any;
    const resJson = typeof refreshRes.result === "string" ? JSON.parse(refreshRes.result) : refreshRes.result;

    if (resJson.family_code !== initialCode2 || resJson.is_new !== false) {
      allMatch2 = false;
      finalCode2 = resJson.family_code;
      break;
    }
    finalCode2 = resJson.family_code;
  }

  const familiesCount2 = (await db.query(`SELECT count(*)::int AS count FROM public.families WHERE owner_parent_id = '${parent2Id}';`)).rows[0] as any;

  report(
    "2. Parent refresh 100 times: Code remains permanent and idempotent (is_new = false)",
    allMatch2 && initialCode2 === finalCode2 && familiesCount2.count === 1,
    `Original Code: ${initialCode2} | Final Code: ${finalCode2} | Refreshes: 100 | Families in DB: ${familiesCount2.count}`
  );

  stabilityReportTable.push({
    testNumber: 2,
    testName: "Parent refresh 100 times",
    originalCode: initialCode2,
    finalCode: finalCode2,
    match: initialCode2 === finalCode2,
  });

  // =========================================================================
  // TEST 3: Parent logs in from multiple browser sessions
  // =========================================================================
  console.log("\n--- TEST 3: PARENT LOGS IN FROM MULTIPLE BROWSER SESSIONS ---");
  const parent3Id = "70000000-0000-0000-0000-000000000003";
  const parent3Email = "stability.parent3@guardian.test";
  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES ('${parent3Id}', '${parent3Email}', '{"role":"parent","full_name":"Stability Parent 3"}'::jsonb, now());
  `);

  await asUser(parent3Id, parent3Email, true);
  const initRes3 = (await db.query(`SELECT public.generate_or_get_family_code('Parent 3 Network') AS result;`)).rows[0] as any;
  const initialCode3 = (typeof initRes3.result === "string" ? JSON.parse(initRes3.result) : initRes3.result).family_code;

  // Simulate 5 distinct browser sessions (e.g. Chrome, Firefox, Safari, Mobile, Tablet)
  const sessionNames = ["Desktop Chrome", "Desktop Firefox", "Safari iOS", "Android Companion", "Secondary Tablet"];
  const sessionCodes: string[] = [];

  for (const sessionName of sessionNames) {
    // Switch auth context simulating independent session token
    await asUser(parent3Id, parent3Email, true);
    const sessRes = (await db.query(`SELECT public.generate_or_get_family_code() AS result;`)).rows[0] as any;
    const sessCode = (typeof sessRes.result === "string" ? JSON.parse(sessRes.result) : sessRes.result).family_code;
    sessionCodes.push(sessCode);
  }

  const allSessionsMatch = sessionCodes.every(c => c === initialCode3);
  const finalCode3 = sessionCodes[sessionCodes.length - 1];

  report(
    "3. Parent logs in from multiple browser sessions: All sessions retrieve the exact same Family Code",
    allSessionsMatch && sessionCodes.length === 5,
    `Original Code: ${initialCode3} | Sessions tested: ${sessionNames.join(", ")} | All matched: ${allSessionsMatch}`
  );

  stabilityReportTable.push({
    testNumber: 3,
    testName: "Parent logs in from multiple browser sessions",
    originalCode: initialCode3,
    finalCode: finalCode3,
    match: initialCode3 === finalCode3,
  });

  // =========================================================================
  // TEST 4: Multiple simultaneous Family Code RPC requests
  // =========================================================================
  console.log("\n--- TEST 4: MULTIPLE SIMULTANEOUS FAMILY CODE RPC REQUESTS ---");
  const parent4Id = "70000000-0000-0000-0000-000000000004";
  const parent4Email = "stability.parent4@guardian.test";
  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES ('${parent4Id}', '${parent4Email}', '{"role":"parent","full_name":"Stability Parent 4"}'::jsonb, now());
  `);

  await asUser(parent4Id, parent4Email, true);
  
  // Fire 20 parallel simultaneous RPC requests to test transaction concurrency and advisory locking
  const parallelPromises: Promise<any>[] = [];
  for (let i = 0; i < 20; i++) {
    parallelPromises.push(
      db.query(`SELECT public.generate_or_get_family_code('Parent 4 Network') AS result;`)
    );
  }

  const parallelResults = await Promise.all(parallelPromises);
  const returnedCodes = parallelResults.map((r: any) => {
    const raw = r.rows[0].result;
    return (typeof raw === "string" ? JSON.parse(raw) : raw).family_code;
  });

  const initialCode4 = returnedCodes[0];
  const allParallelMatch = returnedCodes.every(c => c === initialCode4);
  const familiesCount4 = (await db.query(`SELECT count(*)::int AS count FROM public.families WHERE owner_parent_id = '${parent4Id}';`)).rows[0] as any;
  const finalCode4 = returnedCodes[returnedCodes.length - 1];

  report(
    "4. Multiple simultaneous Family Code RPC requests: Advisory lock guarantees 100% code identity and 1 family record",
    allParallelMatch && familiesCount4.count === 1 && returnedCodes.length === 20,
    `Original Code: ${initialCode4} | Final Code: ${finalCode4} | Concurrent requests: 20 | Families in DB: ${familiesCount4.count}`
  );

  stabilityReportTable.push({
    testNumber: 4,
    testName: "Multiple simultaneous Family Code RPC requests",
    originalCode: initialCode4,
    finalCode: finalCode4,
    match: initialCode4 === finalCode4,
  });

  // =========================================================================
  // TEST 5: Child joins using the existing code
  // =========================================================================
  console.log("\n--- TEST 5: CHILD JOINS USING EXISTING CODE ---");
  const parent5Id = "70000000-0000-0000-0000-000000000005";
  const parent5Email = "stability.parent5@guardian.test";
  const child5Id   = "70000000-0000-0000-0000-000000000006";
  const child5Email = "stability.child5@guardian.test";

  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) VALUES
      ('${parent5Id}', '${parent5Email}', '{"role":"parent","full_name":"Stability Parent 5"}'::jsonb, now()),
      ('${child5Id}', '${child5Email}', '{"role":"child","full_name":"Stability Child 5"}'::jsonb, now());
  `);

  // Parent establishes code
  await asUser(parent5Id, parent5Email, true);
  const initRes5 = (await db.query(`SELECT public.generate_or_get_family_code('Stability Family') AS result;`)).rows[0] as any;
  const initialCode5 = (typeof initRes5.result === "string" ? JSON.parse(initRes5.result) : initRes5.result).family_code;

  // Child joins using Parent's code
  await asUser(child5Id, child5Email, true);
  const linkReqRes = (await db.query(`SELECT public.submit_family_link_request('${initialCode5}') AS result;`)).rows[0] as any;
  const linkReq = typeof linkReqRes.result === "string" ? JSON.parse(linkReqRes.result) : linkReqRes.result;
  const linkReqId = linkReq.id;

  // Verify parent code in public.families has NOT changed
  await asSystem();
  const famAfterChildJoin = (await db.query(`SELECT family_code FROM public.families WHERE owner_parent_id = '${parent5Id}';`)).rows[0] as any;
  const childBeforeApproval = (await db.query(`SELECT parent_id, family_code FROM public.users WHERE id = '${child5Id}';`)).rows[0] as any;

  report(
    "5. Child joins using existing code: Request status is pending; Parent Family Code remains unchanged",
    linkReq.status === "pending" && 
    famAfterChildJoin.family_code === initialCode5 && 
    childBeforeApproval.parent_id === null,
    `Original Code: ${initialCode5} | Current Code: ${famAfterChildJoin.family_code} | Request Status: ${linkReq.status}`
  );

  stabilityReportTable.push({
    testNumber: 5,
    testName: "Child joins using existing code",
    originalCode: initialCode5,
    finalCode: famAfterChildJoin.family_code,
    match: initialCode5 === famAfterChildJoin.family_code,
  });

  // =========================================================================
  // TEST 6: Parent approves Child
  // =========================================================================
  console.log("\n--- TEST 6: PARENT APPROVES CHILD ---");
  await asUser(parent5Id, parent5Email, true);
  const approveRes = (await db.query(`SELECT public.respond_to_family_link_request('${linkReqId}', 'accept') AS result;`)).rows[0] as any;
  const approveJson = typeof approveRes.result === "string" ? JSON.parse(approveRes.result) : approveRes.result;

  await asSystem();
  const famAfterApprove = (await db.query(`SELECT family_code FROM public.families WHERE owner_parent_id = '${parent5Id}';`)).rows[0] as any;
  const childAfterApprove = (await db.query(`SELECT parent_id, family_code FROM public.users WHERE id = '${child5Id}';`)).rows[0] as any;
  const childProfile = (await db.query(`SELECT id FROM public.child_profiles WHERE child_user_id = '${child5Id}' AND parent_id = '${parent5Id}';`)).rows[0] as any;

  report(
    "6. Parent approves Child: Child receives SAME family_code; Parent Family Code remains strictly unchanged",
    approveJson.status === "accepted" &&
    childAfterApprove.parent_id === parent5Id &&
    childAfterApprove.family_code === initialCode5 &&
    famAfterApprove.family_code === initialCode5 &&
    Boolean(childProfile?.id),
    `Original Code: ${initialCode5} | Parent Code: ${famAfterApprove.family_code} | Child Code: ${childAfterApprove.family_code}`
  );

  stabilityReportTable.push({
    testNumber: 6,
    testName: "Parent approves Child",
    originalCode: initialCode5,
    finalCode: famAfterApprove.family_code,
    match: initialCode5 === famAfterApprove.family_code,
  });

  // =========================================================================
  // TEST 7: Child logs out and logs in again
  // =========================================================================
  console.log("\n--- TEST 7: CHILD LOGS OUT AND LOGS IN AGAIN ---");
  // Child logs out (switch to anon)
  await asUser(null);
  // Child logs back in (restore child session)
  await asUser(child5Id, child5Email, true);
  const childSessionUser = (await db.query(`SELECT id, parent_id, family_code FROM public.users WHERE id = '${child5Id}';`)).rows[0] as any;
  
  await asSystem();
  const famAfterChildRelogin = (await db.query(`SELECT family_code FROM public.families WHERE owner_parent_id = '${parent5Id}';`)).rows[0] as any;

  report(
    "7. Child logs out and logs in again: Child retains family association and Parent Code is unchanged",
    childSessionUser.parent_id === parent5Id &&
    childSessionUser.family_code === initialCode5 &&
    famAfterChildRelogin.family_code === initialCode5,
    `Original Code: ${initialCode5} | Parent Code: ${famAfterChildRelogin.family_code} | Child Code: ${childSessionUser.family_code}`
  );

  stabilityReportTable.push({
    testNumber: 7,
    testName: "Child logs out and logs in again",
    originalCode: initialCode5,
    finalCode: famAfterChildRelogin.family_code,
    match: initialCode5 === famAfterChildRelogin.family_code,
  });

  // =========================================================================
  // TEST 8: Parent unlinks Child
  // =========================================================================
  console.log("\n--- TEST 8: PARENT UNLINKS CHILD ---");
  await asUser(parent5Id, parent5Email, true);
  const unlinkRes = (await db.query(`SELECT public.unlink_child('${child5Id}') AS result;`)).rows[0] as any;
  const unlinkJson = typeof unlinkRes.result === "string" ? JSON.parse(unlinkRes.result) : unlinkRes.result;

  await asSystem();
  const childAfterUnlink = (await db.query(`SELECT parent_id, family_code FROM public.users WHERE id = '${child5Id}';`)).rows[0] as any;
  const famAfterUnlink = (await db.query(`SELECT family_code FROM public.families WHERE owner_parent_id = '${parent5Id}';`)).rows[0] as any;
  const parentUserAfterUnlink = (await db.query(`SELECT family_code FROM public.users WHERE id = '${parent5Id}';`)).rows[0] as any;

  report(
    "8. Parent unlinks Child: Child is disconnected; Parent Family Code remains 100% unchanged",
    unlinkJson.success === true &&
    childAfterUnlink.parent_id === null &&
    childAfterUnlink.family_code === null &&
    famAfterUnlink.family_code === initialCode5 &&
    parentUserAfterUnlink.family_code === initialCode5,
    `Original Code: ${initialCode5} | Parent Code: ${famAfterUnlink.family_code} | Child Code: ${childAfterUnlink.family_code}`
  );

  stabilityReportTable.push({
    testNumber: 8,
    testName: "Parent unlinks Child",
    originalCode: initialCode5,
    finalCode: famAfterUnlink.family_code,
    match: initialCode5 === famAfterUnlink.family_code,
  });

  // =========================================================================
  // TEST 9: Verify Parent Family Code remains unchanged throughout & is immutable
  // =========================================================================
  console.log("\n--- TEST 9: VERIFY PARENT FAMILY CODE IMMUTABILITY ---");
  await asUser(parent5Id, parent5Email, true);

  // 9.1 Direct mutation test: Attempt unauthorized alteration of family_code in public.families
  let famMutateFailed = false;
  let famMutateError = "";
  try {
    await db.exec(`UPDATE public.families SET family_code = 'HACK99' WHERE owner_parent_id = '${parent5Id}';`);
  } catch (err: any) {
    famMutateFailed = true;
    famMutateError = err.message;
  }

  // 9.2 Direct mutation test: Attempt unauthorized alteration of family_code in public.users
  let userMutateFailed = false;
  let userMutateError = "";
  try {
    await db.exec(`UPDATE public.users SET family_code = 'HACK99' WHERE id = '${parent5Id}';`);
  } catch (err: any) {
    userMutateFailed = true;
    userMutateError = err.message;
  }

  await asSystem();
  const finalFamCheck = (await db.query(`SELECT family_code FROM public.families WHERE owner_parent_id = '${parent5Id}';`)).rows[0] as any;
  const finalUserCheck = (await db.query(`SELECT family_code FROM public.users WHERE id = '${parent5Id}';`)).rows[0] as any;

  report(
    "9. Parent Family Code remains unchanged throughout; Database triggers enforce strict immutability",
    famMutateFailed && famMutateError.toLowerCase().includes("is immutable") &&
    userMutateFailed && userMutateError.toLowerCase().includes("parent family_code is permanent") &&
    finalFamCheck.family_code === initialCode5 &&
    finalUserCheck.family_code === initialCode5,
    `Original Code: ${initialCode5} | Current DB Code: ${finalFamCheck.family_code} | Mutation Blocked: true`
  );

  stabilityReportTable.push({
    testNumber: 9,
    testName: "Verify Parent Family Code remains unchanged throughout",
    originalCode: initialCode5,
    finalCode: finalFamCheck.family_code,
    match: initialCode5 === finalFamCheck.family_code,
  });

  // =========================================================================
  // TEST 10: Verify no duplicate family records or ownership changes
  // =========================================================================
  console.log("\n--- TEST 10: VERIFY NO DUPLICATE FAMILY RECORDS OR OWNERSHIP CHANGES ---");
  await asSystem();
  
  // Verify exactly 1 family record per tested parent
  const testParents = [parent1Id, parent2Id, parent3Id, parent4Id, parent5Id];
  let duplicatesFound = false;

  for (const pid of testParents) {
    const famCount = (await db.query(`SELECT count(*)::int AS count FROM public.families WHERE owner_parent_id = '${pid}';`)).rows[0] as any;
    if (famCount.count !== 1) {
      duplicatesFound = true;
    }
  }

  // Verify unique constraint uq_families_owner_parent rejects duplicate family creation
  let dupInsertFailed = false;
  let dupInsertError = "";
  try {
    await db.exec(`
      INSERT INTO public.families (family_code, family_name, owner_parent_id, parent_email)
      VALUES ('DUP999', 'Duplicate Family', '${parent5Id}', '${parent5Email}');
    `);
  } catch (err: any) {
    dupInsertFailed = true;
    dupInsertError = err.message;
  }

  // Verify owner_parent_id cannot be overwritten
  await asUser(parent5Id, parent5Email, true);
  let ownerTamperFailed = false;
  let ownerTamperError = "";
  try {
    await db.exec(`
      UPDATE public.families SET owner_parent_id = '${parent1Id}' WHERE owner_parent_id = '${parent5Id}';
    `);
  } catch (err: any) {
    ownerTamperFailed = true;
    ownerTamperError = err.message;
  }

  const finalOwnerCheck = (await db.query(`SELECT owner_parent_id, family_code FROM public.families WHERE owner_parent_id = '${parent5Id}';`)).rows[0] as any;

  report(
    "10. Verify no duplicate family records or ownership changes: Database UNIQUE constraint and triggers enforced",
    !duplicatesFound &&
    dupInsertFailed && dupInsertError.includes("uq_families_owner_parent") &&
    ownerTamperFailed && ownerTamperError.includes("owner_parent_id is permanent") &&
    finalOwnerCheck.owner_parent_id === parent5Id &&
    finalOwnerCheck.family_code === initialCode5,
    `Original Code: ${initialCode5} | Final Code: ${finalOwnerCheck.family_code} | Duplicate Insert Blocked: true`
  );

  stabilityReportTable.push({
    testNumber: 10,
    testName: "Verify no duplicate family records or ownership changes",
    originalCode: initialCode5,
    finalCode: finalOwnerCheck.family_code,
    match: initialCode5 === finalOwnerCheck.family_code,
  });

  // =========================================================================
  // FINAL REPORT TABLE
  // =========================================================================
  console.log("\n===============================================================================");
  console.log(" FAMILY CODE STABILITY AUDIT: ORIGINAL CODE VS FINAL CODE FOR ALL 10 TESTS");
  console.log("===============================================================================");
  console.table(stabilityReportTable);

  const allPassed = stabilityReportTable.every(t => t.match);

  console.log("===============================================================================");
  console.log(` STABILITY SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED (All 10 Invariants: ${allPassed ? "VERIFIED" : "FAILED"})`);
  console.log("===============================================================================");

  if (failed > 0 || !allPassed) {
    process.exit(1);
  }
}

runFamilyCodeStabilityValidation().catch((err) => {
  console.error("FATAL ERROR IN FAMILY CODE STABILITY VALIDATION:", err);
  process.exit(1);
});
