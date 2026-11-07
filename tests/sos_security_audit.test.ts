/**
 * Guardian AI - SOS Security and Resolution Audit Test Suite
 * 
 * Invokes the ACTUAL production application implementations:
 * - executeTriggerSosAlert()
 * - executeResolveSosAlert()
 * imported directly from src/lib/useFirebaseSync.ts.
 * 
 * Executes against the live Firebase Firestore Rules Emulator to verify:
 * 1. Child triggers their own SOS (verified non-self parentUid derived from Firestore).
 * 2. Parent receives the correct alert (ownership and familyCode match).
 * 3. Correct Parent resolves the alert (allowed with audit trail).
 * 4. Child attempts to resolve an alert and is rejected (zero promotion).
 * 5. Unrelated Parent attempts to resolve an alert and is rejected (zero overwrite).
 * 6. Missing Parent role is rejected without modifying user document.
 * 7. Incorrect family ownership is rejected without modifying any records.
 * 8. Parent-triggered SOS functionality for selected linked child.
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import * as fs from "fs";
import {
  doc,
  getDoc,
  setDoc
} from "firebase/firestore";
import {
  executeTriggerSosAlert,
  executeResolveSosAlert
} from "../src/lib/useFirebaseSync";

const PROJECT_ID = "guardian-ai-sos-application-audit";

async function runRealSosApplicationAudit() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI - REAL SOS APPLICATION CODE AUDIT TEST SUITE");
  console.log(" Invoking actual executeTriggerSosAlert & executeResolveSosAlert implementations");
  console.log("===============================================================================\n");

  const rulesContent = fs.readFileSync("firestore.rules", "utf8");

  const testEnv: RulesTestEnvironment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: rulesContent,
      host: "127.0.0.1",
      port: 8080
    }
  });

  let passedCount = 0;
  let failedCount = 0;

  function assert(testName: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${testName} - ${detail || "Condition not met"}`);
      failedCount++;
    }
  }

  try {
    // -------------------------------------------------------------
    // SEED TEST FIXTURES USING ADMIN CONTEXT
    // -------------------------------------------------------------
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();

      // Parent 1 (Authorized Parent of FAM101)
      await setDoc(doc(adminDb, "users", "parent-1"), {
        uid: "parent-1",
        role: "parent",
        familyCode: "FAM101",
        fullName: "Alice Parent",
        email: "alice@guardian.ai"
      });
      await setDoc(doc(adminDb, "families", "FAM101"), {
        familyCode: "FAM101",
        ownerParentId: "parent-1",
        familyName: "Alice Family"
      });

      // Child 1 (Linked to parent-1 in FAM101)
      await setDoc(doc(adminDb, "users", "child-1"), {
        uid: "child-1",
        role: "child",
        parentId: "parent-1",
        familyCode: "FAM101",
        fullName: "Bob Child",
        email: "bob@guardian.ai"
      });
      await setDoc(doc(adminDb, "users", "parent-1", "profiles", "child-1"), {
        id: "child-1",
        name: "Bob Child",
        age: 10
      });

      // Parent 2 (Unrelated Parent of FAM202)
      await setDoc(doc(adminDb, "users", "parent-2"), {
        uid: "parent-2",
        role: "parent",
        familyCode: "FAM202",
        fullName: "Charlie Parent",
        email: "charlie@guardian.ai"
      });
      await setDoc(doc(adminDb, "families", "FAM202"), {
        familyCode: "FAM202",
        ownerParentId: "parent-2",
        familyName: "Charlie Family"
      });

      // Child 2 (Linked to parent-2 in FAM202)
      await setDoc(doc(adminDb, "users", "child-2"), {
        uid: "child-2",
        role: "child",
        parentId: "parent-2",
        familyCode: "FAM202",
        fullName: "Daisy Child",
        email: "daisy@guardian.ai"
      });

      // User with Missing/Unassigned Role
      await setDoc(doc(adminDb, "users", "user-no-role"), {
        uid: "user-no-role",
        familyCode: "FAM101",
        fullName: "Dave NoRole",
        email: "dave@guardian.ai"
      });
    });

    console.log("-> Test fixtures seeded into isolated emulator environment.\n");

    // -------------------------------------------------------------
    // TEST 1: Child triggers their own SOS using executeTriggerSosAlert()
    // -------------------------------------------------------------
    const child1Context = testEnv.authenticatedContext("child-1", { email: "bob@guardian.ai" });
    const child1Db = child1Context.firestore();

    const t1Alert = await executeTriggerSosAlert({
      db: child1Db,
      user: { uid: "child-1", displayName: "Bob Child", email: "bob@guardian.ai" },
      userData: { role: "child", parentId: "parent-1", familyCode: "FAM101", fullName: "Bob Child" },
      childId: "child-1",
      childName: "Bob Child",
      location: { lat: 34.05, lng: -118.25, name: "Downtown LA" }
    });

    assert(
      "Test 1: Child triggers their own SOS -> Alert created with verified non-self parentUid",
      t1Alert !== null && t1Alert.parentUid === "parent-1" && (t1Alert.parentUid as string) !== "child-1" && t1Alert.childId === "child-1",
      `Actual parentUid=${t1Alert?.parentUid}`
    );

    const activeAlertId = t1Alert.id;

    // -------------------------------------------------------------
    // TEST 2: Parent receives the correct alert
    // -------------------------------------------------------------
    const parent1Context = testEnv.authenticatedContext("parent-1", { email: "alice@guardian.ai" });
    const parent1Db = parent1Context.firestore();

    const parentAlertSnap = await getDoc(doc(parent1Db, "sosAlerts", activeAlertId));
    assert(
      "Test 2: Parent receives the correct alert -> Alert matches parentUid and familyCode",
      parentAlertSnap.exists() && parentAlertSnap.data()?.parentUid === "parent-1" && parentAlertSnap.data()?.familyCode === "FAM101" && parentAlertSnap.data()?.status === "active"
    );

    // -------------------------------------------------------------
    // TEST 4: Child attempts to resolve an alert and is rejected (Zero Role Promotion)
    // -------------------------------------------------------------
    let t4Error: string | null = null;
    try {
      await executeResolveSosAlert({
        db: child1Db,
        user: { uid: "child-1", displayName: "Bob Child", email: "bob@guardian.ai" },
        alertId: activeAlertId
      });
    } catch (err: any) {
      t4Error = err.message || String(err);
    }

    const childDocAfterT4 = await getDoc(doc(parent1Db, "users", "child-1"));
    assert(
      "Test 4: Child attempts to resolve alert -> Rejected with unauthorized role error",
      t4Error !== null && (t4Error.includes("Only verified parents") || t4Error.includes("role \"child\"") || t4Error.includes("permission-denied")),
      `Error: ${t4Error}`
    );
    assert(
      "Test 4 (Integrity): Child user document is NOT mutated or promoted to parent",
      childDocAfterT4.exists() && childDocAfterT4.data()?.role === "child"
    );

    // -------------------------------------------------------------
    // TEST 5: Unrelated Parent attempts to resolve alert and is rejected (Zero Overwrite)
    // -------------------------------------------------------------
    const parent2Context = testEnv.authenticatedContext("parent-2", { email: "charlie@guardian.ai" });
    const parent2Db = parent2Context.firestore();

    let t5Error: string | null = null;
    try {
      await executeResolveSosAlert({
        db: parent2Db,
        user: { uid: "parent-2", displayName: "Charlie Parent", email: "charlie@guardian.ai" },
        alertId: activeAlertId
      });
    } catch (err: any) {
      t5Error = err.message || String(err);
    }

    const alertSnapAfterT5 = await getDoc(doc(parent1Db, "sosAlerts", activeAlertId));
    assert(
      "Test 5: Unrelated Parent attempts to resolve alert -> Rejected with ownership/network mismatch",
      t5Error !== null && (t5Error.includes("Family ownership mismatch") || t5Error.includes("not linked") || t5Error.includes("permission-denied")),
      `Error: ${t5Error}`
    );
    assert(
      "Test 5 (Integrity): Alert status remains 'active'",
      alertSnapAfterT5.exists() && alertSnapAfterT5.data()?.status === "active"
    );

    // -------------------------------------------------------------
    // TEST 6: Missing Parent role is rejected without modifying user document
    // -------------------------------------------------------------
    const noRoleContext = testEnv.authenticatedContext("user-no-role", { email: "dave@guardian.ai" });
    const noRoleDb = noRoleContext.firestore();

    const noRoleDocBefore = (await getDoc(doc(parent1Db, "users", "user-no-role"))).data();
    let t6Error: string | null = null;
    try {
      await executeResolveSosAlert({
        db: noRoleDb,
        user: { uid: "user-no-role", displayName: "Dave NoRole", email: "dave@guardian.ai" },
        alertId: activeAlertId
      });
    } catch (err: any) {
      t6Error = err.message || String(err);
    }
    const noRoleDocAfter = (await getDoc(doc(parent1Db, "users", "user-no-role"))).data();

    assert(
      "Test 6: Missing Parent role -> Rejected with actionable error",
      t6Error !== null && (t6Error.includes("unassigned") || t6Error.includes("Only verified parents") || t6Error.includes("permission-denied")),
      `Error: ${t6Error}`
    );
    assert(
      "Test 6 (Integrity): Missing role user document is NOT promoted or modified in Firestore",
      !noRoleDocAfter?.role && JSON.stringify(noRoleDocBefore) === JSON.stringify(noRoleDocAfter)
    );

    // -------------------------------------------------------------
    // TEST 7: Incorrect family ownership is rejected without modifying any records
    // -------------------------------------------------------------
    // Child 2 triggers SOS for their own family (FAM202)
    const child2Context = testEnv.authenticatedContext("child-2", { email: "daisy@guardian.ai" });
    const child2Db = child2Context.firestore();

    const t7Alert = await executeTriggerSosAlert({
      db: child2Db,
      user: { uid: "child-2", displayName: "Daisy Child", email: "daisy@guardian.ai" },
      userData: { role: "child", parentId: "parent-2", familyCode: "FAM202", fullName: "Daisy Child" },
      childId: "child-2"
    });
    assert(
      "Test 7a: Linked child in FAM202 creates alert for parent-2",
      t7Alert.parentUid === "parent-2" && t7Alert.familyCode === "FAM202"
    );

    const fam2DocBefore = (await getDoc(doc(parent1Db, "families", "FAM202"))).data();

    // Parent 1 attempts to resolve Family 2's alert
    let t7Error: string | null = null;
    try {
      await executeResolveSosAlert({
        db: parent1Db,
        user: { uid: "parent-1", displayName: "Alice Parent", email: "alice@guardian.ai" },
        alertId: t7Alert.id
      });
    } catch (err: any) {
      t7Error = err.message || String(err);
    }
    const fam2DocAfter = (await getDoc(doc(parent1Db, "families", "FAM202"))).data();

    assert(
      "Test 7: Incorrect family ownership -> Parent 1 resolving Parent 2 alert is rejected",
      t7Error !== null && (t7Error.includes("Family ownership mismatch") || t7Error.includes("not linked") || t7Error.includes("permission-denied")),
      `Error: ${t7Error}`
    );
    assert(
      "Test 7 (Integrity): families/FAM202.ownerParentId is NOT overwritten or modified",
      fam2DocAfter?.ownerParentId === "parent-2" && JSON.stringify(fam2DocBefore) === JSON.stringify(fam2DocAfter)
    );

    // -------------------------------------------------------------
    // TEST 3: Correct Parent resolves the active alert
    // -------------------------------------------------------------
    const resolveResult = await executeResolveSosAlert({
      db: parent1Db,
      user: { uid: "parent-1", displayName: "Alice Parent", email: "alice@guardian.ai" },
      alertId: activeAlertId
    });

    const resolvedAlertSnap = await getDoc(doc(parent1Db, "sosAlerts", activeAlertId));
    assert(
      "Test 3: Correct Parent resolves alert -> Successfully marked 'resolved' with audit fields",
      resolveResult !== null &&
      resolvedAlertSnap.exists() &&
      resolvedAlertSnap.data()?.status === "resolved" &&
      resolvedAlertSnap.data()?.resolvedBy === "parent-1" &&
      Boolean(resolvedAlertSnap.data()?.resolvedAt)
    );

    // -------------------------------------------------------------
    // TEST 8: Parent-triggered SOS functionality for selected linked child
    // -------------------------------------------------------------
    const parentTriggeredAlert = await executeTriggerSosAlert({
      db: parent1Db,
      user: { uid: "parent-1", displayName: "Alice Parent", email: "alice@guardian.ai" },
      userData: { role: "parent", familyCode: "FAM101", fullName: "Alice Parent" },
      profiles: [{
        id: "child-1",
        name: "Bob Child",
        age: 10,
        avatar: "star",
        device: "Bob's Tablet",
        battery: 88,
        status: "online",
        screenTimeLimit: 120,
        screenTimeToday: 45,
        riskScore: 10,
        lastSeenLocation: { lat: 34.05, lng: -118.25, name: "Home", timestamp: new Date().toISOString() }
      }],
      childId: "child-1",
      childName: "Bob Child"
    });

    assert(
      "Test 8: Parent-triggered SOS for selected child -> Successfully created with parentUid as caller and childId as target",
      parentTriggeredAlert !== null &&
      parentTriggeredAlert.parentUid === "parent-1" &&
      parentTriggeredAlert.childId === "child-1" &&
      parentTriggeredAlert.status === "active"
    );

  } finally {
    await testEnv.cleanup();
  }

  console.log("\n===============================================================================");
  console.log(` AUDIT TOTALS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("===============================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runRealSosApplicationAudit().catch((err) => {
  console.error("Unhandled audit execution error:", err);
  process.exit(1);
});
