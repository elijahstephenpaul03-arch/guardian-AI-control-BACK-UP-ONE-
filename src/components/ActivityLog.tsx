import React, { useState, useMemo } from "react";
import { 
  Activity, MapPin, Zap, Shield, AlertTriangle, ShieldAlert, 
  Search, Filter, Clock, Smartphone, ChevronDown, ChevronUp,
  RefreshCw, CheckCircle2, AlertOctagon, TrendingUp, Navigation,
  Sparkles, ExternalLink, SlidersHorizontal, Lock, Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ActivityLog, ChildProfile, SafetyLevel } from "../types";

export interface ActivityLogProps {
  logs: ActivityLog[];
  profiles: ChildProfile[];
  activeChildId?: string;
  onSelectChild?: (childId: string) => void;
  onAddLog?: (log: ActivityLog) => Promise<void> | void;
  className?: string;
  maxHeight?: string;
  showHeaderControls?: boolean;
  onNavigateToMap?: () => void;
  onNavigateToControls?: () => void;
}

export default function ActivityLogComponent({
  logs = [],
  profiles = [],
  activeChildId,
  onSelectChild,
  onAddLog,
  className = "",
  maxHeight = "max-h-[520px]",
  showHeaderControls = true,
  onNavigateToMap,
  onNavigateToControls
}: ActivityLogProps) {
  // Local filtering states
  const [selectedChildFilter, setSelectedChildFilter] = useState<string>(activeChildId || "all");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [selectedSafetyFilter, setSelectedSafetyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Sync internal child filter with prop if activeChildId changes
  React.useEffect(() => {
    if (activeChildId && selectedChildFilter !== activeChildId && selectedChildFilter !== "all") {
      setSelectedChildFilter(activeChildId);
    }
  }, [activeChildId]);

  // Compute metrics for quick stats bar
  const stats = useMemo(() => {
    const relevant = selectedChildFilter === "all" 
      ? logs 
      : logs.filter(l => l.childId === selectedChildFilter);

    const locationChanges = relevant.filter(l => l.type === "location" || l.title.toLowerCase().includes("location") || l.title.toLowerCase().includes("zone")).length;
    const appSpikes = relevant.filter(l => l.type === "app" && (l.title.toLowerCase().includes("spike") || (l.duration && l.duration > 60) || l.safetyLevel === "warning")).length;
    const safetyAlerts = relevant.filter(l => l.safetyLevel === "severe" || l.safetyLevel === "warning" || l.type === "safety").length;

    return {
      total: relevant.length,
      locationChanges,
      appSpikes,
      safetyAlerts
    };
  }, [logs, selectedChildFilter]);

  // Filtered and sorted activity logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Child filter
      if (selectedChildFilter !== "all" && log.childId !== selectedChildFilter) {
        return false;
      }

      // Type filter
      if (selectedTypeFilter !== "all") {
        if (selectedTypeFilter === "spikes") {
          // Special filter for app spikes
          const isSpike = log.type === "app" && (
            log.title.toLowerCase().includes("spike") || 
            (log.duration && log.duration > 50) ||
            log.description.toLowerCase().includes("surge") ||
            log.description.toLowerCase().includes("threshold")
          );
          if (!isSpike) return false;
        } else if (log.type !== selectedTypeFilter) {
          return false;
        }
      }

      // Safety level filter
      if (selectedSafetyFilter !== "all" && log.safetyLevel !== selectedSafetyFilter) {
        return false;
      }

      // Text query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = log.title?.toLowerCase().includes(query);
        const matchesDesc = log.description?.toLowerCase().includes(query);
        const childName = profiles.find(p => p.id === log.childId)?.name.toLowerCase() || "";
        const matchesChild = childName.includes(query);
        if (!matchesTitle && !matchesDesc && !matchesChild) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, selectedChildFilter, selectedTypeFilter, selectedSafetyFilter, searchQuery, profiles]);

  // Quick helper to format relative time
  const formatRelativeTime = (isoString: string) => {
    try {
      const now = new Date();
      const past = new Date(isoString);
      const diffMs = now.getTime() - past.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      return past.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return "Recent";
    }
  };

  // Quick simulator action
  const handleSimulateEvent = async (type: "location" | "spike") => {
    if (!onAddLog) return;
    setIsSimulating(true);

    const targetChild = profiles.find(p => p.id === (selectedChildFilter === "all" ? profiles[0]?.id : selectedChildFilter)) || profiles[0];
    const childId = targetChild?.id || "child-1";
    const childName = targetChild?.name || "Leo";

    let newLog: ActivityLog;

    if (type === "location") {
      const locationVariations = [
        {
          title: "Location Shift: Safe Zone Arrival",
          description: `${childName} entered 'Kondapur Sports Complex Safe Zone' via North Gate beacon.`,
          safetyLevel: "safe" as SafetyLevel
        },
        {
          title: "Location Change: Left School Grounds",
          description: `GPS geofence boundary crossed. ${childName} departed Oakridge Tech Academy towards transit corridor.`,
          safetyLevel: "safe" as SafetyLevel
        },
        {
          title: "Geofence Checkpoint: Metro Transit Line",
          description: `Active beacon telemetry confirmed ${childName} boarded Hitec City Metro route. Transit speed: 32 km/h.`,
          safetyLevel: "safe" as SafetyLevel
        }
      ];
      const pick = locationVariations[Math.floor(Math.random() * locationVariations.length)];
      newLog = {
        id: `log-loc-${Date.now()}`,
        childId,
        type: "location",
        title: pick.title,
        description: pick.description,
        timestamp: new Date().toISOString(),
        safetyLevel: pick.safetyLevel,
        duration: 0
      };
    } else {
      const spikeVariations = [
        {
          title: `App Usage Spike: Roblox (+${Math.floor(Math.random() * 80) + 110}%)`,
          description: `Telemetry surge detected: ${childName} spent 85 consecutive minutes on Roblox during designated study block. Daily quota exceeded.`,
          duration: 85,
          safetyLevel: "warning" as SafetyLevel
        },
        {
          title: `App Usage Spike: YouTube Shorts (+${Math.floor(Math.random() * 50) + 90}%)`,
          description: `Rapid video looping spike detected: 55 minutes of high-velocity video feeds during homework time.`,
          duration: 55,
          safetyLevel: "warning" as SafetyLevel
        },
        {
          title: `App Activity Spike: Minecraft (+120%)`,
          description: `Heavy graphics & CPU telemetry alert: ${childName} played multiplayer creative mode for 90 minutes.`,
          duration: 90,
          safetyLevel: "warning" as SafetyLevel
        }
      ];
      const pick = spikeVariations[Math.floor(Math.random() * spikeVariations.length)];
      newLog = {
        id: `log-spike-${Date.now()}`,
        childId,
        type: "app",
        title: pick.title,
        description: pick.description,
        timestamp: new Date().toISOString(),
        safetyLevel: pick.safetyLevel,
        duration: pick.duration
      };
    }

    try {
      await onAddLog(newLog);
      setActionNotice(`Logged new ${type === "location" ? "Location Change" : "App Spike"} event for ${childName}!`);
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err) {
      console.error("Failed to add simulated activity log:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  const getLogIcon = (log: ActivityLog) => {
    const isAppSpike = log.type === "app" && (
      log.title.toLowerCase().includes("spike") || 
      (log.duration && log.duration > 60) ||
      log.safetyLevel === "warning"
    );

    if (log.type === "location") {
      return <MapPin className="h-4 w-4 text-emerald-400" />;
    }
    if (isAppSpike) {
      return <Zap className="h-4 w-4 text-amber-400 animate-pulse" />;
    }
    if (log.type === "app") {
      return <Smartphone className="h-4 w-4 text-cyan-400" />;
    }
    if (log.type === "safety" || log.safetyLevel === "severe") {
      return <ShieldAlert className="h-4 w-4 text-rose-400" />;
    }
    if (log.type === "sos") {
      return <AlertOctagon className="h-4 w-4 text-rose-500 animate-bounce" />;
    }
    return <Activity className="h-4 w-4 text-teal-400" />;
  };

  const getLogBadgeStyle = (log: ActivityLog) => {
    const isAppSpike = log.type === "app" && (
      log.title.toLowerCase().includes("spike") || 
      (log.duration && log.duration > 60) ||
      log.safetyLevel === "warning"
    );

    if (log.type === "location") {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
    if (isAppSpike) {
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    }
    if (log.safetyLevel === "severe" || log.type === "sos") {
      return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    }
    if (log.safetyLevel === "warning") {
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
    return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
  };

  return (
    <div className={`bg-[#08111F]/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col ${className}`}>
      
      {/* Background cyber accent glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl pointer-events-none -z-10"></div>

      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-teal-500/20 to-cyan-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0 shadow-inner">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base sm:text-lg font-black font-display text-white tracking-tight">
                Activity Log
              </h3>
              <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-[10px] font-mono text-teal-400 font-bold uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-ping"></span>
                <span>Live Feed</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-tight">
              Real-time child telemetry: location transitions, app surges & security checkpoints
            </p>
          </div>
        </div>

        {/* Quick Simulation & Simulator Actions */}
        {onAddLog && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => handleSimulateEvent("location")}
              disabled={isSimulating}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
              title="Simulate GPS boundary or safe zone transition"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>+ Location Shift</span>
            </button>
            <button
              onClick={() => handleSimulateEvent("spike")}
              disabled={isSimulating}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
              title="Simulate sudden screen-time or gaming surge"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>+ App Spike</span>
            </button>
          </div>
        )}
      </div>

      {/* FEEDBACK NOTICE BANNER */}
      <AnimatePresence>
        {actionNotice && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="my-3 px-3 py-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs flex items-center space-x-2"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-400" />
            <span className="font-semibold">{actionNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3.5">
        <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center space-x-2.5">
          <div className="h-7 w-7 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
            <Activity className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-mono uppercase font-bold">Total Logs</div>
            <div className="text-sm font-black text-white font-mono">{stats.total}</div>
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center space-x-2.5">
          <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <MapPin className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-mono uppercase font-bold">Location Shifts</div>
            <div className="text-sm font-black text-emerald-300 font-mono">{stats.locationChanges}</div>
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center space-x-2.5">
          <div className="h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Zap className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-mono uppercase font-bold">App Spikes</div>
            <div className="text-sm font-black text-amber-300 font-mono">{stats.appSpikes}</div>
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center space-x-2.5">
          <div className="h-7 w-7 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-mono uppercase font-bold">Alerts</div>
            <div className="text-sm font-black text-rose-400 font-mono">{stats.safetyAlerts}</div>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      {showHeaderControls && (
        <div className="space-y-2.5 mb-3.5 bg-slate-950/40 p-3 rounded-2xl border border-slate-800/60">
          
          {/* Top row: Child tabs + Search */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            {/* Child Selector Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <button
                onClick={() => {
                  setSelectedChildFilter("all");
                  if (onSelectChild) onSelectChild("");
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedChildFilter === "all"
                    ? "bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20"
                    : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                All Children ({logs.length})
              </button>

              {profiles.map((profile) => {
                const isSelected = selectedChildFilter === profile.id;
                const count = logs.filter(l => l.childId === profile.id).length;
                return (
                  <button
                    key={profile.id}
                    onClick={() => {
                      setSelectedChildFilter(profile.id);
                      if (onSelectChild) onSelectChild(profile.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? "bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20"
                        : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    <img 
                      src={profile.avatar} 
                      alt={profile.name} 
                      className="h-4 w-4 rounded-full object-cover"
                    />
                    <span>{profile.name}</span>
                    <span className={`text-[10px] font-mono px-1 rounded ${
                      isSelected ? "bg-slate-950/30 text-slate-950" : "bg-slate-800 text-slate-400"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Keyword Search Input */}
            <div className="relative min-w-[200px] flex-1 md:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search activity, app, location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-slate-500 hover:text-white text-xs font-mono"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Bottom row: Category Filters (Pills) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-[11px]">
            <span className="text-[10px] font-mono uppercase text-slate-500 font-bold shrink-0 mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Filter:
            </span>

            {[
              { id: "all", label: "All Types" },
              { id: "location", label: "📍 Location Changes" },
              { id: "spikes", label: "⚡ App Spikes" },
              { id: "app", label: "📱 App Activity" },
              { id: "safety", label: "🛡️ AI Safety" }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedTypeFilter(cat.id)}
                className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedTypeFilter === cat.id
                    ? "bg-slate-800 text-cyan-300 border border-cyan-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                }`}
              >
                {cat.label}
              </button>
            ))}

            <div className="h-4 w-px bg-slate-800 mx-1 shrink-0"></div>

            {/* Safety level toggles */}
            {[
              { id: "all", label: "All Severity" },
              { id: "safe", label: "Safe", color: "text-emerald-400" },
              { id: "warning", label: "Warnings", color: "text-amber-400" },
              { id: "severe", label: "Severe", color: "text-rose-400" }
            ].map(lvl => (
              <button
                key={lvl.id}
                onClick={() => setSelectedSafetyFilter(lvl.id)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedSafetyFilter === lvl.id
                    ? "bg-slate-800 text-white border border-slate-700"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {lvl.label}
              </button>
            ))}

            {(selectedTypeFilter !== "all" || selectedSafetyFilter !== "all" || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedTypeFilter("all");
                  setSelectedSafetyFilter("all");
                  setSearchQuery("");
                }}
                className="ml-auto text-[10px] text-teal-400 hover:underline font-mono shrink-0 cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* SCROLLABLE LIST VIEW */}
      <div className={`overflow-y-auto space-y-2.5 pr-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent ${maxHeight}`}>
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-dashed border-slate-800/80 space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-slate-900 text-slate-500 flex items-center justify-center mx-auto border border-slate-800">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">No matching activity records</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {searchQuery || selectedTypeFilter !== "all" || selectedSafetyFilter !== "all"
                  ? "Try adjusting your search criteria or resetting the category filters."
                  : "Activity events will appear here in real-time as children use their connected devices."}
              </p>
            </div>
            {onAddLog && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  onClick={() => handleSimulateEvent("location")}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400 transition cursor-pointer"
                >
                  Generate Location Shift
                </button>
                <button
                  onClick={() => handleSimulateEvent("spike")}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-400 transition cursor-pointer"
                >
                  Generate App Spike
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredLogs.map((log) => {
            const child = profiles.find(p => p.id === log.childId) || {
              id: log.childId,
              name: "Child User",
              avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=100"
            };

            const isExpanded = expandedLogId === log.id;
            const isLocation = log.type === "location" || log.title.toLowerCase().includes("location");
            const isAppSpike = log.type === "app" && (
              log.title.toLowerCase().includes("spike") || 
              (log.duration && log.duration > 60) ||
              log.safetyLevel === "warning"
            );

            return (
              <motion.div
                key={log.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isAppSpike 
                    ? "bg-[#0B1527]/90 border-amber-500/30 hover:border-amber-500/50" 
                    : isLocation
                    ? "bg-[#071720]/80 border-emerald-500/25 hover:border-emerald-500/40"
                    : log.safetyLevel === "severe"
                    ? "bg-[#180C14]/80 border-rose-500/30 hover:border-rose-500/50"
                    : "bg-[#060D1A]/70 border-slate-800/80 hover:border-slate-700"
                }`}
              >
                {/* Main Card Header */}
                <div 
                  className="flex items-start space-x-3 cursor-pointer"
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                >
                  {/* Category Icon Badge */}
                  <div className={`p-2 rounded-xl mt-0.5 shrink-0 border ${getLogBadgeStyle(log)}`}>
                    {getLogIcon(log)}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center space-x-2">
                        {/* Child indicator pill */}
                        <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-300">
                          <img 
                            src={child.avatar} 
                            alt={child.name} 
                            className="h-3 w-3 rounded-full object-cover"
                          />
                          <span>{child.name}</span>
                        </div>

                        {/* Special App Spike or Location badge */}
                        {isAppSpike && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1">
                            <Zap className="h-2.5 w-2.5" />
                            <span>Usage Surge</span>
                          </span>
                        )}

                        {isLocation && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1">
                            <Navigation className="h-2.5 w-2.5" />
                            <span>Transit</span>
                          </span>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center space-x-1 text-[10px] font-mono text-slate-400">
                        <Clock className="h-3 w-3 text-slate-500" />
                        <span>{formatRelativeTime(log.timestamp)}</span>
                      </div>
                    </div>

                    {/* Title */}
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs sm:text-sm font-bold text-white leading-tight">
                        {log.title}
                      </h4>
                      <button 
                        type="button"
                        aria-label={isExpanded ? "Collapse event details" : "Expand event details"}
                        className="text-slate-500 hover:text-white p-0.5"
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {log.description}
                    </p>

                    {/* Quick Metadata Tags */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap text-[10px] font-mono">
                      {log.duration !== undefined && log.duration > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center space-x-1">
                          <Clock className="h-2.5 w-2.5 text-cyan-400" />
                          <span>Duration: {log.duration} mins</span>
                        </span>
                      )}

                      {isLocation && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-emerald-400 flex items-center space-x-1">
                          <MapPin className="h-2.5 w-2.5" />
                          <span>Hyderabad GPS Zone</span>
                        </span>
                      )}

                      <span className={`px-2 py-0.5 rounded-md font-bold uppercase ${
                        log.safetyLevel === "severe" 
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                          : log.safetyLevel === "warning"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}>
                        Level: {log.safetyLevel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details Accordion */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 pt-3 border-t border-slate-800/80 space-y-2.5 text-xs"
                    >
                      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                        <div>
                          <span className="text-slate-500 block">EXACT TIMESTAMP</span>
                          <span className="text-slate-200">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">EVENT ID</span>
                          <span className="text-cyan-400 truncate block">{log.id}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">CATEGORY / MODULE</span>
                          <span className="text-slate-200 uppercase">{log.type} Monitor</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">INTEGRITY CHECK</span>
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Encrypted & Verified
                          </span>
                        </div>
                      </div>

                      {/* Actionable buttons */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {isLocation && onNavigateToMap && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToMap();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            <span>View on Live Map</span>
                          </button>
                        )}

                        {isAppSpike && onNavigateToControls && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToControls();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            <span>Enforce App Limit</span>
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionNotice(`Marked event ${log.id.slice(0, 8)} as acknowledged.`);
                            setTimeout(() => setActionNotice(null), 3000);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center space-x-1 transition cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Acknowledge Log</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* FOOTER BAR */}
      <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <div className="flex items-center space-x-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
          <span>Showing {filteredLogs.length} of {logs.length} logged activities</span>
        </div>
        <span className="hidden sm:inline">End-to-End Encrypted Cloud Telemetry</span>
      </div>

    </div>
  );
}
