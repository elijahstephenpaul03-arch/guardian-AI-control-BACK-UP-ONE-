import {
  getGroqApiKey,
  getGeminiApiKey,
  buildSystemInstruction,
  streamGroqCompletion,
  generateLocalHeuristicResponse
} from "../../src/lib/assistantHelper";

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
  console.log("[HANDLER_START] /api/assistant/stream called. Method:", req.method);

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

  let body: any = {};
  try {
    body = await parseBodySafely(req);
  } catch (parseErr: any) {
    console.error("[BODY_PARSE_ERROR] Failed to parse request body:", parseErr?.message);
    return sendJsonResponse(res, 400, { error: "Invalid JSON body", message: parseErr?.message });
  }

  console.log("[BODY_PARSED] Request body parsed successfully.");

  const {
    message,
    childContext,
    history = [],
    logs = [],
    dangerousEvents = [],
    mode = "parent",
    modelName
  } = body;

  if (!message || typeof message !== "string" || message.trim() === "") {
    console.warn("[MESSAGE_VALIDATED] Validation failed: message is missing or empty.");
    return sendJsonResponse(res, 400, { error: "Message is required." });
  }

  console.log(`[MESSAGE_VALIDATED] Message length: ${message.length}, Mode: ${mode}`);

  const groqApiKey = getGroqApiKey();
  const geminiApiKey = getGeminiApiKey();
  const hasGroqKey = Boolean(groqApiKey && groqApiKey.length > 5);
  const hasGeminiKey = Boolean(geminiApiKey && geminiApiKey.length > 5);
  const hasExternalAiKey = hasGroqKey || hasGeminiKey;

  console.log(`[AI_KEY_CHECK] Groq Available: ${hasGroqKey}, Gemini Available: ${hasGeminiKey}`);

  // Set SSE headers only after validation and API-key inspection pass
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    try {
      res.flushHeaders();
    } catch (_) {}
  }

  console.log("[SSE_HEADERS_SET] Streaming response headers flushed.");

  let isClientDisconnected = false;
  req.on("close", () => {
    isClientDisconnected = true;
  });

  const sendEvent = (data: any) => {
    if (isClientDisconnected || res.writableEnded) return;
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (typeof res.flush === "function") {
        try {
          res.flush();
        } catch (_) {}
      }
    } catch (_) {}
  };

  const safeLogs = Array.isArray(logs) ? logs : [];
  const safeDangerousEvents = Array.isArray(dangerousEvents) ? dangerousEvents : [];
  const safeHistory = Array.isArray(history) ? history : [];
  const systemInstruction = buildSystemInstruction(mode, childContext, safeLogs, safeDangerousEvents);

  try {
    if (hasExternalAiKey) {
      console.log("[BEFORE_AI_FETCH] Initiating stream with active neural backend...");
      try {
        let activeModelUsed = hasGeminiKey ? "Gemini Neural Engine" : "Groq Neural Engine";
        const streamResult = await streamGroqCompletion(
          systemInstruction,
          safeHistory,
          message,
          (chunkText) => {
            if (!isClientDisconnected) {
              sendEvent({ text: chunkText, provider: hasGeminiKey ? "gemini" : "groq", modelUsed: activeModelUsed });
            }
          },
          modelName
        );

        sendEvent({
          done: true,
          fullText: streamResult.text,
          provider: hasGeminiKey ? "gemini" : "groq",
          modelUsed: streamResult.modelUsed
        });
        res.end();
        return;
      } catch (streamErr: any) {
        console.warn("[STREAM_EXECUTION_WARNING] Fallback to Guardian Local Core:", streamErr?.message);
        const fallbackText = generateLocalHeuristicResponse(systemInstruction, message, mode);
        sendEvent({
          done: true,
          fullText: fallbackText,
          text: fallbackText,
          provider: "local",
          modelUsed: "Guardian Neural Core (Offline Engine)"
        });
        res.end();
        return;
      }
    } else {
      console.log("[LOCAL_CORE_FALLBACK] No external AI key provided. Serving heuristic response.");
      const fallbackText = generateLocalHeuristicResponse(systemInstruction, message, mode);
      sendEvent({
        done: true,
        fullText: fallbackText,
        text: fallbackText,
        provider: "local",
        modelUsed: "Guardian Neural Core (Offline Engine)"
      });
      res.end();
      return;
    }
  } catch (err: any) {
    console.error("[PRODUCTION_STREAM_FATAL_ERROR]", err);
    const fallbackText = generateLocalHeuristicResponse(systemInstruction, message, mode);
    if (res.headersSent) {
      try {
        res.write(`data: ${JSON.stringify({ text: fallbackText, done: true, fullText: fallbackText, modelUsed: "Guardian Neural Core (Offline Engine)", provider: "local" })}\n\n`);
      } catch (_) {}
      res.end();
    } else {
      return sendJsonResponse(res, 200, {
        text: fallbackText,
        fullText: fallbackText,
        modelUsed: "Guardian Neural Core (Offline Engine)",
        provider: "local"
      });
    }
  }
}
