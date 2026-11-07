import React, { useState, useRef, useEffect } from "react";
import { 
  ChevronRight, ChevronDown, Shield, Users, FileText, Check, 
  Sparkles, Smartphone, Battery, MapPin, Award, Sliders, ShieldAlert,
  LayoutDashboard, ArrowRightLeft, Radio
} from "lucide-react";
import { ChildProfile } from "../types";

interface DashboardBreadcrumbProps {
  activeTab: string;
  setActiveTab: (tabId: string) => void;
  profiles: ChildProfile[];
  selectedChildId: string;
  setSelectedChildId: (childId: string) => void;
  activeChild: ChildProfile;
}

const TAB_METADATA: Record<string, { label: string; shortLabel: string; icon: any; isReport?: boolean }> = {
  "overview": { label: "Safety Overview", shortLabel: "Overview", icon: LayoutDashboard },
  "ai-report": { label: "Weekly Summary Report", shortLabel: "Summary Report", icon: FileText, isReport: true },
  "family": { label: "Family & Children", shortLabel: "Family", icon: Users },
  "map": { label: "Live GPS Tracking", shortLabel: "Live Map", icon: MapPin },
  "danger-center": { label: "AI Safety Center", shortLabel: "Safety Center", icon: ShieldAlert, isReport: true },
  "devices": { label: "Devices & Usage", shortLabel: "Devices", icon: Smartphone },
  "controls": { label: "Content Shield", shortLabel: "Content Shield", icon: Sliders },
  "talent": { label: "Academics Hub", shortLabel: "Academics", icon: Award, isReport: true },
  "assistant": { label: "AI Assistant", shortLabel: "Assistant", icon: Sparkles },
  "sos": { label: "Alerts & SOS", shortLabel: "SOS Alerts", icon: ShieldAlert },
  "settings": { label: "Settings", shortLabel: "Settings", icon: Shield },
};

