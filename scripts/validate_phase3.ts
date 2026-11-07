import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";

async function runPhase3Validation() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI: SUPABASE EDITION - PHASE 3 FAMILY LINKING VALIDATION");
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

  // 2. Apply Migrations 1, 2, and 3
  console.log("-> 2. Applying Schema & RLS Migrations...");
  const m1 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000000_initial_schema.sql"), "utf8");
  await db.exec(m1);
  const m2 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000001_rls_policies.sql"), "utf8");
  await db.exec(m2);
  const m3 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000002_family_linking.sql"), "utf8");
  await db.exec(m3);
  console.log("-> Migrations applied successfully.\n");

  // 3. Seed Test Identities
  const aliceId = "30000000-0000-0000-0000-000000000001";
  const eveId   = "30000000-0000-0000-0000-000000000002";
  const bobId   = "30000000-0000-0000-0000-000000000003";
  const charlieId = "30000000-0000-0000-0000-000000000004";
  const danId   = "30000000-0000-0000-0000-000000000005"; // Disabled parent
  const daveId  = "30000000-0000-0000-0000-000000000006"; // Disabled child

  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) VALUES
      ('${aliceId}', 'alice.parent@example.com', '{"role":"parent","full_name":"Alice Parent"}'::jsonb, now()),
      ('${eveId}', 'eve.unrelated@example.com', '{"role":"parent","full_name":"Eve Unrelated"}'::jsonb, now()),
      ('${bobId}', 'bob.child@example.com', '{"role":"child","full_name":"Bob Explorer"}'::jsonb, now()),
      ('${charlieId}', 'charlie.child@example.com', '{"role":"child","full_name":"Charlie Explorer"}'::jsonb, now()),
      ('${danId}', 'dan.disabled@example.com', '{"role":"parent","full_name":"Dan Disabled"}'::jsonb, now()),
      ('${daveId}', 'dave.disabled@example.com', '{"role":"child","full_name":"Dave Disabled"}'::jsonb, now());

    UPDATE public.users SET disabled = TRUE WHERE id IN ('${danId}', '${daveId}');
  `);

  // -------------------------------------------------------------------------
  // TEST 1: Parent Creates a Family Code
  // -------------------------------------------------------------------------
  console.log("--- TEST 1: PARENT FAMILY CODE GENERATION ---");
  await asUser(aliceId, "alice.parent@example.com", true);
  const genRes1 = (await db.query(`SELECT public.generate_or_get_family_code('Alice Family') AS result;`)).rows[0] as any;
  const famResult1 = typeof genRes1.result === "string" ? JSON.parse(genRes1.result) : genRes1.result;
  const aliceCode = famResult1.family_code;

  report(
    "1. Parent creates a collision-safe Family Code via trusted database function",
    Boolean(aliceCode && aliceCode.length === 6 && famResult1.is_new === true && famResult1.owner_parent_id === aliceId),
    `Generated Code: ${aliceCode}, Owner: ${famResult1.owner_parent_id}`
  );

  // -------------------------------------------------------------------------
  // TEST 2: Parent Refreshes and Retains the Same Code (Idempotence)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 2: IDEMPOTENT CODE RETENTION (PAGE REFRESH) ---");
  await asUser(aliceId, "alice.parent@example.com", true);
  const genRes2 = (await db.query(`SELECT public.generate_or_get_family_code() AS result;`)).rows[0] as any;
  const famResult2 = typeof genRes2.result === "string" ? JSON.parse(genRes2.result) : genRes2.result;

  const totalFamiliesForAlice = (await db.query(`SELECT count(*)::int AS count FROM public.families WHERE owner_parent_id = '${aliceId}';`)).rows[0] as any;

  report(
    "2. Parent retains exact same Family Code without re-generation or overwrite",
    famResult2.family_code === aliceCode && famResult2.is_new === false && totalFamiliesForAlice.count === 1,
    `Retained Code: ${famResult2.family_code}, Families count: ${totalFamiliesForAlice.count}`
  );

  // -------------------------------------------------------------------------
  // TEST 3: Child Submits the Correct Code
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 3: CHILD SUBMITS CORRECT FAMILY CODE ---");
  await asUser(bobId, "bob.child@example.com", true);
  const submitRes = (await db.query(`SELECT public.submit_family_link_request('${aliceCode}') AS result;`)).rows[0] as any;
  const bobReq = typeof submitRes.result === "string" ? JSON.parse(submitRes.result) : submitRes.result;
  const bobReqId = bobReq.id;

  // Check that child's parent_id is NOT established yet
  const bobUserBeforeApproval = (await db.query(`SELECT parent_id, family_code FROM public.users WHERE id = '${bobId}';`)).rows[0] as any;

  report(
    "3. Child submits correct Family Code; pending request created without establishing parent_id",
    bobReq.status === "pending" && bobReq.parent_uid === aliceId && bobUserBeforeApproval.parent_id === null,
    `Request ID: ${bobReqId}, Status: ${bobReq.status}, Child parent_id: ${bobUserBeforeApproval.parent_id}`
  );

  // -------------------------------------------------------------------------
  // TEST 4: Child Submits an Incorrect Code
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 4: CHILD SUBMITS INCORRECT FAMILY CODE ---");
  await asUser(charlieId, "charlie.child@example.com", true);
  let badCodeFailed = false;
  let badCodeMsg = "";
  try {
    await db.query(`SELECT public.submit_family_link_request('NOCODE');`);
  } catch (err: any) {
    badCodeFailed = true;
    badCodeMsg = err.message;
  }

  report(
    "4. Child submitting invalid Family Code is rejected with explicit error",
    badCodeFailed && badCodeMsg.includes("Invalid Family Code: No family found matching"),
    `Error caught: ${badCodeMsg}`
  );

  // -------------------------------------------------------------------------
  // TEST 5: Parent Receives Pending Request via RLS
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 5: PARENT RECEIVES PENDING REQUEST VIA RLS ---");
  await asUser(aliceId, "alice.parent@example.com", true);
  const parentRequests = (await db.query(`SELECT id, child_uid, status FROM public.family_link_requests WHERE parent_uid = '${aliceId}' AND status = 'pending';`)).rows as any[];

  report(
    "5. Parent queries and receives pending connection request for their family",
    parentRequests.length === 1 && parentRequests[0].id === bobReqId,
    `Pending requests count: ${parentRequests.length}, Target: ${parentRequests[0]?.id}`
  );

  // -------------------------------------------------------------------------
  // TEST 6: Parent Accepts Request Atomically
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 6: PARENT ACCEPTS CONNECTION REQUEST ---");
  await asUser(aliceId, "alice.parent@example.com", true);
  const acceptRes = (await db.query(`SELECT public.respond_to_family_link_request('${bobReqId}', 'accept') AS result;`)).rows[0] as any;
  const acceptJson = typeof acceptRes.result === "string" ? JSON.parse(acceptRes.result) : acceptRes.result;

  // Verify child record in public.users is now linked
  const bobUserAfterApproval = (await db.query(`SELECT parent_id, family_code FROM public.users WHERE id = '${bobId}';`)).rows[0] as any;

  // Verify child_profiles record created under parent
  const childProfileRes = (await db.query(`SELECT id, name FROM public.child_profiles WHERE parent_id = '${aliceId}' AND child_user_id = '${bobId}';`)).rows[0] as any;

  report(
    "6. Parent accepts request: status is accepted, relationship established, and child profile created",
    acceptJson.status === "accepted" && 
    bobUserAfterApproval.parent_id === aliceId && 
    bobUserAfterApproval.family_code === aliceCode &&
    Boolean(childProfileRes?.id),
    `Status: ${acceptJson.status}, Child parent_id: ${bobUserAfterApproval.parent_id}, Profile ID: ${childProfileRes?.id}`
  );

  // -------------------------------------------------------------------------
  // TEST 7: Parent Rejects Another Request
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 7: PARENT REJECTS CONNECTION REQUEST ---");
  // Charlie submits request to Alice
  await asUser(charlieId, "charlie.child@example.com", true);
  const charlieSubRes = (await db.query(`SELECT public.submit_family_link_request('${aliceCode}') AS result;`)).rows[0] as any;
  const charlieReq = typeof charlieSubRes.result === "string" ? JSON.parse(charlieSubRes.result) : charlieSubRes.result;
  const charlieReqId = charlieReq.id;

  // Alice rejects Charlie's request
  await asUser(aliceId, "alice.parent@example.com", true);
  const rejectRes = (await db.query(`SELECT public.respond_to_family_link_request('${charlieReqId}', 'reject') AS result;`)).rows[0] as any;
  const rejectJson = typeof rejectRes.result === "string" ? JSON.parse(rejectRes.result) : rejectRes.result;

  // Switch to Charlie to verify own profile under RLS (Alice cannot view unlinked users)
  await asUser(charlieId, "charlie.child@example.com", true);
  const charlieUser = (await db.query(`SELECT parent_id, family_code FROM public.users WHERE id = '${charlieId}';`)).rows[0] as any;

  report(
    "7. Parent rejects request: status is rejected, child remains unlinked",
    rejectJson.status === "rejected" && charlieUser?.parent_id === null && charlieUser?.family_code === null,
    `Status: ${rejectJson.status}, Charlie parent_id: ${charlieUser?.parent_id}`
  );

  // -------------------------------------------------------------------------
  // TEST 8: Unrelated Parent Cannot Access or Respond to Request
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 8: UNRELATED PARENT ISOLATION ---");
  await asUser(eveId, "eve.unrelated@example.com", true);
  
  // RLS Select Isolation: Eve cannot select Alice's requests
  const eveViewAliceRequests = (await db.query(`SELECT id FROM public.family_link_requests WHERE id = '${bobReqId}';`)).rows;
  
  // Mutation Isolation: Eve cannot accept or reject Alice's request
  let eveTamperFailed = false;
  let eveTamperMsg = "";
  try {
    await db.query(`SELECT public.respond_to_family_link_request('${charlieReqId}', 'accept');`);
  } catch (err: any) {
    eveTamperFailed = true;
    eveTamperMsg = err.message;
  }

  report(
    "8. Unrelated Parent cannot view or respond to other families' requests",
    eveViewAliceRequests.length === 0 && eveTamperFailed && eveTamperMsg.includes("Unauthorized"),
    `RLS filtered: ${eveViewAliceRequests.length} rows, Tamper blocked: ${eveTamperMsg}`
  );

  // -------------------------------------------------------------------------
  // TEST 9: Child Cannot Directly Assign Another Parent UID
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 9: CHILD CANNOT TAMPER WITH PARENT LINK DIRECTLY ---");
  await asUser(bobId, "bob.child@example.com", true);
  let childTamperFailed = false;
  let childTamperMsg = "";
  try {
    await db.exec(`UPDATE public.users SET parent_id = '${eveId}' WHERE id = '${bobId}';`);
  } catch (err: any) {
    childTamperFailed = true;
    childTamperMsg = err.message;
  }

  report(
    "9. Child cannot directly assign or switch parent_id",
    childTamperFailed && childTamperMsg.includes("Cannot reassign child parent link"),
    `Blocked with: ${childTamperMsg}`
  );

  // -------------------------------------------------------------------------
  // TEST 10: Duplicate Requests Handled Safely
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 10: DUPLICATE & CONFLICTING REQUEST PREVENTION ---");
  
  // 10.1 Linked child attempting to submit another link request
  await asUser(bobId, "bob.child@example.com", true);
  let linkedChildSubmitFailed = false;
  let linkedChildMsg = "";
  try {
    await db.query(`SELECT public.submit_family_link_request('${aliceCode}');`);
  } catch (err: any) {
    linkedChildSubmitFailed = true;
    linkedChildMsg = err.message;
  }

  // 10.2 Eve creates a family and gets code
  await asUser(eveId, "eve.unrelated@example.com", true);
  const eveFamRes = (await db.query(`SELECT public.generate_or_get_family_code('Eve Family') AS result;`)).rows[0] as any;
  const eveCode = (typeof eveFamRes.result === "string" ? JSON.parse(eveFamRes.result) : eveFamRes.result).family_code;

  // Unlinked Charlie submits to Eve
  await asUser(charlieId, "charlie.child@example.com", true);
  const charlieEve1 = (await db.query(`SELECT public.submit_family_link_request('${eveCode}') AS result;`)).rows[0] as any;
  const charlieEve1Json = typeof charlieEve1.result === "string" ? JSON.parse(charlieEve1.result) : charlieEve1.result;

  // Charlie submits same code again while pending
  const charlieEve2 = (await db.query(`SELECT public.submit_family_link_request('${eveCode}') AS result;`)).rows[0] as any;
  const charlieEve2Json = typeof charlieEve2.result === "string" ? JSON.parse(charlieEve2.result) : charlieEve2.result;

  report(
    "10. Already linked child is blocked; duplicate pending request returns existing record safely",
    linkedChildSubmitFailed && linkedChildMsg.includes("already linked") && charlieEve2Json.is_duplicate === true && charlieEve1Json.id === charlieEve2Json.id,
    `Blocked: ${linkedChildMsg}, Duplicate handled: is_duplicate=${charlieEve2Json.is_duplicate}`
  );

  // -------------------------------------------------------------------------
  // TEST 11: Collision-Safe Family Code Generation
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 11: UNIQUE CODE INTEGRITY & COLLISION RESISTANCE ---");
  await asSystem(); // Query system-level to verify global database uniqueness constraint
  const uniqueFamCount = (await db.query(`SELECT count(DISTINCT family_code)::int AS codes, count(*)::int AS rows FROM public.families;`)).rows[0] as any;

  report(
    "11. Family codes maintain strict database-enforced uniqueness constraint",
    uniqueFamCount.codes === uniqueFamCount.rows && uniqueFamCount.rows >= 2,
    `Unique codes: ${uniqueFamCount.codes}, Total rows: ${uniqueFamCount.rows}`
  );

  // -------------------------------------------------------------------------
  // TEST 12: Disabled Users Cannot Create or Approve Requests
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 12: DISABLED USERS REJECTED BY DATABASE RLS & FUNCTIONS ---");
  
  // 12.1 Disabled parent Dan cannot generate family code
  await asUser(danId, "dan.disabled@example.com", true);
  let disabledParentFailed = false;
  let disabledParentMsg = "";
  try {
    await db.query(`SELECT public.generate_or_get_family_code();`);
  } catch (err: any) {
    disabledParentFailed = true;
    disabledParentMsg = err.message;
  }

  // 12.2 Disabled child Dave cannot submit link request
  await asUser(daveId, "dave.disabled@example.com", true);
  let disabledChildFailed = false;
  let disabledChildMsg = "";
  try {
    await db.query(`SELECT public.submit_family_link_request('${aliceCode}');`);
  } catch (err: any) {
    disabledChildFailed = true;
    disabledChildMsg = err.message;
  }

  // 12.3 Disabled user rejected by RLS query on families
  await asUser(danId, "dan.disabled@example.com", true);
  const disabledRlsQuery = (await db.query(`SELECT * FROM public.families;`)).rows;

  report(
    "12. Disabled users rejected from family generation, link requests, and RLS queries",
    disabledParentFailed && disabledParentMsg.includes("Account is disabled") &&
    disabledChildFailed && disabledChildMsg.includes("Account is disabled") &&
    disabledRlsQuery.length === 0,
    `Parent error: ${disabledParentMsg}, Child error: ${disabledChildMsg}, RLS rows: ${disabledRlsQuery.length}`
  );

  // -------------------------------------------------------------------------
  // TEST 13: Disconnect / Unlink Retains History
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 13: FAMILY DISCONNECTION RETAINS AUDIT LOGS ---");
  await asUser(aliceId, "alice.parent@example.com", true);
  const unlinkRes = (await db.query(`SELECT public.unlink_child('${bobId}') AS result;`)).rows[0] as any;
  const unlinkJson = typeof unlinkRes.result === "string" ? JSON.parse(unlinkRes.result) : unlinkRes.result;

  // Switch to Bob to verify own profile after unlinking
  await asUser(bobId, "bob.child@example.com", true);
  const bobAfterUnlink = (await db.query(`SELECT parent_id, family_code FROM public.users WHERE id = '${bobId}';`)).rows[0] as any;

  // Check activity logs as Alice
  await asUser(aliceId, "alice.parent@example.com", true);
  const activityLogsCount = (await db.query(`SELECT count(*)::int AS count FROM public.activity_logs WHERE parent_id = '${aliceId}';`)).rows[0] as any;

  report(
    "13. Unlinking child clears parent_id atomically and retains activity logs",
    unlinkJson.success === true && bobAfterUnlink.parent_id === null && activityLogsCount.count >= 2,
    `Unlinked success: ${unlinkJson.success}, Bob parent_id: ${bobAfterUnlink.parent_id}, Audit logs retained: ${activityLogsCount.count}`
  );

  console.log("\n===============================================================================");
  console.log(` PHASE 3 VALIDATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Validation().catch((err) => {
  console.error("FATAL ERROR IN PHASE 3 VALIDATION:", err);
  process.exit(1);
});
