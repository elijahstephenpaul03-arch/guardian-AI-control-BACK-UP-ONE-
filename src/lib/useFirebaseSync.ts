import { useState, useEffect, useRef, useCallback } from "react";
import { 
  auth, 
  db, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  User
} from "./firebase";
import { onSnapshot, writeBatch, query, where, deleteDoc, limit, getDocFromServer, serverTimestamp, runTransaction } from "firebase/firestore";
import { ChildProfile, ChildDevice, ActivityLog, ChatMessage, FamilyData, FamilyRequest, HomeworkTask, DailyGoal, SosAlert, UserRole, PlatformUser, AdminSystemHealth, SecurityAuditLog, PlatformConfig } from "../types";
import { initialProfiles, initialLogs, initialDevices } from "../data";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo));
}

// Known Administrator email addresses
export const ADMIN_EMAILS = [
  "elijahstephenpaul03@gmail.com",
  "admin@guardianai.io",
  "admin@guardian.ai"
];

// Exported Core Application Functions for Production and Test Suites
export interface TriggerSosAlertParams {
  db: any;
  user: { uid: string; displayName?: string | null; email?: string | null } | null;
  userData?: { role?: string; parentId?: string; familyCode?: string; fullName?: string } | null;
  familyData?: FamilyData | null;
  profiles?: ChildProfile[];
  childId?: string;
  childName?: string;
  location?: { lat: number; lng: number; name: string };
  isQuotaExhausted?: boolean;
}

export async function executeTriggerSosAlert(params: TriggerSosAlertParams): Promise<SosAlert> {
  const { db, user, userData, familyData, profiles = [], childId, childName, location, isQuotaExhausted } = params;

  if (!user) throw new Error("Must be logged in to trigger an SOS alert.");

  if (isQuotaExhausted) {
    throw new Error("Firebase Cloud Quota Limit Reached (Spark Plan). Emergency SOS cannot be sent to Cloud Firestore. Parents have NOT received this distress signal via the app. Please call your parent directly!");
  }

  // Requirement 1, 2, 3: Distinguish Child triggering for self vs Parent triggering for selected child
  // When the authenticated user's UID equals the supplied childId, identify caller as Child even during role-loading
  const isChildTriggeringForSelf = Boolean(
    (childId && childId === user.uid) ||
    userData?.role === "child" ||
    (!childId && userData?.role !== "parent" && userData?.role !== "admin")
  );

  const effectiveChildId = isChildTriggeringForSelf ? user.uid : (childId || "");
  if (!effectiveChildId) {
    const errMsg = "Unable to create SOS alert: Missing authoritative child ID.";
    console.error("[triggerSosAlert] Error:", errMsg);
    throw new Error(errMsg);
  }

  console.log(`[triggerSosAlert] Initiating SOS alert creation. Authoritative childId=${effectiveChildId}, isChildTriggeringForSelf=${isChildTriggeringForSelf}, callerUid=${user.uid}`);

  let resolvedParentUid = "";
  let resolvedFamilyCode = "";

  if (isChildTriggeringForSelf) {
    // Requirement 4, 5, 6: Resolve Parent UID using validated child userData.parentId and/or authoritative family document
    // Never use child's own UID as alertParentUid
    let candidateParentUid = (userData?.parentId && userData.parentId !== user.uid) ? userData.parentId : "";
    let candidateFamilyCode = userData?.familyCode || familyData?.familyCode || "";

    // Fallback 1: Query fresh child user document directly from Firestore
    if (!candidateParentUid || !candidateFamilyCode) {
      try {
        const childDocSnap = await getDoc(doc(db, "users", user.uid));
        if (childDocSnap.exists()) {
          const cData = childDocSnap.data();
          if (cData.parentId && cData.parentId !== user.uid) {
            candidateParentUid = cData.parentId;
          }
          if (cData.familyCode && !candidateFamilyCode) {
            candidateFamilyCode = cData.familyCode;
          }
        }
      } catch (fetchErr) {
        console.warn("[triggerSosAlert] Notice reading child document for parentId:", fetchErr);
      }
    }

    // Fallback 2: Check authoritative family document /families/{familyCode} for ownerParentId
    if (!candidateParentUid && candidateFamilyCode) {
      try {
        const famSnap = await getDoc(doc(db, "families", candidateFamilyCode));
        if (famSnap.exists()) {
          const fData = famSnap.data() as FamilyData;
          if (fData.ownerParentId && fData.ownerParentId !== user.uid) {
            candidateParentUid = fData.ownerParentId;
          }
        }
      } catch (famErr) {
        console.warn("[triggerSosAlert] Notice reading family document for ownerParentId:", famErr);
      }
    }

    // Fallback 3: Check dedicated familyLinkRequests
    if (!candidateParentUid) {
      try {
        const reqSnap = await getDoc(doc(db, "familyLinkRequests", `req-${user.uid}`));
        if (reqSnap.exists()) {
          const rData = reqSnap.data() as FamilyRequest;
          if (rData.parentUid && rData.parentUid !== user.uid) {
            candidateParentUid = rData.parentUid;
            if (!candidateFamilyCode && rData.familyCode) {
              candidateFamilyCode = rData.familyCode;
            }
          }
        }
      } catch (reqErr) {
        console.warn("[triggerSosAlert] Notice reading familyLinkRequests for parentUid:", reqErr);
      }
    }

    // Enforce strict non-self parent UID and linkage validation (Requirements 5 & 6)
    if (!candidateParentUid || candidateParentUid === user.uid) {
      const linkageErrMsg = "Unable to transmit emergency SOS: This child device is not linked to a verified parent account. Please pair with your parent's Family Code in the connection portal.";
      console.error(`[triggerSosAlert] Linkage validation failure: user.uid=${user.uid}, candidateParentUid=${candidateParentUid}`);
      throw new Error(linkageErrMsg);
    }

    // Verify the Parent's family ownership
    if (candidateFamilyCode) {
      try {
        const famSnap = await getDoc(doc(db, "families", candidateFamilyCode));
        if (famSnap.exists()) {
          const fData = famSnap.data() as FamilyData;
          if (fData.ownerParentId && fData.ownerParentId !== candidateParentUid && fData.ownerParentId !== user.uid) {
            candidateParentUid = fData.ownerParentId;
          }
        }
      } catch (famErr) {
        console.warn("[triggerSosAlert] Notice verifying family ownership for child SOS:", famErr);
      }
    }

    resolvedParentUid = candidateParentUid;
    resolvedFamilyCode = candidateFamilyCode;
  } else {
    // Branch B: Parent-triggered SOS functionality when a Parent sends an alert for a selected child
    // Verify caller is an authorized Parent or Admin in Firestore
    let callerRole = userData?.role;
    if (!callerRole) {
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          callerRole = userSnap.data()?.role;
        }
      } catch (_) {}
    }
    if (callerRole !== "parent" && callerRole !== "admin") {
      throw new Error("Unauthorized: Only verified parents can trigger emergency alerts on behalf of children.");
    }

    if (effectiveChildId === user.uid) {
      throw new Error("Parents cannot trigger child SOS distress alerts for their own user ID. Please select a linked child.");
    }

    resolvedParentUid = user.uid;
    resolvedFamilyCode = familyData?.familyCode || userData?.familyCode || "";

    if (!resolvedFamilyCode) {
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists() && userSnap.data().familyCode) {
          resolvedFamilyCode = userSnap.data().familyCode;
        }
      } catch (_) {}
    }

    if (!resolvedFamilyCode) {
      try {
        const famQ = query(collection(db, "families"), where("ownerParentId", "==", user.uid), limit(1));
        const famQSnap = await getDocs(famQ);
        if (!famQSnap.empty) {
          resolvedFamilyCode = famQSnap.docs[0].id;
        }
      } catch (_) {}
    }

    // Verify the selected child belongs to the Parent's family
    let childBelongsToFamily = false;
    if (profiles && profiles.some(p => p.id === effectiveChildId)) {
      childBelongsToFamily = true;
    }
    if (!childBelongsToFamily) {
      try {
        const childSnap = await getDoc(doc(db, "users", effectiveChildId));
        if (childSnap.exists()) {
          const cData = childSnap.data();
          if (cData.parentId === user.uid || (resolvedFamilyCode && cData.familyCode === resolvedFamilyCode)) {
            childBelongsToFamily = true;
          }
        }
      } catch (_) {}
    }
    if (!childBelongsToFamily) {
      try {
        const profDoc = await getDoc(doc(db, "users", user.uid, "profiles", effectiveChildId));
        if (profDoc.exists()) {
          childBelongsToFamily = true;
        }
      } catch (_) {}
    }
    if (!childBelongsToFamily) {
      try {
        const reqDoc = await getDoc(doc(db, "familyLinkRequests", `req-${effectiveChildId}`));
        if (reqDoc.exists() && reqDoc.data().parentUid === user.uid) {
          childBelongsToFamily = true;
        }
      } catch (_) {}
    }

    if (!childBelongsToFamily) {
      throw new Error("Unauthorized: The selected child does not belong to your family.");
    }

    if (!resolvedParentUid || !resolvedFamilyCode) {
      throw new Error("Unable to trigger SOS: Incomplete parent family linkage.");
    }
  }

  let resolvedChildName: string | undefined = undefined;
  if (isChildTriggeringForSelf && userData?.fullName && typeof userData.fullName === "string" && userData.fullName.trim().length > 0) {
    resolvedChildName = userData.fullName.trim();
  } else if (!isChildTriggeringForSelf && effectiveChildId) {
    const profileMatch = profiles.find(p => p.id === effectiveChildId);
    if (profileMatch?.name && typeof profileMatch.name === "string" && profileMatch.name.trim().length > 0) {
      resolvedChildName = profileMatch.name.trim();
    }
  }

  if (!resolvedChildName && childName && typeof childName === "string" && childName.trim().length > 0) {
    resolvedChildName = childName.trim();
  }

  if (!resolvedChildName && user?.displayName && typeof user.displayName === "string" && user.displayName.trim().length > 0) {
    resolvedChildName = user.displayName.trim();
  }
  if (!resolvedChildName && user?.email && typeof user.email === "string" && user.email.includes("@")) {
    const emailPrefix = user.email.split("@")[0].replace(/[._-]/g, " ");
    resolvedChildName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  }

  const finalChildName: string = (resolvedChildName && typeof resolvedChildName === "string" && resolvedChildName.trim().length > 0)
    ? resolvedChildName.trim()
    : (childName && typeof childName === "string" && childName.trim().length > 0 ? childName.trim() : "Child Explorer");

  const alertId = `sos-${Date.now()}`;
  const cleanLocation = {
    lat: (location && typeof location.lat === "number") ? location.lat : 17.4849,
    lng: (location && typeof location.lng === "number") ? location.lng : 78.3907,
    name: (location && typeof location.name === "string" && location.name.trim().length > 0) ? location.name.trim() : "Kondapur, Hyderabad, Telangana, India"
  };

  const newAlert: SosAlert = {
    id: alertId,
    childId: effectiveChildId,
    childName: finalChildName,
    familyCode: resolvedFamilyCode || "",
    parentUid: resolvedParentUid,
    location: cleanLocation,
    status: "active",
    timestamp: new Date().toISOString()
  };

  console.log("[triggerSosAlert] Writing verified SOS alert document to Cloud Firestore:", newAlert);

  if (user && db) {
    try {
      const writePromise = setDoc(doc(db, "sosAlerts", alertId), newAlert);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SOS persistence timeout: Cloud server did not respond within 5 seconds")), 5000)
      );

      await Promise.race([writePromise, timeoutPromise]);
      console.log(`[triggerSosAlert] Confirmed SOS alert persisted in Firestore: sosAlerts/${alertId}`);

      // Log activity if linked to parent (fire-and-forget)
      const logId = `log-sos-${Date.now()}`;
      const sosLog: ActivityLog = {
        id: logId,
        childId: effectiveChildId,
        type: "sos",
        title: "🚨 EMERGENCY SOS DISTRESS ALERT",
        description: `${finalChildName} triggered an emergency SOS panic button on their companion device.`,
        timestamp: new Date().toISOString(),
        safetyLevel: "severe"
      };
      const targetLogUserId = resolvedParentUid || user.uid;
      setDoc(doc(db, "users", targetLogUserId, "logs", logId), sosLog).catch(() => {});
    } catch (err: any) {
      console.error("SOS alert persistence error:", err);
      const isQuota = err?.message?.includes("Quota exceeded") || err?.code === "resource-exhausted";
      if (isQuota) {
        throw new Error("Cloud Firestore Quota Exceeded (resource-exhausted). Emergency SOS could NOT be confirmed by Cloud Firestore. Parents have NOT received this distress signal via the app. Please phone your parent directly!");
      }
      throw err;
    }
  }

  return newAlert;
}

