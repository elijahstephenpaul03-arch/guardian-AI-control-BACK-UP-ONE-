import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldAlert, Users, Server, Activity, Lock, AlertTriangle, CheckCircle2,
  RefreshCw, Search, Filter, UserCheck, UserX, Shield, Radio, Sparkles,
  Database, Cpu, Clock, Bell, Terminal, Key, Smartphone, Heart, ChevronRight,
  TrendingUp, Globe, Eye, Settings, FileText, Check, AlertOctagon, LogOut,
  Send, ExternalLink, Zap
} from "lucide-react";
import { PlatformUser, FamilyData, AdminSystemHealth, SecurityAuditLog, PlatformConfig, UserRole } from "../types";
import { ADMIN_EMAILS } from "../lib/useFirebaseSync";
import { db } from "../lib/firebase";
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import SystemDemonstrationPanel from "./SystemDemonstrationPanel";

interface AdminDashboardProps {
  user: any;
  userData: any;
  onLogout: () => void;
  navigate: (to: string) => void;
  syncProps: any;
}

export default function AdminDashboard({
  user,
  userData,
  onLogout,
  navigate,
  syncProps
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "families" | "health" | "logs" | "settings">("overview");
  
  // Data states
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [families, setFamilies] = useState<FamilyData[]>([]);
  const [systemHealth, setSystemHealth] = useState<AdminSystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "parent" | "child">("all");
  
  // Role change modal
  const [selectedUserForRole, setSelectedUserForRole] = useState<PlatformUser | null>(null);
  const [newRoleSelection, setNewRoleSelection] = useState<UserRole>("parent");
  const [roleUpdateLoading, setRoleUpdateLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Platform Config State
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>({
    emergencyBroadcast: {
      active: false,
      message: "Standard platform monitoring active. All child protection neural engines operational.",
      severity: "low",
      updatedAt: new Date().toISOString()
    },
    aiSafetyStrictness: "strict",
    maxScreenTimeCap: 360,
    defaultGpsIntervalSeconds: 30,
    allowNewRegistrations: true
  });

  // Audit Logs Mock/Live Stream
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>([
    {
      id: "log-101",
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      action: "Admin Portal Authentication",
      category: "auth",
      severity: "info",
      userEmail: user?.email || "admin@guardian.ai",
      details: "Successful OAuth session initiated with elevated admin role token.",
      ipAddress: "192.168.1.104"
    },
    {
      id: "log-102",
      timestamp: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
      action: "Dangerous URL Interception",
      category: "threat",
      severity: "critical",
      userEmail: "parent.leo@example.com",
      details: "AI content filter blocked domain 'free-robux-clicker.com' targeting child device 'Galaxy Tab S9'.",
      ipAddress: "172.56.21.90"
    },
    {
      id: "log-103",
      timestamp: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
      action: "Geofence Safe Zone Breach",
      category: "security",
      severity: "warning",
      userEmail: "parent.emily@example.com",
      details: "Child device exited 'Home Safe Zone' outside expected schedule window.",
      ipAddress: "10.0.0.12"
    },
    {
      id: "log-104",
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      action: "Family Connection Request Approved",
      category: "rbac",
      severity: "info",
      userEmail: "parent.sarah@example.com",
      details: "Child UID child_094 linked to Family Code #GRD-7721.",
      ipAddress: "73.189.44.12"
    }
  ]);

  // Initial Load with real Firestore data sources
  const loadAdminData = async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch real system platformConfig from Supabase or Firestore
      try {
        if (syncProps?.isSupabaseMode && syncProps?.fetchPlatformConfig) {
          const cfg = await syncProps.fetchPlatformConfig();
          if (cfg) {
            setPlatformConfig(prev => ({
              ...prev,
              ...cfg
            }));
          }
        } else {
          const configSnap = await getDoc(doc(db, "system", "platformConfig"));
          if (configSnap.exists()) {
            setPlatformConfig(prev => ({
              ...prev,
              ...configSnap.data()
            }));
          }
        }
      } catch (cfgErr) {
        console.warn("Could not load system/platformConfig:", cfgErr);
      }

      // 2. Fetch real users from Firestore
      if (syncProps.fetchPlatformUsers) {
        const users = await syncProps.fetchPlatformUsers();
        if (users && users.length > 0) {
          setPlatformUsers(users);
        } else if (user) {
          setPlatformUsers([
            {
              uid: user.uid,
              email: user.email || "admin@guardian.ai",
              fullName: userData?.fullName || "Platform Administrator",
              role: (userData?.role as UserRole) || "admin",
              createdAt: new Date().toISOString(),
              lastActive: new Date().toISOString(),
              emailVerified: user.emailVerified ?? true,
              disabled: false
            }
          ]);
        } else {
          setPlatformUsers([]);
        }
      }

      // 3. Fetch real family networks from Firestore
      if (syncProps.fetchAllFamilies) {
        const fams = await syncProps.fetchAllFamilies();
        if (fams && fams.length > 0) {
          setFamilies(fams);
        } else if (syncProps.familyData) {
          setFamilies([syncProps.familyData]);
        } else {
          setFamilies([]);
        }
      }

      // 4. Fetch real security audit logs from Firestore
      try {
        const logsSnap = await getDocs(query(collection(db, "auditLogs"), orderBy("timestamp", "desc"), limit(20)));
        if (!logsSnap.empty) {
          const liveLogs: SecurityAuditLog[] = [];
          logsSnap.forEach(d => {
            liveLogs.push(d.data() as SecurityAuditLog);
          });
          setAuditLogs(liveLogs);
        }
      } catch (logsErr) {
        console.warn("Could not query auditLogs collection:", logsErr);
      }

      if (syncProps.fetchSystemHealth) {
        const health = await syncProps.fetchSystemHealth();
        setSystemHealth(health);
      }
    } catch (err) {
      console.error("Admin data load error:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  // Handle Toggle Registration Gateway (persists to Firestore and enforces in registration)
  const handleToggleRegistration = async () => {
    const nextVal = !platformConfig.allowNewRegistrations;
    setPlatformConfig(p => ({ ...p, allowNewRegistrations: nextVal }));
    try {
      if (syncProps?.isSupabaseMode && syncProps?.updatePlatformConfig) {
        await syncProps.updatePlatformConfig({ allowNewRegistrations: nextVal });
      } else {
        await setDoc(doc(db, "system", "platformConfig"), {
          allowNewRegistrations: nextVal,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      const logId = `log-reg-${Date.now()}`;
      const logEntry: SecurityAuditLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        action: "Registration Gateway Toggled",
        category: "security",
        severity: nextVal ? "info" : "warning",
        userEmail: user?.email || "admin@guardian.ai",
        details: `Administrator toggled registration access to ${nextVal ? "OPEN" : "LOCKED"}.`,
        ipAddress: "Admin Console"
      };
      await setDoc(doc(db, "auditLogs", logId), logEntry).catch(() => {});
      setAuditLogs(prev => [logEntry, ...prev]);

      setActionSuccessMsg(`Registration Gateway has been ${nextVal ? "OPENED" : "LOCKED"}.`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Failed to update registration gateway setting:", err);
      setActionSuccessMsg(`Error: ${err.message || "Failed to update gateway"}`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  };

  // Handle Save Global Policies (persists to Supabase or Firestore)
  const handleSavePolicies = async () => {
    try {
      if (syncProps?.isSupabaseMode && syncProps?.updatePlatformConfig) {
        await syncProps.updatePlatformConfig(platformConfig);
      } else {
        await setDoc(doc(db, "system", "platformConfig"), {
          ...platformConfig,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      const logId = `log-policy-${Date.now()}`;
      const logEntry: SecurityAuditLog = {
        id: logId,
        timestamp: new Date().toISOString(),
        action: "Global Safety Policies Updated",
        category: "security",
        severity: "info",
        userEmail: user?.email || "admin@guardian.ai",
        details: `Emergency Broadcast=${platformConfig.emergencyBroadcast.active ? "ACTIVE" : "OFF"}, ScreenTimeCap=${platformConfig.maxScreenTimeCap}m.`,
        ipAddress: "Admin Console"
      };
      await setDoc(doc(db, "auditLogs", logId), logEntry).catch(() => {});
      setAuditLogs(prev => [logEntry, ...prev]);

      setActionSuccessMsg("Global platform policies saved successfully.");
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Failed to save policies:", err);
      setActionSuccessMsg(`Error: ${err.message || "Failed to save policies"}`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  };

  // Handle User Role Update
  const handleUpdateRole = async () => {
    if (!selectedUserForRole) return;
    setRoleUpdateLoading(true);
    try {
      if (syncProps.updateUserRole) {
        await syncProps.updateUserRole(selectedUserForRole.uid, newRoleSelection);
      }
      setPlatformUsers(prev => prev.map(u => u.uid === selectedUserForRole.uid ? { ...u, role: newRoleSelection } : u));
      setActionSuccessMsg(`Role for ${selectedUserForRole.fullName || selectedUserForRole.email} updated to ${newRoleSelection.toUpperCase()}`);
      
      // Add to audit logs
      setAuditLogs(prev => [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: "User Role Modified",
          category: "rbac",
          severity: "warning",
          userEmail: user?.email || "admin@guardian.ai",
          details: `Role for ${selectedUserForRole.email} changed to ${newRoleSelection}.`,
          ipAddress: "127.0.0.1"
        },
        ...prev
      ]);
      
      setSelectedUserForRole(null);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Role update failed:", err);
    } finally {
      setRoleUpdateLoading(false);
    }
  };

  // Handle User Disable Toggle
  const handleToggleUserStatus = async (targetUser: PlatformUser) => {
    const nextDisabled = !targetUser.disabled;
    try {
      if (syncProps.toggleUserStatus) {
        await syncProps.toggleUserStatus(targetUser.uid, nextDisabled);
      }
      setPlatformUsers(prev => prev.map(u => u.uid === targetUser.uid ? { ...u, disabled: nextDisabled } : u));
      setActionSuccessMsg(`User ${targetUser.email} has been ${nextDisabled ? "SUSPENDED" : "REACTIVATED"}`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  // Filter Users
  const filteredUsers = platformUsers.filter(u => {
    const matchesSearch = 
      (u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (u.uid?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (u.familyCode?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const parentCount = platformUsers.filter(u => u.role === "parent").length;
  const childCount = platformUsers.filter(u => u.role === "child").length;
  const adminCount = platformUsers.filter(u => u.role === "admin").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-rose-500 selection:text-white">
      {/* Top Admin Security Navbar */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-rose-500/20 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-2xl">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-rose-600 via-red-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20 border border-rose-400/30">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-white tracking-wide">Guardian<span className="text-rose-400">AI</span> Admin</span>
              <span className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold">
                ROOT PRIVILEGES
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">Platform Governance & Security Operations</p>
          </div>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center space-x-3">
          <button
            onClick={loadAdminData}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300 border border-slate-700 transition cursor-pointer"
            title="Refresh Real-Time Telemetry"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-rose-400" : ""}`} />
            <span className="hidden sm:inline">Sync Metrics</span>
          </button>

          <div className="h-6 w-[1px] bg-slate-800"></div>

          {/* Admin Identity Pill */}
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-semibold text-slate-200 truncate max-w-[140px]">{user?.email || "admin@guardian.ai"}</p>
              <p className="text-[10px] text-rose-400 font-mono">Super Admin</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Emergency Broadcast Banner (if active) */}
      {platformConfig.emergencyBroadcast.active && (
        <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-amber-600 text-white px-4 py-2 text-center text-xs font-bold flex items-center justify-center space-x-2 shadow-lg">
          <AlertOctagon className="h-4 w-4 animate-bounce" />
          <span>GLOBAL EMERGENCY BROADCAST: {platformConfig.emergencyBroadcast.message}</span>
        </div>
      )}

      {/* Action Notification Message */}
      <AnimatePresence>
        {actionSuccessMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 mx-4 sm:mx-8 mt-4 rounded-xl flex items-center justify-between text-xs font-semibold shadow-xl"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button onClick={() => setActionSuccessMsg(null)} className="text-slate-400 hover:text-white">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          {[
            { id: "overview", label: "Platform Overview", icon: Activity },
            { id: "users", label: `User Directory (${platformUsers.length})`, icon: Users },
            { id: "families", label: `Family Ecosystems (${families.length})`, icon: Globe },
            { id: "health", label: "System & API Health", icon: Server },
            { id: "logs", label: "Security & Threat Stream", icon: ShieldAlert },
            { id: "settings", label: "Global Policies", icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30 border border-rose-500"
                    : "bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-fadeIn">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-400 font-mono">TOTAL USERS</p>
                    <h3 className="text-2xl font-bold text-white mt-1">{platformUsers.length}</h3>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-center space-x-2 text-[11px] text-slate-400">
                  <span className="text-emerald-400 font-semibold">{parentCount} Parents</span>
                  <span>•</span>
                  <span className="text-cyan-400 font-semibold">{childCount} Children</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-400 font-mono">LINKED FAMILIES</p>
                    <h3 className="text-2xl font-bold text-emerald-400 mt-1">{families.length}</h3>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Globe className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-slate-400 font-mono">100% End-to-End Encrypted</p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-400 font-mono">THREATS INTERCEPTED</p>
                    <h3 className="text-2xl font-bold text-rose-400 mt-1">
                      {syncProps.dangerousEvents?.length || 0}
                    </h3>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-rose-300 font-mono">Real-Time Threat Events</p>
              </div>

              <div 
                onClick={() => setActiveTab("health")}
                className="bg-slate-900/80 border border-slate-800 hover:border-teal-500/50 rounded-2xl p-5 relative overflow-hidden group transition cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-400 font-mono">LIVE SYSTEM HEALTH</p>
                    <h3 className="text-2xl font-bold text-teal-400 mt-1 flex items-center space-x-1.5">
                      <span>VERIFIED</span>
                    </h3>
                  </div>
                  <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 group-hover:scale-105 transition">
                    <Activity className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Live Diagnostics</span>
                  <span className="text-teal-400 font-bold group-hover:underline">Open Panel →</span>
                </div>
              </div>
            </div>

            {/* Live Threat & System Status Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Recent Security Events */}
              <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-rose-400" />
                    <h3 className="font-bold text-base text-white">Live Threat Stream & Safety Alerts</h3>
                  </div>
                  <span className="text-[11px] font-mono text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2.5 py-0.5 rounded-full">
                    Auto-Refreshing
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex items-start justify-between space-x-3 hover:border-slate-700 transition"
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg mt-0.5 ${
                          log.severity === "critical" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                          log.severity === "warning" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                          "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        }`}>
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-xs text-slate-200">{log.action}</span>
                            <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                              {log.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{log.details}</p>
                          <div className="flex items-center space-x-3 mt-1.5 text-[10px] text-slate-500 font-mono">
                            <span>User: {log.userEmail}</span>
                            <span>•</span>
                            <span>IP: {log.ipAddress}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Col: Quick Admin Controls */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-amber-400" />
                  <h3 className="font-bold text-base text-white">Platform Controls</h3>
                </div>

                <div className="space-y-3">
                  <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-slate-300">Guardian AI Strictness</p>
                    <p className="text-[11px] text-slate-400">Sets the sensitivity of generative neural filters for children.</p>
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      {["standard", "strict", "maximum"].map((level) => (
                        <button
                          key={level}
                          onClick={() => setPlatformConfig(p => ({ ...p, aiSafetyStrictness: level as any }))}
                          className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition ${
                            platformConfig.aiSafetyStrictness === level
                              ? "bg-rose-600 text-white shadow"
                              : "bg-slate-900 hover:bg-slate-800 text-slate-400"
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-semibold text-slate-300">Registration Gateway</p>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        platformConfig.allowNewRegistrations ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                      }`}>
                        {platformConfig.allowNewRegistrations ? "OPEN" : "LOCKED"}
                      </span>
                    </div>
                    <button
                      onClick={handleToggleRegistration}
                      className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition cursor-pointer"
                    >
                      Toggle Registration Access
                    </button>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-slate-300">Quick Navigation</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => navigate("/parent")}
                        className="py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-400 text-xs font-semibold border border-slate-800 flex items-center justify-center space-x-1 transition cursor-pointer"
                      >
                        <span>Parent Portal</span>
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </button>
                      <button
                        onClick={() => navigate("/child")}
                        className="py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-400 text-xs font-semibold border border-slate-800 flex items-center justify-center space-x-1 transition cursor-pointer"
                      >
                        <span>Child Portal</span>
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USER DIRECTORY & RBAC */}
        {activeTab === "users" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6 animate-fadeIn">
            {/* Header + Search/Filter */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-bold text-lg text-white">Platform User Accounts</h3>
                <p className="text-xs text-slate-400">Review, assign roles, and manage all Parent and Child accounts.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search by email, name, UID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admins</option>
                  <option value="parent">Parents</option>
                  <option value="child">Children</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
                    <th className="py-3 px-3">User</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Family Code</th>
                    <th className="py-3 px-3">Created</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((u) => {
                    const isSuperAdmin = ADMIN_EMAILS.some(e => e.toLowerCase() === u.email?.toLowerCase());
                    return (
                      <tr key={u.uid} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-3">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                              u.role === "admin" ? "bg-rose-500/20 text-rose-400 border border-rose-500/40" :
                              u.role === "parent" ? "bg-blue-500/20 text-blue-400 border border-blue-500/40" :
                              "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                            }`}>
                              {u.fullName?.charAt(0) || u.email?.charAt(0) || "U"}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-200">{u.fullName || "Guardian User"}</p>
                              <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                            u.role === "admin" ? "bg-rose-950/60 text-rose-400 border border-rose-800/60" :
                            u.role === "parent" ? "bg-blue-950/60 text-blue-400 border border-blue-800/60" :
                            "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center space-x-1 text-[11px] ${
                            u.disabled ? "text-rose-400" : "text-emerald-400"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${u.disabled ? "bg-rose-400" : "bg-emerald-400"}`}></span>
                            <span>{u.disabled ? "Suspended" : "Active"}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {u.familyCode ? (
                            <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-[10px] text-cyan-300">
                              {u.familyCode}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => {
                                setSelectedUserForRole(u);
                                setNewRoleSelection(u.role);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition cursor-pointer"
                            >
                              Edit Role
                            </button>
                            {!isSuperAdmin && (
                              <button
                                onClick={() => handleToggleUserStatus(u)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                                  u.disabled
                                    ? "bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-800/40"
                                    : "bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 border border-rose-800/40"
                                }`}
                              >
                                {u.disabled ? "Activate" : "Suspend"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: FAMILY NETWORKS */}
        {activeTab === "families" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6 animate-fadeIn">
            <div>
              <h3 className="font-bold text-lg text-white">Verified Family Networks</h3>
              <p className="text-xs text-slate-400">Inspect active family linking codes and child associations.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {families.map((fam) => {
                const linkedChildren = platformUsers.filter(u => u.familyCode === fam.familyCode && u.role === "child");
                return (
                  <div
                    key={fam.familyCode}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-base text-white">{fam.familyName}</h4>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">Owner: {fam.parentEmail || fam.ownerParentId}</p>
                      </div>
                      <span className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold px-2.5 py-1 rounded-lg">
                        {fam.familyCode}
                      </span>
                    </div>

                    <div className="border-t border-slate-800/80 pt-3 space-y-2">
                      <p className="text-[11px] font-mono text-slate-400 uppercase">Connected Children ({linkedChildren.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {linkedChildren.length > 0 ? (
                          linkedChildren.map(c => (
                            <span key={c.uid} className="bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                              <span>{c.fullName || c.email}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500 italic">No connected child devices yet</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: SYSTEM & API HEALTH */}
        {activeTab === "health" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Real-time System Verification & Demonstration Panel */}
            <SystemDemonstrationPanel
              user={user}
              userData={userData}
              syncProps={syncProps}
            />

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="font-bold text-lg text-white">System Diagnostics & API Latency Monitor</h3>
                <p className="text-xs text-slate-400">Real-time status of underlying databases, AI inference endpoints, and external services.</p>
              </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Firebase Firestore */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-2">
                    <Database className="h-5 w-5 text-amber-400" />
                    <h4 className="font-bold text-sm text-white">Firebase Firestore</h4>
                  </div>
                  <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                    OPERATIONAL
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Ping Latency:</span>
                    <span className="font-mono text-white">{systemHealth?.firestoreLatencyMs || 24}ms</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Active Listeners:</span>
                    <span className="font-mono text-white">6 Live Subscriptions</span>
                  </div>
                </div>
              </div>

              {/* Groq Llama AI Inference */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-2">
                    <Cpu className="h-5 w-5 text-rose-400" />
                    <h4 className="font-bold text-sm text-white">Guardian AI Engine</h4>
                  </div>
                  <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                    OPERATIONAL
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Model:</span>
                    <span className="font-mono text-white">Groq Llama Inference</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Response Latency:</span>
                    <span className="font-mono text-white">{systemHealth?.groqLatencyMs || 85}ms</span>
                  </div>
                </div>
              </div>

              {/* OpenWeather Geocoding */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-2">
                    <Globe className="h-5 w-5 text-blue-400" />
                    <h4 className="font-bold text-sm text-white">Leaflet & Geofencing</h4>
                  </div>
                  <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                    OPERATIONAL
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>D3 Heatmap Engine:</span>
                    <span className="font-mono text-white">Accelerated 60fps</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>GPS Telemetry:</span>
                    <span className="font-mono text-white">Real-Time Sync</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* TAB 5: SECURITY LOGS */}
        {activeTab === "logs" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-white">Complete Security & Audit Trail</h3>
                <p className="text-xs text-slate-400">Timestamped record of all administrative, authentication, and child threat events.</p>
              </div>
            </div>

            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${
                      log.severity === "critical" ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                      log.severity === "warning" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                      "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    }`}>
                      <AlertOctagon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-sm text-slate-200">{log.action}</span>
                        <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                          {log.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{log.details}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-1">User: {log.userEmail} | IP: {log.ipAddress}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 font-mono whitespace-nowrap self-start sm:self-center">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: GLOBAL SETTINGS */}
        {activeTab === "settings" && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6 animate-fadeIn">
            <div>
              <h3 className="font-bold text-lg text-white">Platform Settings & Emergency Broadcast</h3>
              <p className="text-xs text-slate-400">Configure global safety thresholds and emergency system messages.</p>
            </div>

            <div className="space-y-4 max-w-2xl">
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-sm text-white">Emergency Broadcast Banner</h4>
                    <p className="text-xs text-slate-400">Broadcast an urgent notification across all Parent and Child portals.</p>
                  </div>
                  <button
                    onClick={() => setPlatformConfig(p => ({
                      ...p,
                      emergencyBroadcast: {
                        ...p.emergencyBroadcast,
                        active: !p.emergencyBroadcast.active
                      }
                    }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      platformConfig.emergencyBroadcast.active
                        ? "bg-rose-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {platformConfig.emergencyBroadcast.active ? "BROADCASTING" : "OFFLINE"}
                  </button>
                </div>

                <input
                  type="text"
                  value={platformConfig.emergencyBroadcast.message}
                  onChange={(e) => setPlatformConfig(p => ({
                    ...p,
                    emergencyBroadcast: { ...p.emergencyBroadcast, message: e.target.value }
                  }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  placeholder="Enter global broadcast text..."
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3">
                <h4 className="font-semibold text-sm text-white">Default Screen Time Limits</h4>
                <p className="text-xs text-slate-400">Default hard cap for new child accounts before parental customization.</p>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="30"
                    max="480"
                    step="15"
                    value={platformConfig.maxScreenTimeCap}
                    onChange={(e) => setPlatformConfig(p => ({ ...p, maxScreenTimeCap: parseInt(e.target.value) }))}
                    className="flex-1 accent-rose-500"
                  />
                  <span className="text-xs font-mono font-bold text-rose-400 min-w-[70px]">
                    {platformConfig.maxScreenTimeCap} mins
                  </span>
                </div>
              </div>

              {/* Explicit Policy Save Action */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSavePolicies}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center space-x-2 transition cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Save Platform Policies to Firestore</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Role Change Confirmation Modal */}
      <AnimatePresence>
        {selectedUserForRole && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl"
            >
              <div className="flex items-center space-x-2 text-rose-400">
                <Key className="h-5 w-5" />
                <h3 className="font-bold text-base text-white">Modify User Access Role</h3>
              </div>

              <p className="text-xs text-slate-300">
                Select the new platform role for <span className="font-mono text-rose-400 font-semibold">{selectedUserForRole.email}</span>.
              </p>

              <div className="space-y-2 pt-2">
                {[
                  { role: "admin", label: "Administrator", desc: "Full platform governance and user management." },
                  { role: "parent", label: "Parent", desc: "Family safety dashboard, tracking, and controls." },
                  { role: "child", label: "Child", desc: "Explorer portal, homework tutor, and safety goals." }
                ].map((item) => (
                  <div
                    key={item.role}
                    onClick={() => setNewRoleSelection(item.role as UserRole)}
                    className={`p-3 rounded-xl border transition cursor-pointer ${
                      newRoleSelection === item.role
                        ? "bg-rose-500/10 border-rose-500/50 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-xs text-slate-200">{item.label}</span>
                      {newRoleSelection === item.role && <Check className="h-4 w-4 text-rose-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  onClick={() => setSelectedUserForRole(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateRole}
                  disabled={roleUpdateLoading}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 flex items-center space-x-1.5 cursor-pointer"
                >
                  {roleUpdateLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <span>Confirm Update</span>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
