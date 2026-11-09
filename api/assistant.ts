import {
  getGroqApiKey,
  getGeminiApiKey,
  buildSystemInstruction,
  generateGroqCompletion,
  generateLocalHeuristicResponse
} from "../src/lib/assistantHelper.js";

function sendJsonResponse(res: any, statusCode: number, data: any) {
  if (typeof res.status === "function") {
    return res.status(statusCode).json(data);
  } else if (typeof res.json === "function") {
    res.statusCode = statusCode;
    return res.json(data);
  } else {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(data));
  }
}

async function parseBodySafely(req: any): Promise<any> {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (typeof req.on === "function") {
    return new Promise((resolve) => {
      let data = "";
      req.on("data", (chunk: any) => { data += chunk; });
      req.on("end", () => {
        try {
          resolve(data.trim() ? JSON.parse(data) : {});
        } catch {
          resolve({});
        }
      });
      req.on("error", () => resolve({}));
    });
  }
  return {};
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== "POST") {
    return sendJsonResponse(res, 405, { error: "Method Not Allowed" });
  }

  try {
    const body = await parseBodySafely(req);
    const {
      message,
      childContext,
      history = [],
      logs = [],
      dangerousEvents = [],
      mode = "parent",
      modelName
    } = body;

    console.log(`[VERCEL ASSISTANT HANDLER] message="${message?.substring(0, 50)}", mode=${mode}, modelName=${modelName}`);

    if (!message || typeof message !== "string" || !message.trim()) {
      return sendJsonResponse(res, 400, { error: "Message is required." });
    }

    const safeHistory = Array.isArray(history) ? history : [];
    const safeLogs = Array.isArray(logs) ? logs : [];
    const safeDangerousEvents = Array.isArray(dangerousEvents) ? dangerousEvents : [];
    const systemInstruction = buildSystemInstruction(mode, childContext, safeLogs, safeDangerousEvents);

    const groqApiKey = getGroqApiKey();
    const geminiApiKey = getGeminiApiKey();
    const hasExternalKey = Boolean((groqApiKey && groqApiKey.length > 5) || (geminiApiKey && geminiApiKey.length > 5));

    if (hasExternalKey) {
      try {
        const aiResult = await generateGroqCompletion(
          systemInstruction,
          safeHistory,
          message,
          modelName
        );

        return sendJsonResponse(res, 200, {
          text: aiResult.text,
          groundingMetadata: null,
          modelUsed: aiResult.modelUsed,
          provider: aiResult.modelUsed.startsWith("Gemini") ? "gemini" : "groq"
        });
      } catch (aiErr: any) {
        console.warn("[VERCEL /api/assistant AI ERROR - FALLING BACK TO LOCAL CORE]", aiErr?.message);
        const fallbackText = generateLocalHeuristicResponse(systemInstruction, message, mode);
        return sendJsonResponse(res, 200, {
          text: fallbackText,
          groundingMetadata: null,
          modelUsed: "Guardian Neural Core (Offline Engine)",
          provider: "local"
        });
      }
    } else {
      // Offline fallback when no key configured
      const fallbackText = generateLocalHeuristicResponse(systemInstruction, message, mode);
      return sendJsonResponse(res, 200, {
        text: fallbackText,
        groundingMetadata: null,
        modelUsed: "Guardian Neural Core (Offline Engine)",
        provider: "local"
      });
    }
  } catch (err: any) {
    console.error("[VERCEL /api/assistant ERROR]", err);
    const fallbackText = generateLocalHeuristicResponse("", req.body?.message || "", req.body?.mode || "parent");
    return sendJsonResponse(res, 200, {
      text: fallbackText,
      groundingMetadata: null,
      modelUsed: "Guardian Neural Core (Offline Engine)",
      provider: "local"
    });
  }
}
