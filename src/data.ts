import { ChildProfile, ChildDevice, ActivityLog, AdvancedAIReport, InterestTalentData } from "./types";

export const initialDevices: ChildDevice[] = [
  {
    id: "dev-leo-phone",
    name: "Leo's Phone (Galaxy S24)",
    type: "phone",
    model: "Samsung Galaxy S24 Ultra",
    os: "Android 14",
    battery: 86,
    status: "online",
    lastActive: "Today at 3:15 PM",
    childId: "child-1",
    parentId: "parent-1",
    createdAt: "2026-06-01T10:00:00Z"
  },
  {
    id: "dev-leo-tablet",
    name: "Study Tablet",
    type: "tablet",
    model: "Galaxy Tab S9 FE",
    os: "OneUI 6.0",
    battery: 92,
    status: "online",
    lastActive: "Today at 10:15 AM",
    childId: "child-1",
    parentId: "parent-1",
    createdAt: "2026-06-15T14:30:00Z"
  },
  {
    id: "dev-leo-laptop",
    name: "Old Chromebook",
    type: "laptop",
    model: "Acer Chromebook 314",
    os: "ChromeOS 120",
    battery: 15,
    status: "offline",
    lastActive: "42 days ago",
    childId: "child-1",
    parentId: "parent-1",
    createdAt: "2026-01-20T09:00:00Z"
  },
  {
    id: "dev-emily-phone",
    name: "Emily's iPhone 13",
    type: "phone",
    model: "Apple iPhone 13",
    os: "iOS 17.4",
    battery: 94,
    status: "online",
    lastActive: "Today at 2:30 PM",
    childId: "child-2",
    parentId: "parent-1",
    createdAt: "2026-05-10T11:20:00Z"
  },
  {
    id: "dev-emily-tablet",
    name: "Drawing iPad Mini",
    type: "tablet",
    model: "iPad Mini 6",
    os: "iPadOS 17",
    battery: 78,
    status: "online",
    lastActive: "Yesterday at 6:45 PM",
    childId: "child-2",
    parentId: "parent-1",
    createdAt: "2026-05-12T16:00:00Z"
  }
];

export const initialProfiles: ChildProfile[] = [
  {
    id: "child-1",
    name: "Leo",
    age: 12,
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200",
    device: "Samsung Galaxy Tab S9 & Google Pixel 8 Pro",
    battery: 42,
    status: "focus",
    screenTimeLimit: 120, // 2 hours
    screenTimeToday: 85,
    riskScore: 12,
    lastSeenLocation: {
      lat: 17.4849,
      lng: 78.3907,
      name: "Kondapur, Hyderabad, Telangana, India",
      timestamp: "10 mins ago"
    },
    devices: [
      initialDevices[0],
      initialDevices[1],
      initialDevices[2]
    ]
  },
  {
    id: "child-2",
    name: "Emily",
    age: 8,
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200",
    device: "iPad Air 5th Gen & iPhone SE",
    battery: 89,
    status: "online",
    screenTimeLimit: 60, // 1 hour
    screenTimeToday: 25,
    riskScore: 4,
    lastSeenLocation: {
      lat: 17.4880,
      lng: 78.3880,
      name: "Botanical Garden Road, Kondapur, Hyderabad",
      timestamp: "5 mins ago"
    },
    devices: [
      initialDevices[3],
      initialDevices[4]
    ]
  }
];

