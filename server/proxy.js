import { registerBondAnalysis } from "./bondAnalysis.js";
import { assertCompleteGraph } from "../src/bondAnalysis.js";
import {
  isForegroundRequest,
  filterProvidersForBody,
  mayUsePaidLastResort,
  PAID_LAST_RESORT_PROVIDERS,
  providerTimeBudget,
  selectGeminiKeys,
  backgroundWaitSeconds,
  buildWaitingResult,
  geminiKeyRestMs,
  geminiRateLimitInfo,
  FREE_WRITING_CHAIN,
  planGroqRequest,
  isGroqUtilitySource,
  groqCarriesWhole,
  estimateGroqTokens,
  groqPaceMaxWaitMs,
  createGroqPacer,
  groqRetryMs,
  GROQ_UTILITY_CHAIN,
  createGeminiLedger,
  geminiModelConfig,
  geminiModelLadder,
  planGeminiAttempts,
  geminiBlockReason,
  looksLikeRefusal,
  requestExpectsJson,
  salvageSingleFieldJson,
  PAID_INPUT_PROVIDERS,
  paidMaxInputChars,
  paidCeilingFor,
  planCharBudget,
  createUsageMeter,
  createRefusalTracker,
  orderByRefusals,
} from "./aiPolicy.js";
import { registerSemanticMemory, createEmbedder } from "./semanticMemory.js";
import { createVisionRunner, DEFAULT_GROQ_VISION_MODEL, DEFAULT_OPENROUTER_VISION_MODELS } from "./vision.js";
/* MÁSVILÁG SERVER v19 — SPLIT LAZY MEDIA FILE STORAGE — 20260816_0045 */
/*
 * MÁSVILÁG — server/proxy.js
 * Full drop-in backend with authoritative multi-device world + media sync.
 * PostgreSQL is the online source of truth; stale snapshots are rejected with 409.
 */
import "dotenv/config";
import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import pg from "pg";
import crypto from "crypto";
import dns from "dns/promises";
import net from "net";

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MISTRAL_API_KEY = String(process.env.MISTRAL_API_KEY || "").trim();
const MISTRAL_API_KEY_2 = String(process.env.MISTRAL_API_KEY_2 || "").trim();
const MISTRAL_MODEL = String(process.env.MISTRAL_MODEL || "").trim();
const GROQ_API_KEY = String(process.env.GROQ_API_KEY || "").trim();
const GROQ_API_KEY_2 = String(process.env.GROQ_API_KEY_2 || "").trim();
const GROQ_MODEL = String(process.env.GROQ_MODEL || "").trim();
const GROQ_MODEL_2 = String(process.env.GROQ_MODEL_2 || GROQ_MODEL || "").trim();
/* Groq's free tier is small: each key serves one request at a time and stays inside its minute budget. */
const GROQ_PACER = createGroqPacer();
/* DeepSeek and Mistral cost per token: what they are sent has a ceiling (PAID_MAX_INPUT_CHARS, 0 = off), and
   what every provider reports using is metered (see GET /ai/usage and the [ai-usage] log lines). */
const PAID_MAX_INPUT_CHARS = paidMaxInputChars(process.env);
const AI_USAGE = createUsageMeter();
/* A provider that keeps refusing a kind of request (DeepSeek on DMs, say) is asked last for it, not first. */
const AI_REFUSALS = createRefusalTracker();
/* Gemini's free quota is counted per key AND per model. One ledger, shared by chat, pictures, embeddings
   and sheet analysis, knows which (key, model) pairs are resting, so none of them hits a spent bucket. */
const GEMINI_LEDGER = createGeminiLedger();
const GEMINI_MODELS = geminiModelConfig(process.env);
/* New exact name first; historical Gemini fallback name remains accepted. */
const GEMINI_MODEL_ENV = String(process.env.GEMINI_MODEL || process.env.GEMINI_FALLBACK_MODEL || "").trim();
const AI_PROVIDER_ORDER_ENV = String(process.env.AI_PROVIDER_ORDER || "").trim();
const AI_AUTONOMY_INTERVAL_MINUTES = Math.max(0.05, Math.min(60, Number(process.env.AI_AUTONOMY_INTERVAL_MINUTES) || 1));
const AI_MIN_REQUEST_GAP_MS = Math.max(250, Math.min(30000, Number(process.env.AI_MIN_REQUEST_GAP_MS) || 2000));
const GEMINI_EMBEDDING_MODEL = String(process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001").trim();
const GEMINI_EMBEDDING_DIM = Math.min(3072, Math.max(128, Number(process.env.GEMINI_EMBEDDING_DIM) || 768));
const DEFAULT_PROVIDER = process.env.AI_PROVIDER || "anthropic";
app.use(bodyParser.json({ limit: "60mb" }));
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
CREATE TABLE IF NOT EXISTS world_media (
  world_code TEXT PRIMARY KEY
    REFERENCES worlds(code)
    ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/*
 * v19 — scalable image storage.
 * New images are independent rows instead of one ever-growing JSONB library.
 * The old world_media row remains readable for backwards compatibility.
 */
CREATE TABLE IF NOT EXISTS world_media_files (
  world_code TEXT NOT NULL
    REFERENCES worlds(code)
    ON DELETE CASCADE,
  image_id TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (world_code, image_id)
);

CREATE INDEX IF NOT EXISTS world_media_files_world_updated_idx
  ON world_media_files (world_code, updated_at DESC);

      /*
       * One global login profile can own/join several worlds.
       * The character @username remains inside each world's players row
       * and is deliberately separate from this login username.
       */
      CREATE TABLE IF NOT EXISTS profiles (
        username TEXT PRIMARY KEY,
        salt TEXT NOT NULL,
        hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS profile_worlds (
        profile_username TEXT NOT NULL
          REFERENCES profiles(username)
          ON DELETE CASCADE,
        world_code TEXT NOT NULL
          REFERENCES worlds(code)
          ON DELETE CASCADE,
        account_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (profile_username, world_code)
      );

      CREATE TABLE IF NOT EXISTS character_memories (
        id SERIAL PRIMARY KEY,
        world_code TEXT NOT NULL,
        character_id TEXT NOT NULL,
        subject_ids JSONB NOT NULL,
        memory_type TEXT NOT NULL,
        source TEXT,
        memory_text TEXT NOT NULL,
        importance INTEGER NOT NULL DEFAULT 50,
        confidence DOUBLE PRECISION NOT NULL DEFAULT 1,
        knowledge_type TEXT NOT NULL,
        visibility TEXT NOT NULL,
        metadata JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        embedding JSONB,
        embedding_model TEXT
      );

      ALTER TABLE character_memories
      ADD COLUMN IF NOT EXISTS embedding JSONB;

      ALTER TABLE character_memories
      ADD COLUMN IF NOT EXISTS embedding_model TEXT;

      CREATE INDEX IF NOT EXISTS character_memories_world_char_created_idx
      ON character_memories (world_code, character_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS character_memories_world_type_idx
      ON character_memories (world_code, memory_type);

      CREATE INDEX IF NOT EXISTS character_memories_subject_ids_gin_idx
      ON character_memories USING GIN (subject_ids);

      CREATE INDEX IF NOT EXISTS character_memories_hash_idx
      ON character_memories (world_code, (metadata->>'hash'));

      CREATE INDEX IF NOT EXISTS profile_worlds_world_idx
      ON profile_worlds (world_code);

      CREATE INDEX IF NOT EXISTS sessions_expires_idx
      ON sessions (expires_at);

      /* CLAUDE FIX R43: the world row is rewritten on every save; clean up the old
         copies quickly so the small database disk does not fill up. */
      ALTER TABLE worlds SET (autovacuum_vacuum_scale_factor = 0.0, autovacuum_vacuum_threshold = 20, toast.autovacuum_vacuum_scale_factor = 0.0, toast.autovacuum_vacuum_threshold = 20);

      /* CLAUDE FIX R33: personal character library — characters (sheet + images)
         saved to the login profile, reusable in any other world of that profile. */
      CREATE TABLE IF NOT EXISTS profile_characters (
        profile_username TEXT NOT NULL
          REFERENCES profiles(username)
          ON DELETE CASCADE,
        lib_id TEXT NOT NULL,
        name TEXT NOT NULL,
        data JSONB NOT NULL,
        image_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        source_world TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (profile_username, lib_id)
      );

      /* CLAUDE FIX R40: a relationship read from the sheets once is reused in every
         world and after every restart while those sheet passages are unchanged. */
      CREATE TABLE IF NOT EXISTS relationship_reading_cache (
        cache_key TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS profile_character_media (
        profile_username TEXT NOT NULL
          REFERENCES profiles(username)
          ON DELETE CASCADE,
        image_id TEXT NOT NULL,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (profile_username, image_id)
      );
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
/* The server carries a sheet reading on by itself (see registerBondAnalysis): a sleeping phone or a restart does not
   stop it. BOND_ANALYSIS_RESUME_MS=0 switches this off. */
registerBondAnalysis(app, { pool, requireDb, getSessionIdentity, stringifyJsonbSafe, ledger: GEMINI_LEDGER, resumeEveryMs: process.env.BOND_ANALYSIS_RESUME_MS === undefined ? 30000 : Math.max(0, Number(process.env.BOND_ANALYSIS_RESUME_MS) || 0) });

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

/* -------------------------------------------------------------------------
   POSTGRES JSONB UNICODE SAFETY — v18

   JavaScript strings can contain lone UTF-16 surrogate code units. Modern
   JSON.stringify preserves those as e.g. "\\ud83e", but PostgreSQL jsonb
   rejects malformed surrogate pairs with SQLSTATE 22P02.

   Repair ONLY invalid/unpaired surrogate code units. Valid emoji pairs are
   preserved byte-for-byte. The replacement character U+FFFD prevents one
   malformed AI/user string from blocking the entire authoritative world save.
   ------------------------------------------------------------------------- */
function repairUnpairedUnicodeSurrogates(value) {
  const input = String(value ?? "");
  let output = "";
  let changed = false;

  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);

    // High surrogate: must be followed by a low surrogate.
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next =
        i + 1 < input.length
          ? input.charCodeAt(i + 1)
          : -1;

      if (next >= 0xDC00 && next <= 0xDFFF) {
        output += input[i] + input[i + 1];
        i += 1;
      } else {
        output += "\uFFFD";
        changed = true;
      }

      continue;
    }

    // Lone low surrogate is invalid too.
    if (code >= 0xDC00 && code <= 0xDFFF) {
      output += "\uFFFD";
      changed = true;
      continue;
    }

    output += input[i];
  }

  return changed ? output : input;
}

function stringifyJsonbSafe(value, context = "jsonb") {
  let repairedStrings = 0;

  const json = JSON.stringify(
    value,
    (_key, current) => {
      if (typeof current !== "string") {
        return current;
      }

      const repaired =
        repairUnpairedUnicodeSurrogates(
          current
        );

      if (repaired !== current) {
        repairedStrings += 1;
      }

      return repaired;
    }
  );

  if (repairedStrings > 0) {
    console.warn(
      `[unicode-repair] ${context}: repaired ${repairedStrings} malformed string(s)`
    );
  }

  return json;
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

/* PERFORMANCE v15: auth-only hot paths must not deserialize the entire world.
   Saves, media sync and AI requests usually need only the session identity. */
async function getSessionIdentity(req) {
  const token = readCookie(req, SESSION_COOKIE);

  if (!token || !pool) return null;

  const result = await pool.query(
    `
    SELECT
      world_code,
      account_id
    FROM sessions
    WHERE token_hash = $1
      AND expires_at > NOW()
    LIMIT 1
    `,
    [sessionTokenHash(token)]
  );

  if (!result.rows.length) return null;

  return {
    token,
    worldCode: result.rows[0].world_code,
    accountId: result.rows[0].account_id,
  };
}

async function getSessionMeta(req) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token || !pool) return null;

  const result = await pool.query(
    `
    SELECT
      s.world_code,
      s.account_id,
      w.data->'accounts'->s.account_id AS account,
      COALESCE((w.data->>'syncRev')::bigint, 0) AS sync_rev
    FROM sessions s
    JOIN worlds w ON w.code = s.world_code
    WHERE s.token_hash = $1
      AND s.expires_at > NOW()
    LIMIT 1
    `,
    [sessionTokenHash(token)]
  );

  if (!result.rows.length) return null;
  const row = result.rows[0];
  return {
    token,
    worldCode: row.world_code,
    accountId: row.account_id,
    account: row.account || null,
    syncRev: Math.max(0, Math.floor(Number(row.sync_rev) || 0)),
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

function loginProfileUsernameFromWorld(world, accountId) {
  return cleanUsername(
    world &&
    world.accounts &&
    world.accounts[accountId] &&
    world.accounts[accountId].username
  );
}

async function getProfileRow(db, username, forUpdate = false) {
  const u = cleanUsername(username);
  if (!u) return null;

  const result = await db.query(
    `
    SELECT username, salt, hash, created_at
    FROM profiles
    WHERE username = $1
    ${forUpdate ? "FOR UPDATE" : ""}
    LIMIT 1
    `,
    [u]
  );

  return result.rows.length ? result.rows[0] : null;
}

async function ensureGlobalProfileCredential(db, username, password) {
  const u = cleanUsername(username);
  const pw = String(password || "");

  if (!u || !pw) {
    const err = new Error("Missing global profile credentials.");
    err.status = 400;
    throw err;
  }

  let row = await getProfileRow(db, u, true);

  if (row) {
    if (!verifyPassword(pw, row)) {
      const err = new Error(
        "This username belongs to a profile with a different password."
      );
      err.status = 401;
      err.code = "PROFILE_PASSWORD_MISMATCH";
      throw err;
    }

    return row;
  }

  const salt = crypto.randomBytes(18).toString("hex");
  const hash = passwordHash(pw, salt);

  const inserted = await db.query(
    `
    INSERT INTO profiles (username, salt, hash)
    VALUES ($1, $2, $3)
    ON CONFLICT (username) DO NOTHING
    RETURNING username, salt, hash, created_at
    `,
    [u, salt, hash]
  );

  if (inserted.rows.length) {
    return inserted.rows[0];
  }

  row = await getProfileRow(db, u, true);

  if (!row || !verifyPassword(pw, row)) {
    const err = new Error(
      "This username belongs to a profile with a different password."
    );
    err.status = 401;
    err.code = "PROFILE_PASSWORD_MISMATCH";
    throw err;
  }

  return row;
}

async function linkProfileWorld(db, username, worldCode, accountId) {
  const u = cleanUsername(username);
  const code = cleanCode(worldCode);

  if (!u || !code || !accountId) return;

  await db.query(
    `
    INSERT INTO profile_worlds (
      profile_username,
      world_code,
      account_id
    )
    VALUES ($1, $2, $3)
    ON CONFLICT (profile_username, world_code)
    DO UPDATE SET account_id = EXCLUDED.account_id
    `,
    [u, code, String(accountId)]
  );
}

async function currentProfileForSession(session) {
  if (!session) return null;

  const username = loginProfileUsernameFromWorld(
    session.world,
    session.accountId
  );

  if (!username) return null;

  const profile = await getProfileRow(pool, username, false);

  return profile
    ? { ...profile, username }
    : null;
}
function worldSyncRevServer(world) {
  return Math.max(
    0,
    Math.floor(
      Number(
        world && world.syncRev
      ) || 0
    )
  );
}

function safeWorldForClient(world) {
  /* PERFORMANCE v16: never deep-clone the entire multi-MB world just to hide
     three account-secret fields. Clone only the objects we actually redact;
     every other branch is read-only while Express serializes the response. */
  const source = world && typeof world === "object" ? world : {};
  const clean = { ...source };
  clean.syncRev = worldSyncRevServer(source);

  const sourceAccounts = source.accounts && typeof source.accounts === "object"
    ? source.accounts
    : {};
  clean.accounts = {};

  for (const [accountId, account] of Object.entries(sourceAccounts)) {
    if (!account || typeof account !== "object") {
      clean.accounts[accountId] = account;
      continue;
    }

    const safeAccount = { ...account };
    delete safeAccount.hash;
    delete safeAccount.salt;
    delete safeAccount.password;
    clean.accounts[accountId] = safeAccount;
  }

  return clean;
}

const MEDIA_ENVELOPE_VERSION = 2;

function mediaEnvelopeFromRow(raw) {
  if (
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    raw.__masvilagMediaEnvelope ===
      MEDIA_ENVELOPE_VERSION &&
    raw.media &&
    typeof raw.media === "object" &&
    !Array.isArray(raw.media)
  ) {
    return {
      syncRev:
        Math.max(
          0,
          Math.floor(
            Number(
              raw.syncRev
            ) || 0
          )
        ),
      media: raw.media,
    };
  }

  /*
   * Backward compatibility:
   * the old world_media.data row was the raw image map itself.
   */
  return {
    syncRev: 0,
    media:
      raw &&
      typeof raw === "object" &&
      !Array.isArray(raw)
        ? raw
        : {},
  };
}

function makeMediaEnvelope(
  media,
  syncRev
) {
  return {
    __masvilagMediaEnvelope:
      MEDIA_ENVELOPE_VERSION,
    syncRev:
      Math.max(
        0,
        Math.floor(
          Number(syncRev) || 0
        )
      ),
    media:
      media &&
      typeof media === "object" &&
      !Array.isArray(media)
        ? media
        : {},
  };
}

/* -------------------------------------------------------------------------
   WORLD DELETION / ORPHAN CLEANUP
   A Másvilág world has exactly one human account. If that account is deleted,
   the world itself must cease to exist and its code must become reusable.
   ------------------------------------------------------------------------- */
function worldHasHumanAccount(world) {
  return Boolean(
    world &&
    world.accounts &&
    Object.keys(world.accounts).length
  );
}

async function deleteWorldGraph(db, worldCode) {
  const code = cleanCode(worldCode);
  if (!code) return false;

  /* Tables without a world FK/cascade are removed explicitly. */
  await db.query(
    `DELETE FROM sessions WHERE world_code = $1`,
    [code]
  );

  await db.query(
    `DELETE FROM character_memories WHERE world_code = $1`,
    [code]
  );

  /* profile_worlds + world_media also cascade from worlds, but explicit
     cleanup keeps this safe with older database schemas. */
  await db.query(
    `DELETE FROM profile_worlds WHERE world_code = $1`,
    [code]
  );

  await db.query(
    `DELETE FROM world_media WHERE world_code = $1`,
    [code]
  );

  const gone = await db.query(
    `DELETE FROM worlds WHERE code = $1 RETURNING code`,
    [code]
  );

  return Boolean(gone.rows.length);
}

async function deleteUnusedProfile(db, profileUsername) {
  const username = cleanUsername(profileUsername);
  if (!username) return false;

  const remaining = await db.query(
    `SELECT 1 FROM profile_worlds WHERE profile_username = $1 LIMIT 1`,
    [username]
  );

  if (remaining.rows.length) return false;

  await db.query(
    `DELETE FROM profiles WHERE username = $1`,
    [username]
  );

  return true;
}

async function deleteAllUnusedProfiles(db) {
  await db.query(`
    DELETE FROM profiles p
    WHERE NOT EXISTS (
      SELECT 1
      FROM profile_worlds pw
      WHERE pw.profile_username = p.username
    )
  `);
}

/* -------------------------------------------------------------------------
   WORLD CODE PEEK
   Public, intentionally returns NO usernames/account data.
   ------------------------------------------------------------------------- */
app.get("/world/peek", async (req, res) => {
  let client = null;

  try {
    if (!(await requireDb(res))) return;

    const code = cleanCode(req.query?.code);

    if (!code) {
      return res.status(400).json({
        error: "World code is required.",
      });
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const result = await client.query(
      `
      SELECT code, data,
             data->'universe'->>'name' AS name
      FROM worlds
      WHERE code = $1
      LIMIT 1
      FOR UPDATE
      `,
      [code]
    );

    if (!result.rows.length) {
      await client.query("COMMIT");
      client.release();
      client = null;

      return res.json({
        ok: true,
        found: false,
        code,
      });
    }

    const row = result.rows[0];

    /*
     * v60 orphan repair: older /account/delete versions left the worlds row
     * behind with zero human accounts. Clean it the first time anybody peeks
     * that code so an already-deleted account does not reserve it forever.
     */
    if (!worldHasHumanAccount(row.data)) {
      await deleteWorldGraph(client, code);
      await deleteAllUnusedProfiles(client);
      await client.query("COMMIT");
      client.release();
      client = null;

      return res.json({
        ok: true,
        found: false,
        code,
        cleanedOrphan: true,
      });
    }

    await client.query("COMMIT");
    client.release();
    client = null;

    return res.json({
      ok: true,
      found: true,
      code,
      name: row.name || code,
    });
  } catch (err) {
    if (client) {
      try { await client.query("ROLLBACK"); } catch (e) {}
      client.release();
      client = null;
    }

    console.error("World peek error:", err);

    return res.status(500).json({
      error: "World lookup failed.",
    });
  }
});

/* -------------------------------------------------------------------------
   LOGIN
   Password initialization is also serialized with SELECT ... FOR UPDATE.
   ------------------------------------------------------------------------- */
app.post("/auth/login", async (req, res) => {
  let client = null;

  try {
    if (!(await requireDb(res))) return;

    const code =
      cleanCode(req.body?.code);

    const username =
      cleanUsername(
        req.body?.username
      );

    const password =
      String(
        req.body?.password || ""
      );

    if (
      !code ||
      !username ||
      !password
    ) {
      return res.status(400).json({
        error:
          "World code, username and password are required.",
      });
    }

    client =
      await pool.connect();

    await client.query("BEGIN");

    const result =
      await client.query(
        `
        SELECT data
        FROM worlds
        WHERE code = $1
        LIMIT 1
        FOR UPDATE
        `,
        [code]
      );

    if (!result.rows.length) {
      await client.query(
        "ROLLBACK"
      );

      client.release();
      client = null;

      return res.status(404).json({
        error: "World not found.",
      });
    }

    const world =
      result.rows[0].data;

    world.syncRev =
      worldSyncRevServer(world);

    const found =
      findAccountByUsername(
        world,
        username
      );

    if (!found) {
      await client.query(
        "ROLLBACK"
      );

      client.release();
      client = null;

      return res.status(401).json({
        error:
          "Wrong username or password.",
      });
    }

    const accountId =
      found.id;

    const account =
      found.account;

    if (!account.hash) {
      account.salt =
        crypto
          .randomBytes(18)
          .toString("hex");

      account.hash =
        passwordHash(
          password,
          account.salt
        );

      world.rev =
        Number(
          world.rev || 0
        ) + 1;

      world.syncRev =
        worldSyncRevServer(
          world
        ) + 1;

      if (world.universe) {
        world.universe.at =
          Date.now();
      }

      await client.query(
        `
        UPDATE worlds
        SET data = $2::jsonb,
            updated_at = NOW()
        WHERE code = $1
        `,
        [
          code,
          stringifyJsonbSafe(world, "login-world"),
        ]
      );
    } else if (
      !verifyPassword(
        password,
        account
      )
    ) {
      await client.query(
        "ROLLBACK"
      );

      client.release();
      client = null;

      return res.status(401).json({
        error:
          "Wrong username or password.",
      });
    }

    /*
     * Global profile credential. The first successfully authenticated
     * world creates it; every later world must use the same password.
     */
    let globalProfile;

    try {
      globalProfile =
        await ensureGlobalProfileCredential(
          client,
          username,
          password
        );
    } catch (profileErr) {
      await client.query("ROLLBACK");
      client.release();
      client = null;

      return res.status(profileErr.status || 401).json({
        code: profileErr.code || "PROFILE_LOGIN_FAILED",
        error: profileErr.message || "Profile login failed.",
      });
    }

    /* Keep the per-world account credential aligned with the global profile. */
    if (globalProfile) {
      account.salt = globalProfile.salt;
      account.hash = globalProfile.hash;
    }

    await linkProfileWorld(
      client,
      username,
      code,
      accountId
    );

    /* Persist a possible credential alignment too. */
    await client.query(
      `
      UPDATE worlds
      SET data = $2::jsonb,
          updated_at = NOW()
      WHERE code = $1
      `,
      [code, stringifyJsonbSafe(world, "login-world-align")]
    );

    await client.query("COMMIT");
    client.release();
    client = null;

    const token =
      await createSession(
        code,
        accountId
      );

    setSessionCookie(
      res,
      token
    );

    return res.json({
      ok: true,
      meId: accountId,
      profileUsername: username,
      syncRev:
        worldSyncRevServer(world),
      world:
        safeWorldForClient(world),
    });
  } catch (err) {
    if (client) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (e) {}

      client.release();
      client = null;
    }

    console.error(
      "Login error:",
      err
    );

    return res.status(500).json({
      error: "Login failed.",
    });
  }
});

/* -------------------------------------------------------------------------
   SESSION RESTORE
   Always returns the CURRENT PostgreSQL world through getSession().
   ------------------------------------------------------------------------- */
app.get("/auth/session", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const lite = String(req.query?.lite || "") === "1";

    if (lite) {
      const session = await getSessionMeta(req);
      if (!session || !session.account) {
        clearSessionCookie(res);
        return res.status(401).json({ authenticated: false });
      }

      return res.json({
        authenticated: true,
        meId: session.accountId,
        profileUsername: cleanUsername(session.account.username),
        syncRev: session.syncRev,
        code: session.worldCode,
      });
    }

    const session = await getSession(req);
    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({ authenticated: false });
    }

    const account = session.world?.accounts?.[session.accountId];
    if (!account) {
      if (session.token) {
        await pool.query(
          `DELETE FROM sessions WHERE token_hash = $1`,
          [sessionTokenHash(session.token)]
        );
      }
      clearSessionCookie(res);
      return res.status(401).json({ authenticated: false });
    }

    return res.json({
      authenticated: true,
      meId: session.accountId,
      profileUsername: cleanUsername(account.username),
      syncRev: worldSyncRevServer(session.world),
      world: safeWorldForClient(session.world),
    });
  } catch (err) {
    console.error("Session restore error:", err);
    return res.status(500).json({ error: "Session restore failed." });
  }
});

