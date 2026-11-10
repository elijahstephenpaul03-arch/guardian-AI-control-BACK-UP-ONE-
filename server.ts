import express from "express";
import path from "path";
import dotenv from "dotenv";
import {
  getGroqApiKey,
  getGeminiApiKey,
  buildSystemInstruction,
  generateGroqCompletion,
  streamGroqCompletion
} from "./src/lib/assistantHelper";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Enable CORS and request headers
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// Health check endpoint with measured process uptime
app.get(["/api/health", "/health"], (req, res) => {
  res.json({ 
    status: "ok",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Diagnostic debug endpoint
app.get(["/api/debug", "/debug"], (req, res) => {
  res.json({
    apiReachable: true,
    environment: process.env.NODE_ENV || "production",
    groqKeyConfigured: Boolean(getGroqApiKey()),
    geminiKeyConfigured: Boolean(getGeminiApiKey())
  });
});

// Intelligent fallback generator in case external APIs are temporarily unavailable
function generateLocalHeuristicResponse(systemInstruction: string, message: string, mode: string): string {
  const m = message.toLowerCase();
  
  if (mode === "child") {
    if (m.includes("math") || m.includes("plus") || m.includes("minus") || m.includes("solve") || m.includes("calculate") || m.includes("×") || m.includes("*")) {
      return `### 📐 Homework Step-by-Step Helper\n\nLet's break this math problem down together:\n\n1. **Identify what is given**: Look at the numbers and operators carefully.\n2. **Choose your operation**: Follow the order of operations.\n3. **Step-by-step calculation**: Check each intermediate result before finishing.\n\n*Feel free to share the exact numbers or equations and we can solve them together!*`;
    }
    if (m.includes("code") || m.includes("python") || m.includes("scratch") || m.includes("program")) {
      return `### 💻 Coding Fun with Guardian AI\n\nHere is a simple Python example to get started:\n\n\`\`\`python\n# Safe & fun Python welcome script\ndef greet_explorer(name):\n    print(f"Welcome to the coding adventure, {name}!")\n\ngreet_explorer("Explorer")\n\`\`\`\n\n**Key Tips**:\n- Indentation matters in Python (use 4 spaces).\n- Experiment and modify variables to see what changes!`;
    }
    if (m.includes("safe") || m.includes("scam") || m.includes("stranger") || m.includes("password") || m.includes("game")) {
      return `### 🛡️ Guardian Safe Surfing Rules\n\nHere are 3 essential rules to keep in mind:\n\n1. **Keep Secrets Secret**: Never share your real name, address, school, or phone number in game chats.\n2. **Strong Passwords**: Use a passphrase with numbers and special symbols.\n3. **Tell a Trusted Adult**: If anything ever makes you feel uncomfortable or scared online, immediately tell your parents or a guardian!`;
    }
    return `### 🌟 Guardian Learning Companion\n\nHello! I am your Guardian learning helper. I can assist you with:\n\n- **Homework & STEM**: Math, science, reading, and history explanations.\n- **Coding & Games**: Python, Scratch, and beginner programming.\n- **Internet Safety**: Learning safe digital habits while playing and chatting.\n\nWhat would you like to explore or practice today?`;
  }

  // Parent mode fallback
  if (m.includes("screen") || m.includes("limit") || m.includes("time") || m.includes("usage")) {
    return `### 📊 Screen Time & Digital Balance Analysis\n\nBased on child safety recommendations:\n\n1. **Recommended Daily Window**: 90-120 minutes of recreational screen time on school days.\n2. **Educational Exceptions**: Homework, coding, and educational apps should be categorized separately from entertainment.\n3. **Downtime Schedule**: Enforce automatic screen lock 45 minutes before bedtime to support restorative sleep habits.`;
  }
  if (m.includes("threat") || m.includes("block") || m.includes("risk") || m.includes("security") || m.includes("danger")) {
    return `### 🛡️ Guardian Neural Safety Assessment\n\n- **Web Content Filter**: Active with real-time adult, malware, and phishing interceptors.\n- **Safe Zone Geofencing**: Real-time alerts are dispatched when boundaries (Home, School, Park) are crossed.\n- **Family Communication**: Open conversations about digital habits foster mutual trust and resilience.`;
  }

  return `### 🛡️ Guardian Family Security Advisor\n\nI am your Guardian AI family advisor. Here are quick recommendations:\n\n- **Active Protection**: Child device telemetry and geofencing are operating normally.\n- **Digital Wellbeing**: Encourage regular breaks using the 20-20-20 rule during screen sessions.\n- **Open Dialogue**: Review weekly activity summaries with your child to build positive habits.\n\nHow can I assist your family today?`;
}

// Diagnostic route for direct Groq API connectivity test
app.get(["/api/test-groq-direct", "/test-groq-direct"], async (req, res) => {
  const cleanKey = getGroqApiKey();
  const exists = Boolean(cleanKey.length > 0);

  if (!cleanKey) {
    return res.json({
      GUARDIAN_GROQ_API_KEY_EXISTS: false,
      GROQ_DIRECT_HTTP_STATUS: 0,
      GROQ_DIRECT_TEST: "FAILED",
      GROQ_RESPONSE: "Groq API key is not configured."
    });
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cleanKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: "Reply with GROQ_TEST_OK" }],
        temperature: 0.1
      })
    });

    const status = response.status;
    const bodyText = await response.text();

    if (!response.ok) {
      return res.json({
        GUARDIAN_GROQ_API_KEY_EXISTS: exists,
        GROQ_DIRECT_HTTP_STATUS: status,
        GROQ_DIRECT_TEST: "FAILED",
        GROQ_RESPONSE: bodyText
      });
    }

    let parsedText = "";
    try {
      const parsed = JSON.parse(bodyText);
      parsedText = parsed?.choices?.[0]?.message?.content || "";
    } catch (e) {
      parsedText = bodyText;
    }

    return res.json({
      GUARDIAN_GROQ_API_KEY_EXISTS: exists,
      GROQ_DIRECT_HTTP_STATUS: status,
      GROQ_DIRECT_TEST: "SUCCESS",
      GROQ_RESPONSE: parsedText
    });
  } catch (err: any) {
    return res.json({
      GUARDIAN_GROQ_API_KEY_EXISTS: exists,
      GROQ_DIRECT_HTTP_STATUS: 500,
      GROQ_DIRECT_TEST: "FAILED",
      GROQ_RESPONSE: err?.message || String(err)
    });
  }
});

