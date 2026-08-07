import "dotenv/config";
import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_PROVIDER = process.env.AI_PROVIDER || "anthropic";
app.use(bodyParser.json({ limit: "8mb" }));
/* ---------- PostgreSQL ---------- */

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    })
  : null;

const dbReady = pool
  ? pool.query(`
      CREATE TABLE IF NOT EXISTS worlds (
        code TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        world_code TEXT NOT NULL,
        account_id TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      );

      CREATE INDEX IF NOT EXISTS sessions_expires_idx
      ON sessions (expires_at);
    `).then(() => {
      console.log("PostgreSQL ready");
    }).catch((err) => {
      console.error("PostgreSQL init error:", err);
    })
  : Promise.resolve();

async function requireDb(res) {
  if (!pool) {
    res.status(503).json({ error: "Database not configured" });
    return false;
  }

  await dbReady;
  return true;
}
/* ---------- biztonságos account + session segédek ---------- */

const SESSION_COOKIE = "mv_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function cleanCode(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
}

function passwordHash(password, salt) {
  return "s2:" + sha256(`${String(salt)}::${String(password)}`);
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));

  if (x.length !== y.length) return false;

  return crypto.timingSafeEqual(x, y);
}

function findAccountByUsername(world, username) {
  const wanted = cleanUsername(username);

  for (const id of Object.keys(world?.accounts || {})) {
    const account = world.accounts[id];

    if (
      account &&
      cleanUsername(account.username) === wanted
    ) {
      return { id, account };
    }
  }

  return null;
}

function readCookie(req, name) {
  const raw = String(req.headers.cookie || "");

  for (const part of raw.split(";")) {
    const i = part.indexOf("=");

    if (i < 0) continue;

    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();

    if (key === name) {
      return decodeURIComponent(value);
    }
  }

  return "";
}

function sessionTokenHash(token) {
  return sha256(token);
}

async function createSession(worldCode, accountId) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sessionTokenHash(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await pool.query(
    `
    DELETE FROM sessions
    WHERE expires_at <= NOW()
    `
  );

  await pool.query(
    `
    INSERT INTO sessions (
      token_hash,
      world_code,
      account_id,
      expires_at
    )
    VALUES ($1, $2, $3, $4)
    `,
    [tokenHash, worldCode, accountId, expiresAt]
  );

  return token;
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
}

async function getSession(req) {
  const token = readCookie(req, SESSION_COOKIE);

  if (!token || !pool) return null;

  const result = await pool.query(
    `
    SELECT
      s.world_code,
      s.account_id,
      w.data
    FROM sessions s
    JOIN worlds w
      ON w.code = s.world_code
    WHERE
      s.token_hash = $1
      AND s.expires_at > NOW()
    LIMIT 1
    `,
    [sessionTokenHash(token)]
  );

  if (!result.rows.length) return null;

  return {
    token,
    worldCode: result.rows[0].world_code,
    accountId: result.rows[0].account_id,
    world: result.rows[0].data,
  };
}
function legacyPasswordHash(password, salt) {
  const txt = String(salt) + "::" + String(password);
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;

  for (let i = 0; i < txt.length; i++) {
    h1 = ((h1 ^ txt.charCodeAt(i)) * 16777619) >>> 0;
    h2 = ((h2 + txt.charCodeAt(i) * (i + 7)) * 2654435761) >>> 0;
  }

  return "f1:" + h1.toString(16) + h2.toString(16);
}

function verifyPassword(password, account) {
  if (!account || !account.hash) return false;

  let calculated = "";

  if (String(account.hash).startsWith("s2:")) {
    calculated = passwordHash(password, account.salt);
  } else if (String(account.hash).startsWith("f1:")) {
    calculated = legacyPasswordHash(password, account.salt);
  } else {
    return false;
  }

  return safeEqual(calculated, account.hash);
}
function safeWorldForClient(world) {
  const clean = JSON.parse(JSON.stringify(world || {}));

  for (const account of Object.values(clean.accounts || {})) {
    if (!account) continue;

    delete account.hash;
    delete account.salt;
    delete account.password;
  }

  return clean;
}
/* ---------- LOGIN ---------- */

app.post("/auth/login", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const code = cleanCode(req.body?.code);
    const username = cleanUsername(req.body?.username);
    const password = String(req.body?.password || "");

    if (!code || !username || !password) {
      return res.status(400).json({
        error: "World code, username and password are required.",
      });
    }

    const result = await pool.query(
      `
      SELECT data
      FROM worlds
      WHERE code = $1
      LIMIT 1
      `,
      [code]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "World not found.",
      });
    }

    const world = result.rows[0].data;
    const found = findAccountByUsername(world, username);

    if (!found) {
      return res.status(401).json({
        error: "Wrong username or password.",
      });
    }

    const accountId = found.id;
    const account = found.account;

    if (!account.hash) {
      account.salt = crypto.randomBytes(18).toString("hex");
      account.hash = passwordHash(password, account.salt);

      world.rev = Number(world.rev || 0) + 1;

      await pool.query(
        `
        UPDATE worlds
        SET data = $2::jsonb,
            updated_at = NOW()
        WHERE code = $1
        `,
        [code, JSON.stringify(world)]
      );
    } else if (!verifyPassword(password, account)) {
      return res.status(401).json({
        error: "Wrong username or password.",
      });
    }

    const token = await createSession(code, accountId);

    setSessionCookie(res, token);

    return res.json({
  ok: true,
  meId: accountId,
  world: safeWorldForClient(world),
});
  } catch (err) {
    console.error("Login error:", err);

    return res.status(500).json({
      error: "Login failed.",
    });
  }
});
/* ---------- SESSION RESTORE ---------- */

