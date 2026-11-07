import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Shield, MapPin, History, AlertOctagon, Lock, Smartphone, Globe, EyeOff, Bell, 
  BarChart3, Phone, ShieldAlert, Cpu, Laptop, Users, Cloud, 
  Play, Check, HelpCircle, ArrowRight, X, Heart, Sparkles, Brain, Award, BookOpen, Clock, Activity, MessageSquare,
  ShieldCheck, Compass, GraduationCap, TrendingUp, Sparkle, ChevronDown, HeartHandshake
} from "lucide-react";
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell 
} from "recharts";
import { faqs } from "../data";

// Helper CountUp Component
function CountUp({ end, duration = 1.5, prefix = "", suffix = "" }: { end: number; duration?: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrameId: number;

    const updateCount = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const currentCount = Math.floor(easeProgress * end);
      
      setCount(currentCount);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCount);
      }
    };

    animationFrameId = requestAnimationFrame(updateCount);

    return () => cancelAnimationFrame(animationFrameId);
  }, [end, duration]);

  return <span>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// Subtitle Typewriter Component
function TypewriterSubtitle() {
  const words = [
    "Safeguarding digital lives & blocking threats.",
    "Nurturing native talent & discovering interests.",
    "Promoting healthy and balanced digital wellness."
  ];
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [reverse, setReverse] = useState(false);

  useEffect(() => {
    if (subIndex === words[index].length + 1 && !reverse) {
      const timeout = setTimeout(() => setReverse(true), 1800);
      return () => clearTimeout(timeout);
    }

    if (subIndex === 0 && reverse) {
      setReverse(false);
      setIndex((prev) => (prev + 1) % words.length);
      return;
    }

    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (reverse ? -1 : 1));
    }, reverse ? 25 : 50);

    return () => clearTimeout(timeout);
  }, [subIndex, reverse, index]);

  return (
    <div className="h-6 flex items-center justify-center lg:justify-start">
      <p className="text-sm sm:text-base font-mono text-cyan-400 font-semibold tracking-wide">
        <span>{words[index].substring(0, subIndex)}</span>
        <span className="animate-ping ml-0.5 text-cyan-400">|</span>
      </p>
    </div>
  );
}