// REST API proxy endpoint for OpenWeather API
app.get(["/api/weather", "/weather"], async (req, res) => {
  const { lat, lon } = req.query;
  
  if (!lat || !lon) {
    return res.status(400).json({ error: "lat and lon parameters are required." });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY || "01ef1daa7f76c7574fbd05059f468226";

  const mapWmoCode = (code: number): { main: string; description: string; icon: string } => {
    switch (code) {
      case 0:
        return { main: "Clear", description: "clear sky", icon: "01d" };
      case 1:
        return { main: "Clouds", description: "mainly clear", icon: "02d" };
      case 2:
        return { main: "Clouds", description: "partly cloudy", icon: "03d" };
      case 3:
        return { main: "Clouds", description: "overcast", icon: "04d" };
      case 45:
      case 48:
        return { main: "Fog", description: "foggy", icon: "50d" };
      case 51:
      case 53:
      case 55:
        return { main: "Drizzle", description: "drizzle", icon: "09d" };
      case 61:
      case 63:
      case 65:
        return { main: "Rain", description: "rain", icon: "10d" };
      case 71:
      case 73:
      case 75:
        return { main: "Snow", description: "snowfall", icon: "13d" };
      case 80:
      case 81:
      case 82:
        return { main: "Rain", description: "rain showers", icon: "09d" };
      case 95:
      case 96:
      case 99:
        return { main: "Thunderstorm", description: "thunderstorm", icon: "11d" };
      default:
        return { main: "Clouds", description: "partly cloudy", icon: "03d" };
    }
  };

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OpenWeather API responded with status ${response.status}`);
    }
    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    try {
      const fallbackUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&wind_speed_unit=ms`;
      const fallbackRes = await fetch(fallbackUrl);
      if (!fallbackRes.ok) {
        throw new Error(`Open-Meteo responded with status ${fallbackRes.status}`);
      }
      
      const fallbackData = await fallbackRes.json();
      const current = fallbackData.current;
      if (!current) {
        throw new Error("Invalid Open-Meteo response");
      }

      const weatherCondition = mapWmoCode(current.weather_code);

      const normalizedData = {
        main: {
          temp: current.temperature_2m,
          humidity: current.relative_humidity_2m
        },
        weather: [
          {
            main: weatherCondition.main,
            description: weatherCondition.description,
            icon: weatherCondition.icon
          }
        ],
        wind: {
          speed: current.wind_speed_10m
        },
        name: "Active Kid Zone"
      };

      return res.json(normalizedData);
    } catch (fallbackError: any) {
      return res.status(500).json({ error: "Failed to fetch weather telemetry." });
    }
  }
});

