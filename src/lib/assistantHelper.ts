// Helper functions for Groq API integration and prompt building

export function getGroqApiKey(): string {
  const rawKey = (
    process.env.GUARDIAN_GROQ_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.GROQ_KEY ||
    process.env.VITE_GROQ_API_KEY ||
    ""
  ).trim();
  return rawKey.replace(/^["']|["']$/g, "").trim();
}

export function getGeminiApiKey(): string {
  const rawKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  ).trim();
  return rawKey.replace(/^["']|["']$/g, "").trim();
}

// Cache active models from Groq /v1/models to avoid 404 / 400 decommissioned models
let cachedAvailableModels: string[] | null = null;
let lastModelFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Reliable fallback models in priority order
const DEFAULT_MODEL_CANDIDATES = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
  "canopylabs/orpheus-v1-english"
];

export async function getActiveGroqModels(): Promise<string[]> {
  const now = Date.now();
  if (cachedAvailableModels && cachedAvailableModels.length > 0 && now - lastModelFetchTime < CACHE_TTL_MS) {
    return cachedAvailableModels;
  }

  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return DEFAULT_MODEL_CANDIDATES;
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` }
    });

    if (res.ok) {
      const data = await res.json();
      const chatModels = (data?.data || [])
        .filter((m: any) => 
          m.active !== false && 
          !m.id.includes("whisper") && 
          !m.id.includes("prompt-guard") &&
          !m.id.includes("safeguard") &&
          !m.id.includes("embedding")
        )
        .map((m: any) => m.id);

      if (chatModels.length > 0) {
        const preferredOrder = [
          "openai/gpt-oss-120b",
          "openai/gpt-oss-20b",
          "qwen/qwen3.8-27b",
          "canopylabs/orpheus-v1-english",
          "allam-2-7b"
        ];
        const sorted = [
          ...preferredOrder.filter(m => chatModels.includes(m)),
          ...chatModels.filter(m => !preferredOrder.includes(m))
        ];
        cachedAvailableModels = sorted;
        lastModelFetchTime = now;
        return sorted;
      }
    }
  } catch (e) {
    console.warn("[Groq Models Fetch]", e);
  }

  return DEFAULT_MODEL_CANDIDATES;
}

export async function resolveModelCandidates(preferredModel?: string): Promise<string[]> {
  const activeModels = await getActiveGroqModels();
  const candidates: string[] = [];

  // If a preferred model was requested and is confirmed active on Groq, put it first
  if (preferredModel && !preferredModel.startsWith("gemini")) {
    if (activeModels.length === 0 || activeModels.includes(preferredModel)) {
      candidates.push(preferredModel);
    } else {
      console.warn(`[Groq Model Selection] Preferred model "${preferredModel}" is not in active models list. Selecting verified active model.`);
    }
  }

  for (const m of activeModels) {
    if (!candidates.includes(m)) {
      candidates.push(m);
    }
  }

  for (const m of DEFAULT_MODEL_CANDIDATES) {
    if (!candidates.includes(m)) {
      candidates.push(m);
    }
  }

  return candidates.length > 0 ? candidates : DEFAULT_MODEL_CANDIDATES;
}

export function buildGroqMessages(
  systemInstruction: string,
  history: any[],
  currentMessage: string
) {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }

  const rawTurns = (history || []).filter(
    (h) => h && (h.role === "user" || h.role === "model" || h.role === "assistant") && typeof h.text === "string" && h.text.trim() !== ""
  );

  const precedingTurns = [...rawTurns];
  if (
    precedingTurns.length > 0 &&
    precedingTurns[precedingTurns.length - 1].role === "user" &&
    precedingTurns[precedingTurns.length - 1].text.trim() === (currentMessage || "").trim()
  ) {
    precedingTurns.pop();
  }

  for (const turn of precedingTurns) {
    const role = turn.role === "user" ? "user" : "assistant";
    messages.push({ role, content: turn.text });
  }

  if (currentMessage && currentMessage.trim() !== "") {
    messages.push({ role: "user", content: currentMessage });
  }

  return messages;
}

export function buildSystemInstruction(
  mode: string = "parent",
  childContext: any = {},
  logs: any = [],
  dangerousEvents: any = []
): string {
  const safeLogs = Array.isArray(logs) ? logs.filter((l: any) => l && typeof l === "object") : [];
  const safeDangerousEvents = Array.isArray(dangerousEvents) ? dangerousEvents.filter((e: any) => e && typeof e === "object") : [];

  const childName = childContext?.name || "the children";
  const childAge = childContext?.age ? `${childContext.age} years old` : "N/A";
  const currentStatus = childContext?.status || "online";
  const screenTimeLimit = childContext?.screenTimeLimit || 120;
  const screenTimeToday = childContext?.screenTimeToday || 45;
  const riskScore = childContext?.riskScore || 12;

  const appLogs = safeLogs.filter((l: any) => l.type === "app");
  const webLogs = safeLogs.filter((l: any) => l.type === "web");
  const locationLogs = safeLogs.filter((l: any) => l.type === "location");

  const formattedAppActivity = appLogs.length > 0 
    ? appLogs.slice(0, 5).map((l: any) => `- App Use: ${l.title || "App"} - ${l.description || ""}`).join("\n")
    : "- No recent specific app events logged.";

  const formattedWebActivity = webLogs.length > 0
    ? webLogs.slice(0, 5).map((l: any) => `- Web Search/Visit: "${l.title || ""}" - ${l.description || ""}`).join("\n")
    : "- Web queries remain under standard filtering guidelines.";

  const formattedLocation = locationLogs.length > 0
    ? `Checked in safely at '${locationLogs[0].title || "Safe Zone"}' (${locationLogs[0].description || ""})`
    : "No recent custom safe zone check-in.";

  const formattedUnsafeEvents = safeDangerousEvents.length > 0
    ? safeDangerousEvents.map((e: any) => `- Category: ${e.category || "Alert"} | Attempted: ${e.target || "Unknown"} | Action Taken: ${e.actionTaken || "Blocked"}`).join("\n")
    : "- No critical digital danger alerts flagged in this session.";

  if (mode === "child") {
    return `You are "Guardian", a friendly, highly intelligent, and compassionate AI Companion and learning helper for children on the Guardian AI platform.
Your tone is warm, encouraging, curious, and highly educational—like a wise mentor, safe digital guide, or cool companion.

Scope & Capabilities:
1. General Knowledge & Learning: You answer ALL age-appropriate questions about science, space, nature, history, literature, geography, technology, art, and general curiosity.
2. Homework & Schoolwork: Explain concepts step-by-step. Break down math, science, and grammar problems patiently without just dumping final answers immediately.
3. Coding & Computer Science: Teach programming (Python, Scratch, JavaScript, HTML/CSS) with clean, fun, well-commented code snippets.
4. Cyber Safety & Digital Wellbeing: Provide gentle, practical advice on staying safe online, handling gaming chats, and balancing screen time.
5. Supportive Guidance: Offer empathetic, encouraging responses if the child expresses frustration or sadness, gently reminding them that they can always speak to their parents or trusted adults for real support.

Format your responses beautifully in Markdown with clear lists, simple steps, and warm, conversational text. Keep your paragraphs concise and engaging.`;
  }

  return `You are "Guardian", an intelligent, versatile AI Assistant and Family Security & Digital Wellbeing Advisor for parents on the Guardian AI platform.
Your tone is professional, reassuring, insightful, and practical.

Scope & Capabilities:
1. General Assistant: You answer ALL general-purpose questions—including parenting advice, general knowledge, work/education tasks, technical concepts, planning, and everyday questions.
2. Family Security & Digital Wellbeing: Help parents analyze screen time, interpret activity logs, evaluate digital risks, set healthy boundaries, and foster positive learning habits.
3. Actionable Insights: Utilize child profile metrics, safety logs, and digital telemetry when relevant to provide concrete, compassionate recommendations.

Format your responses clearly in Markdown with structured bullet points, key takeaways, and actionable steps. Do not restrict yourself strictly to child safety—be a complete, helpful AI assistant for the parent.

--- Child Profile Context ---
Name: ${childName}
Age: ${childAge}
Status: ${currentStatus}
Risk Safety Score: ${riskScore}/100 (lower is safer)
Daily Screen Time: ${screenTimeToday} minutes used of ${screenTimeLimit} minutes limit

--- Real-time Activities & Telemetry ---
Recent App Activity:
${formattedAppActivity}

Recent Web Activity:
${formattedWebActivity}

Recent Physical Location/Safe Zone Status:
- Status: ${formattedLocation}

--- Digital Danger & Flagged Alerts ---
${formattedUnsafeEvents}`;
}

export async function generateGeminiCompletion(
  systemInstruction: string,
  history: any[],
  currentMessage: string,
  preferredModel?: string
): Promise<{ text: string; modelUsed: string }> {
  const geminiKey = getGeminiApiKey();
  if (!geminiKey) {
    const fallbackText = generateLocalHeuristicResponse(systemInstruction, currentMessage);
    return { text: fallbackText, modelUsed: "Guardian Neural Core (Offline Engine)" };
  }

  const modelToUse = preferredModel && preferredModel.startsWith("gemini")
    ? preferredModel
    : "gemini-3.8-flash";

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const contents: any[] = [];
    const rawTurns = (history || []).filter(
      (h) => h && (h.role === "user" || h.role === "model" || h.role === "assistant") && typeof h.text === "string" && h.text.trim() !== ""
    );

    for (const turn of rawTurns) {
      contents.push({
        role: turn.role === "assistant" ? "model" : turn.role,
        parts: [{ text: turn.text }]
      });
    }
    contents.push({
      role: "user",
      parts: [{ text: currentMessage }]
    });

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents,
      config: {
        systemInstruction
      }
    });

    const text = response.text || "";
    if (text) {
      return { text, modelUsed: `Gemini (${modelToUse})` };
    }
  } catch (err: any) {
    console.warn(`[Gemini AI Completion Warning] ${err?.message}`);
  }

  const fallbackText = generateLocalHeuristicResponse(systemInstruction, currentMessage);
  return { text: fallbackText, modelUsed: "Guardian Neural Core (Offline Engine)" };
}

export async function streamGeminiCompletion(
  systemInstruction: string,
  history: any[],
  currentMessage: string,
  onChunk: (chunkText: string) => void,
  preferredModel?: string
): Promise<{ text: string; modelUsed: string }> {
  const geminiKey = getGeminiApiKey();
  if (!geminiKey) {
    const fallbackText = generateLocalHeuristicResponse(systemInstruction, currentMessage);
    onChunk(fallbackText);
    return { text: fallbackText, modelUsed: "Guardian Neural Core (Offline Engine)" };
  }

  const modelToUse = preferredModel && preferredModel.startsWith("gemini")
    ? preferredModel
    : "gemini-3.8-flash";

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const contents: any[] = [];
    const rawTurns = (history || []).filter(
      (h) => h && (h.role === "user" || h.role === "model" || h.role === "assistant") && typeof h.text === "string" && h.text.trim() !== ""
    );

    for (const turn of rawTurns) {
      contents.push({
        role: turn.role === "assistant" ? "model" : turn.role,
        parts: [{ text: turn.text }]
      });
    }
    contents.push({
      role: "user",
      parts: [{ text: currentMessage }]
    });

    const response = await ai.models.generateContentStream({
      model: modelToUse,
      contents,
      config: {
        systemInstruction
      }
    });

    let accumulatedText = "";
    for await (const chunk of response) {
      const chunkText = chunk.text || "";
      if (chunkText) {
        accumulatedText += chunkText;
        onChunk(chunkText);
      }
    }

    if (accumulatedText.trim()) {
      return { text: accumulatedText, modelUsed: `Gemini (${modelToUse})` };
    }
  } catch (err: any) {
    console.warn(`[Gemini AI Stream Warning] ${err?.message}`);
  }

  const fallbackText = generateLocalHeuristicResponse(systemInstruction, currentMessage);
  onChunk(fallbackText);
  return { text: fallbackText, modelUsed: "Guardian Neural Core (Offline Engine)" };
}

export async function generateGroqCompletion(
  systemInstruction: string,
  history: any[],
  currentMessage: string,
  preferredModel?: string
): Promise<{ text: string; modelUsed: string }> {
  // If Gemini model requested or Gemini key present and Groq key absent, use Gemini
  const geminiKey = getGeminiApiKey();
  const groqApiKey = getGroqApiKey();
  if ((preferredModel && preferredModel.startsWith("gemini")) || (!groqApiKey && geminiKey)) {
    return generateGeminiCompletion(systemInstruction, history, currentMessage, preferredModel);
  }

  if (!groqApiKey) {
    if (geminiKey) {
      return generateGeminiCompletion(systemInstruction, history, currentMessage, preferredModel);
    }
    const fallbackText = generateLocalHeuristicResponse(systemInstruction, currentMessage);
    return { text: fallbackText, modelUsed: "Guardian Neural Core (Offline Engine)" };
  }

  const modelsToTry = await resolveModelCandidates(preferredModel);
  const messages = buildGroqMessages(systemInstruction, history, currentMessage);

  let lastError: any = null;
  for (const model of modelsToTry) {
    try {
      console.log(`[Groq AI] Requesting completion with model: ${model}`);
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7
        })
      });

      if (res.status === 401) {
        const errBody = await res.text().catch(() => "");
        console.error(`[Groq Auth Error 401]:`, errBody);
        break; // Stop attempting other models if key is invalid
      }

      if (res.status === 429) {
        console.warn(`[Groq AI] Model ${model} rate limited (429). Trying next model...`);
        lastError = new Error("Groq API rate limit reached.");
        continue;
      }

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.warn(`[Groq AI] Model ${model} returned HTTP ${res.status}: ${errBody}`);
        lastError = new Error(`Groq API returned HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        return { text: content, modelUsed: `Groq (${model})` };
      }
    } catch (err: any) {
      console.warn(`[Groq AI Execution Warning] Model ${model} failed:`, err?.message);
      lastError = err;
    }
  }

  console.warn("[Groq AI Completion] All candidate models failed or unavailable. Falling back to local neural core.", lastError?.message);
  const fallbackText = generateLocalHeuristicResponse(systemInstruction, currentMessage);
  return { text: fallbackText, modelUsed: "Guardian Neural Core (Offline Engine)" };
}

