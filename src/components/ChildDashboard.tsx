import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Shield, LogOut, BookOpen, Star, Trophy, Clock, Lock, 
  MapPin, CheckCircle2, ChevronRight, HelpCircle, Gamepad2, 
  Sparkles, Flame, GraduationCap, Compass, AlertTriangle, AlertCircle,
  Plus, Check, Trash2, Send, Mic, MicOff, Volume2, Users, QrCode,
  KeyRound, ShieldAlert, HeartHandshake, RefreshCw, Globe, ExternalLink,
  Copy
} from "lucide-react";
import { openExternalLink, renderTextWithLinks, ensureAbsoluteUrl, copyLinkToClipboard } from "../lib/linkUtils";
import GuardianAssistant from "./GuardianAssistant";
import { HomeworkTask, DailyGoal, FamilyData, FamilyRequest, SosAlert } from "../types";
import { 
  CYBER_QUIZ_BANK, 
  CATEGORY_LABELS, 
  QuizQuestion, 
  QuizCategory 
} from "../data/cyberQuizBank";
import { 
  fetchChildQuizProgress, 
  recordQuizAnswer, 
  getNextQuizQuestion, 
  ChildQuizProgress 
} from "../lib/cyberQuizEngine";

interface ChildDashboardProps {
  user: any;
  userData: any;
  onLogout: () => void;
  viewMode: "public" | "dashboard" | "companion";
  setViewMode: (mode: "public" | "dashboard" | "companion") => void;
  activeTabFromUrl?: string;
  familyData?: FamilyData | null;
  childFamilyRequest?: FamilyRequest | null;
  joinFamilyByCode?: (code: string) => Promise<any>;
  triggerSosAlert?: (childId?: string, childName?: string, location?: any) => Promise<any>;
  sosAlerts?: SosAlert[];
  homeworkList?: HomeworkTask[];
  addHomeworkTask?: (task: Partial<HomeworkTask>) => Promise<void>;
  toggleHomeworkTask?: (id: string, completed: boolean) => Promise<void>;
  deleteHomeworkTask?: (id: string) => Promise<void>;
  dailyGoalsList?: DailyGoal[];
  addDailyGoal?: (goal: Partial<DailyGoal>) => Promise<void>;
  toggleDailyGoal?: (id: string, completed: boolean) => Promise<void>;
  updateDailyGoalProgress?: (id: string, completedMinutes: number) => Promise<void>;
  deleteDailyGoal?: (id: string) => Promise<void>;
  registerCurrentChildDevice?: (childId: string, parentId: string) => Promise<void>;
}