/* PERFORMANCE v16: authenticated full-world load is separate from the tiny
   session check. This prevents the browser from receiving/parsing the large
   world until authentication has already succeeded. */
app.get("/world/load", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const session = await getSessionMeta(req);
    if (!session || !session.account) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Not authenticated." });
    }

    const result = await pool.query(
      `SELECT data FROM worlds WHERE code = $1 LIMIT 1`,
      [session.worldCode]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "World not found." });
    }

    return res.json({
      ok: true,
      meId: session.accountId,
      syncRev: worldSyncRevServer(result.rows[0].data),
      world: safeWorldForClient(result.rows[0].data),
    });
  } catch (err) {
    console.error("World load error:", err);
    return res.status(500).json({ error: "World load failed." });
  }
});

/* -------------------------------------------------------------------------
   LIGHTWEIGHT WORLD REVISION CHECK — performance v15
   Returns no world JSON. Poll/focus checks use this before downloading state.
   ------------------------------------------------------------------------- */
app.get("/world/version", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const session = await getSessionIdentity(req);

    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({
        authenticated: false,
        error: "Not authenticated.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        COALESCE(NULLIF(data->>'syncRev', '')::BIGINT, 0) AS sync_rev,
        COALESCE(NULLIF(data->>'rev', '')::BIGINT, 0) AS rev
      FROM worlds
      WHERE code = $1
      LIMIT 1
      `,
      [session.worldCode]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "World not found." });
    }

    return res.json({
      authenticated: true,
      code: session.worldCode,
      meId: session.accountId,
      syncRev: Number(result.rows[0].sync_rev) || 0,
      rev: Number(result.rows[0].rev) || 0,
    });
  } catch (err) {
    console.error("World version error:", err);
    return res.status(500).json({ error: "World version check failed." });
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
/* -------------------------------------------------------------------------
   ACCOUNT DELETE
   Serialized against world saves. Deletion increments syncRev.
   ------------------------------------------------------------------------- */
app.post("/account/delete", async (req, res) => {
  let client = null;

  try {
    if (!(await requireDb(res))) return;

    const session = await getSession(req);

    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const worldCode = cleanCode(session.worldCode);
    const accountId = session.accountId;

    client = await pool.connect();
    await client.query("BEGIN");

    const result = await client.query(
      `
      SELECT data
      FROM worlds
      WHERE code = $1
      LIMIT 1
      FOR UPDATE
      `,
      [worldCode]
    );

    if (!result.rows.length) {
      await client.query(
        `DELETE FROM sessions WHERE world_code = $1`,
        [worldCode]
      );

      await client.query("COMMIT");
      client.release();
      client = null;
      clearSessionCookie(res);

      return res.json({
        ok: true,
        alreadyDeleted: true,
        worldDeleted: true,
        code: worldCode,
      });
    }

    const world = result.rows[0].data || {};
    const account = world.accounts && world.accounts[accountId];

    const profileUsername = cleanUsername(
      (account && account.username) ||
      (
        session.world &&
        session.world.accounts &&
        session.world.accounts[accountId] &&
        session.world.accounts[accountId].username
      )
    );

    /*
     * SINGLE-PLAYER WORLD CONTRACT:
     * deleting the human account deletes the WHOLE world. This prevents an
     * ownerless worlds row from continuing to reserve the world code.
     */
    await deleteWorldGraph(client, worldCode);

    if (profileUsername) {
      await deleteUnusedProfile(client, profileUsername);
    }

    await client.query("COMMIT");
    client.release();
    client = null;

    clearSessionCookie(res);

    console.log(
      `Deleted account ${accountId} and world ${worldCode}`
    );

    return res.json({
      ok: true,
      deleted: true,
      worldDeleted: true,
      code: worldCode,
    });
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (e) {}

      client.release();
      client = null;
    }

    console.error("Account/world delete error:", err);

    return res.status(500).json({
      error: "Account and world deletion failed.",
    });
  }
});

/* -------------------------------------------------------------------------
   ONE-TIME LOCAL -> POSTGRES MIGRATION / NEW WORLD CREATION
   PostgreSQL unique constraint is authoritative for the world code.
   ------------------------------------------------------------------------- */
app.post("/auth/migrate", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const incomingWorld =
      req.body?.world;

    const username =
      cleanUsername(
        req.body?.username
      );

    const password =
      String(
        req.body?.password || ""
      );

    if (
      !incomingWorld ||
      typeof incomingWorld !==
        "object" ||
      !incomingWorld.code
    ) {
      return res.status(400).json({
        error: "Missing world data.",
      });
    }

    const code =
      cleanCode(
        incomingWorld.code
      );

    if (
      !code ||
      !username ||
      !password
    ) {
      return res.status(400).json({
        error:
          "World code, username and password are required.",
      });
    }

    const world =
      JSON.parse(
        JSON.stringify(
          incomingWorld
        )
      );

    world.code = code;

    const found =
      findAccountByUsername(
        world,
        username
      );

    if (!found) {
      return res.status(401).json({
        error:
          "Wrong username or password.",
      });
    }

    const accountId =
      found.id;

    const account =
      found.account;

    if (!account.hash) {
      account.salt =
        crypto
          .randomBytes(18)
          .toString("hex");

      account.hash =
        passwordHash(
          password,
          account.salt
        );
    } else if (
      !verifyPassword(
        password,
        account
      )
    ) {
      return res.status(401).json({
        error:
          "Wrong username or password.",
      });
    }

    world.rev =
      Number(
        world.rev || 0
      ) + 1;

    /*
     * Create/verify the global profile before this new world is inserted.
     * The per-world account keeps the login username, while the player
     * character can use a completely different social @username.
     */
    let globalProfile;

    try {
      globalProfile =
        await ensureGlobalProfileCredential(
          pool,
          username,
          password
        );
    } catch (profileErr) {
      return res.status(profileErr.status || 401).json({
        code: profileErr.code || "PROFILE_LOGIN_FAILED",
        error: profileErr.message || "Profile login failed.",
      });
    }

    if (globalProfile) {
      account.salt = globalProfile.salt;
      account.hash = globalProfile.hash;
    }

    /* Server owns this value; never trust the imported/local value. */
    world.syncRev = 1;

    if (world.universe) {
      world.universe.at =
        Date.now();
    }

    const insertWorld = () =>
      pool.query(
        `
        INSERT INTO worlds (
          code,
          data,
          updated_at
        )
        VALUES ($1, $2::jsonb, NOW())
        `,
        [code, stringifyJsonbSafe(world, "world-create")]
      );

    try {
      await insertWorld();
    } catch (err) {
      if (err && err.code === "23505") {
        /* Old account-delete versions can leave a zero-account orphan. */
        const stale = await pool.query(
          `SELECT data FROM worlds WHERE code = $1 LIMIT 1`,
          [code]
        );

        if (
          stale.rows.length &&
          !worldHasHumanAccount(stale.rows[0].data)
        ) {
          await deleteWorldGraph(pool, code);

          try {
            await insertWorld();
          } catch (retryErr) {
            if (retryErr && retryErr.code === "23505") {
              return res.status(409).json({
                code: "WORLD_ALREADY_EXISTS",
                error: "World already exists on the server.",
              });
            }

            throw retryErr;
          }
        } else {
          return res.status(409).json({
            code: "WORLD_ALREADY_EXISTS",
            error: "World already exists on the server.",
          });
        }
      } else {
        throw err;
      }
    }

    await linkProfileWorld(
      pool,
      username,
      code,
      accountId
    );

    const token =
      await createSession(
        code,
        accountId
      );

    setSessionCookie(
      res,
      token
    );

    console.log(
      `Migrated world ${code}`
    );

    return res.json({
      ok: true,
      migrated: true,
      meId: accountId,
      profileUsername: username,
      syncRev: 1,
      world:
        safeWorldForClient(world),
    });
  } catch (err) {
    console.error(
      "World migration error:",
      err
    );

    return res.status(500).json({
      error:
        "World migration failed.",
    });
  }
});

/* -------------------------------------------------------------------------
   GLOBAL PROFILE -> WORLDS
   ------------------------------------------------------------------------- */
app.get("/profile/worlds", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const session = await getSession(req);

    if (!session) {
      clearSessionCookie(res);

      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const profile = await currentProfileForSession(session);

    if (!profile) {
      return res.status(404).json({
        error: "Global profile not found.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        pw.world_code AS code,
        pw.account_id,
        w.data->'universe'->>'name' AS name,
        w.data #>> ARRAY['players', pw.account_id, 'name'] AS character_name,
        w.data #>> ARRAY['players', pw.account_id, 'username'] AS character_username,
        w.updated_at
      FROM profile_worlds pw
      JOIN worlds w ON w.code = pw.world_code
      WHERE pw.profile_username = $1
      ORDER BY w.updated_at DESC, pw.world_code ASC
      `,
      [profile.username]
    );

    return res.json({
      ok: true,
      profileUsername: profile.username,
      currentWorldCode: session.worldCode,
      worlds: result.rows.map((row) => ({
        code: row.code,
        name: row.name || row.code,
        meId: row.account_id,
        characterName: row.character_name || "",
        characterUsername: row.character_username || "",
        updatedAt: row.updated_at,
      })),
    });
  } catch (err) {
    console.error("Profile worlds error:", err);

    return res.status(500).json({
      error: "Failed to load profile worlds.",
    });
  }
});

app.post("/profile/worlds/switch", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const session = await getSession(req);

    if (!session) {
      clearSessionCookie(res);

      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const profile = await currentProfileForSession(session);
    const code = cleanCode(req.body?.code);

    if (!profile || !code) {
      return res.status(400).json({
        error: "Missing profile or world code.",
      });
    }

    const link = await pool.query(
      `
      SELECT pw.account_id, w.data
      FROM profile_worlds pw
      JOIN worlds w ON w.code = pw.world_code
      WHERE pw.profile_username = $1
        AND pw.world_code = $2
      LIMIT 1
      `,
      [profile.username, code]
    );

    if (!link.rows.length) {
      return res.status(404).json({
        error: "This world is not linked to your profile.",
      });
    }

    const accountId = link.rows[0].account_id;
    const world = link.rows[0].data;

    if (!world?.accounts?.[accountId]) {
      return res.status(409).json({
        error: "The linked world profile no longer exists.",
      });
    }

    const token = await createSession(code, accountId);
    setSessionCookie(res, token);

    return res.json({
      ok: true,
      meId: accountId,
      profileUsername: profile.username,
      syncRev: worldSyncRevServer(world),
      world: safeWorldForClient(world),
    });
  } catch (err) {
    console.error("World switch error:", err);

    return res.status(500).json({
      error: "World switch failed.",
    });
  }
});

app.post("/profile/worlds/create", async (req, res) => {
  let client = null;

  try {
    if (!(await requireDb(res))) return;

    const session = await getSession(req);

    if (!session) {
      clearSessionCookie(res);

      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const profile = await currentProfileForSession(session);
    const incomingWorld = req.body?.world;

    if (
      !profile ||
      !incomingWorld ||
      typeof incomingWorld !== "object"
    ) {
      return res.status(400).json({
        error: "Missing world data.",
      });
    }

    const world = JSON.parse(JSON.stringify(incomingWorld));
    const code = cleanCode(world.code);

    if (!code) {
      return res.status(400).json({
        error: "World code is required.",
      });
    }

    world.code = code;

    const candidateIds = Object.keys(world.accounts || {});

    let accountId =
      world.owner &&
      world.accounts?.[world.owner]
        ? String(world.owner)
        : candidateIds.find(
            (id) =>
              cleanUsername(
                world.accounts?.[id]?.username
              ) === profile.username
          );

    if (!accountId) {
      accountId =
        `u${crypto.randomBytes(10).toString("hex")}`;

      if (!world.accounts) world.accounts = {};
      if (!world.players) world.players = {};

      world.accounts[accountId] = {
        id: accountId,
        username: profile.username,
        created: Date.now(),
      };

      world.players[accountId] = {
        id: accountId,
        name:
          String(
            req.body?.characterName ||
            profile.username
          ).slice(0, 120),
        username:
          cleanUsername(
            req.body?.characterUsername
          ) || profile.username,
      };
    }

    if (!world.accounts) world.accounts = {};
    if (!world.players) world.players = {};

    const account =
      world.accounts[accountId] || {};

    account.id = accountId;
    account.username = profile.username;
    account.salt = profile.salt;
    account.hash = profile.hash;
    account.created =
      Number(account.created) || Date.now();

    world.accounts[accountId] = account;

    const player =
      world.players[accountId] ||
      { id: accountId };

    player.id = accountId;

    if (req.body?.characterName) {
      player.name =
        String(
          req.body.characterName
        )
          .trim()
          .slice(0, 120);
    }

    const requestedHandle =
      cleanUsername(
        req.body?.characterUsername
      );

    if (requestedHandle) {
      player.username =
        requestedHandle;
    } else if (!player.username) {
      player.username =
        profile.username;
    }

    world.players[accountId] =
      player;

    world.owner = accountId;

    world.rev =
      Number(world.rev || 0) + 1;

    world.syncRev = 1;

    if (world.universe) {
      world.universe.at =
        Date.now();
    }

    client =
      await pool.connect();

    await client.query("BEGIN");

    const exists =
      await client.query(
        `
        SELECT 1
        FROM worlds
        WHERE code = $1
        LIMIT 1
        `,
        [code]
      );

    if (exists.rows.length) {
      await client.query("ROLLBACK");

      client.release();
      client = null;

      return res.status(409).json({
        code: "WORLD_ALREADY_EXISTS",
        error: "World already exists on the server.",
      });
    }

    await client.query(
      `
      INSERT INTO worlds (
        code,
        data,
        updated_at
      )
      VALUES ($1, $2::jsonb, NOW())
      `,
      [
        code,
        stringifyJsonbSafe(world, "profile-world-create"),
      ]
    );

    await linkProfileWorld(
      client,
      profile.username,
      code,
      accountId
    );

    await client.query("COMMIT");

    client.release();
    client = null;

    const token =
      await createSession(
        code,
        accountId
      );

    setSessionCookie(
      res,
      token
    );

    return res.json({
      ok: true,
      created: true,
      meId: accountId,
      profileUsername:
        profile.username,
      syncRev: 1,
      world:
        safeWorldForClient(
          world
        ),
    });
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (e) {}

      client.release();
      client = null;
    }

    console.error(
      "Profile world create error:",
      err
    );

    return res.status(500).json({
      error: "World creation failed.",
    });
  }
});
/* -------------------------------------------------------------------------
   AUTHORITATIVE WORLD AUTOSAVE

   If expectedSyncRev != current server syncRev:
   - reject stale client with HTTP 409
   - return the authoritative server world
   - NEVER overwrite it with the stale snapshot
   ------------------------------------------------------------------------- */
app.post("/world/save", async (req, res) => {
  let client = null;

  try {
    if (!(await requireDb(res))) return;

    /* Hot save path: do not JOIN/deserialise the full world merely to auth. */
    const session = await getSessionIdentity(req);

    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Not authenticated." });
    }

    const incomingWorld = req.body?.world;

    if (
      !incomingWorld ||
      typeof incomingWorld !== "object" ||
      !incomingWorld.code
    ) {
      return res.status(400).json({ error: "Missing world data." });
    }

    const incomingCode = cleanCode(incomingWorld.code);

    if (incomingCode !== session.worldCode) {
      return res.status(403).json({ error: "You cannot save another world." });
    }

    const expectedSyncRev = Math.max(
      0,
      Math.floor(Number(req.body?.syncRev ?? incomingWorld.syncRev) || 0)
    );

    client = await pool.connect();
    await client.query("BEGIN");

    /* Normal saves fetch only tiny scalars + account secrets, not the full JSONB
       document. A full world is selected only on the rare conflict path. */
    const existingResult = await client.query(
      `
      SELECT
        COALESCE(NULLIF(data->>'syncRev', '')::BIGINT, 0) AS sync_rev,
        COALESCE(NULLIF(data->>'rev', '')::BIGINT, 0) AS rev,
        COALESCE(data->'accounts', '{}'::jsonb) AS accounts
      FROM worlds
      WHERE code = $1
      LIMIT 1
      FOR UPDATE
      `,
      [session.worldCode]
    );

    if (!existingResult.rows.length) {
      await client.query("ROLLBACK");
      client.release();
      client = null;
      return res.status(404).json({ error: "World not found." });
    }

    const serverSyncRev = Number(existingResult.rows[0].sync_rev) || 0;
    const existingRev = Number(existingResult.rows[0].rev) || 0;
    const existingAccounts = existingResult.rows[0].accounts || {};

    if (expectedSyncRev !== serverSyncRev) {
      const conflictResult = await client.query(
        `SELECT data FROM worlds WHERE code = $1 LIMIT 1`,
        [session.worldCode]
      );

      const existingWorld = conflictResult.rows.length
        ? conflictResult.rows[0].data
        : null;

      await client.query("ROLLBACK");
      client.release();
      client = null;

      return res.status(409).json({
        code: "WORLD_CONFLICT",
        error: "The world changed on another client.",
        meId: session.accountId,
        expectedSyncRev,
        serverSyncRev,
        world: existingWorld ? safeWorldForClient(existingWorld) : null,
      });
    }

    /* Express already parsed a private request-body object. Reusing it avoids
       another multi-MB JSON.stringify -> JSON.parse deep clone on every save. */
    const nextWorld = incomingWorld;

    if (!nextWorld.accounts) nextWorld.accounts = {};

    for (const [accountId, oldAccount] of Object.entries(existingAccounts)) {
      const wasDeleted = Boolean(nextWorld.deleted && nextWorld.deleted[accountId]);

      if (wasDeleted && !nextWorld.accounts[accountId]) continue;

      if (!nextWorld.accounts[accountId]) {
        nextWorld.accounts[accountId] = { ...(oldAccount || {}) };
      }

      if (oldAccount?.hash) nextWorld.accounts[accountId].hash = oldAccount.hash;
      if (oldAccount?.salt) nextWorld.accounts[accountId].salt = oldAccount.salt;
    }

    nextWorld.code = session.worldCode;
    nextWorld.rev = Math.max(Number(nextWorld.rev || 0), existingRev) + 1;
    nextWorld.syncRev = serverSyncRev + 1;

    if (nextWorld.universe) nextWorld.universe.at = Date.now();

    if (req.body?.bondReset) {
      try {
        const ids = [...new Set([...Object.values(nextWorld.players || {}).map(c => c.id), ...(nextWorld.chars || []).map(c => c.id), ...(nextWorld.player?.id ? [nextWorld.player.id] : [])])];
        assertCompleteGraph(ids, nextWorld.relationshipBaselines || {});
        if (JSON.stringify(nextWorld.rels) !== JSON.stringify(nextWorld.relationshipBaselines)) throw new Error("Restart graph differs from baseline");
        if (!nextWorld.bondAnalysis?.version) throw new Error("Validated sheet analysis is missing");
      } catch (validationError) {
        /* A rule violation is final (answered with 422 and the reason), not a server fault to retry. */
        validationError.restartRejected = true;
        throw validationError;
      }
      /* A restart wipes what happened in the game, not who the characters are: their own-sheet memory stays. */
      await client.query("DELETE FROM character_memories WHERE world_code = $1 AND memory_type <> 'self_sheet'", [session.worldCode]);
    }
    const nextWorldJson = stringifyJsonbSafe(nextWorld, "world-save");

    await client.query(
      `
      UPDATE worlds
      SET data = $2::jsonb,
          updated_at = NOW()
      WHERE code = $1
      `,
      [session.worldCode, nextWorldJson]
    );

    await client.query("COMMIT");
    client.release();
    client = null;

    if (req.body?.bondReset) console.info("[bond-restart]", JSON.stringify({ characters: Object.keys(nextWorld.bondAnalysis.profiles).length, restored: Object.keys(nextWorld.rels).length, recalculatedProfiles: nextWorld.bondAnalysis.recalculated || 0, recalculatedBonds: nextWorld.bondAnalysis.recalculatedBonds || 0 }));

    /* PERFORMANCE v15: successful saves return only tiny metadata. The client
       already owns the accepted snapshot; echoing several MB back was wasteful. */
    return res.json({
      ok: true,
      meId: session.accountId,
      syncRev: nextWorld.syncRev,
      rev: nextWorld.rev,
    });
  } catch (err) {
    if (client) {
      try { await client.query("ROLLBACK"); } catch (e) {}
      client.release();
      client = null;
    }

    console.error("World save error:", err);
    if (err && err.restartRejected) return res.status(422).json({ error: "Restart rejected: " + err.message });
    return res.status(500).json({ error: "World save failed." });
  }
});

function extractText(content) {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : part.text || ""
      )
      .join("");
  }

  if (
    content &&
    typeof content === "object"
  ) {
    if (
      typeof content.text ===
      "string"
    ) {
      return content.text;
    }

    if (
      Array.isArray(
        content.parts
      )
    ) {
      return content.parts
        .map((part) =>
          typeof part === "string"
            ? part
            : part.text || ""
        )
        .join("");
    }
  }

  return "";
}

function getProvider(body = {}) {
  const provider =
    String(
      body?.provider || ""
    ).toLowerCase();

  if (provider === "mistral" || provider === "groq" || provider === "groq2") return provider;

  if (provider === "gemini") {
    return "gemini";
  }

  if (provider === "openai") {
    return "openai";
  }

  if (
    provider === "anthropic"
  ) {
    return "anthropic";
  }

  const model =
    String(
      body?.model || ""
    ).toLowerCase();

  if (
    model.startsWith(
      "gemini"
    )
  ) {
    return "gemini";
  }

  if (
    model.startsWith("gpt") ||
    model.startsWith("o1") ||
    model.startsWith("o3")
  ) {
    return "openai";
  }

  return DEFAULT_PROVIDER;
}

