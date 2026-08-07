import "dotenv/config";
import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_PROVIDER = process.env.AI_PROVIDER || "anthropic";

function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (typeof part === "string" ? part : part.text || "")).join("");
  if (content && typeof content === "object") {
    if (typeof content.text === "string") return content.text;
    if (Array.isArray(content.parts)) return content.parts.map((part) => (typeof part === "string" ? part : part.text || "")).join("");
  }
  return "";
}

function getProvider(body = {}) {
  const provider = String(body?.provider || "").toLowerCase();
  if (provider === "gemini") return "gemini";
  if (provider === "openai") return "openai";
  if (provider === "anthropic") return "anthropic";
  const model = String(body?.model || "").toLowerCase();
  if (model.startsWith("gemini")) return "gemini";
  if (model.startsWith("gpt") || model.startsWith("o1") || model.startsWith("o3")) return "openai";
  return DEFAULT_PROVIDER;
}

function buildGeminiPayload(body = {}) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const parts = [];
  if (body.system) parts.push({ text: body.system });
  for (const item of messages) {
    const text = extractText(item?.content || "");
    if (!text) continue;
    parts.push({ text });
  }
  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: parts.map((part) => part.text).join("\n\n") }],
      },
    ],
    generationConfig: {
      maxOutputTokens: body.max_tokens ?? 700,
    },
  };
  if (body.system) {
    payload.systemInstruction = {
      role: "system",
      parts: [{ text: body.system }],
    };
  }
  return payload;
}

function normalizeGeminiResponse(data) {
  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text || "").join("") || "";
  return {
    model: data?.model || "gemini",
    id: candidate?.finishReason ? `gemini-${Date.now()}` : undefined,
    type: "message",
    role: "assistant",
    content: [{ type: "text", text }],
    usage: {
      input_tokens: data?.usageMetadata?.promptTokenCount || 0,
      output_tokens: data?.usageMetadata?.candidatesTokenCount || 0,
    },
  };
}

function buildOpenAIPayload(body = {}) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const out = [];
  if (body.system) out.push({ role: "system", content: body.system });
  for (const item of messages) {
    const text = extractText(item?.content || "");
    if (!text) continue;
    out.push({ role: item?.role === "assistant" ? "assistant" : "user", content: text });
  }
  return {
    model: body.model || "gpt-4o-mini",
    messages: out,
    max_tokens: body.max_tokens ?? 1024,
    temperature: body.temperature,
  };
}

function normalizeOpenAIResponse(data) {
  const choice = data?.choices?.[0];
  const text = choice?.message?.content || "";
  return {
    model: data?.model || "gpt",
    id: data?.id,
    type: "message",
    role: "assistant",
    content: [{ type: "text", text }],
    usage: {
      input_tokens: data?.usage?.prompt_tokens || 0,
      output_tokens: data?.usage?.completion_tokens || 0,
    },
  };
}

if (!ANTHROPIC_API_KEY && !GEMINI_API_KEY && !OPENAI_API_KEY) {
  console.warn("No AI API key configured. Set ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY before starting the proxy.");
} else if (!ANTHROPIC_API_KEY) {
  console.info("Anthropic API key not configured; using other providers if requested.");
}

app.use(bodyParser.json({ limit: "1mb" }));

// CORS: engedélyezzük a fejlesztéshez (ha szükséges, szűkítsd a domaineket).
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.post("/ai/messages", async (req, res) => {
  const provider = getProvider(req.body);
  if (provider === "openai") {
    if (!OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY environment variable. Configure it before using OpenAI." });
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(buildOpenAIPayload(req.body)),
      });
      const text = await r.text();
      let payload;
      try { payload = JSON.parse(text); } catch { payload = { error: { message: text } }; }
      if (!r.ok) {
        return res.status(r.status).json(payload);
      }
      return res.json(normalizeOpenAIResponse(payload));
    } catch (e) {
      console.error("OpenAI proxy error:", e);
      return res.status(502).json({ error: "OpenAI proxy error" });
    }
  }

  if (provider === "gemini") {
    if (!GEMINI_API_KEY) return res.status(500).json({ error: "Missing GEMINI_API_KEY environment variable. Configure it before using Gemini." });
    try {
    const model = req.body?.model || "gemini-3.6-flash";

const modelsToTry = [
  ...new Set([
    model,
    process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash",
  ]),
];

let r = null;
let payload = null;

for (const candidateModel of modelsToTry) {
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent`
  );
  url.searchParams.set("key", GEMINI_API_KEY);

  for (let attempt = 1; attempt <= 3; attempt++) {
    r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildGeminiPayload(req.body)),
    });

    const text = await r.text();

    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: { message: text } };
    }

    if (r.ok) {
      return res.json(normalizeGeminiResponse(payload));
    }

    const retryable = [429, 500, 503].includes(r.status);

    if (!retryable) {
      return res.status(r.status).json(payload);
    }

    console.warn(
      `Gemini ${candidateModel} returned ${r.status} (attempt ${attempt}/3)`
    );

    if (attempt < 3) {
      await new Promise((resolve) =>
        setTimeout(resolve, 1200 * attempt)
      );
    }
  }
}

return res.status(r?.status || 503).json(
  payload || {
    error: {
      message: "Gemini is temporarily unavailable after retries.",
    },
  }
);
    } catch (e) {
      console.error("Gemini proxy error:", e);
      return res.status(502).json({ error: "Gemini proxy error" });
    }
  }

  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "Missing ANTHROPIC_API_KEY environment variable. Configure it before using Anthropic." });
  try {
    const { provider, ...rest } = req.body || {};
    const outboundBody = {
      ...rest,
      max_tokens: req.body?.max_tokens ?? 1024,
    };

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": process.env.ANTHROPIC_VERSION || "2023-06-01",
        "Accept": "application/json",
      },
      body: JSON.stringify(outboundBody),
    });
    const text = await r.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { error: { message: text } }; }
    res.status(r.status);
    // propagate headers that may be useful (e.g. retry-after)
    if (r.headers.get("retry-after")) res.setHeader("retry-after", r.headers.get("retry-after"));
    return res.json(payload);
  } catch (e) {
    console.error("Proxy error:", e);
    return res.status(502).json({ error: "Proxy error" });
  }
});

// Serve the built React/Vite app in production
app.use(express.static("dist"));

app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/ai/")) {
    return res.sendFile("index.html", { root: "dist" });
  }
  next();
});

app.listen(PORT, () => console.log(`App + AI proxy listening on port ${PORT}`));