export const initialLogs: ActivityLog[] = [
  {
    id: "log-1",
    childId: "child-1",
    type: "location",
    title: "Entered Safe Zone",
    description: "Leo arrived safely at Oakridge Tech Academy (Kondapur Campus).",
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    safetyLevel: "safe",
    duration: 0
  },
  {
    id: "log-app-spike-1",
    childId: "child-1",
    type: "app",
    title: "App Usage Spike: Roblox (+145%)",
    description: "Rapid surge in gaming activity detected: 95 consecutive minutes on Roblox, exceeding the configured 60-min daily threshold.",
    timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    safetyLevel: "warning",
    duration: 95
  },
  {
    id: "log-loc-shift-1",
    childId: "child-1",
    type: "location",
    title: "Location Shift: Left Oakridge Campus",
    description: "GPS sensor detected transit departure from Oakridge Tech Academy towards Botanical Garden Road.",
    timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    safetyLevel: "safe",
    duration: 12
  },
  {
    id: "log-2",
    childId: "child-1",
    type: "app",
    title: "Focus Mode Started",
    description: "Study hours Focus mode automatically locked entertainment apps on Samsung Galaxy Tab S9.",
    timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    safetyLevel: "safe",
    duration: 60
  },
  {
    id: "log-app-spike-2",
    childId: "child-2",
    type: "app",
    title: "App Usage Spike: YouTube Kids (+90%)",
    description: "Unusual weekday screen-time spike detected: 65 minutes on YouTube Kids science playlists during designated quiet hours.",
    timestamp: new Date(Date.now() - 160 * 60 * 1000).toISOString(),
    safetyLevel: "warning",
    duration: 65
  },
  {
    id: "log-3",
    childId: "child-1",
    type: "safety",
    title: "AI Website Filter Triggered",
    description: "Blocked attempt to access 'Unverified Torrent Forum' (Gambling / P2P category).",
    timestamp: new Date(Date.now() - 210 * 60 * 1000).toISOString(),
    safetyLevel: "warning"
  },
  {
    id: "log-4",
    childId: "child-2",
    type: "location",
    title: "Left Safe Zone",
    description: "Emily checked out from 'Home Safe Zone' in Kondapur.",
    timestamp: new Date(Date.now() - 260 * 60 * 1000).toISOString(),
    safetyLevel: "safe"
  },
  {
    id: "log-5",
    childId: "child-2",
    type: "location",
    title: "Arrived Safe Zone",
    description: "Emily checked in safely at 'Community Soccer Academy'.",
    timestamp: new Date(Date.now() - 280 * 60 * 1000).toISOString(),
    safetyLevel: "safe"
  },
  {
    id: "log-6",
    childId: "child-1",
    type: "safety",
    title: "AI Dangerous Content Blocked",
    description: "Blocked suspicious redirect link 'free-robux-clicker.com' (Scam & Phishing category).",
    timestamp: new Date(Date.now() - 340 * 60 * 1000).toISOString(),
    safetyLevel: "severe"
  },
  {
    id: "log-7",
    childId: "child-2",
    type: "app",
    title: "Educational App Activity",
    description: "Emily completed 25 minutes of Spanish vocabulary lessons on Duolingo Kids.",
    timestamp: new Date(Date.now() - 410 * 60 * 1000).toISOString(),
    safetyLevel: "safe",
    duration: 25
  },
  {
    id: "log-loc-shift-2",
    childId: "child-2",
    type: "location",
    title: "Location Checkpoint: Botanical Garden Safe Route",
    description: "Safe transit beacon verified normal walking speed along verified school-commute corridor.",
    timestamp: new Date(Date.now() - 520 * 60 * 1000).toISOString(),
    safetyLevel: "safe"
  }
];