function buildGeminiPayload(
  body = {}
) {
  const messages =
    Array.isArray(
      body.messages
    )
      ? body.messages
      : [];

  const parts = [];

  if (body.system) {
    parts.push({
      text: body.system,
    });
  }

  for (const item of messages) {
    const text =
      extractText(
        item?.content || ""
      );

    if (!text) continue;

    parts.push({
      text,
    });
  }

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              parts
                .map(
                  (part) =>
                    part.text
                )
                .join("\n\n"),
          },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens:
        body.max_tokens ?? 700,
    },
  };

  /* Comments on Gemini 3: its thinking is paid out of the same output allowance, so a comment request (180-2400
     tokens) came back cut off mid-JSON and the app found no usable comment. Comments think little and get room. */
  const geminiSource = String(body?.source || "").trim().toLowerCase();
  const geminiComment = geminiSource === "comments" || /(?:^|[-_])comments?(?:[-_]|$)/.test(geminiSource) || geminiSource.includes("player-post-comment");
  /* R91: the same cut-off hit DMs ("text me" came back as '…couldn't say it' at 700 tokens with 669 spent thinking);
     every ordinary request gets the room, only the deep sheet readings keep their own long budget */
  const geminiRoomy = geminiComment || (body?.quality !== "deep" && (Number(body.max_tokens) || 700) < 4000);
  if (geminiRoomy) {
    payload.generationConfig.maxOutputTokens = (Number(body.max_tokens) || 700) + 2048;
    if (/^gemini-3/i.test(String(body?.model || ""))) payload.generationConfig.thinkingConfig = { thinkingLevel: "LOW" };
  }

  if (body.system) {
    payload.systemInstruction = {
      role: "system",
      parts: [
        {
          text:
            body.system,
        },
      ],
    };
  }

  return payload;
}

function normalizeGeminiResponse(
  data
) {
  const candidate =
    data?.candidates?.[0];

  const text =
    candidate?.content?.parts
      ?.map(
        (p) =>
          p.text || ""
      )
      .join("") || "";

  return {
    model:
      data?.model ||
      "gemini",
    id:
      candidate?.finishReason
        ? `gemini-${Date.now()}`
        : undefined,
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text,
      },
    ],
    usage: {
      input_tokens:
        data?.usageMetadata
          ?.promptTokenCount ||
        0,
      output_tokens:
        data?.usageMetadata
          ?.candidatesTokenCount ||
        0,
    },
  };
}

function openAIChatModel(
  requested
) {
  const value =
    String(
      requested || ""
    ).trim();

  if (
    /^(gpt|o1|o3|o4)/i.test(
      value
    )
  ) {
    return value;
  }

  return String(
    process.env
      .OPENAI_CHAT_MODEL ||
      "gpt-4o-mini"
  ).trim();
}

function geminiChatModel(
  requested
) {
  const value =
    String(
      requested || ""
    ).trim();

  if (
    value.startsWith(
      "gemini"
    )
  ) {
    return value;
  }

  return String(
    process.env.GEMINI_MODEL ||
      "gemini-3.6-flash"
  ).trim();
}

function anthropicChatModel(
  requested
) {
  const value =
    String(
      requested || ""
    ).trim();

  if (
    value.startsWith(
      "claude"
    )
  ) {
    return value;
  }

  return String(
    process.env
      .ANTHROPIC_MODEL ||
      "claude-sonnet-4-6"
  ).trim();
}

function buildOpenAIPayload(
  body = {}
) {
  const messages =
    Array.isArray(
      body.messages
    )
      ? body.messages
      : [];

  const out = [];

  if (body.system) {
    out.push({
      role: "system",
      content:
        body.system,
    });
  }

  for (const item of messages) {
    const text =
      extractText(
        item?.content || ""
      );

    if (!text) continue;

    out.push({
      role:
        item?.role ===
        "assistant"
          ? "assistant"
          : "user",
      content: text,
    });
  }

  const payload = {
    model:
      openAIChatModel(
        body.model
      ),
    messages: out,
    max_tokens:
      body.max_tokens ??
      1024,
  };

  if (
    Number.isFinite(
      Number(
        body.temperature
      )
    )
  ) {
    payload.temperature =
      Number(
        body.temperature
      );
  }

  return payload;
}

function normalizeOpenAIResponse(
  data
) {
  const choice =
    data?.choices?.[0];

  const text =
    choice?.message
      ?.content || "";

  return {
    model:
      data?.model || "gpt",
    id:
      data?.id,
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text,
      },
    ],
    usage: {
      input_tokens:
        data?.usage
          ?.prompt_tokens ||
        0,
      output_tokens:
        data?.usage
          ?.completion_tokens ||
        0,
    },
  };
}

if (
  !ANTHROPIC_API_KEY &&
  !GEMINI_API_KEY &&
  !OPENAI_API_KEY
) {
  console.warn(
    "No AI API key configured. Set ANTHROPIC_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY before starting the proxy."
  );
} else if (
  !ANTHROPIC_API_KEY
) {
  console.info(
    "Anthropic API key not configured; using other providers if requested."
  );
}

/* CORS */
app.use((req, res, next) => {
  const origin =
    String(
      req.headers.origin || ""
    ).trim();

  const configured =
    String(
      process.env.CORS_ORIGINS ||
      ""
    )
      .split(",")
      .map(
        (x) =>
          x.trim()
      )
      .filter(Boolean);

  const allowOrigin =
    origin &&
    (
      !configured.length ||
      configured.includes(
        origin
      )
    );

  if (allowOrigin) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );

    res.setHeader(
      "Vary",
      "Origin"
    );

    res.setHeader(
      "Access-Control-Allow-Credentials",
      "true"
    );
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization"
  );

  if (
    req.method ===
    "OPTIONS"
  ) {
    return res.sendStatus(204);
  }

  next();
});
/* -------------------------------------------------------------------------
   CLOUD MEDIA LOAD
   Backward-compatible with old raw world_media.data rows.
   ------------------------------------------------------------------------- */
app.get("/media/version", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const session = await getSessionIdentity(req);

    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Not authenticated." });
    }

    const result = await pool.query(
      `
      SELECT COALESCE(NULLIF(data->>'syncRev', '')::BIGINT, 0) AS sync_rev
      FROM world_media
      WHERE world_code = $1
      LIMIT 1
      `,
      [session.worldCode]
    );

    return res.json({
      ok: true,
      syncRev: result.rows.length ? Number(result.rows[0].sync_rev) || 0 : 0,
    });
  } catch (err) {
    console.error("Media version error:", err);
    return res.status(500).json({ error: "Media version check failed." });
  }
});

/*
 * PERFORMANCE v17 — LAZY SINGLE-IMAGE DELIVERY
 *
 * Avoid returning the entire base64 media library during application boot.
 * Image IDs are immutable, so the browser can request only the exact image it
 * needs and cache it aggressively.
 */
app.get("/media/file/:id", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const session = await getSessionIdentity(req);
    if (!session) {
      clearSessionCookie(res);
      return res.status(401).end();
    }

    const imageId = String(req.params?.id || "").trim();
    if (!imageId || imageId.length > 180) {
      return res.status(400).end();
    }

    /* v19: new scalable table first. */
    const fileResult = await pool.query(
      `
      SELECT data AS item
      FROM world_media_files
      WHERE world_code = $1
        AND image_id = $2
      LIMIT 1
      `,
      [session.worldCode, imageId]
    );

    let raw =
      fileResult.rows.length
        ? fileResult.rows[0].item
        : null;

    /* Backwards-compatible fallback for every historical image. */
    if (raw == null) {
      const legacyResult = await pool.query(
        `
        SELECT
          CASE
            WHEN data->>'__masvilagMediaEnvelope' = $3
              THEN jsonb_extract_path(data->'media', $2::text)
            ELSE jsonb_extract_path(data, $2::text)
          END AS item
        FROM world_media
        WHERE world_code = $1
        LIMIT 1
        `,
        [
          session.worldCode,
          imageId,
          String(MEDIA_ENVELOPE_VERSION),
        ]
      );

      raw =
        legacyResult.rows.length
          ? legacyResult.rows[0].item
          : null;
    }

    if (raw == null) {
      return res.status(404).end();
    }

    const entry =
      typeof raw === "string"
        ? { dataUrl: raw, status: "active" }
        : raw && typeof raw === "object"
          ? raw
          : null;

    if (!entry || String(entry.status || "active") === "deleted") {
      return res.status(404).end();
    }

    const dataUrl = String(entry.dataUrl || entry.url || "");

    if (/^https:\/\//i.test(dataUrl)) {
      return res.redirect(302, dataUrl);
    }

    const match = dataUrl.match(
      /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,([\s\S]+)$/i
    );

    if (!match) {
      return res.status(404).end();
    }

    const mimeType =
      String(match[1] || entry.mimeType || "image/jpeg")
        .replace(/[\r\n]/g, "")
        .slice(0, 100);

    let bytes;
    try {
      bytes = Buffer.from(match[2], "base64");
    } catch (e) {
      return res.status(422).end();
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    return res.send(bytes);
  } catch (err) {
    console.error("Media file load error:", err);
    return res.status(500).end();
  }
});

/*
 * v19 — save exactly ONE image.
 * This endpoint is intentionally append/update-per-file and never reads or
 * rewrites the historical world_media JSONB blob.
 */
app.post("/media/file/:id", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const session = await getSessionIdentity(req);
    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const imageId = String(req.params?.id || "").trim();
    if (!imageId || imageId.length > 180) {
      return res.status(400).json({
        error: "Invalid image id.",
      });
    }

    const rawEntry =
      req.body &&
      req.body.entry &&
      typeof req.body.entry === "object" &&
      !Array.isArray(req.body.entry)
        ? req.body.entry
        : null;

    if (!rawEntry) {
      return res.status(400).json({
        error: "Missing media entry.",
      });
    }

    const dataUrl =
      String(
        rawEntry.dataUrl ||
        rawEntry.url ||
        ""
      );

    if (
      !/^data:image\//i.test(dataUrl) &&
      !/^https:\/\//i.test(dataUrl)
    ) {
      return res.status(422).json({
        error: "Invalid image payload.",
      });
    }

    const entry = {
      ...rawEntry,
      id: imageId,
      updatedAt: Date.now(),
    };

    const entryJson =
      stringifyJsonbSafe(
        entry,
        "media-file-save"
      );

    /* Hard cap is per image, not per world. */
    if (entryJson.length > 10 * 1024 * 1024) {
      return res.status(413).json({
        error: "Image payload is too large.",
      });
    }

    await pool.query(
      `
      INSERT INTO world_media_files (
        world_code,
        image_id,
        data,
        updated_at
      )
      VALUES ($1, $2, $3::jsonb, NOW())

      ON CONFLICT (world_code, image_id)
      DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW()
      `,
      [
        session.worldCode,
        imageId,
        entryJson,
      ]
    );

    return res.json({
      ok: true,
      id: imageId,
    });
  } catch (err) {
    console.error("Media file save error:", err);
    return res.status(500).json({
      error: "Media file save failed.",
    });
  }
});

/* ============================================================
   CLAUDE FIX R33 — PERSONAL CHARACTER LIBRARY
   Save characters (full sheet + every image they use) from the current world
   into the login profile, and bring them into any other world of the profile.
   ============================================================ */
const LIBRARY_RUNTIME_KEYS = new Set([
  "followers", "following", "baseFollowers", "followerDelta", "posts", "comments",
  "msgs", "messages", "chats", "scenes", "memory", "memories", "notes", "stats",
  "createdAt", "updatedAt", "arrivalTrendAt", "lastActiveAt", "lastSeenAt",
  "deleted", "deletedAt", "online", "presence", "status", "sync", "syncRev",
]);

function libraryCharacterData(c) {
  const out = {};
  Object.entries(c || {}).forEach(([key, value]) => {
    if (LIBRARY_RUNTIME_KEYS.has(key)) return;
    if (/^ai[A-Z]/.test(key)) return;
    out[key] = value;
  });
  return out;
}

function libraryCollectImageIds(value, out = new Set(), depth = 0) {
  if (depth > 8 || value == null) return out;
  if (typeof value === "string") {
    const v = value.trim();
    if (v.startsWith("img:") && v.length > 4 && v.length < 190) out.add(v.slice(4));
    return out;
  }
  if (Array.isArray(value)) { value.forEach((x) => libraryCollectImageIds(x, out, depth + 1)); return out; }
  if (typeof value === "object") {
    Object.entries(value).forEach(([key, x]) => {
      if ((key === "imageId" || key === "image_id") && typeof x === "string" && x && x.length < 190 && !x.startsWith("img:")) out.add(x);
      else libraryCollectImageIds(x, out, depth + 1);
    });
  }
  return out;
}

async function libraryLoadWorldMediaEntry(worldCode, imageId) {
  const files = await pool.query(
    `SELECT data FROM world_media_files WHERE world_code = $1 AND image_id = $2 LIMIT 1`,
    [worldCode, imageId]
  );
  if (files.rows.length) return files.rows[0].data;
  const legacy = await pool.query(
    `
    SELECT
      CASE
        WHEN data->>'__masvilagMediaEnvelope' = $3
          THEN jsonb_extract_path(data->'media', $2::text)
        ELSE jsonb_extract_path(data, $2::text)
      END AS item
    FROM world_media
    WHERE world_code = $1
    LIMIT 1
    `,
    [worldCode, imageId, String(MEDIA_ENVELOPE_VERSION)]
  );
  const raw = legacy.rows.length ? legacy.rows[0].item : null;
  if (raw == null) return null;
  return typeof raw === "string" ? { id: imageId, dataUrl: raw, status: "active" } : raw;
}

function librarySlug(name) {
  return String(name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || ("char-" + Date.now());
}

async function libraryProfileFromRequest(req, res) {
  if (!(await requireDb(res))) return null;
  const session = await getSession(req);
  if (!session) {
    clearSessionCookie(res);
    res.status(401).json({ error: "Not authenticated." });
    return null;
  }
  const profile = await currentProfileForSession(session);
  if (!profile) {
    res.status(404).json({ error: "Global profile not found." });
    return null;
  }
  return { session, profile };
}

app.get("/profile/characters", async (req, res) => {
  try {
    const ctx = await libraryProfileFromRequest(req, res);
    if (!ctx) return;
    const result = await pool.query(
      `
      SELECT lib_id, name, source_world, updated_at,
        data->>'username' AS username, data->>'job' AS job, data->>'avatar' AS avatar,
        data->>'__kind' AS kind, jsonb_array_length(image_ids) AS image_count
      FROM profile_characters
      WHERE profile_username = $1
      ORDER BY name ASC
      `,
      [ctx.profile.username]
    );
    return res.json({
      ok: true,
      characters: result.rows.map((row) => ({
        id: row.lib_id,
        name: row.name,
        username: row.username || "",
        job: row.job || "",
        kind: row.kind || "npc",
        avatarImageId: String(row.avatar || "").startsWith("img:") ? String(row.avatar).slice(4) : "",
        imageCount: Number(row.image_count) || 0,
        sourceWorld: row.source_world || "",
        updatedAt: row.updated_at,
      })),
    });
  } catch (err) {
    console.error("Character library list error:", err);
    return res.status(500).json({ error: "Failed to load the character library." });
  }
});

app.get("/profile/characters/media/:imageId", async (req, res) => {
  try {
    const ctx = await libraryProfileFromRequest(req, res);
    if (!ctx) return;
    const imageId = String(req.params?.imageId || "").trim();
    const result = await pool.query(
      `SELECT data FROM profile_character_media WHERE profile_username = $1 AND image_id = $2 LIMIT 1`,
      [ctx.profile.username, imageId]
    );
    const entry = result.rows.length ? result.rows[0].data : null;
    const dataUrl = String(entry && (entry.dataUrl || entry.url) || "");
    if (/^https:\/\//i.test(dataUrl)) return res.redirect(302, dataUrl);
    const match = dataUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,([\s\S]+)$/i);
    if (!match) return res.status(404).end();
    const bytes = Buffer.from(match[2], "base64");
    res.setHeader("Content-Type", String(match[1] || "image/jpeg").slice(0, 100));
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    return res.send(bytes);
  } catch (err) {
    console.error("Character library media error:", err);
    return res.status(500).end();
  }
});

app.post("/profile/characters/save", async (req, res) => {
  try {
    const ctx = await libraryProfileFromRequest(req, res);
    if (!ctx) return;
    const { session, profile } = ctx;
    const world = session.world || {};
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).slice(0, 200) : [];
    const includeMe = Boolean(req.body?.includeMe);
    const picked = [];
    (Array.isArray(world.chars) ? world.chars : []).forEach((c) => {
      if (c && c.id && ids.includes(String(c.id))) picked.push({ c, kind: "npc" });
    });
    if (includeMe && world.players && world.players[session.accountId]) {
      picked.push({ c: world.players[session.accountId], kind: "player" });
    }
    if (!picked.length) return res.status(400).json({ error: "No characters selected." });

    const saved = [];
    let images = 0;
    for (const { c, kind } of picked) {
      const name = String(c.name || "").trim();
      if (!name) continue;
      const data = { ...libraryCharacterData(c), __kind: kind, __sourceId: String(c.id || "") };
      const imageIds = [...libraryCollectImageIds(data)].slice(0, 120);
      for (const imageId of imageIds) {
        const entry = await libraryLoadWorldMediaEntry(session.worldCode, imageId);
        if (!entry) continue;
        const json = stringifyJsonbSafe({ ...entry, id: imageId }, "library-media");
        if (json.length > 10 * 1024 * 1024) continue;
        await pool.query(
          `
          INSERT INTO profile_character_media (profile_username, image_id, data, updated_at)
          VALUES ($1, $2, $3::jsonb, NOW())
          ON CONFLICT (profile_username, image_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
          `,
          [profile.username, imageId, json]
        );
        images += 1;
      }
      const libId = librarySlug(name) + (kind === "player" ? "--me" : "");
      await pool.query(
        `
        INSERT INTO profile_characters (profile_username, lib_id, name, data, image_ids, source_world, updated_at)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, NOW())
        ON CONFLICT (profile_username, lib_id) DO UPDATE SET
          name = EXCLUDED.name, data = EXCLUDED.data, image_ids = EXCLUDED.image_ids,
          source_world = EXCLUDED.source_world, updated_at = NOW()
        `,
        [profile.username, libId, name, stringifyJsonbSafe(data, "library-character"), JSON.stringify(imageIds), session.worldCode]
      );
      saved.push(name);
    }
    return res.json({ ok: true, saved, images });
  } catch (err) {
    console.error("Character library save error:", err);
    return res.status(500).json({ error: "Saving to the character library failed." });
  }
});

app.post("/profile/characters/import", async (req, res) => {
  try {
    const ctx = await libraryProfileFromRequest(req, res);
    if (!ctx) return;
    const { session, profile } = ctx;
    const libIds = Array.isArray(req.body?.ids) ? req.body.ids.map(String).slice(0, 200) : [];
    if (!libIds.length) return res.status(400).json({ error: "No characters selected." });
    const rows = await pool.query(
      `SELECT lib_id, name, data, image_ids FROM profile_characters WHERE profile_username = $1 AND lib_id = ANY($2::text[])`,
      [profile.username, libIds]
    );
    const images = {};
    for (const row of rows.rows) {
      const imageIds = Array.isArray(row.image_ids) ? row.image_ids : [];
      for (const imageId of imageIds) {
        const media = await pool.query(
          `SELECT data FROM profile_character_media WHERE profile_username = $1 AND image_id = $2 LIMIT 1`,
          [profile.username, imageId]
        );
        if (!media.rows.length) continue;
        const entry = media.rows[0].data || {};
        await pool.query(
          `
          INSERT INTO world_media_files (world_code, image_id, data, updated_at)
          VALUES ($1, $2, $3::jsonb, NOW())
          ON CONFLICT (world_code, image_id) DO NOTHING
          `,
          [session.worldCode, imageId, stringifyJsonbSafe(entry, "library-import")]
        );
        images[imageId] = {
          mimeType: entry.mimeType || "image/jpeg",
          size: Number(entry.size || 0),
          category: entry.category || "other",
          originalFileName: entry.originalFileName || "image",
        };
      }
    }
    return res.json({
      ok: true,
      characters: rows.rows.map((row) => ({ libId: row.lib_id, name: row.name, data: row.data })),
      images,
    });
  } catch (err) {
    console.error("Character library import error:", err);
    return res.status(500).json({ error: "Importing from the character library failed." });
  }
});

app.post("/profile/characters/delete", async (req, res) => {
  try {
    const ctx = await libraryProfileFromRequest(req, res);
    if (!ctx) return;
    const libId = String(req.body?.id || "");
    await pool.query(`DELETE FROM profile_characters WHERE profile_username = $1 AND lib_id = $2`, [ctx.profile.username, libId]);
    /* drop images no saved character uses any more */
    await pool.query(
      `
      DELETE FROM profile_character_media m
      WHERE m.profile_username = $1
        AND NOT EXISTS (
          SELECT 1 FROM profile_characters c
          WHERE c.profile_username = $1 AND c.image_ids ? m.image_id
        )
      `,
      [ctx.profile.username]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error("Character library delete error:", err);
    return res.status(500).json({ error: "Deleting from the character library failed." });
  }
});

app.get("/media/load", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const session =
      await getSessionIdentity(req);

    if (!session) {
      clearSessionCookie(res);

      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const result =
      await pool.query(
        `
        SELECT data
        FROM world_media
        WHERE world_code = $1
        LIMIT 1
        `,
        [session.worldCode]
      );

    const envelope =
      mediaEnvelopeFromRow(
        result.rows.length
          ? result.rows[0].data
          : {}
      );

    return res.json({
      ok: true,
      syncRev:
        envelope.syncRev,
      media:
        envelope.media,
    });
  } catch (err) {
    console.error(
      "Media load error:",
      err
    );

    return res.status(500).json({
      error: "Media load failed.",
    });
  }
});

/* -------------------------------------------------------------------------
   CLOUD MEDIA SAVE

   Uses a JSON envelope in the EXISTING JSONB column, so no DB schema change
   is required. An advisory transaction lock also protects the "row absent"
   first-save case where SELECT ... FOR UPDATE alone cannot lock a missing row.
   ------------------------------------------------------------------------- */