// Background Visual Component
function FuturisticBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Dynamic Slate Mesh Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-30 dark:opacity-40"></div>
      
      {/* Gradient glowing radial halos */}
      <div className="absolute top-0 left-1/4 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] rounded-full bg-cyan-500/5 dark:bg-cyan-500/3 blur-[100px] sm:blur-[140px] animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[350px] sm:w-[550px] h-[350px] sm:h-[550px] rounded-full bg-indigo-500/5 dark:bg-indigo-500/3 blur-[90px] sm:blur-[130px]"></div>

      {/* Subtle moving particles */}
      <div className="absolute inset-0">
        {[...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-cyan-400/20 dark:bg-cyan-400/10"
            style={{
              width: Math.random() * 4 + 3,
              height: Math.random() * 4 + 3,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, Math.random() * -100 - 40],
              opacity: [0, 0.7, 0],
            }}
            transition={{
              duration: Math.random() * 12 + 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Custom AI Brain Neural SVG Illustration
function AIBrainIllustration() {
  return (
    <div className="relative w-full max-w-[420px] aspect-square flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/5 to-indigo-500/5 rounded-full blur-[80px]"></div>
      
      {/* Central Rotating Rings */}
      <motion.div
        className="absolute w-4/5 h-4/5 rounded-full border border-cyan-500/20 flex items-center justify-center p-6 backdrop-blur-md bg-slate-950/30 shadow-2xl relative"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        <motion.div
          className="absolute inset-0 rounded-full border border-dashed border-cyan-400/15"
          animate={{ rotate: 360 }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-4 rounded-full border border-dotted border-indigo-400/10"
          animate={{ rotate: -360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        />

        {/* Neural nodes connecting SVG lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 400">
          <defs>
            <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Connect paths */}
          <line x1="200" y1="200" x2="110" y2="110" stroke="url(#lineGrad)" strokeWidth="1.5" strokeDasharray="4,4" />
          <line x1="200" y1="200" x2="290" y2="110" stroke="url(#lineGrad)" strokeWidth="1.5" />
          <line x1="200" y1="200" x2="110" y2="290" stroke="url(#lineGrad)" strokeWidth="1.5" />
          <line x1="200" y1="200" x2="290" y2="290" stroke="url(#lineGrad)" strokeWidth="1.5" strokeDasharray="4,4" />
          <line x1="200" y1="200" x2="200" y2="70" stroke="url(#lineGrad)" strokeWidth="1.5" />

          {/* Animated signals */}
          <motion.circle
            r="4"
            fill="#22d3ee"
            animate={{
              cx: [200, 110],
              cy: [200, 110],
              opacity: [0, 1, 0]
            }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.circle
            r="4"
            fill="#6366f1"
            animate={{
              cx: [200, 290],
              cy: [200, 290],
              opacity: [0, 1, 0]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
        </svg>

        {/* Central Brain with Glowing Aura */}
        <div className="relative flex flex-col items-center space-y-4 z-10">
          <motion.div
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center p-0.5 shadow-xl relative"
            animate={{
              y: [0, -6, 0],
              boxShadow: ["0 4px 15px rgba(34,211,238,0.15)", "0 8px 25px rgba(34,211,238,0.3)", "0 4px 15px rgba(34,211,238,0.15)"]
            }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center relative overflow-hidden">
              <Brain className="h-9 w-9 text-cyan-400 absolute" />
              <Shield className="h-11 w-11 text-indigo-500/25 animate-pulse" />
            </div>
          </motion.div>
          <div className="text-center">
            <span className="font-mono text-[9px] text-cyan-400 tracking-widest font-bold uppercase block">Guardian AI Core</span>
            <span className="text-xs font-semibold text-slate-300">Intelligent Safety Node</span>
          </div>
        </div>
      </motion.div>

      {/* Floating Network Badges */}
      <motion.div
        className="absolute left-2 top-10 border border-white/10 p-2.5 rounded-2xl shadow-xl flex items-center space-x-2 bg-slate-900/60 backdrop-blur-md"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <ShieldCheck className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
        <div>
          <p className="text-[8px] text-slate-400 font-mono uppercase">Filter</p>
          <p className="text-[10px] font-bold text-white leading-none">SECURE</p>
        </div>
      </motion.div>

      <motion.div
        className="absolute right-2 bottom-12 border border-white/10 p-2.5 rounded-2xl shadow-xl flex items-center space-x-2 bg-slate-900/60 backdrop-blur-md"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      >
        <TrendingUp className="h-4.5 w-4.5 text-cyan-400 shrink-0" />
        <div>
          <p className="text-[8px] text-slate-400 font-mono uppercase">Talents</p>
          <p className="text-[10px] font-bold text-white leading-none">99.4% Accurate</p>
        </div>
      </motion.div>
    </div>
  );
}

// Live Monitoring Status Panel Component
function LiveMonitoringPanel() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setActive(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.1 }}
      className="border border-white/10 rounded-3xl p-5 sm:p-6 bg-slate-950/60 backdrop-blur-xl shadow-2xl relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/10">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-display font-bold text-xs sm:text-sm text-white leading-none">Guardian AI Monitor</h4>
            <span className="text-[9px] font-mono text-cyan-400 tracking-wider">LIVE FEED ACTIVE</span>
          </div>
        </div>
        <div className="flex items-center space-x-1 bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 rounded-full text-[9px] text-emerald-400 font-mono font-bold">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
          <span>Active</span>
        </div>
      </div>

      {/* Metric List */}
      <div className="grid grid-cols-2 gap-4">
        {/* Metric Item */}
        <div className="space-y-1">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">Threat Level</span>
          <div className="flex items-center space-x-1.5">
            <Shield className="h-4 w-4 text-emerald-400" />
            <span className="text-xs sm:text-sm font-bold text-white">LOW</span>
          </div>
        </div>

        {/* Metric Item */}
        <div className="space-y-1">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">Child Safety Score</span>
          <div className="flex items-center space-x-1.5">
            <div className="h-1.5 w-12 sm:w-16 bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-cyan-400"
                initial={{ width: 0 }}
                animate={{ width: active ? "98%" : "0%" }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </div>
            <span className="text-xs sm:text-sm font-bold text-cyan-400 font-mono">98%</span>
          </div>
        </div>

        {/* Metric Item */}
        <div className="space-y-1">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">Today's Screen Time</span>
          <div className="flex items-center space-x-1.5">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-xs sm:text-sm font-bold text-white">2h 12m</span>
          </div>
        </div>

        {/* Metric Item */}
        <div className="space-y-1">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">Current Learning Interest</span>
          <div className="flex items-center space-x-1.5">
            <BookOpen className="h-4 w-4 text-indigo-400" />
            <span className="text-xs sm:text-sm font-bold text-white">Programming</span>
          </div>
        </div>

        {/* Metric Full-width Item */}
        <div className="col-span-2 border-t border-white/5 pt-3 mt-1 flex justify-between items-center text-xs">
          <div>
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">Cyberbullying Detection</span>
            <p className="text-xs font-bold text-emerald-400 flex items-center mt-0.5">
              <Check className="h-3.5 w-3.5 mr-1 shrink-0" /> No Threats Detected
            </p>
          </div>
          <div className="text-right">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">Safe Location</span>
            <p className="text-xs font-bold text-white flex items-center justify-end mt-0.5">
              <MapPin className="h-3.5 w-3.5 text-rose-500 mr-0.5 shrink-0" /> Verified Safe
            </p>
          </div>
        </div>

        {/* Metric Full-width Item */}
        <div className="col-span-2 border-t border-white/5 pt-3">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
            <span>AI Confidence Level</span>
            <span className="text-cyan-400 font-bold">99% Confidence</span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full mt-1.5 overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: active ? "99%" : "0%" }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Feature Card Subcomponent
interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  badge?: string;
  colorClass: string;
  onClick?: () => void;
  actionLabel?: string;
}

function FeatureCard({ 
  icon: Icon, 
  title, 
  description, 
  badge, 
  colorClass, 
  onClick, 
  actionLabel = "Open Feature" 
}: FeatureCardProps) {
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.01 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${title} - ${actionLabel}`}
      className="p-6 rounded-2xl border border-white/5 bg-slate-950/40 backdrop-blur-md relative overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400/50 flex flex-col justify-between"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-cyan-500/0 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <div className="absolute inset-0 border border-cyan-400/0 group-hover:border-cyan-400/30 rounded-2xl transition-all duration-300 pointer-events-none" />

      <div className="space-y-4">
        <motion.div 
          className={`h-11 w-11 rounded-xl flex items-center justify-center bg-slate-900 border border-white/5 text-cyan-400 ${colorClass}`}
          whileHover={{ rotate: 10, scale: 1.05 }}
          transition={{ type: "spring", stiffness: 260, damping: 10 }}
        >
          <Icon className="h-5.5 w-5.5" />
        </motion.div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold text-base font-display text-white group-hover:text-cyan-300 transition-colors">
              {title}
            </h4>
            {badge && (
              <span className="text-[9px] font-mono font-bold bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
            {description}
          </p>
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-cyan-400 group-hover:text-cyan-300 transition-colors">
        <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-wide">
          <span>{actionLabel}</span>
          <ArrowRight className="h-3 w-3 transform group-hover:translate-x-1 transition-transform" />
        </span>
        <span className="text-[10px] text-slate-500 font-mono">Protected</span>
      </div>
    </motion.div>
  );
}

// Interactive Analytics Hub Charts Component
function AnalyticsHub({ setViewMode }: { setViewMode: (mode: "public" | "dashboard") => void }) {
  const [activeChart, setActiveChart] = useState<"screentime" | "learning" | "threats" | "interests" | "safety">("screentime");

  const screenTimeData = [
    { day: "Mon", hours: 1.8 },
    { day: "Tue", hours: 2.2 },
    { day: "Wed", hours: 1.5 },
    { day: "Thu", hours: 2.5 },
    { day: "Fri", hours: 1.2 },
    { day: "Sat", hours: 3.0 },
    { day: "Sun", hours: 2.1 }
  ];

  const learningProgressData = [
    { week: "Wk 1", coding: 20, languages: 35, science: 30 },
    { week: "Wk 2", coding: 45, languages: 40, science: 42 },
    { week: "Wk 3", coding: 70, languages: 55, science: 50 },
    { week: "Wk 4", coding: 92, languages: 72, science: 65 }
  ];

  const threatTimelineData = [
    { time: "09:00", threats: 0 },
    { time: "11:00", threats: 1 },
    { time: "13:00", threats: 0 },
    { time: "15:00", threats: 2 },
    { time: "17:00", threats: 0 },
    { time: "19:00", threats: 0 }
  ];

  const interestData = [
    { name: "Coding", value: 45 },
    { name: "Languages", value: 25 },
    { name: "Astrophysics", value: 15 },
    { name: "Music", value: 10 },
    { name: "Other", value: 5 }
  ];
  const COLORS = ["#06b6d4", "#6366f1", "#14b8a6", "#f59e0b", "#3b82f6"];

  const safetyReportData = [
    { month: "Jan", safety: 92 },
    { month: "Feb", safety: 94 },
    { month: "Mar", safety: 95 },
    { month: "Apr", safety: 98 },
    { month: "May", safety: 97 },
    { month: "Jun", safety: 98 }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mt-12">
      {/* Selector Side */}
      <div className="lg:col-span-4 flex flex-col justify-between bg-slate-950/40 backdrop-blur-md rounded-3xl p-6 border border-white/5 space-y-6">
        <div className="space-y-4">
          <div>
            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">Guardian Analytics</span>
            <h3 className="font-display font-bold text-xl text-white mt-1">Live Telemetry Feeds</h3>
            <p className="text-xs text-slate-400 mt-2">
              Guardian AI parses raw content feeds, device states, and learning milestones to present precise analytical trends.
            </p>
          </div>

          <div className="space-y-1.5 pt-2">
            {[
              { id: "screentime", label: "Weekly Screen Time", desc: "Daily hours and restriction limits", icon: Clock },
              { id: "learning", label: "Learning Progress", desc: "Skills gained in Coding & STEM", icon: GraduationCap },
              { id: "threats", label: "Threat Timeline", desc: "Blocked requests logging", icon: ShieldAlert },
              { id: "interests", label: "Interest Analysis", desc: "Calculated affinity breakdown", icon: Compass },
              { id: "safety", label: "Monthly Safety Report", desc: "Overall safety index trends", icon: ShieldCheck }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeChart === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveChart(item.id as any)}
                  className={`w-full flex items-center space-x-3.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isActive 
                      ? "bg-cyan-500/10 border-cyan-500/30 text-white shadow-lg" 
                      : "bg-transparent border-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-900 text-slate-500"
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-none">{item.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-none">{item.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-3 border-t border-white/5 flex items-center space-x-2 text-emerald-400 text-[10px] font-mono font-bold uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Metrics Synchronized Live</span>
        </div>
      </div>

      {/* Recharts Chart Render Panel */}
      <div className="lg:col-span-8 bg-slate-950/40 backdrop-blur-md rounded-3xl p-6 border border-white/5 flex flex-col justify-between min-h-[350px]">
        <div className="flex-1 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height={300}>
            {activeChart === "screentime" ? (
              <AreaChart data={screenTimeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.2} />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "12px", color: "#fff" }}
                  itemStyle={{ color: "#22d3ee" }}
                />
                <Area type="monotone" dataKey="hours" name="Screen Hours" stroke="#22d3ee" strokeWidth={2} fillOpacity={1} fill="url(#colorHours)" />
              </AreaChart>
            ) : activeChart === "learning" ? (
              <LineChart data={learningProgressData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.2} />
                <XAxis dataKey="week" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "12px", color: "#fff" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                <Line type="monotone" dataKey="coding" name="Coding Logic" stroke="#22d3ee" strokeWidth={2.5} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="languages" name="Linguistics" stroke="#6366f1" strokeWidth={2.5} />
                <Line type="monotone" dataKey="science" name="Astrophysics" stroke="#14b8a6" strokeWidth={2.5} />
              </LineChart>
            ) : activeChart === "threats" ? (
              <BarChart data={threatTimelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.2} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "12px", color: "#fff" }}
                  itemStyle={{ color: "#ef4444" }}
                />
                <Bar dataKey="threats" name="Blocked Requests" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : activeChart === "interests" ? (
              <PieChart>
                <Pie
                  data={interestData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {interestData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "12px", color: "#fff" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            ) : (
              <AreaChart data={safetyReportData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSafety" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.2} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} domain={[80, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "12px", color: "#fff" }}
                  itemStyle={{ color: "#10b981" }}
                />
                <Area type="monotone" dataKey="safety" name="Safety Score" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSafety)" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Info panel */}
        <div className="pt-4 border-t border-white/5 mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-xs font-bold text-white uppercase font-display leading-none">
              {activeChart === "screentime" && "Allocated Digital Allocation Tracker"}
              {activeChart === "learning" && "STEM Skill Growth Progression Map"}
              {activeChart === "threats" && "Phishing & adult redirects neutralized"}
              {activeChart === "interests" && "Aggregate child interest metrics"}
              {activeChart === "safety" && "Unified online safety index averages"}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {activeChart === "screentime" && "Compares social and entertainment hours against strict healthy guidelines."}
              {activeChart === "learning" && "Combines educational app queries, duolingo, and block programming tools."}
              {activeChart === "threats" && "Security events neutralized in real-time before reaching your child's browser."}
              {activeChart === "interests" && "Calculates career indicators based on reading structure density."}
              {activeChart === "safety" && "Indicates high-precision security averages over a 6-month tracking timeline."}
            </p>
          </div>
          <span className="text-[11px] font-mono font-bold text-cyan-400/80 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-full shrink-0">
            Live Telemetry Active
          </span>
        </div>
      </div>
    </div>
  );
}

// Activity Feed Timeline Component
function ActivityFeedTimeline() {
  const feedItems = [
    { time: "09:10 AM", title: "Safe learning session started", desc: "Leo completed intermediate Duolingo Spanish module.", icon: BookOpen, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    { time: "10:25 AM", title: "Visited educational website", desc: "Leo browsed planetary gravity maps on NASA Kids portal.", icon: Globe, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
    { time: "12:14 PM", title: "Completed coding lesson", desc: "Completed 3 Scratch loop block exercises on computer tab.", icon: Brain, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
    { time: "03:50 PM", title: "Unsafe threat blocked", desc: "Blocked redirect to deceptive forum domain 'free-robux-clicker.com'.", icon: ShieldAlert, color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
    { time: "06:40 PM", title: "Parent report generated", desc: "AI digested activity metrics and exported weekly parenting report.", icon: Activity, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" }
  ];

  return (
    <div className="relative border-l border-slate-800 ml-4 pl-8 space-y-8 py-2">
      {feedItems.map((item, index) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            {/* Pulsing Dot */}
            <div className={`absolute -left-[52px] top-0.5 h-10 w-10 rounded-full flex items-center justify-center border ${item.color} shadow-lg shadow-black/30 shrink-0`}>
              <Icon className="h-4.5 w-4.5" />
            </div>

            <div className="space-y-1 flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-[9px] font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/10 px-2 py-0.5 rounded">
                  {item.time}
                </span>
                <h5 className="text-sm font-bold text-white">{item.title}</h5>
              </div>
              <p className="text-xs text-slate-400 pl-1 leading-normal">{item.desc}</p>
            </div>

            <div className="hidden sm:block text-right">
              <span className="text-[10px] font-mono text-slate-500">Node telemetry logged</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// AI Recommendations Insights Component
function AIRecommendationsInsights() {
  const recommendations = [
    {
      title: "Recommended Courses",
      subtitle: "Introduction to Python Basics",
      desc: "Based on block loop sequences completed, we suggest introducing simple text-based loops using kid-friendly interactive modules.",
      tag: "Milestone Suggestion",
      icon: GraduationCap,
      color: "from-cyan-500/15 to-teal-500/15 text-cyan-400 border-cyan-500/25"
    },
    {
      title: "Career Suggestions",
      subtitle: "Software Engineering & Astrophysics",
      desc: "Strong affinity indicators detected for mechanical structures and orbital equations. Maintain focus on these STEM fields.",
      tag: "Talent Discovery",
      icon: Compass,
      color: "from-indigo-500/15 to-purple-500/15 text-indigo-400 border-indigo-500/25"
    },
    {
      title: "Learning Improvements",
      subtitle: "Vocabulary Retention Drills",
      desc: "Emily's linguistic scores indicate excellent phonology recall. Discuss Spanish words during standard family dinners.",
      tag: "Cognitive Insight",
      icon: Brain,
      color: "from-amber-500/15 to-orange-500/15 text-amber-400 border-amber-500/25"
    },
    {
      title: "Safety Tips",
      subtitle: "Configure Ad-Shield Extension",
      desc: "Two scam banner redirects were blocked this week. Validate that browser safe ad-blockers are globally configured.",
      tag: "Security Audit",
      icon: Shield,
      color: "from-rose-500/15 to-orange-500/15 text-rose-400 border-rose-500/25"
    },
    {
      title: "Parent Guidance",
      subtitle: "Interactive Logic Dialogues",
      desc: "Your child completed 45 minutes of construction logic. Discuss the loop design with them for 15 minutes to solidify concepts.",
      tag: "Pedagogical Advice",
      icon: Users,
      color: "from-teal-500/15 to-cyan-500/15 text-teal-400 border-teal-500/25"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mt-12">
      {recommendations.map((item, index) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className={`rounded-2xl border p-5 bg-gradient-to-br ${item.color} backdrop-blur-md flex flex-col justify-between h-full hover:translate-y-[-4px] transition-all duration-300 group`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/80">
                  {item.tag}
                </span>
                <Icon className="h-5 w-5 opacity-80 group-hover:scale-105 transition-transform" />
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-[10px] text-white/50 uppercase tracking-widest leading-none">{item.title}</h4>
                <h5 className="font-display font-bold text-sm text-white leading-tight">{item.subtitle}</h5>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed">
                {item.desc}
              </p>
            </div>

            <div className="pt-3 mt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-500">Autonomous Evaluation</span>
              <span className="text-[10px] font-mono font-bold text-cyan-400">
                Verified Safeguard
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// Props
interface PublicHomeProps {
  setViewMode: (mode: "public" | "dashboard") => void;
  user?: any;
  userData?: any;
  navigate?: (to: string) => void;
}

export default function PublicHome({ setViewMode, user, userData, navigate }: PublicHomeProps) {
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showDemoDropdown, setShowDemoDropdown] = useState(false);
  const [riskSlider, setRiskSlider] = useState(3.5); // screen time in hours
  const [riskAppCategory, setRiskAppCategory] = useState("entertainment"); // entertainment vs education
  const [activeTalentTab, setActiveTalentTab] = useState<"coding" | "languages" | "science">("coding");

  // Handler for connecting each public feature card directly to its corresponding feature with login protection
  const handleFeatureNavigation = (tabId: string, featureTitle: string) => {
    const targetUrl = `/parent?tab=${tabId}`;

    // 1. If not authenticated, redirect to Parent Login with safe returnTo
    if (!user) {
      const loginUrl = `/parent/login?returnTo=${encodeURIComponent(targetUrl)}`;
      if (navigate) {
        navigate(loginUrl);
      } else if (typeof window !== "undefined") {
        window.location.href = loginUrl;
      }
      return;
    }

    // 2. If authenticated, verify role
    const userRole = userData?.role || "parent";
    if (userRole === "child") {
      // Child accounts accessing SOS should open their Child SOS Panic Button!
      const childDest = tabId === "sos" ? "/child?tab=sos" : "/child";
      if (navigate) {
        navigate(childDest);
      } else if (typeof window !== "undefined") {
        window.location.href = childDest;
      }
      return;
    }

    // 3. Authenticated parent -> navigate directly to feature
    if (navigate) {
      navigate(targetUrl);
    } else if (typeof window !== "undefined") {
      window.location.href = targetUrl;
    }
  };
  
  // FAQ state
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Contact form state
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", msg: "" });

  const calculateRisk = () => {
    let score = 5;
    score += Math.round(riskSlider * 12);
    if (riskAppCategory === "entertainment") {
      score += 25;
    } else if (riskAppCategory === "mixed") {
      score += 10;
    } else {
      score -= 15;
    }
    return Math.max(5, Math.min(98, score));
  };

  const riskScore = calculateRisk();

  const getRiskStatus = (score: number) => {
    if (score < 35) return { label: "Excellent Safety Rating", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
    if (score < 65) return { label: "Moderate Risk Warning", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
    return { label: "Critical Intervention Recommended", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" };
  };

  const riskStatus = getRiskStatus(riskScore);

  return (
    <div className="bg-slate-950 text-slate-100 transition-colors duration-300 relative z-10 overflow-x-hidden">
      
      {/* Background patterns */}
      <FuturisticBackground />

      {/* HERO SECTION */}
      <section className="relative pt-20 pb-28 lg:pt-28 lg:pb-36 overflow-hidden z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Left Info Column */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center space-x-2 rounded-full bg-blue-500/10 border border-blue-500/20 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-400">
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                <span>Platform Launch: AI Talent Discovery Suite</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-display leading-[1.1] tracking-tight text-white">
                Protect Your Child. <br />
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-500 bg-clip-text text-transparent">
                  Empower Their Future.
                </span>
              </h1>
              
              {/* Typewriter Subtitle Effect */}
              <TypewriterSubtitle />
              
              <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed pt-2">
                The next generation of AI-powered parental controls that protect children from cybersecurity threats, monitor digital wellness in real-time, and help parents uncover genuine talents.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-4 flex-wrap">
                <button
                  onClick={() => {
                    if (navigate) {
                      navigate("/parent");
                    } else if (typeof window !== "undefined") {
                      window.history.pushState({}, "", "/parent");
                      window.dispatchEvent(new PopStateEvent("popstate"));
                    }
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 px-7 py-3.5 text-sm font-bold text-slate-950 hover:scale-[1.02] shadow-lg shadow-cyan-500/10 transition-all cursor-pointer"
                  id="hero-get-started"
                >
                  <HeartHandshake className="h-4.5 w-4.5" />
                  <span>Parent Portal</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  onClick={() => {
                    if (navigate) {
                      navigate("/child");
                    } else if (typeof window !== "undefined") {
                      window.history.pushState({}, "", "/child");
                      window.dispatchEvent(new PopStateEvent("popstate"));
                    }
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 rounded-full border border-emerald-500/30 bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 px-7 py-3.5 text-sm font-bold transition-all cursor-pointer"
                  id="hero-child-portal"
                >
                  <Compass className="h-4.5 w-4.5 text-emerald-400" />
                  <span>Child Portal</span>
                </button>

                {/* Explore Demo Button with Interactive Chooser */}
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={() => setShowDemoDropdown(!showDemoDropdown)}
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 rounded-full border border-cyan-400/50 bg-gradient-to-r from-cyan-950/70 to-blue-950/70 hover:from-cyan-900/80 hover:to-blue-900/80 text-cyan-200 px-6 py-3.5 text-sm font-bold shadow-lg shadow-cyan-500/20 transition-all cursor-pointer group"
                    id="hero-explore-demo"
                  >
                    <Sparkles className="h-4.5 w-4.5 text-cyan-400 animate-pulse group-hover:rotate-12 transition-transform" />
                    <span>Explore Demo</span>
                    <ChevronDown className={`h-4 w-4 text-cyan-400 transition-transform ${showDemoDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showDemoDropdown && (
                    <div 
                      className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-72 rounded-2xl bg-slate-900/95 border border-cyan-500/30 shadow-2xl p-2 z-50 space-y-1.5 backdrop-blur-xl animate-fadeIn"
                      onMouseLeave={() => setShowDemoDropdown(false)}
                    >
                      <div className="px-3 py-1.5 border-b border-slate-800">
                        <p className="text-[10px] font-mono text-cyan-400 uppercase font-bold tracking-wider">Evaluation Preview</p>
                        <p className="text-[11px] text-slate-400">Instant access • No login required</p>
                      </div>

                      <button
                        onClick={() => {
                          setShowDemoDropdown(false);
                          if (navigate) navigate("/demo/parent");
                          else window.location.href = "/demo/parent";
                        }}
                        className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left hover:bg-blue-950/50 hover:border-blue-500/30 border border-transparent text-xs text-slate-200 transition cursor-pointer"
                      >
                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                          <HeartHandshake className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-white flex items-center gap-1.5">
                            <span>Parent Demo</span>
                            <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-mono">Telemetry</span>
                          </p>
                          <p className="text-[10px] text-slate-400">Geofences, screen time & alerts</p>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setShowDemoDropdown(false);
                          if (navigate) navigate("/demo/child");
                          else window.location.href = "/demo/child";
                        }}
                        className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left hover:bg-emerald-950/50 hover:border-emerald-500/30 border border-transparent text-xs text-slate-200 transition cursor-pointer"
                      >
                        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                          <Compass className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-white flex items-center gap-1.5">
                            <span>Child Demo</span>
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono">Explorer</span>
                          </p>
                          <p className="text-[10px] text-slate-400">Homework, goals & panic SOS</p>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setShowDemoDropdown(false);
                          if (navigate) navigate("/demo/admin");
                          else window.location.href = "/demo/admin";
                        }}
                        className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left hover:bg-rose-950/50 hover:border-rose-500/30 border border-transparent text-xs text-slate-200 transition cursor-pointer"
                      >
                        <div className="h-8 w-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                          <ShieldAlert className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-white flex items-center gap-1.5">
                            <span>Admin Demo</span>
                            <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded font-mono">Console</span>
                          </p>
                          <p className="text-[10px] text-slate-400">Platform telemetry & policy</p>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setShowDemoDropdown(false);
                          if (navigate) navigate("/demo");
                          else window.location.href = "/demo";
                        }}
                        className="w-full py-2 text-center text-[11px] font-bold text-cyan-400 hover:text-cyan-300 hover:bg-slate-800/60 rounded-xl transition cursor-pointer border-t border-slate-800/80 mt-1"
                      >
                        View Full Demo Hub →
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Animated Statistics Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-8 border-t border-white/5 max-w-xl mx-auto lg:mx-0">
                <div>
                  <p className="text-xl sm:text-2xl font-bold font-display text-cyan-400">
                    <CountUp end={15000} suffix="+" />
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Protected</p>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold font-display text-indigo-400">
                    <CountUp end={9800} suffix="+" />
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Prevented</p>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold font-display text-teal-400">
                    <CountUp end={52000} suffix="+" />
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Sessions</p>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold font-display text-amber-500">
                    <CountUp end={320000} suffix="+" />
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Searches</p>
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold font-display text-emerald-400">
                    <CountUp end={99} suffix=".4%" />
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Accuracy</p>
                </div>
              </div>
            </div>

            {/* Right Interactive Dashboard / SVG Column */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center space-y-6">
              {/* Premium Brain Illustration */}
              <AIBrainIllustration />
              {/* Live Monitoring Dashboard Panel */}
              <div className="w-full">
                <LiveMonitoringPanel />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* DEDICATED EXPERIENCE PORTALS (PARENT & CHILD ONLY) */}
      <section className="py-16 bg-slate-900/60 border-t border-b border-slate-800 relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
            <div className="inline-flex items-center space-x-2 rounded-full bg-blue-500/10 border border-blue-500/25 px-3 py-1 text-xs font-mono font-bold text-cyan-400">
              <span>PLATFORM EXPERIENCE PORTALS</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Two Dedicated Experience Portals
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Role-protected web environments tailored for parents and children with specialized workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* PORTAL 1: PARENT */}
            <div 
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.history.pushState({}, "", "/parent");
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }
              }}
              className="bg-slate-950/80 border border-blue-500/20 hover:border-blue-500/50 rounded-3xl p-6 space-y-4 hover:scale-[1.02] transition-all cursor-pointer shadow-xl group"
            >
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-lg text-white">Parent Portal</h3>
                  <span className="text-[10px] font-mono bg-blue-950 text-blue-400 px-2 py-0.5 rounded font-semibold">/parent</span>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Real-time D3 location heatmap, safe zone geofencing, AI screen-time limits, family QR linking, and neural threat analysis.
                </p>
              </div>
              <div className="pt-2 flex items-center space-x-1.5 text-xs font-bold text-blue-400 group-hover:text-blue-300">
                <span>Enter Parent Portal</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>

            {/* PORTAL 2: CHILD */}
            <div 
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.history.pushState({}, "", "/child");
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }
              }}
              className="bg-slate-950/80 border border-emerald-500/20 hover:border-emerald-500/50 rounded-3xl p-6 space-y-4 hover:scale-[1.02] transition-all cursor-pointer shadow-xl group"
            >
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-slate-950 transition">
                <Compass className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-lg text-white">Child Portal</h3>
                  <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded font-semibold">/child</span>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Interactive homework tutor, daily goals progression, cyber safety learning quizzes, companion telemetry sync, and instant SOS dispatch.
                </p>
              </div>
              <div className="pt-2 flex items-center space-x-1.5 text-xs font-bold text-emerald-400 group-hover:text-emerald-300">
                <span>Launch Child Portal</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CORE FEATURES GRID */}
      <section id="features" className="py-24 bg-slate-950 border-t border-b border-white/5 relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-xs font-semibold tracking-wider text-cyan-400 uppercase font-mono">Guardian Suite</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold font-display text-white">
              Every Shield Your Child Needs. Combined.
            </h3>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              We've consolidated high-precision physical location security, smart application firewalls, browser shields, and direct telemetry into a single unified security core.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
            
            <FeatureCard 
              icon={MapPin} 
              title="📍 Real-Time GPS Tracking" 
              description="Continuous high-precision live location feeds. Monitor transit routes and precise safe coordinate pins." 
              badge="GPS Feed"
              colorClass="text-cyan-400"
              onClick={() => handleFeatureNavigation("map", "Real-Time GPS Tracking")}
              actionLabel="Launch Live Map"
            />

            <FeatureCard 
              icon={History} 
              title="🗺️ History & Timeline" 
              description="Chronological record of geofence entries, travel speeds, and location checkouts for absolute reliability." 
              badge="Timeline"
              colorClass="text-indigo-400"
              onClick={() => handleFeatureNavigation("timeline", "History & Timeline")}
              actionLabel="View Activity Timeline"
            />

            <FeatureCard 
              icon={AlertOctagon} 
              title="🚨 One-Tap SOS Alert" 
              description="Instantly triggers visual/audio alarms and posts continuous live location links during severe emergencies." 
              badge="Emergency"
              colorClass="text-rose-400"
              onClick={() => handleFeatureNavigation("sos", "One-Tap SOS Alert")}
              actionLabel="Open Emergency Center"
            />

            <FeatureCard 
              icon={Lock} 
              title="🔒 Remote Lock" 
              description="Instantly lock target devices from your parent control panel during bedtime or dinners to reclaim focus." 
              badge="App Lock"
              colorClass="text-purple-400"
              onClick={() => handleFeatureNavigation("devices", "Remote Lock")}
              actionLabel="Manage Hardware Devices"
            />

            <FeatureCard 
              icon={Globe} 
              title="🌐 Safe Browser Shield" 
              description="Enforces strict SafeSearch engines and actively filters over 8 million dangerous adult and betting domains." 
              badge="Web Shield"
              colorClass="text-teal-400"
              onClick={() => handleFeatureNavigation("controls", "Safe Browser Shield")}
              actionLabel="Configure Web Shield"
            />

            <FeatureCard 
              icon={Clock} 
              title="🚫 Smart App Limits" 
              description="Configure custom, minute-level maximum usage limits for gaming platforms, social media, and entertainment hubs." 
              badge="Usage limits"
              colorClass="text-amber-500"
              onClick={() => handleFeatureNavigation("controls", "Smart App Limits")}
              actionLabel="Adjust Screen Limits"
            />

            <FeatureCard 
              icon={ShieldAlert} 
              title="🛡️ Unsafe AI Detection" 
              description="Scans incoming messages and URLs for signs of cyberbullying, harassment, and malicious malicious domains." 
              badge="AI Scanner"
              colorClass="text-emerald-400"
              onClick={() => handleFeatureNavigation("danger-center", "Unsafe AI Detection")}
              actionLabel="Inspect AI Threats"
            />

            <FeatureCard 
              icon={Cloud} 
              title="☁️ Cloud Sync Engine" 
              description="All children devices synchronize preferences and logs in real-time to maintain absolute parent synchronization." 
              badge="Secure Sync"
              colorClass="text-blue-500"
              onClick={() => handleFeatureNavigation("settings", "Cloud Sync Engine")}
              actionLabel="Check Sync Engine"
            />

          </div>

          {/* Quick link to Neural Shield */}
          <div className="mt-12 text-center">
            <button
              onClick={() => {
                const el = document.getElementById("ai-features");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center space-x-2 rounded-full bg-white/5 border border-white/10 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/10 hover:scale-[1.01] transition-all cursor-pointer"
            >
              <span>Explore Neural Shield Protections</span>
              <ArrowRight className="h-4 w-4 text-cyan-400" />
            </button>
          </div>

        </div>
      </section>

      {/* CHARTS AND LIVE ANALYTICS HUB */}
      <section id="analytics-hub" className="py-24 bg-slate-950 border-b border-white/5 relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-semibold tracking-wider text-cyan-400 font-mono uppercase">Interactive Analytics</span>
            <h3 className="text-3xl sm:text-4xl font-extrabold font-display text-white">
              Visualizing Safety & Learning
            </h3>
            <p className="text-sm sm:text-base text-slate-400">
              Interactive reports mapped continuously by Guardian AI. Click the toggles below to view live data.
            </p>
          </div>

          <AnalyticsHub setViewMode={setViewMode} />

        </div>
      </section>

      {/* ADVANCED AI FEATURES SECTION (REPORT, DETECTION, TALENT) */}
      <section id="ai-features" className="py-24 bg-slate-950 border-b border-white/5 relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-20">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center space-x-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1 text-xs font-bold text-indigo-400">
              <Cpu className="h-3.5 w-3.5" />
              <span>Guardian DeepLearning AI™ Core</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-display text-white">
              Where Protection Meets Empowerment
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
              We look beyond simple website blocking. Our advanced models analyze vocabulary retention, browsing vectors, and safety parameters to guide parent oversight.
            </p>
          </div>

          {/* ADVANCED MODULE 1: INTERACTIVE TALENT PATHWAY */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center space-x-1.5 text-amber-500 font-bold text-xs uppercase tracking-wider font-mono">
                <Award className="h-4.5 w-4.5" />
                <span>AI Interest & Talent Discovery</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold font-display leading-tight text-white">
                Turn Screen Time Into Future Pathways
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Instead of simply shutting down devices, our AI models analyze learning profiles, construction searches, and logical milestones. When your child triggers Surges in engineering, coding, or languages, we map guidance suggestions.
              </p>

              {/* Switches */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setActiveTalentTab("coding")}
                  className={`px-4 py-2 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                    activeTalentTab === "coding"
                      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/35"
                      : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10"
                  }`}
                >
                  💻 AI & Programming
                </button>
                <button
                  onClick={() => setActiveTalentTab("languages")}
                  className={`px-4 py-2 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                    activeTalentTab === "languages"
                      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/35"
                      : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10"
                  }`}
                >
                  🗣️ Languages & Linguistics
                </button>
                <button
                  onClick={() => setActiveTalentTab("science")}
                  className={`px-4 py-2 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                    activeTalentTab === "science"
                      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/35"
                      : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10"
                  }`}
                >
                  🚀 Astrophysics
                </button>
              </div>

              {/* Sandbox Card */}
              <div className="p-6 rounded-2xl border border-white/10 bg-slate-950/60 backdrop-blur-md">
                {activeTalentTab === "coding" && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest font-mono">TALENT CLUSTER METRIC</span>
                      <span className="text-xs bg-cyan-500/10 px-2 py-0.5 rounded-full text-cyan-400 font-mono border border-cyan-500/20 font-bold">95 Score</span>
                    </div>
                    <h5 className="font-bold text-white text-base">Software Systems & Block Logic Loops</h5>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Leo is demonstrating advanced logical hierarchies in Scratch blocks, sprite coordinates, and conditional operators.
                    </p>
                    <div className="pt-3 border-t border-white/5 space-y-1.5">
                      <p className="text-[9px] uppercase font-mono text-slate-500 font-bold">Pedagogical Actions Suggested:</p>
                      <ul className="text-xs text-slate-300 list-disc list-inside space-y-1">
                        <li>Introduce basic web elements (HTML / CSS grids)</li>
                        <li>Explore Minecraft Computer Science Education Kit</li>
                      </ul>
                    </div>
                  </div>
                )}
                {activeTalentTab === "languages" && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest font-mono">TALENT CLUSTER METRIC</span>
                      <span className="text-xs bg-cyan-500/10 px-2 py-0.5 rounded-full text-cyan-400 font-mono border border-cyan-500/20 font-bold">88 Score</span>
                    </div>
                    <h5 className="font-bold text-white text-base">Conversational Phonology & Vocabulary</h5>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Emily completed 5 consecutive vocal exercises. Audio memory, accent matching, and syntax recall indexes are highly advanced.
                    </p>
                    <div className="pt-3 border-t border-white/5 space-y-1.5">
                      <p className="text-[9px] uppercase font-mono text-slate-500 font-bold">Pedagogical Actions Suggested:</p>
                      <ul className="text-xs text-slate-300 list-disc list-inside space-y-1">
                        <li>Maintain her 5-day Spanish Duolingo lessons</li>
                        <li>Practice basic conversational Spanish phrases over dinners</li>
                      </ul>
                    </div>
                  </div>
                )}
                {activeTalentTab === "science" && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest font-mono">TALENT CLUSTER METRIC</span>
                      <span className="text-xs bg-cyan-500/10 px-2 py-0.5 rounded-full text-cyan-400 font-mono border border-cyan-500/20 font-bold">82 Score</span>
                    </div>
                    <h5 className="font-bold text-white text-base">Aerodynamics & Cosmic Physics Sandbox</h5>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Leo exhibits high curiosity rates regarding planetary orbits, space rocket vectors, and JPL flight trajectories.
                    </p>
                    <div className="pt-3 border-t border-white/5 space-y-1.5">
                      <p className="text-[9px] uppercase font-mono text-slate-500 font-bold">Pedagogical Actions Suggested:</p>
                      <ul className="text-xs text-slate-300 list-disc list-inside space-y-1">
                        <li>Introduce Kerbal Space Program physics sandbox</li>
                        <li>Recommend Astrophysics for Young People by Neil deGrasse Tyson</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Illustrative Dashboard Mockup Panel (Replacing the generic stock image) */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 max-w-md w-full bg-slate-900/40 backdrop-blur-md">
                {/* SVG background grid inside panel illustration */}
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:100%_8px] pointer-events-none"></div>
                <div className="p-5 border-b border-white/5 flex items-center justify-between bg-slate-950/50">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 rounded-full bg-cyan-400 animate-ping"></div>
                    <span className="text-xs font-mono font-bold text-slate-300">Live Pathway Analyzer</span>
                  </div>
                  <span className="text-[9px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 font-bold">MIL MILESTONES</span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-mono text-slate-500 block">ACTIVE ANALYSIS PROFILE</span>
                      <h4 className="text-sm font-bold text-white mt-0.5">Career Affinity Mapping Radar</h4>
                    </div>
                    <Award className="h-6 w-6 text-cyan-400 animate-pulse" />
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Rather than operating as a basic screen inhibitor, Guardian AI continuously maps STEM affinities, structural logic queries, and vocabulary levels to suggest resources.
                  </p>
                  
                  {/* Visual list mimicking the dashboard telemetry network */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
                      <div className="flex items-center space-x-2.5">
                        <Cpu className="h-4 w-4 text-cyan-400 shrink-0" />
                        <span className="text-xs text-slate-300">Block programming compilation density</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-white">95/100</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
                      <div className="flex items-center space-x-2.5">
                        <Compass className="h-4 w-4 text-indigo-400 shrink-0" />
                        <span className="text-xs text-slate-300">Astrophysics JPL search surges</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-white">82/100</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ADVANCED MODULE 2: INTERACTIVE RISK INDEX SIMULATOR */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center pt-8">
            <div className="lg:col-span-6 lg:order-2 space-y-6">
              <div className="inline-flex items-center space-x-1.5 text-cyan-400 font-bold text-xs uppercase tracking-wider font-mono">
                <Brain className="h-4.5 w-4.5" />
                <span>AI Risk Score Simulator</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold font-display leading-tight text-white">
                Understand Online Safety Score Indicators
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Guardian AI analyzes multiple parameters (late-night activities, social ratio, blocked search density, safe zone deviations) to calculate a unified safety index. Use our simulator to observe how rules affect safety indicators.
              </p>

              {/* Slider */}
              <div className="space-y-5 rounded-2xl bg-slate-900/40 p-6 border border-white/5 backdrop-blur-md">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300">Daily Screen Time:</span>
                    <span className="text-cyan-400 font-mono font-bold">{riskSlider} Hours</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="8" 
                    step="0.5" 
                    value={riskSlider}
                    onChange={(e) => setRiskSlider(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">Primary Application Categories:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setRiskAppCategory("education")}
                      className={`py-2 text-xs font-medium rounded-full border transition-all cursor-pointer ${
                        riskAppCategory === "education"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold"
                          : "bg-transparent border-white/5 text-slate-400 hover:bg-white/5"
                      }`}
                    >
                      Educational (65%+)
                    </button>
                    <button
                      onClick={() => setRiskAppCategory("mixed")}
                      className={`py-2 text-xs font-medium rounded-full border transition-all cursor-pointer ${
                        riskAppCategory === "mixed"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/30 font-bold"
                          : "bg-transparent border-white/5 text-slate-400 hover:bg-white/5"
                      }`}
                    >
                      Mixed Content
                    </button>
                    <button
                      onClick={() => setRiskAppCategory("entertainment")}
                      className={`py-2 text-xs font-medium rounded-full border transition-all cursor-pointer ${
                        riskAppCategory === "entertainment"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30 font-bold"
                          : "bg-transparent border-white/5 text-slate-400 hover:bg-white/5"
                      }`}
                    >
                      Entertainment
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Gauge Display */}
            <div className="lg:col-span-6 flex justify-center lg:order-1">
              <div className="p-6 rounded-3xl w-full max-w-sm text-center border border-white/10 bg-slate-950/60 backdrop-blur-md shadow-2xl space-y-6">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono block">SIMULATED RADAR RESULTS</span>
                
                <div className="relative flex items-center justify-center">
                  <svg className="w-40 h-40 transform -rotate-90">
                    <circle 
                      cx="80" 
                      cy="80" 
                      r="70" 
                      stroke="currentColor" 
                      className="text-slate-800" 
                      strokeWidth="8" 
                      fill="transparent" 
                    />
                    <circle 
                      cx="80" 
                      cy="80" 
                      r="70" 
                      stroke="url(#riskGradient)" 
                      strokeWidth="10" 
                      strokeDasharray={440}
                      strokeDashoffset={440 - (440 * riskScore) / 100}
                      fill="transparent" 
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="50%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#ef4444" />
                      </linearGradient>
                    </defs>
                  </svg>
                  
                  <div className="absolute flex flex-col items-center">
                    <span className="text-4xl font-extrabold font-display text-white">{riskScore}</span>
                    <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider">Risk Score</span>
                  </div>
                </div>

                <div className={`p-3 rounded-2xl border text-xs font-semibold font-mono transition-all ${riskStatus.color}`}>
                  {riskStatus.label}
                </div>

                <p className="text-[10px] text-slate-500">
                  Calculated using average daily screen time of {riskSlider} hours against targeted browsing clusters.
                </p>
              </div>
            </div>
          </div>

          {/* FAMILY AI CHATBOT TEASER */}
          <div className="rounded-3xl bg-gradient-to-tr from-blue-600/90 to-indigo-600/90 p-8 text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
            <div className="space-y-3 max-w-xl z-10">
              <div className="inline-flex items-center space-x-1.5 rounded-full bg-white/10 border border-white/10 px-3.5 py-1 text-xs font-bold font-mono">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Family AI Assistant</span>
              </div>
              <h3 className="text-2xl font-extrabold font-display">Converse with Guardian AI</h3>
              <p className="text-sm text-blue-100 leading-relaxed">
                Have custom questions regarding activity? Query the Assistant like **"What did my child study this week?"** or **"Why did YouTube usage surge?"** to receive precise guidance digests powered by Groq High-Speed Neural AI.
              </p>
            </div>
            <button
              onClick={() => {
                const el = document.getElementById("ai-features");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="bg-white hover:bg-slate-100 text-slate-950 text-xs font-bold px-6 py-4 rounded-full transition-all cursor-pointer shadow-lg shrink-0 z-10 uppercase tracking-wider font-mono hover:scale-[1.02]"
            >
              Explore AI Safety Engine →
            </button>
          </div>

        </div>
      </section>

      {/* RECENT ACTIVITY TIMELINE FEED */}
      <section className="py-24 bg-slate-950 border-b border-white/5 relative z-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center space-y-4 mb-16">
            <span className="text-xs font-semibold tracking-wider text-cyan-400 font-mono uppercase">Live Activity Logs</span>
            <h3 className="text-3xl sm:text-4xl font-extrabold font-display text-white">
              Continuous Shield Updates
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Guardian AI captures events at the browser level, displaying instant telemetry on geofence logs and restricted domains.
            </p>
          </div>

          <ActivityFeedTimeline />
        </div>
      </section>

      {/* AI RECOMMENDATIONS SECTION */}
      <section className="py-24 bg-slate-950 border-b border-white/5 relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-12">
            <span className="text-xs font-semibold tracking-wider text-cyan-400 font-mono uppercase">AI Recommendations</span>
            <h3 className="text-3xl font-extrabold font-display text-white">
              Adaptive Parenting Presets
            </h3>
            <p className="text-sm text-slate-400">
              Guidance digests synthesized automatically based on screen metrics and interest patterns.
            </p>
          </div>

          <AIRecommendationsInsights />
        </div>
      </section>


      {/* FAQ SECTION Accordion */}
      <section id="faq" className="py-24 bg-slate-950 border-b border-white/5 relative z-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          
          <div className="text-center space-y-4 mb-16">
            <span className="text-xs font-semibold tracking-wider text-cyan-400 font-mono uppercase">Common Questions</span>
            <h3 className="text-3xl font-extrabold font-display text-white">
              Everything You Need to Know
            </h3>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className="rounded-2xl border border-white/5 bg-slate-900/20 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left text-sm font-semibold text-white focus:outline-none cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <ChevronDown className={`h-4.5 w-4.5 text-cyan-400 transition-transform duration-300 ${expandedFaq === index ? "rotate-180" : ""}`} />
                </button>
                
                <AnimatePresence initial={false}>
                  {expandedFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="p-5 pt-0 border-t border-white/5 text-xs text-slate-400 leading-relaxed">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* CONTACT & SUPPORT FORM SECTION */}
      <section id="contact" className="py-24 bg-slate-950 relative z-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="p-8 rounded-3xl border border-white/10 bg-slate-900/30 backdrop-blur-md shadow-2xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            <div className="md:col-span-5 space-y-4">
              <h3 className="text-2xl font-extrabold font-display text-white">Need Setup Help?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Our safety support specialists are online 24/7. We usually follow up within 10 minutes. Send us an inquiry regarding router-level setups or custom license scopes.
              </p>
              <div className="space-y-2 pt-2 text-[11px] text-slate-500 font-mono">
                <p>📍 Hyderabad, India, IND</p>
                <p>✉️ support@guardian-ai.com</p>
                <p>📞 Emergency hotline available to Elite users</p>
              </div>
            </div>

            <div className="md:col-span-7">
              {contactSubmitted ? (
                <div className="text-center py-8 space-y-3 bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl">
                  <Check className="h-10 w-10 text-emerald-400 mx-auto animate-bounce" />
                  <h4 className="font-bold text-white text-base">Message Safely Transmitted</h4>
                  <p className="text-xs text-slate-400">
                    Your request was synchronized successfully. An agent will follow up at your email address shortly.
                  </p>
                </div>
              ) : (
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (contactForm.name && contactForm.email && contactForm.msg) {
                      setContactSubmitted(true);
                    }
                  }} 
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold uppercase text-slate-400 font-mono">Name</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="John Doe"
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        className="w-full rounded-xl bg-slate-900 border border-white/5 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold uppercase text-slate-400 font-mono">Email</label>
                      <input 
                        type="email" 
                        required 
                        placeholder="john@example.com"
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        className="w-full rounded-xl bg-slate-900 border border-white/5 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase text-slate-400 font-mono">Message</label>
                    <textarea 
                      required 
                      rows={3}
                      placeholder="How can our support team assist you today?"
                      value={contactForm.msg}
                      onChange={(e) => setContactForm({ ...contactForm, msg: e.target.value })}
                      className="w-full rounded-xl bg-slate-900 border border-white/5 px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer font-mono uppercase tracking-wider hover:scale-[1.01]"
                  >
                    Send Secure Support Ticket
                  </button>
                </form>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* DEMO POPUP MODAL */}
      <AnimatePresence>
        {showDemoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-2xl w-full rounded-3xl border border-white/10 overflow-hidden relative shadow-2xl bg-slate-900"
            >
              
              {/* Modal Header */}
              <div className="p-5 border-b border-white/5 flex justify-between items-center bg-slate-950 text-white">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-cyan-400" />
                  <span className="font-display font-bold text-sm">Guardian AI Guided Walkthrough</span>
                </div>
                <button 
                  onClick={() => setShowDemoModal(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  id="close-demo-modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Simulated Video Player */}
              <div className="relative bg-slate-950 aspect-video flex items-center justify-center">
                <div className="absolute inset-0 opacity-25 bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=600')] bg-cover bg-center"></div>
                
                <div className="z-10 text-center space-y-4 p-6">
                  <div 
                    onClick={() => {
                      const el = document.getElementById("features");
                      setShowDemoModal(false);
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="h-16 w-16 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center mx-auto hover:scale-110 transition-transform cursor-pointer shadow-lg shadow-cyan-500/30"
                  >
                    <Play className="h-7 w-7 fill-current ml-1" />
                  </div>
                  <h4 className="text-base font-bold text-white font-display">Interactive Safety Overview</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Watch how easy it is to configure geofenced safe zones, view live safety updates, and consult the family digital wellness assistant.
                  </p>
                </div>
              </div>

              {/* Modal Footer with quick link */}
              <div className="p-4 bg-slate-950 text-center border-t border-white/5">
                <button
                  onClick={() => {
                    setShowDemoModal(false);
                    const el = document.getElementById("features");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="text-xs font-mono font-bold text-cyan-400 hover:underline cursor-pointer"
                >
                  Explore Platform Security Modules →
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
