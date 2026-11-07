/**
 * Guardian AI - Complete Two-Session SOS Workflow Regression Test
 * 
 * Verifies all requirements of CHECK 2:
 * 1. Child triggers SOS for themselves in Session 1.
 * 2. Correct Parent receives the realtime alert in Session 2.
 * 3. Correct Parent resolves the active alert.
 * 4. Child receives the resolved acknowledgement in Session 1.
 * 5. Verifies authoritative childId, parentUid, and familyCode mapping.
 * 6. Verifies unauthorized users (unrelated parent, child self) cannot resolve alerts.
 * 7. Zero role promotions, zero family overwrites.
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import * as fs from "fs";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from "firebase/firestore";
import {
  executeTriggerSosAlert,
  executeResolveSosAlert
} from "../src/lib/useFirebaseSync";

const PROJECT_ID = "demo-audit";

async function runCompleteSosWorkflowTest() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI - CHECK 2: COMPLETE TWO-SESSION SOS WORKFLOW AUDIT");
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

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${name}${detail ? ` -> ${detail}` : ""}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} -> ${detail || "Condition not met"}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // SEED TEST FIXTURES
    // -------------------------------------------------------------
    const PARENT_UID = "parent-sim-1";
    const CHILD_UID = "child-sim-1";
    const INTRUDER_UID = "parent-intruder-99";
    const FAMILY_CODE = "FAM999";
    const OTHER_FAMILY_CODE = "FAMOTHER";

    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();

      // Parent Alice
      await setDoc(doc(adminDb, "users", PARENT_UID), {
        uid: PARENT_UID,
        role: "parent",
        familyCode: FAMILY_CODE,
        fullName: "Alice Parent",
        email: "alice@guardian.ai"
      });
      await setDoc(doc(adminDb, "families", FAMILY_CODE), {
        familyCode: FAMILY_CODE,
        ownerParentId: PARENT_UID,
        familyName: "Alice's Family"
      });

      // Child Bob
      await setDoc(doc(adminDb, "users", CHILD_UID), {
        uid: CHILD_UID,
        role: "child",
        parentId: PARENT_UID,
        familyCode: FAMILY_CODE,
        fullName: "Bob Child",
        email: "bob@guardian.ai"
      });
      await setDoc(doc(adminDb, "users", PARENT_UID, "profiles", CHILD_UID), {
        id: CHILD_UID,
        name: "Bob Child",
        age: 11
      });

      // Intruder Parent Eve
      await setDoc(doc(adminDb, "users", INTRUDER_UID), {
        uid: INTRUDER_UID,
        role: "parent",
        familyCode: OTHER_FAMILY_CODE,
        fullName: "Eve Intruder",
        email: "eve@unrelated.com"
      });
      await setDoc(doc(adminDb, "families", OTHER_FAMILY_CODE), {
        familyCode: OTHER_FAMILY_CODE,
        ownerParentId: INTRUDER_UID,
        familyName: "Eve's Family"
      });
    });

    console.log("-> Test fixtures successfully seeded into emulator.\n");

    // Session 1: Child authenticated context
    const childContext = testEnv.authenticatedContext(CHILD_UID);
    const childDb = childContext.firestore();

    // Session 2: Parent authenticated context
    const parentContext = testEnv.authenticatedContext(PARENT_UID);
    const parentDb = parentContext.firestore();

    // Session 3: Intruder authenticated context
    const intruderContext = testEnv.authenticatedContext(INTRUDER_UID);
    const intruderDb = intruderContext.firestore();

    // -------------------------------------------------------------
    // STEP 1: Child triggers SOS for themselves in Session 1
    // -------------------------------------------------------------
    console.log("--- STEP 1: Child triggers SOS in Session 1 ---");
    const triggeredAlert = await executeTriggerSosAlert({
      db: childDb,
      user: { uid: CHILD_UID, email: "bob@guardian.ai", displayName: "Bob Child" } as any,
      userData: { role: "child", fullName: "Bob Child", familyCode: FAMILY_CODE, parentId: PARENT_UID },
      familyData: { familyCode: FAMILY_CODE, ownerParentId: PARENT_UID, familyName: "Alice's Family", createdAt: new Date().toISOString() },
      profiles: [],
      childId: CHILD_UID,
      childName: "Bob Child",
      location: { lat: 37.7749, lng: -122.4194, name: "San Francisco" }
    });

    assert(
      "Step 1.1: SOS alert returned from executeTriggerSosAlert",
      triggeredAlert !== null && typeof triggeredAlert.id === "string"
    );
    assert(
      "Step 1.2: Authoritative childId is the authenticated Child UID",
      triggeredAlert?.childId === CHILD_UID
    );
    assert(
      "Step 1.3: Authoritative parentUid derived from verified Firestore relationships",
      triggeredAlert?.parentUid === PARENT_UID
    );
    assert(
      "Step 1.4: Authoritative familyCode matches family network",
      triggeredAlert?.familyCode === FAMILY_CODE
    );
    assert(
      "Step 1.5: Initial status is 'active'",
      triggeredAlert?.status === "active"
    );

    const alertId = triggeredAlert!.id;

    // -------------------------------------------------------------
    // STEP 2: Parent receives realtime alert in Session 2
    // -------------------------------------------------------------
    console.log("\n--- STEP 2: Parent receives realtime alert in Session 2 ---");
    let parentReceivedAlert: any = null;
    const alertDocRefParent = doc(parentDb, "sosAlerts", alertId);

    const parentSnapPromise = new Promise<void>((resolve) => {
      const unsub = onSnapshot(alertDocRefParent, (snap) => {
        if (snap.exists()) {
          parentReceivedAlert = snap.data();
          unsub();
          resolve();
        }
      });
    });

    await parentSnapPromise;

    assert(
      "Step 2.1: Parent received realtime snapshot of active alert",
      parentReceivedAlert !== null && parentReceivedAlert.status === "active"
    );
    assert(
      "Step 2.2: Parent snapshot childId matches child",
      parentReceivedAlert.childId === CHILD_UID
    );
    assert(
      "Step 2.3: Parent snapshot parentUid matches parent",
      parentReceivedAlert.parentUid === PARENT_UID
    );

    // -------------------------------------------------------------
    // STEP 3: Unauthorized attempts to resolve alert are REJECTED
    // -------------------------------------------------------------
    console.log("\n--- STEP 3: Security enforcement on unauthorized resolution ---");
    
    // Attempt 3A: Intruder Parent attempts resolution
    let intruderRejected = false;
    try {
      await executeResolveSosAlert({
        db: intruderDb,
        user: { uid: INTRUDER_UID, email: "eve@unrelated.com" } as any,
        userData: { role: "parent", familyCode: OTHER_FAMILY_CODE },
        alertId: alertId,
        targetAlert: triggeredAlert
      });
    } catch (e: any) {
      intruderRejected = true;
    }
    assert(
      "Step 3.1: Unrelated parent resolution attempt REJECTED",
      intruderRejected
    );

    // Attempt 3B: Child attempts self-resolution
    let childSelfRejected = false;
    try {
      await executeResolveSosAlert({
        db: childDb,
        user: { uid: CHILD_UID, email: "bob@guardian.ai" } as any,
        userData: { role: "child", familyCode: FAMILY_CODE, parentId: PARENT_UID },
        alertId: alertId,
        targetAlert: triggeredAlert
      });
    } catch (e: any) {
      childSelfRejected = true;
    }
    assert(
      "Step 3.2: Child self-resolution attempt REJECTED (zero self-clear)",
      childSelfRejected
    );

    // Verify Child role NOT promoted
    let childDocAfterRejections: any;
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();
      childDocAfterRejections = await getDoc(doc(adminDb, "users", CHILD_UID));
    });
    assert(
      "Step 3.3: Child role remains 'child' (ZERO role promotion occurred)",
      childDocAfterRejections.data()?.role === "child"
    );

    // -------------------------------------------------------------
    // STEP 4: Authorized Parent resolves the alert in Session 2
    // -------------------------------------------------------------
    console.log("\n--- STEP 4: Authorized Parent resolves alert in Session 2 ---");
    
    // Setup listener in Session 1 (Child's screen) to wait for resolution acknowledgement
    const alertDocRefChild = doc(childDb, "sosAlerts", alertId);
    let childAcknowledgedResolution: any = null;

    const childAckPromise = new Promise<void>((resolve) => {
      const unsub = onSnapshot(alertDocRefChild, (snap) => {
        if (snap.exists() && snap.data()?.status === "resolved") {
          childAcknowledgedResolution = snap.data();
          unsub();
          resolve();
        }
      });
    });

    const resolveResult = await executeResolveSosAlert({
      db: parentDb,
      user: { uid: PARENT_UID, email: "alice@guardian.ai" } as any,
      userData: { role: "parent", familyCode: FAMILY_CODE },
      alertId: alertId,
      targetAlert: triggeredAlert
    });

    assert(
      "Step 4.1: Authorized parent resolution succeeded",
      resolveResult !== null && resolveResult.alertId === alertId
    );
    assert(
      "Step 4.2: ResolvedBy field matches authorized Parent UID",
      resolveResult.resolvedBy === PARENT_UID
    );

    // -------------------------------------------------------------
    // STEP 5: Child receives resolved acknowledgement in Session 1
    // -------------------------------------------------------------
    console.log("\n--- STEP 5: Child receives resolved acknowledgement in Session 1 ---");
    await childAckPromise;

    assert(
      "Step 5.1: Child received realtime status update 'resolved'",
      childAcknowledgedResolution !== null && childAcknowledgedResolution.status === "resolved"
    );
    assert(
      "Step 5.2: Child acknowledgement includes resolvedBy matching parent",
      childAcknowledgedResolution.resolvedBy === PARENT_UID
    );
    assert(
      "Step 5.3: Child acknowledgement contains valid resolvedAt audit timestamp",
      childAcknowledgedResolution.resolvedAt !== undefined
    );

    // -------------------------------------------------------------
    // STEP 6: Final Database Integrity Check
    // -------------------------------------------------------------
    console.log("\n--- STEP 6: Final Database Integrity Check ---");
    let finalFamDoc: any;
    let finalChildDoc: any;
    let finalParentDoc: any;
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();
      finalFamDoc = await getDoc(doc(adminDb, "families", FAMILY_CODE));
      finalChildDoc = await getDoc(doc(adminDb, "users", CHILD_UID));
      finalParentDoc = await getDoc(doc(adminDb, "users", PARENT_UID));
    });

    assert(
      "Step 6.1: Family ownerParentId was NOT overwritten",
      finalFamDoc.data()?.ownerParentId === PARENT_UID
    );
    assert(
      "Step 6.2: Child profile and role remain intact",
      finalChildDoc.data()?.role === "child" && finalChildDoc.data()?.parentId === PARENT_UID
    );
    assert(
      "Step 6.3: Parent account remains unchanged",
      finalParentDoc.data()?.role === "parent" && finalParentDoc.data()?.familyCode === FAMILY_CODE
    );

  } finally {
    await testEnv.cleanup();
  }

  console.log("\n===============================================================================");
  console.log(` CHECK 2 TOTALS: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runCompleteSosWorkflowTest().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
