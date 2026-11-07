import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Shield, Users, QrCode, AlertTriangle, BookOpen, 
  GraduationCap, Sparkles, CheckCircle2, ChevronRight, 
  ChevronLeft, X, Rocket, LayoutDashboard, KeyRound
} from "lucide-react";

interface FeatureTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (role: "parent" | "child", tab?: string) => void;
}

const TOUR_STEPS = [
  {
    step: 1,
    title: "Family Linking System & QR Code",
    role: "Parent & Child",
    icon: QrCode,
    badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    description: "Connect parent and child accounts securely without passwords.",
    details: [
      "Parent opens Parent Dashboard → Clicks 'Family Code' in the top header.",
      "Unique 6-character Family Code and scannable QR Code are generated.",
      "Child enters code in Child Dashboard → Sends instant request.",
      "Parent receives real-time notification to approve or decline connection."
    ],
    testLocation: "Header → Family Code Button (Parent) / Join Family Box (Child)"
  },
  {
    step: 2,
    title: "Real-time Emergency SOS Alert",
    role: "Child to Parent",
    icon: AlertTriangle,
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    description: "Instant emergency panic button with GPS location logging.",
    details: [
      "Child selects 'Emergency SOS' tab in Child Dashboard.",
      "Clicks '🚨 PRESS FOR SOS EMERGENCY' panic button.",
      "Firestore onSnapshot triggers an instant red distress banner on Parent Dashboard.",
      "Parent views live child location and clicks 'Acknowledge & Mark Resolved'."
    ],
    testLocation: "Child Dashboard → Emergency SOS Tab → Press Panic Button"
  },
  {
    step: 3,
    title: "Guardian AI Tutor & Voice Chat",
    role: "Child",
    icon: Sparkles,
    badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    description: "Groq AI powered study partner, homework tutor, and cyber safety quiz.",
    details: [
      "Ask math, science, or coding questions with real-time AI responses.",
      "Interactive Cyber-Smart Challenge quiz with immediate feedback & XP rewards.",
      "Grounded counselor prompt designed specifically for children's safety."
    ],
    testLocation: "Child Dashboard → Guardian AI Assistant Tab"
  },
  {
    step: 4,
    title: "Homework Helper & Daily Goals",
    role: "Child & Parent Sync",
    icon: BookOpen,
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    description: "Assignment manager and daily learning progress tracker.",
    details: [
      "Child adds homework tasks with due dates, subject tags, and notes.",
      "Mark tasks complete or delete completed assignments.",
      "Daily learning goals track minutes spent reading, exercising, or coding.",
      "Progress syncs live to the Parent Dashboard."
    ],
    testLocation: "Child Dashboard → Homework Helper & Learning Hub Tabs"
  },
  {
    step: 5,
    title: "Parent Dashboard & Telemetry",
    role: "Parent",
    icon: LayoutDashboard,
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    description: "360-degree monitoring, geofence safe zones, risk score, and AI weekly reports.",
    details: [
      "View connected children, live battery levels, and last seen locations on map.",
      "Remote lock/unlock companion devices in one click.",
      "Geofence safe zone monitoring with automatic entrance/exit alerts.",
      "AI Weekly Reports summarizing screen time, cyber risk index, and recommendations."
    ],
    testLocation: "Parent Dashboard"
  }
];

export default function FeatureTourModal({ isOpen, onClose }: FeatureTourModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const stepData = TOUR_STEPS[currentStep];
  const IconComponent = stepData.icon;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative text-slate-100 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-400 to-emerald-500 text-slate-950 flex items-center justify-center font-bold">
              <Rocket className="h-5.5 w-5.5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white font-display">🚀 Guardian AI Platform Tour</h3>
              <p className="text-[10px] font-mono text-teal-400">STEP {currentStep + 1} OF {TOUR_STEPS.length}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Dots */}
        <div className="flex items-center space-x-2 my-4">
          {TOUR_STEPS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                idx === currentStep ? "w-8 bg-teal-400" : "w-2 bg-slate-800 hover:bg-slate-700"
              }`}
            />
          ))}
        </div>

        {/* Content Card */}
        <div className="space-y-4 py-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-teal-400 shrink-0">
                <IconComponent className="h-6 w-6" />
              </div>
              <div>
                <span className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full border font-bold ${stepData.badgeColor}`}>
                  Role: {stepData.role}
                </span>
                <h4 className="text-xl font-bold text-white mt-1">{stepData.title}</h4>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-300 font-medium leading-relaxed">
            {stepData.description}
          </p>

          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2">
            <span className="text-[10px] font-mono uppercase text-teal-400 font-bold tracking-wider">How It Works:</span>
            <ul className="space-y-1.5">
              {stepData.details.map((detail, dIdx) => (
                <li key={dIdx} className="text-xs text-slate-300 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl text-xs flex items-center justify-between text-teal-300">
            <span className="font-mono text-[10px] font-bold uppercase">Test Location:</span>
            <span className="font-semibold text-white">{stepData.testLocation}</span>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-4">
          <button
            onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
            disabled={currentStep === 0}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 font-bold text-xs rounded-xl flex items-center gap-1 transition cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>

          {currentStep < TOUR_STEPS.length - 1 ? (
            <button
              onClick={() => setCurrentStep(prev => Math.min(TOUR_STEPS.length - 1, prev + 1))}
              className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1 transition cursor-pointer shadow-md shadow-teal-500/20"
            >
              <span>Next Step</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-teal-400 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer shadow-md shadow-teal-400/20"
            >
              Start Exploring Guardian AI 🎉
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
