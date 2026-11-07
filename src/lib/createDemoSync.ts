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

export function useDemoSync(mode: "parent" | "child" | "admin") {
  // Profiles state (Leo & Emily)
  const [profiles, setProfiles] = useState<ChildProfile[]>(initialProfiles);
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);
  const [homeworkList, setHomeworkList] = useState<HomeworkTask[]>(DEMO_HOMEWORK_LIST);
  const [dailyGoalsList, setDailyGoalsList] = useState<DailyGoal[]>(DEMO_DAILY_GOALS);
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>(DEMO_PLATFORM_USERS);
  const [lastSosNotice, setLastSosNotice] = useState<string | null>(null);
  const [demoSosList, setDemoSosList] = useState<SosAlert[]>(sharedDemoSosAlerts);

  useEffect(() => {
    const update = () => setDemoSosList([...sharedDemoSosAlerts]);
    demoSosListeners.add(update);
    return () => {
      demoSosListeners.delete(update);
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
    : (mode === "child" ? DEMO_CHILD_DATA : DEMO_PARENT_DATA);

  // Simulated actions for demo
  const addProfileInDb = async (profile: ChildProfile) => {
    setProfiles(prev => [...prev, profile]);
  };

  const updateProfileInDb = async (profileId: string, fields: Partial<ChildProfile>) => {
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, ...fields } : p));
  };

  const deleteProfileInDb = async (profileId: string) => {
    setProfiles(prev => prev.filter(p => p.id !== profileId));
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
    pendingRequests: [
      {
        id: "demo-req-1",
        childUid: "demo-child-eval-uid",
        childName: "Leo Miller",
        childEmail: "demo-child@guardian-eval.local",
        familyCode: "EVAL-FAM-2026",
        parentUid: "demo-parent-eval-uid",
        status: "pending",
        createdAt: new Date().toISOString()
      }
    ],
    childFamilyRequest: null,
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
    joinFamilyByCode: async (code: string) => {
      return { success: true, message: `[DEMO] Connected to demo family with code ${code}. Real records were not modified.` };
    },
    registerCurrentChildDevice: async () => {}
  };
}
