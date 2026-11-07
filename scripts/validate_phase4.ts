import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";
import * as path from "path";

async function runPhase4Validation() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI: SUPABASE EDITION - PHASE 4 EMERGENCY SOS & REALTIME VALIDATION");
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

  // 2. Apply Migrations 1, 2, 3, and 4
  console.log("-> 2. Applying Schema, RLS, and SOS Migrations...");
  const m1 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000000_initial_schema.sql"), "utf8");
  await db.exec(m1);
  const m2 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000001_rls_policies.sql"), "utf8");
  await db.exec(m2);
  const m3 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000002_family_linking.sql"), "utf8");
  await db.exec(m3);
  const m4 = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261105000003_sos_realtime.sql"), "utf8");
  await db.exec(m4);
  console.log("-> Migrations applied successfully.\n");

  // 3. Seed Test Identities
  const aliceId   = "40000000-0000-0000-0000-000000000001"; // Parent
  const eveId     = "40000000-0000-0000-0000-000000000002"; // Unrelated Parent
  const bobId     = "40000000-0000-0000-0000-000000000003"; // Child (Alice's child)
  const charlieId = "40000000-0000-0000-0000-000000000004"; // Child (Unlinked)
  const adminId   = "40000000-0000-0000-0000-000000000005"; // Admin
  const danId     = "40000000-0000-0000-0000-000000000006"; // Disabled Parent

  await asSystem();
  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) VALUES
      ('${aliceId}', 'alice.parent@example.com', '{"role":"parent","full_name":"Alice Parent"}'::jsonb, now()),
      ('${eveId}', 'eve.unrelated@example.com', '{"role":"parent","full_name":"Eve Unrelated"}'::jsonb, now()),
      ('${bobId}', 'bob.child@example.com', '{"role":"child","full_name":"Bob Explorer"}'::jsonb, now()),
      ('${charlieId}', 'charlie.child@example.com', '{"role":"child","full_name":"Charlie Explorer"}'::jsonb, now()),
      ('${adminId}', 'admin@guardianai.io', '{"role":"admin"}'::jsonb, now()),
      ('${danId}', 'dan.disabled@example.com', '{"role":"parent","full_name":"Dan Disabled"}'::jsonb, now());

    UPDATE public.users SET disabled = TRUE WHERE id = '${danId}';
  `);

  // Alice creates family and Bob links to Alice
  await asUser(aliceId, "alice.parent@example.com", true);
  const famRes = (await db.query(`SELECT public.generate_or_get_family_code('Alice Family') AS result;`)).rows[0] as any;
  const aliceCode = (typeof famRes.result === "string" ? JSON.parse(famRes.result) : famRes.result).family_code;

  await asUser(bobId, "bob.child@example.com", true);
  const linkReq = (await db.query(`SELECT public.submit_family_link_request('${aliceCode}') AS result;`)).rows[0] as any;
  const linkReqId = (typeof linkReq.result === "string" ? JSON.parse(linkReq.result) : linkReq.result).id;

  await asUser(aliceId, "alice.parent@example.com", true);
  await db.query(`SELECT public.respond_to_family_link_request('${linkReqId}', 'accept');`);

  // -------------------------------------------------------------------------
  // TEST 1: Child Creates SOS for Themselves
  // -------------------------------------------------------------------------
  console.log("--- TEST 1: CHILD SOS CREATION (SELF) ---");
  await asUser(bobId, "bob.child@example.com", true);
  const triggerRes1 = (await db.query(`
    SELECT public.trigger_emergency_sos(
      '${bobId}', 
      '{"lat": 17.4849, "lng": 78.3907, "name": "Kondapur Tech Academy"}'::jsonb
    ) AS result;
  `)).rows[0] as any;
  const alert1 = typeof triggerRes1.result === "string" ? JSON.parse(triggerRes1.result) : triggerRes1.result;
  const alert1Id = alert1.id;

  report(
    "1. Child creates SOS for themselves; parent_uid and family_code authoritatively populated",
    alert1.status === "active" && alert1.child_id === bobId && alert1.parent_uid === aliceId && alert1.family_code === aliceCode,
    `Alert ID: ${alert1Id}, Parent UID: ${alert1.parent_uid}, Family Code: ${alert1.family_code}`
  );

  // -------------------------------------------------------------------------
  // TEST 2: Child Cannot Create SOS for Another Child
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 2: CHILD CANNOT CREATE SOS FOR ANOTHER CHILD ---");
  await asUser(bobId, "bob.child@example.com", true);
  let spoofSosFailed = false;
  let spoofSosMsg = "";
  try {
    await db.query(`
      SELECT public.trigger_emergency_sos(
        '${charlieId}', 
        '{"lat": 17.4849, "lng": 78.3907, "name": "Fake Spoof"}'::jsonb
      );
    `);
  } catch (err: any) {
    spoofSosFailed = true;
    spoofSosMsg = err.message;
  }

  report(
    "2. Child cannot trigger SOS for another child (spoofing prevented)",
    spoofSosFailed && spoofSosMsg.includes("Child users are strictly permitted to trigger emergency SOS for themselves only"),
    `Blocked with: ${spoofSosMsg}`
  );

  // -------------------------------------------------------------------------
  // TEST 3: Correct Parent Receives Alert via RLS
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 3: CORRECT PARENT RECEIVES ALERT VIA RLS ---");
  await asUser(aliceId, "alice.parent@example.com", true);
  const aliceAlerts = (await db.query(`SELECT id, child_id, status FROM public.sos_alerts WHERE id = '${alert1Id}';`)).rows as any[];

  report(
    "3. Correct Parent queries and receives the active SOS distress alert",
    aliceAlerts.length === 1 && aliceAlerts[0].id === alert1Id && aliceAlerts[0].status === "active",
    `Alert count: ${aliceAlerts.length}, Status: ${aliceAlerts[0]?.status}`
  );

  // -------------------------------------------------------------------------
  // TEST 4: Unrelated Parent Does NOT Receive Alert
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 4: UNRELATED PARENT RLS ISOLATION ---");
  await asUser(eveId, "eve.unrelated@example.com", true);
  const eveAlerts = (await db.query(`SELECT id FROM public.sos_alerts WHERE id = '${alert1Id}';`)).rows;

  report(
    "4. Unrelated Parent cannot access or view alert via RLS (filtered to 0)",
    eveAlerts.length === 0,
    `Returned rows: ${eveAlerts.length}`
  );

  // -------------------------------------------------------------------------
  // TEST 5: Correct Parent Resolves Alert
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 5: CORRECT PARENT RESOLVES ALERT ---");
  await asUser(aliceId, "alice.parent@example.com", true);
  const resolveRes1 = (await db.query(`SELECT public.resolve_emergency_sos('${alert1Id}') AS result;`)).rows[0] as any;
  const resolve1 = typeof resolveRes1.result === "string" ? JSON.parse(resolveRes1.result) : resolveRes1.result;

  const alert1Db = (await db.query(`SELECT status, resolved_by, resolved_at FROM public.sos_alerts WHERE id = '${alert1Id}';`)).rows[0] as any;

  report(
    "5. Correct Parent resolves alert: status updated to 'resolved' and audit trail recorded",
    resolve1.status === "resolved" && alert1Db.status === "resolved" && alert1Db.resolved_by === aliceId && Boolean(alert1Db.resolved_at),
    `Status: ${alert1Db.status}, ResolvedBy: ${alert1Db.resolved_by}, ResolvedAt: ${alert1Db.resolved_at}`
  );

  // -------------------------------------------------------------------------
  // TEST 6: Child CANNOT Resolve Own Alert (Zero Child Self-Clear)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 6: ZERO CHILD SELF-CLEAR ENFORCEMENT ---");
  // Bob triggers second alert
  await asUser(bobId, "bob.child@example.com", true);
  const triggerRes2 = (await db.query(`SELECT public.trigger_emergency_sos('${bobId}') AS result;`)).rows[0] as any;
  const alert2Id = (typeof triggerRes2.result === "string" ? JSON.parse(triggerRes2.result) : triggerRes2.result).id;

  // Bob attempts to resolve own alert via function
  let childResolveFailed = false;
  let childResolveMsg = "";
  try {
    await db.query(`SELECT public.resolve_emergency_sos('${alert2Id}');`);
  } catch (err: any) {
    childResolveFailed = true;
    childResolveMsg = err.message;
  }

  // Bob attempts direct SQL UPDATE
  let childDirectUpdateFailed = false;
  let childDirectUpdateMsg = "";
  try {
    await db.exec(`UPDATE public.sos_alerts SET status = 'resolved' WHERE id = '${alert2Id}';`);
  } catch (err: any) {
    childDirectUpdateFailed = true;
    childDirectUpdateMsg = err.message;
  }

  report(
    "6. Child cannot resolve their own distress alert (zero child self-clear strictly enforced)",
    childResolveFailed && childResolveMsg.includes("Children are not permitted to resolve their own distress alerts"),
    `Function error: ${childResolveMsg}`
  );

  // -------------------------------------------------------------------------
  // TEST 7: Unrelated Parent CANNOT Resolve Alert
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 7: UNRELATED PARENT CANNOT RESOLVE ALERT ---");
  await asUser(eveId, "eve.unrelated@example.com", true);
  let eveResolveFailed = false;
  let eveResolveMsg = "";
  try {
    await db.query(`SELECT public.resolve_emergency_sos('${alert2Id}');`);
  } catch (err: any) {
    eveResolveFailed = true;
    eveResolveMsg = err.message;
  }

  report(
    "7. Unrelated Parent cannot resolve another family's distress alert",
    eveResolveFailed && eveResolveMsg.includes("Only the authorized linked parent or administrator can resolve"),
    `Blocked with: ${eveResolveMsg}`
  );

  // -------------------------------------------------------------------------
  // TEST 8: Admin Authorization Follows Security Policy
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 8: ADMINISTRATOR EMERGENCY AUTHORIZATION ---");
  await asUser(adminId, "admin@guardianai.io", true);
  const adminResolveRes = (await db.query(`SELECT public.resolve_emergency_sos('${alert2Id}') AS result;`)).rows[0] as any;
  const adminResolve = typeof adminResolveRes.result === "string" ? JSON.parse(adminResolveRes.result) : adminResolveRes.result;

  const alert2Db = (await db.query(`SELECT status, resolved_by FROM public.sos_alerts WHERE id = '${alert2Id}';`)).rows[0] as any;

  report(
    "8. Verified Administrator can resolve active alerts with full audit logging",
    adminResolve.status === "resolved" && alert2Db.resolved_by === adminId,
    `Status: ${alert2Db.status}, ResolvedBy: ${alert2Db.resolved_by}`
  );

  // -------------------------------------------------------------------------
  // TEST 9: Resolved History is Preserved & Reopening Blocked
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 9: AUDIT PRESERVATION & REOPENING PREVENTION ---");
  // 9.1 Authenticated parent attempting to reopen resolved alert is blocked by RLS (0 rows affected)
  await asUser(aliceId, "alice.parent@example.com", true);
  const parentReopenRes = await db.query(`UPDATE public.sos_alerts SET status = 'active' WHERE id = '${alert1Id}';`);

  // 9.2 Direct system update attempting to reopen resolved alert is caught and blocked by trigger
  await asSystem();
  let systemReopenFailed = false;
  let systemReopenMsg = "";
  try {
    await db.exec(`UPDATE public.sos_alerts SET status = 'active' WHERE id = '${alert1Id}';`);
  } catch (err: any) {
    systemReopenFailed = true;
    systemReopenMsg = err.message;
  }

  const allAlertsCount = (await db.query(`SELECT count(*)::int AS count FROM public.sos_alerts WHERE status = 'resolved';`)).rows[0] as any;
  const alert1Final = (await db.query(`SELECT status FROM public.sos_alerts WHERE id = '${alert1Id}';`)).rows[0] as any;

  report(
    "9. Reopening resolved alerts is blocked by RLS & trigger; complete emergency history is preserved",
    parentReopenRes.affectedRows === 0 && 
    alert1Final.status === "resolved" &&
    systemReopenFailed && 
    systemReopenMsg.includes("cannot be reopened") && 
    allAlertsCount.count === 2,
    `Parent RLS affectedRows: ${parentReopenRes.affectedRows}, System trigger: ${systemReopenMsg}, Preserved alerts: ${allAlertsCount.count}`
  );

  // -------------------------------------------------------------------------
  // TEST 10: Child Receives Resolution Notification / Status Reconciliation
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 10: CHILD RECEIVES RESOLUTION NOTIFICATION (RLS ACCESS) ---");
  await asUser(bobId, "bob.child@example.com", true);
  const childViewAlert = (await db.query(`SELECT id, status, resolved_by, resolved_at FROM public.sos_alerts WHERE id = '${alert1Id}';`)).rows[0] as any;

  report(
    "10. Child reads verified resolution status and parent acknowledgment details via RLS",
    childViewAlert.status === "resolved" && childViewAlert.resolved_by === aliceId && Boolean(childViewAlert.resolved_at),
    `Status: ${childViewAlert.status}, Parent Resolved: ${childViewAlert.resolved_by}`
  );

  // -------------------------------------------------------------------------
  // TEST 11: Disconnected Clients Recover Current Alert Status
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 11: RECONNECTION RECONCILIATION ---");
  // Client reconnects and queries active & resolved alerts for family
  await asUser(aliceId, "alice.parent@example.com", true);
  const reconnectedAlerts = (await db.query(`SELECT id, status FROM public.sos_alerts WHERE parent_uid = '${aliceId}' ORDER BY created_at DESC;`)).rows as any[];

  report(
    "11. Reconnected clients recover complete alert list with current state for reconciliation",
    reconnectedAlerts.length >= 2,
    `Recovered alerts count: ${reconnectedAlerts.length}`
  );

  // -------------------------------------------------------------------------
  // TEST 12: Revoked Family Access Stops Receiving / Creating New Alerts
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 12: REVOKED ACCESS / UNLINKED ISOLATION ---");
  // Alice unlinks Bob
  await asUser(aliceId, "alice.parent@example.com", true);
  await db.query(`SELECT public.unlink_child('${bobId}');`);

  // Bob is now unlinked. Attempting to trigger SOS fails because child is unlinked!
  await asUser(bobId, "bob.child@example.com", true);
  let unlinkedSosFailed = false;
  let unlinkedSosMsg = "";
  try {
    await db.query(`SELECT public.trigger_emergency_sos('${bobId}');`);
  } catch (err: any) {
    unlinkedSosFailed = true;
    unlinkedSosMsg = err.message;
  }

  // Alice cannot query Bob's unlinked alerts anymore
  await asUser(aliceId, "alice.parent@example.com", true);
  const unlinkedChildUserQuery = (await db.query(`SELECT id FROM public.users WHERE id = '${bobId}';`)).rows;

  report(
    "12. Revoked/unlinked child cannot dispatch orphan SOS alerts; unlinked data isolated via RLS",
    unlinkedSosFailed && unlinkedSosMsg.includes("not linked to any active family network") && unlinkedChildUserQuery.length === 0,
    `Unlinked SOS error: ${unlinkedSosMsg}, RLS isolated: ${unlinkedChildUserQuery.length} rows`
  );

  console.log("\n===============================================================================");
  console.log(` PHASE 4 VALIDATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4Validation().catch((err) => {
  console.error("FATAL ERROR IN PHASE 4 VALIDATION:", err);
  process.exit(1);
});
