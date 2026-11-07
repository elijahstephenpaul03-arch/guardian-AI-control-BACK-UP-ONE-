import React from "react";
import { 
  HeartHandshake, Compass, ShieldAlert, Sparkles, ArrowRight, ShieldCheck, 
  MapPin, Clock, Brain, Laptop, CheckCircle2, Lock, ArrowLeft 
} from "lucide-react";

interface DemoHubProps {
  navigate: (to: string) => void;
}

export default function DemoHub({ navigate }: DemoHubProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.15),rgba(255,255,255,0))] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 relative z-10 flex-1 flex flex-col justify-center">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
          <div className="inline-flex items-center space-x-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 px-4 py-1 text-xs font-mono font-bold text-cyan-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>DEVELOPMENT PREVIEW & FACULTY EVALUATION</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold font-display tracking-tight text-white">
            Explore Guardian AI <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Demo Portals</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Welcome! Explore all features, workflows, and interactive dashboards without logging in. 
            All demonstration portals operate in a read-only evaluation sandbox using clearly labeled mock data.
          </p>

          <div className="pt-2 flex flex-wrap justify-center gap-3 text-xs text-slate-400">
            <span className="flex items-center space-x-1 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Zero Login Required</span>
            </span>
            <span className="flex items-center space-x-1 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
              <span>Isolated Sample Data</span>
            </span>
            <span className="flex items-center space-x-1 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
              <Lock className="h-3.5 w-3.5 text-amber-400" />
              <span>Firebase Security Unchanged</span>
            </span>
          </div>
        </div>

        {/* 3 Interactive Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto w-full">
          {/* Card 1: Parent Demo */}
          <div 
            onClick={() => navigate("/demo/parent")}
            className="bg-slate-900/90 border border-blue-500/30 hover:border-blue-500/70 rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 hover:scale-[1.02] transition-all cursor-pointer shadow-xl shadow-blue-950/40 group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
                <HeartHandshake className="h-7 w-7" />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition">Parent Portal</h3>
                  <span className="text-[10px] font-mono bg-blue-950/80 border border-blue-800/60 text-blue-300 px-2 py-0.5 rounded font-semibold">
                    /demo/parent
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Experience live child monitoring, Leaflet GPS safe zone maps, app screen time controls, weekly AI behavioral reports, and suspicious threat blocking.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <span>Kondapur, Hyderabad Safe Zones</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>Interactive App Limits & Remote Lock</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Brain className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                  <span>AI Digital Wellness Insights</span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between text-xs font-bold text-blue-400 group-hover:text-blue-300 border-t border-slate-800/80">
              <span>Launch Parent Demo</span>
              <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* Card 2: Child Demo */}
          <div 
            onClick={() => navigate("/demo/child")}
            className="bg-slate-900/90 border border-emerald-500/30 hover:border-emerald-500/70 rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 hover:scale-[1.02] transition-all cursor-pointer shadow-xl shadow-emerald-950/40 group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-slate-950 transition">
                <Compass className="h-7 w-7" />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition">Child Explorer</h3>
                  <span className="text-[10px] font-mono bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 px-2 py-0.5 rounded font-semibold">
                    /demo/child
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Test the student interface featuring daily learning goals, interactive homework helper, safe cyber rules, and simulated one-tap emergency SOS.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
                <div className="flex items-center space-x-2">
                  <Laptop className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Interactive Homework & Daily Goals</span>
                </div>
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                  <span>Cyber Safety Habit Quizzes</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>Safe Simulated Emergency SOS</span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:text-emerald-300 border-t border-slate-800/80">
              <span>Launch Child Demo</span>
              <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition" />
            </div>
          </div>

          {/* Card 3: Admin Demo */}
          <div 
            onClick={() => navigate("/demo/admin")}
            className="bg-slate-900/90 border border-rose-500/30 hover:border-rose-500/70 rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 hover:scale-[1.02] transition-all cursor-pointer shadow-xl shadow-rose-950/40 group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition">
                <ShieldAlert className="h-7 w-7" />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white group-hover:text-rose-400 transition">Admin Console</h3>
                  <span className="text-[10px] font-mono bg-rose-950/80 border border-rose-800/60 text-rose-300 px-2 py-0.5 rounded font-semibold">
                    /demo/admin
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Inspect the supervisor and faculty administration panel with user directory overview, system policies, live uptime telemetry, and threat streams.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  <span>Platform & API Health Diagnostics</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>Registration Gateway & Policy Controls</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Brain className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <span>Neutralized Threat Log Streams</span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between text-xs font-bold text-rose-400 group-hover:text-rose-300 border-t border-slate-800/80">
              <span>Launch Admin Demo</span>
              <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition" />
            </div>
          </div>
        </div>

        {/* Back to Home Button */}
        <div className="mt-12 text-center">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Public Homepage</span>
          </button>
        </div>
      </div>
    </div>
  );
}
