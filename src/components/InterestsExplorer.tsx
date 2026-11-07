import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Compass, 
  Tag, 
  Brain, 
  Sparkles, 
  TrendingUp, 
  HelpCircle, 
  BookOpen, 
  Target,
  Award
} from "lucide-react";

interface ExplorerItem {
  id: string;
  name: string;
  type: "app" | "interest";
  value: number; // minutes or score
  category: "Computational" | "Linguistic" | "Creative" | "Analytical" | "Technical";
  colorClass: string;
  glowColor: string;
  insight: string;
  impactMetric: string;
  recommendation: string;
  // SVG coordinates for the bubble chart
  x: number;
  y: number;
  radius: number;
}

interface InterestsExplorerProps {
  selectedChildId: string;
  selectedChildName: string;
}

const childInterests: Record<string, ExplorerItem[]> = {
  "child-1": [
    {
      id: "scratch",
      name: "Scratch Coding",
      type: "app",
      value: 240,
      category: "Computational",
      colorClass: "from-cyan-400 to-blue-500 text-cyan-950 dark:text-cyan-50",
      glowColor: "rgba(34, 211, 238, 0.4)",
      insight: "Strong algorithmic sequence execution and state variable management inside game loops.",
      impactMetric: "Computational Logic +28%",
      recommendation: "Leo is ready for simple text-based transitions. Try Scratch's block-to-Python helper guides.",
      x: 200,
      y: 175,
      radius: 56
    },
    {
      id: "duolingo",
      name: "Duolingo Spanish",
      type: "app",
      value: 180,
      category: "Linguistic",
      colorClass: "from-emerald-400 to-green-500 text-emerald-950 dark:text-emerald-50",
      glowColor: "rgba(16, 185, 129, 0.4)",
      insight: "Rapid vocabulary retrieval, phonetic associations, and high spelling accuracy.",
      impactMetric: "Cognitive Flexibility +18%",
      recommendation: "Try conversational Spanish dialogue during play hours to cement active speaking skills.",
      x: 90,
      y: 110,
      radius: 48
    },
    {
      id: "robotics",
      name: "Robotics & Arduino",
      type: "interest",
      value: 95,
      category: "Technical",
      colorClass: "from-purple-400 to-indigo-500 text-purple-950 dark:text-purple-50",
      glowColor: "rgba(168, 85, 247, 0.4)",
      insight: "Strong aptitude for logic loop design, physical actuators, and electronics block diagrams.",
      impactMetric: "Spatial Engineering +22%",
      recommendation: "A physical Arduino or Micro:bit starter pack would solidify this learning path.",
      x: 310,
      y: 120,
      radius: 44
    },
    {
      id: "stem-yt",
      name: "STEM Mechanics",
      type: "app",
      value: 120,
      category: "Analytical",
      colorClass: "from-rose-400 to-red-500 text-rose-950 dark:text-rose-50",
      glowColor: "rgba(244, 63, 94, 0.4)",
      insight: "Deep curiosity for orbital trajectories, rocket propulsion physics, and chemistry bounds.",
      impactMetric: "Analytical Thinking +15%",
      recommendation: "Encourage educational science channels and interactive digital science sandboxes.",
      x: 295,
      y: 245,
      radius: 46
    },
    {
      id: "roblox",
      name: "Roblox Coding",
      type: "app",
      value: 90,
      category: "Creative",
      colorClass: "from-amber-400 to-orange-500 text-amber-950 dark:text-amber-50",
      glowColor: "rgba(245, 158, 11, 0.4)",
      insight: "Initial understanding of Lua coding structures, event triggers, and 3D coordinate grids.",
      impactMetric: "3D Spatial Design +20%",
      recommendation: "Encourage switching from playing to writing Lua scripts in Roblox Studio.",
      x: 105,
      y: 235,
      radius: 42
    },
    {
      id: "chess",
      name: "Chess & Strategy",
      type: "interest",
      value: 85,
      category: "Analytical",
      colorClass: "from-teal-400 to-emerald-500 text-teal-950 dark:text-teal-50",
      glowColor: "rgba(20, 184, 166, 0.4)",
      insight: "High score in spatial pattern analysis, positional memory, and planning 3 moves ahead.",
      impactMetric: "Strategic Calculation +25%",
      recommendation: "Incorporate timed tactical puzzles to build speed and sequence forecasting.",
      x: 200,
      y: 65,
      radius: 40
    }
  ],
  "child-2": [
    {
      id: "duolingo-kids",
      name: "Duolingo Kids",
      type: "app",
      value: 150,
      category: "Linguistic",
      colorClass: "from-emerald-400 to-green-500 text-emerald-950 dark:text-emerald-50",
      glowColor: "rgba(16, 185, 129, 0.4)",
      insight: "Superb pronunciation recognition, sound pairing, and bilingual vocabulary syntax.",
      impactMetric: "Linguistic Aptitude +26%",
      recommendation: "Introduce illustrated bilingual books to build narrative comprehension.",
      x: 200,
      y: 175,
      radius: 54
    },
    {
      id: "pbs-kids",
      name: "PBS KIDS Games",
      type: "app",
      value: 90,
      category: "Analytical",
      colorClass: "from-blue-400 to-indigo-500 text-blue-950 dark:text-blue-50",
      glowColor: "rgba(59, 130, 246, 0.4)",
      insight: "Excellent speed in matching patterns, geometric classifications, and counting puzzles.",
      impactMetric: "Visual Categorization +18%",
      recommendation: "Compliment with tactile building blocks and shape sorting toys offline.",
      x: 100,
      y: 120,
      radius: 44
    },
    {
      id: "spotify-sleep",
      name: "Melodic Lullabies",
      type: "app",
      value: 60,
      category: "Creative",
      colorClass: "from-pink-400 to-rose-500 text-pink-950 dark:text-pink-50",
      glowColor: "rgba(236, 72, 153, 0.4)",
      insight: "High sensitivity to acoustic progressions, harmonic curves, and soft bedtime pacing.",
      impactMetric: "Acoustic Harmony +15%",
      recommendation: "Play light instrumental classical music during her afternoon creative drawings.",
      x: 300,
      y: 110,
      radius: 40
    },
    {
      id: "vocab",
      name: "Spanish Vocab",
      type: "interest",
      value: 88,
      category: "Linguistic",
      colorClass: "from-teal-400 to-cyan-500 text-teal-950 dark:text-teal-50",
      glowColor: "rgba(20, 184, 166, 0.4)",
      insight: "Strong retention of noun definitions, visual pairings, and audio responses.",
      impactMetric: "Bilingual Communication +22%",
      recommendation: "Play a quick daily 5-minute flashcard quiz to consolidate nouns.",
      x: 290,
      y: 240,
      radius: 42
    },
    {
      id: "piano",
      name: "Piano Patterns",
      type: "interest",
      value: 82,
      category: "Creative",
      colorClass: "from-purple-400 to-indigo-500 text-purple-950 dark:text-purple-50",
      glowColor: "rgba(168, 85, 247, 0.4)",
      insight: "High musical sequence learning, rhythmic coordination, and scale intervals.",
      impactMetric: "Auditory Processing +20%",
      recommendation: "Consider a kid-friendly electronic keyboard to transition from screen to physical keys.",
      x: 110,
      y: 230,
      radius: 41
    },
    {
      id: "animals",
      name: "Animal Habitats",
      type: "interest",
      value: 75,
      category: "Analytical",
      colorClass: "from-amber-400 to-yellow-500 text-amber-950 dark:text-amber-50",
      glowColor: "rgba(245, 158, 11, 0.4)",
      insight: "Strong focus on animal habitats, ocean layers, and feeding ecosystems.",
      impactMetric: "Ecological Reasoning +16%",
      recommendation: "A fun weekend trip to a local aquarium or zoo will solidify this curiosity.",
      x: 200,
      y: 70,
      radius: 38
    }
  ]
};

