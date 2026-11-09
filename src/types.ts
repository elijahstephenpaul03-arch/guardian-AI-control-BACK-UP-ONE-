export type SafetyLevel = 'safe' | 'warning' | 'severe';
export type UserRole = 'admin' | 'parent' | 'child';

export interface ChildDevice {
  id: string;
  name: string;
  type: 'phone' | 'tablet' | 'laptop' | 'desktop';
  model?: string;
  os?: string;
  battery?: number;
  status: 'online' | 'offline' | 'disconnected';
  lastActive: string;
  childId: string;
  parentId?: string;
  createdAt?: string;
}

export interface ChildProfile {
  id: string;
  deviceId?: string;
  name: string;
  age: number;
  avatar: string;
  device: string;
  battery: number;
  status: 'online' | 'offline' | 'locked' | 'focus';
  screenTimeLimit: number; // in minutes
  screenTimeToday: number; // in minutes
  riskScore: number; // out of 100
  lastSeenLocation: {
    lat: number;
    lng: number;
    name: string;
    timestamp: string;
  };
  devices?: ChildDevice[];
}

export interface ActivityLog {
  id: string;
  childId: string;
  type: 'app' | 'web' | 'location' | 'sos' | 'safety' | 'system';
  title: string;
  description: string;
  timestamp: string;
  safetyLevel: SafetyLevel;
  duration?: number; // in minutes
}

export interface AdvancedAIReport {
  weekStarting: string;
  screenTimeSummary: string;
  mostUsedApps: { name: string; duration: number; icon: string }[];
  educationalVsEntertainment: { edu: number; ent: number; other: number };
  dailyRoutineAnalysis: string;
  sleepScheduleInsights: string;
  browsingTrends: string;
  safetyAlertsCount: number;
  personalizedRecommendations: string[];
}

export interface InterestTalentData {
  growthTimeline: { month: string; coding: number; art: number; music: number; science: number }[];
  talents: {
    name: string;
    score: number;
    description: string;
    careerSuggestions: string[];
    resources: string[];
  }[];
  learningStyle: string;
  talentScore: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  groundingMetadata?: any;
  modelUsed?: string;
}

export interface FamilyData {
  familyCode: string;
  familyName: string;
  ownerParentId: string;
  parentEmail?: string;
  createdAt: string;
}

export interface FamilyRequest {
  id: string;
  familyCode: string;
  parentUid: string;
  childUid: string;
  childName: string;
  childEmail?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'approved';
  createdAt: string;
  respondedAt?: string;
}

export type FamilyLinkRequest = FamilyRequest;

export interface HomeworkTask {
  id: string;
  childId: string;
  title: string;
  subject: string;
  dueDate: string;
  completed: boolean;
  notes?: string;
}

export interface DailyGoal {
  id: string;
  childId: string;
  title: string;
  category: 'learning' | 'safety' | 'health' | 'creative';
  targetMinutes: number;
  completedMinutes: number;
  completed: boolean;
}

export interface SosAlert {
  id: string;
  childId: string;
  childName: string;
  familyCode?: string;
  parentUid?: string;
  location?: { lat: number; lng: number; name: string };
  status: 'active' | 'resolved';
  timestamp: string;
  resolvedAt?: any;
  resolvedBy?: string;
}

export interface PlatformUser {
  uid: string;
  email: string;
  displayName?: string;
  fullName?: string;
  role: UserRole;
  createdAt: string;
  lastActive?: string;
  emailVerified?: boolean;
  disabled?: boolean;
  familyCode?: string;
  parentId?: string;
  familyDisconnected?: boolean;
  disconnectedMessage?: string;
  disconnectedAt?: string;
  childrenCount?: number;
}

export interface AdminSystemHealth {
  firebaseStatus: 'operational' | 'degraded' | 'offline';
  firestoreLatencyMs: number;
  groqApiStatus: 'operational' | 'degraded' | 'offline';
  groqLatencyMs: number;
  openWeatherStatus: 'operational' | 'degraded';
  totalUsers: number;
  totalParents: number;
  totalChildren: number;
  totalFamilies: number;
  totalSosAlerts: number;
  activeThreatsBlocked: number;
  serverUptime: string;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  action: string;
  category: 'auth' | 'rbac' | 'security' | 'sos' | 'threat' | 'config';
  severity: 'info' | 'warning' | 'critical';
  userEmail?: string;
  details: string;
  ipAddress?: string;
}

export interface PlatformConfig {
  emergencyBroadcast: {
    active: boolean;
    message: string;
    severity: 'low' | 'medium' | 'high';
    updatedAt?: string;
  };
  aiSafetyStrictness: 'standard' | 'strict' | 'maximum';
  maxScreenTimeCap: number;
  defaultGpsIntervalSeconds: number;
  allowNewRegistrations: boolean;
}

export interface SafeZone {
  id: string;
  parentId?: string;
  name: string;
  active: boolean;
  radius: number;
  lat: number;
  lng: number;
  createdAt?: string;
}

export interface DangerousEvent {
  id: string;
  parentId: string;
  childId?: string;
  category: string;
  target: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  reason?: string;
  actionTaken?: string;
  suggestedAction?: string;
  status: string;
  timestamp: string;
}
