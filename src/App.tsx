import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import PublicHome from "./components/PublicHome";
import Dashboard from "./components/Dashboard";
import Footer from "./components/Footer";
import CompanionSimulator from "./components/CompanionSimulator";
import GuardianAssistant from "./components/GuardianAssistant";
import ChildDashboard from "./components/ChildDashboard";
import FeatureTourModal from "./components/FeatureTourModal";
import AdminDashboard from "./components/AdminDashboard";
import AdminLogin from "./components/AdminLogin";
import ParentLogin from "./components/ParentLogin";
import ChildLogin from "./components/ChildLogin";
import DemoHub from "./components/DemoHub";
import DemoBanner from "./components/DemoBanner";
import { useDemoSync } from "./lib/createDemoSync";
import { useFirebaseSync } from "./lib/useFirebaseSync";
import { useSupabaseAuth } from "./lib/useSupabaseAuth";
import { useNavigation } from "./lib/useNavigation";
import { Shield, ShieldAlert, ArrowRight, AlertOctagon, RefreshCw, ExternalLink } from "lucide-react";

function QuotaNoticeBanner({ onCheckRecovery }: { onCheckRecovery?: () => Promise<boolean> }) {
  const [checking, setChecking] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTest = async () => {
    if (!onCheckRecovery) return;
    setChecking(true);
    setTestResult(null);
    try {
      const isRecovered = await onCheckRecovery();
      if (isRecovered) {
        setTestResult("Firestore restored! Quota has recovered successfully.");
      } else {
        setTestResult("Cloud Firestore daily quota limit remains active on free Spark tier. Quota resets daily at midnight PST.");
      }
    } catch {
      setTestResult("Check complete. Quota limits remain in effect.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <aside 
      aria-label="Cloud Service Notice"
      className="bg-amber-950/95 border-b border-amber-500/50 text-amber-100 px-4 py-3 text-xs z-50 flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg"
    >
      <div className="flex items-center space-x-2.5">
        <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300">
          <AlertOctagon className="h-4 w-4" />
        </span>
        <div>
          <span className="font-bold text-amber-200">Cloud Firestore Quota Limit Exceeded (Spark Tier):</span>{" "}
          <span className="text-amber-300/90">
            Realtime listener sync is temporarily paused to avoid repeated retries. Cached data is still available.
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleTest}
          disabled={checking}
          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold text-xs flex items-center space-x-1.5 transition disabled:opacity-50 cursor-pointer shadow"
        >
          <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} />
          <span>{checking ? "Testing..." : "Check Quota Recovery"}</span>
        </button>
        <a
          href="https://console.firebase.google.com/project/guardian-ai-platform/firestore/databases/ai-studio-guardianaichilds-430f098e-ea46-4433-895a-6c863fa268fb/data?openUpgradeDialog=true"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-amber-900/60 hover:bg-amber-800/80 border border-amber-600/40 text-amber-200 rounded-lg font-semibold text-xs flex items-center space-x-1 transition"
        >
          <span>Upgrade in Console</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      {testResult && (
        <div className="w-full text-center text-[11px] text-amber-300 font-mono mt-1">
          {testResult}
        </div>
      )}
    </aside>
  );
}

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [showTourModal, setShowTourModal] = useState<boolean>(false);
  const { pathname, search, navigate } = useNavigation();

  const sync = useFirebaseSync();
  const supabaseAuth = useSupabaseAuth();

  const isSupabaseActive = supabaseAuth.isSupabaseMode;
  const user = isSupabaseActive ? supabaseAuth.user : sync.user;
  const userData = isSupabaseActive ? supabaseAuth.userData : sync.userData;
  const authLoading = isSupabaseActive ? supabaseAuth.authLoading : sync.authLoading;
  const isGuestMode = sync.isGuestMode;
  const setIsGuestMode = sync.setIsGuestMode;
  const handleLogout = isSupabaseActive ? supabaseAuth.handleLogout : sync.handleLogout;
  const loginWithEmail = isSupabaseActive ? supabaseAuth.loginWithEmail : sync.loginWithEmail;
  const registerWithEmail = isSupabaseActive ? supabaseAuth.registerWithEmail : sync.registerWithEmail;
  const resetPassword = isSupabaseActive ? supabaseAuth.resetPassword : sync.resetPassword;
  const sendVerification = isSupabaseActive ? supabaseAuth.sendVerification : undefined;

  // Active family linking methods and state
  const familyData = isSupabaseActive ? (supabaseAuth.familyData || sync.familyData) : sync.familyData;
  const pendingRequests = isSupabaseActive ? supabaseAuth.pendingRequests : sync.pendingRequests;
  const childFamilyRequest = isSupabaseActive ? (supabaseAuth.childFamilyRequest || sync.childFamilyRequest) : sync.childFamilyRequest;
  const createOrFetchFamilyCode = isSupabaseActive ? supabaseAuth.createOrFetchFamilyCode : sync.createOrFetchFamilyCode;
  const joinFamilyByCode = isSupabaseActive ? supabaseAuth.joinFamilyByCode : sync.joinFamilyByCode;
  const acceptFamilyRequest = isSupabaseActive ? supabaseAuth.acceptFamilyRequest : sync.acceptFamilyRequest;
  const rejectFamilyRequest = isSupabaseActive ? supabaseAuth.rejectFamilyRequest : sync.rejectFamilyRequest;
  const removeChildFromFamily = isSupabaseActive ? supabaseAuth.removeChildFromFamily : sync.removeChildFromFamily;

  // Active Emergency SOS methods and state
  const sosAlerts = isSupabaseActive ? supabaseAuth.sosAlerts : sync.sosAlerts;
  const triggerSosAlert = isSupabaseActive ? supabaseAuth.triggerSosAlert : sync.triggerSosAlert;
  const resolveSosAlert = isSupabaseActive ? supabaseAuth.resolveSosAlert : sync.resolveSosAlert;
  const resolvingSosAlertId = isSupabaseActive ? supabaseAuth.resolvingSosAlertId : sync.resolvingSosAlertId;

  // Active companion devices methods and state
  const devices = isSupabaseActive ? (supabaseAuth.devices.length > 0 ? supabaseAuth.devices : sync.devices) : sync.devices;
  const registerCurrentChildDevice = isSupabaseActive ? supabaseAuth.registerCurrentChildDevice : sync.registerCurrentChildDevice;

  // Active sync bundle ensuring auth, family linking, and SOS propagate consistently to portals
  const activeSyncProps = {
    ...sync,
    user,
    userData,
    authLoading,
    handleLogout,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    sendVerification,
    familyData,
    pendingRequests,
    childFamilyRequest,
    createOrFetchFamilyCode,
    joinFamilyByCode,
    acceptFamilyRequest,
    rejectFamilyRequest,
    removeChildFromFamily,
    sosAlerts,
    triggerSosAlert,
    resolveSosAlert,
    resolvingSosAlertId,
    devices,
    registerCurrentChildDevice,
  };

  // In-memory isolated mock data sync for development preview & faculty evaluation
  const demoParentSync = useDemoSync("parent");
  const demoChildSync = useDemoSync("child");
  const demoAdminSync = useDemoSync("admin");

  // Dark mode class sync
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Smooth scrolling to landing page sections
  const scrollToSection = (id: string) => {
    if (pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 150);
    } else {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Route normalizations
  const normalizedPath = pathname.toLowerCase().replace(/\/+$/, "") || "/";
  const isDemoQuery = search.includes("demo=true") || search.includes("demo");
  const isPublicOrDemoRoute = normalizedPath === "/" || normalizedPath.startsWith("/demo") || normalizedPath.endsWith("/login") || isDemoQuery;

  // Full-screen loading screen ONLY for protected routes during initial authentication check
  if (authLoading && !isPublicOrDemoRoute) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 space-y-5 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-teal-400 text-white shadow-lg shadow-blue-500/20">
          <Shield className="h-8 w-8 animate-pulse" />
          <div className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-teal-400"></div>
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white tracking-wide">
            Verifying Guardian Security Session...
          </h3>
          <p className="text-xs font-mono text-slate-400">
            Checking Guardian security credentials & telemetry session
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => navigate("/demo")}
            className="px-4 py-2 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 text-xs font-bold transition cursor-pointer shadow-md"
          >
            Explore Demo Sandbox (No Login)
          </button>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium transition cursor-pointer"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  // Authoritative role from public.users database record. Never default unassigned users to parent.
  const role = userData?.role || null;
  const isAdmin = role === "admin";
  const isChild = role === "child";
  const isParent = role === "parent";

  // 0. DEVELOPMENT PREVIEW & FACULTY DEMO ROUTES (READ-ONLY, NO AUTH REQUIRED)
  if (normalizedPath === "/demo") {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950">
        <DemoBanner currentRole="hub" navigate={navigate} />
        <Navbar
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          viewMode="public"
          setViewMode={(mode) => {
            if (mode === "dashboard") navigate("/demo/parent");
            else if (mode === "companion") navigate("/parent/companion");
          }}
          scrollToSection={scrollToSection}
          user={null}
          userData={null}
          isGuestMode={false}
          onLogout={() => {}}
          navigate={navigate}
        />
        <main className="flex-1 flex flex-col">
          <DemoHub navigate={navigate} />
          <Footer />
        </main>
      </div>
    );
  }

  if (normalizedPath === "/demo/parent" || (normalizedPath === "/parent" && isDemoQuery)) {
    const requestedTab = new URLSearchParams(search).get("tab") || undefined;
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <DemoBanner currentRole="parent" navigate={navigate} />
        <Navbar
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          viewMode="dashboard"
          setViewMode={(mode) => {
            if (mode === "public") navigate("/");
            else if (mode === "companion") navigate("/parent/companion");
          }}
          scrollToSection={scrollToSection}
          user={demoParentSync.user}
          userData={demoParentSync.userData}
          isGuestMode={false}
          pendingNotificationCount={demoParentSync.pendingRequests?.length || 0}
          onLogout={() => navigate("/demo")}
          onOpenTour={() => setShowTourModal(true)}
          navigate={navigate}
        />
        <main className="flex-1 flex flex-col">
          <Dashboard syncProps={demoParentSync} activeTabFromUrl={requestedTab} />
        </main>
        <GuardianAssistant viewMode="dashboard" />
        <FeatureTourModal isOpen={showTourModal} onClose={() => setShowTourModal(false)} />
      </div>
    );
  }

  if (normalizedPath === "/demo/child" || (normalizedPath === "/child" && isDemoQuery)) {
    const requestedChildTab = new URLSearchParams(search).get("tab") || undefined;
    return (
      <div className="min-h-screen flex flex-col bg-slate-950">
        <DemoBanner currentRole="child" navigate={navigate} />
        <ChildDashboard
          user={demoChildSync.user}
          userData={demoChildSync.userData}
          onLogout={() => navigate("/demo")}
          viewMode="dashboard"
          setViewMode={(mode) => {
            if (mode === "public") navigate("/");
          }}
          activeTabFromUrl={requestedChildTab}
          familyData={demoChildSync.familyData}
          childFamilyRequest={demoChildSync.childFamilyRequest}
          joinFamilyByCode={demoChildSync.joinFamilyByCode}
          triggerSosAlert={demoChildSync.triggerSosAlert}
          sosAlerts={demoChildSync.sosAlerts}
          homeworkList={demoChildSync.homeworkList}
          addHomeworkTask={demoChildSync.addHomeworkTask}
          toggleHomeworkTask={demoChildSync.toggleHomeworkTask}
          deleteHomeworkTask={demoChildSync.deleteHomeworkTask}
          dailyGoalsList={demoChildSync.dailyGoalsList}
          addDailyGoal={demoChildSync.addDailyGoal}
          toggleDailyGoal={demoChildSync.toggleDailyGoal}
          updateDailyGoalProgress={demoChildSync.updateDailyGoalProgress}
          deleteDailyGoal={demoChildSync.deleteDailyGoal}
          registerCurrentChildDevice={demoChildSync.registerCurrentChildDevice}
        />
      </div>
    );
  }

  if (normalizedPath === "/demo/admin" || (normalizedPath === "/admin" && isDemoQuery)) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950">
        <DemoBanner currentRole="admin" navigate={navigate} />
        <AdminDashboard
          user={demoAdminSync.user}
          userData={demoAdminSync.userData}
          onLogout={() => navigate("/demo")}
          navigate={navigate}
          syncProps={demoAdminSync}
        />
      </div>
    );
  }

  // 1. ADMIN PORTAL
  if (normalizedPath === "/admin/login") {
    return (
      <AdminLogin
        loginWithEmail={loginWithEmail}
        registerWithEmail={registerWithEmail}
        resetPassword={resetPassword}
        sendVerification={sendVerification}
        user={user}
        userData={userData}
        navigate={navigate}
      />
    );
  }

  if (normalizedPath === "/admin") {
    // If not signed in as admin, redirect to admin login
    if (!user) {
      return (
        <AdminLogin
          loginWithEmail={loginWithEmail}
          registerWithEmail={registerWithEmail}
          resetPassword={resetPassword}
          sendVerification={sendVerification}
          user={user}
          userData={userData}
          navigate={navigate}
        />
      );
    }

    if (user && userData?.disabled) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 text-center">
          <div className="max-w-md bg-slate-900 border border-rose-500/30 rounded-3xl p-8 space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white font-display">Account Disabled</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              This administrator account has been disabled.
            </p>
            <button
              onClick={() => {
                handleLogout();
                navigate("/admin/login");
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      );
    }

    if (!isAdmin) {
      return (
        <AdminLogin
          loginWithEmail={loginWithEmail}
          registerWithEmail={registerWithEmail}
          resetPassword={resetPassword}
          sendVerification={sendVerification}
          user={user}
          userData={userData}
          navigate={navigate}
        />
      );
    }

    return (
      <div className="min-h-screen flex flex-col bg-slate-950">
        {sync.isQuotaExhausted && <QuotaNoticeBanner onCheckRecovery={sync.checkQuotaRecovery} />}
        <AdminDashboard
          user={user}
          userData={userData}
          onLogout={() => {
            handleLogout();
            navigate("/admin/login");
          }}
          navigate={navigate}
          syncProps={activeSyncProps}
        />
      </div>
    );
  }

  // 2. CHILD PORTAL
  if (normalizedPath === "/child/login") {
    return (
      <ChildLogin
        loginWithEmail={loginWithEmail}
        registerWithEmail={registerWithEmail}
        resetPassword={resetPassword}
        sendVerification={sendVerification}
        user={user}
        userData={userData}
        navigate={navigate}
      />
    );
  }

  if (normalizedPath === "/child") {
    if (!user) {
      return (
        <ChildLogin
          loginWithEmail={loginWithEmail}
          registerWithEmail={registerWithEmail}
          resetPassword={resetPassword}
          sendVerification={sendVerification}
          user={user}
          userData={userData}
          navigate={navigate}
        />
      );
    }

    if (user && userData?.disabled) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 text-center">
          <div className="max-w-md bg-slate-900 border border-rose-500/30 rounded-3xl p-8 space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white font-display">Account Disabled</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              This explorer account has been disabled. Please contact your parent or platform administrator.
            </p>
            <button
              onClick={() => {
                handleLogout();
                navigate("/child/login");
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      );
    }

    // Role check: Reject parent accounts from accessing Child Portal as child users
    if (userData?.role === "parent") {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100 selection:bg-amber-500 selection:text-slate-950">
          <div className="w-full max-w-md bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl backdrop-blur-xl">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">Child Portal Restricted</h2>
              <p className="text-xs text-slate-400 mt-1">Role Separation Policy Enforced</p>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
              This account (<strong className="text-white">{user.email}</strong>) is registered as a <strong className="text-amber-400">PARENT</strong>. The Child Explorer Portal is strictly reserved for child devices and student accounts.
            </p>
            <div className="pt-2 flex flex-col gap-2.5">
              <button
                onClick={() => navigate("/parent")}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2"
              >
                <span>Go to Parent Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  handleLogout();
                  navigate("/child/login");
                }}
                className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition cursor-pointer"
              >
                Sign In with Child Account
              </button>
            </div>
          </div>
        </div>
      );
    }

    const requestedChildTab = new URLSearchParams(search).get("tab") || undefined;

    return (
      <div className="min-h-screen flex flex-col bg-slate-950">
        {sync.isQuotaExhausted && <QuotaNoticeBanner onCheckRecovery={sync.checkQuotaRecovery} />}
        {userData?.role === "admin" && (
          <div className="bg-blue-950/80 border-b border-blue-800/60 px-4 py-2 text-xs text-blue-300 flex items-center justify-between z-20">
            <span>Admin Mode: You are previewing the Child Portal.</span>
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/admin")}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-[11px] transition cursor-pointer"
              >
                Return to Admin
              </button>
              <button
                onClick={() => navigate("/parent")}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[11px] transition cursor-pointer"
              >
                Go to Parent Dashboard
              </button>
            </div>
          </div>
        )}
        <ChildDashboard
          user={user}
          userData={userData}
          onLogout={() => {
            handleLogout();
            navigate("/child/login");
          }}
          viewMode="dashboard"
          setViewMode={(mode) => {
            if (mode === "public") navigate("/");
          }}
          activeTabFromUrl={requestedChildTab}
          familyData={familyData}
          childFamilyRequest={childFamilyRequest}
          joinFamilyByCode={joinFamilyByCode}
          triggerSosAlert={triggerSosAlert}
          sosAlerts={sosAlerts}
          homeworkList={sync.homeworkList}
          addHomeworkTask={sync.addHomeworkTask}
          toggleHomeworkTask={sync.toggleHomeworkTask}
          deleteHomeworkTask={sync.deleteHomeworkTask}
          dailyGoalsList={sync.dailyGoalsList}
          addDailyGoal={sync.addDailyGoal}
          toggleDailyGoal={sync.toggleDailyGoal}
          updateDailyGoalProgress={sync.updateDailyGoalProgress}
          deleteDailyGoal={sync.deleteDailyGoal}
          registerCurrentChildDevice={registerCurrentChildDevice}
        />
      </div>
    );
  }

  // 3. PARENT PORTAL LOGIN
  if (normalizedPath === "/parent/login") {
    const returnToParam = new URLSearchParams(search).get("returnTo") || undefined;
    return (
      <ParentLogin
        loginWithEmail={loginWithEmail}
        registerWithEmail={registerWithEmail}
        resetPassword={resetPassword}
        sendVerification={sendVerification}
        user={user}
        userData={userData}
        navigate={navigate}
        returnTo={returnToParam}
      />
    );
  }

  // 4. PARENT COMPANION SIMULATOR
  if (normalizedPath === "/parent/companion") {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950">
        {sync.isQuotaExhausted && <QuotaNoticeBanner onCheckRecovery={sync.checkQuotaRecovery} />}
        <Navbar
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          viewMode="companion"
          setViewMode={(mode) => {
            if (mode === "public") navigate("/");
            else if (mode === "dashboard") navigate("/parent");
          }}
          scrollToSection={scrollToSection}
          user={user}
          userData={userData}
          isGuestMode={isGuestMode}
          onLogout={() => {
            handleLogout();
            navigate("/");
          }}
          onOpenTour={() => setShowTourModal(true)}
          navigate={navigate}
        />
        <main className="flex-1 flex flex-col">
          <CompanionSimulator onBackToDashboard={() => navigate("/parent")} />
        </main>
        <GuardianAssistant viewMode="companion" />
      </div>
    );
  }

  // 5. PARENT DASHBOARD
  if (normalizedPath === "/parent") {
    if (!user && !isGuestMode) {
      const returnTarget = `/parent${search || ""}`;
      return (
        <ParentLogin
          loginWithEmail={loginWithEmail}
          registerWithEmail={registerWithEmail}
          resetPassword={resetPassword}
          sendVerification={sendVerification}
          user={user}
          userData={userData}
          navigate={navigate}
          returnTo={returnTarget}
        />
      );
    }

    if (user && userData?.disabled) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 text-center">
          <div className="max-w-md bg-slate-900 border border-rose-500/30 rounded-3xl p-8 space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white font-display">Account Disabled</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your account has been disabled. Please contact your platform administrator for assistance.
            </p>
            <button
              onClick={() => {
                handleLogout();
                navigate("/parent/login");
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      );
    }

    // Role protection: block child accounts from parent dashboard controls
    if (user && userData?.role === "child") {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 text-center">
          <div className="max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl p-8 space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white font-display">Parent Portal Restricted</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              You are signed in as a child account. Parent dashboard controls and telemetry are restricted to authenticated parents.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => navigate("/child")}
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <span>Go to Child Portal</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  handleLogout();
                  navigate("/parent/login");
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Switch to Parent Account
              </button>
            </div>
          </div>
        </div>
      );
    }

    const requestedTab = new URLSearchParams(search).get("tab") || undefined;

    return (
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        {sync.isQuotaExhausted && <QuotaNoticeBanner onCheckRecovery={sync.checkQuotaRecovery} />}
        {userData?.role === "admin" && (
          <div className="bg-rose-950/80 border-b border-rose-800/60 px-4 py-2 text-xs text-rose-300 flex items-center justify-between z-20">
            <span>Admin Mode: You are previewing the Parent Dashboard.</span>
            <button
              onClick={() => navigate("/admin")}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-[11px] transition cursor-pointer"
            >
              Return to Admin Console
            </button>
          </div>
        )}
        <Navbar
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          viewMode="dashboard"
          setViewMode={(mode) => {
            if (mode === "public") navigate("/");
            else if (mode === "companion") navigate("/parent/companion");
          }}
          scrollToSection={scrollToSection}
          user={user}
          userData={userData}
          isGuestMode={isGuestMode}
          pendingNotificationCount={pendingRequests?.length || 0}
          onLogout={() => {
            handleLogout();
            navigate("/parent/login");
          }}
          onOpenTour={() => setShowTourModal(true)}
          navigate={navigate}
        />
        <main className="flex-1 flex flex-col">
          <Dashboard syncProps={activeSyncProps} activeTabFromUrl={requestedTab} />
        </main>
        <GuardianAssistant viewMode="dashboard" />
        <FeatureTourModal isOpen={showTourModal} onClose={() => setShowTourModal(false)} />
      </div>
    );
  }

  // 6. PUBLIC LANDING PAGE (DEFAULT / ROOT)
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 transition-colors duration-300">
      <Navbar
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        viewMode="public"
        setViewMode={(mode) => {
          if (mode === "dashboard") navigate("/parent");
          else if (mode === "companion") navigate("/parent/companion");
        }}
        scrollToSection={scrollToSection}
        user={user}
        userData={userData}
        isGuestMode={isGuestMode}
        onLogout={handleLogout}
        onOpenTour={() => setShowTourModal(true)}
        navigate={navigate}
      />
      <main className="flex-1 flex flex-col">
        <PublicHome
          user={user}
          userData={userData}
          navigate={navigate}
          setViewMode={(mode) => {
            if (mode === "dashboard") navigate("/parent");
          }}
        />
        <Footer />
      </main>
      <GuardianAssistant viewMode="public" />
      <FeatureTourModal isOpen={showTourModal} onClose={() => setShowTourModal(false)} />
    </div>
  );
}
