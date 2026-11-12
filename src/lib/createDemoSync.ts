import { useState, useEffect } from "react";
import { 
  DEMO_PARENT_USER, DEMO_PARENT_DATA,
  DEMO_CHILD_USER, DEMO_CHILD_DATA,
  DEMO_ADMIN_USER, DEMO_ADMIN_DATA,
  DEMO_FAMILY_DATA, DEMO_HOMEWORK_LIST, DEMO_DAILY_GOALS,
  DEMO_PLATFORM_USERS
} from "./demoData";
import { initialProfiles, initialLogs, initialDevices } from "../data";
import { ChildProfile, ActivityLog, HomeworkTask, DailyGoal, FamilyData, PlatformUser, SosAlert } from "../types";

// Shared in-memory demo SOS alerts state across parent, child, and admin demo tabs
let sharedDemoSosAlerts: SosAlert[] = [
  {
    id: "demo-sample-sos-1",
    childId: "child-1",
    childName: "Leo Miller (Demo Sample)",
    familyCode: "EVAL-FAM-2026",
    parentUid: "demo-parent-eval-uid",
    location: {
      lat: 17.4849,
      lng: 78.3907,
      name: "Botanical Garden Safe Perimeter, Hyderabad (Simulated Demo)"
    },
    status: "resolved",
    timestamp: new Date(Date.now() - 3600000).toISOString()
  }
];
const demoSosListeners = new Set<() => void>();

export interface DemoFamilyLinkState {
  status: "pending" | "accepted" | "rejected";
  pendingRequests: any[];
  childFamilyRequest: any | null;
  profiles: ChildProfile[];
}

export const INITIAL_DEMO_FAMILY_REQUEST = {
  id: "demo-req-1",
  childUid: "demo-child-eval-uid",
  childName: "Leo Miller",
  childEmail: "demo-child@guardian-eval.local",
  familyCode: "EVAL-FAM-2026",
  parentUid: "demo-parent-eval-uid",
  status: "pending" as const,
  createdAt: new Date().toISOString()
};

// Leo profile to link upon acceptance
export const DEMO_LEO_PROFILE: ChildProfile = initialProfiles[0];
// Emily profile already linked
export const DEMO_EMILY_PROFILE: ChildProfile = initialProfiles[1];

let sharedDemoFamilyState: DemoFamilyLinkState = {
  status: "pending",
  pendingRequests: [{ ...INITIAL_DEMO_FAMILY_REQUEST }],
  childFamilyRequest: { ...INITIAL_DEMO_FAMILY_REQUEST },
  profiles: [DEMO_EMILY_PROFILE]
};
const demoFamilyListeners = new Set<() => void>();

export function resetDemoFamilyState() {
  sharedDemoFamilyState = {
    status: "pending",
    pendingRequests: [{ ...INITIAL_DEMO_FAMILY_REQUEST, createdAt: new Date().toISOString() }],
    childFamilyRequest: { ...INITIAL_DEMO_FAMILY_REQUEST, createdAt: new Date().toISOString() },
    profiles: [DEMO_EMILY_PROFILE]
  };
  demoFamilyListeners.forEach(l => l());
}

if (typeof window !== "undefined") {
  (window as any).resetGuardianDemoFamily = resetDemoFamilyState;
}

