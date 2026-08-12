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

      CREATE INDEX IF NOT EXISTS profile_worlds_world_idx
      ON profile_worlds (world_code);

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
  const clean =
    JSON.parse(
      JSON.stringify(
        world || {}
      )
    );

  clean.syncRev =
    worldSyncRevServer(clean);

  for (
    const account of
    Object.values(
      clean.accounts || {}
    )
  ) {
    if (!account) continue;

    delete account.hash;
    delete account.salt;
    delete account.password;
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
   WORLD CODE PEEK
   Public, intentionally returns NO usernames/account data.
   ------------------------------------------------------------------------- */
app.get("/world/peek", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const code =
      cleanCode(req.query?.code);

    if (!code) {
      return res.status(400).json({
        error: "World code is required.",
      });
    }

    const result =
      await pool.query(
        `
        SELECT
          code,
          data->'universe'->>'name' AS name
        FROM worlds
        WHERE code = $1
        LIMIT 1
        `,
        [code]
      );

    if (!result.rows.length) {
      return res.json({
        ok: true,
        found: false,
        code,
      });
    }

    return res.json({
      ok: true,
      found: true,
      code,
      name:
        result.rows[0].name ||
        code,
    });
  } catch (err) {
    console.error(
      "World peek error:",
      err
    );

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
          JSON.stringify(world),
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
      `      UPDATE worlds
      SET data = $2::jsonb,
          updated_at = NOW()
      WHERE code = $1
      `,
      [code, JSON.stringify(world)]
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

    const session =
      await getSession(req);

    if (!session) {
      clearSessionCookie(res);

      return res.status(401).json({
        authenticated: false,
      });
    }

    const account =
      session.world?.accounts?.[
        session.accountId
      ];

    if (!account) {
      if (session.token) {
        await pool.query(
          `
          DELETE FROM sessions
          WHERE token_hash = $1
          `,
          [
            sessionTokenHash(
              session.token
            ),
          ]
        );
      }

      clearSessionCookie(res);

      return res.status(401).json({
        authenticated: false,
      });
    }

    return res.json({
      authenticated: true,
      meId:
        session.accountId,
      profileUsername:
        cleanUsername(account.username),
      syncRev:
        worldSyncRevServer(
          session.world
        ),
      world:
        safeWorldForClient(
          session.world
        ),
    });
  } catch (err) {
    console.error(
      "Session restore error:",
      err
    );

    return res.status(500).json({
      error:
        "Session restore failed.",
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

/* -------------------------------------------------------------------------
   ACCOUNT DELETE
   Serialized against world saves. Deletion increments syncRev.
   ------------------------------------------------------------------------- */
app.post("/account/delete", async (req, res) => {
  let client = null;

  try {
    if (!(await requireDb(res))) return;

    const session =
      await getSession(req);

    if (!session) {
      clearSessionCookie(res);

      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const worldCode =
      session.worldCode;

    const accountId =
      session.accountId;

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
        [worldCode]
      );

    if (!result.rows.length) {
      await client.query(
        "ROLLBACK"
      );

      client.release();
      client = null;

      clearSessionCookie(res);

      return res.status(404).json({
        error: "World not found.",
      });
    }

    const world =
      result.rows[0].data;

    world.syncRev =
      worldSyncRevServer(world);

    if (
      !world.accounts ||
      !world.accounts[accountId]
    ) {
      await client.query(
        `
        DELETE FROM sessions
        WHERE world_code = $1
          AND account_id = $2
        `,
        [worldCode, accountId]
      );

      await client.query("COMMIT");
      client.release();
      client = null;

      clearSessionCookie(res);

      return res.json({
        ok: true,
        alreadyDeleted: true,
      });
    }

    if (!world.deleted) {
      world.deleted = {};
    }

    world.deleted[accountId] =
      Date.now();

    if (world.accounts) {
      delete world.accounts[
        accountId
      ];
    }

    if (world.players) {
      delete world.players[
        accountId
      ];
    }

    if (world.userSettings) {
      delete world.userSettings[
        accountId
      ];
    }

    if (world.notify) {
      delete world.notify[
        accountId
      ];
    }

    if (world.mems) {
      delete world.mems[
        accountId
      ];
    }

    if (world.charMemory) {
      delete world.charMemory[
        accountId
      ];
    }

    if (
      world.owner ===
      accountId
    ) {
      world.owner =
        Object.keys(
          world.accounts || {}
        )[0] || "";
    }

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
        worldCode,
        JSON.stringify(world),
      ]
    );

    const profileUsername =
      cleanUsername(
        session.world &&
        session.world.accounts &&
        session.world.accounts[accountId] &&
        session.world.accounts[accountId].username
      );

    if (profileUsername) {
      await client.query(
        `
        DELETE FROM profile_worlds
        WHERE profile_username = $1
          AND world_code = $2
        `,
        [profileUsername, worldCode]
      );
    }

    await client.query(
      `
      DELETE FROM sessions
      WHERE world_code = $1
        AND account_id = $2
      `,
      [worldCode, accountId]
    );

    await client.query("COMMIT");
    client.release();
    client = null;

    clearSessionCookie(res);

    console.log(
      `Deleted account ${accountId} from world ${worldCode}`
    );

    return res.json({
      ok: true,
      deleted: true,
      syncRev:
        worldSyncRevServer(world),
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
      "Account delete error:",
      err
    );

    return res.status(500).json({
      error:
        "Account deletion failed.",
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

    try {
      await pool.query(
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
          JSON.stringify(world),
        ]
      );
    } catch (err) {
      /* PostgreSQL unique_violation: another creator won the race. */
      if (
        err &&
        err.code === "23505"
      ) {
        return res.status(409).json({
          code:
            "WORLD_ALREADY_EXISTS",
          error:
            "World already exists on the server.",
        });
      }

      throw err;
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
      return res.status(401).json({ error: "Not authenticated." });
    }

    const profile = await currentProfileForSession(session);

    if (!profile) {
      return res.status(404).json({ error: "Global profile not found." });
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
    return res.status(500).json({ error: "Failed to load profile worlds." });
  }
});

app.post("/profile/worlds/switch", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const session = await getSession(req);

    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Not authenticated." });
    }

    const profile = await currentProfileForSession(session);
    const code = cleanCode(req.body?.code);

    if (!profile || !code) {
      return res.status(400).json({ error: "Missing profile or world code." });
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
    return res.status(500).json({ error: "World switch failed." });
  }
});

app.post("/profile/worlds/create", async (req, res) => {
  let client = null;

  try {
    if (!(await requireDb(res))) return;

    const session = await getSession(req);

    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Not authenticated." });
    }

    const profile = await currentProfileForSession(session);
    const incomingWorld = req.body?.world;

    if (
      !profile ||
      !incomingWorld ||
      typeof incomingWorld !== "object"
    ) {
      return res.status(400).json({ error: "Missing world data." });
    }

    const world = JSON.parse(JSON.stringify(incomingWorld));
    const code = cleanCode(world.code);
        if (!code) {
      return res.status(400).json({ error: "World code is required." });
    }

    world.code = code;

    const candidateIds = Object.keys(world.accounts || {});
    let accountId = world.owner && world.accounts?.[world.owner]
      ? String(world.owner)
      : candidateIds.find((id) =>
          cleanUsername(world.accounts?.[id]?.username) === profile.username
        );

    if (!accountId) {
      accountId = `u${crypto.randomBytes(10).toString("hex")}`;
      if (!world.accounts) world.accounts = {};
      if (!world.players) world.players = {};
      world.accounts[accountId] = {
        id: accountId,
        username: profile.username,
        created: Date.now(),
      };
      world.players[accountId] = {
        id: accountId,
        name: String(req.body?.characterName || profile.username).slice(0, 120),
        username: cleanUsername(req.body?.characterUsername) || profile.username,
      };
    }

    if (!world.accounts) world.accounts = {};
    if (!world.players) world.players = {};

    const account = world.accounts[accountId] || {};
    account.id = accountId;
    account.username = profile.username;
    account.salt = profile.salt;
    account.hash = profile.hash;
    account.created = Number(account.created) || Date.now();
    world.accounts[accountId] = account;

    const player = world.players[accountId] || { id: accountId };
    player.id = accountId;

    if (req.body?.characterName) {
      player.name = String(req.body.characterName).trim().slice(0, 120);
    }

    const requestedHandle = cleanUsername(req.body?.characterUsername);
    if (requestedHandle) {
      player.username = requestedHandle;
    } else if (!player.username) {
      player.username = profile.username;
    }

    world.players[accountId] = player;
    world.owner = accountId;
    world.rev = Number(world.rev || 0) + 1;
    world.syncRev = 1;

    if (world.universe) {
      world.universe.at = Date.now();
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const exists = await client.query(
      `SELECT 1 FROM worlds WHERE code = $1 LIMIT 1`,
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
      INSERT INTO worlds (code, data, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      `,
      [code, JSON.stringify(world)]
    );

    await linkProfileWorld(client, profile.username, code, accountId);

    await client.query("COMMIT");
    client.release();
    client = null;

    const token = await createSession(code, accountId);
    setSessionCookie(res, token);

    return res.json({
      ok: true,
      created: true,
      meId: accountId,
      profileUsername: profile.username,
      syncRev: 1,
      world: safeWorldForClient(world),
    });
  } catch (err) {
    if (client) {
      try { await client.query("ROLLBACK"); } catch (e) {}
      client.release();
      client = null;
    }

    console.error("Profile world create error:", err);
    return res.status(500).json({ error: "World creation failed." });
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

    const session =
      await getSession(req);

    if (!session) {
      clearSessionCookie(res);

      return res.status(401).json({
        error: "Not authenticated.",
      });
    }

    const incomingWorld =
      req.body?.world;

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

    const incomingCode =
      cleanCode(
        incomingWorld.code
      );

    if (
      incomingCode !==
      session.worldCode
    ) {
      return res.status(403).json({
        error:
          "You cannot save another world.",
      });
    }

    const expectedSyncRev =
      Math.max(
        0,
        Math.floor(
          Number(
            req.body?.syncRev ??
            incomingWorld.syncRev
          ) || 0
        )
      );

    client =
      await pool.connect();

    await client.query("BEGIN");

    const existingResult =
      await client.query(
        `
        SELECT data
        FROM worlds
        WHERE code = $1
        LIMIT 1
        FOR UPDATE
        `,
        [session.worldCode]
      );

    if (!existingResult.rows.length) {
      await client.query(
        "ROLLBACK"
      );

      client.release();
      client = null;

      return res.status(404).json({
        error: "World not found.",
      });
    }

    const existingWorld =
      existingResult.rows[0].data;

    const serverSyncRev =
      worldSyncRevServer(
        existingWorld
      );

    if (
      expectedSyncRev !==
      serverSyncRev
    ) {
      await client.query(
        "ROLLBACK"
      );

      client.release();
      client = null;

      return res.status(409).json({
        code: "WORLD_CONFLICT",
        error:
          "The world changed on another client.",
        meId:
          session.accountId,
        expectedSyncRev,
        serverSyncRev,
        world:
          safeWorldForClient(
            existingWorld
          ),
      });
    }

    const nextWorld =
      JSON.parse(
        JSON.stringify(
          incomingWorld
        )
      );

    /*
     * The client never receives password hashes/salts.
     * Restore every server-secret field from the locked authoritative row.
     */
    if (!nextWorld.accounts) {
      nextWorld.accounts = {};
    }

    for (
      const [
        accountId,
        oldAccount,
      ] of Object.entries(
        existingWorld.accounts || {}
      )
    ) {
      const wasDeleted =
        Boolean(
          nextWorld.deleted &&
          nextWorld.deleted[
            accountId
          ]
        );

      if (
        wasDeleted &&
        !nextWorld.accounts[
          accountId
        ]
      ) {
        continue;
      }

      if (
        !nextWorld.accounts[
          accountId
        ]
      ) {
        nextWorld.accounts[
          accountId
        ] =
          JSON.parse(
            JSON.stringify(
              oldAccount
            )
          );
      }

      if (oldAccount?.hash) {
        nextWorld.accounts[
          accountId
        ].hash =
          oldAccount.hash;
      }

      if (oldAccount?.salt) {
        nextWorld.accounts[
          accountId
        ].salt =
          oldAccount.salt;
      }
    }

    nextWorld.code =
      session.worldCode;

    nextWorld.rev =
      Math.max(
        Number(
          nextWorld.rev || 0
        ),
        Number(
          existingWorld.rev || 0
        )
      ) + 1;

    nextWorld.syncRev =
      serverSyncRev + 1;

    if (nextWorld.universe) {
      nextWorld.universe.at =
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
        session.worldCode,
        JSON.stringify(
          nextWorld
        ),
      ]
    );

    await client.query("COMMIT");
    client.release();
    client = null;

    return res.json({
      ok: true,
      meId:
        session.accountId,
      syncRev:
        nextWorld.syncRev,
      world:
        safeWorldForClient(
          nextWorld
        ),
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
      "World save error:",
      err
    );

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
  const origin = String(req.headers.origin || "").trim();
  const configured = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const allowOrigin =
    origin &&
    (!configured.length || configured.includes(origin));

  if (allowOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* -------------------------------------------------------------------------
   CLOUD MEDIA LOAD
   Backward-compatible with old raw world_media.data rows.
   ------------------------------------------------------------------------- */
app.get("/media/load", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const session =
      await getSession(req);

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
      await getSession(req);

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
        media:
          current.media,
      });
    }

    const nextSyncRev =
      current.syncRev + 1;

    const envelope =
      makeMediaEnvelope(
        media,
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
        JSON.stringify(envelope),
      ]
    );

    await client.query("COMMIT");
    client.release();
    client = null;

    return res.json({
      ok: true,
      syncRev:
        nextSyncRev,
      media,
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
  const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);

  if (!match) return null;

  return {
    mimeType: match[1].toLowerCase(),
    base64: match[2].replace(/\s+/g, ""),
    dataUrl: raw,
  };
}

function visionTextFromAnthropic(data) {
  return Array.isArray(data?.content)
    ? data.content.map((x) => x?.type === "text" ? x.text || "" : "").join("")
    : "";
}

app.post("/ai/vision", async (req, res) => {
  try {
    if (!(await requireDb(res))) return;

    const session = await getSession(req);
    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Not authenticated." });
    }

    const image = await resolveInputImage(req.body?.image);
    const prompt = String(
      req.body?.prompt ||
      "Describe what is visibly happening in this image in 1-3 concise sentences. Mention people, clothing, activity, location and mood only when actually visible. Do not identify real people by name."
    ).slice(0, 5000);

    if (!image) {
      return res.status(400).json({ error: "A valid base64 data URL or public HTTPS image URL is required." });
    }

    if (image.base64.length > 12 * 1024 * 1024) {
      return res.status(413).json({ error: "Image is too large for vision analysis." });
    }

    const provider = getProvider(req.body || {});

    if (provider === "openai") {
      if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: "Missing OPENAI_API_KEY." });
      }

      const requested = String(req.body?.model || "");
      const model = /^(gpt|o1|o3)/i.test(requested)
        ? requested
        : (process.env.OPENAI_VISION_MODEL || "gpt-4o-mini");

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 350,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: image.dataUrl } },
            ],
          }],
        }),
      });

      const payload = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(r.status).json(payload);

      return res.json({
        ok: true,
        text: payload?.choices?.[0]?.message?.content || "",
        provider: "openai",
      });
    }

    if (provider === "gemini") {
      if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "Missing GEMINI_API_KEY." });
      }

      const requested = String(req.body?.model || "");
      const model = requested.startsWith("gemini")
        ? requested
        : (process.env.GEMINI_VISION_MODEL || "gemini-3.5-flash");

      const url = new URL(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
      );
      url.searchParams.set("key", GEMINI_API_KEY);

      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: image.mimeType, data: image.base64 } },
            ],
          }],
          generationConfig: { maxOutputTokens: 350 },
        }),
      });

      const payload = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(r.status).json(payload);

      const text = payload?.candidates?.[0]?.content?.parts
        ?.map((p) => p?.text || "")
        .join("") || "";

      return res.json({ ok: true, text, provider: "gemini" });
    }

    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "Missing ANTHROPIC_API_KEY." });
    }

    const requested = String(req.body?.model || "");
    const model = requested.startsWith("claude")
      ? requested
      : (process.env.ANTHROPIC_VISION_MODEL || "claude-sonnet-4-6");

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": process.env.ANTHROPIC_VERSION || "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 350,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image.mimeType,
                data: image.base64,
              },
            },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    const payload = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json(payload);

    return res.json({
      ok: true,
      text: visionTextFromAnthropic(payload),
      provider: "anthropic",
    });
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

async function fetchWithTimeout(url, options = {}, timeoutMs = AI_UPSTREAM_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function responseJsonSafe(r) {
  const raw = await r.text();
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { return { error: { message: raw } }; }
}

function proxyErrorMessage(payload, fallback = "AI provider error") {
  return String(
    payload?.error?.message ||
    payload?.error ||
    payload?.message ||
    fallback
  );
}

function retryableProviderStatus(status) {
  return [408, 409, 425, 429, 500, 502, 503, 504, 529].includes(Number(status));
}

function imagePromptFromBody(body = {}) {
  return String(body.prompt || body.input || body.text || "").trim().slice(0, 12000);
}

function isPrivateAddress(address) {
  const value = String(address || "").toLowerCase();
  if (!value) return true;

  if (net.isIP(value) === 4) {
    const p = value.split(".").map(Number);
    if (p[0] === 10 || p[0] === 127 || p[0] === 0) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] >= 224) return true;
    return false;
  }

  if (net.isIP(value) === 6) {
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

async function assertPublicHttpsUrl(rawUrl) {
  const url = new URL(String(rawUrl || "").trim());
  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS image references are allowed.");
  }

  const host = String(url.hostname || "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("Local image reference is not allowed.");
  }

  if (net.isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new Error("Private-network image reference is not allowed.");
    }
  } else {
    const resolved = await dns.lookup(host, { all: true });
    if (!resolved.length || resolved.some((row) => isPrivateAddress(row.address))) {
      throw new Error("Image reference resolved to a private network.");
    }
  }

  return url;
}

async function fetchRemoteImageReference(rawUrl, redirectsLeft = 3) {
  const url = await assertPublicHttpsUrl(rawUrl);

  const r = await fetchWithTimeout(
    url,
    {
      method: "GET",
      redirect: "manual",
      headers: {
        "Accept": "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.7",
        "User-Agent": "MasvilagImageReference/1.0",
      },
    },
    20000
  );

  if ([301, 302, 303, 307, 308].includes(r.status)) {
    if (redirectsLeft <= 0) throw new Error("Too many image-reference redirects.");
    const location = r.headers.get("location");
    if (!location) throw new Error("Image-reference redirect has no location.");
    const next = new URL(location, url);
    return fetchRemoteImageReference(next.toString(), redirectsLeft - 1);
  }

  if (!r.ok) {
    throw new Error(`Reference image fetch failed with HTTP ${r.status}.`);
  }

  const mimeType = String(r.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(mimeType)) {
    throw new Error(`Unsupported reference image type: ${mimeType || "unknown"}.`);
  }

  const announced = Number(r.headers.get("content-length") || 0);
  if (announced && announced > 12 * 1024 * 1024) {
    throw new Error("Reference image is too large.");
  }

  const buffer = Buffer.from(await r.arrayBuffer());
  if (!buffer.length || buffer.length > 12 * 1024 * 1024) {
    throw new Error("Reference image is empty or too large.");
  }

  return {
    mimeType: mimeType === "image/jpg" ? "image/jpeg" : mimeType,
    base64: buffer.toString("base64"),
    dataUrl: `data:${mimeType === "image/jpg" ? "image/jpeg" : mimeType};base64,${buffer.toString("base64")}`,
    source: "remote",
  };
}

async function resolveInputImage(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const inline = parseImageDataUrl(raw);
  if (inline) return { ...inline, source: "inline" };

  if (/^https:\/\//i.test(raw)) {
    return fetchRemoteImageReference(raw);
  }

  return null;
}

async function imageReferencesFromBody(body = {}, limit = 3) {
  const raw = Array.isArray(body.referenceImages)
    ? body.referenceImages
    : (Array.isArray(body.reference_images) ? body.reference_images : []);

  const refs = [];
  const seen = new Set();

  for (const value of raw) {
    if (refs.length >= limit) break;
    const key = String(value || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);

    try {
      const parsed = await resolveInputImage(key);
      if (!parsed) continue;
      if (parsed.base64.length > 16 * 1024 * 1024) continue;
      refs.push(parsed);
    } catch (err) {
      console.warn(
        "Skipping unusable image reference:",
        key.slice(0, 120),
        err?.message || err
      );
    }
  }

  return refs;
}

function multipartTextPart(boundary, name, value) {
    return Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
    `${String(value)}\r\n`,
    "utf8"
  );
}

function multipartImagePart(boundary, name, image, index) {
  const ext = image.mimeType === "image/png"
    ? "png"
    : image.mimeType === "image/webp"
      ? "webp"
      : "jpg";

  const head = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${name}"; filename="reference-${index + 1}.${ext}"\r\n` +
    `Content-Type: ${image.mimeType}\r\n\r\n`,
    "utf8"
  );

  const data = Buffer.from(image.base64, "base64");
  return Buffer.concat([head, data, Buffer.from("\r\n", "utf8")]);
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
  const boundary = `----masvilag-${crypto.randomBytes(18).toString("hex")}`;
  const chunks = [
    multipartTextPart(boundary, "model", model),
    multipartTextPart(boundary, "prompt", prompt),
    multipartTextPart(boundary, "size", size),
    multipartTextPart(boundary, "quality", quality),
    multipartTextPart(boundary, "output_format", outputFormat),
    multipartTextPart(boundary, "background", background),
    multipartTextPart(boundary, "moderation", moderation),
  ];

  /*
   * OpenAI Image Edit accepts multiple input images as image[].
   * For GPT Image 2 these references act as high-fidelity identity inputs.
   */
  references.forEach((image, index) => {
    chunks.push(
      multipartImagePart(boundary, "image[]", image, index)
    );
  });

  chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));

  return {
    boundary,
    body: Buffer.concat(chunks),
  };
}

app.post(["/ai/image", "/ai/images", "/ai/generate-image"], async (req, res) => {
  try {
    if (!(await requireDb(res))) return;
    const session = await getSession(req);
    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({ error: "Not authenticated." });
    }
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY." });
    }

    const prompt = imagePromptFromBody(req.body || {});
    if (!prompt) return res.status(400).json({ error: "Missing image prompt." });

    const model = String(req.body?.model || process.env.OPENAI_IMAGE_MODEL || "gpt-image-2");
    const size = String(req.body?.size || req.body?.image_size || process.env.OPENAI_IMAGE_SIZE || "1024x1024");
    const quality = String(req.body?.quality || process.env.OPENAI_IMAGE_QUALITY || "medium");
    const outputFormat = String(req.body?.output_format || process.env.OPENAI_IMAGE_FORMAT || "jpeg");
    const background = String(req.body?.background || "auto");
    const moderation = String(req.body?.moderation || "auto");
    const references = await imageReferencesFromBody(req.body || {}, 3);

    if (req.body?.require_reference && !references.length) {
      return res.status(422).json({
        error: "Character reference images were supplied, but none could be loaded. Refusing prompt-only generation because identity would be unreliable.",
      });
    }

    let endpoint = "https://api.openai.com/v1/images/generations";
    let options;

    if (references.length) {
      /*
       * CRITICAL IDENTITY FIX:
       * Generations cannot actually consume our profile/album reference images.
       * When references exist, use the Image Edit endpoint and send them as
       * multipart image[] inputs so the model can preserve the character face.
       */
      endpoint = "https://api.openai.com/v1/images/edits";
      const multipart = buildImageEditMultipart({
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
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${multipart.boundary}`,
          "Content-Length": String(multipart.body.length),
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: multipart.body,
      };
    } else {
      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          size,
          quality,
          output_format: outputFormat,
          background,
          moderation,
        }),
      };
    }

    const r = await fetchWithTimeout(
      endpoint,
      options,
      Math.max(AI_UPSTREAM_TIMEOUT_MS, references.length ? 120000 : 90000)
    );

    const payload = await responseJsonSafe(r);
    if (!r.ok) {
      if (r.headers.get("retry-after")) res.setHeader("retry-after", r.headers.get("retry-after"));
      console.error(
        "OpenAI image upstream error:",
        r.status,
        references.length ? "edit-reference" : "generation",
        proxyErrorMessage(payload, "Image request failed")
      );
      return res.status(r.status).json(payload);
    }

    const first = Array.isArray(payload?.data) ? payload.data[0] : null;
    const b64 = String(first?.b64_json || payload?.b64_json || "").trim();
    const url = String(first?.url || first?.image_url || payload?.url || "").trim();

    if (!b64 && !url) {
      return res.status(502).json({
        error: "OpenAI image generation returned no image payload."
      });
    }

    const mime = outputFormat === "png"
      ? "image/png"
      : outputFormat === "webp"
        ? "image/webp"
        : "image/jpeg";

    const dataUrl = b64
      ? `data:${mime};base64,${b64}`
      : "";

    return res.json({
      ok: true,
      provider: "openai",
      model,
      mode: references.length ? "edit-reference" : "generation",
      referenceCount: references.length,
      data: b64
        ? [{
            b64_json: b64,
            revised_prompt: first?.revised_prompt || "",
          }]
        : [],
      b64_json: b64,
      dataUrl,
      image: dataUrl || url,
      url,
      revised_prompt: first?.revised_prompt || "",
    });
  } catch (err) {
    console.error("Image generation proxy error:", err);

    const timeout =
      err?.name === "AbortError";

    return res
      .status(timeout ? 504 : 502)
      .json({
        error:
          timeout
            ? "Image generation timed out."
            : (err?.message || "Image generation failed."),
      });
  }
});

async function proxyOpenAIMessage(body) {
  if (!OPENAI_API_KEY) {
    return {
      unavailable: true,
      provider: "openai",
    };
  }

  const r = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(buildOpenAIPayload(body)),
    }
  );

  const payload = await responseJsonSafe(r);

  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      payload,
      retryAfter: r.headers.get("retry-after"),
      provider: "openai",
    };
  }

  const normalized =
    normalizeOpenAIResponse(payload);

  const hasText =
    Array.isArray(normalized?.content) &&
    normalized.content.some(
      (x) => String(x?.text || "").trim()
    );

  return hasText
    ? {
        ok: true,
        payload: normalized,
        provider: "openai",
      }
    : {
        ok: false,
        status: 502,
        payload: {
          error: {
            message: "OpenAI returned empty content.",
          },
        },
        provider: "openai",
      };
}

async function proxyGeminiMessage(body) {
  if (!GEMINI_API_KEY) {
    return {
      unavailable: true,
      provider: "gemini",
    };
  }

  const requested =
    String(body?.model || "");

  const modelsToTry =
    [...new Set([
      requested.startsWith("gemini")
        ? requested
        : "",
      process.env.GEMINI_MODEL || "",
      process.env.GEMINI_FALLBACK_MODEL ||
        "gemini-3.5-flash",
    ].filter(Boolean))];

  let last = null;

  for (const model of modelsToTry) {
    const url =
      new URL(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
      );

    url.searchParams.set(
      "key",
      GEMINI_API_KEY
    );

    for (
      let attempt = 1;
      attempt <= 2;
      attempt++
    ) {
      const r =
        await fetchWithTimeout(
          url,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body:
              JSON.stringify(
                buildGeminiPayload({
                  ...body,
                  model,
                })
              ),
          }
        );

      const payload =
        await responseJsonSafe(r);

      if (r.ok) {
        const normalized =
          normalizeGeminiResponse(payload);

        const hasText =
          Array.isArray(normalized?.content) &&
          normalized.content.some(
            (x) =>
              String(x?.text || "").trim()
          );

        if (hasText) {
          return {
            ok: true,
            payload: normalized,
            provider: "gemini",
          };
        }

        last = {
          ok: false,
          status: 502,
          payload: {
            error: {
              message: "Gemini returned empty content.",
            },
          },
          provider: "gemini",
        };

        break;
      }

      last = {
        ok: false,
        status: r.status,
        payload,
        retryAfter: r.headers.get("retry-after"),
        provider: "gemini",
      };

      if (
        !retryableProviderStatus(r.status) ||
        attempt >= 2
      ) {
        break;
      }

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            700 * attempt
          )
      );
    }
  }

  return last || {
    unavailable: true,
    provider: "gemini",
  };
}

async function proxyAnthropicMessage(body) {
  if (!ANTHROPIC_API_KEY) {
    return {
      unavailable: true,
      provider: "anthropic",
    };
  }

  const requestedModel =
    String(body?.model || "");

  const modelsToTry =
    [...new Set([
      requestedModel.startsWith("claude")
        ? requestedModel
        : "",
      process.env.ANTHROPIC_MODEL || "",
      process.env.ANTHROPIC_FALLBACK_MODEL || "",
    ].filter(Boolean))];

  if (!modelsToTry.length) {
    modelsToTry.push(
      requestedModel ||
      "claude-sonnet-4-6"
    );
  }

  let last = null;

  for (const model of modelsToTry) {
    const {
      provider,
      ...rest
    } = body || {};

    const outboundBody = {
      ...rest,
      model,
      max_tokens:
        body?.max_tokens ?? 1024,
    };

    for (
      let attempt = 1;
      attempt <= 2;
      attempt++
    ) {
      const r =
        await fetchWithTimeout(
          "https://api.anthropic.com/v1/messages",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": ANTHROPIC_API_KEY,
              "anthropic-version":
                process.env.ANTHROPIC_VERSION ||
                "2023-06-01",
              "Accept": "application/json",
            },
            body:
              JSON.stringify(outboundBody),
          }
        );

      const payload =
        await responseJsonSafe(r);

      if (r.ok) {
        const hasText =
          Array.isArray(payload?.content) &&
          payload.content.some(
            (x) =>
              x?.type === "text" &&
              String(x?.text || "").trim()
          );

        if (hasText) {
          return {
            ok: true,
            payload,
            provider: "anthropic",
          };
        }

        last = {
          ok: false,
          status: 502,
          payload: {
            error: {
              message: "Anthropic returned empty content.",
            },
          },
          provider: "anthropic",
        };

        break;
      }

      last = {
        ok: false,
        status: r.status,
        payload,
        retryAfter: r.headers.get("retry-after"),
        provider: "anthropic",
      };

      if (
        !retryableProviderStatus(r.status) ||
        attempt >= 2
      ) {
        break;
      }

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            700 * attempt
          )
      );
    }
  }

  return last || {
    unavailable: true,
    provider: "anthropic",
  };
}

async function callMessageProvider(provider, body) {
  if (provider === "openai") {
    return proxyOpenAIMessage(body);
  }

  if (provider === "gemini") {
    return proxyGeminiMessage(body);
  }

  return proxyAnthropicMessage(body);
}

app.get("/ai/health", (req, res) => {
  return res.json({
    ok: true,
    version: "v35-production-api-reference-selfies",
    routes: {
      messages: true,
      image: true,
      vision: true,
    },
    providers: {
      anthropic: Boolean(ANTHROPIC_API_KEY),
      gemini: Boolean(GEMINI_API_KEY),
      openai: Boolean(OPENAI_API_KEY),
    },
  });
});

app.post(
  ["/ai/messages", "/ai/chat", "/ai/respond"],
  async (req, res) => {
    const requestedProvider =
      getProvider(req.body || {});

    const configuredFallbacks =
      ["anthropic", "openai", "gemini"]
        .filter(
          (p) => p !== requestedProvider
        )
        .filter(
          (p) =>
            p === "anthropic"
              ? ANTHROPIC_API_KEY
              : p === "openai"
                ? OPENAI_API_KEY
                : GEMINI_API_KEY
        );

    const providers = [
      requestedProvider,
      ...configuredFallbacks,
    ];

    let last = null;

    for (const provider of providers) {
      try {
        const result =
          await callMessageProvider(
            provider,
            req.body || {}
          );

        if (result?.ok) {
          res.setHeader(
            "x-masvilag-ai-provider",
            result.provider || provider
          );

          return res.json(
            result.payload
          );
        }

        if (result?.unavailable) {
          continue;
        }

        last = result;

        if (
          !retryableProviderStatus(
            result?.status
          ) &&
          ![400, 404].includes(
            Number(result?.status)
          )
        ) {
          break;
        }
      } catch (err) {
        last = {
          status:
            err?.name === "AbortError"
              ? 504
              : 502,
          payload: {
            error: {
              message:
                err?.name === "AbortError"
                  ? `${provider} timed out.`
                  : (
                      err?.message ||
                      `${provider} proxy error`
                    ),
            },
          },
          provider,
        };
      }
    }

    const status =
      Number(last?.status) || 503;

    if (last?.retryAfter) {
      res.setHeader(
        "retry-after",
        last.retryAfter
      );
    }

    console.error(
      "AI message providers exhausted:",
      requestedProvider,
      proxyErrorMessage(
        last?.payload,
        "No provider returned a usable response."
      )
    );

    return res
      .status(status)
      .json(
        last?.payload || {
          error: {
            message:
              "No configured AI provider returned a usable response.",
          },
        }
      );
  }
);

// Serve the built React/Vite app in production.
// v31: never let an old frontend bundle survive a deploy in browser/proxy cache.
app.use((req, res, next) => {
  if (req.method === "GET") {
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
});

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

app.use((req, res, next) => {
  if (
    req.method === "GET" &&
    !req.path.startsWith("/ai/")
  ) {
    return res.sendFile(
      "index.html",
      {
        root: "dist",
      }
    );
  }

  next();
});

app.listen(
  PORT,
  () =>
    console.log(
      `App + AI proxy listening on port ${PORT}`
    )
);