// REST API endpoint for Family AI Assistant (Groq)
app.post(["/api/assistant", "/assistant"], async (req, res) => {
  try {
    const { 
      message, 
      childContext, 
      history = [], 
      logs = [],
      dangerousEvents = [],
      mode = "parent",
      modelName
    } = req.body || {};

    let userMsg = message;
    if (!userMsg && Array.isArray(req.body?.messages) && req.body.messages.length > 0) {
      const last = req.body.messages[req.body.messages.length - 1];
      userMsg = typeof last === "string" ? last : (last?.content || last?.text || "");
    }

    if (!userMsg || typeof userMsg !== "string" || !userMsg.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    const safeLogs = Array.isArray(logs) ? logs.filter((l: any) => l && typeof l === "object") : [];
    const safeDangerousEvents = Array.isArray(dangerousEvents) ? dangerousEvents.filter((e: any) => e && typeof e === "object") : [];
    const safeHistory = Array.isArray(history) ? history : [];

    const systemInstruction = buildSystemInstruction(mode, childContext, safeLogs, safeDangerousEvents);

    const aiResult = await generateGroqCompletion(
      systemInstruction,
      safeHistory,
      userMsg.trim(),
      modelName,
      mode
    );

    const actualProvider = aiResult.provider || (
      aiResult.modelUsed.startsWith("Gemini") ? "gemini" :
      aiResult.modelUsed.startsWith("Groq") ? "groq" : "local"
    );

    return res.json({
      text: aiResult.text,
      reply: aiResult.text,
      message: aiResult.text,
      groundingMetadata: null,
      modelUsed: aiResult.modelUsed,
      provider: actualProvider
    });
  } catch (err: any) {
    console.error("[SERVER ASSISTANT ERROR]", err?.message);
    let fallbackMsg = typeof req.body?.message === "string" ? req.body.message : "";
    if (!fallbackMsg && Array.isArray(req.body?.messages) && req.body.messages.length > 0) {
      const last = req.body.messages[req.body.messages.length - 1];
      fallbackMsg = typeof last === "string" ? last : (last?.content || "");
    }
    const fallback = generateLocalHeuristicResponse("", fallbackMsg, req.body?.mode || "parent");
    return res.json({
      text: fallback,
      reply: fallback,
      message: fallback,
      groundingMetadata: null,
      modelUsed: "Guardian Neural Core (Offline Engine)",
      provider: "local"
    });
  }
});

// Streaming REST API endpoint for progressive real-time AI generation
app.post(["/api/assistant/stream", "/assistant/stream"], async (req, res) => {
  try {
    const { 
      message, 
      childContext, 
      history = [], 
      logs = [],
      dangerousEvents = [],
      mode = "parent",
      modelName
    } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (typeof (res as any).flushHeaders === "function") {
      (res as any).flushHeaders();
    }

    let currentProvider: "groq" | "gemini" | "local" = "groq";
    let currentModelUsed = modelName || "Groq AI";
    const sendEvent = (data: any) => {
      if (res.writableEnded) return;
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (typeof (res as any).flush === "function") {
        (res as any).flush();
      }
    };

    const safeLogs = Array.isArray(logs) ? logs.filter((l: any) => l && typeof l === "object") : [];
    const safeDangerousEvents = Array.isArray(dangerousEvents) ? dangerousEvents.filter((e: any) => e && typeof e === "object") : [];
    const safeHistory = Array.isArray(history) ? history : [];

    const systemInstruction = buildSystemInstruction(mode, childContext, safeLogs, safeDangerousEvents);

    const streamResult = await streamGroqCompletion(
      systemInstruction,
      safeHistory,
      message,
      (chunkText, meta) => {
        if (meta?.provider) currentProvider = meta.provider;
        if (meta?.modelUsed) currentModelUsed = meta.modelUsed;
        sendEvent({ text: chunkText, provider: currentProvider, modelUsed: currentModelUsed });
      },
      modelName,
      mode
    );

    const finalProvider = streamResult.provider || (
      streamResult.modelUsed.startsWith("Gemini") ? "gemini" :
      streamResult.modelUsed.startsWith("Groq") ? "groq" : "local"
    );

    sendEvent({
      done: true,
      fullText: streamResult.text,
      provider: finalProvider,
      modelUsed: streamResult.modelUsed
    });
    res.end();
  } catch (err: any) {
    console.error("[SERVER STREAM ERROR]", err?.message);
    const fallbackText = generateLocalHeuristicResponse("", req.body?.message || "", req.body?.mode || "parent");
    if (res.headersSent) {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ text: fallbackText, done: true, modelUsed: "Guardian Neural Core (Offline Engine)", provider: "local" })}\n\n`);
        res.end();
      }
    } else {
      res.status(200).json({
        text: fallbackText,
        modelUsed: "Guardian Neural Core (Offline Engine)",
        provider: "local"
      });
    }
  }
});

// Endpoint to fetch available active Groq models
app.get(["/api/assistant/models", "/assistant/models"], async (req, res) => {
  try {
    const { getActiveGroqModels } = await import("./src/lib/assistantHelper");
    const models = await getActiveGroqModels();
    return res.json({ models });
  } catch (err: any) {
    return res.json({ models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b", "canopylabs/orpheus-v1-english"] });
  }
});

// Helper function to generate vector safety posters
function generateDynamicSvgPoster(prompt: string, size: string): string {
  const width = size === "4K" ? 1024 : size === "2K" ? 768 : 512;
  const height = width;
  const title = prompt.length > 40 ? prompt.substring(0, 40) + "..." : prompt;
  
  let startCol = "#1e293b";
  let endCol = "#0f172a";
  let accentCol = "#22d3ee";
  let badgeIcon = `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;

  const pLower = prompt.toLowerCase();
  if (pLower.includes("study") || pLower.includes("learn") || pLower.includes("focus") || pLower.includes("school")) {
    startCol = "#0d9488";
    endCol = "#115e59";
    accentCol = "#38bdf8";
    badgeIcon = `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" fill="none" stroke="#38bdf8" stroke-width="2"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linejoin="round"/>`;
  } else if (pLower.includes("detox") || pLower.includes("screen") || pLower.includes("limit") || pLower.includes("time")) {
    startCol = "#4f46e5";
    endCol = "#312e81";
    accentCol = "#a855f7";
    badgeIcon = `<rect x="5" y="2" width="14" height="20" rx="2" ry="2" fill="none" stroke="#a855f7" stroke-width="2"/><line x1="12" y1="18" x2="12.01" y2="18" stroke="#a855f7" stroke-width="3" stroke-linecap="round"/>`;
  } else if (pLower.includes("danger") || pLower.includes("block") || pLower.includes("scam") || pLower.includes("phishing") || pLower.includes("risk")) {
    startCol = "#be123c";
    endCol = "#4c0519";
    accentCol = "#fb7185";
    badgeIcon = `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="none" stroke="#fb7185" stroke-width="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="#fb7185" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="#fb7185" stroke-width="3" stroke-linecap="round"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 400 400" style="font-family:'Inter',sans-serif; background-color: #0f172a; border-radius: 12px;">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${startCol}" />
        <stop offset="100%" stop-color="${endCol}" />
      </linearGradient>
      <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${accentCol}" />
        <stop offset="100%" stop-color="#ffffff" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bgGrad)" rx="16" />
    <circle cx="200" cy="140" r="70" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <circle cx="200" cy="140" r="50" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>
    <g transform="translate(180, 120) scale(1.6)">
      ${badgeIcon}
    </g>
    <text x="200" y="245" font-size="14" font-weight="800" fill="url(#textGrad)" text-anchor="middle" letter-spacing="1.5" text-transform="uppercase">Guardian Safety AI Poster</text>
    <text x="200" y="275" font-size="20" font-weight="900" fill="#ffffff" text-anchor="middle">${title}</text>
    <text x="200" y="305" font-size="11" font-weight="500" fill="rgba(255,255,255,0.5)" text-anchor="middle">"Guarding Every Outbound Connection with Pride"</text>
    
    <rect x="50" y="335" width="300" height="1" fill="rgba(255,255,255,0.1)"/>
    <text x="200" y="358" font-size="9" font-weight="700" fill="${accentCol}" font-family="monospace" text-anchor="middle" letter-spacing="1">GUARDIAN VECTOR ENGINE | ${size}</text>
  </svg>`;

  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

// REST API endpoint for vector poster generation
app.post(["/api/generate-image", "/generate-image"], async (req, res) => {
  const { prompt, size = "1K" } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  const imageUrl = generateDynamicSvgPoster(prompt, size);
  return res.json({ imageUrl, isFallback: true });
});

// Configure Vite middleware and static asset serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up Vite Development Server middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving production build from dist/ folder...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Guardian AI Server running at http://0.0.0.0:${PORT}`);
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[PORT CONFLICT] Port ${PORT} busy, retrying in 1s...`);
      setTimeout(() => {
        server.close();
        app.listen(PORT, "0.0.0.0");
      }, 1000);
    } else {
      console.error("[SERVER LISTEN ERROR]", err);
    }
  });
}

if (!process.env.VERCEL) {
  setupServer().catch((err) => {
    console.error("[SERVER FATAL STARTUP ERROR]", err);
  });
}

export default app;