export default function DashboardBreadcrumb({
  activeTab,
  setActiveTab,
  profiles,
  selectedChildId,
  setSelectedChildId,
  activeChild
}: DashboardBreadcrumbProps) {
  const [isChildDropdownOpen, setIsChildDropdownOpen] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);

  const childDropdownRef = useRef<HTMLDivElement>(null);
  const viewDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (childDropdownRef.current && !childDropdownRef.current.contains(event.target as Node)) {
        setIsChildDropdownOpen(false);
      }
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentTabInfo = TAB_METADATA[activeTab] || {
    label: activeTab.toUpperCase(),
    shortLabel: activeTab,
    icon: Shield
  };
  const CurrentTabIcon = currentTabInfo.icon;
  const isViewingSummaryReport = activeTab === "ai-report";

  return (
    <nav 
      aria-label="Breadcrumb navigation trail"
      className="bg-[#08111F]/90 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-2.5 sm:px-4 shadow-lg shadow-cyan-950/20"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* LEFT: HIERARCHICAL BREADCRUMB PATH */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-medium">
          
          {/* Segment 1: Root / Dashboard */}
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all font-mono font-semibold cursor-pointer group"
            title="Return to Dashboard Overview"
          >
            <Shield className="h-3.5 w-3.5 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
            <span>Dashboard</span>
          </button>

          <ChevronRight className="h-3.5 w-3.5 text-slate-600 shrink-0" />

          {/* Segment 2: Child Profile Selector Segment */}
          <div className="relative" ref={childDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsChildDropdownOpen(!isChildDropdownOpen);
                setIsViewDropdownOpen(false);
              }}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all font-semibold cursor-pointer border ${
                isChildDropdownOpen 
                  ? "bg-teal-500/20 border-teal-400/80 text-teal-200 shadow-[0_0_12px_rgba(20,184,166,0.2)]"
                  : "bg-slate-900/80 border-slate-800 hover:border-teal-500/40 text-slate-200 hover:bg-slate-800/80"
              }`}
              title="Switch active child profile"
              aria-expanded={isChildDropdownOpen}
            >
              <div className="relative">
                <img 
                  src={activeChild.avatar} 
                  alt={activeChild.name} 
                  className="h-5 w-5 rounded-full object-cover border border-teal-400/60" 
                />
                <span className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-slate-950 ${
                  activeChild.status === "online" 
                    ? "bg-emerald-400" 
                    : activeChild.status === "locked"
                    ? "bg-rose-400"
                    : "bg-slate-400"
                }`} />
              </div>

              <span className="font-bold text-teal-300 font-display">{activeChild.name}</span>
              
              <span className="hidden md:inline-flex items-center text-[10px] font-mono text-slate-400 font-normal">
                <Battery className="h-3 w-3 text-emerald-400 mr-0.5" />
                {activeChild.battery}%
              </span>

              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${isChildDropdownOpen ? "rotate-180 text-teal-400" : ""}`} />
            </button>

            {/* Child Selector Dropdown Menu */}
            {isChildDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl bg-slate-950/95 border border-teal-500/30 p-2 shadow-2xl z-50 backdrop-blur-xl animate-fade-in space-y-1">
                <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800/80 flex items-center justify-between">
                  <span>Switch Child Profile</span>
                  <span className="text-teal-400">{profiles.length} Active</span>
                </div>

                {profiles.map((child) => {
                  const isSelected = child.id === selectedChildId;
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => {
                        setSelectedChildId(child.id);
                        setIsChildDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                        isSelected 
                          ? "bg-teal-500/20 border border-teal-500/40 text-white" 
                          : "hover:bg-slate-900 text-slate-300 hover:text-white border border-transparent"
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <img 
                            src={child.avatar} 
                            alt={child.name} 
                            className="h-7 w-7 rounded-full object-cover border border-slate-700" 
                          />
                          <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-slate-950 ${
                            child.status === "online" 
                              ? "bg-emerald-400 animate-pulse" 
                              : child.status === "locked"
                              ? "bg-rose-400"
                              : "bg-slate-400"
                          }`} />
                        </div>
                        <div className="min-w-0 truncate">
                          <div className="text-xs font-bold truncate flex items-center gap-1.5">
                            <span>{child.name}</span>
                            <span className="text-[10px] font-normal text-slate-400">({child.age} yrs)</span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate font-mono">
                            {child.device} • {child.battery}%
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <Check className="h-4 w-4 text-teal-400 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <ChevronRight className="h-3.5 w-3.5 text-slate-600 shrink-0" />

          {/* Segment 3: Current View / Report Dropdown Segment */}
          <div className="relative" ref={viewDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsViewDropdownOpen(!isViewDropdownOpen);
                setIsChildDropdownOpen(false);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all font-semibold cursor-pointer border ${
                isViewDropdownOpen 
                  ? "bg-cyan-500/20 border-cyan-400/80 text-cyan-200 shadow-[0_0_12px_rgba(0,229,255,0.2)]"
                  : isViewingSummaryReport
                  ? "bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border-cyan-500/40 text-cyan-300"
                  : "bg-slate-900/80 border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:bg-slate-800/80"
              }`}
              title="Jump to another section or report"
              aria-expanded={isViewDropdownOpen}
            >
              <CurrentTabIcon className={`h-3.5 w-3.5 ${isViewingSummaryReport ? "text-cyan-400" : "text-slate-400"} shrink-0`} />
              <span className="font-bold">{currentTabInfo.shortLabel}</span>
              {currentTabInfo.isReport && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                  REPORT
                </span>
              )}
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${isViewDropdownOpen ? "rotate-180 text-cyan-400" : ""}`} />
            </button>

            {/* View Selector Dropdown */}
            {isViewDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 w-56 rounded-2xl bg-slate-950/95 border border-cyan-500/30 p-2 shadow-2xl z-50 backdrop-blur-xl animate-fade-in space-y-1">
                <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800/80">
                  Quick View Jump
                </div>
                
                {/* Highlighted Reports group */}
                <div className="pt-1">
                  <div className="px-2 py-0.5 text-[9px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                    Parenting Reports & Audits
                  </div>
                  {[
                    { id: "ai-report", label: "Weekly Summary Report", icon: FileText },
                    { id: "danger-center", label: "Safety Incidents Center", icon: ShieldAlert },
                    { id: "talent", label: "Academics & Talent Report", icon: Award }
                  ].map((r) => {
                    const IconComp = r.icon;
                    const isSelected = activeTab === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(r.id);
                          setIsViewDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                          isSelected 
                            ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 font-bold" 
                            : "hover:bg-slate-900 text-slate-300 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <IconComp className="h-3.5 w-3.5 text-cyan-400" />
                          <span>{r.label}</span>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-cyan-400" />}
                      </button>
                    );
                  })}
                </div>

                {/* Core Live Views */}
                <div className="pt-1 border-t border-slate-800/80">
                  <div className="px-2 py-0.5 text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                    Live Telemetry & Controls
                  </div>
                  {[
                    { id: "overview", label: "Overview Dashboard", icon: LayoutDashboard },
                    { id: "map", label: "Live GPS Tracking", icon: MapPin },
                    { id: "devices", label: "Devices & Usage", icon: Smartphone },
                    { id: "controls", label: "Content Shield Limits", icon: Sliders },
                    { id: "family", label: "Family & Child Accounts", icon: Users }
                  ].map((v) => {
                    const IconComp = v.icon;
                    const isSelected = activeTab === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(v.id);
                          setIsViewDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                          isSelected 
                            ? "bg-teal-500/20 border border-teal-500/40 text-teal-200 font-bold" 
                            : "hover:bg-slate-900 text-slate-300 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <IconComp className="h-3.5 w-3.5 text-slate-400" />
                          <span>{v.label}</span>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-teal-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: FAST-SWITCHING ACTIONS (CHILD PROFILES & SUMMARY REPORTS) */}
        <div className="flex items-center gap-2 flex-wrap">

          {/* Child Profile Quick Switcher Chips */}
          <div className="hidden sm:flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 px-1.5">
              Child:
            </span>
            {profiles.map((p) => {
              const isSelected = p.id === selectedChildId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedChildId(p.id)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-teal-500/25 text-teal-300 border border-teal-400/80 shadow-[0_0_10px_rgba(20,184,166,0.25)]"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                  }`}
                  title={`Switch active view to ${p.name}`}
                >
                  <img 
                    src={p.avatar} 
                    alt={p.name} 
                    className="h-4 w-4 rounded-full object-cover border border-slate-600" 
                  />
                  <span>{p.name}</span>
                </button>
              );
            })}
          </div>

          {/* FAST TOGGLE: SUMMARY REPORT vs OVERVIEW */}
          {isViewingSummaryReport ? (
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-all font-bold text-xs cursor-pointer shadow-sm group"
              title="Return to Overview Dashboard"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-cyan-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>Overview</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab("ai-report")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-indigo-500/20 hover:from-cyan-500/30 hover:to-indigo-500/30 text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 transition-all font-bold text-xs cursor-pointer shadow-[0_0_15px_rgba(0,229,255,0.12)] group"
              title={`Open Weekly Summary Report for ${activeChild.name}`}
            >
              <FileText className="h-3.5 w-3.5 text-cyan-400 group-hover:rotate-6 transition-transform" />
              <span>Summary Report</span>
              <span className="hidden md:inline-block text-[9px] font-mono bg-cyan-400/20 text-cyan-200 px-1.5 py-0.2 rounded-full border border-cyan-400/30">
                AI
              </span>
            </button>
          )}

          {/* Fast Switch Between Sibling Summary Reports if currently in AI Report */}
          {isViewingSummaryReport && profiles.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const currentIndex = profiles.findIndex(p => p.id === selectedChildId);
                const nextIndex = (currentIndex + 1) % profiles.length;
                setSelectedChildId(profiles[nextIndex].id);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold transition-all cursor-pointer"
              title="Cycle to next child's summary report"
            >
              <ArrowRightLeft className="h-3 w-3 text-cyan-400" />
              <span className="hidden sm:inline">Next Child</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