export const initialAIReports: Record<string, AdvancedAIReport> = {
  "child-1": {
    weekStarting: "June 30 - July 6, 2026",
    screenTimeSummary: "Leo averaged 1 hour 45 minutes of daily screen time, representing a 12% decrease from last week. This reduction matches the newly configured 'Study Mode' restrictions.",
    mostUsedApps: [
      { name: "Scratch Coding", duration: 240, icon: "Code" },
      { name: "Duolingo", duration: 180, icon: "Languages" },
      { name: "YouTube Kids (STEM content)", duration: 120, icon: "Play" },
      { name: "Roblox", duration: 90, icon: "Gamepad" }
    ],
    educationalVsEntertainment: { edu: 65, ent: 25, other: 10 },
    dailyRoutineAnalysis: "Leo adheres tightly to the configured digital routine. Screen time spike is centered between 4:00 PM and 5:30 PM, right after coding club hours.",
    sleepScheduleInsights: "No screen activity was logged post 8:30 PM. Sleep hygiene remains excellent (9.5 hours of estimated sleep).",
    browsingTrends: "High interest in robotics, Python loops, Arduino boards, and space science exploration.",
    safetyAlertsCount: 2,
    personalizedRecommendations: [
      "Leo is showing an advanced grasp of block coding. Consider introducing text-based coding languages like beginner Python or simple HTML/CSS.",
      "Support his growing engineering interest with a physical DIY robotics kit (e.g., Arduino or Raspberry Pi starter pack).",
      "Two scam redirects were neutralized this week on ad networks. Ensure 'Safe Web Browsing Ad-Blocker' is enabled in the Guardian AI extension settings."
    ]
  },
  "child-2": {
    weekStarting: "June 30 - July 6, 2026",
    screenTimeSummary: "Emily averaged 45 minutes of screen time daily. Digital hygiene is very well balanced, and screen limits were never exceeded.",
    mostUsedApps: [
      { name: "Duolingo Kids", duration: 150, icon: "Languages" },
      { name: "PBS KIDS Games", duration: 90, icon: "Sparkles" },
      { name: "Spotify Kids (Sleep Lullabies)", duration: 60, icon: "Music" }
    ],
    educationalVsEntertainment: { edu: 75, ent: 15, other: 10 },
    dailyRoutineAnalysis: "Emily uses her iPad primarily in the late mornings on weekends and early afternoons on school days.",
    sleepScheduleInsights: "Bedtime audio tracks (lullabies) are triggered around 8:00 PM and automatically fade after 30 minutes. No active app screen time logged at night.",
    browsingTrends: "Interested in Spanish cartoon lessons, animal habitats, and kid-friendly puzzle games.",
    safetyAlertsCount: 0,
    personalizedRecommendations: [
      "Emily is progressing fast with her language learning modules! Encourage her verbally and consider practicing Spanish words together during dinner.",
      "Since her interest in animals is rising, explore a virtual museum or an illustrative book about ocean marine life.",
      "Her tablet's screen distance sensor shows she holds the screen 8 inches away sometimes. Remind her of the 12-inch healthy rule to protect eyesight."
    ]
  }
};

export const initialInterestData: Record<string, InterestTalentData> = {
  "child-1": {
    talentScore: 92,
    learningStyle: "Kinesthetic & Visual (Learns by building, breaking, and visualizing logical workflows)",
    growthTimeline: [
      { month: "Feb", coding: 45, art: 20, music: 15, science: 30 },
      { month: "Mar", coding: 55, art: 22, music: 15, science: 35 },
      { month: "Apr", coding: 68, art: 25, music: 18, science: 42 },
      { month: "May", coding: 78, art: 28, music: 18, science: 50 },
      { month: "Jun", coding: 92, art: 30, music: 20, science: 65 }
    ],
    talents: [
      {
        name: "Software Engineering & Game Logic",
        score: 95,
        description: "Exhibits solid structural thinking, understands loop hierarchies, variables, and sprite triggers inside coding exercises.",
        careerSuggestions: ["AI Researcher", "Gameplay Engineer", "Full-Stack Architect"],
        resources: [
          "Scratch Coding Challenge Level 3",
          "Minecraft Education Edition: Python Coding Modules",
          "CoderDojo Local Programming Club"
        ]
      },
      {
        name: "Space Science & Physics",
        score: 82,
        description: "Actively researches gravitational forces, cosmic maps, and rocket thruster simulations.",
        careerSuggestions: ["Aerospace Engineer", "Astrophysicist", "Orbital Mechanic"],
        resources: [
          "Kerbal Space Program (Physics Sandbox)",
          "NASA Kid's Club Interactive Missions",
          "Book: 'Astrophysics for Young People in a Hurry' by Neil deGrasse Tyson"
        ]
      }
    ]
  },
  "child-2": {
    talentScore: 84,
    learningStyle: "Auditory & Linguistic (Learns through storytelling, musical patterns, and spoken repetition)",
    growthTimeline: [
      { month: "Feb", coding: 10, art: 45, music: 50, science: 15 },
      { month: "Mar", coding: 12, art: 55, music: 58, science: 18 },
      { month: "Apr", coding: 15, art: 62, music: 68, science: 20 },
      { month: "May", coding: 20, art: 72, music: 78, science: 25 },
      { month: "Jun", coding: 25, art: 84, music: 90, science: 30 }
    ],
    talents: [
      {
        name: "Linguistics & Spanish Communication",
        score: 88,
        description: "Averages 96% vocabulary accuracy in child-level conversational Spanish exercises.",
        careerSuggestions: ["International Journalist", "Linguist", "Diplomat"],
        resources: [
          "Duolingo Kids level 2 storybooks",
          "Spanish-English visual interactive dictionary",
          "Weekly 15-min conversational audio drills"
        ]
      },
      {
        name: "Acoustic Melody & Rhythms",
        score: 82,
        description: "Enjoys repeating piano sequences, recognizing key changes, and listening to classical composers.",
        careerSuggestions: ["Composer", "Sound Designer", "Musicologist"],
        resources: [
          "Simply Piano Beginner Interactive App",
          "Local youth choir or introductory keyboard lessons",
          "Classical Composer Storybook Series"
        ]
      }
    ]
  }
};