app.post("/media/save", async (req, res) => {
  let client = null;

  try {
    if (!(await requireDb(res))) return;

    const session =
      await getSessionIdentity(req);

    if (!session) {
      clearSessionCookie(res);

      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const media =
      req.body &&
      req.body.media &&
      typeof req.body.media ===
        "object" &&
      !Array.isArray(
        req.body.media
      )
        ? req.body.media
        : {};

    const expectedSyncRev =
      Math.max(
        0,
        Math.floor(
          Number(
            req.body?.syncRev
          ) || 0
        )
      );

    const mediaJson =
      JSON.stringify(media);

    if (
      mediaJson.length >
      45 * 1024 * 1024
    ) {
      return res.status(413).json({
        error:
          "Media library is too large.",
      });
    }

    client =
      await pool.connect();

    await client.query("BEGIN");

    /*
     * Stable per-world transaction lock, including when the row doesn't exist.
     */
    await client.query(
      `
      SELECT pg_advisory_xact_lock(
        hashtext($1)
      )
      `,
      [
        `masvilag-media:${session.worldCode}`,
      ]
    );

    const currentResult =
      await client.query(
        `
        SELECT data
        FROM world_media
        WHERE world_code = $1
        LIMIT 1
        FOR UPDATE
        `,
        [session.worldCode]
      );

    const current =
      mediaEnvelopeFromRow(
        currentResult.rows.length
          ? currentResult.rows[0].data
          : {}
      );

    if (
      expectedSyncRev !==
      current.syncRev
    ) {
      await client.query(
        "ROLLBACK"
      );

      client.release();
      client = null;

      return res.status(409).json({
        code: "MEDIA_CONFLICT",
        error:
          "The media library changed on another client.",
        expectedSyncRev,
        serverSyncRev:
          current.syncRev,
      });
    }

    const nextSyncRev =
      current.syncRev + 1;

    /*
     * PERFORMANCE v17:
     * The browser sends only transient/newly changed image entries. Merge them
     * into the authoritative library instead of requiring the browser to
     * download and resend every historical base64 image.
     */
    const mergedMedia = {
      ...(current.media || {}),
      ...(media || {}),
    };

    const mergedMediaJson = JSON.stringify(mergedMedia);

    if (
      mergedMediaJson.length >
      45 * 1024 * 1024
    ) {
      await client.query("ROLLBACK");
      client.release();
      client = null;
      return res.status(413).json({
        error: "Media library is too large.",
      });
    }

    const envelope =
      makeMediaEnvelope(
        mergedMedia,
        nextSyncRev
      );

    await client.query(
      `
      INSERT INTO world_media (
        world_code,
        data,
        updated_at
      )
      VALUES ($1, $2::jsonb, NOW())

      ON CONFLICT (world_code)
      DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW()
      `,
      [
        session.worldCode,
        stringifyJsonbSafe(envelope, "media-save"),
      ]
    );

    await client.query("COMMIT");
    client.release();
    client = null;

    return res.json({
      ok: true,
      syncRev:
        nextSyncRev,
    });
  } catch (err) {
    if (client) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (e) {}

      client.release();
      client = null;
    }

    console.error(
      "Media save error:",
      err
    );

    return res.status(500).json({
      error: "Media save failed.",
    });
  }
});

function parseImageDataUrl(value) {
  const raw = String(value || "");

  const match =
    raw.match(
      /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/
    );

  if (!match) return null;

  return {
    mimeType:
      match[1].toLowerCase(),
    base64:
      match[2].replace(
        /\s+/g,
        ""
      ),
    dataUrl: raw,
  };
}

function visionTextFromAnthropic(data) {
  return Array.isArray(
    data?.content
  )
    ? data.content
        .map(
          (x) =>
            x?.type === "text"
              ? x.text || ""
              : ""
        )
        .join("")
    : "";
}

/* Image understanding runs on FREE capacity: Groq's vision model, then the free Gemini keys.
   With none available the answer is "wait" (503 + Retry-After) and the caller tries again later.
   OpenAI / Anthropic only with AI_ALLOW_PAID_BACKGROUND=1. */
async function visionViaOpenAI(image, prompt) {
  if (!OPENAI_API_KEY) return { ok: false, status: 500, payload: { error: { message: "Missing OPENAI_API_KEY." } } };
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model, max_tokens: 350, messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: image.dataUrl } }] }] }),
  });
  const payload = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, text: payload?.choices?.[0]?.message?.content || "", provider: "openai", model } : { ok: false, status: r.status, payload };
}

async function visionViaAnthropic(image, prompt) {
  if (!ANTHROPIC_API_KEY) return { ok: false, status: 500, payload: { error: { message: "Missing ANTHROPIC_API_KEY." } } };
  const model = process.env.ANTHROPIC_VISION_MODEL || "claude-sonnet-4-6";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": process.env.ANTHROPIC_VERSION || "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 350, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: image.mimeType, data: image.base64 } }, { type: "text", text: prompt }] }] }),
  });
  const payload = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, text: visionTextFromAnthropic(payload), provider: "anthropic", model } : { ok: false, status: r.status, payload };
}

/* Built on first use: it needs the Gemini key lists, which are declared further down this file. */
let VISION_RUNNER = null;
function visionRunner() {
  if (VISION_RUNNER) return VISION_RUNNER;
  VISION_RUNNER = createVisionRunner({
    fetchFn: (url, { timeoutMs, ...options }) => fetchWithTimeout(url, options, timeoutMs),
    groqKeys: [
      { slot: "groq", key: GROQ_API_KEY },
      { slot: "groq2", key: GROQ_API_KEY_2 },
    ].filter((entry) => entry.key && entry.key !== "" && (entry.slot === "groq" || entry.key !== GROQ_API_KEY)),
    groqModel: String(process.env.GROQ_VISION_MODEL || DEFAULT_GROQ_VISION_MODEL).trim(),
    geminiFreeKeys: GEMINI_FREE_KEYS,
    geminiPaidKey: GEMINI_PAID_KEY,
    geminiModels: GEMINI_MODELS.vision,
    ledger: GEMINI_LEDGER,
    pacer: GROQ_PACER,
    allowPaid: AI_ALLOW_PAID_BACKGROUND,
    paid: { openai: visionViaOpenAI, anthropic: visionViaAnthropic },
    /* R85: no Groq in image reading (owner's choice) */
    useGroq: false,
    /* R82: free OpenRouter vision on the funded key (1000 free requests a day) */
    openRouter: {
      key: process.env.OPENROUTER_API_KEY_2 || process.env.OPENROUTER_API_KEY || "",
      models: String(process.env.OPENROUTER_VISION_MODELS || "").split(",").map((x) => x.trim()).filter(Boolean).length
        ? String(process.env.OPENROUTER_VISION_MODELS).split(",").map((x) => x.trim()).filter(Boolean)
        : DEFAULT_OPENROUTER_VISION_MODELS,
    },
  });
  return VISION_RUNNER;
}

app.post("/ai/vision", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const session = await getSessionIdentity(req);
    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Not authenticated." });
    }

    const image = await resolveInputImage(req.body?.image, session.worldCode);
    const prompt = String(
      req.body?.prompt ||
      "Describe what is visibly happening in this image in 2-4 concise sentences. Name the outfit exactly (e.g. bikini, swimsuit, lingerie, shirtless, dress) and how revealing it is, the pose, setting and mood, only when actually visible. Do not identify real people by name."
    ).slice(0, 5000);

    if (!image) {
      return res.status(400).json({ error: "A valid base64 data URL or public HTTPS image URL is required." });
    }
    if (image.base64.length > 12 * 1024 * 1024) {
      return res.status(413).json({ error: "Image is too large for vision analysis." });
    }

    /* The provider and model the browser names are ignored: the server decides, to keep this on free capacity. */
    const result = await visionRunner().analyze({ image, prompt });
    if (result.ok) {
      return res.json({ ok: true, text: result.text, provider: result.provider, model: result.model });
    }
    if (result.waiting) {
      console.warn("[vision] no free capacity, caller should wait", `retryAfter=${result.retryAfter}s`, (result.payload?.error?.providers || []).join(" | ").slice(0, 300));
      res.setHeader("retry-after", result.retryAfter);
    }
    return res.status(result.status || 502).json(result.payload || { error: { message: "Vision analysis failed." } });
  } catch (err) {
    console.error("Vision proxy error:", err);
    return res.status(502).json({ error: "Vision analysis failed." });
  }
});
/* -------------------------------------------------------------------------
   STABLE AI PROXY HELPERS + IMAGE GENERATION
   ------------------------------------------------------------------------- */
const AI_UPSTREAM_TIMEOUT_MS = Math.max(
  12000,
  Number(process.env.AI_UPSTREAM_TIMEOUT_MS) || 45000
);

/* CLAUDE FIX R45: deep sheet readings (character bible, sheet summary) need
   60–100 s on the large model. A fixed 45 s cut them off every single time, so
   they failed forever and blocked the world queue. The client now says how long
   it is willing to wait; deep requests get up to that. */
function upstreamTimeoutFor(body) {
  const asked = Number(body && body.timeout_ms) || 0;
  if (asked > 0) return Math.max(12000, Math.min(170000, asked));
  if (body && body.quality === "deep") return Math.max(AI_UPSTREAM_TIMEOUT_MS, 110000);
  return AI_UPSTREAM_TIMEOUT_MS;
}

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = AI_UPSTREAM_TIMEOUT_MS
) {
  const ctrl = new AbortController();
  const timer = setTimeout(
    () => ctrl.abort(),
    timeoutMs
  );

  try {
    return await fetch(
      url,
      {
        ...options,
        signal: ctrl.signal,
      }
    );
  } finally {
    clearTimeout(timer);
  }
}

async function responseJsonSafe(r) {
  const raw = await r.text();

  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {
      error: {
        message: raw,
      },
    };
  }
}

function proxyErrorMessage(
  payload,
  fallback = "AI provider error"
) {
  return String(
    payload?.error?.message ||
    payload?.error ||
    payload?.message ||
    fallback
  );
}

function retryableProviderStatus(status) {
  return [
    408,
    409,
    425,
    429,
    500,
    502,
    503,
    504,
    529,
  ].includes(
    Number(status)
  );
}

function imagePromptFromBody(body = {}) {
  return String(
    body.prompt ||
    body.input ||
    body.text ||
    ""
  )
    .trim()
    .slice(
      0,
      12000
    );
}

function isPrivateAddress(address) {
  const value =
    String(
      address || ""
    ).toLowerCase();

  if (!value) return true;

  if (
    net.isIP(value) === 4
  ) {
    const p =
      value
        .split(".")
        .map(Number);

    if (
      p[0] === 10 ||
      p[0] === 127 ||
      p[0] === 0
    ) {
      return true;
    }

    if (
      p[0] === 169 &&
      p[1] === 254
    ) {
      return true;
    }

    if (
      p[0] === 172 &&
      p[1] >= 16 &&
      p[1] <= 31
    ) {
      return true;
    }

    if (
      p[0] === 192 &&
      p[1] === 168
    ) {
      return true;
    }

    if (
      p[0] >= 224
    ) {
      return true;
    }

    return false;
  }

  if (
    net.isIP(value) === 6
  ) {
    return (
      value === "::1" ||
      value === "::" ||
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      value.startsWith("fe8") ||
      value.startsWith("fe9") ||
      value.startsWith("fea") ||
      value.startsWith("feb")
    );
  }

  return false;
}

async function assertPublicHttpsUrl(
  rawUrl
) {
  const url =
    new URL(
      String(
        rawUrl || ""
      ).trim()
    );

  if (
    url.protocol !==
    "https:"
  ) {
    throw new Error(
      "Only HTTPS image references are allowed."
    );
  }

  const host =
    String(
      url.hostname || ""
    ).toLowerCase();

  if (
    !host ||
    host ===
      "localhost" ||
    host.endsWith(
      ".localhost"
    )
  ) {
    throw new Error(
      "Local image reference is not allowed."
    );
  }

  if (
    net.isIP(host)
  ) {
    if (
      isPrivateAddress(host)
    ) {
      throw new Error(
        "Private-network image reference is not allowed."
      );
    }
  } else {
    const resolved =
      await dns.lookup(
        host,
        {
          all: true,
        }
      );

    if (
      !resolved.length ||
      resolved.some(
        (row) =>
          isPrivateAddress(
            row.address
          )
      )
    ) {
      throw new Error(
        "Image reference resolved to a private network."
      );
    }
  }

  return url;
}

async function fetchRemoteImageReference(
  rawUrl,
  redirectsLeft = 3
) {
  const url =
    await assertPublicHttpsUrl(
      rawUrl
    );

  const r =
    await fetchWithTimeout(
      url,
      {
        method: "GET",
        redirect:
          "manual",
        headers: {
          "Accept":
            "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.7",
          "User-Agent":
            "MasvilagImageReference/1.0",
        },
      },
      20000
    );

  if (
    [
      301,
      302,
      303,
      307,
      308,
    ].includes(
      r.status
    )
  ) {
    if (
      redirectsLeft <= 0
    ) {
      throw new Error(
        "Too many image-reference redirects."
      );
    }

    const location =
      r.headers.get(
        "location"
      );

    if (!location) {
      throw new Error(
        "Image-reference redirect has no location."
      );
    }

    const next =
      new URL(
        location,
        url
      );

    return fetchRemoteImageReference(
      next.toString(),
      redirectsLeft - 1
    );
  }

  if (!r.ok) {
    throw new Error(
      `Reference image fetch failed with HTTP ${r.status}.`
    );
  }

  const mimeType =
    String(
      r.headers.get(
        "content-type"
      ) || ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

  if (
    ![
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ].includes(
      mimeType
    )
  ) {
    throw new Error(
      `Unsupported reference image type: ${mimeType || "unknown"}.`
    );
  }

  const announced =
    Number(
      r.headers.get(
        "content-length"
      ) || 0
    );

  if (
    announced &&
    announced >
      12 * 1024 * 1024
  ) {
    throw new Error(
      "Reference image is too large."
    );
  }

  const buffer =
    Buffer.from(
      await r.arrayBuffer()
    );

  if (
    !buffer.length ||
    buffer.length >
      12 * 1024 * 1024
  ) {
    throw new Error(
      "Reference image is empty or too large."
    );
  }

  return {
    mimeType:
      mimeType ===
      "image/jpg"
        ? "image/jpeg"
        : mimeType,
    base64:
      buffer.toString(
        "base64"
      ),
    dataUrl:
      `data:${
        mimeType ===
        "image/jpg"
          ? "image/jpeg"
          : mimeType
      };base64,${
        buffer.toString(
          "base64"
        )
      }`,
    source:
      "remote",
  };
}

/* CLAUDE FIX R35: our own /media/file/<id> links need the login cookie, so the
   server fetching them over HTTP got 401 ("Reference image fetch failed").
   They are read straight from the database instead. */
async function loadOwnMediaImage(raw, worldCode) {
  const match = String(raw || "").match(/^(?:https?:\/\/[^/]+)?\/media\/file\/([^/?#]+)/i);
  if (!match || !worldCode || !pool) return null;
  const imageId = decodeURIComponent(match[1]);
  const files = await pool.query(
    `SELECT data FROM world_media_files WHERE world_code = $1 AND image_id = $2 LIMIT 1`,
    [worldCode, imageId]
  );
  let entry = files.rows.length ? files.rows[0].data : null;
  if (!entry) {
    const legacy = await pool.query(
      `
      SELECT
        CASE
          WHEN data->>'__masvilagMediaEnvelope' = $3
            THEN jsonb_extract_path(data->'media', $2::text)
          ELSE jsonb_extract_path(data, $2::text)
        END AS item
      FROM world_media
      WHERE world_code = $1
      LIMIT 1
      `,
      [worldCode, imageId, String(MEDIA_ENVELOPE_VERSION)]
    );
    entry = legacy.rows.length ? legacy.rows[0].item : null;
  }
  const dataUrl = typeof entry === "string" ? entry : String(entry && (entry.dataUrl || entry.url) || "");
  const parsed = parseImageDataUrl(dataUrl);
  if (parsed) return { ...parsed, source: "own-media" };
  if (/^https:\/\//i.test(dataUrl)) return fetchRemoteImageReference(dataUrl);
  return null;
}

async function resolveInputImage(
  value,
  worldCode = ""
) {
  const raw =
    String(
      value || ""
    ).trim();

  if (!raw) {
    return null;
  }

  if (/\/media\/file\//i.test(raw) && worldCode) {
    const own = await loadOwnMediaImage(raw, worldCode);
    if (own) return own;
  }

  const inline =
    parseImageDataUrl(
      raw
    );

  if (inline) {
    return {
      ...inline,
      source:
        "inline",
    };
  }

  if (
    /^https:\/\//i.test(
      raw
    )
  ) {
    return fetchRemoteImageReference(
      raw
    );
  }

  return null;
}

async function imageReferencesFromBody(
  body = {},
  limit = 3,
  worldCode = ""
) {
  const raw =
    Array.isArray(
      body.referenceImages
    )
      ? body.referenceImages
      : (
          Array.isArray(
            body.reference_images
          )
            ? body.reference_images
            : []
        );

  const refs = [];
  const seen =
    new Set();

  for (
    const value of raw
  ) {
    if (
      refs.length >= limit
    ) {
      break;
    }

    const key =
      String(
        value || ""
      ).trim();

    if (
      !key ||
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    try {
      const parsed =
        await resolveInputImage(
          key,
          worldCode
        );

      if (!parsed) {
        continue;
      }

      if (
        parsed.base64.length >
        16 * 1024 * 1024
      ) {
        continue;
      }

      refs.push(
        parsed
      );
    } catch (err) {
      console.warn(
        "Skipping unusable image reference:",
        key.slice(
          0,
          120
        ),
        err?.message ||
        err
      );
    }
  }

  return refs;
}

function multipartTextPart(
  boundary,
  name,
  value
) {
  return Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
    `${String(value)}\r\n`,
    "utf8"
  );
}

function multipartImagePart(
  boundary,
  name,
  image,
  index
) {
  const ext =
    image.mimeType ===
    "image/png"
      ? "png"
      : image.mimeType ===
          "image/webp"
        ? "webp"
        : "jpg";

  const head =
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${name}"; filename="reference-${index + 1}.${ext}"\r\n` +
      `Content-Type: ${image.mimeType}\r\n\r\n`,
      "utf8"
    );

  const data =
    Buffer.from(
      image.base64,
      "base64"
    );

  return Buffer.concat(
    [
      head,
      data,
      Buffer.from(
        "\r\n",
        "utf8"
      ),
    ]
  );
}

function buildImageEditMultipart({
  model,
  prompt,
  size,
  quality,
  outputFormat,
  background,
  moderation,
  references,
}) {
  const boundary =
    `----masvilag-${
      crypto
        .randomBytes(18)
        .toString("hex")
    }`;

  const chunks = [
    multipartTextPart(
      boundary,
      "model",
      model
    ),
    multipartTextPart(
      boundary,
      "prompt",
      prompt
    ),
    multipartTextPart(
      boundary,
      "size",
      size
    ),
    multipartTextPart(
      boundary,
      "quality",
      quality
    ),
    multipartTextPart(
      boundary,
      "output_format",
      outputFormat
    ),
    multipartTextPart(
      boundary,
      "background",
      background
    ),
    multipartTextPart(
      boundary,
      "moderation",
      moderation
    ),
  ];

  /*
   * OpenAI Image Edit accepts multiple input images as image[].
   * For GPT Image 2 these references act as high-fidelity identity inputs.
   */
  references.forEach(
    (
      image,
      index
    ) => {
      chunks.push(
        multipartImagePart(
          boundary,
          "image[]",
          image,
          index
        )
      );
    }
  );

  chunks.push(
    Buffer.from(
      `--${boundary}--\r\n`,
      "utf8"
    )
  );

  return {
    boundary,
    body:
      Buffer.concat(
        chunks
      ),
  };
}

app.post(
  [
    "/ai/image",
    "/ai/images",
    "/ai/generate-image",
  ],
  async (req, res) => {
    try {
      if (
        !(await requireDb(res))
      ) {
        return;
      }

      const session =
        await getSessionIdentity(req);

      if (!session) {
        clearSessionCookie(
          res
        );

        return res
          .status(401)
          .json({
            error:
              "Not authenticated.",
          });
      }

      if (
        !OPENAI_API_KEY
      ) {
        return res
          .status(500)
          .json({
            error:
              "Missing OPENAI_API_KEY.",
          });
      }

      const prompt =
        imagePromptFromBody(
          req.body || {}
        );

      if (!prompt) {
        return res
          .status(400)
          .json({
            error:
              "Missing image prompt.",
          });
      }

      const model =
        String(
          req.body?.model ||
          process.env
            .OPENAI_IMAGE_MODEL ||
          "gpt-image-2"
        );

      const size =
        String(
          req.body?.size ||
          req.body
            ?.image_size ||
          process.env
            .OPENAI_IMAGE_SIZE ||
          "1024x1024"
        );

      const quality =
        String(
          req.body
            ?.quality ||
          process.env
            .OPENAI_IMAGE_QUALITY ||
          "medium"
        );

      const outputFormat =
        String(
          req.body
            ?.output_format ||
          process.env
            .OPENAI_IMAGE_FORMAT ||
          "jpeg"
        );

      const background =
        String(
          req.body
            ?.background ||
          "auto"
        );

      const moderation =
        String(
          req.body
            ?.moderation ||
          "auto"
        );

      const references =
        await imageReferencesFromBody(
          req.body || {},
          3,
          session && session.worldCode
        );

      if (
        req.body
          ?.require_reference &&
        !references.length
      ) {
        return res
          .status(422)
          .json({
            error:
              "Character reference images were supplied, but none could be loaded. Refusing prompt-only generation because identity would be unreliable.",
          });
      }

      let endpoint =
        "https://api.openai.com/v1/images/generations";

      let options;

      if (
        references.length
      ) {
        /*
         * CRITICAL IDENTITY FIX:
         * Generations cannot actually consume our profile/album reference images.
         * When references exist, use the Image Edit endpoint and send them as
         * multipart image[] inputs so the model can preserve the character face.
         */
        endpoint =
          "https://api.openai.com/v1/images/edits";

        const multipart =
          buildImageEditMultipart({
            model,
            prompt,
            size,
            quality,
            outputFormat,
            background,
            moderation,
            references,
          });

        options = {
          method:
            "POST",
          headers: {
            "Content-Type":
              `multipart/form-data; boundary=${multipart.boundary}`,
            "Content-Length":
              String(
                multipart
                  .body
                  .length
              ),
            "Authorization":
              `Bearer ${OPENAI_API_KEY}`,
          },
          body:
            multipart.body,
        };
      } else {
        options = {
          method:
            "POST",
          headers: {
            "Content-Type":
              "application/json",
            "Authorization":
              `Bearer ${OPENAI_API_KEY}`,
          },
          body:
            JSON.stringify({
              model,
              prompt,
              size,
              quality,
              output_format:
                outputFormat,
              background,
              moderation,
            }),
        };
      }

      const r =
        await fetchWithTimeout(
          endpoint,
          options,
          Math.max(
            AI_UPSTREAM_TIMEOUT_MS,
            references.length
              ? 120000
              : 90000
          )
        );

      const payload =
        await responseJsonSafe(
          r
        );

      if (!r.ok) {
        if (
          r.headers.get(
            "retry-after"
          )
        ) {
          res.setHeader(
            "retry-after",
            r.headers.get(
              "retry-after"
            )
          );
        }

        console.error(
          "OpenAI image upstream error:",
          r.status,
          references.length
            ? "edit-reference"
            : "generation",
          proxyErrorMessage(
            payload,
            "Image request failed"
          )
        );

        return res
          .status(r.status)
          .json(payload);
      }

      const first =
        Array.isArray(
          payload?.data
        )
          ? payload.data[0]
          : null;

      const b64 =
        String(
          first?.b64_json ||
          payload?.b64_json ||
          ""
        ).trim();

      const url =
        String(
          first?.url ||
          first?.image_url ||
          payload?.url ||
          ""
        ).trim();

      if (
        !b64 &&
        !url
      ) {
        return res
          .status(502)
          .json({
            error:
              "OpenAI image generation returned no image payload.",
          });
      }

      const mime =
        outputFormat ===
        "png"
          ? "image/png"
          : outputFormat ===
              "webp"
            ? "image/webp"
            : "image/jpeg";

      const dataUrl =
        b64
          ? `data:${mime};base64,${b64}`
          : "";

      return res.json({
        ok: true,
        provider:
          "openai",
        model,
        mode:
          references.length
            ? "edit-reference"
            : "generation",
        referenceCount:
          references.length,
        data:
          b64
            ? [
                {
                  b64_json:
                    b64,
                  revised_prompt:
                    first
                      ?.revised_prompt ||
                    "",
                },
              ]
            : [],
        b64_json:
          b64,
        dataUrl,
        image:
          dataUrl ||
          url,
        url,
        revised_prompt:
          first
            ?.revised_prompt ||
          "",
      });
    } catch (err) {
      console.error(
        "Image generation proxy error:",
        err
      );

      const timeout =
        err?.name ===
        "AbortError";

      return res
        .status(
          timeout
            ? 504
            : 502
        )
        .json({
          error:
            timeout
              ? "Image generation timed out."
              : (
                  err?.message ||
                  "Image generation failed."
                ),
        });
    }
  }
);

async function proxyOpenAIMessage(
  body
) {
  if (
    !OPENAI_API_KEY
  ) {
    return {
      unavailable: true,
      provider:
        "openai",
    };
  }

  const r =
    await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method:
          "POST",
        headers: {
          "Content-Type":
            "application/json",
          "Authorization":
            `Bearer ${OPENAI_API_KEY}`,
        },
        body:
          JSON.stringify(
            buildOpenAIPayload(
              body
            )
          ),
      },
      upstreamTimeoutFor(body)
    );

  const payload =
    await responseJsonSafe(
      r
    );

  if (!r.ok) {
    return {
      ok: false,
      status:
        r.status,
      payload,
      retryAfter:
        r.headers.get(
          "retry-after"
        ),
      provider:
        "openai",
    };
  }

  const normalized =
    normalizeOpenAIResponse(
      payload
    );

  const hasText =
    Array.isArray(
      normalized?.content
    ) &&
    normalized.content.some(
      (x) =>
        String(
          x?.text || ""
        ).trim()
    );

  return hasText
    ? {
        ok: true,
        payload:
          normalized,
        provider:
          "openai",
      }
    : {
        ok: false,
        status: 502,
        payload: {
          error: {
            message:
              "OpenAI returned empty content.",
          },
        },
        provider:
          "openai",
      };
}

/* R71: rotate every configured Gemini key currently provisioned on Railway.
   Quota-exhausted keys rest; one bad key never disables the later keys. */
/* Only GEMINI_API_KEY is paid; keys 2-8 are free. The free keys are tried first
   and the paid key is the LAST Gemini option (OpenAI comes after Gemini). */
const GEMINI_PAID_KEY = String(process.env.GEMINI_API_KEY || "").trim();
const GEMINI_FREE_KEYS = [
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
  process.env.GEMINI_API_KEY_6,
  process.env.GEMINI_API_KEY_7,
  process.env.GEMINI_API_KEY_8,
].map((k) => String(k || "").trim()).filter(Boolean).filter((k, i, a) => a.indexOf(k) === i && k !== GEMINI_PAID_KEY);
const GEMINI_KEYS = [...GEMINI_FREE_KEYS, GEMINI_PAID_KEY].filter(Boolean);
/* Background work never touches paid capacity unless this is switched on explicitly. */
const AI_ALLOW_PAID_BACKGROUND = String(process.env.AI_ALLOW_PAID_BACKGROUND || "").trim() === "1";

async function proxyGeminiMessage(body) {
  if (!GEMINI_KEYS.length) return { unavailable: true, provider: "gemini" };
  const foreground = isForegroundRequest(body);
  /* Free keys only, model by model: the best model on two free keys, then the next model, and so on.
     Pairs known to be resting (spent quota, bad key, a run of timeouts) are not even tried. */
  /* Comments use the free Gemini keys only; their paid fallbacks are OpenAI and OpenRouter. */
  const geminiCommentSource = String(body?.source || "").trim().toLowerCase();
  const freeGeminiOnly = geminiCommentSource === "comments" || /(?:^|[-_])comments?(?:[-_]|$)/.test(geminiCommentSource) || geminiCommentSource.includes("player-post-comment");
  const plan = planGeminiAttempts({
    freeKeys: GEMINI_FREE_KEYS,
    paidKey: freeGeminiOnly ? "" : GEMINI_PAID_KEY,
    models: geminiModelLadder(GEMINI_MODELS, body),
    ledger: GEMINI_LEDGER,
    foreground,
    allowPaidBackground: AI_ALLOW_PAID_BACKGROUND,
    rotation: GEMINI_LEDGER.nextRotation(),
  });
  /* Background request, every free key and model resting: report it so the caller waits
     instead of spending the paid key. */
  if (!plan.attempts.length) {
    return {
      ok: false,
      status: 429,
      payload: { error: { message: "All free Gemini keys are resting after rate limits." } },
      retryAfter: plan.waitMs > 0 ? String(Math.ceil(plan.waitMs / 1000)) : "",
      provider: "gemini",
    };
  }

  /* Keep the attempts inside ONE request budget. This lets 503/high-demand try
     another key or model without multiplying an 8–45s request by five. */
  const deadline = Date.now() + upstreamTimeoutFor(body);
  let last = null;

  for (let i = 0; i < plan.attempts.length; i += 1) {
    const { key, model, forced } = plan.attempts[i];
    /* An earlier attempt of this same request may just have shown that a model or key is spent. */
    if (!forced && GEMINI_LEDGER.restMs(key, model) > 0) continue;
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 1000) break;

    const remainingAttempts = Math.max(1, plan.attempts.length - i);
    const perKeyBudget = Math.max(1800, Math.min(
      String(body?.quality || "") === "deep" ? 12000 : 6500,
      Math.floor(remainingMs / remainingAttempts)
    ));
    const label = "gemini key #" + (GEMINI_KEYS.indexOf(key) + 1) + "/" + model;
    let result;
    try {
      result = await proxyGeminiMessageWithKey(body, key, perKeyBudget, model);
    } catch (error) {
      const timeout = error?.name === "AbortError" || /aborted|timeout/i.test(String(error?.message || error || ""));
      result = {
        ok: false,
        status: timeout ? 504 : 502,
        payload: { error: { message: timeout ? "Gemini key timed out." : String(error?.message || error || "Gemini request failed.") } },
        provider: "gemini",
        model,
      };
    }
    if (result && result.ok) {
      GEMINI_LEDGER.succeed(key, model);
      return result;
    }
    last = result;

    /* A blocked prompt says nothing about the key or the model, and would be blocked again on the next
       one: stop here, spend nothing more, and let the next provider have it. */
    if (result && result.blocked) {
      console.warn("[ai-provider] " + label + " " + proxyErrorMessage(result.payload, "blocked") + " — handing the request to the next provider");
      break;
    }

    const status = Number(result && result.status);
    const outcome = GEMINI_LEDGER.fail(key, model, { status, message: proxyErrorMessage(result && result.payload, ""), payload: result && result.payload });
    if (outcome.restMs > 0) {
      const minutes = Math.max(1, Math.round(outcome.restMs / 60000));
      const what = outcome.metric === "no-credit" ? "out of prepaid credit"
        : outcome.metric === "invalid-key" ? "invalid/rejected"
        : outcome.level === "model-gone" ? "model not available"
        : outcome.level === "model-no-free-quota" ? "has no free quota (limit 0" + (outcome.quotaId ? ", " + outcome.quotaId : "") + ")"
        : outcome.metric === "busy" ? "overloaded (high demand)"
        : outcome.metric === "unavailable" ? "failing repeatedly (" + status + ")"
        : "out of quota (" + outcome.metric + (outcome.limit ? ", limit " + outcome.limit : "") + (outcome.quotaId ? ", " + outcome.quotaId : "") + ")";
      console.warn("[ai-provider] " + label + " " + what + " — resting it for " + minutes + " min, trying the next one");
      continue;
    }
    if (outcome.retryable && i + 1 < plan.attempts.length && deadline - Date.now() > 1000) {
      console.warn("[ai-provider] " + label + " temporary/" + status + " — trying the next one within the same request budget");
      continue;
    }
    break;
  }
  if (last && Number(last.status) === 429) {
    /* Come back when the soonest free (key, model) pair is ready: at once if some pair has not been
       tried yet (the attempts are capped), otherwise when the first of the resting ones is. */
    const again = planGeminiAttempts({
      freeKeys: GEMINI_FREE_KEYS, paidKey: "", models: geminiModelLadder(GEMINI_MODELS, body), ledger: GEMINI_LEDGER, foreground: false,
    });
    const wakeMs = again.attempts.length ? 3000 : again.waitMs;
    if (Number.isFinite(wakeMs) && wakeMs > 0) last.retryAfter = String(Math.ceil(wakeMs / 1000));
  }
  return last || { unavailable: true, provider: "gemini" };
}

