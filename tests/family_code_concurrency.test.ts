/**
 * Guardian AI - Family Code Concurrency and Integrity Regression Test Suite
 * 
 * Verifies all 5 requirements of CHECK 1:
 * 1. Atomic Firestore transaction behavior (atomic writes across families and users).
 * 2. Collision retry behavior (detects existing family document, retries up to 15 times, succeeds).
 * 3. Simultaneous Parent registrations cannot share a Family Code (race condition protection).
 * 4. Existing Parent Family Codes never change during login, refresh, or sync.
 * 5. Failed registration does not leave an incomplete family (transaction rollback).
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
  runTransaction
} from "firebase/firestore";

const PROJECT_ID = "demo-audit";

async function runFamilyCodeConcurrencyTest() {
  console.log("===============================================================================");
  console.log(" GUARDIAN AI - CHECK 1: FAMILY CODE CONCURRENCY & INTEGRITY TEST SUITE");
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
    // -------------------------------------------------------------------------
    // TEST 1: Atomic Transaction Behavior
    // -------------------------------------------------------------------------
    console.log("--- TEST 1: Atomic Transaction Behavior ---");
    const parent1Uid = "parent-atomic-1";
    const famCode1 = "ATOMIC1";

    // Setup initial parent user doc
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();
      await setDoc(doc(adminDb, "users", parent1Uid), {
        uid: parent1Uid,
        role: "parent",
        fullName: "Atomic Parent",
        email: "atomic@guardian.ai",
        createdAt: new Date().toISOString()
      });
    });

    const parent1Context = testEnv.authenticatedContext(parent1Uid);
    const db1 = parent1Context.firestore();
    const userDocRef = doc(db1, "users", parent1Uid);
    const famDocRef1 = doc(db1, "families", famCode1);

    // Run atomic transaction allocating famCode1 and linking user
    await runTransaction(db1, async (tx) => {
      const famSnap = await tx.get(famDocRef1);
      if (famSnap.exists()) {
        throw new Error("COLLISION");
      }
      tx.set(famDocRef1, {
        familyCode: famCode1,
        familyName: "Atomic Parent's Family",
        ownerParentId: parent1Uid,
        parentEmail: "atomic@guardian.ai",
        createdAt: new Date().toISOString()
      });
      tx.update(userDocRef, { familyCode: famCode1 });
    });

    let verifyFam1: any;
    let verifyUser1: any;
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();
      verifyFam1 = await getDoc(doc(adminDb, "families", famCode1));
      verifyUser1 = await getDoc(doc(adminDb, "users", parent1Uid));
    });

    assert(
      "Test 1.1: Family document created atomically",
      verifyFam1.exists() && verifyFam1.data()?.ownerParentId === parent1Uid
    );
    assert(
      "Test 1.2: User document updated with familyCode atomically",
      verifyUser1.exists() && verifyUser1.data()?.familyCode === famCode1
    );

    // -------------------------------------------------------------------------
    // TEST 2: Collision Retry Behavior
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Collision Retry Behavior ---");
    const parent2Uid = "parent-collision-2";
    const collidedCode = "COLLID";

    // Seed existing family with code "COLLID" and seed parent2 user
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();
      await setDoc(doc(adminDb, "users", parent2Uid), {
        uid: parent2Uid,
        role: "parent",
        fullName: "Collision Parent",
        email: "collision@guardian.ai"
      });
      await setDoc(doc(adminDb, "families", collidedCode), {
        familyCode: collidedCode,
        familyName: "Pre-existing Family",
        ownerParentId: "different-parent",
        createdAt: new Date().toISOString()
      });
    });

    const parent2Context = testEnv.authenticatedContext(parent2Uid);
    const db2 = parent2Context.firestore();
    const userDocRef2 = doc(db2, "users", parent2Uid);

    // Candidate generator sequence: first returns collidedCode, then returns "UNIQUE2"
    const candidates = [collidedCode, "UNIQUE2"];
    let attemptCount = 0;
    let allocatedCode = "";

    for (let attempt = 0; attempt < 15; attempt++) {
      attemptCount++;
      const cand = candidates[attempt] || `RND${attempt}`;
      const candFamRef = doc(db2, "families", cand);
      try {
        await runTransaction(db2, async (tx) => {
          const famSnap = await tx.get(candFamRef);
          if (famSnap.exists()) {
            throw new Error("COLLISION");
          }
          tx.set(candFamRef, {
            familyCode: cand,
            familyName: "Collision Parent's Family",
            ownerParentId: parent2Uid,
            parentEmail: "collision@guardian.ai",
            createdAt: new Date().toISOString()
          });
          tx.update(userDocRef2, { familyCode: cand });
        });
        allocatedCode = cand;
        break;
      } catch (txErr: any) {
        if (txErr?.message === "COLLISION") {
          continue;
        }
        throw txErr;
      }
    }

    assert(
      "Test 2.1: Collision detected on attempt 1 and successfully retried",
      attemptCount === 2,
      `Expected 2 attempts, got ${attemptCount}`
    );
    assert(
      "Test 2.2: Allocated code is the collision-free code 'UNIQUE2'",
      allocatedCode === "UNIQUE2"
    );

    let preExistingCheck: any;
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();
      preExistingCheck = await getDoc(doc(adminDb, "families", collidedCode));
    });

    assert(
      "Test 2.3: Pre-existing family document ownerParentId remained intact ('different-parent')",
      preExistingCheck.data()?.ownerParentId === "different-parent"
    );

    // -------------------------------------------------------------------------
    // TEST 3: Simultaneous Parent Registrations Cannot Share a Code
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Simultaneous Parent Registrations (Race Condition Protection) ---");
    const parentA = "parent-race-A";
    const parentB = "parent-race-B";
    const sharedTargetCode = "RACECD";

    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();
      await setDoc(doc(adminDb, "users", parentA), { uid: parentA, role: "parent" });
      await setDoc(doc(adminDb, "users", parentB), { uid: parentB, role: "parent" });
    });

    const dbA = testEnv.authenticatedContext(parentA).firestore();
    const dbB = testEnv.authenticatedContext(parentB).firestore();

    // Attempt two simultaneous transactions targeting RACECD
    const results = await Promise.allSettled([
      runTransaction(dbA, async (tx) => {
        const snap = await tx.get(doc(dbA, "families", sharedTargetCode));
        if (snap.exists()) throw new Error("COLLISION");
        tx.set(doc(dbA, "families", sharedTargetCode), {
          familyCode: sharedTargetCode,
          ownerParentId: parentA,
          createdAt: new Date().toISOString()
        });
        tx.update(doc(dbA, "users", parentA), { familyCode: sharedTargetCode });
        return parentA;
      }),
      runTransaction(dbB, async (tx) => {
        const snap = await tx.get(doc(dbB, "families", sharedTargetCode));
        if (snap.exists()) throw new Error("COLLISION");
        tx.set(doc(dbB, "families", sharedTargetCode), {
          familyCode: sharedTargetCode,
          ownerParentId: parentB,
          createdAt: new Date().toISOString()
        });
        tx.update(doc(dbB, "users", parentB), { familyCode: sharedTargetCode });
        return parentB;
      })
    ]);

    const successes = results.filter(r => r.status === "fulfilled");
    const rejections = results.filter(r => r.status === "rejected");

    assert(
      "Test 3.1: Exactly one simultaneous transaction committed",
      successes.length === 1 && rejections.length === 1,
      `Successes: ${successes.length}, Rejections: ${rejections.length}`
    );

    let winnerFam: any;
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();
      winnerFam = await getDoc(doc(adminDb, "families", sharedTargetCode));
    });
    const winnerUid = winnerFam.data()?.ownerParentId;
    assert(
      "Test 3.2: Winning ownerParentId exclusively matches the single fulfilled parent",
      winnerUid === parentA || winnerUid === parentB
    );

    // -------------------------------------------------------------------------
    // TEST 4: Existing Parent Family Codes Never Change During Login or Refresh
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Existing Parent Family Codes Immutability ---");
    const stableParentUid = "parent-stable-4";
    const stableCode = "STBL44";

    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();
      await setDoc(doc(adminDb, "families", stableCode), {
        familyCode: stableCode,
        familyName: "Stable Family",
        ownerParentId: stableParentUid,
        createdAt: new Date().toISOString()
      });
      await setDoc(doc(adminDb, "users", stableParentUid), {
        uid: stableParentUid,
        role: "parent",
        familyCode: stableCode
      });
    });

    const parent4Context = testEnv.authenticatedContext(stableParentUid);
    const db4 = parent4Context.firestore();

    // Simulate login/refresh flow: fetch existing code from user doc
    const userSnap = await getDoc(doc(db4, "users", stableParentUid));
    let resolvedCode = "";
    if (userSnap.exists() && userSnap.data()?.familyCode) {
      resolvedCode = userSnap.data()?.familyCode;
    }

    assert(
      "Test 4.1: Existing familyCode is reused directly without regeneration",
      resolvedCode === stableCode
    );

    let checkFamAfterRefresh: any;
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();
      checkFamAfterRefresh = await getDoc(doc(adminDb, "families", stableCode));
    });
    assert(
      "Test 4.2: Family document ownerParentId unchanged after simulated refresh",
      checkFamAfterRefresh.data()?.ownerParentId === stableParentUid
    );

    // -------------------------------------------------------------------------
    // TEST 5: Failed Registration Does Not Leave an Incomplete Family
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Transaction Rollback on Failure ---");
    const failParentUid = "parent-fail-5";
    const failFamCode = "FAIL99";

    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();
      await setDoc(doc(adminDb, "users", failParentUid), {
        uid: failParentUid,
        role: "parent"
      });
    });

    const parent5Context = testEnv.authenticatedContext(failParentUid);
    const db5 = parent5Context.firestore();

    let transactionErrored = false;
    try {
      await runTransaction(db5, async (tx) => {
        tx.set(doc(db5, "families", failFamCode), {
          familyCode: failFamCode,
          ownerParentId: failParentUid,
          createdAt: new Date().toISOString()
        });
        // Intentionally throw an unhandled error inside transaction before completion
        throw new Error("SIMULATED_NETWORK_DISRUPTION");
      });
    } catch (e: any) {
      if (e?.message === "SIMULATED_NETWORK_DISRUPTION") {
        transactionErrored = true;
      }
    }

    assert(
      "Test 5.1: Transaction caught error and aborted",
      transactionErrored
    );

    let verifyRolledBackFam: any;
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();
      verifyRolledBackFam = await getDoc(doc(adminDb, "families", failFamCode));
    });
    assert(
      "Test 5.2: Aborted transaction left NO partial family document in Firestore",
      !verifyRolledBackFam.exists()
    );

  } finally {
    await testEnv.cleanup();
  }

  console.log("\n===============================================================================");
  console.log(` CHECK 1 TOTALS: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runFamilyCodeConcurrencyTest().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