app.get("/auth/session", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const session = await getSession(req);

    if (!session) {
      clearSessionCookie(res);

      return res.status(401).json({
        authenticated: false,
      });
    }

    const account =
      session.world?.accounts?.[session.accountId];

    if (!account) {
      if (session.token) {
        await pool.query(
          `
          DELETE FROM sessions
          WHERE token_hash = $1
          `,
          [sessionTokenHash(session.token)]
        );
      }

      clearSessionCookie(res);

      return res.status(401).json({
        authenticated: false,
      });
    }

    return res.json({
      authenticated: true,
      meId: session.accountId,
      world: safeWorldForClient(session.world),
    });
  } catch (err) {
    console.error("Session restore error:", err);

    return res.status(500).json({
      error: "Session restore failed.",
    });
  }
});
/* ---------- LOGOUT ---------- */

app.post("/auth/logout", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const token = readCookie(req, SESSION_COOKIE);

    if (token) {
      await pool.query(
        `
        DELETE FROM sessions
        WHERE token_hash = $1
        `,
        [sessionTokenHash(token)]
      );
    }

    clearSessionCookie(res);

    return res.json({ ok: true });
  } catch (err) {
    console.error("Logout error:", err);

    clearSessionCookie(res);

    return res.json({
      ok: true,
    });
  }
});
/* ---------- ACCOUNT DELETE ---------- */

app.post("/account/delete", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const session = await getSession(req);

    if (!session) {
      clearSessionCookie(res);

      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const worldCode = session.worldCode;
    const accountId = session.accountId;

    const result = await pool.query(
      `
      SELECT data
      FROM worlds
      WHERE code = $1
      LIMIT 1
      `,
      [worldCode]
    );

    if (!result.rows.length) {
      clearSessionCookie(res);

      return res.status(404).json({
        error: "World not found.",
      });
    }

    const world = result.rows[0].data;

    if (
      !world.accounts ||
      !world.accounts[accountId]
    ) {
      /*
        Ha az account már nem létezik, akkor is
        eltakarítjuk az esetleges régi sessionöket.
      */
      await pool.query(
        `
        DELETE FROM sessions
        WHERE world_code = $1
          AND account_id = $2
        `,
        [worldCode, accountId]
      );

      clearSessionCookie(res);

      return res.json({
        ok: true,
        alreadyDeleted: true,
      });
    }

    /*
      Tombstone: egy régebbi mentés ne tudja
      később "feltámasztani" a törölt fiókot.
    */
    if (!world.deleted) {
      world.deleted = {};
    }

    world.deleted[accountId] = Date.now();

    /*
      Maga a fiók + saját karakter törlése.
    */
    if (world.accounts) {
      delete world.accounts[accountId];
    }

    if (world.players) {
      delete world.players[accountId];
    }

    /*
      Kifejezetten ehhez a userhez tartozó
      személyes állapotok törlése.
    */
    if (world.userSettings) {
      delete world.userSettings[accountId];
    }

    if (world.notify) {
      delete world.notify[accountId];
    }

    if (world.mems) {
      delete world.mems[accountId];
    }

    if (world.charMemory) {
      delete world.charMemory[accountId];
    }

    /*
      Ha ez volt a world owner account,
      ne maradjon nem létező owner ID.
    */
    if (world.owner === accountId) {
      world.owner =
        Object.keys(world.accounts || {})[0] || "";
    }

    world.rev =
      Number(world.rev || 0) + 1;

    if (world.universe) {
      world.universe.at = Date.now();
    }

    /*
      A törölt állapotot először biztosan
      elmentjük PostgreSQL-be.
    */
    await pool.query(
      `
      UPDATE worlds
      SET data = $2::jsonb,
          updated_at = NOW()
      WHERE code = $1
      `,
      [
        worldCode,
        JSON.stringify(world),
      ]
    );

    /*
      Az account ÖSSZES sessionjét töröljük.
      Tehát másik telefonon/laptopon is kijelentkezik.
    */
    await pool.query(
      `
      DELETE FROM sessions
      WHERE world_code = $1
        AND account_id = $2
      `,
      [worldCode, accountId]
    );

    clearSessionCookie(res);

    console.log(
      `Deleted account ${accountId} from world ${worldCode}`
    );

    return res.json({
      ok: true,
      deleted: true,
    });
  } catch (err) {
    console.error("Account delete error:", err);

    return res.status(500).json({
      error: "Account deletion failed.",
    });
  }
});
/* ---------- EGYSZERI HELYI VILÁG MIGRÁCIÓ ---------- */

