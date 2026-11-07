import { ChildProfile, ChildDevice, ActivityLog, FamilyData, HomeworkTask, DailyGoal, PlatformUser } from "../types";
import { initialProfiles, initialLogs, initialDevices } from "../data";

// Safe, clearly labeled demonstration identities (never exposes real personal data)
export const DEMO_PARENT_USER = {
  uid: "demo-parent-eval-uid",
  email: "demo-parent@guardian-eval.local",
  displayName: "Faculty Evaluator (Demo Parent)",
  emailVerified: true
};

export const DEMO_PARENT_DATA = {
  role: "parent" as const,
  fullName: "Faculty Evaluator (Demo Parent)",
  email: "demo-parent@guardian-eval.local",
  familyCode: "EVAL-FAM-2026",
  status: "active"
};

export const DEMO_CHILD_USER = {
  uid: "demo-child-eval-uid",
  email: "demo-child@guardian-eval.local",
  displayName: "Leo Miller (Demo Explorer)",
  emailVerified: true
};

export const DEMO_CHILD_DATA = {
  role: "child" as const,
  fullName: "Leo Miller (Demo Explorer)",
  email: "demo-child@guardian-eval.local",
  familyCode: "EVAL-FAM-2026",
  parentId: "demo-parent-eval-uid",
  status: "active"
};

export const DEMO_ADMIN_USER = {
  uid: "demo-admin-eval-uid",
  email: "demo-admin@guardian-eval.local",
  displayName: "Faculty Evaluator (Demo Admin)",
  emailVerified: true
};

export const DEMO_ADMIN_DATA = {
  role: "admin" as const,
  fullName: "Faculty Evaluator (Demo Admin)",
  email: "demo-admin@guardian-eval.local",
  status: "active"
};

export const DEMO_FAMILY_DATA: FamilyData = {
  familyCode: "EVAL-FAM-2026",
  familyName: "Miller Family (Demo Sandbox)",
  ownerParentId: "demo-parent-eval-uid",
  parentEmail: "demo-parent@guardian-eval.local",
  createdAt: "2026-01-15T08:00:00.000Z"
};

export const DEMO_PLATFORM_USERS: PlatformUser[] = [
  {
    uid: "demo-admin-eval-uid",
    email: "demo-admin@guardian-eval.local",
    fullName: "Faculty Evaluator [DEMO]",
    role: "admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActive: new Date().toISOString(),
    emailVerified: true,
    disabled: false
  },
  {
    uid: "demo-parent-eval-uid",
    email: "demo-parent@guardian-eval.local",
    fullName: "Sarah Miller (Parent) [DEMO]",
    role: "parent",
    createdAt: "2026-01-15T08:00:00.000Z",
    lastActive: new Date(Date.now() - 3600000).toISOString(),
    emailVerified: true,
    disabled: false
  },
  {
    uid: "demo-child-eval-uid",
    email: "demo-child@guardian-eval.local",
    fullName: "Leo Miller (Child) [DEMO]",
    role: "child",
    createdAt: "2026-01-16T10:00:00.000Z",
    lastActive: new Date(Date.now() - 900000).toISOString(),
    emailVerified: true,
    disabled: false
  },
  {
    uid: "demo-child-2-uid",
    email: "emily-child@guardian-eval.local",
    fullName: "Emily Miller (Child) [DEMO]",
    role: "child",
    createdAt: "2026-01-16T10:30:00.000Z",
    lastActive: new Date(Date.now() - 1800000).toISOString(),
    emailVerified: true,
    disabled: false
  }
];

export const DEMO_HOMEWORK_LIST: HomeworkTask[] = [
  {
    id: "demo-hw-1",
    childId: "demo-child-eval-uid",
    title: "Math Worksheet Chapter 4: Fractions & Decimals",
    subject: "Mathematics",
    dueDate: "Tomorrow, 5:00 PM",
    completed: false,
    notes: "Complete practice problems 1 through 15 [DEMO TASK]"
  },
  {
    id: "demo-hw-2",
    childId: "demo-child-eval-uid",
    title: "Science Lab: Photosynthesis & Solar Energy Diagrams",
    subject: "Science",
    dueDate: "Friday, 8:00 PM",
    completed: true,
    notes: "Review leaf chloroplast diagram [DEMO TASK]"
  },
  {
    id: "demo-hw-3",
    childId: "demo-child-eval-uid",
    title: "Literature Reading: Percy Jackson & The Olympians",
    subject: "English Literature",
    dueDate: "Monday",
    completed: false,
    notes: "Read chapter 4 and write 3 summary questions [DEMO TASK]"
  }
];

export const DEMO_DAILY_GOALS: DailyGoal[] = [
  {
    id: "demo-dg-1",
    childId: "demo-child-eval-uid",
    title: "Read Science Fiction Book (20 Mins)",
    category: "learning",
    targetMinutes: 20,
    completedMinutes: 20,
    completed: true
  },
  {
    id: "demo-dg-2",
    childId: "demo-child-eval-uid",
    title: "Complete Interactive Cyber Safety Quiz",
    category: "safety",
    targetMinutes: 10,
    completedMinutes: 10,
    completed: true
  },
  {
    id: "demo-dg-3",
    childId: "demo-child-eval-uid",
    title: "Practice Beginner Python on Khan Academy",
    category: "creative",
    targetMinutes: 30,
    completedMinutes: 15,
    completed: false
  },
  {
    id: "demo-dg-4",
    childId: "demo-child-eval-uid",
    title: "Outdoor Sports & Screen Health Break",
    category: "health",
    targetMinutes: 45,
    completedMinutes: 30,
    completed: false
  }
];