async function proxyGeminiMessageWithKey(body, GEMINI_API_KEY, timeoutMs = upstreamTimeoutFor(body), modelOverride = "") {

  const model = String(modelOverride || "").trim() || (String(body?.quality || "") === "deep"
    ? GEMINI_MODELS.deep
    : GEMINI_MODELS.primary);

  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  );
  url.searchParams.set("key", GEMINI_API_KEY);

  const r = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildGeminiPayload({ ...body, model })),
  }, Math.max(1000, Number(timeoutMs) || upstreamTimeoutFor(body)));
  const payload = await responseJsonSafe(r);

  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      payload,
      retryAfter: r.headers.get("retry-after"),
      provider: "gemini",
      model,
    };
  }

  const normalized = normalizeGeminiResponse(payload);
  const finishReason = String(payload?.candidates?.[0]?.finishReason || "");
  if (finishReason && finishReason !== "STOP") {
    console.warn("[ai-provider] gemini/" + model + " stopped early: finishReason=" + finishReason, "source=" + String(body?.source || ""), "maxOutputTokens=" + String(buildGeminiPayload({ ...body, model }).generationConfig.maxOutputTokens), "outTokens=" + String(payload?.usageMetadata?.candidatesTokenCount || 0), "thoughtTokens=" + String(payload?.usageMetadata?.thoughtsTokenCount || 0));
  }
  const hasText = Array.isArray(normalized?.content) && normalized.content.some((x) => String(x?.text || "").trim());
  if (hasText) return { ok: true, payload: normalized, provider: "gemini", model };
  /* No text because a safety filter stopped it: not an outage, and every other key would stop it too. */
  const blockedBy = geminiBlockReason(payload);
  if (blockedBy) return { ok: false, status: 422, blocked: true, payload: { error: { message: `Gemini blocked the answer (${blockedBy}).` } }, provider: "gemini", model };
  return { ok: false, status: 502, payload: { error: { message: "Gemini returned empty content." } }, provider: "gemini", model };
}

async function proxyAnthropicMessage(body) {
  if (!ANTHROPIC_API_KEY) return { unavailable: true, provider: "anthropic" };

  const requested = String(body?.model || "").trim();
  const model = requested.startsWith("claude")
    ? requested
    : String(process.env.ANTHROPIC_MODEL || process.env.ANTHROPIC_FALLBACK_MODEL || "claude-sonnet-4-6").trim();

  const { provider, source, priority, client_instance_id, __worldKey, quality, timeout_ms, foreground, ...rest } = body || {};
  const outboundBody = { ...rest, model, max_tokens: body?.max_tokens ?? 1024 };
  const r = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": process.env.ANTHROPIC_VERSION || "2023-06-01",
      "Accept": "application/json",
    },
    body: JSON.stringify(outboundBody),
  }, upstreamTimeoutFor(body));
  const payload = await responseJsonSafe(r);

  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      payload,
      retryAfter: r.headers.get("retry-after"),
      provider: "anthropic",
    };
  }

  const hasText = Array.isArray(payload?.content) && payload.content.some((x) => x?.type === "text" && String(x?.text || "").trim());
  return hasText
    ? { ok: true, payload, provider: "anthropic" }
    : { ok: false, status: 502, payload: { error: { message: "Anthropic returned empty content." } }, provider: "anthropic" };
}

/* MÁSVILÁG AI 403 FAILOVER + GROUP CHAT DEDUPE v4 */
const AI_GROQ_MAX_INPUT_CHARS = 300000;
const AI_GROUP_CHAT_SYSTEM_CAP = 18000;
const AI_GROUP_CHAT_PROMPT_CAP = 36000;
const AI_GROUP_CHAT_DEDUPE_MS = 15000;

function buildCompatibleChatPayload(body = {}, model) {
  const messages = [];
  if (body.system) messages.push({ role: "system", content: String(body.system) });
  for (const item of Array.isArray(body.messages) ? body.messages : []) {
    const text = extractText(item?.content || "");
    if (!text) continue;
    messages.push({ role: item?.role === "assistant" ? "assistant" : "user", content: text });
  }
  const payload = { model, messages, max_tokens: body.max_tokens ?? 1024 };
  if (Number.isFinite(Number(body.temperature))) payload.temperature = Number(body.temperature);
  return payload;
}

/* What Groq's per-minute budget is measured on: the output allowance and the size of each prompt part. */
function groqRequestSize(body) {
  const rows = Array.isArray(body?.messages) ? body.messages : [];
  return {
    maxTokens: body?.max_tokens ?? 1024,
    systemChars: String(body?.system || "").length,
    messageChars: rows.map((item) => extractText(item?.content || "").length),
  };
}

/* Can the second Groq key take a request the first one has no turn for? Only then is the first key
   allowed to hand it on instead of waiting for its own turn. */
function groqSiblingReady(provider) {
  return provider === "groq" &&
    Boolean(GROQ_API_KEY_2 && GROQ_MODEL_2) &&
    !AI_GATE.providerConfigurationErrors.has("groq2") &&
    providerCooldownMs("groq2") <= 0;
}

async function proxyCompatibleMessage(provider, apiKey, model, endpoint, body) {
  if (!apiKey || !model) return { unavailable: true, provider, model: model || "" };

  /* Paid OpenRouter3 (DeepSeek) needs more than the old 15s free-router turn for
     long RP context. Keep free OpenRouter keys short, while giving each user-facing
     writing source only as much time as it reasonably needs. */
  const baseTimeout = upstreamTimeoutFor(body);
  const source = String(body?.source || "").trim().toLowerCase();
  const openRouter3Timeout =
    source === "scene"
      ? Math.min(baseTimeout, 65000)
      : source === "dm" || source === "group-chat"
        ? Math.min(baseTimeout, 30000)
        : source === "comments"
          /* R73: Nemotron often thought past 25 s on a comment (Ultra 550B); Super 120B answers in seconds */
          ? Math.min(baseTimeout, 15000)
          : source === "feed-post"
          ? Math.min(baseTimeout, 25000)
          : Math.min(baseTimeout, 35000);
  const providerTimeout =
    provider === "openrouter3"
      ? openRouter3Timeout
      : provider === "openrouter" || provider === "openrouter2"
        ? Math.min(baseTimeout, 15000)
        : provider === "groq" || provider === "groq2"
          ? Math.min(baseTimeout, 35000)
          : baseTimeout;

  /* Groq's free tier takes 8,000 tokens per minute, prompt AND output allowance together. What
     cannot fit is never sent (it would be refused with a 413 anyway); the rest is shortened to fit,
     and the request waits its turn: one at a time per key, inside the minute's budget. */
  let providerBody = body;
  let lease = null;
  if (provider === "groq" || provider === "groq2") {
    const size = groqRequestSize(body);
    const plan = planGroqRequest(size);
    if (!plan.fits) {
      console.info("[ai-provider] groq-skip", `provider=${provider}`, `chars=${aiRequestChars(body)}`, `max_tokens=${body.max_tokens ?? 1024}`);
      return { ok: false, status: 413, skipped: true, payload: { error: { message: `${provider} skipped: ${plan.reason}` } }, provider, model };
    }
    if (plan.compact) {
      const rows = Array.isArray(body.messages) ? body.messages : [];
      providerBody = {
        ...body,
        system: preservePromptEdges(String(body.system || ""), plan.systemCap),
        messages: rows.map((item, index) => ({
          ...item,
          content: preservePromptEdges(extractText(item?.content || ""), index === rows.length - 1 ? plan.lastCap : plan.otherCap),
        })),
      };
      console.info("[ai-provider] compact", `provider=${provider}`, `before=${aiRequestChars(body)}`, `after=${aiRequestChars(providerBody)}`, `budget=${plan.maxChars}`);
    }
    /* With the second key free to take it, this one does not make the request wait. */
    const grant = await GROQ_PACER.acquire(provider, estimateGroqTokens(groqRequestSize(providerBody)), groqSiblingReady(provider) ? 0 : groqPaceMaxWaitMs(body));
    if (!grant.ok) {
      const seconds = Math.max(1, Math.ceil((grant.waitMs || 3000) / 1000));
      console.info("[ai-provider] groq-paced", `provider=${provider}`, `reason=${grant.reason}`, `retryAfter=${seconds}s`);
      return { ok: false, status: 429, paced: true, retryAfter: String(seconds), payload: { error: { message: `${provider} is ${grant.reason === "busy" ? "busy with another request" : "at its per-minute token budget"}; trying the next provider` } }, provider, model };
    }
    lease = grant;
  }

  /* The paid providers charge for every token sent: a prompt over the ceiling is shortened to it (the
     character-fidelity block and the protected tail are never cut, see preservePromptEdges). */
  if (PAID_INPUT_PROVIDERS.has(provider) && PAID_MAX_INPUT_CHARS > 0) {
    const size = groqRequestSize(body);
    const ceiling = paidCeilingFor(body?.source, PAID_MAX_INPUT_CHARS);
    const budget = planCharBudget({ maxChars: ceiling, systemChars: size.systemChars, messageChars: size.messageChars });
    if (budget.compact) {
      const rows = Array.isArray(body.messages) ? body.messages : [];
      providerBody = {
        ...body,
        system: preservePromptEdges(String(body.system || ""), budget.systemCap),
        messages: rows.map((item, index) => ({
          ...item,
          content: preservePromptEdges(extractText(item?.content || ""), index === rows.length - 1 ? budget.lastCap : budget.otherCap),
        })),
      };
      console.info("[ai-provider] paid-trim", `provider=${provider}`, `source=${String(body?.source || "unknown")}`, `before=${aiRequestChars(body)}`, `after=${aiRequestChars(providerBody)}`, `ceiling=${ceiling}`);
    }
  }

  let usedTokens;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), providerTimeout);
  try {
    /* Keep the SAME abort signal alive until the entire response body is read.
       Previously fetchWithTimeout() cleared its timer as soon as headers arrived,
       so a provider could stream/hang the body for another 40–60 seconds. */
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      /* R73: Nemotron (a reasoning model) wrote its whole chain of thought into the answer ("The user wants me to
         generate a DM ...") and ran out of time: ask OpenRouter for a short, hidden reasoning pass. */
      body: JSON.stringify(provider === "openrouter3"
        ? { ...buildCompatibleChatPayload(providerBody, model), reasoning: { effort: "low", exclude: true } }
        : provider === "openrouter-dm-dolphin"
          /* R74: Gemma 4 answers much faster with thinking off */
          ? { ...buildCompatibleChatPayload(providerBody, model), reasoning: { enabled: false, exclude: true } }
          : buildCompatibleChatPayload(providerBody, model)),
      signal: ctrl.signal,
    });
    const raw = await r.text();
    let payload = {};
    if (raw) {
      try { payload = JSON.parse(raw); }
      catch { payload = { error: { message: raw } }; }
    }
    if (!r.ok) {
      return { ok: false, status: r.status, payload, retryAfter: r.headers.get("retry-after"), provider, model };
    }
    const reported = Number(payload?.usage?.total_tokens);
    if (Number.isFinite(reported) && reported >= 0) usedTokens = reported;
    if (payload?.usage) {
      const used = AI_USAGE.record({
        provider, model, source: String(body?.source || "unknown"),
        promptTokens: payload.usage.prompt_tokens, completionTokens: payload.usage.completion_tokens,
        cachedTokens: payload.usage.prompt_tokens_details?.cached_tokens, reasoningTokens: payload.usage.completion_tokens_details?.reasoning_tokens,
        cost: payload.usage.cost,
      });
      if (PAID_INPUT_PROVIDERS.has(provider)) {
        console.info("[ai-usage]", `provider=${provider}`, `model=${model}`, `source=${String(body?.source || "unknown")}`, `in=${used.promptTokens}`, `out=${used.completionTokens}`, `cached=${used.cachedTokens}`, `reasoning=${used.reasoningTokens}`, used.cost ? `cost=${used.cost}` : "");
      }
    }
    const normalized = normalizeOpenAIResponse(payload);
    const hasText = Array.isArray(normalized?.content) && normalized.content.some((x) => String(x?.text || "").trim());
    return hasText
      ? { ok: true, payload: normalized, provider, model }
      : { ok: false, status: 502, payload: { error: { message: `${provider} returned empty content.` } }, provider, model };
  } catch (err) {
    const timeout = err?.name === "AbortError" || /aborted|timeout/i.test(String(err?.message || err || ""));
    return {
      ok: false,
      status: timeout ? 504 : 502,
      payload: { error: { message: timeout ? `${provider} timed out after ${providerTimeout}ms.` : String(err?.message || err || "Provider request failed.") } },
      provider,
      model,
    };
  } finally {
    clearTimeout(timer);
    if (lease) lease.release(usedTokens);
  }
}