app.post("/auth/migrate", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const incomingWorld = req.body?.world;
    const username = cleanUsername(req.body?.username);
    const password = String(req.body?.password || "");

    if (
      !incomingWorld ||
      typeof incomingWorld !== "object" ||
      !incomingWorld.code
    ) {
      return res.status(400).json({
        error: "Missing world data.",
      });
    }

    const code = cleanCode(incomingWorld.code);

    if (!code || !username || !password) {
      return res.status(400).json({
        error: "World code, username and password are required.",
      });
    }

    // Már szerveren lévő világot a migráció soha nem írhat felül.
    const existing = await pool.query(
      `
      SELECT code
      FROM worlds
      WHERE code = $1
      LIMIT 1
      `,
      [code]
    );

    if (existing.rows.length) {
      return res.status(409).json({
        error: "World already exists on the server.",
      });
    }

    const world = JSON.parse(JSON.stringify(incomingWorld));
    world.code = code;

    const found = findAccountByUsername(world, username);

    if (!found) {
      return res.status(401).json({
        error: "Wrong username or password.",
      });
    }

    const accountId = found.id;
    const account = found.account;

    // A feltöltés előtt ténylegesen ellenőrizzük,
    // hogy ez a user jogosult ehhez a világhoz.
    if (!account.hash) {
      account.salt = crypto.randomBytes(18).toString("hex");
      account.hash = passwordHash(password, account.salt);
    } else if (!verifyPassword(password, account)) {
      return res.status(401).json({
        error: "Wrong username or password.",
      });
    }

    world.rev = Number(world.rev || 0) + 1;

    await pool.query(
      `
      INSERT INTO worlds (
        code,
        data,
        updated_at
      )
      VALUES ($1, $2::jsonb, NOW())
      `,
      [code, JSON.stringify(world)]
    );

    const token = await createSession(code, accountId);

    setSessionCookie(res, token);

    console.log(`Migrated world ${code}`);

    return res.json({
      ok: true,
      migrated: true,
      meId: accountId,
      world: safeWorldForClient(world),
    });
  } catch (err) {
    console.error("World migration error:", err);

    return res.status(500).json({
      error: "World migration failed.",
    });
  }
});
/* ---------- AUTHENTICATED WORLD AUTOSAVE ---------- */

app.post("/world/save", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const session = await getSession(req);

    if (!session) {
      clearSessionCookie(res);

      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const incomingWorld = req.body?.world;

    if (
      !incomingWorld ||
      typeof incomingWorld !== "object" ||
      !incomingWorld.code
    ) {
      return res.status(400).json({
        error: "Missing world data.",
      });
    }

    const incomingCode = cleanCode(incomingWorld.code);

    if (incomingCode !== session.worldCode) {
      return res.status(403).json({
        error: "You cannot save another world.",
      });
    }

    const existingResult = await pool.query(
      `
      SELECT data
      FROM worlds
      WHERE code = $1
      LIMIT 1
      `,
      [session.worldCode]
    );

    if (!existingResult.rows.length) {
      return res.status(404).json({
        error: "World not found.",
      });
    }

    const existingWorld = existingResult.rows[0].data;
    const nextWorld = JSON.parse(JSON.stringify(incomingWorld));

    /*
      A kliens NEM kapja meg a jelszó hash/salt adatokat.
      Ezért mentéskor ezeket mindig a jelenlegi szerveres
      példányból tesszük vissza.
    */
    if (!nextWorld.accounts) nextWorld.accounts = {};

    for (const [accountId, oldAccount] of Object.entries(
      existingWorld.accounts || {}
    )) {
      /*
        Ha az accountot a kliens ténylegesen törölte, és a deleted
        tombstone is ott van, nem hozzuk vissza.
      */
      const wasDeleted = Boolean(
        nextWorld.deleted &&
        nextWorld.deleted[accountId]
      );

      if (wasDeleted && !nextWorld.accounts[accountId]) {
        continue;
      }

      if (!nextWorld.accounts[accountId]) {
        nextWorld.accounts[accountId] =
          JSON.parse(JSON.stringify(oldAccount));
      }

      if (oldAccount?.hash) {
        nextWorld.accounts[accountId].hash = oldAccount.hash;
      }

      if (oldAccount?.salt) {
        nextWorld.accounts[accountId].salt = oldAccount.salt;
      }
    }

    nextWorld.code = session.worldCode;
    nextWorld.rev = Math.max(
      Number(nextWorld.rev || 0),
      Number(existingWorld.rev || 0)
    ) + 1;

    if (nextWorld.universe) {
      nextWorld.universe.at = Date.now();
    }

    await pool.query(
      `
      UPDATE worlds
      SET data = $2::jsonb,
          updated_at = NOW()
      WHERE code = $1
      `,
      [
        session.worldCode,
        JSON.stringify(nextWorld),
      ]
    );

    return res.json({
      ok: true,
      world: safeWorldForClient(nextWorld),
    });
  } catch (err) {
    console.error("World save error:", err);

    return res.status(500).json({
      error: "World save failed.",
    });
  }
});
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