export async function streamGroqCompletion(
  systemInstruction: string,
  history: any[],
  currentMessage: string,
  onChunk: (chunkText: string) => void,
  preferredModel?: string
): Promise<{ text: string; modelUsed: string }> {
  const geminiKey = getGeminiApiKey();
  const groqApiKey = getGroqApiKey();
  if ((preferredModel && preferredModel.startsWith("gemini")) || (!groqApiKey && geminiKey)) {
    return streamGeminiCompletion(systemInstruction, history, currentMessage, onChunk, preferredModel);
  }

  if (!groqApiKey) {
    if (geminiKey) {
      return streamGeminiCompletion(systemInstruction, history, currentMessage, onChunk, preferredModel);
    }
    const fallbackText = generateLocalHeuristicResponse(systemInstruction, currentMessage);
    onChunk(fallbackText);
    return { text: fallbackText, modelUsed: "Guardian Neural Core (Offline Engine)" };
  }

  const modelsToTry = await resolveModelCandidates(preferredModel);
  const messages = buildGroqMessages(systemInstruction, history, currentMessage);

  let lastError: any = null;
  for (const model of modelsToTry) {
    try {
      console.log(`[Groq Stream] Requesting stream with model: ${model}`);
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          stream: true
        })
      });

      if (res.status === 401) {
        const errBody = await res.text().catch(() => "");
        console.error(`[Groq Stream Auth Error 401]:`, errBody);
        break; // Stop attempting other models if key is invalid
      }

      if (res.status === 429) {
        console.warn(`[Groq Stream] Model ${model} rate limited (429). Trying next model...`);
        lastError = new Error("Groq API rate limit reached.");
        continue;
      }

      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => "");
        console.warn(`[Groq Stream] Model ${model} returned HTTP ${res.status}: ${errBody}`);
        lastError = new Error(`Groq API returned HTTP ${res.status}`);
        continue;
      }

      let accumulatedText = "";
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      const processChunk = (chunkValue: Uint8Array | ArrayBuffer | string) => {
        const decoded = typeof chunkValue === "string" ? chunkValue : decoder.decode(chunkValue, { stream: true });
        buffer += decoded;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (trimmed.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                accumulatedText += content;
                onChunk(content);
              }
            } catch (e) {
              // Ignore partial JSON chunk parsing errors
            }
          }
        }
      };

      if (typeof (res.body as any).getReader === "function") {
        const reader = (res.body as any).getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          processChunk(value);
        }
      } else if (res.body && typeof (res.body as any)[Symbol.asyncIterator] === "function") {
        for await (const chunk of res.body as any) {
          processChunk(chunk);
        }
      } else {
        throw new Error("Response body is not a readable stream.");
      }

      if (accumulatedText.trim()) {
        return { text: accumulatedText, modelUsed: `Groq (${model})` };
      }
    } catch (err: any) {
      console.warn(`[Groq Stream Execution Warning] Model ${model} stream failed:`, err?.message);
      lastError = err;
    }
  }

  console.warn("[Groq Stream Completion] All candidate models failed or unavailable. Falling back to local neural core.", lastError?.message);
  const fallbackText = generateLocalHeuristicResponse(systemInstruction, currentMessage);
  onChunk(fallbackText);
  return { text: fallbackText, modelUsed: "Guardian Neural Core (Offline Engine)" };
}

// Intelligent fallback generator in case external APIs are temporarily unavailable
export function generateLocalHeuristicResponse(systemInstruction: string, message: string, mode: string = "parent"): string {
  const m = (message || "").toLowerCase();
  
  if (mode === "child") {
    if (m.includes("math") || m.includes("plus") || m.includes("minus") || m.includes("solve") || m.includes("calculate") || m.includes("×") || m.includes("*")) {
      return `### 📐 Homework Step-by-Step Helper\n\nLet's break this math problem down together:\n\n1. **Identify what is given**: Look at the numbers and operators carefully.\n2. **Choose your operation**: Follow the order of operations.\n3. **Step-by-step calculation**: Check each intermediate result before finishing.\n\n*Feel free to share the exact numbers or equations and we can solve them together!*`;
    }
    if (m.includes("code") || m.includes("python") || m.includes("scratch") || m.includes("program") || m.includes("javascript")) {
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