export const pricingPlans = [
  {
    name: "Standard Guard",
    price: "$4.99",
    billing: "per month",
    description: "Essential real-time tracking and screen limits for single parent household.",
    features: [
      "Manage up to 2 devices",
      "Real-time GPS tracking",
      "Core website filters",
      "Daily activity reports",
      "Secure cloud sync"
    ],
    cta: "Start 7-Day Free Trial",
    popular: false
  },
  {
    name: "Guardian Premium",
    price: "$9.99",
    billing: "per month",
    description: "Fully-featured AI parenting reporting and smart risk scores for growing families.",
    features: [
      "Manage up to 5 devices",
      "AI dangerous content detection",
      "Smart Safe Zones (Geofencing)",
      "Interactive screen time analytics",
      "Weekly AI Parenting Reports",
      "Interest & Talent Discovery Insights",
      "24/7 Family AI Assistant"
    ],
    cta: "Get Premium Guard",
    popular: true
  },
  {
    name: "Enterprise Shield",
    price: "$19.99",
    billing: "per month",
    description: "Maximum safety shields with immediate notifications and advanced legal monitoring support.",
    features: [
      "Unlimited child devices",
      "Call & SMS log insights",
      "Device hardware health audit",
      "Priority SOS live notifications",
      "Direct phone/emergency callback",
      "Comprehensive digital legacy archive"
    ],
    cta: "Deploy Enterprise Shield",
    popular: false
  }
];

export const faqs = [
  {
    question: "How does the AI Dangerous Content Detection work?",
    answer: "Our cloud-native AI scans incoming URLs, search terms, and network packets at the browser level. Using natural language processing, it classifies risk patterns in real time (e.g., cyberbullying cues, phishing, malware triggers, adult content) and instantly notifies parents while blocking the harmful resource, without violating child privacy in private messaging apps."
  },
  {
    question: "Is call & SMS monitoring legally permitted?",
    answer: "Yes, call and SMS activity analysis is permitted on device operating systems where parental permission is explicitly configured (such as Android and dedicated tablet settings). Guardian AI highlights metadata trends (suspicious phone numbers, late-night texting) to protect children while respecting legal privacy standards."
  },
  {
    question: "What is the Interest & Talent Discovery engine?",
    answer: "Instead of just acting as a digital lock, our platform aims to empower child growth. When your child spends time browsing educational subjects (like math puzzles or coding compilers), our AI analyzes their learning patterns and constructs a customized talent map. This assists parents in identifying career interests, offering recommendations for courses, books, and science clubs."
  },
  {
    question: "How do Smart Safe Zones alert parents?",
    answer: "Using smart geofencing, Guardian AI establishes circular boundary rings around frequently visited places (home, school, soccer field). If the device enters or leaves these zones at unscheduled times, parents receive immediate silent push notifications with real-time map updates."
  },
  {
    question: "Can I try Guardian AI for free?",
    answer: "Absolutely! Every plan includes a 7-day high-tier free trial so you can experience our advanced AI features, weekly reports, and Family AI Assistant."
  }
];