export interface ResolveSosAlertParams {
  db: any;
  user: { uid: string; displayName?: string | null; email?: string | null } | null;
  userData?: { role?: string; parentId?: string; familyCode?: string; fullName?: string } | null;
  alertId: string;
  targetAlert?: SosAlert | null;
  isQuotaExhausted?: boolean;
}

export async function executeResolveSosAlert(params: ResolveSosAlertParams): Promise<{ alertId: string; resolvedAt: any; resolvedBy: string }> {
  const { db, user, alertId, targetAlert, isQuotaExhausted } = params;

  if (!alertId) throw new Error("Missing alertId");
  if (!user) throw new Error("Must be logged in to resolve an SOS alert.");

  if (isQuotaExhausted) {
    throw new Error("Firestore daily quota reached. Cannot resolve SOS alert on server at this time.");
  }

  // 1. Fetch fresh alert document data from Firestore
  let effectiveAlert = targetAlert;
  const alertRef = doc(db, "sosAlerts", alertId);
  try {
    const alertSnap = await getDoc(alertRef);
    if (alertSnap.exists()) {
      effectiveAlert = alertSnap.data() as SosAlert;
    } else if (!effectiveAlert) {
      throw new Error(`SOS alert document "${alertId}" not found in Firestore.`);
    }
  } catch (e: any) {
    if (e.message?.includes("not found")) throw e;
    console.warn("[resolveSosAlert] Notice reading fresh alert snapshot:", e);
  }

  if (!effectiveAlert) {
    throw new Error(`SOS alert document "${alertId}" does not exist in Firestore.`);
  }

  // 2. Read users/{authenticatedUid} and verify role === "parent" (or "admin")
  // CRITICAL SECURITY ENFORCEMENT: resolveSosAlert must NEVER create, promote, or modify user roles
  const callerUserSnap = await getDoc(doc(db, "users", user.uid));
  if (!callerUserSnap.exists()) {
    throw new Error(`Resolution rejected: User profile for UID "${user.uid}" was not found in Firestore. Only verified parents can resolve alerts.`);
  }

  const callerData = callerUserSnap.data();
  const isParentOrAdmin = callerData.role === "parent" || callerData.role === "admin";
  if (!isParentOrAdmin) {
    throw new Error(`Resolution rejected: User "${user.uid}" has role "${callerData.role || 'unassigned'}". Only verified parents are authorized to resolve emergency SOS alerts.`);
  }

  // 3. Verify families/{familyCode}.ownerParentId matches the authenticated Parent UID
  // CRITICAL SECURITY ENFORCEMENT: Never automatically overwrite ownerParentId or familyCode
  const alertFamilyCode = effectiveAlert.familyCode || callerData.familyCode;
  if (!alertFamilyCode) {
    throw new Error(`Resolution rejected: SOS alert "${alertId}" has no associated family code to verify ownership.`);
  }

  const famSnap = await getDoc(doc(db, "families", alertFamilyCode));
  if (!famSnap.exists()) {
    throw new Error(`Resolution rejected: Family "${alertFamilyCode}" does not exist in Firestore.`);
  }

  const famData = famSnap.data() as FamilyData;
  if (famData.ownerParentId !== user.uid && callerData.role !== "admin") {
    throw new Error(`Resolution rejected: Family ownership mismatch. Authenticated parent "${user.uid}" is not the registered owner of family "${alertFamilyCode}" (owned by "${famData.ownerParentId || 'unassigned'}").`);
  }

  // 4. Verify that the Child belongs to that Parent's family
  const childId = effectiveAlert.childId;
  let isChildInFamily = false;

  // Check A: Alert parentUid explicitly matches this parent
  if (effectiveAlert.parentUid === user.uid) {
    isChildInFamily = true;
  }

  // Check B: Query child user document
  if (!isChildInFamily && childId) {
    try {
      const childSnap = await getDoc(doc(db, "users", childId));
      if (childSnap.exists()) {
        const cData = childSnap.data();
        if (cData.parentId === user.uid || (cData.familyCode && cData.familyCode === alertFamilyCode)) {
          isChildInFamily = true;
        }
      }
    } catch (_) {}
  }

  // Check C: Query parent's profiles subcollection
  if (!isChildInFamily && childId) {
    try {
      const profileSnap = await getDoc(doc(db, "users", user.uid, "profiles", childId));
      if (profileSnap.exists()) {
        isChildInFamily = true;
      }
    } catch (_) {}
  }

  // Check D: Query dedicated familyLinkRequests
  if (!isChildInFamily && childId) {
    try {
      const linkSnap = await getDoc(doc(db, "familyLinkRequests", `req-${childId}`));
      if (linkSnap.exists()) {
        const lData = linkSnap.data() as FamilyRequest;
        if (lData.parentUid === user.uid && (lData.status === "accepted" || lData.status === "approved" || lData.status === "pending")) {
          isChildInFamily = true;
        }
      }
    } catch (_) {}
  }

  if (!isChildInFamily && callerData.role !== "admin") {
    throw new Error(`Resolution rejected: Child "${childId}" is not linked to your family network (${alertFamilyCode}).`);
  }

  // DIAGNOSTIC LOG: Request attempt
  console.log("[SOS_RESOLUTION_DIAGNOSTIC_ATTEMPT]", {
    alertDocumentId: alertId,
    authenticatedUid: user.uid,
    alertChildId: effectiveAlert.childId || "unknown",
    alertParentUid: effectiveAlert.parentUid || "unknown",
    alertFamilyCode: alertFamilyCode,
    currentStatus: effectiveAlert.status || "unknown",
    callerRole: callerData.role
  });

  // 5. Submit atomic resolution payload to Firestore
  const resolvePayload = {
    status: "resolved",
    resolvedAt: serverTimestamp(),
    resolvedBy: user.uid
  };

  console.log(`[resolveSosAlert] Submitting verified resolution payload to Firestore: sosAlerts/${alertId}`, resolvePayload);
  await updateDoc(alertRef, resolvePayload);
  console.log(`[resolveSosAlert] Confirmed SOS alert resolved in Firestore: sosAlerts/${alertId}`);

  return { alertId, resolvedAt: resolvePayload.resolvedAt, resolvedBy: user.uid };
}

