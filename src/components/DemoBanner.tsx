import React from "react";
import { Sparkles, Shield, Compass, HeartHandshake, ShieldAlert, ArrowLeft, Eye, RotateCcw } from "lucide-react";
import { resetDemoFamilyState } from "../lib/createDemoSync";

interface DemoBannerProps {
  currentRole: "parent" | "child" | "admin" | "hub";
  navigate: (to: string) => void;
}

export default function DemoBanner({ currentRole, navigate }: DemoBannerProps) {
  return (
    <div className="sticky top-0 z-50 bg-gradient-to-r from-slate-950 via-cyan-950/80 to-slate-950 border-b border-cyan-500/30 px-3 sm:px-4 py-2 backdrop-blur-md shadow-lg shadow-cyan-950/40">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center space-x-2 text-center sm:text-left">
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shrink-0">
            <Sparkles className="h-3 w-3 mr-1 text-cyan-400 animate-pulse" />
            <span>DEV PREVIEW (READ ONLY)</span>
          </span>
          <span className="text-xs text-slate-300 font-medium hidden md:inline">
            Faculty Evaluation Sandbox • Sample mock data only • Real Firebase data & auth unchanged
          </span>
        </div>

        <div className="flex items-center space-x-1.5 flex-wrap justify-center">
          <button
            onClick={() => navigate("/demo/parent")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1 ${
              currentRole === "parent" 
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/30" 
                : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
            }`}
          >
            <HeartHandshake className="h-3.5 w-3.5 text-blue-400" />
            <span>Parent Demo</span>
          </button>

          <button
            onClick={() => navigate("/demo/child")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1 ${
              currentRole === "child" 
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30" 
                : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
            }`}
          >
            <Compass className="h-3.5 w-3.5 text-emerald-400" />
            <span>Child Demo</span>
          </button>

          <button
            onClick={() => navigate("/demo/admin")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1 ${
              currentRole === "admin" 
                ? "bg-rose-600 text-white shadow-md shadow-rose-500/30" 
                : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
            <span>Admin Demo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              resetDemoFamilyState();
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition cursor-pointer flex items-center space-x-1"
            title="Reset Demo Family Link State to initial pending request"
          >
            <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
            <span>Reset Demo</span>
          </button>

          <button
            onClick={() => navigate("/")}
            className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer flex items-center space-x-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Exit Demo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
