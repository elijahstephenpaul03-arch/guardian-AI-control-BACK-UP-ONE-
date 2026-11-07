// REST API endpoint for vector poster generation (Vercel Serverless Function)

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

export default function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end();
  }

  let body: any = {};
  try {
    body = typeof req.body === "string" ? (req.body.trim() ? JSON.parse(req.body) : {}) : (req.body || {});
  } catch {
    return sendJsonResponse(res, 400, { error: "Invalid JSON body." });
  }

  const { prompt, size = "1K" } = body;

  if (!prompt) {
    return sendJsonResponse(res, 400, { error: "Prompt is required." });
  }

  const imageUrl = generateDynamicSvgPoster(prompt, size);
  return sendJsonResponse(res, 200, { imageUrl, isFallback: true });
}
