export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  return res.status(200).json({
    status: "ok",
    message: "Guardian AI API Gateway",
    endpoints: ["/api/health", "/api/debug", "/api/assistant", "/api/assistant/stream"]
  });
}