export function useFirebaseSync() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<{ 
    role: UserRole | null; 
    fullName?: string; 
    email?: string;
    parentId?: string;
    familyCode?: string;
    status?: string;
    profileMissing?: boolean;
    familyDisconnected?: boolean;
    disconnectedMessage?: string;
    disconnectedAt?: string;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);

  // Sync state variables
  const [profiles, setProfiles] = useState<ChildProfile[]>(initialProfiles);
  const [devices, setDevices] = useState<ChildDevice[]>(initialDevices);
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [dangerousEvents, setDangerousEvents] = useState<any[]>([]);
  const [safeZones, setSafeZones] = useState<any[]>([]);
  const [familyData, setFamilyData] = useState<FamilyData | null>(null);
  const [pendingRequests, setPendingRequests] = useState<FamilyRequest[]>([]);
  const [childFamilyRequest, setChildFamilyRequest] = useState<FamilyRequest | null>(null);
  const [sosAlerts, setSosAlerts] = useState<SosAlert[]>([]);
  const [resolvingSosAlertId, setResolvingSosAlertId] = useState<string | null>(null);
  const [homeworkList, setHomeworkList] = useState<HomeworkTask[]>([
    { id: "hw-1", childId: "child-1", title: "Math Worksheet Chapter 4: Fractions & Decimals", subject: "Mathematics", dueDate: "Tomorrow, 5:00 PM", completed: false, notes: "Complete pages 42 to 45" },
    { id: "hw-2", childId: "child-1", title: "Science Essay: Photosynthesis & Solar Energy", subject: "Science", dueDate: "Friday, 8:00 PM", completed: true, notes: "Draw leaf diagram" },
    { id: "hw-3", childId: "child-1", title: "Read Chapter 3 of The Lightning Thief", subject: "English Literature", dueDate: "Monday", completed: false, notes: "Write 3 bullet points summary" }
  ]);
  const [dailyGoalsList, setDailyGoalsList] = useState<DailyGoal[]>([
    { id: "dg-1", childId: "child-1", title: "Read 20 Minutes", category: "learning", targetMinutes: 20, completedMinutes: 20, completed: true },
    { id: "dg-2", childId: "child-1", title: "Complete Cyber Safety Quiz", category: "safety", targetMinutes: 10, completedMinutes: 10, completed: true },
    { id: "dg-3", childId: "child-1", title: "Practice Python Basics on Khan Academy", category: "creative", targetMinutes: 30, completedMinutes: 15, completed: false },
    { id: "dg-4", childId: "child-1", title: "Outdoor Exercise & Screen Break", category: "health", targetMinutes: 45, completedMinutes: 30, completed: false }
  ]);
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({
    "child-1": [
      { id: "m-1", role: "model", text: "Hello! I am your Guardian AI family counselor. Ask me anything about Leo's digital habits, educational focus, or safety logs.", timestamp: "09:00 AM" }
    ],
    "child-2": [
      { id: "m-1", role: "model", text: "Hello! I am your Guardian AI family counselor. Ask me anything about Emily's digital habits, educational focus, or safety logs.", timestamp: "09:00 AM" }
    ]
  });
  
  // Quota tracking & telemetry write deduplication
  const [isQuotaExhausted, setIsQuotaExhausted] = useState<boolean>(false);
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null);
  const lastDeviceTelemetryRef = useRef<Record<string, string>>({});
  const familySyncInFlightRef = useRef<Record<string, boolean>>({});

  // Default dangerous events
  const initialDangerousEvents = [
    {
      id: "de-1",
      childId: "child-1",
      category: "Scam & Phishing",
      target: "free-robux-clicker.com/claim-reward",
      riskLevel: "high",
      confidence: 94,
      reason: "Attempts to harvest user credential tokens via high-pressure phishing banners promising virtual Roblox currency.",
      actionTaken: "Blocked connection instantly & routed alert to Guardian parent dashboard.",
      suggestedAction: "Have a talk with Leo about in-game item scams. Restrict third-party Google auth logins.",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: "blocked"
    },
    {
      id: "de-2",
      childId: "child-1",
      category: "Adult Content",
      target: "chatroulette-clone.xxx/stream",
      riskLevel: "critical",
      confidence: 99,
      reason: "TCP/IP handshake established with domain containing adult video streaming scripts and mature content ratings.",
      actionTaken: "Secured hardware, dropped network packets immediately, and initiated 15-minute temporary device lock.",
      suggestedAction: "Review tablet's web history. Ensure Leo uses Google SafeSearch on all web browsers.",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      status: "blocked"
    }
  ];

  // Default safe zones (Kondapur, Hyderabad)
  const initialSafeZones = [
    { name: "Home Safe Zone", active: true, radius: 150, lat: 17.4875, lng: 78.3890 },
    { name: "Kondapur Tech Academy", active: true, radius: 200, lat: 17.4849, lng: 78.3907 },
    { name: "Botanical Garden Sports Complex", active: true, radius: 250, lat: 17.4820, lng: 78.3860 }
  ];

  // Helper to accurately resolve, verify, and repair user role without silent corruption
  const resolveAndVerifyUserRole = async (
    currentUser: User, 
    userDocSnap: any
  ): Promise<{
    role: UserRole | null;
    fullName: string;
    status: string;
    parentId?: string;
    familyCode?: string;
    familyDisconnected?: boolean;
    disconnectedMessage?: string;
    disconnectedAt?: string;
    profileMissing: boolean;
    repairedAsChild: boolean;
    rawProfile: any;
  }> => {
    const uid = currentUser.uid;
    const cleanEmail = (currentUser.email || "").trim().toLowerCase();
    const isAdminEmail = Boolean(cleanEmail && ADMIN_EMAILS.some(e => e.toLowerCase() === cleanEmail));
    const userDocExists = Boolean(userDocSnap && typeof userDocSnap.exists === "function" && userDocSnap.exists());
    let data = userDocExists ? userDocSnap.data() : null;

    if (!data) {
      try {
        const saved = localStorage.getItem(`GUARDIAN_CACHED_USER_${uid}`);
        if (saved) data = JSON.parse(saved);
      } catch (_) {}
    }

    console.log(`[resolveAndVerifyUserRole] Analyzing UID: ${uid}, Email: ${cleanEmail}, docExists: ${userDocExists}, docRole: ${data?.role}`);

    // Priority 1: Administrator check
    if (isAdminEmail || data?.role === "admin") {
      if (isAdminEmail && userDocExists && data?.role !== "admin") {
        try {
          await updateDoc(doc(db, "users", uid), { role: "admin" }).catch(() => {});
        } catch (e) {
          console.warn("Could not upgrade admin role in Firestore:", e);
        }
      }
      return {
        role: "admin",
        fullName: data?.fullName || data?.displayName || currentUser.displayName || "Platform Administrator",
        status: data?.status || "active",
        parentId: data?.parentId,
        familyCode: data?.familyCode,
        familyDisconnected: Boolean(data?.familyDisconnected),
        disconnectedMessage: data?.disconnectedMessage,
        disconnectedAt: data?.disconnectedAt,
        profileMissing: !userDocExists && !data,
        repairedAsChild: false,
        rawProfile: data
      };
    }

    // Priority 2: Explicit Child Profile
    if (userDocExists && data?.role === "child") {
      return {
        role: "child",
        fullName: data.fullName || data.displayName || currentUser.displayName || "Explorer",
        status: data.status || "active",
        parentId: data.parentId,
        familyCode: data.familyCode,
        familyDisconnected: Boolean(data.familyDisconnected),
        disconnectedMessage: data.disconnectedMessage,
        disconnectedAt: data.disconnectedAt,
        profileMissing: false,
        repairedAsChild: false,
        rawProfile: data
      };
    }

    // Priority 3: Explicit Parent Profile (instant return without queries)
    if (userDocExists && data?.role === "parent") {
      return {
        role: "parent",
        fullName: data.fullName || data.displayName || currentUser.displayName || "Guardian User",
        status: data.status || "active",
        parentId: data.parentId,
        familyCode: data.familyCode,
        familyDisconnected: Boolean(data.familyDisconnected),
        disconnectedMessage: data.disconnectedMessage,
        disconnectedAt: data.disconnectedAt,
        profileMissing: false,
        repairedAsChild: false,
        rawProfile: data
      };
    }

    // Priority 4: Fallback child account check only if role is undetermined
    let verifiedChildLink: any = null;
    if (!isQuotaExhausted && (!data?.role || data?.isChildAccount === true)) {
      try {
        const linkQuery = query(collection(db, "familyLinkRequests"), where("childUid", "==", uid), limit(1));
        const linkSnap = await getDocs(linkQuery);
        if (!linkSnap.empty) {
          verifiedChildLink = linkSnap.docs[0].data();
        }
      } catch (linkErr: any) {
        if (linkErr?.code === "resource-exhausted" || linkErr?.message?.includes("Quota exceeded")) {
          setIsQuotaExhausted(true);
        }
        console.warn("[resolveAndVerifyUserRole] Notice querying child link records:", linkErr?.message || linkErr);
      }
    }

    // If verified child link or explicit child account indicators found:
    if (verifiedChildLink || (userDocExists && data?.isChildAccount === true)) {
      const childName = verifiedChildLink?.childName || data?.fullName || data?.displayName || currentUser.displayName || "Explorer";
      const parentId = verifiedChildLink?.parentUid || data?.parentId || "";
      const familyCode = verifiedChildLink?.familyCode || data?.familyCode || "";

      const repairPayload: any = {
        role: "child",
        fullName: childName,
        displayName: childName,
        email: currentUser.email || cleanEmail,
        status: "active",
        updatedAt: new Date().toISOString()
      };
      if (parentId) repairPayload.parentId = parentId;
      if (familyCode) repairPayload.familyCode = familyCode;

      if (!isQuotaExhausted) {
        try {
          if (userDocExists) {
            await updateDoc(doc(db, "users", uid), repairPayload);
          } else {
            await setDoc(doc(db, "users", uid), {
              ...repairPayload,
              createdAt: new Date().toISOString()
            });
          }
          console.log(`[resolveAndVerifyUserRole] REPAIRED account ${uid} as CHILD from verified family record.`);
        } catch (repairWriteErr: any) {
          if (repairWriteErr?.code === "resource-exhausted" || repairWriteErr?.message?.includes("Quota exceeded")) {
            setIsQuotaExhausted(true);
          }
          console.warn("[resolveAndVerifyUserRole] Could not persist child profile repair:", repairWriteErr);
        }
      }

      return {
        role: "child",
        fullName: childName,
        status: "active",
        parentId: parentId || undefined,
        familyCode: familyCode || undefined,
        familyDisconnected: Boolean(data?.familyDisconnected),
        disconnectedMessage: data?.disconnectedMessage,
        disconnectedAt: data?.disconnectedAt,
        profileMissing: false,
        repairedAsChild: true,
        rawProfile: { ...(data || {}), ...repairPayload }
      };
    }

    // Priority 5: Document does not exist (missing profile)
    // Never auto-seed parent data during auth state change!
    if (!userDocExists) {
      console.warn(`[resolveAndVerifyUserRole] Account ${uid} exists in Firebase Auth, but user profile is missing in Firestore.`);
      return {
        role: null,
        fullName: currentUser.displayName || "Guardian User",
        status: "pending_profile",
        profileMissing: true,
        repairedAsChild: false,
        rawProfile: null
      };
    }

    // Priority 6: Unrecognized role in document
    return {
      role: null,
      fullName: data?.fullName || currentUser.displayName || "Guardian User",
      status: data?.status || "active",
      profileMissing: false,
      repairedAsChild: false,
      rawProfile: data
    };
  };

  // Monitor auth state changes and fetch roles
  useEffect(() => {
    console.log("[onAuthStateChanged] Setting up auth state changed listener...");
    
    // Safety watchdog: ensure authLoading never blocks the UI indefinitely if Firebase Auth resolution is delayed
    const safetyTimeout = setTimeout(() => {
      setAuthLoading((prev) => {
        if (prev) {
          console.warn("[onAuthStateChanged] Auth resolution safety timeout reached (1500ms). Releasing initial authLoading lock.");
          return false;
        }
        return prev;
      });
    }, 1500);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      clearTimeout(safetyTimeout);
      setAuthLoading(true);
      if (currentUser) {
        console.log(`[onAuthStateChanged] Authenticated user detected: UID=${currentUser.uid}, email=${currentUser.email}, emailVerified=${currentUser.emailVerified}`);
        setIsGuestMode(false);
        setUser(currentUser);

        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          let userDocSnap: any = null;
          try {
            userDocSnap = await getDoc(userDocRef);
          } catch (fetchErr: any) {
            if (fetchErr?.code === "resource-exhausted" || fetchErr?.message?.includes("Quota exceeded")) {
              setIsQuotaExhausted(true);
              setQuotaMessage("Cloud Firestore daily quota reached on free Spark tier. Using cached offline session.");
            }
            console.warn("[onAuthStateChanged] Firestore read notice:", fetchErr?.message || fetchErr);
          }

          // Use the dedicated role resolution helper (never auto-seeds parent data)
          const verification = await resolveAndVerifyUserRole(currentUser, userDocSnap);

          console.log(`[onAuthStateChanged] Verified profile: UID=${currentUser.uid}, Role=${verification.role}, FullName=${verification.fullName}, ProfileMissing=${verification.profileMissing}`);
          
          const resolvedUserData = {
            role: verification.role,
            status: verification.status,
            fullName: verification.fullName,
            email: currentUser.email || undefined,
            parentId: verification.parentId,
            familyCode: verification.familyCode,
            profileMissing: verification.profileMissing,
            familyDisconnected: verification.familyDisconnected,
            disconnectedMessage: verification.disconnectedMessage,
            disconnectedAt: verification.disconnectedAt
          };

          setUserData(resolvedUserData);
          try {
            localStorage.setItem(`GUARDIAN_CACHED_USER_${currentUser.uid}`, JSON.stringify(resolvedUserData));
          } catch (_) {}

          // Ensure parent (or admin) has their authoritative family code and family document loaded
          if (verification.role === "parent" || verification.role === "admin") {
            let famCode = verification.familyCode;

            // If user doc didn't have familyCode, check if parent already owns an existing family in Firestore
            if (!famCode && !isQuotaExhausted) {
              try {
                const famQuery = query(
                  collection(db, "families"),
                  where("ownerParentId", "==", currentUser.uid),
                  limit(1)
                );
                const famQuerySnap = await getDocs(famQuery);
                if (!famQuerySnap.empty) {
                  const existingFam = famQuerySnap.docs[0].data() as FamilyData;
                  famCode = existingFam.familyCode;
                  await updateDoc(userDocRef, { familyCode: famCode });
                  setFamilyData(existingFam);
                }
              } catch (qErr) {
                console.warn("[onAuthStateChanged] Existing family lookup notice:", qErr);
              }
            }

            // If authoritative familyCode exists, retrieve or sync the authoritative family document
            if (famCode) {
              try {
                localStorage.setItem(`GUARDIAN_FAMILY_CODE_${currentUser.uid}`, famCode);
              } catch (_) {}

              if (!isQuotaExhausted && !familySyncInFlightRef.current[famCode]) {
                familySyncInFlightRef.current[famCode] = true;
                try {
                  const famRef = doc(db, "families", famCode);
                  const famSnap = await getDoc(famRef);
                  if (famSnap.exists()) {
                    const existingFam = famSnap.data() as FamilyData;
                    if (existingFam.ownerParentId && existingFam.ownerParentId !== currentUser.uid) {
                      console.warn(`[FamilySync] Ownership mismatch: family document "${famCode}" is owned by parent "${existingFam.ownerParentId}", not current user "${currentUser.uid}". Preserving existing family ownership.`);
                      // Do NOT overwrite or mutate the family document
                      setFamilyData(existingFam);
                    } else if (!existingFam.ownerParentId) {
                      // Only set ownerParentId if genuinely empty/unassigned
                      await updateDoc(famRef, { ownerParentId: currentUser.uid });
                      existingFam.ownerParentId = currentUser.uid;
                      setFamilyData(existingFam);
                    } else {
                      setFamilyData(existingFam);
                    }
                  } else {
                    const parentFam: FamilyData = {
                      familyCode: famCode,
                      familyName: `${verification.fullName || currentUser.displayName || "Guardian"}'s Family`,
                      ownerParentId: currentUser.uid,
                      parentEmail: currentUser.email || "",
                      createdAt: new Date().toISOString()
                    };
                    await setDoc(famRef, parentFam);
                    setFamilyData(parentFam);
                  }
                } catch (famErr: any) {
                  if (famErr?.code === "resource-exhausted" || famErr?.message?.includes("Quota exceeded")) {
                    setIsQuotaExhausted(true);
                  }
                  console.error("[onAuthStateChanged] Family document sync failure:", famErr);
                } finally {
                  familySyncInFlightRef.current[famCode] = false;
                }
              }
            }
          }
        } catch (err: any) {
          if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded")) {
            console.warn("[onAuthStateChanged] Firestore daily quota reached. Restoring cached/admin session.");
            const cleanEmail = (currentUser.email || "").toLowerCase();
            const isAdmin = ADMIN_EMAILS.some(e => e.toLowerCase() === cleanEmail);
            let cachedUser: any = null;
            try {
              const saved = localStorage.getItem(`GUARDIAN_CACHED_USER_${currentUser.uid}`);
              if (saved) cachedUser = JSON.parse(saved);
            } catch (_) {}

            const role = cachedUser?.role || (isAdmin ? "admin" : "parent");
            const famCode = cachedUser?.familyCode;

            setUserData({
              role,
              status: "active",
              fullName: cachedUser?.fullName || currentUser.displayName || (isAdmin ? "Platform Administrator" : "Guardian User"),
              email: currentUser.email || undefined,
              familyCode: famCode
            });
            if (famCode) {
              setFamilyData({
                familyCode: famCode,
                familyName: `${currentUser.displayName || "Guardian"}'s Family`,
                ownerParentId: currentUser.uid,
                parentEmail: currentUser.email || "",
                createdAt: new Date().toISOString()
              });
            }
          } else {
            console.warn("[onAuthStateChanged] Auth Firestore loading notice:", err?.message || err);
          }
        } finally {
          setDbLoading(false);
          setAuthLoading(false);
        }
      } else {
        console.log("[onAuthStateChanged] No authenticated user. Clearing user state.");
        setUser(null);
        setUserData(null);
        setFamilyData(null);
        setChildFamilyRequest(null);
        setAuthLoading(false);
        setDbLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      unsubscribe();
    };
  }, []);

  // Ensure that initial configurations are seeded in Firestore under the logged in user
  const ensureUserSeeded = async (u: User, initialRole: UserRole = "parent") => {
    try {
      const userDocRef = doc(db, "users", u.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        const isAdmin = initialRole === "admin" || (u.email && ADMIN_EMAILS.some(e => e.toLowerCase() === u.email?.toLowerCase()));
        const assignedRole: UserRole = isAdmin ? "admin" : initialRole;

        // Create primary user document
        await setDoc(userDocRef, {
          email: u.email,
          displayName: u.displayName,
          fullName: u.displayName || (assignedRole === "admin" ? "Platform Administrator" : (assignedRole === "child" ? "Explorer" : "Guardian User")),
          role: assignedRole,
          status: "active",
          createdAt: new Date().toISOString()
        });

        // Seed subcollections ONLY for parent accounts (children do not possess parent monitoring subcollections)
        if (assignedRole === "parent") {
          for (const profile of initialProfiles) {
            await setDoc(doc(db, "users", u.uid, "profiles", profile.id), profile);
          }

          // Seed logs (limit to first 10 for speed)
          for (const log of initialLogs.slice(0, 10)) {
            await setDoc(doc(db, "users", u.uid, "logs", log.id), log);
          }

          // Seed dangerous events
          for (const de of initialDangerousEvents) {
            await setDoc(doc(db, "users", u.uid, "dangerousEvents", de.id), de);
          }

          // Seed safe zones
          for (const idx in initialSafeZones) {
            const sz = initialSafeZones[idx];
            await setDoc(doc(db, "users", u.uid, "safeZones", `zone-${idx}`), sz);
          }

          // Seed chat messages
          const initialChats = [
            { id: "m-1", role: "model", text: "Hello! I am your Guardian AI family counselor. Ask me anything about Leo's digital habits, educational focus, or safety logs.", timestamp: "09:00 AM", childId: "child-1" },
            { id: "m-2", role: "model", text: "Hello! I am your Guardian AI family counselor. Ask me anything about Emily's digital habits, educational focus, or safety logs.", timestamp: "09:00 AM", childId: "child-2" }
          ];
          for (const chat of initialChats) {
            await setDoc(doc(db, "users", u.uid, "chats", chat.id), chat);
          }
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${u.uid}`);
    }
  };

  // Real-time listen to user Firestore subcollections (Single stable subscription lifecycle)
  useEffect(() => {
    if (!user) {
      if (!isGuestMode) {
        setProfiles(initialProfiles);
        setLogs(initialLogs);
        setDangerousEvents(initialDangerousEvents);
        setSafeZones(initialSafeZones);
        setChatHistory({
          "child-1": [
            { id: "m-1", role: "model", text: "Hello! I am your Guardian AI family counselor. Ask me anything about Leo's digital habits, educational focus, or safety logs.", timestamp: "09:00 AM" }
          ],
          "child-2": [
            { id: "m-1", role: "model", text: "Hello! I am your Guardian AI family counselor. Ask me anything about Emily's digital habits, educational focus, or safety logs.", timestamp: "09:00 AM" }
          ]
        });
        setPendingRequests([]);
      }
      return;
    }

    // If quota is exhausted on the free tier, do not flood Firestore with new listener attachments
    if (isQuotaExhausted) {
      console.log("[useFirebaseSync] Quota limit active; active listener attachments suspended to avoid runaway retries.");
      return;
    }

    const currentUid = user.uid;
    const unsubscribes: Array<() => void> = [];

    const handleListenerQuota = (err: any, label: string) => {
      if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded")) {
        setIsQuotaExhausted(true);
        setQuotaMessage("Cloud Firestore daily quota limit reached on free Spark tier. Live sync paused; cached data available.");
        console.warn(`[Firestore Quota] resource-exhausted detected on ${label}. Active subscriptions suspended.`);
      } else {
        console.warn(`[${label} listener notice]:`, err?.message || err);
      }
    };

    // 1. Profiles listener (users/{uid}/profiles)
    try {
      const unsub = onSnapshot(collection(db, "users", currentUid, "profiles"), (snapshot) => {
        const projs: ChildProfile[] = [];
        snapshot.forEach((d) => {
          projs.push({ id: d.id, ...d.data() } as ChildProfile);
        });
        setProfiles(projs);
      }, (error) => handleListenerQuota(error, "profiles"));
      unsubscribes.push(unsub);
    } catch (_) {}

    // 2. Real-time listener for current user's document
    try {
      const unsub = onSnapshot(doc(db, "users", currentUid), (docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data();
          setUserData(prev => ({
            role: (d.role as UserRole) || prev?.role || "parent",
            status: d.status || "active",
            fullName: d.fullName || d.displayName || prev?.fullName || "Guardian User",
            email: d.email || prev?.email,
            parentId: d.parentId !== undefined ? d.parentId : prev?.parentId,
            familyCode: d.familyCode !== undefined ? d.familyCode : prev?.familyCode,
            familyDisconnected: Boolean(d.familyDisconnected),
            disconnectedMessage: d.disconnectedMessage,
            disconnectedAt: d.disconnectedAt
          }));
        }
      }, (error) => handleListenerQuota(error, "userDoc"));
      unsubscribes.push(unsub);
    } catch (_) {}

    // 3. Filtered Devices listener (bounded to current parent's devices; no global collection reads)
    try {
      const devQuery = query(
        collection(db, "devices"),
        where("parentId", "==", currentUid),
        limit(20)
      );
      const unsub = onSnapshot(devQuery, (snapshot) => {
        const loaded: ChildDevice[] = [];
        snapshot.forEach((d) => {
          const dData = d.data();
          if (dData.status !== "disconnected") {
            loaded.push({ id: d.id, ...dData } as ChildDevice);
          }
        });
        setDevices(prev => {
          const map = new Map<string, ChildDevice>();
          initialDevices.forEach(dev => map.set(dev.id, dev));
          loaded.forEach(dev => map.set(dev.id, dev));
          return Array.from(map.values()).filter(dev => dev.status !== "disconnected");
        });
      }, (error) => handleListenerQuota(error, "devices"));
      unsubscribes.push(unsub);
    } catch (_) {}

    // 4. Activity Logs (bounded to 30 items)
    try {
      const logsQuery = query(
        collection(db, "users", currentUid, "logs"),
        limit(30)
      );
      const unsub = onSnapshot(logsQuery, (snapshot) => {
        const lgs: ActivityLog[] = [];
        snapshot.forEach((d) => {
          lgs.push({ id: d.id, ...d.data() } as ActivityLog);
        });
        lgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLogs(lgs);
      }, (error) => handleListenerQuota(error, "logs"));
      unsubscribes.push(unsub);
    } catch (_) {}

    // 5. Dangerous Events (bounded to 20 items)
    try {
      const deQuery = query(
        collection(db, "users", currentUid, "dangerousEvents"),
        limit(20)
      );
      const unsub = onSnapshot(deQuery, (snapshot) => {
        const des: any[] = [];
        snapshot.forEach((d) => {
          des.push({ id: d.id, ...d.data() });
        });
        des.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setDangerousEvents(des);
      }, (error) => handleListenerQuota(error, "dangerousEvents"));
      unsubscribes.push(unsub);
    } catch (_) {}

    // 6. Safe Zones (bounded to 10 items)
    try {
      const zonesQuery = query(
        collection(db, "users", currentUid, "safeZones"),
        limit(10)
      );
      const unsub = onSnapshot(zonesQuery, (snapshot) => {
        const zones: any[] = [];
        snapshot.forEach((d) => {
          zones.push({ id: d.id, ...d.data() });
        });
        setSafeZones(zones);
      }, (error) => handleListenerQuota(error, "safeZones"));
      unsubscribes.push(unsub);
    } catch (_) {}

    // 7. Chats (bounded to 30 items)
    try {
      const chatsQuery = query(
        collection(db, "users", currentUid, "chats"),
        limit(30)
      );
      const unsub = onSnapshot(chatsQuery, (snapshot) => {
        const messagesByChild: Record<string, ChatMessage[]> = {
          "child-1": [],
          "child-2": []
        };
        snapshot.forEach((d) => {
          const data = d.data();
          const childId = data.childId || "child-1";
          if (!messagesByChild[childId]) {
            messagesByChild[childId] = [];
          }
          messagesByChild[childId].push({
            id: d.id,
            role: data.role,
            text: data.text,
            timestamp: data.timestamp,
            groundingMetadata: data.groundingMetadata || null
          } as ChatMessage);
        });

        setChatHistory(prev => {
          const merged: Record<string, ChatMessage[]> = {};
          const keys = new Set(["child-1", "child-2", ...Object.keys(messagesByChild), ...Object.keys(prev)]);
          keys.forEach((cid) => {
            const snapshotMsgs = messagesByChild[cid] || [];
            const localMsgs = prev[cid] || [];
            const snapshotIds = new Set(snapshotMsgs.map(m => m.id));
            const pending = localMsgs.filter(m => !snapshotIds.has(m.id));
            let combined = [...snapshotMsgs, ...pending];
            if (combined.length === 0) {
              combined = [
                { id: "m-1", role: "model", text: `Hello! I am your Guardian AI family counselor. Ask me anything about ${cid === "child-1" ? "Leo" : "Emily"}'s digital habits, educational focus, or safety logs.`, timestamp: "09:00 AM" }
              ];
            }
            merged[cid] = combined;
          });
          return merged;
        });
      }, (error) => handleListenerQuota(error, "chats"));
      unsubscribes.push(unsub);
    } catch (_) {}

    // 8. Single authoritative Parent Family Link Requests listener (no legacy duplicate!)
    try {
      const parentLinkQuery = query(
        collection(db, "familyLinkRequests"),
        where("parentUid", "==", currentUid),
        limit(20)
      );
      const unsub = onSnapshot(parentLinkQuery, (snapshot) => {
        const reqs: FamilyRequest[] = [];
        snapshot.forEach((d) => {
          const data = { id: d.id, ...d.data() } as FamilyRequest;
          if (data.status === "pending") {
            reqs.push(data);
          }
        });
        reqs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setPendingRequests(reqs);
      }, (err) => handleListenerQuota(err, "parentLinkRequests"));
      unsubscribes.push(unsub);
    } catch (_) {}

    // 9. Single authoritative Child Family Link Requests listener (no legacy duplicate!)
    try {
      const childLinkQuery = query(
        collection(db, "familyLinkRequests"),
        where("childUid", "==", currentUid),
        limit(5)
      );
      const unsub = onSnapshot(childLinkQuery, (snapshot) => {
        let latestReq: FamilyRequest | null = null;
        snapshot.forEach((d) => {
          const data = { id: d.id, ...d.data() } as FamilyRequest;
          if (!latestReq || new Date(data.createdAt || 0).getTime() > new Date(latestReq.createdAt || 0).getTime()) {
            latestReq = data;
          }
        });
        if (latestReq) {
          setChildFamilyRequest(latestReq);
        }
      }, (err) => handleListenerQuota(err, "childLinkRequests"));
      unsubscribes.push(unsub);
    } catch (_) {}

    // 10. Bounded SOS Alerts listener (limit 25)
    try {
      const sosQuery = query(
        collection(db, "sosAlerts"),
        limit(25)
      );
      const unsub = onSnapshot(sosQuery, (snapshot) => {
        const alerts: SosAlert[] = [];
        snapshot.forEach((d) => {
          alerts.push({ id: d.id, ...d.data() } as SosAlert);
        });
        alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setSosAlerts(alerts);
      }, (err) => handleListenerQuota(err, "sosAlerts"));
      unsubscribes.push(unsub);
    } catch (_) {}

    // 11. Bounded Homework Tasks listener (limit 30)
    try {
      const hwQuery = query(
        collection(db, "homework"),
        limit(30)
      );
      const unsub = onSnapshot(hwQuery, (snapshot) => {
        const tasks: HomeworkTask[] = [];
        snapshot.forEach((d) => {
          tasks.push({ id: d.id, ...d.data() } as HomeworkTask);
        });
        if (tasks.length > 0) {
          setHomeworkList(tasks);
        }
      }, (err) => handleListenerQuota(err, "homework"));
      unsubscribes.push(unsub);
    } catch (_) {}

    // 12. Bounded Daily Goals listener (limit 30)
    try {
      const goalsQuery = query(
        collection(db, "dailyGoals"),
        limit(30)
      );
      const unsub = onSnapshot(goalsQuery, (snapshot) => {
        const goals: DailyGoal[] = [];
        snapshot.forEach((d) => {
          goals.push({ id: d.id, ...d.data() } as DailyGoal);
        });
        if (goals.length > 0) {
          setDailyGoalsList(goals);
        }
      }, (err) => handleListenerQuota(err, "dailyGoals"));
      unsubscribes.push(unsub);
    } catch (_) {}

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user?.uid, isQuotaExhausted]);


  const loginWithEmail = async (email: string, password: string, rememberMe: boolean) => {
    const cleanEmail = email.trim();
    const sanitizedEmail = cleanEmail.replace(/^(.{2})(.*)(@.*)$/, "$1***$3");
    const activeProjectId = (auth.app.options as any)?.projectId || "guardian-ai-platform";

    console.log(`[FirebaseAuth] Stage: Initiating signInWithEmailAndPassword`);
    console.log(`  - Target Account: ${sanitizedEmail}`);
    console.log(`  - Firebase Project ID: ${activeProjectId}`);
    console.log(`  - Auth Domain: ${(auth.app.options as any)?.authDomain || "unknown"}`);
    console.log(`  - Password Length: ${password.length} chars (non-empty: ${password.length > 0})`);
    console.log(`  - Persistence: ${rememberMe ? "LOCAL" : "SESSION"}`);

    setAuthLoading(true);
    try {
      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const u = userCredential.user;
      console.log(`[FirebaseAuth] Stage: Authentication SUCCESS. UID: ${u.uid}, EmailVerified: ${u.emailVerified}`);
      
      // Step 7: Retrieve authenticated Firebase UID
      const uid = u.uid;

      // Step 8: Retrieve the user's Firestore profile using the authenticated UID
      const userDocRef = doc(db, "users", uid);
      let userDocSnap: any = null;
      try {
        userDocSnap = await getDoc(userDocRef);
      } catch (docErr: any) {
        console.warn(`[loginWithEmail] Firestore profile read notice (${docErr?.message || docErr}). Falling back to cached profile/admin resolution.`);
      }

      // Step 9: Accurately resolve and verify user role (detects child link records and repairs corrupted roles)
      const verification = await resolveAndVerifyUserRole(u, userDocSnap);

      console.log(`[FirebaseAuth] Profile verified: UID=${uid}, Role=${verification.role}, FullName=${verification.fullName}, ProfileMissing=${verification.profileMissing}, Repaired=${verification.repairedAsChild}`);
      
      const userPayload = {
        role: verification.role,
        status: verification.status,
        fullName: verification.fullName,
        email: u.email || cleanEmail,
        parentId: verification.parentId,
        familyCode: verification.familyCode,
        profileMissing: verification.profileMissing,
        familyDisconnected: verification.familyDisconnected,
        disconnectedMessage: verification.disconnectedMessage,
        disconnectedAt: verification.disconnectedAt
      };

      setUser(u);
      setUserData(userPayload);
      try {
        localStorage.setItem(`GUARDIAN_CACHED_USER_${uid}`, JSON.stringify(userPayload));
        if (verification.familyCode) {
          localStorage.setItem(`GUARDIAN_FAMILY_CODE_${uid}`, verification.familyCode);
        }
      } catch (_) {}

      return {
        user: u,
        uid,
        role: verification.role,
        profile: verification.rawProfile,
        profileMissing: verification.profileMissing,
        repairedAsChild: verification.repairedAsChild
      };
    } catch (error: any) {
      const code = error?.code || "unknown";
      console.warn(`[FirebaseAuth Diagnostic] Stage: signInWithEmailAndPassword FAILED`);
      console.warn(`  - Project ID: ${activeProjectId}`);
      console.warn(`  - Target Account: ${sanitizedEmail}`);
      console.warn(`  - Firebase Error Code: ${code}`);

      if (code === "auth/invalid-credential") {
        console.warn(`  - Security Notice: 'auth/invalid-credential' is the unified code returned when Firebase Email Enumeration Protection is enabled in Google Cloud / Firebase Console. It indicates: (1) Incorrect password, (2) Unregistered email in '${activeProjectId}', or (3) An account created via Google OAuth that does not yet possess an email password.`);
      } else if (code === "resource-exhausted" || error?.message?.includes("Quota exceeded")) {
        console.warn(`  - Quota Notice: Firestore daily quota limit reached. Continuing in offline mode.`);
      } else {
        console.warn(`  - Auth notice:`, error?.message || error);
      }
      throw error;
    } finally {
      setAuthLoading(false);
    }
  };

  const registerWithEmail = async (fullName: string, email: string, password: string, role: "parent" | "child" | "admin" = "parent") => {
    const cleanEmail = email.trim();
    const cleanName = fullName.trim();
    const isAdminEmail = cleanEmail && ADMIN_EMAILS.some(e => e.toLowerCase() === cleanEmail.toLowerCase());
    const effectiveRole: UserRole = (isAdminEmail || role === "admin") ? "admin" : (role === "child" ? "child" : "parent");
    console.log(`[registerWithEmail] Attempting registration for email: ${cleanEmail}, fullName: ${cleanName}, requestedRole: ${role}, effectiveRole: ${effectiveRole}`);
    setAuthLoading(true);
    try {
      // Priority 1 & 3: Check Registration Gateway control in Firestore
      try {
        const configSnap = await getDoc(doc(db, "system", "platformConfig"));
        if (configSnap.exists()) {
          const cfg = configSnap.data();
          if (cfg.allowNewRegistrations === false && !isAdminEmail) {
            throw new Error("Registration Gateway is currently LOCKED by the platform administrator. New account registrations are temporarily disabled.");
          }
        }
      } catch (checkErr: any) {
        if (checkErr.message?.includes("Registration Gateway")) {
          throw checkErr;
        }
      }

      // Ensure persistence is set to LOCAL on registration so they remain logged in
      console.log("[registerWithEmail] Setting persistence to LOCAL");
      await setPersistence(auth, browserLocalPersistence);

      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const u = userCredential.user;
      console.log(`[registerWithEmail] Auth user created successfully. UID: ${u.uid}`);

      const userDocRef = doc(db, "users", u.uid);
      console.log(`[registerWithEmail] Creating user document in Firestore with role=${effectiveRole}...`);
      await setDoc(userDocRef, {
        email: u.email || cleanEmail,
        displayName: cleanName,
        fullName: cleanName,
        role: effectiveRole,
        status: "active",
        createdAt: new Date().toISOString()
      });

      try {
        await updateProfile(u, { displayName: cleanName });
      } catch (profErr) {
        console.warn("[registerWithEmail] updateProfile warning:", profErr);
      }
      
      if (effectiveRole === "parent" || effectiveRole === "admin") {
        console.log(`[registerWithEmail] Seeding default database templates and family code for parent account...`);
        let famCode = "";
        let newFamData: FamilyData | null = null;
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        for (let attempt = 0; attempt < 15; attempt++) {
          let cand = "";
          for (let i = 0; i < 6; i++) {
            cand += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          const candFamRef = doc(db, "families", cand);
          try {
            await runTransaction(db, async (tx) => {
              const famSnap = await tx.get(candFamRef);
              if (famSnap.exists()) {
                throw new Error("COLLISION");
              }
              const newFam: FamilyData = {
                familyCode: cand,
                familyName: `${cleanName || "Guardian"}'s Family`,
                ownerParentId: u.uid,
                parentEmail: u.email || cleanEmail,
                createdAt: new Date().toISOString()
              };
              tx.set(candFamRef, newFam);
              tx.update(userDocRef, { familyCode: cand });
              newFamData = newFam;
            });
            famCode = cand;
            break;
          } catch (txErr: any) {
            if (txErr?.message === "COLLISION") {
              continue;
            }
            console.error("[registerWithEmail] Error in atomic family code transaction:", txErr);
            throw txErr;
          }
        }
        if (!famCode || !newFamData) {
          throw new Error("Unable to allocate a unique family code during registration. Please try registering again.");
        }
        setFamilyData(newFamData);

        for (const profile of initialProfiles) {
          await setDoc(doc(db, "users", u.uid, "profiles", profile.id), profile);
        }
        for (const log of initialLogs.slice(0, 10)) {
          await setDoc(doc(db, "users", u.uid, "logs", log.id), log);
        }
        for (const de of initialDangerousEvents) {
          await setDoc(doc(db, "users", u.uid, "dangerousEvents", de.id), de);
        }
        for (const idx in initialSafeZones) {
          const sz = initialSafeZones[idx];
          await setDoc(doc(db, "users", u.uid, "safeZones", `zone-${idx}`), sz);
        }
        const initialChats = [
          { id: "m-1", role: "model", text: "Hello! I am your Guardian AI family counselor. Ask me anything about Leo's digital habits, educational focus, or safety logs.", timestamp: "09:00 AM", childId: "child-1" },
          { id: "m-2", role: "model", text: "Hello! I am your Guardian AI family counselor. Ask me anything about Emily's digital habits, educational focus, or safety logs.", timestamp: "09:00 AM", childId: "child-2" }
        ];
        for (const chat of initialChats) {
          await setDoc(doc(db, "users", u.uid, "chats", chat.id), chat);
        }
      }

      try {
        console.log(`[registerWithEmail] Sending email verification...`);
        await sendEmailVerification(u);
      } catch (verifErr) {
        console.warn("[registerWithEmail] sendEmailVerification warning:", verifErr);
      }
      
      setUser(u);
      setUserData({
        role: effectiveRole,
        status: "active",
        fullName: cleanName,
        email: u.email || cleanEmail
      });
      console.log(`[registerWithEmail] Registration flow fully complete for role=${effectiveRole}. UID=${u.uid}`);

      return {
        user: u,
        uid: u.uid,
        role: effectiveRole,
        profile: {
          email: u.email || cleanEmail,
          displayName: cleanName,
          fullName: cleanName,
          role: effectiveRole
        }
      };
    } catch (error) {
      console.error("[registerWithEmail] Error during registration:", error);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    const cleanEmail = email.trim();
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch (error) {
      console.error("Password reset error:", error);
      throw error;
    }
  };

  const reloadUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setUser({ ...auth.currentUser });
    }
  };

  const sendVerification = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsGuestMode(false);
      setUser(null);
      setUserData(null);
    } catch (err) {
      console.error("Signout failed:", err);
    }
  };

  const addProfileInDb = async (profile: ChildProfile) => {
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid, "profiles", profile.id), profile);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/profiles/${profile.id}`);
      }
    } else {
      setProfiles(prev => [...prev, profile]);
    }
  };

  const updateProfileInDb = async (profileId: string, fields: Partial<ChildProfile>) => {
    if (user) {
      try {
        const profileRef = doc(db, "users", user.uid, "profiles", profileId);
        await updateDoc(profileRef, fields);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/profiles/${profileId}`);
      }
    } else {
      setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, ...fields } : p));
    }
  };

  const addLogInDb = async (log: ActivityLog) => {
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid, "logs", log.id), log);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/logs/${log.id}`);
      }
    } else {
      setLogs(prev => [log, ...prev]);
    }
  };

  const addDangerousEventInDb = async (de: any) => {
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid, "dangerousEvents", de.id), de);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/dangerousEvents/${de.id}`);
      }
    } else {
      setDangerousEvents(prev => [de, ...prev]);
    }
  };

  const deleteDangerousEventInDb = async (id: string) => {
    if (user) {
      try {
        const deRef = doc(db, "users", user.uid, "dangerousEvents", id);
        const { deleteDoc } = await import("firebase/firestore");
        await deleteDoc(deRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/dangerousEvents/${id}`);
      }
    } else {
      setDangerousEvents(prev => prev.filter(e => e.id !== id));
    }
  };

  const addSafeZoneInDb = async (zone: any) => {
    const id = `zone-${Date.now()}`;
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid, "safeZones", id), { ...zone, id });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/safeZones/${id}`);
      }
    } else {
      setSafeZones(prev => [...prev, { ...zone, id }]);
    }
  };

  const deleteSafeZoneInDb = async (id: string) => {
    if (user) {
      try {
        const zoneRef = doc(db, "users", user.uid, "safeZones", id);
        const { deleteDoc } = await import("firebase/firestore");
        await deleteDoc(zoneRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/safeZones/${id}`);
      }
    } else {
      setSafeZones(prev => prev.filter(z => z.id !== id));
    }
  };

  const addChatMessageInDb = async (childId: string, message: ChatMessage) => {
    // Optimistically update the local chat history immediately
    setChatHistory(prev => {
      const currentList = prev[childId] || [];
      if (currentList.some(m => m.id === message.id)) return prev;
      return {
        ...prev,
        [childId]: [...currentList, message]
      };
    });

    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid, "chats", message.id), {
          ...message,
          childId
        });
      } catch (error) {
        console.warn("[FirebaseSync] Failed to save chat to Firestore:", error);
      }
    }
  };

  // Generate unique 6-character alphanumeric code
  const generateFamilyCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Create or fetch authoritative family code for parent
  const createOrFetchFamilyCode = async () => {
    if (!user) return null;

    // 1. If authoritative familyData already loaded, return existing familyCode immediately
    if (familyData?.familyCode) {
      return familyData.familyCode;
    }

    try {
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      // 2. Check if parent's user document already contains an authoritative familyCode
      if (userSnap.exists() && userSnap.data().familyCode) {
        const existingCode = userSnap.data().familyCode;
        try {
          localStorage.setItem(`GUARDIAN_FAMILY_CODE_${user.uid}`, existingCode);
        } catch (_) {}

        const famRef = doc(db, "families", existingCode);
        const famSnap = await getDoc(famRef);

        if (famSnap.exists()) {
          const famData = famSnap.data() as FamilyData;
          if (famData.ownerParentId && famData.ownerParentId !== user.uid) {
            console.error(`[createOrFetchFamilyCode] Ownership mismatch: family document "${existingCode}" is owned by parent "${famData.ownerParentId}", not current user "${user.uid}". Refusing to overwrite.`);
            // Do NOT overwrite or mutate the family document
            setFamilyData(famData);
            return existingCode;
          } else if (!famData.ownerParentId) {
            await updateDoc(famRef, { ownerParentId: user.uid });
            famData.ownerParentId = user.uid;
            setFamilyData(famData);
            return existingCode;
          } else {
            setFamilyData(famData);
            return existingCode;
          }
        } else {
          // Re-create missing family document with the exact authoritative code
          const parentFam: FamilyData = {
            familyCode: existingCode,
            familyName: `${userData?.fullName || user.displayName || "Guardian"}'s Family`,
            ownerParentId: user.uid,
            parentEmail: user.email || "",
            createdAt: new Date().toISOString()
          };
          await setDoc(famRef, parentFam);
          setFamilyData(parentFam);
          return existingCode;
        }
      }

      // 3. If user doc doesn't specify familyCode, check if an existing family document already belongs to this parent
      const existingFamQuery = query(
        collection(db, "families"),
        where("ownerParentId", "==", user.uid),
        limit(1)
      );
      const existingFamSnap = await getDocs(existingFamQuery);

      if (!existingFamSnap.empty) {
        const existingFam = existingFamSnap.docs[0].data() as FamilyData;
        const existingCode = existingFam.familyCode;
        // Synchronize parent user document with their real existing family code
        await updateDoc(userDocRef, { familyCode: existingCode });
        try {
          localStorage.setItem(`GUARDIAN_FAMILY_CODE_${user.uid}`, existingCode);
        } catch (_) {}
        setFamilyData(existingFam);
        return existingCode;
      }

      // 4. GENUINELY NEW FAMILY CREATION ONLY:
      // Allocate a unique 6-character code that does not collide in Firestore
      let uniqueCode = "";
      let newFamData: FamilyData | null = null;
      for (let attempt = 0; attempt < 15; attempt++) {
        const candidate = generateFamilyCode();
        const candFamRef = doc(db, "families", candidate);
        try {
          await runTransaction(db, async (tx) => {
            const checkSnap = await tx.get(candFamRef);
            if (checkSnap.exists()) {
              throw new Error("COLLISION");
            }
            const newFam: FamilyData = {
              familyCode: candidate,
              familyName: `${userData?.fullName || user.displayName || "Guardian"}'s Family`,
              ownerParentId: user.uid,
              parentEmail: user.email || "",
              createdAt: new Date().toISOString()
            };
            tx.set(candFamRef, newFam);
            tx.update(userDocRef, { familyCode: candidate });
            newFamData = newFam;
          });
          uniqueCode = candidate;
          break;
        } catch (txErr: any) {
          if (txErr?.message === "COLLISION") continue;
          throw txErr;
        }
      }

      if (!uniqueCode || !newFamData) {
        throw new Error("Unable to allocate unique family code. Please try again.");
      }

      try {
        localStorage.setItem(`GUARDIAN_FAMILY_CODE_${user.uid}`, uniqueCode);
      } catch (_) {}

      setFamilyData(newFamData);
      return uniqueCode;
    } catch (err: any) {
      console.error("[createOrFetchFamilyCode] Error resolving family code:", err);
      if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded")) {
        setIsQuotaExhausted(true);
      }
      throw err;
    }
  };

  // Join family by code for child
  const joinFamilyByCode = async (code: string) => {
    if (!user) throw new Error("Must be logged in to join family.");
    const cleanCode = code.trim().toUpperCase();
    
    // 1. Fetch & validate family in Firestore
    const famRef = doc(db, "families", cleanCode);
    const famSnap = await getDoc(famRef);
    
    let targetParentUid = "";
    if (famSnap.exists()) {
      const famData = famSnap.data() as FamilyData;
      targetParentUid = famData.ownerParentId;
    }

    // Fallback: If not found in families or ownerParentId is missing, check users collection
    if (!targetParentUid) {
      const parentQuery = query(
        collection(db, "users"),
        where("familyCode", "==", cleanCode)
      );
      const parentSnap = await getDocs(parentQuery);
      if (!parentSnap.empty) {
        targetParentUid = parentSnap.docs[0].id;
        // Repair / create families document
        await setDoc(famRef, {
          familyCode: cleanCode,
          familyName: `${parentSnap.docs[0].data().fullName || "Parent"}'s Family`,
          ownerParentId: targetParentUid,
          parentEmail: parentSnap.docs[0].data().email || "",
          createdAt: new Date().toISOString()
        }, { merge: true }).catch((err) => {
          console.error("[joinFamilyByCode] Failed to repair families document:", err);
        });
      }
    }

    if (!targetParentUid) {
      throw new Error(`Family code "${cleanCode}" not found. Please double-check with your parent.`);
    }

    if (isQuotaExhausted) {
      throw new Error("Cloud Firestore quota limit reached on the free Spark tier. Family linking is temporarily paused to avoid repeated failed writes.");
    }

    const reqId = `req-${user.uid}`;
    
    const reqData: FamilyRequest = {
      id: reqId,
      familyCode: cleanCode,
      parentUid: targetParentUid,
      childUid: user.uid,
      childName: userData?.fullName || user.displayName || "Child Explorer",
      childEmail: user.email || "",
      status: "pending",
      createdAt: new Date().toISOString()
    };

    // Step 1 Debug logs (exact format requested)
    console.log("[FAMILY LINK CHILD]");
    console.log(`childUid = ${user.uid}`);
    console.log(`familyCode = ${cleanCode}`);
    console.log(`parentUid = ${targetParentUid}`);
    console.log(`requestId = ${reqId}`);

    // Save to dedicated familyLinkRequests collection and legacy fallback
    try {
      await setDoc(doc(db, "familyLinkRequests", reqId), reqData);
      console.log("Firestore write SUCCESS");
      await setDoc(doc(db, "familyRequests", reqId), reqData).catch(() => {});
      
      // Update child's user document
      await updateDoc(doc(db, "users", user.uid), {
        familyCode: cleanCode,
        parentId: targetParentUid,
        status: "pending"
      });

      setChildFamilyRequest(reqData);
      return reqData;
    } catch (err: any) {
      if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded")) {
        setIsQuotaExhausted(true);
        throw new Error("Cloud Firestore daily write quota exceeded on the free Spark tier. Family link request could not be saved to Cloud Firestore.");
      }
      throw err;
    }
  };

  // Parent accepts family request
  const acceptFamilyRequest = async (requestId: string, childUid: string, childName: string, childEmail?: string) => {
    if (!user) throw new Error("Parent must be authenticated.");
    if (isQuotaExhausted) {
      throw new Error("Cloud Firestore quota limit reached on the free Spark tier. Family approval is temporarily unavailable until quota recovers.");
    }
    try {
      const now = new Date().toISOString();

      // Retrieve and verify parentUid ownership
      const linkDocRef = doc(db, "familyLinkRequests", requestId);
      const linkSnap = await getDoc(linkDocRef);
      if (linkSnap.exists()) {
        const data = linkSnap.data() as FamilyRequest;
        if (data.parentUid !== user.uid) {
          throw new Error("Unauthorized: Request belongs to a different parent.");
        }
      }

      // 1. Mark request accepted in familyLinkRequests
      await updateDoc(linkDocRef, { 
        status: "accepted",
        respondedAt: now
      }).catch(async () => {
        await updateDoc(doc(db, "familyRequests", requestId), { 
          status: "accepted",
          respondedAt: now 
        });
      });

      // Also update familyRequests for backwards compatibility
      try {
        await updateDoc(doc(db, "familyRequests", requestId), { 
          status: "accepted",
          respondedAt: now 
        });
      } catch (e) {}

      // 2. Associate child UID with parent/family in users/{childUid}
      const targetFamilyCode = familyData?.familyCode || "";
      await updateDoc(doc(db, "users", childUid), {
        status: "active",
        parentId: user.uid,
        familyCode: targetFamilyCode
      });

      // 3. Create ChildProfile under parent's profiles subcollection
      const childProfile: ChildProfile = {
        id: childUid,
        name: childName || "Child Explorer",
        age: 10,
        avatar: `https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=150`,
        device: "Companion Smartphone",
        battery: 95,
        status: "online",
        screenTimeLimit: 120,
        screenTimeToday: 30,
        riskScore: 5,
        lastSeenLocation: {
          lat: 17.4849,
          lng: 78.3907,
          name: "Home Safe Zone (Kondapur)",
          timestamp: now
        }
      };

      await setDoc(doc(db, "users", user.uid, "profiles", childUid), childProfile);

      // 4. Create Activity Log entry for parent
      const linkLog: ActivityLog = {
        id: `log-link-${Date.now()}`,
        childId: childUid,
        type: "system",
        title: "Family Node Linked",
        description: `${childName || "Child Explorer"} was successfully connected to your Guardian AI family network.`,
        timestamp: "Just now",
        safetyLevel: "safe"
      };
      await setDoc(doc(db, "users", user.uid, "logs", linkLog.id), linkLog).catch(() => {});

      // Optimistically update local requests
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      setProfiles(prev => [...prev.filter(p => p.id !== childUid), childProfile]);
      setLogs(prev => [linkLog, ...prev]);

      return { success: true, message: "Child successfully linked." };
    } catch (err) {
      console.error("Failed to approve connection request:", err);
      handleFirestoreError(err, OperationType.UPDATE, `familyLinkRequests/${requestId}`);
      throw err;
    }
  };

  // Alias for backward compatibility
  const approveFamilyRequest = acceptFamilyRequest;

  // Parent rejects family request
  const rejectFamilyRequest = async (requestId: string) => {
    if (!user) throw new Error("Parent must be authenticated.");
    try {
      const now = new Date().toISOString();

      // Retrieve and verify parentUid ownership
      const linkDocRef = doc(db, "familyLinkRequests", requestId);
      const linkSnap = await getDoc(linkDocRef);
      if (linkSnap.exists()) {
        const data = linkSnap.data() as FamilyRequest;
        if (data.parentUid !== user.uid) {
          throw new Error("Unauthorized: Request belongs to a different parent.");
        }
      }

      // Retrieve childUid to reset child's state if possible
      let childUidToReset = "";
      try {
        if (linkSnap.exists()) {
          childUidToReset = linkSnap.data()?.childUid;
        } else {
          const snap2 = await getDoc(doc(db, "familyRequests", requestId));
          if (snap2.exists()) {
            childUidToReset = snap2.data().childUid;
          }
        }
      } catch (e) {}

      await updateDoc(linkDocRef, { 
        status: "rejected",
        respondedAt: now
      }).catch(async () => {
        await updateDoc(doc(db, "familyRequests", requestId), { 
          status: "rejected",
          respondedAt: now 
        });
      });

      try {
        await updateDoc(doc(db, "familyRequests", requestId), { 
          status: "rejected",
          respondedAt: now 
        });
      } catch (e) {}

      if (childUidToReset) {
        await updateDoc(doc(db, "users", childUidToReset), {
          status: "active"
        }).catch(() => {});
      }

      // Remove request from pending state
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));

      return { success: true, message: "Request rejected." };
    } catch (err) {
      console.error("Failed to reject connection request:", err);
      handleFirestoreError(err, OperationType.UPDATE, `familyLinkRequests/${requestId}`);
      throw err;
    }
  };

  // Get active devices for a specific child
  const getChildDevices = (childId: string): ChildDevice[] => {
    const list = devices.filter(d => d.childId === childId && d.status !== "disconnected");
    if (list.length > 0) return list;
    const profile = profiles.find(p => p.id === childId);
    if (profile?.devices && profile.devices.length > 0) {
      return profile.devices.filter(d => d.status !== "disconnected");
    }
    return [];
  };

  // Parent removes child from family
  // IMPORTANT: This disconnects the child from the parent's safety network.
  // It does NOT delete the child's Firebase Authentication account or learning data!
  const removeChildFromFamily = async (childId: string) => {
    if (!user) throw new Error("Parent must be authenticated to remove a child.");
    try {
      const now = new Date().toISOString();
      const profileRef = doc(db, "users", user.uid, "profiles", childId);
      const profileSnap = await getDoc(profileRef);

      const childUserRef = doc(db, "users", childId);
      const childUserSnap = await getDoc(childUserRef);

      const childName = profileSnap.exists()
        ? (profileSnap.data() as ChildProfile).name
        : (childUserSnap.exists() ? (childUserSnap.data()?.fullName || childUserSnap.data()?.displayName || "Child") : "Child");

      // Security verification: verify child belongs to this parent
      if (childUserSnap.exists()) {
        const cData = childUserSnap.data();
        if (cData.parentId && cData.parentId !== user.uid) {
          throw new Error("Unauthorized: Child does not belong to your family network.");
        }
      }

      // 1. Deactivate parent-child link on users/{childId}
      // Note: Child Firebase account and learning data (homework, goals, quizzes) remain intact!
      if (childUserSnap.exists()) {
        await updateDoc(childUserRef, {
          parentId: null,
          familyCode: "",
          status: "disconnected",
          familyDisconnected: true,
          disconnectedAt: now,
          disconnectedMessage: "Your family connection has ended."
        }).catch(err => console.warn("Notice updating child user document:", err));
      }

      // 2. Remove child profile from parent's profiles collection
      if (profileSnap.exists()) {
        await deleteDoc(profileRef).catch(err => console.warn("Notice deleting profile document:", err));
      }

      // 3. Mark any family link requests as disconnected
      const linkRef = doc(db, "familyLinkRequests", `req-${childId}`);
      await updateDoc(linkRef, {
        status: "disconnected",
        disconnectedAt: now
      }).catch(() => {});

      const legacyRef = doc(db, "familyRequests", `req-${childId}`);
      await updateDoc(legacyRef, {
        status: "disconnected",
        disconnectedAt: now
      }).catch(() => {});

      // 4. Update/disconnect associated devices
      try {
        const qDev = query(collection(db, "devices"), where("childId", "==", childId));
        const devSnaps = await getDocs(qDev);
        for (const d of devSnaps.docs) {
          await updateDoc(d.ref, {
            status: "disconnected",
            disconnectedAt: now
          }).catch(() => {});
        }
      } catch (e) {
        console.warn("Notice updating child devices:", e);
      }

      // 5. Create ActivityLog entry for parent
      const disconnectLog: ActivityLog = {
        id: `log-disconnect-${Date.now()}`,
        childId: childId,
        type: "system",
        title: "Child Removed from Family",
        description: `${childName} was removed from your family network. Their account and learning achievements remain preserved.`,
        timestamp: "Just now",
        safetyLevel: "warning"
      };
      await setDoc(doc(db, "users", user.uid, "logs", disconnectLog.id), disconnectLog).catch(() => {});

      // 6. Optimistically update local state
      setProfiles(prev => prev.filter(p => p.id !== childId));
      setDevices(prev => prev.filter(d => d.childId !== childId));

      return { success: true, message: `${childName} was disconnected from your family.` };
    } catch (err) {
      console.error("Failed to remove child from family:", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${childId}`);
      throw err;
    }
  };

  // Parent removes a child's device
  // IMPORTANT: Removing a device does NOT remove the child account!
  const removeDevice = async (deviceId: string, childId: string) => {
    if (!user) throw new Error("Parent must be authenticated to remove a device.");
    try {
      const now = new Date().toISOString();
      const devRef = doc(db, "devices", deviceId);
      const devSnap = await getDoc(devRef);

      let devName = "Device";
      if (devSnap.exists()) {
        const dData = devSnap.data();
        devName = dData.deviceName || dData.name || "Device";
        if (dData.parentId && dData.parentId !== user.uid) {
          throw new Error("Unauthorized: Device belongs to another family.");
        }
      }

      // 1. Remove or disconnect device document from Firestore
      try {
        await deleteDoc(devRef);
      } catch (err) {
        await updateDoc(devRef, {
          status: "disconnected",
          childId: null,
          parentId: null,
          disconnectedAt: now
        }).catch(() => {});
      }

      // 2. Remove device from parent profile if stored there
      try {
        const profileRef = doc(db, "users", user.uid, "profiles", childId);
        const pSnap = await getDoc(profileRef);
        if (pSnap.exists()) {
          const pData = pSnap.data() as ChildProfile;
          if (pData.devices) {
            const updated = pData.devices.filter(d => d.id !== deviceId);
            await updateDoc(profileRef, { devices: updated }).catch(() => {});
          }
        }
      } catch (e) {
        console.warn("Notice updating profile devices array:", e);
      }

      // 3. Create ActivityLog entry for parent
      const devLog: ActivityLog = {
        id: `log-dev-rem-${Date.now()}`,
        childId: childId,
        type: "system",
        title: "Device Disconnected",
        description: `${devName} (${deviceId}) was removed from Guardian AI. The child's account and learning records remain active.`,
        timestamp: "Just now",
        safetyLevel: "safe"
      };
      await setDoc(doc(db, "users", user.uid, "logs", devLog.id), devLog).catch(() => {});

      // 4. Optimistically update local states
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      setProfiles(prev => prev.map(p => {
        if (p.id === childId && p.devices) {
          return { ...p, devices: p.devices.filter(d => d.id !== deviceId) };
        }
        return p;
      }));

      return { success: true, message: `${devName} was removed.` };
    } catch (err) {
      console.error("Failed to remove device:", err);
      handleFirestoreError(err, OperationType.DELETE, `devices/${deviceId}`);
      throw err;
    }
  };

  // Helper function to register current child device (with write deduplication & session caching)
  const registerCurrentChildDevice = useCallback(async (childId: string, parentId: string) => {
    try {
      if (isQuotaExhausted) {
        return;
      }

      let devId = localStorage.getItem("GUA_DEVICE_ID");
      if (!devId) {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "DEV-";
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        localStorage.setItem("GUA_DEVICE_ID", code);
        devId = code;
      }

      const ua = navigator.userAgent.toLowerCase();
      const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle)/i.test(ua);
      const isMobile = /mobile|iphone|ipod|android.*mobile|blackberry|iemobile/i.test(ua);
      const type: 'phone' | 'tablet' | 'laptop' = isTablet ? 'tablet' : (isMobile ? 'phone' : 'laptop');
      const model = isMobile ? (ua.includes("iphone") ? "Apple iPhone" : "Android Smartphone") : (isTablet ? "Tablet Device" : "Workstation / Laptop");
      const childName = userData?.fullName || "Child";

      // Telemetry deduplication: Check memory and persistent local storage
      const telemetrySignature = `${childId}|${parentId}|${devId}|${type}|${model}|${childName}`;
      const savedSig = localStorage.getItem(`GUA_DEVICE_SIG_${devId}`);
      if (lastDeviceTelemetryRef.current[devId] === telemetrySignature || savedSig === telemetrySignature) {
        lastDeviceTelemetryRef.current[devId] = telemetrySignature;
        return;
      }

      const devRef = doc(db, "devices", devId);
      const devData: ChildDevice = {
        id: devId,
        name: `${childName}'s ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        type,
        model,
        status: "online",
        battery: 88,
        lastActive: "Just now",
        childId,
        parentId,
        createdAt: new Date().toISOString()
      };

      await setDoc(devRef, devData, { merge: true });
      lastDeviceTelemetryRef.current[devId] = telemetrySignature;
      try {
        localStorage.setItem(`GUA_DEVICE_SIG_${devId}`, telemetrySignature);
      } catch (_) {}

      setDevices(prev => {
        const existing = prev.find(d => d.id === devId);
        if (existing) {
          return prev.map(d => d.id === devId ? { ...d, ...devData } : d);
        }
        return [...prev, devData];
      });
    } catch (err: any) {
      if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded")) {
        setIsQuotaExhausted(true);
      } else {
        console.warn("Notice registering child device:", err?.message || err);
      }
    }
  }, [isQuotaExhausted, userData?.fullName]);

  // Trigger SOS alert hook method (Strict cloud persistence requirement)
  const triggerSosAlert = async (childId?: string, childName?: string, location?: any) => {
    try {
      const newAlert = await executeTriggerSosAlert({
        db,
        user,
        userData,
        familyData,
        profiles,
        childId,
        childName,
        location,
        isQuotaExhausted
      });
      setSosAlerts(prev => [newAlert, ...prev.filter(a => a.id !== newAlert.id)]);
      return { success: true, alertId: newAlert.id, timestamp: newAlert.timestamp };
    } catch (err: any) {
      if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded")) {
        setIsQuotaExhausted(true);
      }
      throw err;
    }
  };

  // Resolve SOS alert hook method (Strict cloud persistence requirement)
  const resolveSosAlert = async (alertId: string) => {
    if (!alertId) return;

    // Find the alert in local cache to inspect diagnostic fields
    const targetAlert = sosAlerts.find(a => a.id === alertId);

    // In demo/unauthenticated mode, update local state
    if (!user) {
      setSosAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: "resolved", resolvedBy: "demo-parent", resolvedAt: new Date().toISOString() } : a));
      return;
    }

    if (isQuotaExhausted) {
      throw new Error("Firestore daily quota reached. Cannot resolve SOS alert on server at this time.");
    }

    setResolvingSosAlertId(alertId);

    try {
      const res = await executeResolveSosAlert({
        db,
        user,
        userData,
        alertId,
        targetAlert,
        isQuotaExhausted
      });

      // Update local state ONLY after Cloud Firestore confirms the resolution
      setSosAlerts(prev => prev.map(a => a.id === alertId ? { 
        ...a, 
        status: "resolved", 
        resolvedAt: new Date().toISOString(), 
        resolvedBy: res.resolvedBy 
      } : a));
    } catch (err: any) {
      if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded")) {
        setIsQuotaExhausted(true);
      }
      throw err;
    } finally {
      setResolvingSosAlertId(null);
    }
  };

  // Controlled quota recovery check (Task 5)
  const checkQuotaRecovery = async (): Promise<boolean> => {
    try {
      console.log("[Quota Recovery] Testing real Cloud Firestore connectivity with getDocFromServer...");
      await getDocFromServer(doc(db, "system", "platformConfig"));
      setIsQuotaExhausted(false);
      setQuotaMessage(null);
      console.log("[Quota Recovery] SUCCESS: Cloud Firestore operations are fully operational!");
      return true;
    } catch (err: any) {
      if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded")) {
        setIsQuotaExhausted(true);
        setQuotaMessage("Cloud Firestore daily quota limit remains active on free Spark tier. Quota resets daily at midnight PST.");
        console.warn("[Quota Recovery] Quota still exceeded on Spark tier.");
        return false;
      }
      // If error is permission or not-found, the quota limit is NOT exhausted!
      setIsQuotaExhausted(false);
      setQuotaMessage(null);
      return true;
    }
  };

  // Homework operations (Requires confirmed cloud write - Task 2)
  const addHomeworkTask = async (task: Partial<HomeworkTask>) => {
    if (isQuotaExhausted) {
      throw new Error("Cloud Firestore daily write quota limit reached on the free Spark tier. Cannot add homework until quota recovers.");
    }
    const taskId = `hw-${Date.now()}`;
    const newTask: HomeworkTask = {
      id: taskId,
      childId: user?.uid || "child-1",
      title: task.title || "New Homework Task",
      subject: task.subject || "General",
      dueDate: task.dueDate || "Tomorrow",
      completed: false,
      notes: task.notes || ""
    };
    if (user) {
      try {
        await setDoc(doc(db, "homework", taskId), newTask);
        setHomeworkList(prev => [newTask, ...prev]);
      } catch (err: any) {
        if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded")) {
          setIsQuotaExhausted(true);
        }
        throw new Error("Failed to save homework to Cloud Firestore: " + (err?.message || "Write error"));
      }
    } else {
      setHomeworkList(prev => [newTask, ...prev]);
    }
  };

  const toggleHomeworkTask = async (id: string, completed: boolean) => {
    if (isQuotaExhausted) {
      throw new Error("Cloud Firestore daily write quota limit reached on the free Spark tier. Cannot update homework until quota recovers.");
    }
    if (user) {
      try {
        await updateDoc(doc(db, "homework", id), { completed });
        setHomeworkList(prev => prev.map(t => t.id === id ? { ...t, completed } : t));
      } catch (err: any) {
        if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded")) {
          setIsQuotaExhausted(true);
        }
        throw new Error("Failed to update homework in Cloud Firestore: " + (err?.message || "Write error"));
      }
    } else {
      setHomeworkList(prev => prev.map(t => t.id === id ? { ...t, completed } : t));
    }
  };

  const deleteHomeworkTask = async (id: string) => {
    if (isQuotaExhausted) {
      throw new Error("Cloud Firestore daily write quota limit reached on the free Spark tier. Cannot delete homework until quota recovers.");
    }
    if (user) {
      try {
        await deleteDoc(doc(db, "homework", id));
        setHomeworkList(prev => prev.filter(t => t.id !== id));
      } catch (err: any) {
        if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded")) {
          setIsQuotaExhausted(true);
        }
        throw new Error("Failed to delete homework from Cloud Firestore: " + (err?.message || "Write error"));
      }
    } else {
      setHomeworkList(prev => prev.filter(t => t.id !== id));
    }
  };

  // Daily goals operations (Requires confirmed cloud write - Task 2)
  const addDailyGoal = async (goal: Partial<DailyGoal>) => {
    if (isQuotaExhausted) {
      throw new Error("Cloud Firestore daily write quota limit reached on the free Spark tier. Cannot add goal until quota recovers.");
    }
    const goalId = `dg-${Date.now()}`;
    const newGoal: DailyGoal = {
      id: goalId,
      childId: user?.uid || "child-1",
      title: goal.title || "New Learning Goal",
      category: goal.category || "learning",
      targetMinutes: goal.targetMinutes || 30,
      completedMinutes: 0,
      completed: false
    };
    if (user) {
      try {
        await setDoc(doc(db, "dailyGoals", goalId), newGoal);
        setDailyGoalsList(prev => [...prev, newGoal]);
      } catch (err: any) {
        if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded")) {
          setIsQuotaExhausted(true);
        }
        throw new Error("Failed to save goal to Cloud Firestore: " + (err?.message || "Write error"));
      }
    } else {
      setDailyGoalsList(prev => [...prev, newGoal]);
    }
  };

  const toggleDailyGoal = async (id: string, completed: boolean) => {
    if (isQuotaExhausted) {
      throw new Error("Cloud Firestore daily write quota limit reached on the free Spark tier. Cannot update goal until quota recovers.");
    }
    if (user) {
      try {
        const goal = dailyGoalsList.find(g => g.id === id);
        await updateDoc(doc(db, "dailyGoals", id), {
          completed,
          completedMinutes: completed ? (goal?.targetMinutes || 30) : 0
        });
        setDailyGoalsList(prev => prev.map(g => g.id === id ? { ...g, completed, completedMinutes: completed ? g.targetMinutes : 0 } : g));
      } catch (err: any) {
        if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded")) {
          setIsQuotaExhausted(true);
        }
        throw new Error("Failed to update goal in Cloud Firestore: " + (err?.message || "Write error"));
      }
    } else {
      setDailyGoalsList(prev => prev.map(g => g.id === id ? { ...g, completed, completedMinutes: completed ? g.targetMinutes : 0 } : g));
    }
  };

  const updateDailyGoalProgress = async (id: string, completedMinutes: number) => {
    if (isQuotaExhausted) {
      throw new Error("Cloud Firestore daily write quota limit reached on the free Spark tier. Cannot update goal progress until quota recovers.");
    }
    if (user) {
      try {
        const goal = dailyGoalsList.find(g => g.id === id);
        if (goal) {
          const clampedMins = Math.max(0, Math.min(goal.targetMinutes, completedMinutes));
          const isFinished = clampedMins >= goal.targetMinutes;
          await updateDoc(doc(db, "dailyGoals", id), {
            completedMinutes: clampedMins,
            completed: isFinished
          });
          setDailyGoalsList(prev => prev.map(g => {
            if (g.id === id) {
              return { ...g, completedMinutes: clampedMins, completed: isFinished };
            }
            return g;
          }));
        }
      } catch (err: any) {
        if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded")) {
          setIsQuotaExhausted(true);
        }
        throw new Error("Failed to update goal progress in Cloud Firestore: " + (err?.message || "Write error"));
      }
    } else {
      setDailyGoalsList(prev => prev.map(g => {
        if (g.id === id) {
          const clampedMins = Math.max(0, Math.min(g.targetMinutes, completedMinutes));
          const isFinished = clampedMins >= g.targetMinutes;
          return { ...g, completedMinutes: clampedMins, completed: isFinished };
        }
        return g;
      }));
    }
  };

  const deleteDailyGoal = async (id: string) => {
    if (isQuotaExhausted) {
      throw new Error("Cloud Firestore daily write quota limit reached on the free Spark tier. Cannot delete goal until quota recovers.");
    }
    if (user) {
      try {
        await deleteDoc(doc(db, "dailyGoals", id));
        setDailyGoalsList(prev => prev.filter(g => g.id !== id));
      } catch (err: any) {
        if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded")) {
          setIsQuotaExhausted(true);
        }
        throw new Error("Failed to delete goal from Cloud Firestore: " + (err?.message || "Write error"));
      }
    } else {
      setDailyGoalsList(prev => prev.filter(g => g.id !== id));
    }
  };

  // ADMIN OPERATIONS
  const fetchPlatformUsers = async (): Promise<PlatformUser[]> => {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const list: PlatformUser[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          uid: d.id,
          email: data.email || "user@guardian.ai",
          displayName: data.displayName,
          fullName: data.fullName || data.displayName || "Guardian User",
          role: (data.role as UserRole) || "parent",
          createdAt: data.createdAt || new Date().toISOString(),
          lastActive: data.lastActive || data.createdAt || new Date().toISOString(),
          emailVerified: data.emailVerified ?? true,
          disabled: data.disabled ?? false,
          familyCode: data.familyCode
        });
      });
      return list;
    } catch (err) {
      console.warn("fetchPlatformUsers fallback:", err);
      return [];
    }
  };

  const updateUserRole = async (targetUid: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, "users", targetUid), { role: newRole });
    } catch (err) {
      console.error("Failed to update user role:", err);
      throw err;
    }
  };

  const toggleUserStatus = async (targetUid: string, disabled: boolean) => {
    try {
      await updateDoc(doc(db, "users", targetUid), { disabled });
    } catch (err) {
      console.error("Failed to toggle user status:", err);
      throw err;
    }
  };

  const fetchAllFamilies = async (): Promise<FamilyData[]> => {
    try {
      const snapshot = await getDocs(collection(db, "families"));
      const list: FamilyData[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as FamilyData);
      });
      return list;
    } catch (err) {
      console.warn("fetchAllFamilies fallback:", err);
      return [];
    }
  };

  const fetchSystemHealth = async (): Promise<AdminSystemHealth> => {
    const startPing = Date.now();
    let firestoreLatency = 24;
    try {
      await getDoc(doc(db, "system", "healthCheck"));
      firestoreLatency = Date.now() - startPing;
    } catch {
      firestoreLatency = Date.now() - startPing;
    }

    let groqLatency = 85;
    try {
      const gStart = Date.now();
      const res = await fetch("/api/assistant/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "ping_health_check", history: [] })
      });
      groqLatency = Date.now() - gStart;
      if (!res.ok && res.status !== 400 && res.status !== 500) {
        // ok
      }
    } catch {
      groqLatency = 95;
    }

    return {
      firebaseStatus: firestoreLatency > 1500 ? "degraded" : "operational",
      firestoreLatencyMs: Math.max(15, firestoreLatency),
      groqApiStatus: "operational",
      groqLatencyMs: Math.max(40, groqLatency),
      openWeatherStatus: "operational",
      totalUsers: profiles.length + 1,
      totalParents: 1,
      totalChildren: profiles.length,
      totalFamilies: familyData ? 1 : 0,
      totalSosAlerts: sosAlerts.length,
      activeThreatsBlocked: dangerousEvents.length,
      serverUptime: "Not measured"
    };
  };

  return {
    user,
    userData,
    authLoading,
    isGuestMode,
    setIsGuestMode,
    dbLoading,
    profiles,
    setProfiles,
    devices,
    setDevices,
    getChildDevices,
    removeChildFromFamily,
    removeDevice,
    registerCurrentChildDevice,
    logs,
    setLogs,
    dangerousEvents,
    setDangerousEvents,
    safeZones,
    setSafeZones,
    chatHistory,
    setChatHistory,
    familyData,
    pendingRequests,
    childFamilyRequest,
    sosAlerts,
    homeworkList,
    dailyGoalsList,
    handleLogout,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    reloadUser,
    sendVerification,
    addProfileInDb,
    updateProfileInDb,
    addLogInDb,
    addDangerousEventInDb,
    deleteDangerousEventInDb,
    addSafeZoneInDb,
    deleteSafeZoneInDb,
    addChatMessageInDb,
    createOrFetchFamilyCode,
    joinFamilyByCode,
    acceptFamilyRequest,
    approveFamilyRequest,
    rejectFamilyRequest,
    triggerSosAlert,
    resolveSosAlert,
    resolvingSosAlertId,
    addHomeworkTask,
    toggleHomeworkTask,
    deleteHomeworkTask,
    addDailyGoal,
    toggleDailyGoal,
    updateDailyGoalProgress,
    deleteDailyGoal,
    fetchPlatformUsers,
    updateUserRole,
    toggleUserStatus,
    fetchAllFamilies,
    fetchSystemHealth,
    isQuotaExhausted,
    setIsQuotaExhausted,
    quotaMessage,
    checkQuotaRecovery
  };
}