export default function ChildDashboard({
  user,
  userData,
  onLogout,
  viewMode,
  setViewMode,
  activeTabFromUrl,
  familyData,
  childFamilyRequest,
  joinFamilyByCode,
  triggerSosAlert,
  sosAlerts = [],
  homeworkList = [],
  addHomeworkTask,
  toggleHomeworkTask,
  deleteHomeworkTask,
  dailyGoalsList = [],
  addDailyGoal,
  toggleDailyGoal,
  updateDailyGoalProgress,
  deleteDailyGoal,
  registerCurrentChildDevice
}: ChildDashboardProps) {
  const validTabs: Array<"assistant" | "homework" | "goals" | "sos" | "settings"> = ["assistant", "homework", "goals", "sos", "settings"];

  const getInitialTab = (): "assistant" | "homework" | "goals" | "sos" | "settings" => {
    if (activeTabFromUrl && validTabs.includes(activeTabFromUrl as any)) {
      return activeTabFromUrl as any;
    }
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("tab");
      if (param && validTabs.includes(param as any)) {
        return param as any;
      }
    }
    return "assistant";
  };

  const [activeTab, setActiveTab] = useState<"assistant" | "homework" | "goals" | "sos" | "settings">(getInitialTab);

  // Sync when activeTabFromUrl prop changes
  useEffect(() => {
    if (activeTabFromUrl && validTabs.includes(activeTabFromUrl as any)) {
      setActiveTab(activeTabFromUrl as any);
    }
  }, [activeTabFromUrl]);

  // Sync on popstate
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const param = new URLSearchParams(window.location.search).get("tab");
        if (param && validTabs.includes(param as any)) {
          setActiveTab(param as any);
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Sync URL search params when activeTab changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const currentTab = params.get("tab");
      if (currentTab !== activeTab) {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", activeTab);
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    }
  }, [activeTab]);

  // Daily Goal filter state
  const [goalFilter, setGoalFilter] = useState<"all" | "learning" | "safety" | "health" | "creative" | "completed">("all");

  // Family code input state
  const [inputFamilyCode, setInputFamilyCode] = useState("");
  const [familyError, setFamilyError] = useState("");
  const [familyLoading, setFamilyLoading] = useState(false);

  // Homework modal state
  const [showHomeworkModal, setShowHomeworkModal] = useState(false);
  const [hwTitle, setHwTitle] = useState("");
  const [hwSubject, setHwSubject] = useState("Mathematics");
  const [hwDueDate, setHwDueDate] = useState("Tomorrow, 5:00 PM");
  const [hwNotes, setHwNotes] = useState("");

  // Daily goal modal state
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalCategory, setGoalCategory] = useState<"learning" | "safety" | "health" | "creative">("learning");
  const [goalTarget, setGoalTarget] = useState(30);

  // SOS state machine
  const [sosSending, setSosSending] = useState(false);
  const [sosStatus, setSosStatus] = useState<"idle" | "sending" | "sent" | "failed" | "unknown">("idle");
  const [sosSentTime, setSosSentTime] = useState<string | null>(null);
  const [sosError, setSosError] = useState<string | null>(null);
  const [sosLocationName, setSosLocationName] = useState<string>("Kondapur, Hyderabad");

  // Safe link opener state
  const [customStudyUrl, setCustomStudyUrl] = useState("");
  const [customUrlStatus, setCustomUrlStatus] = useState<{ type: "success" | "warning" | "error"; message: string } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [activeLinkCard, setActiveLinkCard] = useState<{ url: string; safeUrl: string; title: string } | null>(null);
  const [savedCustomLinks, setSavedCustomLinks] = useState<Array<{ name: string; url: string; category: string; desc: string }>>([
    { name: "Google Classroom", url: "https://classroom.google.com", category: "School Portal", desc: "Access assignments, class documents, and teacher announcements." },
    { name: "Wikipedia for Kids", url: "https://simple.wikipedia.org", category: "Reference", desc: "Simple English encyclopedia for homework research." }
  ]);

  const handleCopyLink = async (url: string) => {
    const ok = await copyLinkToClipboard(url);
    if (ok) {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2500);
    }
  };

  const handleOpenCustomLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStudyUrl.trim()) return;
    const raw = customStudyUrl.trim();
    const safeUrl = ensureAbsoluteUrl(raw);
    
    // Quick safety filter check for kids
    const lower = raw.toLowerCase();
    if (lower.includes("gambling") || lower.includes("proxy") || lower.includes("cheat-hack") || lower.includes(".xxx") || lower.includes("adult")) {
      setCustomUrlStatus({
        type: "warning",
        message: "This web link was blocked by Guardian AI Child SafeFilters."
      });
      return;
    }

    // Set active link card so child has a direct, permanent clickable link
    const displayTitle = raw.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    setActiveLinkCard({
      url: raw,
      safeUrl,
      title: displayTitle
    });

    // Also trigger open in new tab
    openExternalLink(safeUrl);
    setCustomUrlStatus({
      type: "success",
      message: `Direct link generated and opening in a new tab: ${displayTitle}`
    });
  };

  const handleAddCustomSavedLink = () => {
    if (!activeLinkCard) return;
    const exists = savedCustomLinks.some(s => s.url.toLowerCase() === activeLinkCard.safeUrl.toLowerCase());
    if (!exists) {
      setSavedCustomLinks(prev => [
        {
          name: activeLinkCard.title,
          url: activeLinkCard.safeUrl,
          category: "My Study Link",
          desc: `Saved school/learning link: ${activeLinkCard.safeUrl}`
        },
        ...prev
      ]);
      setCustomUrlStatus({
        type: "success",
        message: `Saved "${activeLinkCard.title}" to your Safe Study Links!`
      });
    }
  };

  // Cyber-Smart Adaptive Quiz Engine State
  const effectiveChildId = user?.uid || user?.id || "guest-child";
  const [quizProgress, setQuizProgress] = useState<ChildQuizProgress | null>(null);
  const [currentQuizQuestion, setCurrentQuizQuestion] = useState<QuizQuestion | null>(null);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnsweringQuiz, setIsAnsweringQuiz] = useState(false);
  const [lastQuizResult, setLastQuizResult] = useState<{
    isCorrect: boolean;
    leveledUp: boolean;
    leveledDown: boolean;
    xpEarned: number;
  } | null>(null);

  // Optional interactive follow-up question
  const [followUpAnswered, setFollowUpAnswered] = useState(false);
  const [selectedFollowUpIdx, setSelectedFollowUpIdx] = useState<number | null>(null);

  // Load quiz progress and initial non-repeating question
  useEffect(() => {
    let mounted = true;
    async function loadQuizState() {
      try {
        const progress = await fetchChildQuizProgress(effectiveChildId);
        if (!mounted) return;
        setQuizProgress(progress);
        const nextQ = getNextQuizQuestion(progress);
        setCurrentQuizQuestion(nextQ);
        setQuizAnswered(false);
        setSelectedAnswer(null);
        setLastQuizResult(null);
        setFollowUpAnswered(false);
        setSelectedFollowUpIdx(null);
      } catch (err) {
        console.warn("[ChildDashboard] Error loading cyber quiz:", err);
      }
    }
    loadQuizState();
    return () => {
      mounted = false;
    };
  }, [effectiveChildId]);

  const handleSelectQuizOption = async (idx: number) => {
    if (quizAnswered || isAnsweringQuiz || !currentQuizQuestion || !quizProgress) return;
    setIsAnsweringQuiz(true);
    setSelectedAnswer(idx);
    setQuizAnswered(true);

    try {
      const result = await recordQuizAnswer(effectiveChildId, currentQuizQuestion, idx, quizProgress);
      const xpEarned = result.isCorrect 
        ? (currentQuizQuestion.difficulty === 3 ? 250 : currentQuizQuestion.difficulty === 2 ? 200 : 150)
        : 25;
      
      setQuizProgress(result.updatedProgress);
      setLastQuizResult({
        isCorrect: result.isCorrect,
        leveledUp: result.leveledUp,
        leveledDown: result.leveledDown,
        xpEarned
      });
    } catch (e) {
      console.warn("Error recording quiz answer:", e);
    } finally {
      setIsAnsweringQuiz(false);
    }
  };

  const handleNextQuizQuestion = () => {
    if (!quizProgress) return;
    const nextQ = getNextQuizQuestion(quizProgress, currentQuizQuestion?.id);
    setCurrentQuizQuestion(nextQ);
    setQuizAnswered(false);
    setSelectedAnswer(null);
    setLastQuizResult(null);
    setFollowUpAnswered(false);
    setSelectedFollowUpIdx(null);
  };

  const childName = userData?.fullName || user?.displayName || "Young Champion";
  const isDisconnected = Boolean(userData?.familyDisconnected) || userData?.status === "disconnected";
  // A child is approved if their user document is linked to a parent, OR their family request was accepted/approved, or in guest mode (and not disconnected)
  const isApproved = !user || (!isDisconnected && (Boolean(userData?.parentId) || childFamilyRequest?.status === "accepted" || childFamilyRequest?.status === "approved"));

  // Automatically register or update this device with the child's account
  // Supports seamless device replacement when switching phones (Guarded against re-render churn)
  const hasRegisteredDeviceRef = React.useRef<string>("");
  React.useEffect(() => {
    if (user && userData?.parentId && !isDisconnected && registerCurrentChildDevice) {
      const regKey = `${user.uid}_${userData.parentId}`;
      if (hasRegisteredDeviceRef.current !== regKey) {
        hasRegisteredDeviceRef.current = regKey;
        registerCurrentChildDevice(user.uid, userData.parentId);
      }
    }
  }, [user?.uid, userData?.parentId, isDisconnected, registerCurrentChildDevice]);

  // Submit Family Code
  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputFamilyCode.trim()) return;
    setFamilyError("");
    setFamilyLoading(true);
    try {
      if (joinFamilyByCode) {
        await joinFamilyByCode(inputFamilyCode);
      }
    } catch (err: any) {
      setFamilyError(err.message || "Failed to join family. Please verify family code.");
    } finally {
      setFamilyLoading(false);
    }
  };

  // Acquire GPS coordinates with bounded 3000ms timeout
  const acquireGpsCoordinates = (): Promise<{ lat: number; lng: number; name: string }> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !navigator.geolocation) {
        resolve({ lat: 17.4849, lng: 78.3907, name: "Kondapur, Hyderabad (GPS approximate)" });
        return;
      }

      // Hard timeout fallback
      const timer = setTimeout(() => {
        resolve({ lat: 17.4849, lng: 78.3907, name: "Kondapur Safe Perimeter, Hyderabad (GPS timeout fallback)" });
      }, 3000);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            name: `Live Coordinates (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`
          });
        },
        (err) => {
          clearTimeout(timer);
          console.warn("[ChildDashboard] Geolocation notice:", err.message);
          resolve({ lat: 17.4849, lng: 78.3907, name: "Kondapur, Hyderabad (Safe Zone approximate)" });
        },
        { timeout: 2800, enableHighAccuracy: false, maximumAge: 60000 }
      );
    });
  };

  // Trigger Emergency SOS with duplicate prevention & try/catch/finally
  const handleTriggerSos = async () => {
    // 1. Prevent duplicate simultaneous clicks
    if (sosSending) return;

    setSosSending(true);
    setSosStatus("sending");
    setSosError(null);

    try {
      // 2. Acquire GPS location safely
      const coords = await acquireGpsCoordinates();
      setSosLocationName(coords.name);

      if (triggerSosAlert) {
        // Authoritative child identity
        const resolvedName = userData?.fullName || user?.displayName || (user?.email ? user.email.split('@')[0] : "") || childName || "Child Explorer";
        await triggerSosAlert(user?.uid, resolvedName, coords);
      }

      // 3. Confirm persistence only after promise resolves
      setSosStatus("sent");
      setSosSentTime(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error("[ChildDashboard] SOS Trigger Error:", err);
      const isQuota = err?.message?.includes("Quota exceeded") || err?.code === "resource-exhausted" || err?.message?.includes("quota");
      setSosStatus("failed");
      if (isQuota) {
        setSosError(err.message || "Cloud Firestore quota exceeded on free Spark tier. Parents have NOT received this alert. Please call or SMS your parent immediately!");
      } else {
        setSosError(err?.message || "Failed to transmit emergency SOS distress alert. Please check your network and retry.");
      }
    } finally {
      // 4. Guaranteed reset of loading state
      setSosSending(false);
    }
  };

  const handleResetSos = () => {
    setSosStatus("idle");
    setSosError(null);
    setSosSentTime(null);
  };

  // Create Homework
  const handleAddHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hwTitle.trim()) return;
    if (addHomeworkTask) {
      await addHomeworkTask({
        title: hwTitle,
        subject: hwSubject,
        dueDate: hwDueDate,
        notes: hwNotes
      });
    }
    setHwTitle("");
    setHwNotes("");
    setShowHomeworkModal(false);
  };

  // Create Daily Goal
  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;
    if (addDailyGoal) {
      await addDailyGoal({
        title: goalTitle,
        category: goalCategory,
        targetMinutes: goalTarget
      });
    }
    setGoalTitle("");
    setShowGoalModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden font-sans">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/70 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-400 to-emerald-500 flex items-center justify-center text-slate-950 shadow-md shadow-teal-400/20">
            <Shield className="h-5.5 w-5.5" />
          </div>
          <div>
            <span className="font-display font-black text-lg tracking-tight text-white flex items-center gap-1.5">
              Guardian<span className="text-teal-400">Child</span> 
              <span className="text-[10px] uppercase font-mono bg-teal-500/20 text-teal-300 px-2.5 py-0.5 rounded-full border border-teal-500/30 font-semibold">
                {userData?.familyCode ? `Family: ${userData.familyCode}` : "Child Portal"}
              </span>
            </span>
            <p className="text-[9px] font-mono text-slate-400 tracking-wider">PROTECTED BY GUARDIAN AI PLATFORM</p>
          </div>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-200">{childName}</span>
            <span className="text-[9px] font-mono text-teal-400">LEVEL 4 CYBER EXPLORER</span>
          </div>
          <div className="h-9 w-9 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center font-display font-black text-teal-300 shadow-inner">
            {childName.charAt(0).toUpperCase()}
          </div>
          <button
            onClick={onLogout}
            className="p-2 bg-slate-800 hover:bg-rose-950/40 hover:border-rose-800/30 border border-slate-700/80 rounded-xl transition text-slate-400 hover:text-rose-400 cursor-pointer"
            title="Sign Out Securely"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6 relative z-10">

        {/* GATEWAY: If child is not connected to a family or pending approval */}
        {user && !isApproved && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900/90 border border-teal-500/30 rounded-3xl p-6 sm:p-8 max-w-2xl mx-auto shadow-2xl relative overflow-hidden space-y-6 text-center"
          >
            <div className="h-16 w-16 bg-teal-500/20 text-teal-400 rounded-2xl flex items-center justify-center mx-auto border border-teal-500/30 shadow-inner">
              <Users className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white font-display">Connect to Your Family</h2>
              <p className="text-slate-400 text-xs leading-relaxed max-w-md mx-auto">
                Ask your parent for your unique 6-character Family Code or scan the QR code from their Guardian Parent Dashboard to get started.
              </p>
            </div>

            {/* Real-time Notice when family connection has ended */}
            {isDisconnected && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="p-5 bg-rose-500/15 border-2 border-rose-500/40 rounded-2xl space-y-2 text-left shadow-xl"
              >
                <div className="inline-flex items-center gap-2 text-rose-400 font-bold text-xs uppercase font-mono tracking-wider">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Connection Status Notice</span>
                </div>
                <h3 className="text-base font-bold text-white">Your family connection has ended.</h3>
                <p className="text-slate-300 text-xs leading-relaxed">
                  {userData?.disconnectedMessage || "This child account has been disconnected from the family safety network by your parent."}
                  {" "}Your Guardian AI account, homework tasks, and learning achievements remain completely safe and intact.
                </p>
                <p className="text-slate-400 text-[11px] font-mono">
                  To join a new family network or reconnect with a new family code, enter the code below.
                </p>
              </motion.div>
            )}

            {/* Pending or Rejected Request Banner */}
            {childFamilyRequest && childFamilyRequest.status === "pending" ? (
              <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
                <div className="inline-flex items-center gap-2 text-amber-400 font-bold text-xs uppercase font-mono tracking-wider">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Waiting for Parent Approval</span>
                </div>
                <p className="text-slate-300 text-xs">
                  Your request for Family Code <strong className="text-white font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{childFamilyRequest.familyCode}</strong> has been sent! Your parent needs to approve the connection from their dashboard.
                </p>
                <div className="text-[10px] text-slate-500 font-mono">
                  This screen will update automatically as soon as your parent approves.
                </div>
              </div>
            ) : childFamilyRequest && childFamilyRequest.status === "rejected" ? (
              <div className="p-5 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-3 text-left">
                <div className="inline-flex items-center gap-2 text-rose-400 font-bold text-xs uppercase font-mono tracking-wider">
                  <AlertCircle className="h-4 w-4" />
                  <span>Connection Request Not Approved</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Your parent declined the connection request for Family Code <strong className="text-white font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{childFamilyRequest.familyCode}</strong>. Please check the code with your parent and try again.
                </p>
                <button 
                  type="button"
                  onClick={() => {
                    setInputFamilyCode("");
                    setFamilyError("");
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 font-mono text-xs rounded-xl font-bold transition cursor-pointer"
                >
                  Enter Different Family Code
                </button>
              </div>
            ) : (
              <form onSubmit={handleJoinFamily} className="space-y-4 max-w-md mx-auto">
                <div className="space-y-1 text-left">
                  <label className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider">Enter 6-Character Family Code</label>
                  <div className="relative">
                    <input 
                      type="text"
                      maxLength={6}
                      value={inputFamilyCode}
                      onChange={(e) => setInputFamilyCode(e.target.value.toUpperCase())}
                      placeholder="e.g. 6-CHAR CODE"
                      className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3.5 text-center text-xl font-mono font-bold tracking-widest text-teal-300 focus:outline-none focus:border-teal-400 uppercase"
                    />
                    <KeyRound className="absolute right-4 top-4 h-5 w-5 text-slate-600" />
                  </div>
                </div>

                {familyError && (
                  <p className="text-xs text-rose-400 font-semibold">{familyError}</p>
                )}

                <button
                  type="submit"
                  disabled={familyLoading || inputFamilyCode.length < 4}
                  className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black rounded-2xl text-sm transition shadow-lg shadow-teal-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {familyLoading ? "Connecting..." : "Send Connection Request"}
                </button>
              </form>
            )}
          </motion.div>
        )}

        {/* MAIN DASHBOARD CONTENT (Unlocked when approved) */}
        {isApproved && (
          <>
            {/* Connection Accepted Toast / Alert */}
            {childFamilyRequest && (childFamilyRequest.status === "accepted" || childFamilyRequest.status === "approved") && (
              <motion.div 
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-emerald-400 text-xs font-mono shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="font-bold">Your family connection was accepted! Guardian AI family protection is active.</span>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800">
                  Node: {childFamilyRequest.familyCode}
                </span>
              </motion.div>
            )}

            {/* Top Navigation Tabs */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 border-b border-slate-800/80">
              <button
                onClick={() => setActiveTab("assistant")}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === "assistant" 
                    ? "bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20" 
                    : "bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                <span>Guardian AI Assistant</span>
              </button>

              <button
                onClick={() => setActiveTab("homework")}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === "homework" 
                    ? "bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20" 
                    : "bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>Homework Helper</span>
                {homeworkList.filter(t => !t.completed).length > 0 && (
                  <span className="bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-full text-[9px] font-mono">
                    {homeworkList.filter(t => !t.completed).length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("goals")}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                  activeTab === "goals" 
                    ? "bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20" 
                    : "bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <GraduationCap className="h-4 w-4" />
                <span>Learning Hub & Goals</span>
              </button>

              <button
                onClick={() => setActiveTab("sos")}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap relative ${
                  activeTab === "sos" 
                    ? "bg-rose-600 text-white shadow-lg shadow-rose-600/40 ring-2 ring-rose-500/50" 
                    : "bg-slate-900/80 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 border border-rose-800/40"
                }`}
              >
                <AlertTriangle className="h-4 w-4 text-rose-400 animate-pulse" />
                <span>Emergency SOS</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              </button>
            </div>

            {/* TAB 1: GUARDIAN AI ASSISTANT */}
            {activeTab === "assistant" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 space-y-6">
                  <div className="bg-gradient-to-r from-slate-900 to-teal-950/40 border border-slate-800 rounded-3xl p-6 relative overflow-hidden">
                    <div className="absolute right-4 top-4 text-teal-400/10 pointer-events-none">
                      <Compass className="h-32 w-32 rotate-12" />
                    </div>
                    
                    <div className="space-y-2 relative z-10">
                      <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-xs text-teal-300 font-semibold">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Welcome back, {childName}!</span>
                      </div>
                      <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-display">
                        Your Digital AI Partner is <span className="text-teal-400 underline decoration-teal-400/30">Ready!</span>
                      </h1>
                      <p className="text-slate-400 text-xs leading-relaxed max-w-xl">
                        Ask Guardian AI anything — from solving math equations step-by-step, explaining science concepts, to learning cyber safety rules!
                      </p>
                    </div>
                  </div>

                  {/* Daily Cyber Safety Adaptive Quiz */}
                  <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-3xl p-5 space-y-4">
                    {currentQuizQuestion ? (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/80 pb-3 gap-2">
                          <div className="flex items-center space-x-2">
                            <Gamepad2 className="h-5 w-5 text-teal-400" />
                            <div>
                              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-300">
                                Cyber-Smart Challenge
                              </h3>
                              <span className="text-[10px] text-teal-400/90 font-mono">
                                {CATEGORY_LABELS[currentQuizQuestion.category] || "Online Safety"}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Difficulty Level Badge */}
                            <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border font-bold ${
                              currentQuizQuestion.difficulty === 3
                                ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                : currentQuizQuestion.difficulty === 2
                                ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                                : "bg-teal-500/15 text-teal-300 border-teal-500/30"
                            }`}>
                              Level {currentQuizQuestion.difficulty}: {
                                currentQuizQuestion.difficulty === 3 ? "Advanced" :
                                currentQuizQuestion.difficulty === 2 ? "Intermediate" : "Beginner"
                              }
                            </span>

                            {/* XP Reward Badge */}
                            <span className="text-[10px] font-mono bg-teal-500/15 text-teal-400 px-2.5 py-0.5 rounded-full border border-teal-500/25 font-bold">
                              +{currentQuizQuestion.difficulty === 3 ? 250 : currentQuizQuestion.difficulty === 2 ? 200 : 150} XP
                            </span>

                            {/* Streak Pill */}
                            {(quizProgress?.streak || 0) > 0 && (
                              <span className="text-[10px] font-mono bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/25 flex items-center gap-1 font-bold">
                                <Flame className="h-3 w-3 text-amber-400" />
                                {quizProgress?.streak} Streak
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Question and Real-World Context */}
                        <div className="space-y-3.5">
                          {currentQuizQuestion.scenario && (
                            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-300 italic flex items-start gap-2">
                              <HelpCircle className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
                              <p><span className="font-semibold text-teal-300">Scenario:</span> {currentQuizQuestion.scenario}</p>
                            </div>
                          )}

                          <p className="text-xs font-semibold text-white leading-relaxed">
                            {currentQuizQuestion.question}
                          </p>

                          {/* Options List */}
                          <div className="space-y-2">
                            {currentQuizQuestion.options.map((option, idx) => {
                              let btnStyle = "border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/30 text-slate-300";
                              if (quizAnswered) {
                                if (option.isCorrect) {
                                  btnStyle = "bg-emerald-500/15 border-emerald-500 text-emerald-300 font-bold shadow-md shadow-emerald-500/10";
                                } else if (selectedAnswer === idx) {
                                  btnStyle = "bg-rose-500/15 border-rose-500 text-rose-300 font-bold shadow-md shadow-rose-500/10";
                                } else {
                                  btnStyle = "border-slate-800/60 opacity-40 bg-slate-950/20 text-slate-500";
                                }
                              }

                              return (
                                <button
                                  key={idx}
                                  onClick={() => handleSelectQuizOption(idx)}
                                  disabled={quizAnswered || isAnsweringQuiz}
                                  className={`w-full text-left p-3.5 rounded-2xl text-xs font-medium border flex items-start gap-3 transition cursor-pointer ${btnStyle}`}
                                >
                                  <span className={`h-5 w-5 rounded-md flex items-center justify-center font-mono font-bold shrink-0 text-xs border ${
                                    quizAnswered && option.isCorrect
                                      ? "bg-emerald-500 text-slate-950 border-emerald-400"
                                      : quizAnswered && selectedAnswer === idx
                                      ? "bg-rose-500 text-white border-rose-400"
                                      : "bg-slate-900 text-slate-400 border-slate-800"
                                  }`}>
                                    {String.fromCharCode(65 + idx)}
                                  </span>
                                  <span className="leading-normal flex-1">{option.text}</span>
                                  {quizAnswered && option.isCorrect && (
                                    <Check className="h-4 w-4 text-emerald-400 shrink-0 ml-1" />
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Comprehensive Explanations & Adaptive Insights */}
                          {quizAnswered && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-3 pt-2"
                            >
                              {/* Outcome Alert */}
                              <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                                lastQuizResult?.isCorrect
                                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                                  : "bg-rose-500/15 border-rose-500/30 text-rose-300"
                              }`}>
                                <div className="flex items-center space-x-2">
                                  {lastQuizResult?.isCorrect ? (
                                    <Sparkles className="h-4 w-4 text-emerald-400" />
                                  ) : (
                                    <ShieldAlert className="h-4 w-4 text-rose-400" />
                                  )}
                                  <span>
                                    {lastQuizResult?.isCorrect 
                                      ? `Correct! Safe decision made! (+${lastQuizResult?.xpEarned || 150} XP)` 
                                      : "Safety Warning! That choice could put your accounts or data at risk. (+25 XP for reviewing)"}
                                  </span>
                                </div>
                                {lastQuizResult?.leveledUp && (
                                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                                    Promoted to Level {quizProgress?.currentLevel}!
                                  </span>
                                )}
                              </div>

                              {/* Why safe / Why unsafe breakdown */}
                              <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl space-y-2.5 text-xs">
                                <div>
                                  <span className="font-bold text-emerald-400 block mb-0.5">
                                    Why this option is safe:
                                  </span>
                                  <p className="text-slate-300 leading-relaxed text-[11.5px]">
                                    {currentQuizQuestion.explanation.whyCorrectSafe}
                                  </p>
                                </div>

                                <div>
                                  <span className="font-bold text-amber-400 block mb-0.5">
                                    Why other choices are risky:
                                  </span>
                                  <p className="text-slate-400 leading-relaxed text-[11.5px]">
                                    {currentQuizQuestion.explanation.otherOptionsUnsafe}
                                  </p>
                                </div>

                                {selectedAnswer !== null && !currentQuizQuestion.options[selectedAnswer]?.isCorrect && currentQuizQuestion.options[selectedAnswer]?.unsafeReason && (
                                  <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/20 text-rose-300 text-[11px]">
                                    <span className="font-bold">Your selected choice was unsafe because: </span>
                                    {currentQuizQuestion.options[selectedAnswer]?.unsafeReason}
                                  </div>
                                )}

                                <div>
                                  <span className="font-bold text-cyan-400 block mb-0.5">
                                    Real-World Safety Example:
                                  </span>
                                  <p className="text-slate-400 leading-relaxed text-[11px] italic">
                                    "{currentQuizQuestion.explanation.realWorldExample}"
                                  </p>
                                </div>
                              </div>

                              {/* Optional Interactive Follow-Up Question */}
                              {currentQuizQuestion.explanation.followUpQuestion && (
                                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2.5">
                                  <div className="flex items-center space-x-2 text-teal-300 text-xs font-bold font-mono">
                                    <Sparkles className="h-3.5 w-3.5 text-teal-400" />
                                    <span>Quick Follow-up Challenge</span>
                                  </div>
                                  <p className="text-xs text-slate-300">
                                    {(currentQuizQuestion.explanation.followUpQuestion as any).question || (currentQuizQuestion.explanation.followUpQuestion as any).prompt}
                                  </p>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                    {currentQuizQuestion.explanation.followUpQuestion.options.map((fOption, fIdx) => {
                                      const isCorrectOption = fIdx === currentQuizQuestion.explanation.followUpQuestion?.correctIndex;
                                      let fBtnStyle = "border-slate-800 bg-slate-900/60 hover:bg-slate-850 text-slate-300";
                                      if (followUpAnswered) {
                                        if (isCorrectOption) {
                                          fBtnStyle = "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold";
                                        } else if (selectedFollowUpIdx === fIdx) {
                                          fBtnStyle = "bg-rose-500/20 border-rose-500 text-rose-300";
                                        } else {
                                          fBtnStyle = "opacity-40 text-slate-500 border-slate-800";
                                        }
                                      }

                                      return (
                                        <button
                                          key={fIdx}
                                          disabled={followUpAnswered}
                                          onClick={() => {
                                            setFollowUpAnswered(true);
                                            setSelectedFollowUpIdx(fIdx);
                                          }}
                                          className={`text-left p-2.5 rounded-xl border text-[11px] transition cursor-pointer ${fBtnStyle}`}
                                        >
                                          {fOption}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {followUpAnswered && (
                                    <p className="text-[10.5px] text-teal-300/90 pt-1 leading-normal italic">
                                      Tip: {(currentQuizQuestion.explanation.followUpQuestion as any).quickExplanation || (currentQuizQuestion.explanation.followUpQuestion as any).explanation}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Progress & Weak Concept Guidance */}
                              {quizProgress && quizProgress.weakConcepts && quizProgress.weakConcepts.length > 0 && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-xs text-amber-300">
                                  <div className="flex items-center space-x-2">
                                    <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
                                    <span>
                                      Practice Area: {quizProgress.weakConcepts.slice(0, 2).map(c => CATEGORY_LABELS[c] || c).join(", ")}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-mono text-amber-400">Adaptive Coaching</span>
                                </div>
                              )}

                              {/* Next Question Rotation Action Button */}
                              <div className="pt-2 flex items-center justify-between">
                                <span className="text-[11px] text-slate-500 font-mono">
                                  Cycle: #{quizProgress?.currentCycle || 1} • {quizProgress?.correctCount || 0} Solved
                                </span>
                                <button
                                  onClick={handleNextQuizQuestion}
                                  className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition cursor-pointer flex items-center space-x-1.5 shadow-lg shadow-teal-500/20"
                                >
                                  <span>Next Challenge</span>
                                  <ChevronRight className="h-4 w-4" />
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-6 text-slate-400 text-xs">
                        Loading Cyber-Smart Challenge...
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: Guardian Assistant Voice/Text Panel */}
                <div className="lg:col-span-4 h-[600px] bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-3xl overflow-hidden flex flex-col">
                  <div className="bg-slate-950 px-4 py-3.5 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <GraduationCap className="h-5 w-5 text-teal-400" />
                      <div>
                        <h3 className="text-xs font-bold text-slate-100">Guardian AI Tutor</h3>
                        <p className="text-[9px] text-slate-500 font-mono">VOICE & TEXT ENABLED</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <GuardianAssistant viewMode="companion" isEmbedded={true} user={user} userData={userData} />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: HOMEWORK HELPER */}
            {activeTab === "homework" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">My Homework Tracker</h2>
                    <p className="text-xs text-slate-400">Keep track of school assignments and get step-by-step AI guidance.</p>
                  </div>
                  <button
                    onClick={() => setShowHomeworkModal(true)}
                    className="px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md shadow-teal-500/20"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Homework Task</span>
                  </button>
                </div>

                {/* Homework List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {homeworkList.map((task) => (
                    <div 
                      key={task.id}
                      className={`p-5 rounded-2xl border transition space-y-3 relative ${
                        task.completed 
                          ? "bg-slate-900/30 border-slate-800/60 opacity-60" 
                          : "bg-slate-900/60 border-slate-800 hover:border-teal-500/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 font-bold">
                          {task.subject}
                        </span>
                        <button
                          onClick={() => deleteHomeworkTask && deleteHomeworkTask(task.id)}
                          className="text-slate-600 hover:text-rose-400 transition cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <h3 className={`text-sm font-bold ${task.completed ? "line-through text-slate-400" : "text-white"}`}>
                          {task.title}
                        </h3>
                        {task.notes && (
                          <div className="text-xs text-slate-400 leading-normal">
                            {renderTextWithLinks(task.notes, "text-teal-400 hover:text-teal-300 underline font-semibold inline-flex items-center gap-0.5 cursor-pointer break-all", `hw-${task.id}`)}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {task.dueDate}
                        </span>

                        <button
                          onClick={() => toggleHomeworkTask && toggleHomeworkTask(task.id, !task.completed)}
                          className={`px-3 py-1 rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer ${
                            task.completed
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-800 hover:bg-teal-500/20 text-slate-300 hover:text-teal-300"
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{task.completed ? "Done!" : "Mark Complete"}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* SAFE STUDY LINKS & QUICK LINK OPENER */}
                <div className="mt-8 pt-8 border-t border-slate-800/80 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="p-1 rounded-lg bg-teal-500/20 text-teal-400">
                          <Globe className="h-4 w-4" />
                        </span>
                        <h3 className="text-base font-bold text-white">Safe Study Links & Learning Portals</h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Pre-approved child-friendly educational websites for homework, coding, and science projects.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 self-start sm:self-auto">
                      <Shield className="h-3 w-3" /> SafeSearch Certified
                    </span>
                  </div>

                  {/* QUICK SAFE LINK OPENER INPUT */}
                  <form onSubmit={handleOpenCustomLink} className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <ExternalLink className="h-4 w-4 text-teal-400" />
                        <span>Open School or Study Website:</span>
                      </label>
                      <span className="text-[10px] font-mono text-slate-400">Opens instantly in new tab</span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={customStudyUrl}
                        onChange={(e) => setCustomStudyUrl(e.target.value)}
                        placeholder="Paste web address or domain (e.g. khanacademy.org, wikipedia.org, scratch.mit.edu)..."
                        className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 font-mono"
                      />
                      <button
                        type="submit"
                        disabled={!customStudyUrl.trim()}
                        className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-md shadow-teal-500/10 shrink-0"
                      >
                        <span>Generate & Open Link</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {customUrlStatus && (
                      <div className={`p-3 rounded-xl text-xs font-mono flex items-center justify-between gap-2 ${
                        customUrlStatus.type === "success" 
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" 
                          : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                      }`}>
                        <div className="flex items-center gap-2 truncate">
                          {customUrlStatus.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                          <span className="truncate">{customUrlStatus.message}</span>
                        </div>
                      </div>
                    )}

                    {/* ACTIVE GENERATED LINK CARD */}
                    {activeLinkCard && (
                      <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-500/30 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-teal-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Verified Web Link Ready</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Click to visit safely</span>
                        </div>

                        <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 truncate font-mono text-xs">
                            <Globe className="h-4 w-4 text-teal-400 shrink-0" />
                            <a
                              href={activeLinkCard.safeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-teal-300 hover:text-teal-200 underline font-semibold truncate"
                              title={`Direct Link to ${activeLinkCard.safeUrl}`}
                            >
                              {activeLinkCard.safeUrl}
                            </a>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 shrink-0 hidden sm:inline">target="_blank"</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <a
                            href={activeLinkCard.safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2 px-3.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                            title={`Open ${activeLinkCard.safeUrl} in new tab`}
                          >
                            <span>Open Website Now</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleCopyLink(activeLinkCard.safeUrl)}
                            className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                            title="Copy website link to clipboard"
                          >
                            {copiedUrl === activeLinkCard.safeUrl ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{copiedUrl === activeLinkCard.safeUrl ? "Copied!" : "Copy Link"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleAddCustomSavedLink}
                            className="py-2 px-3 bg-slate-800 hover:bg-teal-500/20 text-teal-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer border border-slate-700 hover:border-teal-500/30"
                            title="Save to My Safe Links list"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Save Link</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </form>

                  {/* CURATED & SAVED SAFE WEBSITES GRID */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {[
                      ...savedCustomLinks,
                      { name: "Khan Academy", url: "https://www.khanacademy.org", category: "Math & Science", desc: "Free interactive lessons and practice for all grades." },
                      { name: "Scratch MIT", url: "https://scratch.mit.edu", category: "Creative Coding", desc: "Build creative games and animations with visual blocks." },
                      { name: "Code.org", url: "https://code.org", category: "Computer Science", desc: "Hour of Code puzzles and beginner programming tracks." },
                      { name: "NASA Kids' Club", url: "https://www.nasa.gov/learning-resources/nasa-kids-club/", category: "Space & Science", desc: "Astronomy games, missions, and space exploration." },
                      { name: "National Geographic Kids", url: "https://kids.nationalgeographic.com", category: "Nature & Animals", desc: "Wildlife facts, quizzes, geography, and science." },
                      { name: "Duolingo", url: "https://www.duolingo.com", category: "Languages", desc: "Fun, gamified language courses for Spanish, French, and more." },
                      { name: "GeoGebra", url: "https://www.geogebra.org", category: "Interactive Math", desc: "Dynamic geometry and 3D graphing calculators." },
                      { name: "Britannica Kids", url: "https://kids.britannica.com", category: "Safe Encyclopedia", desc: "Trusted school report articles and historical facts." }
                    ].map((site) => (
                      <div
                        key={site.url}
                        className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-teal-500/40 transition group flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                              {site.category}
                            </span>
                            <span className="text-[9px] text-emerald-400 flex items-center gap-0.5">
                              <Check className="h-3 w-3" /> Safe
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white group-hover:text-teal-300 transition">
                            <a
                              href={site.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              {site.name}
                            </a>
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-normal">
                            {site.desc}
                          </p>
                          <div className="pt-1">
                            <a
                              href={site.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-mono text-teal-400/90 hover:text-teal-300 hover:underline flex items-center gap-1 truncate"
                              title={`Direct link: ${site.url}`}
                            >
                              <Globe className="h-3 w-3 shrink-0" />
                              <span className="truncate">{site.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                            </a>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                          <a
                            href={site.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2 bg-slate-800 hover:bg-teal-500 hover:text-slate-950 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-700/60 hover:border-teal-500 shadow-sm"
                            title={`Open ${site.name} in a new tab`}
                          >
                            <span>Open Website</span>
                            <ExternalLink className="h-3 w-3 text-teal-400 group-hover:text-slate-950" />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleCopyLink(site.url)}
                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition cursor-pointer border border-slate-700/60 shrink-0"
                            title={`Copy link for ${site.name}`}
                          >
                            {copiedUrl === site.url ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: LEARNING HUB & DAILY GOALS */}
            {activeTab === "goals" && (
              <div className="space-y-6">
                {/* Header & Create Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-5 rounded-3xl">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Trophy className="h-6 w-6 text-amber-400 shrink-0" />
                      <span>Daily Goals & Accomplishments</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Track your daily study, health, and safety tasks. Earn badges and keep your parents updated in real time!</p>
                  </div>
                  <button
                    onClick={() => setShowGoalModal(true)}
                    className="px-4 py-2.5 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-teal-500/20 shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Daily Goal</span>
                  </button>
                </div>

                {/* Stat Summary Cards */}
                {(() => {
                  const totalCount = dailyGoalsList.length;
                  const completedCount = dailyGoalsList.filter(g => g.completed).length;
                  const totalTargetMins = dailyGoalsList.reduce((acc, g) => acc + (g.targetMinutes || 0), 0);
                  const totalDoneMins = dailyGoalsList.reduce((acc, g) => acc + (g.completedMinutes || 0), 0);
                  const overallPercent = totalTargetMins > 0 ? Math.min(100, Math.round((totalDoneMins / totalTargetMins) * 100)) : 0;

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 space-y-1">
                        <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold block">Goals Completed</span>
                        <p className="text-xl font-black text-emerald-400 font-display flex items-center gap-1.5">
                          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                          <span>{completedCount} / {totalCount}</span>
                        </p>
                        <p className="text-[10px] text-slate-500">{totalCount - completedCount} tasks remaining today</p>
                      </div>

                      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 space-y-1">
                        <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold block">Minutes Logged</span>
                        <p className="text-xl font-black text-teal-400 font-display flex items-center gap-1.5">
                          <Clock className="h-5 w-5 text-teal-400" />
                          <span>{totalDoneMins}m / {totalTargetMins}m</span>
                        </p>
                        <p className="text-[10px] text-slate-500">{overallPercent}% of total daily time</p>
                      </div>

                      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 space-y-1">
                        <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold block">Goal Streak</span>
                        <p className="text-xl font-black text-amber-400 font-display flex items-center gap-1.5">
                          <Flame className="h-5 w-5 text-amber-400" />
                          <span>5 Days 🔥</span>
                        </p>
                        <p className="text-[10px] text-slate-500">Keep it up to level up!</p>
                      </div>

                      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 space-y-1">
                        <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold block">Active Badge</span>
                        <p className="text-xl font-black text-indigo-400 font-display flex items-center gap-1.5 truncate">
                          <Star className="h-5 w-5 text-indigo-400 shrink-0" />
                          <span className="truncate">Goal Crusher</span>
                        </p>
                        <p className="text-[10px] text-slate-500">Syncs to parent app</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-slate-800/80">
                  {[
                    { id: "all", label: "All Goals" },
                    { id: "learning", label: "📖 Learning" },
                    { id: "safety", label: "🛡️ Safety" },
                    { id: "health", label: "🏃 Health" },
                    { id: "creative", label: "🎨 Creative" },
                    { id: "completed", label: "🎉 Completed" },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setGoalFilter(filter.id as any)}
                      className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                        goalFilter === filter.id
                          ? "bg-teal-500 text-slate-950 font-black shadow-md shadow-teal-500/15"
                          : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                {/* Goal List Cards */}
                {(() => {
                  const filteredGoals = dailyGoalsList.filter(goal => {
                    if (goalFilter === "all") return true;
                    if (goalFilter === "completed") return goal.completed;
                    return goal.category === goalFilter;
                  });

                  if (filteredGoals.length === 0) {
                    return (
                      <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-3xl p-10 text-center space-y-3">
                        <Trophy className="h-10 w-10 text-slate-600 mx-auto" />
                        <p className="text-sm font-bold text-slate-300">No daily goals found in this view.</p>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">Add a new daily task to track your learning, safety, or fitness activities!</p>
                        <button
                          onClick={() => setShowGoalModal(true)}
                          className="px-4 py-2 bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 border border-teal-500/40 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition"
                        >
                          <Plus className="h-4 w-4" /> Add Goal
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredGoals.map((goal) => {
                        const progress = Math.min(100, Math.round((goal.completedMinutes / goal.targetMinutes) * 100));

                        const categoryColors = {
                          learning: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
                          safety: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
                          health: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                          creative: "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        };

                        const badgeClass = categoryColors[goal.category] || "bg-slate-800 text-slate-300 border-slate-700";

                        return (
                          <div 
                            key={goal.id} 
                            className={`bg-slate-900/80 border rounded-2xl p-5 space-y-4 transition-all ${
                              goal.completed 
                                ? "border-emerald-500/40 bg-emerald-950/10" 
                                : "border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <span className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full border font-bold ${badgeClass}`}>
                                  {goal.category}
                                </span>
                                <h3 className={`text-sm font-bold ${goal.completed ? "line-through text-slate-400" : "text-white"}`}>
                                  {goal.title}
                                </h3>
                              </div>

                              {/* Delete Button */}
                              <button
                                onClick={() => deleteDailyGoal && deleteDailyGoal(goal.id)}
                                className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                                title="Delete Goal"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            {/* Progress Details & Bar */}
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-xs font-mono">
                                <span className="text-slate-400 font-semibold">{goal.completedMinutes} / {goal.targetMinutes} mins</span>
                                <span className={`font-bold ${goal.completed ? "text-emerald-400" : "text-teal-400"}`}>{progress}%</span>
                              </div>
                              <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                                <div 
                                  className={`h-full transition-all duration-500 ${
                                    goal.completed 
                                      ? "bg-emerald-400" 
                                      : "bg-gradient-to-r from-teal-400 to-indigo-400"
                                  }`}
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                            </div>

                            {/* Incremental Progress Buttons */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-500 font-mono mr-1">Log:</span>
                                {[-5, 5, 15, 30].map((inc) => (
                                  <button
                                    key={inc}
                                    onClick={() => updateDailyGoalProgress && updateDailyGoalProgress(goal.id, goal.completedMinutes + inc)}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono font-bold text-slate-300 rounded-lg transition cursor-pointer"
                                    title={`Add ${inc} minutes`}
                                  >
                                    {inc > 0 ? `+${inc}m` : `${inc}m`}
                                  </button>
                                ))}
                              </div>

                              <button
                                onClick={() => toggleDailyGoal && toggleDailyGoal(goal.id, !goal.completed)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                                  goal.completed 
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                    : "bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
                                }`}
                              >
                                {goal.completed ? (
                                  <>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                    <span>Completed! 🎉</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-3.5 w-3.5" />
                                    <span>Complete</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 4: EMERGENCY SOS */}
            {activeTab === "sos" && (
              <div className="max-w-xl mx-auto bg-slate-900/80 border border-rose-500/40 rounded-3xl p-8 space-y-6 text-center shadow-2xl">
                <div className="h-20 w-20 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto border-2 border-rose-500/40 shadow-inner animate-pulse">
                  <ShieldAlert className="h-10 w-10" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-white font-display">Emergency SOS Panic Button</h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    If you are ever in danger, feel unsafe, or need immediate assistance, press the button below. It will send a high-priority alert to your parent's dashboard with your exact location!
                  </p>
                </div>

                {/* 0. STATE: RESOLVED BY PARENT (Real-time sync from Firestore) */}
                {(() => {
                  const childAlert = (sosAlerts || []).find(
                    (a) => a.childId === user?.uid || (a.childName && a.childName === (userData?.fullName || user?.displayName))
                  );
                  const isAlertResolved = childAlert && childAlert.status === "resolved";

                  if (isAlertResolved) {
                    return (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-5 bg-teal-500/15 border-2 border-teal-500/50 rounded-2xl text-left space-y-3 shadow-xl"
                      >
                        <div className="flex items-center gap-2 text-teal-400 font-bold text-sm font-display">
                          <CheckCircle2 className="h-6 w-6 shrink-0" />
                          <span>Emergency SOS Resolved & Acknowledged by Parent</span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed">
                          Your parent has received and resolved your emergency distress beacon. Your safety status is verified and marked safe in the family network.
                        </p>
                        <div className="p-3 bg-slate-950/70 border border-teal-500/30 rounded-xl space-y-1 font-mono text-[11px] text-teal-300">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>Resolved by Parent: {childAlert.resolvedBy || "Authorized Parent"}</span>
                          </div>
                        </div>
                        <div className="pt-2 flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={handleResetSos}
                            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-teal-300 font-mono text-xs rounded-xl font-bold transition cursor-pointer flex items-center justify-center gap-2"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Dismiss / All Safe</span>
                          </button>
                        </div>
                      </motion.div>
                    );
                  }
                  return null;
                })()}

                {/* 1. STATE: SENT (Success) */}
                {sosStatus === "sent" && !((sosAlerts || []).some(a => (a.childId === user?.uid || a.childName === (userData?.fullName || user?.displayName)) && a.status === "resolved")) && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-5 bg-emerald-500/15 border-2 border-emerald-500/50 rounded-2xl text-left space-y-3 shadow-xl"
                  >
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm font-display">
                      <CheckCircle2 className="h-6 w-6 shrink-0" />
                      <span>SOS Emergency Alert Broadcast Confirmed!</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      Your parent has received an urgent notification with your live coordinates. Immediate safety protocols have been activated.
                    </p>
                    <div className="p-3 bg-slate-950/70 border border-emerald-500/30 rounded-xl space-y-1 font-mono text-[11px] text-emerald-300">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span>Location Broadcasted: {sosLocationName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>Timestamp: {sosSentTime || "Just now"}</span>
                      </div>
                    </div>
                    <div className="pt-2 flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={handleResetSos}
                        className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-teal-300 font-mono text-xs rounded-xl font-bold transition cursor-pointer flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Reset / Send Another Alert</span>
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* 2. STATE: FAILED (Transmission error) */}
                {sosStatus === "failed" && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-5 bg-rose-500/15 border-2 border-rose-500/50 rounded-2xl text-left space-y-3 shadow-xl"
                  >
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-sm font-display">
                      <AlertCircle className="h-6 w-6 shrink-0" />
                      <span>SOS Alert Failed to Transmit</span>
                    </div>
                    <p className="text-xs text-rose-200 leading-relaxed">
                      {sosError || "The distress beacon could not reach the network. Please retry immediately."}
                    </p>
                    <div className="pt-1 flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={handleTriggerSos}
                        disabled={sosSending}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <ShieldAlert className="h-4 w-4" />
                        <span>{sosSending ? "RETRYING SOS..." : "⚡ RETRY EMERGENCY SOS NOW"}</span>
                      </button>
                      <button
                        onClick={handleResetSos}
                        disabled={sosSending}
                        className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs rounded-xl font-bold transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* 3. STATE: UNKNOWN (Quota limit or offline cached) */}
                {sosStatus === "unknown" && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-5 bg-amber-500/15 border-2 border-amber-500/50 rounded-2xl text-left space-y-3 shadow-xl"
                  >
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-sm font-display">
                      <AlertTriangle className="h-6 w-6 shrink-0" />
                      <span>SOS Alert Status Uncertain (Saved to Device)</span>
                    </div>
                    <p className="text-xs text-amber-200 leading-relaxed">
                      {sosError || "Distress alert is stored locally on this device. Cloud transmission is pending network availability."}
                    </p>
                    <div className="p-3 bg-slate-950/70 border border-amber-500/30 rounded-xl space-y-1 font-mono text-[11px] text-amber-300">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span>Coordinates: {sosLocationName}</span>
                      </div>
                    </div>
                    <div className="pt-1 flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={handleTriggerSos}
                        disabled={sosSending}
                        className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-4 w-4 ${sosSending ? "animate-spin" : ""}`} />
                        <span>{sosSending ? "RECONNECTING..." : "Retry Cloud Transmission"}</span>
                      </button>
                      <button
                        onClick={handleResetSos}
                        disabled={sosSending}
                        className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs rounded-xl font-bold transition cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* 4. STATE: IDLE or SENDING */}
                {(sosStatus === "idle" || sosStatus === "sending") && (
                  <div className="relative group flex flex-col items-center justify-center">
                    {/* Outer Pulse Glow Rings */}
                    <div className="absolute inset-0 bg-rose-600/30 rounded-2xl blur-xl animate-pulse"></div>
                    <div className="absolute -inset-1 bg-gradient-to-r from-rose-500 via-red-600 to-rose-700 rounded-2xl opacity-75 blur-md animate-ping pointer-events-none"></div>

                    <motion.button
                      animate={{
                        scale: sosSending ? 1 : [1, 1.03, 1, 1.05, 1],
                        boxShadow: [
                          "0 0 20px rgba(225, 29, 72, 0.4)",
                          "0 0 35px rgba(225, 29, 72, 0.7)",
                          "0 0 20px rgba(225, 29, 72, 0.4)",
                          "0 0 45px rgba(225, 29, 72, 0.9)",
                          "0 0 20px rgba(225, 29, 72, 0.4)"
                        ]
                      }}
                      transition={{
                        duration: 1.8,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      onClick={handleTriggerSos}
                      disabled={sosSending}
                      className="w-full py-5 bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white font-black text-lg rounded-2xl transition shadow-2xl active:scale-95 cursor-pointer disabled:opacity-75 ring-4 ring-rose-500/40 border-2 border-rose-300/60 flex items-center justify-center gap-3 relative overflow-hidden z-10"
                    >
                      <span className="absolute inset-0 bg-rose-500/20 animate-pulse rounded-2xl pointer-events-none"></span>
                      {sosSending ? (
                        <RefreshCw className="h-7 w-7 text-white shrink-0 animate-spin" />
                      ) : (
                        <ShieldAlert className="h-7 w-7 text-white shrink-0 animate-bounce" />
                      )}
                      <span className="relative z-10 tracking-wide font-display">
                        {sosSending ? "SENDING SOS... (Acquiring GPS & Alerting Parent...)" : "🚨 PRESS FOR SOS EMERGENCY"}
                      </span>
                    </motion.button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* MODAL: Add Homework */}
        {showHomeworkModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4">
              <h3 className="text-base font-bold text-white">Add Homework Assignment</h3>
              <form onSubmit={handleAddHomework} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-400">Assignment Title</label>
                  <input 
                    type="text" 
                    required 
                    value={hwTitle} 
                    onChange={e => setHwTitle(e.target.value)} 
                    placeholder="e.g. Science Lab Report"
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400">Subject</label>
                  <select 
                    value={hwSubject} 
                    onChange={e => setHwSubject(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500"
                  >
                    <option value="Mathematics">Mathematics</option>
                    <option value="Science">Science</option>
                    <option value="English Literature">English Literature</option>
                    <option value="History & Social Studies">History & Social Studies</option>
                    <option value="Computer Science">Computer Science</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400">Due Date</label>
                  <input 
                    type="text" 
                    value={hwDueDate} 
                    onChange={e => setHwDueDate(e.target.value)} 
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400">Notes / Instructions</label>
                  <textarea 
                    value={hwNotes} 
                    onChange={e => setHwNotes(e.target.value)} 
                    rows={2} 
                    className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500" 
                  />
                </div>
                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button type="button" onClick={() => setShowHomeworkModal(false)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl">Save Assignment</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Add Daily Goal */}
        {showGoalModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-teal-400" />
                  <span>Create Daily Goal</span>
                </h3>
                <button 
                  type="button" 
                  onClick={() => setShowGoalModal(false)}
                  className="text-slate-500 hover:text-slate-300 text-xs font-mono p-1 rounded-lg hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Quick Preset Ideas</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { title: "Read 20 Minutes", category: "learning", target: 20 },
                    { title: "Complete Cyber Safety Quiz", category: "safety", target: 10 },
                    { title: "Practice Coding on Khan Academy", category: "learning", target: 30 },
                    { title: "Outdoor Exercise & Screen Break", category: "health", target: 45 },
                    { title: "Drawing & Creative Art", category: "creative", target: 30 },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setGoalTitle(preset.title);
                        setGoalCategory(preset.category as any);
                        setGoalTarget(preset.target);
                      }}
                      className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-[10px] font-medium transition cursor-pointer"
                    >
                      + {preset.title}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleAddGoal} className="space-y-3.5 pt-1">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Goal Title</label>
                  <input 
                    type="text" 
                    required 
                    value={goalTitle} 
                    onChange={e => setGoalTitle(e.target.value)} 
                    placeholder="e.g. Read 30 Minutes of Science Book"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500 transition" 
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Category</label>
                  <select
                    value={goalCategory}
                    onChange={e => setGoalCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500 transition"
                  >
                    <option value="learning">📖 Learning & Education</option>
                    <option value="safety">🛡️ Digital & Cyber Safety</option>
                    <option value="health">🏃 Health & Fitness</option>
                    <option value="creative">🎨 Creative & Arts</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-300">Target Duration</label>
                    <span className="text-xs font-mono font-bold text-teal-400">{goalTarget} minutes</span>
                  </div>
                  <input 
                    type="range"
                    min={5}
                    max={120}
                    step={5}
                    value={goalTarget} 
                    onChange={e => setGoalTarget(Number(e.target.value))} 
                    className="w-full accent-teal-400 bg-slate-950 h-2 rounded-lg cursor-pointer" 
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                    <span>5m</span>
                    <span>30m</span>
                    <span>60m</span>
                    <span>120m</span>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                  <button 
                    type="button" 
                    onClick={() => setShowGoalModal(false)} 
                    className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-teal-500/20 transition cursor-pointer"
                  >
                    Save Daily Goal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