export default function InterestsExplorer({ selectedChildId, selectedChildName }: InterestsExplorerProps) {
  const [viewMode, setViewMode] = useState<"bubble" | "tag">("bubble");
  const items = childInterests[selectedChildId] || childInterests["child-1"];
  const [selectedItemId, setSelectedItemId] = useState<string | null>(items[0]?.id || null);

  // When child changes, make sure to select the first interest of the new child
  React.useEffect(() => {
    setSelectedItemId(items[0]?.id || null);
  }, [selectedChildId]);

  const activeItem = items.find(item => item.id === selectedItemId) || items[0];

  // Floating coordinates animation offset
  const getFloatingAnimation = (index: number) => {
    return {
      y: [0, -6, 0, 6, 0],
      x: [0, 4, 0, -4, 0],
      transition: {
        duration: 5 + (index % 3) * 2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    };
  };

  return (
    <div className="bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 p-6 rounded-[2rem] shadow-xl space-y-6">
      
      {/* Header and Controller */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div>
          <h4 className="font-bold text-base text-slate-800 dark:text-white font-display flex items-center space-x-1.5">
            <Sparkles className="h-4.5 w-4.5 text-cyan-500" />
            <span>Digital Development Interests Explorer</span>
          </h4>
          <p className="text-[11px] text-slate-400 leading-normal">
            Aggregates educational queries, playground metrics, and active screen times for {selectedChildName}.
          </p>
        </div>

        {/* Dynamic View Toggle */}
        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("bubble")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
              viewMode === "bubble"
                ? "bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Bubble Chart</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("tag")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
              viewMode === "tag"
                ? "bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            <span>Tag Cloud</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        
        {/* Render Canvas/Stage column */}
        <div className="md:col-span-7 flex flex-col justify-center items-center bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 p-4 min-h-[360px] relative overflow-hidden">
          
          <AnimatePresence mode="wait">
            {viewMode === "bubble" ? (
              
              /* BUBBLE CHART VIEW */
              <motion.div
                key="bubble-mode"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="relative w-full aspect-[4/3] max-w-[400px] select-none"
              >
                <svg viewBox="0 0 400 350" className="w-full h-full overflow-visible">
                  {/* Decorative background grid ring */}
                  <circle cx="200" cy="175" r="140" fill="none" stroke="currentColor" className="text-slate-200/40 dark:text-slate-800/20" strokeWidth="1" strokeDasharray="5" />
                  <circle cx="200" cy="175" r="80" fill="none" stroke="currentColor" className="text-slate-200/40 dark:text-slate-800/20" strokeWidth="1" strokeDasharray="5" />

                  {items.map((item, index) => {
                    const isSelected = selectedItemId === item.id;
                    return (
                      <g key={item.id}>
                        {/* Hover connection line to center for active bubble */}
                        {isSelected && (
                          <motion.line
                            initial={{ strokeDashoffset: 100, opacity: 0 }}
                            animate={{ strokeDashoffset: 0, opacity: 0.5 }}
                            transition={{ duration: 0.5 }}
                            x1="200"
                            y1="175"
                            x2={item.x}
                            y2={item.y}
                            stroke="#06b6d4"
                            strokeWidth="1.5"
                            strokeDasharray="4"
                          />
                        )}

                        {/* Animated Wrapper for float and scale */}
                        <motion.g
                          animate={getFloatingAnimation(index)}
                          className="cursor-pointer"
                          onClick={() => setSelectedItemId(item.id)}
                        >
                          {/* Glow filter under selected circle */}
                          {isSelected && (
                            <circle
                              cx={item.x}
                              cy={item.y}
                              r={item.radius + 6}
                              fill={item.glowColor}
                              className="animate-pulse"
                              opacity="0.3"
                            />
                          )}

                          {/* Main Bubble Circle */}
                          <motion.circle
                            cx={item.x}
                            cy={item.y}
                            r={item.radius}
                            className={`fill-gradient transition-all duration-300`}
                            style={{
                              fill: isSelected ? "url(#activeGrad)" : `url(#grad-${item.id})`
                            }}
                            whileHover={{ scale: 1.08 }}
                            transition={{ type: "spring", stiffness: 300, damping: 15 }}
                          />

                          {/* Outer Border */}
                          <circle
                            cx={item.x}
                            cy={item.y}
                            r={item.radius}
                            fill="none"
                            stroke={isSelected ? "#22d3ee" : "rgba(255, 255, 255, 0.15)"}
                            strokeWidth={isSelected ? 2.5 : 1}
                          />

                          {/* Text labels wrapped beautifully */}
                          <text
                            x={item.x}
                            y={item.y - 4}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="text-[10px] font-bold font-display pointer-events-none fill-slate-900 dark:fill-white text-center"
                            style={{ fontSize: item.radius > 45 ? "11px" : "9px" }}
                          >
                            {item.name.split(" ")[0]}
                          </text>
                          <text
                            x={item.x}
                            y={item.y + 10}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="text-[8px] font-mono font-medium pointer-events-none fill-slate-500 dark:fill-slate-400"
                          >
                            {item.type === "app" ? `${item.value}m` : `${item.value}%`}
                          </text>
                        </motion.g>

                        {/* Linear Gradients definitions */}
                        <defs>
                          <linearGradient id={`grad-${item.id}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={item.id === "scratch" || item.id === "pbs-kids" ? "#06b6d4" : item.id === "duolingo" || item.id === "duolingo-kids" || item.id === "vocab" ? "#10b981" : item.id === "robotics" || item.id === "piano" ? "#8b5cf6" : item.id === "stem-yt" || item.id === "spotify-sleep" ? "#f43f5e" : "#f59e0b"} stopOpacity="0.25" />
                            <stop offset="100%" stopColor={item.id === "scratch" || item.id === "pbs-kids" ? "#3b82f6" : item.id === "duolingo" || item.id === "duolingo-kids" || item.id === "vocab" ? "#059669" : item.id === "robotics" || item.id === "piano" ? "#6366f1" : item.id === "stem-yt" || item.id === "spotify-sleep" ? "#e11d48" : "#d97706"} stopOpacity="0.12" />
                          </linearGradient>
                        </defs>
                      </g>
                    );
                  })}

                  {/* Active Gradient definition */}
                  <defs>
                    <linearGradient id="activeGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3" />
                    </linearGradient>
                  </defs>

                </svg>
              </motion.div>
            ) : (
              
              /* TAG CLOUD VIEW */
              <motion.div
                key="tag-mode"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="w-full flex flex-wrap justify-center gap-3 p-4 select-none max-w-[360px]"
              >
                {items.map((item, index) => {
                  const isSelected = selectedItemId === item.id;
                  // Dynamic Font Size and Weight styling based on usage duration/score
                  const sizeClass = 
                    item.value >= 180 ? "text-sm px-4 py-2" : 
                    item.value >= 100 ? "text-xs px-3 py-1.5" : 
                    "text-[11px] px-2.5 py-1";

                  return (
                    <motion.button
                      type="button"
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className={`rounded-2xl font-semibold border transition duration-200 cursor-pointer text-center flex items-center space-x-1.5 ${sizeClass} ${
                        isSelected
                          ? "bg-cyan-500/10 text-cyan-600 border-cyan-400 shadow-md dark:text-cyan-400"
                          : "bg-white/90 dark:bg-slate-900/90 text-slate-600 hover:text-slate-900 border-slate-200 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        item.type === "app" ? "bg-cyan-400" : "bg-emerald-400"
                      }`}></span>
                      <span>{item.name}</span>
                      <span className="text-[9px] opacity-60 font-mono">
                        {item.type === "app" ? `${item.value}m` : `${item.value}%`}
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Type indicators inside canvas */}
          <div className="absolute bottom-3 left-4 flex items-center space-x-3 text-[10px] font-mono text-slate-400">
            <div className="flex items-center space-x-1">
              <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
              <span>Active App Usage</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              <span>Observed Subject Interest</span>
            </div>
          </div>
        </div>

        {/* Render Insights column */}
        <div className="md:col-span-5 flex flex-col justify-between">
          
          <AnimatePresence mode="wait">
            {activeItem && (
              <motion.div
                key={activeItem.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                
                {/* Header detail */}
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded font-bold font-mono">
                      {activeItem.category}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Type: <strong className="text-slate-600 dark:text-slate-300 uppercase">{activeItem.type}</strong>
                    </span>
                  </div>
                  <h5 className="font-bold text-lg text-slate-800 dark:text-white font-display">
                    {activeItem.name}
                  </h5>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {activeItem.type === "app" ? `Weekly usage limit: ${activeItem.value} Minutes logged` : `Observed performance potential: ${activeItem.value}% Rating`}
                  </p>
                </div>

                {/* Cognitive Insight Box */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl space-y-2 text-left">
                  <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300 font-bold text-xs">
                    <Brain className="h-4 w-4 text-cyan-500 shrink-0" />
                    <span>Guardian AI Cognitive Insight</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                    {activeItem.insight}
                  </p>
                </div>

                {/* Development Impact badge */}
                <div className="p-4 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center space-x-3 text-left">
                  <div className="p-1.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
                    <TrendingUp className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold font-mono block">DEVELOPMENTAL IMPACT RATING</span>
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-display">
                      {activeItem.impactMetric}
                    </p>
                  </div>
                </div>

                {/* Parent actionable Recommendation */}
                <div className="p-4 bg-slate-900 dark:bg-slate-950 text-white rounded-2xl border border-slate-800 space-y-2 text-left relative overflow-hidden">
                  <div className="absolute top-[-20%] right-[-20%] w-[80px] h-[80px] bg-cyan-500/10 rounded-full blur-[20px]"></div>
                  
                  <div className="flex items-center space-x-1.5 text-cyan-400 font-bold text-xs relative z-10">
                    <BookOpen className="h-4 w-4 shrink-0" />
                    <span>Parent Recommendation</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-normal font-sans relative z-10">
                    {activeItem.recommendation}
                  </p>
                </div>

              </motion.div>
            )}
          </AnimatePresence>

        </div>

      </div>

    </div>
  );
}
