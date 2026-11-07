import { getGroqApiKey, getGeminiApiKey } from "../src/lib/assistantHelper";

export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    if (typeof res.status === "function") {
      return res.status(200).end();
    }
    res.statusCode = 200;
    return res.end();
  }

  const responseBody = {
    apiReachable: true,
    environment: process.env.NODE_ENV || "production",
    vercel: Boolean(process.env.VERCEL),
    groqKeyConfigured: Boolean(getGroqApiKey()),
    geminiKeyConfigured: Boolean(getGeminiApiKey())
  };

  if (typeof res.status === "function") {
    return res.status(200).json(responseBody);
  } else if (typeof res.json === "function") {
    res.statusCode = 200;
    return res.json(responseBody);
  } else {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(responseBody));
  }
}