export function useDemoSync(mode: "parent" | "child" | "admin") {
  // Profiles and family request state synced from sharedDemoFamilyState
  const [profiles, setProfiles] = useState<ChildProfile[]>(sharedDemoFamilyState.profiles);
  const [pendingRequests, setPendingRequests] = useState<any[]>(sharedDemoFamilyState.pendingRequests);
  const [childFamilyRequest, setChildFamilyRequest] = useState<any | null>(sharedDemoFamilyState.childFamilyRequest);
  const [demoFamilyStatus, setDemoFamilyStatus] = useState<"pending" | "accepted" | "rejected">(sharedDemoFamilyState.status);

  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [homeworkList, setHomeworkList] = useState<HomeworkTask[]>(DEMO_HOMEWORK_LIST);
  const [dailyGoalsList, setDailyGoalsList] = useState<DailyGoal[]>(DEMO_DAILY_GOALS);
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>(DEMO_PLATFORM_USERS);
  const [lastSosNotice, setLastSosNotice] = useState<string | null>(null);
  const [demoSosList, setDemoSosList] = useState<SosAlert[]>(sharedDemoSosAlerts);

  useEffect(() => {
    const updateSos = () => setDemoSosList([...sharedDemoSosAlerts]);
    demoSosListeners.add(updateSos);

    const updateFamily = () => {
      setProfiles([...sharedDemoFamilyState.profiles]);
      setPendingRequests([...sharedDemoFamilyState.pendingRequests]);
      setChildFamilyRequest(sharedDemoFamilyState.childFamilyRequest ? { ...sharedDemoFamilyState.childFamilyRequest } : null);
      setDemoFamilyStatus(sharedDemoFamilyState.status);
    };
    demoFamilyListeners.add(updateFamily);

    return () => {
      demoSosListeners.delete(updateSos);
      demoFamilyListeners.delete(updateFamily);
    };
  }, []);

  // Safe zones in Hyderabad
  const initialSafeZones = [
    { name: "Home Safe Zone (Kondapur)", active: true, radius: 150, lat: 17.4875, lng: 78.3890 },
    { name: "Kondapur Tech Academy", active: true, radius: 200, lat: 17.4849, lng: 78.3907 },
    { name: "Botanical Garden Sports Complex", active: true, radius: 250, lat: 17.4820, lng: 78.3860 }
  ];
  const [safeZones, setSafeZones] = useState<any[]>(initialSafeZones);

  // Dangerous events
  const [dangerousEvents, setDangerousEvents] = useState<any[]>([
    {
      id: "demo-de-1",
      childId: "child-1",
      category: "Scam & Phishing",
      target: "free-robux-clicker.com/claim-reward",
      riskLevel: "high",
      confidence: 96,
      reason: "[DEMO] Attempts to harvest credentials via high-pressure phishing banners promising virtual currency.",
      actionTaken: "Blocked connection instantly & routed alert to Guardian parent dashboard.",
      suggestedAction: "Have a talk with Leo about in-game item scams.",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: "blocked"
    },
    {
      id: "demo-de-2",
      childId: "child-1",
      category: "Mature Content",
      target: "restricted-media-stream.net",
      riskLevel: "critical",
      confidence: 99,
      reason: "[DEMO] Handshake established with domain containing adult video streaming scripts.",
      actionTaken: "Dropped network packets immediately and locked browser tab.",
      suggestedAction: "Review tablet web filter settings.",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      status: "blocked"
    }
  ]);

  // Chat messages
  const [chatHistory, setChatHistory] = useState<Record<string, any[]>>({
    "child-1": [
      { id: "m-1", role: "model", text: "Hello! I am your Guardian AI family counselor. In this demo preview, ask me anything about Leo's digital habits, educational focus, or safety logs.", timestamp: "09:00 AM" }
    ],
    "child-2": [
      { id: "m-1", role: "model", text: "Hello! I am your Guardian AI family counselor. Ask me anything about Emily's digital habits, educational focus, or safety logs.", timestamp: "09:00 AM" }
    ]
  });

  const currentUser = mode === "admin" 
    ? DEMO_ADMIN_USER 
    : (mode === "child" ? DEMO_CHILD_USER : DEMO_PARENT_USER);

  const currentUserData = mode === "admin"
    ? DEMO_ADMIN_DATA
    : (mode === "child"
        ? {
            ...DEMO_CHILD_DATA,
            parentId: demoFamilyStatus === "accepted" ? "demo-parent-eval-uid" : undefined,
            status: demoFamilyStatus === "rejected" ? "rejected" : (demoFamilyStatus === "accepted" ? "active" : "pending")
          }
        : DEMO_PARENT_DATA);

  // Simulated actions for demo
  const addProfileInDb = async (profile: ChildProfile) => {
    sharedDemoFamilyState = {
      ...sharedDemoFamilyState,
      profiles: [...sharedDemoFamilyState.profiles, profile]
    };
    demoFamilyListeners.forEach(l => l());
  };

  const updateProfileInDb = async (profileId: string, fields: Partial<ChildProfile>) => {
    sharedDemoFamilyState = {
      ...sharedDemoFamilyState,
      profiles: sharedDemoFamilyState.profiles.map(p => p.id === profileId ? { ...p, ...fields } : p)
    };
    demoFamilyListeners.forEach(l => l());
  };

  const deleteProfileInDb = async (profileId: string) => {
    sharedDemoFamilyState = {
      ...sharedDemoFamilyState,
      profiles: sharedDemoFamilyState.profiles.filter(p => p.id !== profileId)
    };
    demoFamilyListeners.forEach(l => l());
  };

  const addHomeworkTask = async (task: Partial<HomeworkTask>) => {
    const newTask: HomeworkTask = {
      id: `demo-hw-${Date.now()}`,
      childId: currentUser.uid,
      title: task.title || "New Homework Task",
      subject: task.subject || "General Study",
      dueDate: task.dueDate || "Tomorrow",
      completed: false,
      notes: task.notes || "[DEMO TASK]"
    };
    setHomeworkList(prev => [newTask, ...prev]);
  };

  const toggleHomeworkTask = async (id: string, completed: boolean) => {
    setHomeworkList(prev => prev.map(t => t.id === id ? { ...t, completed } : t));
  };

  const deleteHomeworkTask = async (id: string) => {
    setHomeworkList(prev => prev.filter(t => t.id !== id));
  };

  const addDailyGoal = async (goal: Partial<DailyGoal>) => {
    const newGoal: DailyGoal = {
      id: `demo-dg-${Date.now()}`,
      childId: currentUser.uid,
      title: goal.title || "New Goal",
      category: goal.category || "learning",
      targetMinutes: goal.targetMinutes || 20,
      completedMinutes: 0,
      completed: false
    };
    setDailyGoalsList(prev => [newGoal, ...prev]);
  };

  const toggleDailyGoal = async (id: string, completed: boolean) => {
    setDailyGoalsList(prev => prev.map(g => g.id === id ? { ...g, completed } : g));
  };

  const updateDailyGoalProgress = async (id: string, completedMinutes: number) => {
    setDailyGoalsList(prev => prev.map(g => g.id === id ? { ...g, completedMinutes, completed: completedMinutes >= g.targetMinutes } : g));
  };

  const deleteDailyGoal = async (id: string) => {
    setDailyGoalsList(prev => prev.filter(g => g.id !== id));
  };

  const triggerSosAlert = async (childId?: string, childName?: string, location?: any) => {
    // Artificial 350ms delay to simulate real network roundtrip
    await new Promise(r => setTimeout(r, 350));

    const cleanLocation = {
      lat: (location && typeof location.lat === "number") ? location.lat : 17.4849,
      lng: (location && typeof location.lng === "number") ? location.lng : 78.3907,
      name: (location && typeof location.name === "string" && location.name.trim().length > 0)
        ? location.name.trim()
        : "Kondapur Safe Perimeter, Hyderabad (Simulated Demo)"
    };

    const alertId = `demo-sos-${Date.now()}`;
    const targetName = childName?.trim() || "Leo Miller [DEMO]";
    const newAlert: SosAlert = {
      id: alertId,
      childId: childId || "demo-child-eval-uid",
      childName: targetName,
      familyCode: "EVAL-FAM-2026",
      parentUid: "demo-parent-eval-uid",
      location: cleanLocation,
      status: "active",
      timestamp: new Date().toISOString()
    };

    // Broadcast to all demo instances (Parent & Child)
    sharedDemoSosAlerts = [newAlert, ...sharedDemoSosAlerts];
    demoSosListeners.forEach(listener => listener());

    // Record safe activity log
    const demoLog: ActivityLog = {
      id: `demo-log-${Date.now()}`,
      childId: newAlert.childId,
      type: "sos",
      title: "🚨 SIMULATED SOS DISTRESS SIGNAL (DEMO)",
      description: `[FACULTY EVALUATION DEMO] ${targetName} pressed the companion SOS distress panic button. In live production, parent devices sound immediate high-decibel alarms and push emergency notifications via Cloud Firestore.`,
      timestamp: newAlert.timestamp,
      safetyLevel: "severe"
    };
    setLogs(prev => [demoLog, ...prev]);

    const notice = `[DEMO SOS SIMULATED] Emergency alert triggered for ${targetName} at ${cleanLocation.name}. Real records were not modified.`;
    setLastSosNotice(notice);

    return { success: true, alertId, timestamp: newAlert.timestamp, isDemo: true };
  };

  const resolveSosAlert = async (alertId: string) => {
    sharedDemoSosAlerts = sharedDemoSosAlerts.map(a => a.id === alertId ? { ...a, status: "resolved" } : a);
    demoSosListeners.forEach(listener => listener());
  };

  const fetchPlatformUsers = async () => {
    return platformUsers;
  };

  const fetchAllFamilies = async () => {
    return [DEMO_FAMILY_DATA];
  };

  // Demo Family Link Request Handlers
  const acceptFamilyRequest = async (requestId: string, childUid?: string, childName?: string, childEmail?: string) => {
    // Artificial 250ms delay to simulate real network roundtrip
    await new Promise(r => setTimeout(r, 250));

    const exists = sharedDemoFamilyState.pendingRequests.some(r => r.id === requestId);
    if (!exists && requestId !== "demo-req-1") {
      throw new Error(`[DEMO] Pending family link request "${requestId}" not found.`);
    }

    const acceptedRequest = {
      id: requestId,
      childUid: childUid || "demo-child-eval-uid",
      childName: childName || "Leo Miller",
      childEmail: childEmail || "demo-child@guardian-eval.local",
      familyCode: "EVAL-FAM-2026",
      parentUid: "demo-parent-eval-uid",
      status: "accepted" as const,
      createdAt: new Date().toISOString()
    };

    // Ensure Leo Miller is in the linked profiles list upon acceptance
    const hasLeo = sharedDemoFamilyState.profiles.some(p => p.id === "child-1");
    const updatedProfiles = hasLeo
      ? sharedDemoFamilyState.profiles
      : [DEMO_LEO_PROFILE, ...sharedDemoFamilyState.profiles];

    sharedDemoFamilyState = {
      status: "accepted",
      pendingRequests: sharedDemoFamilyState.pendingRequests.filter(r => r.id !== requestId),
      childFamilyRequest: acceptedRequest,
      profiles: updatedProfiles
    };

    demoFamilyListeners.forEach(listener => listener());

    return {
      success: true,
      message: `[DEMO] Connection request for ${childName || "Leo Miller"} accepted. Leo is now connected to the demo family network.`
    };
  };

  const approveFamilyRequest = acceptFamilyRequest;

  const rejectFamilyRequest = async (requestId: string) => {
    // Artificial 250ms delay to simulate real network roundtrip
    await new Promise(r => setTimeout(r, 250));

    const exists = sharedDemoFamilyState.pendingRequests.some(r => r.id === requestId);
    if (!exists && requestId !== "demo-req-1") {
      throw new Error(`[DEMO] Pending family link request "${requestId}" not found.`);
    }

    const rejectedRequest = {
      id: requestId,
      childUid: "demo-child-eval-uid",
      childName: "Leo Miller",
      childEmail: "demo-child@guardian-eval.local",
      familyCode: "EVAL-FAM-2026",
      parentUid: "demo-parent-eval-uid",
      status: "rejected" as const,
      createdAt: new Date().toISOString()
    };

    sharedDemoFamilyState = {
      status: "rejected",
      pendingRequests: sharedDemoFamilyState.pendingRequests.filter(r => r.id !== requestId),
      childFamilyRequest: rejectedRequest,
      profiles: sharedDemoFamilyState.profiles.filter(p => p.id !== "child-1")
    };

    demoFamilyListeners.forEach(listener => listener());

    return {
      success: true,
      message: "[DEMO] Family connection request rejected. Real records were not modified."
    };
  };

  const removeChildFromFamily = async (childId: string) => {
    sharedDemoFamilyState = {
      status: "rejected",
      pendingRequests: [],
      childFamilyRequest: {
        id: "demo-req-disconnected",
        childUid: "demo-child-eval-uid",
        childName: "Leo Miller",
        childEmail: "demo-child@guardian-eval.local",
        familyCode: "EVAL-FAM-2026",
        parentUid: "demo-parent-eval-uid",
        status: "rejected" as const,
        createdAt: new Date().toISOString()
      },
      profiles: sharedDemoFamilyState.profiles.filter(p => p.id !== childId)
    };
    demoFamilyListeners.forEach(listener => listener());
    return { success: true, message: "[DEMO] Child disconnected from demo family." };
  };

  const joinFamilyByCode = async (code: string) => {
    const clean = (code || "").trim().toUpperCase();
    if (clean !== "EVAL-FAM-2026") {
      return { success: false, message: `[DEMO] Invalid demo Family Code "${clean}". Use evaluation code EVAL-FAM-2026.` };
    }
    // Re-create the pending request for Leo
    sharedDemoFamilyState = {
      status: "pending",
      pendingRequests: [{ ...INITIAL_DEMO_FAMILY_REQUEST, createdAt: new Date().toISOString() }],
      childFamilyRequest: { ...INITIAL_DEMO_FAMILY_REQUEST, createdAt: new Date().toISOString() },
      profiles: [DEMO_EMILY_PROFILE]
    };
    demoFamilyListeners.forEach(listener => listener());
    return { success: true, message: `[DEMO] Sent connection request with code ${clean}. Awaiting parent approval.` };
  };

  return {
    isDemoMode: true,
    user: currentUser,
    userData: currentUserData,
    familyData: DEMO_FAMILY_DATA,
    profiles,
    setProfiles,
    logs,
    setLogs,
    devices: initialDevices,
    dangerousEvents,
    setDangerousEvents,
    safeZones,
    setSafeZones,
    chatHistory,
    setChatHistory,
    pendingRequests,
    childFamilyRequest,
    acceptFamilyRequest,
    approveFamilyRequest,
    rejectFamilyRequest,
    removeChildFromFamily,
    resetDemoFamilyState,
    homeworkList,
    dailyGoalsList,
    platformUsers,
    lastSosNotice,
    sosAlerts: demoSosList,
    resolveSosAlert,
    resolvingSosAlertId: null,
    addProfileInDb,
    updateProfileInDb,
    deleteProfileInDb,
    addHomeworkTask,
    toggleHomeworkTask,
    deleteHomeworkTask,
    addDailyGoal,
    toggleDailyGoal,
    updateDailyGoalProgress,
    deleteDailyGoal,
    triggerSosAlert,
    fetchPlatformUsers,
    fetchAllFamilies,
    joinFamilyByCode,
    registerCurrentChildDevice: async () => {}
  };
}