function providerModel(provider, body = {}) {
  const requested = String(body?.model || "").trim();
  if (provider === "mistral" || provider === "mistral2") {
    const source = String(body?.source || "").trim().toLowerCase();
    if (source === "scene") return String(process.env.MISTRAL_SCENE_MODEL || "mistral-small-latest").trim();
    if (source === "comments" || /(?:^|[-_])comments?(?:[-_]|$)/.test(source) || source.includes("player-post-comment")) return String(process.env.MISTRAL_COMMENT_MODEL || "mistral-small-latest").trim();
    if (source === "dm") return String(process.env.MISTRAL_DM_MODEL || process.env.MISTRAL_DM_FALLBACK_MODEL || "mistral-medium-latest").trim();
    if (String(body?.quality || "") === "deep") return String(process.env.MISTRAL_DEEP_MODEL || "mistral-large-latest").trim();
    if ((Number(body?.priority) || 0) >= 50) return String(process.env.MISTRAL_PLAYER_MODEL || "mistral-medium-latest").trim();
    return MISTRAL_MODEL || "";
  }
  if (provider === "groq") {
    return GROQ_MODEL || "";
  }
  if (provider === "groq2") {
    return GROQ_MODEL_2 || GROQ_MODEL || "";
  }
  if (provider === "openrouter-dm-dolphin") {
    /* R74: Dolphin 3.0's free endpoint is gone ("No endpoints found"); this slot now runs Gemma 4 31B (free). */
    return String(process.env.OPENROUTER_GEMMA_MODEL || "google/gemma-4-31b-it:free").trim();
  }
  if (provider === "openrouter-dm-venice") {
    return "cognitivecomputations/dolphin-mistral-24b-venice-edition";
  }
  if (provider === "openrouter3") return String(process.env.OPENROUTER_MODEL_3 || "nvidia/nemotron-3-super-120b-a12b:free").trim();
  if (provider === "openrouter") return String(process.env.OPENROUTER_MODEL || "openrouter/free").trim();
  if (provider === "openrouter2") return String(process.env.OPENROUTER_MODEL_2 || "openrouter/free").trim();
  if (provider === "gemini") {
    return String(body?.quality || "") === "deep" ? GEMINI_MODELS.deep : GEMINI_MODELS.primary;
  }
  if (provider === "anthropic") {
    return requested.startsWith("claude")
      ? requested
      : String(process.env.ANTHROPIC_MODEL || process.env.ANTHROPIC_FALLBACK_MODEL || "claude-sonnet-4-6").trim();
  }
  if (provider === "openai") {
    return /^(gpt|o1|o3|o4)/i.test(requested)
      ? requested
      : String(process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
  }
  return requested;
}

async function callMessageProvider(provider, body) {
  /* OpenRouter roleplay chain: MODEL_3 first, then MODEL_2 on the second key, then MODEL_1. */
  if (provider === "openrouter3") {
    const model = providerModel("openrouter3", body);
    /* R78: Nemotron :free runs on the funded OpenRouter account (key 2: 1000 free requests a day instead of 50) */
    const openRouter3Key = process.env.OPENROUTER_API_KEY_2 || process.env.OPENROUTER_API_KEY;
    let result = await proxyCompatibleMessage("openrouter3", openRouter3Key, model, "https://openrouter.ai/api/v1/chat/completions", body);
    if (!result?.ok && Number(result?.status) === 402) {
      const message = safeProviderMessage(result, "");
      const match = message.match(/can only afford\s+(\d+)/i);
      const affordable = match ? Number(match[1]) : 0;
      if (affordable >= 96) {
        const requested = Math.max(1, Number(body?.max_tokens) || 1024);
        const retryTokens = Math.max(80, Math.min(requested - 1, affordable - 16));
        if (retryTokens < requested) {
          console.warn("[ai-provider] openrouter3-token-downshift", "requested=" + requested, "retry=" + retryTokens, "affordable=" + affordable);
          result = await proxyCompatibleMessage("openrouter3", openRouter3Key, model, "https://openrouter.ai/api/v1/chat/completions", { ...body, max_tokens: retryTokens });
        }
      }
    }
    return result;
  }
  if (provider === "openrouter") return proxyCompatibleMessage("openrouter", process.env.OPENROUTER_API_KEY, providerModel("openrouter", body), "https://openrouter.ai/api/v1/chat/completions", body);
  if (provider === "openrouter2") return proxyCompatibleMessage("openrouter2", process.env.OPENROUTER_API_KEY_2, providerModel("openrouter2", body), "https://openrouter.ai/api/v1/chat/completions", body);
  if (provider === "mistral") return proxyCompatibleMessage("mistral", MISTRAL_API_KEY, providerModel("mistral", body) || MISTRAL_MODEL, "https://api.mistral.ai/v1/chat/completions", body);
  if (provider === "mistral2") return proxyCompatibleMessage("mistral2", MISTRAL_API_KEY_2, providerModel("mistral2", body) || MISTRAL_MODEL, "https://api.mistral.ai/v1/chat/completions", body);
  if (provider === "groq") return proxyCompatibleMessage("groq", GROQ_API_KEY, providerModel("groq", body), "https://api.groq.com/openai/v1/chat/completions", body);
  if (provider === "groq2") return proxyCompatibleMessage("groq2", GROQ_API_KEY_2, providerModel("groq2", body), "https://api.groq.com/openai/v1/chat/completions", body);
  /* R74: on the funded account's key (1,000 free requests a day there instead of 50), key 1 if there is no key 2 */
  if (provider === "openrouter-dm-dolphin") return proxyCompatibleMessage("openrouter-dm-dolphin", process.env.OPENROUTER_API_KEY_2 || process.env.OPENROUTER_API_KEY, providerModel("openrouter-dm-dolphin", body), "https://openrouter.ai/api/v1/chat/completions", body);
  if (provider === "openrouter-dm-venice") return proxyCompatibleMessage("openrouter-dm-venice", process.env.OPENROUTER_API_KEY_2, providerModel("openrouter-dm-venice", body), "https://openrouter.ai/api/v1/chat/completions", body);
  if (provider === "openai") {
    const result = await proxyOpenAIMessage(body);
    return { ...result, provider: "openai", model: providerModel("openai", body) };
  }
  if (provider === "gemini") {
    const result = await proxyGeminiMessage(body);
    return { ...result, provider: "gemini", model: result?.model || providerModel("gemini", body) };
  }
  const result = await proxyAnthropicMessage(body);
  return { ...result, provider: "anthropic", model: providerModel("anthropic", body) };
}

function configuredAIProvider(provider) {
  if (provider === "mistral") return Boolean(MISTRAL_API_KEY && MISTRAL_MODEL);
  if (provider === "mistral2") return Boolean(MISTRAL_API_KEY_2 && MISTRAL_MODEL);
  if (provider === "groq") return Boolean(GROQ_API_KEY && GROQ_MODEL);
  if (provider === "groq2") return Boolean(GROQ_API_KEY_2 && (GROQ_MODEL_2 || GROQ_MODEL));
  if (provider === "openrouter-dm-dolphin") return Boolean(process.env.OPENROUTER_API_KEY_2 || process.env.OPENROUTER_API_KEY);
  if (provider === "openrouter-dm-venice") return Boolean(process.env.OPENROUTER_API_KEY_2);
  if (provider === "gemini") return GEMINI_KEYS.length > 0;
  if (provider === "openrouter3") return Boolean((process.env.OPENROUTER_API_KEY_2 || process.env.OPENROUTER_API_KEY) && process.env.OPENROUTER_MODEL_3);
  if (provider === "openrouter") return Boolean(process.env.OPENROUTER_API_KEY);
  if (provider === "openrouter2") return Boolean(process.env.OPENROUTER_API_KEY_2);
  if (provider === "openai") return Boolean(OPENAI_API_KEY);
  if (provider === "anthropic") return Boolean(ANTHROPIC_API_KEY);
  return false;
}

function providerOrder(requestedProvider) {
  const configured = AI_PROVIDER_ORDER_ENV
    .split(/[>,;|\s]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const raw = configured.length
    ? configured
    : [requestedProvider, "openrouter3", "openrouter2", "openrouter", "mistral", "mistral2", "groq", "groq2", "gemini", "openai", "anthropic"];
  const ordered = [];
  for (const provider of raw) {
    if (!ordered.includes(provider) && configuredAIProvider(provider)) ordered.push(provider);
  }
  if (!configured.length && configuredAIProvider(requestedProvider) && !ordered.includes(requestedProvider)) ordered.unshift(requestedProvider);
  return ordered;
}

function aiRequestText(body = {}) {
  return (Array.isArray(body.messages) ? body.messages : [])
    .map((m) => extractText(m?.content || ""))
    .filter(Boolean)
    .join("\n");
}

function aiRequestChars(body = {}) {
  return String(body?.system || "").length + aiRequestText(body).length;
}

function inferAIRequestSource(body = {}) {
  const explicit = String(body.source || "").trim();
  if (explicit) return explicit.slice(0, 80);
  const text = (String(body.system || "") + "\n" + aiRequestText(body)).toLowerCase();
  if (text.includes("social-post meaning parser") || text.includes("post meaning") || text.includes("meaning analysis")) return "meaning-analysis";
  if (text.includes("recovery-queue") || text.includes("relationship-auto-follow") || text.includes("auto-follow backlog")) return "recovery-queue";
  if (text.includes("group chat") || text.includes("groupchat") || text.includes("csoportos chat")) return "group-chat";
  if (text.includes("roleplay") || text.includes("jelenet") || text.includes("scene")) return "scene";
  if (text.includes("direct message") || text.includes("private message") || /(^|[^a-z])dm([^a-z]|$)/.test(text)) return "dm";
  if (text.includes("comment") || text.includes("komment") || text.includes("reply") || text.includes("válaszkomment")) return "comments";
  if (text.includes("note") || text.includes("jegyzet")) return "notes";
  if (text.includes("social post") || text.includes("feed") || text.includes("poszt")) return "feed-post";
  return "autonomy-other";
}

function aiRequestPriority(body = {}, source = inferAIRequestSource(body)) {
  const supplied = Number(body.priority);
  if (Number.isFinite(supplied) && supplied !== 0) return supplied;
  if (["interactive", "dm", "group-chat", "scene"].includes(source)) return 100;
  if (source === "comments") return 70;
  if (source === "feed-post") return 30;
  if (source === "notes") return 25;
  if (source === "meaning-analysis") return -20;
  if (source === "recovery-queue") return -30;
  return 20;
}

function preservePromptEdges(text, max) {
  const value = String(text || "");
  if (value.length <= max) return value;

  const spanOf = (startMarker, endMarker) => {
    const at = value.indexOf(startMarker);
    const endAt = at >= 0 ? value.indexOf(endMarker, at + startMarker.length) : -1;
    return at >= 0 && endAt > at ? { start: at, end: endAt + endMarker.length } : null;
  };
  const fidelitySpan = spanOf("[[CHARACTER_FIDELITY]]", "[[/CHARACTER_FIDELITY]]");
  const fidelityBlock = fidelitySpan ? value.slice(fidelitySpan.start, fidelitySpan.end) : "";

  /* CLAUDE FIX R2: never cut the protected tail (latest player input, DM reason, author roster). */
  let protectedAt = value.lastIndexOf("[[PROTECTED_TAIL]]");
  if (protectedAt < 0) protectedAt = value.indexOf("[MÁSVILÁG_DIRECT_DM_PROTECTED_TAIL_V1]");
  const tailSpan = protectedAt >= 0 && (!fidelitySpan || protectedAt >= fidelitySpan.end)
    ? { start: protectedAt, end: value.length }
    : null;
  const protectedTail = tailSpan ? value.slice(tailSpan.start) : "";

  /* The private bond context of the characters a call is about (who is who to whom, who knows what): the model cannot
     write a believable DM, scene or comment without it, so it is never squeezed out by the filler around it. */
  const bondSpan = spanOf("[[FULL_BOND_CONTEXT]]", "[[/FULL_BOND_CONTEXT]]");
  const bondUsable = bondSpan
    && (!fidelitySpan || bondSpan.start >= fidelitySpan.end || bondSpan.end <= fidelitySpan.start)
    && (!tailSpan || bondSpan.end <= tailSpan.start);
  const bondBlock = bondUsable ? value.slice(bondSpan.start, bondSpan.end) : "";

  if (fidelityBlock || protectedTail || bondBlock) {
    const compactBlock = (block, cap, label) => {
      if (!block || block.length <= cap) return block;
      const note = "\n...[" + label + " compacted, protected]...\n";
      const usable = Math.max(0, cap - note.length);
      const head = Math.floor(usable * 0.68);
      const tail = Math.max(0, usable - head);
      return block.slice(0, head) + note + (tail ? block.slice(-tail) : "");
    };
    /* The bond context lists what matters first (rules, the current bonds, who knows what) and the profiles last, so a
       cut loses the least important part, and the closing marker stays in place. */
    const compactBond = (block, cap) => {
      if (!block || block.length <= cap) return block;
      const note = "\n...[bond context compacted, protected]...\n[[/FULL_BOND_CONTEXT]]";
      return block.slice(0, Math.max(0, cap - note.length)) + note;
    };
    /* What the reply depends on is the protected tail (the last turns of this very conversation, the voice card, the
       rules, the player's latest line): it stays whole while it fits in 55% of the room, and only what lies beyond is
       compacted. Cutting it at a third of the room used to drop the newest turns from the middle, and the character then
       answered a line it had no context for. The bond context of the people involved keeps up to 40% of what the tail
       leaves, the character canon gets what is left, up to 60%, and the rest of the prompt keeps at least 8%. */
    const tailCap = protectedTail ? Math.min(protectedTail.length, Math.floor(max * 0.55)) : 0;
    const bodyFloor = Math.floor(max * 0.08);
    const bondCap = bondBlock ? Math.min(bondBlock.length, Math.floor(max * 0.40), Math.max(0, max - tailCap - bodyFloor)) : 0;
    const fidelityCap = Math.min(Math.floor(max * 0.60), Math.max(0, max - tailCap - bondCap - bodyFloor));
    const keptFidelity = compactBlock(fidelityBlock, fidelityCap, "character fidelity");
    const keptBond = compactBond(bondBlock, bondCap);
    const keptTail = compactBlock(protectedTail, Math.max(tailCap, Math.floor(max * 0.32)), "latest protected tail");

    let body = value;
    for (const span of [fidelitySpan && fidelityBlock ? fidelitySpan : null, bondBlock ? bondSpan : null, tailSpan]
      .filter(Boolean).sort((a, b) => b.start - a.start)) body = body.slice(0, span.start) + body.slice(span.end);
    body = body.trim();

    const note = "\n...[context compacted by AI gate; character fidelity + newest beat preserved]...\n";
    const room = Math.max(0, max - keptFidelity.length - keptBond.length - keptTail.length - note.length - 12);
    let keptBody = body;
    if (keptBody.length > room) {
      const head = Math.floor(room * 0.58);
      const tail = Math.max(0, room - head);
      keptBody = keptBody.slice(0, head) + note + (tail ? keptBody.slice(-tail) : "");
    }
    return [keptFidelity, keptBody, keptBond, keptTail].filter(Boolean).join("\n\n").slice(0, max);
  }

  const head = Math.floor(max * 0.72);
  const tail = Math.max(0, max - head - 80);
  return value.slice(0, head) + "\n...[context compacted by AI gate]...\n" + value.slice(-tail);
}

function compactGroupChatSystem(text, max = AI_GROUP_CHAT_SYSTEM_CAP) {
  const value = String(text || "");
  if (value.length <= max) return value;

  const blocks = value.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  const relevant = /(summary|összefoglal|tömör|compact|relevant|kapcsolat|relationship|current|recent|jelenlegi|legutóbbi|group\s*chat|csoport|participant|résztvevő|knowledge|tudás|personality|személyiség|speech|beszéd|style|stílus|goal|cél|secret|titok|status|állapot|memory|emlék|canon|kánon|history|történet|extreme|szélsőség)/i;
  const selected = [];
  let used = 0;

  for (let i = 0; i < blocks.length && used < max; i += 1) {
    const block = blocks[i];
    const isOpeningInstruction = i < 2 && used < 3500;
    if (!isOpeningInstruction && !relevant.test(block)) continue;
    if (selected.includes(block)) continue;
    const room = max - used;
    const clipped = block.length > room ? preservePromptEdges(block, room) : block;
    if (!clipped) break;
    selected.push(clipped);
    used += clipped.length + 2;
  }

  let compacted = selected.join("\n\n");
  if (compacted.length < Math.min(5000, max * 0.45)) {
    const fallbackRoom = Math.max(0, max - compacted.length - 90);
    const tail = value.slice(-Math.min(fallbackRoom, 5000));
    compacted = [compacted, "[RECENT / RELEVANT TAIL]", tail].filter(Boolean).join("\n\n");
  }
  return preservePromptEdges(compacted || value, max);
}

function prepareAIRequestBody(body, priority, source) {
  /* A prompt that carries the bond context of the people it is about keeps its whole text only for a DM and a group chat
     (the client budgets those itself). For every other kind of call the PROMPT is shortened around the bond context, the
     voice cards and the newest beat, which preservePromptEdges never cuts; the system (the rulebook and the social policy
     with the nickname, knowledge and tone rules) is never cut. Without a cap a comment or a post went out at 150-390k
     characters and the free models answered it with timeouts. */
  const bonded = (body.messages || []).some(item => extractText(item.content || "").includes("[[FULL_BOND_CONTEXT]]"));
  if (bonded && (source === "dm" || source === "group-chat")) return body;
  let system = String(body?.system || "");
  /* CLAUDE FIX R2: player-facing work (scene, DM reply, reactions to the player's post) gets room. */
  /* R4: the protected tail keeps what matters, so a moderate cap is enough.
     Bigger requests burned through the free Gemini per-minute token quota. */
  /* CLAUDE FIX R17: one-time deep reading of character sheets is never cut short. */
  const deep = String(body?.quality || "") === "deep";
  const fullSheetRead = deep && (source === "sheet-summary" || source === "character-bible");
  /* CLAUDE FIX R51: a live scene turn is the most player-facing call there is; cutting
     its 80k prompt to 40k removed the scene's own recent turns and goal. */
  const liveScene = String(body?.source || "") === "scene" && priority >= 50;
  const systemCap = source === "group-chat"
    ? AI_GROUP_CHAT_SYSTEM_CAP
    : source === "dm"
      ? 12000
      : bonded
        ? Number.MAX_SAFE_INTEGER   /* the rulebook and the social policy (the nickname, knowledge and tone rules) travel whole */
        : (liveScene ? 36000 : (deep ? 20000 : (priority >= 50 ? 22000 : 16000)));
  /* R70: one-time deep Gemini sheet reads must receive the complete raw sheet.
     This exemption applies ONLY to sheet-summary / character-bible. */
  const promptCap = fullSheetRead
    ? Number.MAX_SAFE_INTEGER
    : source === "group-chat"
      ? AI_GROUP_CHAT_PROMPT_CAP
      : source === "dm"
        ? 18000
        : bonded
          ? (liveScene || source === "scene" ? 100000 : (priority >= 50 ? 70000 : 45000))
          : (liveScene ? 84000 : (deep ? 70000 : (priority >= 50 ? 40000 : 26000)));

  if (source === "group-chat") {
    const before = system.length;
    system = compactGroupChatSystem(system, systemCap);
    if (before !== system.length) {
      console.info("[ai-context] group-chat", `systemChars=${before}->${system.length}`, "mode=summary+relevant");
    }
  } else {
    system = preservePromptEdges(system, systemCap);
  }

  let left = promptCap;
  const messages = [];
  for (const item of Array.isArray(body?.messages) ? body.messages : []) {
    if (left <= 0) break;
    const text = extractText(item?.content || "");
    if (!text) continue;
    const clipped = preservePromptEdges(text, left);
    left -= clipped.length;
    messages.push({ ...item, content: clipped });
  }
  return { ...body, system, messages };
}

function parseRetryAfterMs(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const seconds = Number(text);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const at = Date.parse(text);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : 0;
}

const AI_GATE = {
  queue: [], active: 0, seq: 0, lastStartAt: 0, wakeTimer: null,
  pendingKeys: new Set(), recentKeys: new Map(), providerCooldownUntil: new Map(), providerFailures: new Map(),
  providerConfigurationErrors: new Map(), leaderByWorld: new Map(), lastAutonomyAt: new Map(),
  minute: "", minuteTotal: 0, minuteSources: Object.create(null), lastError: "",
};

function safeProviderMessage(result, fallback = "") {
  return String(proxyErrorMessage(result?.payload, fallback) || fallback || "").replace(/\s+/g, " ").trim().slice(0, 300);
}

function aiMinuteTrace(source, body, eventId = "") {
  const stamp = new Date().toISOString();
  const minute = stamp.slice(0, 16);
  if (AI_GATE.minute && AI_GATE.minute !== minute) {
    console.info("[ai-trace-minute]", AI_GATE.minute, `total=${AI_GATE.minuteTotal}`, `sources=${JSON.stringify(AI_GATE.minuteSources)}`);
    AI_GATE.minuteTotal = 0;
    AI_GATE.minuteSources = Object.create(null);
  }
  AI_GATE.minute = minute;
  AI_GATE.minuteTotal += 1;
  AI_GATE.minuteSources[source] = (AI_GATE.minuteSources[source] || 0) + 1;
  const prompt = aiRequestText(body);
  console.info("[ai-trace]", stamp, `source=${source}`, eventId ? `event=${eventId}` : "event=none", `systemChars=${String(body.system || "").length}`, `promptChars=${prompt.length}`, `totalChars=${String(body.system || "").length + prompt.length}`);
}
setInterval(() => {
  if (AI_GATE.minuteTotal) {
    console.info("[ai-trace-minute]", AI_GATE.minute || new Date().toISOString().slice(0,16), `total=${AI_GATE.minuteTotal}`, `sources=${JSON.stringify(AI_GATE.minuteSources)}`);
    AI_GATE.minuteTotal = 0;
    AI_GATE.minuteSources = Object.create(null);
  }
}, 60000).unref?.();

function providerCooldownMs(provider) {
  return Math.max(0, Number(AI_GATE.providerCooldownUntil.get(provider) || 0) - Date.now());
}

function markProviderFailure(provider, model, result) {
  const status = Number(result?.status || 0);
  const message = safeProviderMessage(result, `HTTP ${status}`);
  const lower = message.toLowerCase();

  /* OpenRouter may return HTTP 402 temporarily when the account has enough
     credits overall but current in-flight paid requests reserve the remaining
     balance. That is NOT a broken key/configuration: cool down briefly and retry. */
  const transientInFlight402 =
    status === 402 &&
    /in[- ]?flight|requests settle|current.*requests|retry after.*settle|can only afford|requires more credits, or fewer max_tokens|prompt tokens limit exceeded/.test(lower);

  if (transientInFlight402) {
    const previous = Number(AI_GATE.providerFailures.get(provider) || 0);
    const failures = Math.min(4, previous + 1);
    AI_GATE.providerFailures.set(provider, failures);
    AI_GATE.providerConfigurationErrors.delete(provider);
    const retryHeader = parseRetryAfterMs(result?.retryAfter);
    const rest = Math.max(retryHeader, Math.min(30000, 5000 * Math.pow(2, failures - 1)));
    AI_GATE.providerCooldownUntil.set(provider, Date.now() + rest);
    AI_GATE.lastError = `${provider}/${model} HTTP ${status}: ${message}`;
    console.warn("[ai-gate] provider-cooldown", `${provider}/${model}`, `status=${status}`, `ms=${rest}`, "reason=in-flight-credit-reservation", message);
    return rest;
  }

  /* Gemini's quota, credit and key problems are kept per (key, model) by GEMINI_LEDGER, which already rests
     exactly the pair that is spent. They must not rest or switch off the whole provider: another key, or
     another model's separate daily quota (a lite one, say), may well be open. */
  if (provider === "gemini" && [401, 402, 403, 404, 429].includes(status)) {
    AI_GATE.providerConfigurationErrors.delete(provider);
    AI_GATE.lastError = `${provider}/${model} HTTP ${status}: ${message}`;
    return 0;
  }

  if ([401, 402, 403, 404].includes(status)) {
    AI_GATE.providerConfigurationErrors.set(provider, { status, model, message, at: Date.now() });
    AI_GATE.providerCooldownUntil.delete(provider);
    AI_GATE.lastError = `${provider}/${model} HTTP ${status}: ${message}`;
    console.warn("[ai-gate] provider-config-invalid", `${provider}/${model}`, `status=${status}`, message);
    return -1;
  }

  if (![408, 429, 500, 502, 503, 504, 529].includes(status)) return 0;
  const previous = Number(AI_GATE.providerFailures.get(provider) || 0);
  const failures = Math.min(4, previous + 1);
  AI_GATE.providerFailures.set(provider, failures);
  const retryHeader = parseRetryAfterMs(result?.retryAfter);
  const hardQuota = /free[_ -]?tier|quota exceeded|current quota|resource exhausted|no credits|daily limit|budget exhausted|payment required|insufficient credits/.test(lower);
  const exponential = Math.min(60000, 5000 * Math.pow(2, failures - 1));
  const jitter = Math.floor(Math.random() * Math.min(2500, Math.max(500, exponential * 0.2)));
  /* Groq says when it is ready again: seconds for the minute limit, up to hours for the daily one. */
  const groqHint = (provider === "groq" || provider === "groq2") && status === 429 ? groqRetryMs(result?.retryAfter, message) : 0;
  const rest = provider === "gemini" && retryHeader > 0
    ? retryHeader + 1000 /* the earliest Gemini key comes back then */
    : groqHint > 0 ? Math.min(6 * 3600 * 1000, Math.max(5000, groqHint + 1000))
    : hardQuota ? Math.max(retryHeader, 15 * 60 * 1000) : Math.max(retryHeader, exponential + jitter);
  AI_GATE.providerCooldownUntil.set(provider, Date.now() + rest);
  AI_GATE.lastError = `${provider}/${model} HTTP ${status}: ${message}`;
  console.warn("[ai-gate] provider-cooldown", `${provider}/${model}`, `status=${status}`, `ms=${rest}`, message);
  return rest;
}

function markProviderSuccess(provider) {
  AI_GATE.providerFailures.set(provider, 0);
  AI_GATE.providerCooldownUntil.delete(provider);
  AI_GATE.lastError = "";
}

function providerAllowedForBody(provider, body) {
  const chars = aiRequestChars(body);
  if (chars <= AI_GROQ_MAX_INPUT_CHARS) return true;
  return provider === "mistral" || provider === "mistral2" || provider === "gemini" || provider === "openai" ||
    provider === "openrouter3" || provider === "openrouter" || provider === "openrouter2" ||
    provider === "openrouter-dm-dolphin" || provider === "openrouter-dm-venice";
}

/* Provider roles are intentionally strict.
   - DM: Dolphin on OPENROUTER_API_KEY -> Venice on OPENROUTER_API_KEY_2 (paid) -> Mistral 1 -> Mistral 2.
   - Scene: Dolphin -> Venice (paid) -> Mistral 1 -> Mistral 2.
   - Comments (player waiting or background): Dolphin -> Nemotron :free -> free Gemini -> OpenAI (paid) -> Venice (paid).
   - Feed: Gemini -> Nemotron :free -> Dolphin -> Groq 1, 2 (when it fits) -> OpenAI.
   - Character knowledge: Gemini -> Groq 1, 2 (when it fits) -> Nemotron :free -> OpenAI.
   - Analysis, classification and translation (meaning-analysis, display-translate, music-note,
     relationship-impact) go to Groq first when Groq can take the whole request, then free Gemini.
   - Other small background tasks keep the existing Gemini/Groq routing. */
function taskProviderOrder(requestedProvider, body) {
  const source = String(body?.source || inferAIRequestSource(body) || "").trim().toLowerCase();
  const chars = aiRequestChars(body);

  const isComment =
    source === "comments" ||
    /(?:^|[-_])comments?(?:[-_]|$)/.test(source) ||
    source.includes("player-post-comment");

  const isFeed =
    source === "feed-post" ||
    /(?:^|[-_])feed(?:[-_]|$)/.test(source);

  const characterKnowledgeSources = new Set([
    "sheet-summary",
    "character-bible",
  ]);

  const groqSmallEnough = chars <= 26000;
  let raw;

  const playerWaiting = isForegroundRequest(body);
  if (source === "dm" && !playerWaiting) {
    /* R70: an unprompted DM nobody is waiting for uses free capacity only:
       Dolphin -> Nemotron -> free Gemini -> Groq 1 -> Groq 2 (when it fits). */
    /* R78: when every free one is out (Gemma 429, Nemotron daily cap, Gemini overloaded) a triggered DM ("text me",
       no follow-back, unfollow) still arrives through paid Venice — R71 already keeps these to a handful an hour. */
    raw = ["openrouter-dm-dolphin", "openrouter3", "gemini", "groq", "groq2", "openrouter-dm-venice"];
    /* R84: Groq only when it can take the WHOLE prompt — on a cut-down one it wrote a comment instead of the DM */
    if (!groqCarriesWhole(groqRequestSize(body))) raw = raw.filter((provider) => provider !== "groq" && provider !== "groq2");
  } else if (source === "dm") {
    /* A reply the player is waiting on: Mistral first (Medium, on the paid keys) — the small free/uncensored models
       (Gemma is rate-limited most of the time, Dolphin-Mistral 24B on Venice answered nearly every DM) wrote plain,
       incoherent lines. A refusal or an outage still falls through, to the uncensored routes: Gemma, then Venice. */
    raw = ["mistral", "mistral2", "openrouter-dm-dolphin", "openrouter-dm-venice"];
  } else if (source === "popup" || source === "invite") {
    /* Popups and spontaneous Event invitations: free providers first; paid Venice only when the player is
       waiting on it (reroll / own answer). */
    /* R85 (owner's rule): popups never use a paid provider, not even when the player is waiting */
    raw = ["gemini", "groq", "groq2", "openrouter3"];
  } else if (source === "scene") {
    /* Scenes: Dolphin (OpenRouter key 1) -> Venice (OpenRouter key 2, paid) -> Mistral 1 -> Mistral 2. */
    raw = ["openrouter-dm-dolphin", "openrouter-dm-venice", "mistral", "mistral2"];
  } else if (isComment) {
    /* Comments — the ones the player waits for and the background ones alike: Dolphin (OpenRouter key 1) ->
       Nemotron :free -> the free Gemini keys -> paid OpenAI -> paid Venice (OpenRouter key 2). */
    raw = ["openrouter-dm-dolphin", "openrouter3", "gemini", "openai", "openrouter-dm-venice"];
  } else if (isFeed) {
    /* Feed: Gemini -> Nemotron :free -> Dolphin -> Groq 1 -> Groq 2 (when the request fits them) -> paid OpenAI. */
    raw = ["gemini", "openrouter3", "openrouter-dm-dolphin", "groq", "groq2", "openai"];
  } else if (characterKnowledgeSources.has(source)) {
    /* Canon/identity knowledge: Gemini -> Groq 1 -> Groq 2 (when it fits) -> Nemotron -> OpenAI. */
    raw = ["gemini", "groq", "groq2", "openrouter3", "openai"];
  } else if (isGroqUtilitySource(source)) {
    /* Analysis, classification and translation (never a character's voice) go to Groq first when Groq can
       take the WHOLE request (the pacer keeps them from running side by side); free Gemini after it. A
       request too long for Groq goes to Gemini alone: a translation or reading cut short is wrong. */
    raw = groqCarriesWhole(groqRequestSize(body)) ? [...GROQ_UTILITY_CHAIN] : ["gemini"];
  } else {
    /* Everything else the world writes on its own (notes, group chat, ...): Gemini, then OpenRouter (free), Groq when
       the request is small enough for it, and OpenAI as the very last one. */
    raw = ["gemini", "openrouter3", "openrouter-dm-dolphin", ...(groqSmallEnough ? ["groq", "groq2"] : []), "openai"];
  }

  /* The explicitly assigned DM and Gemini-fallback chains keep their exact order. Other request kinds may
     still demote a provider that repeatedly refuses. */
  const exactProviderOrder = source === "dm" || isFeed || characterKnowledgeSources.has(source);
  if (!exactProviderOrder) raw = orderByRefusals(raw, source, AI_REFUSALS);

  /* Background work stays on free providers; only a player-waiting request may use paid ones. */
  return filterProvidersForBody(
    raw.filter((provider, index, all) =>
      all.indexOf(provider) === index &&
      configuredAIProvider(provider) &&
      providerAllowedForBody(provider, body)
    ),
    body,
    /* OpenAI is the last resort for what the world writes on its own, once every free provider has failed */
    { freeGeminiKeyCount: GEMINI_FREE_KEYS.length, paidAllowed: mayUsePaidLastResort(source, isGroqUtilitySource(source)) ? PAID_LAST_RESORT_PROVIDERS : [], allowPaidBackground: AI_ALLOW_PAID_BACKGROUND || source === "dm" || source === "scene" || isComment }
  );
}

function healthyProvider(requestedProvider, body, excluded = new Set()) {
  return taskProviderOrder(requestedProvider, body).find((p) =>
    !excluded.has(p) &&
    !AI_GATE.providerConfigurationErrors.has(p) &&
    providerCooldownMs(p) <= 0 &&
    providerAllowedForBody(p, body)
  ) || "";
}

function suppliedEventId(body = {}) {
  const meta = body?.metadata && typeof body.metadata === "object" ? body.metadata : {};
  const value = body.event_id || body.eventId || body.eventID || body.request_id || body.requestId || meta.event_id || meta.eventId || "";
  return String(value || "").trim().slice(0, 180);
}

function normalizedGroupChatFingerprint(body = {}) {
  const prompt = aiRequestText(body)
    .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g, "<ts>")
    .replace(/\b\d{10,13}\b/g, "<epoch>")
    .replace(/\s+/g, " ")
    .trim();
  return crypto.createHash("sha256").update(prompt.slice(-12000)).digest("hex").slice(0, 24);
}

function requestEventId(body, source) {
  const supplied = suppliedEventId(body);
  if (supplied) return supplied;
  if (source === "group-chat") return `derived-${normalizedGroupChatFingerprint(body)}`;
  return "";
}

function dedupeKey(body, source, eventId = "") {
  if (eventId) return `${source}:event:${eventId}`;
  return crypto.createHash("sha256")
    .update(source + "\n" + String(body.system || "") + "\n" + aiRequestText(body))
    .digest("hex");
}

function quietSkip(reason) {
  return {
    ok: true,
    status: 200,
    provider: "server-gate",
    model: "masvilag-server-gate",
    payload: {
      model: "masvilag-server-gate", type: "message", role: "assistant",
      content: [{ type: "text", text: JSON.stringify({ skip: true, reason }) }],
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  };
}

function isAutonomySource(source) {
  return ["feed-post", "notes", "autonomy-other"].includes(source);
}

function leaderAllows(worldKey, clientId, source, priority) {
  if (priority >= 50 || !isAutonomySource(source)) return true;
  const now = Date.now();
  const current = AI_GATE.leaderByWorld.get(worldKey);
  if (current && current.expiresAt > now && current.clientId !== clientId) return false;
  AI_GATE.leaderByWorld.set(worldKey, { clientId, expiresAt: now + 45000 });
  return true;
}

function autonomyNotBefore(worldKey, source) {
  if (!isAutonomySource(source)) return Date.now();
  const last = Number(AI_GATE.lastAutonomyAt.get(worldKey) || 0);
  return Math.max(Date.now(), last + AI_AUTONOMY_INTERVAL_MINUTES * 60000);
}

function scheduleAIGate(delay = 0) {
  if (AI_GATE.wakeTimer) clearTimeout(AI_GATE.wakeTimer);
  AI_GATE.wakeTimer = setTimeout(() => { AI_GATE.wakeTimer = null; pumpAIGate(); }, Math.max(0, delay));
  AI_GATE.wakeTimer.unref?.();
}

function summarizeProviderFailures(attempts, requestedProvider, body) {
  const details = [];
  const seen = new Set();
  for (const item of attempts) {
    const key = item.provider;
    if (seen.has(key)) continue;
    seen.add(key);
    details.push(`${item.provider}/${item.model}: HTTP ${item.status || "?"} ${item.message || "hiba"}`);
  }
  for (const provider of taskProviderOrder(requestedProvider, body)) {
    if (seen.has(provider)) continue;
    const config = AI_GATE.providerConfigurationErrors.get(provider);
    if (config) details.push(`${provider}/${config.model || providerModel(provider, body)}: HTTP ${config.status} ${config.message}`);
    else if (providerCooldownMs(provider) > 0) details.push(`${provider}/${providerModel(provider, body)}: átmenetileg kimerült vagy limitált`);
    else if (!providerAllowedForBody(provider, body)) details.push(`${provider}/${providerModel(provider, body)}: kihagyva, mert a prompt túl nagy ehhez a szolgáltatóhoz`);
  }
  return details;
}

const AI_PROMPT_DEBUG = String(process.env.AI_PROMPT_DEBUG || "").trim() === "1";

function logFullAIPromptDebug(body = {}, source = "unknown", provider = "unknown") {
  if (!AI_PROMPT_DEBUG) return;
  const system = String(body?.system || "");
  const user = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((item) => String(item?.role || "").toLowerCase() === "user")
    .map((item) => extractText(item?.content || ""))
    .filter(Boolean)
    .join("\n\n");
  console.info(
    `[AI_PROMPT_DEBUG] source=${String(source || body?.source || "unknown")} provider=${String(provider || "unknown")}\n` +
    `--- SYSTEM ---\n${system}\n--- USER ---\n${user}\n--- END PROMPT ---`
  );
}

function shouldUseEmergencyOpenAIFallback(task, attempts = []) {
  /* OpenAI is a normal final fallback for feed/comment tasks. For other
     Gemini-owned background work it remains emergency-only on provider outage. */
  if (!configuredAIProvider("openai")) return false;
  if (attempts.some((item) => item.provider === "openai")) return false;
  /* Background work waits for the free providers; it never buys its way out of an outage. */
  if (!isForegroundRequest(task.body) && !AI_ALLOW_PAID_BACKGROUND) return false;

  const order = taskProviderOrder(task.requestedProvider, task.body);
  if (order[0] !== "gemini") return false;

  const geminiServiceIncident = attempts.some((item) =>
    item.provider === "gemini" &&
    [408, 500, 502, 503, 504, 529].includes(Number(item.status))
  );
  if (!geminiServiceIncident) return false;

  const groqProviders = ["groq", "groq2"].filter(configuredAIProvider);
  if (!groqProviders.length) return false;

  return groqProviders.every((provider) =>
    attempts.some((item) => item.provider === provider) ||
    providerCooldownMs(provider) > 0 ||
    AI_GATE.providerConfigurationErrors.has(provider) ||
    !providerAllowedForBody(provider, task.body)
  );
}

/* The text of a provider's answer. */
function answerText(result) {
  return (Array.isArray(result?.payload?.content) ? result.payload.content : []).map((part) => String(part?.text || "")).join("").trim();
}

async function executeAITask(task) {
  /* the same kind of request taskProviderOrder orders the chain by */
  const kindOfRequest = String(task.body?.source || inferAIRequestSource(task.body) || "").trim().toLowerCase();
  const attempted = new Set();
  const attempts = [];
  const waitHintsMs = [];   /* when a busy or spent provider says it will be ready again */
  let last = null;
  let unusableAnswer = null;   /* a 200 that holds no JSON at all, kept only as the last resort */
  /* The app that asked stops listening after its own timeout: the whole chain shares that time, so a slow first provider
     (Gemini under load) cannot use it all and leave the next ones no chance. A DM and a scene keep their providers' own
     timeouts, and so does a careful reading. */
  const chainBudgetMs = String(task.body?.quality || "") !== "deep" && kindOfRequest !== "dm" && kindOfRequest !== "scene" && Number(task.body?.timeout_ms) > 0
    ? upstreamTimeoutFor(task.body) : 0;
  const chainStartedAt = Date.now();

  while (true) {
    const provider = healthyProvider(task.requestedProvider, task.body, attempted);
    if (!provider) break;
    attempted.add(provider);
    const model = providerModel(provider, task.body);
    let providerBody = task.body;
    if (chainBudgetMs) {
      const providersLeft = taskProviderOrder(task.requestedProvider, task.body)
        .filter((p) => !attempted.has(p) && !AI_GATE.providerConfigurationErrors.has(p) && providerCooldownMs(p) <= 0).length;
      const allowedMs = providerTimeBudget({ budgetMs: chainBudgetMs, elapsedMs: Date.now() - chainStartedAt, providersLeft, isFirst: attempted.size === 1 });
      if (allowedMs) providerBody = { ...task.body, timeout_ms: allowedMs };
    }

    console.info("[ai-gate] start", new Date().toISOString(), `source=${task.source}`, `event=${task.eventId || "none"}`, `priority=${task.priority}`, `provider=${provider}`, `model=${model}`, `queued=${AI_GATE.queue.length}`);
    console.info("[ai-provider] request", `provider=${provider}`, `model=${model}`, `chars=${aiRequestChars(task.body)}`);
    logFullAIPromptDebug(task.body, task.source || task.body?.source || "unknown", provider);

    const result = await callMessageProvider(provider, providerBody);
    result.provider = provider;
    result.model = result.model || model;
    last = result;

    const status = result?.ok ? 200 : (result?.unavailable ? 0 : Number(result?.status || 0));
    const message = result?.ok ? "ok" : (result?.unavailable ? "not configured" : safeProviderMessage(result, "upstream error"));
    console.info("[ai-provider] response", `provider=${provider}`, `model=${model}`, `status=${status}`, `message=${message}`);

    /* A model that answers a request for JSON with a polite refusal gave no answer: the next provider tries. */
    const askedForJson = result?.ok && requestExpectsJson(task.body);
    const dmOpenRouterProvider =
      kindOfRequest === "dm" &&
      (provider === "openrouter-dm-dolphin" || provider === "openrouter-dm-venice");
    const refusedByText =
      (askedForJson && looksLikeRefusal(answerText(result))) ||
      (dmOpenRouterProvider && result?.ok && looksLikeRefusal(answerText(result)));
    if (askedForJson) AI_REFUSALS.record(provider, kindOfRequest, refusedByText);
    if (refusedByText) {
      attempts.push({ provider, model, status: 422, message: "refused: " + answerText(result).slice(0, 120), refused: true });
      console.warn("[ai-gate] refused", `source=${task.source}`, `provider=${provider}/${model}`, "— handing the request to the next provider");
      markProviderSuccess(provider);
      continue;
    }
    /* A request for JSON answered with no JSON object at all (prose, an empty reasoning answer, a stray
       sentence) is no answer either: the next provider tries. A cut-off or slightly broken object still
       counts as an answer, the app repairs those. */
    if (askedForJson && !refusedByText) {
      let answered = String(answerText(result) || "");
      let brace = answered.indexOf("{");
      if ((brace === -1 || !/"[^"\n]{1,60}"\s*:/.test(answered.slice(brace))) && /(?:^|[-_])comments?(?:[-_]|$)|player-post-comment/.test(kindOfRequest)) {
        const salvaged = salvageSingleFieldJson(task.body, answered);
        if (salvaged) {
          console.info("[ai-gate] prose-wrapped-as-json", `source=${task.source}`, `provider=${provider}/${model}`, salvaged.slice(0, 160));
          result.payload = { ...(result.payload || {}), content: [{ type: "text", text: salvaged }] };
          answered = salvaged;
          brace = 0;
        }
      }
      if (brace === -1 || !/"[^"\n]{1,60}"\s*:/.test(answered.slice(brace))) {
        console.warn("[ai-gate] no-json-answer", `source=${task.source}`, `provider=${provider}/${model}`, `chars=${answered.length}`, "start=" + JSON.stringify(answered.slice(0, 160)), "— handing the request to the next provider");
        attempts.push({ provider, model, status: 422, message: "answer held no JSON" });
        if (!unusableAnswer) unusableAnswer = result;
        markProviderSuccess(provider);
        continue;
      }
    }
    if (result?.ok) {
      markProviderSuccess(provider);
      /* Diagnostics: what a comment request actually got back (start of the answer only). */
      if (/(?:^|[-_])comments?(?:[-_]|$)|player-post-comment|feed|^dm$|^scene$/.test(kindOfRequest)) {
        const answered = String(answerText(result) || "");
        console.info("[ai-answer] " + kindOfRequest, `priority=${task.priority}`, `provider=${provider}/${model}`, `chars=${answered.length}`, JSON.stringify(answered.slice(0, 1200)));
      }
      return result;
    }
    if (result?.unavailable) continue;

    attempts.push({ provider, model, status, message, ...(result?.blocked ? { refused: true } : {}) });
    /* A safety block is the prompt's doing, not the provider's: no cooldown, the next provider tries. */
    if (result?.blocked) { AI_REFUSALS.record(provider, kindOfRequest, true); continue; }
    /* The two DM OpenRouter routes are explicit fallbacks: any upstream rejection/error hands the same DM
       to the next provider instead of ending the conversation. */
    if (dmOpenRouterProvider) {
      if ([401, 402, 403, 404, 408, 413, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 529].includes(status)) {
        markProviderFailure(provider, model, result);
      }
      continue;
    }
    /* Groq was busy with another request or had spent this minute's tokens. Not a failure: no cooldown,
       the next provider takes this one and Groq stays free for whoever is next. */
    if (result?.paced) {
      waitHintsMs.push(Math.max(1000, (Number.parseInt(result.retryAfter, 10) || 3) * 1000));
      continue;
    }
    /* Gemini keeps its own books (see markProviderFailure), so its "come back at" has to be taken here. */
    if (provider === "gemini" && status === 429) {
      const hint = Number.parseInt(result.retryAfter, 10);
      if (hint > 0) waitHintsMs.push(hint * 1000);
    }
    if ([401, 402, 403, 404, 408, 413, 429, 500, 502, 503, 504, 529].includes(status)) {
      markProviderFailure(provider, model, result);
      continue;
    }
    /* R21: a careful reading must not die on one provider's odd error — try the next */
    if (String(task.body?.quality || "") === "deep") continue;

    return result;
  }

  if (shouldUseEmergencyOpenAIFallback(task, attempts)) {
    const provider = "openai";
    const model = providerModel(provider, task.body);

    console.warn(
      "[ai-gate] emergency-openai-fallback",
      `source=${task.source}`,
      "reason=gemini-service-incident-and-groq-unavailable"
    );
    console.info("[ai-provider] request", `provider=${provider}`, `model=${model}`, `chars=${aiRequestChars(task.body)}`);

    try {
      const result = await callMessageProvider(provider, task.body);
      result.provider = provider;
      result.model = result.model || model;
      last = result;

      const status = result?.ok ? 200 : (result?.unavailable ? 0 : Number(result?.status || 0));
      const message = result?.ok ? "ok" : (result?.unavailable ? "not configured" : safeProviderMessage(result, "upstream error"));
      console.info("[ai-provider] response", `provider=${provider}`, `model=${model}`, `status=${status}`, `message=${message}`);

      if (result?.ok) {
        markProviderSuccess(provider);
        return result;
      }

      if (!result?.unavailable) {
        attempts.push({ provider, model, status, message });
        if ([401, 402, 403, 404, 408, 413, 429, 500, 502, 503, 504, 529].includes(status)) {
          markProviderFailure(provider, model, result);
        }
      }
    } catch (error) {
      const message = String(error?.message || error || "OpenAI emergency fallback failed");
      attempts.push({ provider, model, status: 502, message });
      last = { ok: false, status: 502, provider, model, payload: { error: { message } } };
      console.warn("[ai-gate] emergency-openai-fallback-failed", message.slice(0, 220));
    }
  }

  /* A player waiting gets the JSON-less answer rather than nothing, exactly as before; background work waits. */
  if (unusableAnswer && isForegroundRequest(task.body)) return unusableAnswer;

  const details = summarizeProviderFailures(attempts, task.requestedProvider, task.body);

  /* Every provider that answered refused or blocked it. Waiting would only repeat the same refusal. */
  if (attempts.length > 0 && attempts.every((item) => item.refused)) {
    console.warn("[ai-gate] content-refused", `source=${task.source}`, details.join(" | ").slice(0, 300));
    return {
      ok: false,
      status: 422,
      provider: last?.provider || attempts[attempts.length - 1].provider,
      model: last?.model || attempts[attempts.length - 1].model,
      payload: { error: { type: "content_refused", message: "Every provider that answered refused or blocked this request: " + details.join(" | "), providers: details } },
    };
  }
  if (last && attempts.length === 1 && ![401, 402, 403, 404, 408, 413, 429, 500, 502, 503, 504, 529].includes(Number(last?.status || 0))) return last;

  /* Background work found no free capacity: tell the caller to wait, never pay for it. */
  if (!isForegroundRequest(task.body) && !AI_ALLOW_PAID_BACKGROUND) {
    const seconds = backgroundWaitSeconds([...taskProviderOrder(task.requestedProvider, task.body).map(providerCooldownMs), ...waitHintsMs]);
    console.warn("[ai-gate] background-waiting", `source=${task.source}`, `retryAfter=${seconds}s`, "reason=no-free-provider-available");
    return buildWaitingResult({ retryAfterSeconds: seconds, details });
  }

  const retryWaits = taskProviderOrder(task.requestedProvider, task.body).map(providerCooldownMs).filter((ms) => ms > 0);
  const retryMs = retryWaits.length ? Math.min(...retryWaits) : 30000;
  return {
    ok: false,
    status: 503,
    provider: last?.provider || "server-gate",
    model: last?.model || "provider-failover",
    lastUpstreamStatus: Number(last?.status || 0) || 503,
    retryAfter: retryWaits.length ? String(Math.max(1, Math.ceil(retryMs / 1000))) : "",
    payload: {
      error: {
        message: details.length
          ? `No usable AI provider could complete the request (all providers are out of quota or busy) / Egyik AI-szolgáltató sem tudta teljesíteni a kérést. ${details.join(" | ")}`
          : "Egyik konfigurált AI-szolgáltató sem érhető el ehhez a kéréshez.",
        providers: details,
      },
    },
  };
}

/* CLAUDE FIX R39: the gate used to run ONE AI request at a time for the whole
   app, so a long sheet reading made everything else wait. Now up to
   AI_GATE_MAX_CONCURRENT requests run side by side (starts still spaced by
   AI_MIN_REQUEST_GAP_MS), highest priority first. */
const AI_GATE_MAX_CONCURRENT = Math.max(1, Math.min(6, Number(process.env.AI_GATE_MAX_CONCURRENT) || 3));

function pumpAIGate() {
  if (AI_GATE.active >= AI_GATE_MAX_CONCURRENT || !AI_GATE.queue.length) return;
  const now = Date.now();
  AI_GATE.queue.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
  const index = AI_GATE.queue.findIndex((t) => t.notBefore <= now);
  if (index < 0) {
    scheduleAIGate(Math.max(1, Math.min(...AI_GATE.queue.map((t) => t.notBefore)) - now));
    return;
  }
  const gap = Math.max(0, AI_MIN_REQUEST_GAP_MS - (now - AI_GATE.lastStartAt));
  if (gap > 0) { scheduleAIGate(gap); return; }

  const task = AI_GATE.queue.splice(index, 1)[0];
  AI_GATE.active += 1;
  AI_GATE.lastStartAt = Date.now();
  runAIGateTask(task);
  if (AI_GATE.queue.length && AI_GATE.active < AI_GATE_MAX_CONCURRENT) scheduleAIGate(AI_MIN_REQUEST_GAP_MS);
}

async function runAIGateTask(task) {
  try {
    const result = await executeAITask(task);
    if (isAutonomySource(task.source)) AI_GATE.lastAutonomyAt.set(task.worldKey, Date.now());
    AI_GATE.recentKeys.set(task.key, Date.now());
    task.resolve(result);
  } catch (err) {
    AI_GATE.lastError = String(err?.message || err || "AI gate error").slice(0, 240);
    task.reject(err);
  } finally {
    AI_GATE.pendingKeys.delete(task.key);
    AI_GATE.active = Math.max(0, AI_GATE.active - 1);
    const cutoff = Date.now() - 60000;
    for (const [key, at] of AI_GATE.recentKeys) if (at < cutoff) AI_GATE.recentKeys.delete(key);
    if (AI_GATE.queue.length) scheduleAIGate(0);
  }
}

function enqueueAIMessage(body, session) {
  const source = inferAIRequestSource(body);
  const priority = aiRequestPriority(body, source);
  const prepared = prepareAIRequestBody(body, priority, source);
  const worldKey = String(session?.worldCode || "anonymous");
  const clientId = String(body?.client_instance_id || body?.clientInstanceId || session?.accountId || "unknown");
  const eventId = requestEventId(prepared, source);

  if (source === "recovery-queue") return Promise.resolve(quietSkip("recovery-is-data-only"));
  if (source === "meaning-analysis" && (AI_GATE.active || AI_GATE.queue.length)) return Promise.resolve(quietSkip("meaning-analysis-yielded"));
  if (!leaderAllows(worldKey, clientId, source, priority)) return Promise.resolve(quietSkip("another-client-is-autonomy-leader"));

  const key = dedupeKey(prepared, source, eventId);
  const recent = Number(AI_GATE.recentKeys.get(key) || 0);
  const groupDuplicate = source === "group-chat" && (AI_GATE.pendingKeys.has(key) || (recent && Date.now() - recent < AI_GROUP_CHAT_DEDUPE_MS));
  const backgroundDuplicate = priority < 50 && (AI_GATE.pendingKeys.has(key) || (recent && Date.now() - recent < 30000));
  if (groupDuplicate || backgroundDuplicate) {
    console.info("[ai-dedupe] skip", `source=${source}`, `event=${eventId || key.slice(0, 24)}`, groupDuplicate ? "reason=duplicate-group-chat-event" : "reason=duplicate-background-request");
    return Promise.resolve(quietSkip(groupDuplicate ? "duplicate-group-chat-event" : "duplicate-background-request"));
  }

  aiMinuteTrace(source, prepared, eventId);

  return new Promise((resolve, reject) => {
    AI_GATE.pendingKeys.add(key);
    AI_GATE.queue.push({
      body: prepared,
      requestedProvider: getProvider(prepared),
      source, priority, key, eventId, resolve, reject, worldKey,
      seq: ++AI_GATE.seq,
      notBefore: autonomyNotBefore(worldKey, source),
    });
    pumpAIGate();
  });
}


/* -------------------------------------------------------------------------
   SEMANTIC CHARACTER MEMORY — v37

   Storage stays in PostgreSQL. Embeddings are generated with Gemini and are
   intentionally stored as JSONB for compatibility with the current Railway
   PostgreSQL image. Retrieval is performed server-side with cosine similarity.
   ------------------------------------------------------------------------- */
function memoryText(value, max = 7000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function memoryString(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function memorySubjects(value) {
  const rows = Array.isArray(value) ? value : [];

  return [
    ...new Set(
      rows
        .map((x) => memoryString(x, 120))
        .filter(Boolean)
    ),
  ].slice(0, 20);
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(min, n)
  );
}

function normalizeEmbedding(values) {
  const vector =
    Array.isArray(values)
      ? values
          .map(Number)
          .filter(
            (x) =>
              Number.isFinite(x)
          )
      : [];

  if (!vector.length) {
    return [];
  }

  // gemini-embedding-001 needs manual normalization when dimensions < 3072.
  if (
    GEMINI_EMBEDDING_MODEL ===
      "gemini-embedding-001" &&
    vector.length !== 3072
  ) {
    const norm =
      Math.sqrt(
        vector.reduce(
          (sum, x) =>
            sum + x * x,
          0
        )
      );

    if (norm > 0) {
      return vector.map(
        (x) =>
          x / norm
      );
    }
  }

  return vector;
}

function cosineSimilarity(a, b) {
  if (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    !a.length ||
    a.length !== b.length
  ) {
    return -1;
  }

  let dot = 0;
  let aa = 0;
  let bb = 0;

  for (
    let i = 0;
    i < a.length;
    i++
  ) {
    const x =
      Number(a[i]);

    const y =
      Number(b[i]);

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return -1;
    }

    dot += x * y;
    aa += x * x;
    bb += y * y;
  }

  if (!aa || !bb) {
    return -1;
  }

  return (
    dot /
    (
      Math.sqrt(aa) *
      Math.sqrt(bb)
    )
  );
}

/* Embeddings run on the FREE Gemini keys only (rotating, resting on quota). With none available
   the call fails with 503 + waiting, so memory writes wait and reads fall back to keywords. */
const MEMORY_EMBEDDER = createEmbedder({
  freeKeys: GEMINI_FREE_KEYS,
  paidKey: GEMINI_PAID_KEY,
  allowPaid: AI_ALLOW_PAID_BACKGROUND,
  fetchFn: (url, { timeoutMs, ...options }) => fetchWithTimeout(url, options, timeoutMs),
  model: GEMINI_EMBEDDING_MODEL,
  dimensions: GEMINI_EMBEDDING_DIM,
  normalize: normalizeEmbedding,
  restUntil: GEMINI_LEDGER.view(GEMINI_EMBEDDING_MODEL),
});

async function geminiEmbedMemory(
  text,
  taskType = "RETRIEVAL_DOCUMENT",
  title = ""
) {
  return MEMORY_EMBEDDER.embed(text, taskType, title);
}

function memoryRowForClient(
  row,
  score = null
) {
  return {
    id:
      Number(
        row.id
      ),
    characterId:
      row.character_id,
    subjectIds:
      Array.isArray(
        row.subject_ids
      )
        ? row.subject_ids
        : [],
    memoryType:
      row.memory_type,
    source:
      row.source ||
      "",
    text:
      row.memory_text,
    importance:
      Number(
        row.importance
      ) || 0,
    confidence:
      Number(
        row.confidence
      ) || 0,
    knowledgeType:
      row.knowledge_type,
    visibility:
      row.visibility,
    metadata:
      row.metadata &&
      typeof row.metadata ===
        "object"
        ? row.metadata
        : {},
    createdAt:
      row.created_at,
    embeddingModel:
      row.embedding_model ||
      "",
    ...(
      score === null
        ? {}
        : {
            score,
          }
    ),
  };
}

app.get(
  "/memory/health",
  async (req, res) => {
    try {
      if (
        !(await requireDb(res))
      ) {
        return;
      }

      const countResult =
        await pool.query(
          `
          SELECT COUNT(*)::int AS count
          FROM character_memories
          `
        );

      const result = {
        ok: true,
        version:
          "v37-semantic-memory-backend",
        database:
          true,
        table:
          "character_memories",
        rows:
          Number(
            countResult
              .rows?.[0]
              ?.count
          ) || 0,
        geminiConfigured:
          GEMINI_FREE_KEYS.length > 0,
        embeddingModel:
          GEMINI_EMBEDDING_MODEL,
        embeddingDimensions:
          GEMINI_EMBEDDING_DIM,
      };

      if (
        String(
          req.query?.probe ||
          ""
        ) === "1"
      ) {
        const vector =
          await geminiEmbedMemory(
            "Masvilag semantic memory health probe.",
            "RETRIEVAL_DOCUMENT",
            "Masvilag memory probe"
          );

        result.embeddingProbe = {
          ok: true,
          dimensions:
            vector.length,
          norm:
            Number(
              Math.sqrt(
                vector.reduce(
                  (
                    sum,
                    x
                  ) =>
                    sum +
                    x * x,
                  0
                )
              ).toFixed(
                6
              )
            ),
        };
      }

      return res.json(
        result
      );
    } catch (err) {
      console.error(
        "Memory health error:",
        err
      );

      return res
        .status(
          Number(
            err?.status
          ) || 500
        )
        .json({
          ok: false,
          error:
            err?.message ||
            "Memory health check failed.",
        });
    }
  }
);

app.post(
  "/memory/remember",
  async (req, res) => {
    try {
      if (
        !(await requireDb(res))
      ) {
        return;
      }

      const session =
        await getSession(
          req
        );

      if (!session) {
        clearSessionCookie(
          res
        );

        return res
          .status(401)
          .json({
            error:
              "Not authenticated.",
          });
      }

      const characterId =
        memoryString(
          req.body
            ?.characterId ||
          req.body
            ?.character_id,
          120
        );

      const text =
        memoryText(
          req.body?.text ||
          req.body
            ?.memoryText ||
          req.body
            ?.memory_text,
          7000
        );

      const memoryType =
        memoryString(
          req.body
            ?.memoryType ||
          req.body
            ?.memory_type ||
          "event",
          80
        );

      const source =
        memoryString(
          req.body
            ?.source ||
          "world",
          120
        );

      const knowledgeType =
        memoryString(
          req.body
            ?.knowledgeType ||
          req.body
            ?.knowledge_type ||
          "witnessed",
          80
        );

      const visibility =
        memoryString(
          req.body
            ?.visibility ||
          "private",
          80
        );

      const subjectIds =
        memorySubjects(
          req.body
            ?.subjectIds ||
          req.body
            ?.subject_ids
        );

      const importance =
        Math.round(
          clampNumber(
            req.body
              ?.importance,
            0,
            100,
            50
          )
        );

      const confidence =
        clampNumber(
          req.body
            ?.confidence,
          0,
          1,
          1
        );

      const metadata =
        req.body
          ?.metadata &&
        typeof req.body
          .metadata ===
          "object" &&
        !Array.isArray(
          req.body
            .metadata
        )
          ? req.body
              .metadata
          : {};

      if (
        !characterId ||
        !text
      ) {
        return res
          .status(400)
          .json({
            error:
              "characterId and text are required.",
          });
      }

      const title =
        `${memoryType} memory for ${characterId}`;

      const embedding =
        await geminiEmbedMemory(
          text,
          "RETRIEVAL_DOCUMENT",
          title
        );

      const inserted =
        await pool.query(
          `
          INSERT INTO character_memories (
            world_code,
            character_id,
            subject_ids,
            memory_type,
            source,
            memory_text,
            importance,
            confidence,
            knowledge_type,
            visibility,
            metadata,
            embedding,
            embedding_model
          )
          VALUES (
            $1,$2,$3::jsonb,$4,$5,$6,$7,
            $8,$9,$10,$11::jsonb,$12::jsonb,$13
          )
          RETURNING *
          `,
          [
            session.worldCode,
            characterId,
            JSON.stringify(
              subjectIds
            ),
            memoryType,
            source,
            text,
            importance,
            confidence,
            knowledgeType,
            visibility,
            JSON.stringify(
              metadata
            ),
            JSON.stringify(
              embedding
            ),
            GEMINI_EMBEDDING_MODEL,
          ]
        );

      return res.json({
        ok: true,
        memory:
          memoryRowForClient(
            inserted
              .rows[0]
          ),
        embeddingDimensions:
          embedding.length,
      });
    } catch (err) {
      console.error(
        "Memory remember error:",
        err
      );

      return res
        .status(
          Number(
            err?.status
          ) || 500
        )
        .json({
          error:
            err?.message ||
            "Failed to store semantic memory.",
        });
    }
  }
);

app.post(
  "/memory/search",
  async (req, res) => {
    try {
      if (
        !(await requireDb(res))
      ) {
        return;
      }

      const session =
        await getSession(
          req
        );

      if (!session) {
        clearSessionCookie(
          res
        );

        return res
          .status(401)
          .json({
            error:
              "Not authenticated.",
          });
      }

      const characterId =
        memoryString(
          req.body
            ?.characterId ||
          req.body
            ?.character_id,
          120
        );

      const query =
        memoryText(
          req.body
            ?.query ||
          req.body
            ?.text,
          5000
        );

      const topK =
        Math.round(
          clampNumber(
            req.body?.topK ||
            req.body?.top_k,
            1,
            12,
            6
          )
        );

      if (
        !characterId ||
        !query
      ) {
        return res
          .status(400)
          .json({
            error:
              "characterId and query are required.",
          });
      }

      const queryEmbedding =
        await geminiEmbedMemory(
          query,
          "RETRIEVAL_QUERY"
        );

      const candidates =
        await pool.query(
          `
          SELECT *
          FROM character_memories
          WHERE world_code = $1
            AND character_id = $2
            AND embedding IS NOT NULL
            AND embedding_model = $3
          ORDER BY
            importance DESC,
            created_at DESC
          LIMIT 600
          `,
          [
            session.worldCode,
            characterId,
            GEMINI_EMBEDDING_MODEL,
          ]
        );

      const now =
        Date.now();

      const scored = [];

      for (
        const row of
        candidates.rows
      ) {
        const vector =
          Array.isArray(
            row.embedding
          )
            ? row.embedding
            : [];

        if (
          vector.length !==
          queryEmbedding.length
        ) {
          continue;
        }

        const semantic =
          cosineSimilarity(
            queryEmbedding,
            vector
          );

        if (
          !Number.isFinite(
            semantic
          ) ||
          semantic < -0.5
        ) {
          continue;
        }

        const importance =
          clampNumber(
            row.importance,
            0,
            100,
            50
          ) / 100;

        const confidence =
          clampNumber(
            row.confidence,
            0,
            1,
            1
          );

        const ageDays =
          Math.max(
            0,
            (
              now -
              new Date(
                row.created_at
              ).getTime()
            ) /
            86400000
          );

        const recency =
          Math.exp(
            -ageDays /
            90
          );

        const finalScore =
          semantic *
            0.72 +
          importance *
            0.16 +
          confidence *
            0.07 +
          recency *
            0.05;

        scored.push({
          row,
          finalScore,
          semantic,
        });
      }

      scored.sort(
        (
          a,
          b
        ) =>
          b.finalScore -
          a.finalScore
      );

      return res.json({
        ok: true,
        characterId,
        query,
        embeddingModel:
          GEMINI_EMBEDDING_MODEL,
        results:
          scored
            .slice(
              0,
              topK
            )
            .map(
              ({
                row,
                finalScore,
                semantic,
              }) => ({
                ...memoryRowForClient(
                  row,
                  Number(
                    finalScore.toFixed(
                      6
                    )
                  )
                ),
                semanticScore:
                  Number(
                    semantic.toFixed(
                      6
                    )
                  ),
              })
            ),
      });
    } catch (err) {
      console.error(
        "Memory search error:",
        err
      );

      return res
        .status(
          Number(
            err?.status
          ) || 500
        )
        .json({
          error:
            err?.message ||
            "Semantic memory search failed.",
        });
    }
  }
);

/* What the providers used today, by provider and by kind of request (tokens as the provider reports them). */
app.get("/ai/usage", async (req, res) => {
  const session = await getSessionIdentity(req).catch(() => null);
  if (!session) return res.status(401).json({ error: "Not authenticated." });
  return res.json({ ok: true, paidInputCeilingChars: PAID_MAX_INPUT_CHARS, usage: AI_USAGE.snapshot() });
});

/* An hourly line with the day's paid usage, so it can be read in the log without asking for it. */
setInterval(() => {
  const snapshot = AI_USAGE.snapshot();
  const paid = Object.entries(snapshot.byProvider).filter(([name]) => PAID_INPUT_PROVIDERS.has(name));
  if (paid.length) console.info("[ai-usage-day]", snapshot.day, JSON.stringify(Object.fromEntries(paid.map(([name, row]) => [name, { calls: row.calls, in: row.promptTokens, out: row.completionTokens, cached: row.cachedTokens, reasoning: row.reasoningTokens, ...(row.cost ? { cost: Number(row.cost.toFixed(5)) } : {}) }]))));
}, 60 * 60 * 1000).unref?.();

app.get(
  "/ai/health",
  (req, res) => {
    return res.json({
      ok: true,
      version:
        "v37-semantic-memory-backend",
      routes: {
        messages:
          true,
        image:
          true,
        vision:
          true,
        memory:
          true,
      },
      providers: {
        anthropic:
          Boolean(
            ANTHROPIC_API_KEY
          ),
        gemini:
          Boolean(
            GEMINI_API_KEY
          ),
        openai:
          Boolean(
            OPENAI_API_KEY
          ),
      },
    });
  }
);

/* CLAUDE FIX R7 (4.3): one open copy of a world runs the background simulation.
   A tab that the player is actively using may take the lease from another tab
   or device of the SAME account; another player's live lease is respected. */
const SIM_LEADER_LEASE_MS = 40000;
const SIM_LEADER_BY_WORLD = new Map();

/* R76: short client-side diagnostics (why a generated comment did not reach the screen) into the server log. */
const CLIENT_DIAG_RATE = { minute: 0, count: 0 };
app.post("/client-diag", (req, res) => {
  const minute = Math.floor(Date.now() / 60000);
  if (CLIENT_DIAG_RATE.minute !== minute) { CLIENT_DIAG_RATE.minute = minute; CLIENT_DIAG_RATE.count = 0; }
  if (++CLIENT_DIAG_RATE.count <= 120) {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const fields = Object.entries(body).slice(0, 12).map(([key, value]) => String(key).replace(/[^\w-]/g, "").slice(0, 30) + "=" + JSON.stringify(String(value).slice(0, 160)));
    console.info("[client-diag]", fields.join(" "));
  }
  res.status(204).end();
});

app.post("/ai/leader", async (req, res) => {
  const session = await getSessionIdentity(req).catch(() => null);
  if (!session) return res.status(401).json({ leader: true, reason: "no-session" });
  const worldKey = String(session.worldCode || "anonymous");
  const accountId = String(session.accountId || "");
  const clientId = String(req.body?.clientId || "").slice(0, 80) || accountId || "unknown";
  const claim = req.body?.claim === true;
  const now = Date.now();
  const lease = SIM_LEADER_BY_WORLD.get(worldKey);
  const free = !lease || lease.expiresAt <= now;
  const mine = lease && lease.clientId === clientId;
  const sameAccountTakeover = claim && lease && lease.accountId === accountId;
  if (free || mine || sameAccountTakeover) {
    if (lease && !mine && !free) console.info("[sim-leader] takeover", `world=${worldKey}`);
    SIM_LEADER_BY_WORLD.set(worldKey, { clientId, accountId, expiresAt: now + SIM_LEADER_LEASE_MS });
    return res.json({ leader: true, holder: "this-tab" });
  }
  return res.json({ leader: false, holder: lease.accountId === accountId ? "your-other-tab-or-device" : "another-player" });
});

/* MÁSVILÁG AI TOKEN SAFETY v1 */
app.post(
  ["/ai/messages", "/ai/chat", "/ai/respond"],
  async (req, res) => {
    const session = await getSessionIdentity(req).catch(() => null);
    const requestedProvider = getProvider(req.body || {});
    try {
      const result = await enqueueAIMessage(req.body || {}, session);
      if (result?.ok) {
        res.setHeader("x-masvilag-ai-provider", result.provider || requestedProvider);
        if (result?.model) res.setHeader("x-masvilag-ai-model", String(result.model));
        return res.json(result.payload);
      }

      const upstreamStatus = Number(result?.status) || 503;
      if (result?.retryAfter) res.setHeader("retry-after", result.retryAfter);
      res.setHeader("x-masvilag-ai-provider", result?.provider || requestedProvider);
      if (result?.model) res.setHeader("x-masvilag-ai-model", String(result.model));
      res.setHeader("x-masvilag-ai-upstream-status", String(upstreamStatus));

      const source = inferAIRequestSource(req.body || {});
      const priority = aiRequestPriority(req.body || {}, source);
      const message = proxyErrorMessage(result?.payload, "No configured AI provider returned a usable response.");
      const actualProvider = String(result?.provider || requestedProvider || "unknown");
      const actualModel = String(result?.model || providerModel(actualProvider, req.body || {}) || "unknown");
      const logUpstreamStatus = Number(result?.lastUpstreamStatus || upstreamStatus);
      console.error("AI message unavailable:", source, `${actualProvider}/${actualModel}`, `upstream=${logUpstreamStatus}`, message);

      if (!result?.waiting && priority < 50 && [429, 503, 529].includes(upstreamStatus)) {
        return res.status(200).json({
          model: "masvilag-server-gate", type: "message", role: "assistant",
          content: [{ type: "text", text: JSON.stringify({ skip: true, reason: "background-provider-busy" }) }],
          usage: { input_tokens: 0, output_tokens: 0 },
        });
      }

      return res.status(upstreamStatus === 404 ? 502 : upstreamStatus).json(result?.payload || { error: { message } });
    } catch (err) {
      console.error("AI gate error:", err);
      return res.status(502).json({ error: { message: err?.message || "AI gate failed." } });
    }
  }
);


/* Semantic character memory: own sheet + important events, recalled by meaning. */
registerSemanticMemory(app, {
  pool,
  requireDb,
  getSession,
  clearSessionCookie,
  embedder: MEMORY_EMBEDDER,
  model: GEMINI_EMBEDDING_MODEL,
});

// Serve the built React/Vite app in production.
// v31: never let an old frontend bundle survive a deploy in browser/proxy cache.
app.use(
  (req, res, next) => {
    if (
      req.method ===
      "GET"
    ) {
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
      );

      res.setHeader(
        "Pragma",
        "no-cache"
      );

      res.setHeader(
        "Expires",
        "0"
      );

      res.setHeader(
        "Surrogate-Control",
        "no-store"
      );
    }

    next();
  }
);

app.use(
  express.static(
    "dist",
    {
      etag: false,
      maxAge: 0,
      setHeaders(res) {
        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, max-age=0"
        );
      },
    }
  )
);

app.use(
  (req, res, next) => {
    if (
      req.method ===
        "GET" &&
      !req.path.startsWith(
        "/ai/"
      )
    ) {
      return res.sendFile(
        "index.html",
        {
          root:
            "dist",
        }
      );
    }

    next();
  }
);

app.listen(
  PORT,
  () =>
    console.log(
      `App + AI proxy listening on port ${PORT}`
    )
);
