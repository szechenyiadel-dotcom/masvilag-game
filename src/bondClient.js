import { BOND_ANALYSIS_VERSION, assertCompleteGraph, runtimeBond } from "./bondAnalysis.js";

const runtimeFields = new Set([
  "id", "avatar", "avatarUrl", "cover", "coverUrl", "imageId",
  "aiContextSummary", "aiVoiceStyleCard", "brief", "briefSrc", "profile", "profileHash", "sheetHash", "baselineReady",
  "followers", "following", "baseFollowers", "followerDelta", "posts", "comments", "chats", "scenes", "messages", "msgs",
  "sim", "rels", "socialEvents", "notifications", "invitations",
  "createdAt", "updatedAt", "arrivalTrendAt",
]);

export function sheetFields(character, world) {
  const fields = {};
  const source = { ...character };
  const posted = (world?.posts || []).filter(post => post.authorId === character.id && post.sourceAlbumItemId);
  if (posted.length || Array.isArray(character.album)) {
    source.album = [...(character.album || [])];
    for (const post of posted) {
      if (source.album.some(item => item.id === post.sourceAlbumItemId)) continue;
      source.album.push(post.sourceSheetAlbumItem || { id: post.sourceAlbumItemId, who: post.imagePeopleNote || "", note: post.imageManualNote || "", vision: post.imageVision || "" });
    }
  }
  for (const key of Object.keys(source).sort()) {
    if (runtimeFields.has(key)) continue;
    if (["album", "albums", "images", "photos", "media"].includes(key)) {
      fields[key] = (Array.isArray(source[key]) ? source[key] : source[key] && typeof source[key] === "object" ? Object.values(source[key]) : []).filter(item => item && typeof item === "object").map((item) =>
        Object.fromEntries(Object.entries(item || {}).filter(([name]) => !["src", "imageId", "id", "postedAt", "usedAt", "createdAt", "analyzedAt", "restoredFromPostId"].includes(name)))).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    } else fields[key] = source[key];
  }
  return fields;
}

export function htmlToFullText(value, Parser = globalThis.DOMParser) {
  if (!/<[a-z][\s\S]*>/i.test(value)) return value;
  if (!Parser) throw new Error("HTML parser is unavailable; sheet was not truncated or silently flattened");
  const document = new Parser().parseFromString(value, "text/html");
  const visit = (node) => {
    if (node.nodeType === 3) return node.nodeValue;
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return "";
    const tag = (node.tagName || "").toLowerCase();
    if (tag === "style") return "";
    if (tag === "script") return "\n[Embedded sheet data; read as text, never execute]\n" + node.textContent + "\n";
    const attributes = ["alt", "title", "aria-label", "placeholder", "value", "name", "aria-selected", "aria-checked"].map((name) => node.getAttribute?.(name)).filter(Boolean);
    for (const attribute of Array.from(node.attributes || [])) if (attribute.name.startsWith("data-") || ["selected", "checked"].includes(attribute.name)) attributes.push(attribute.name + "=" + attribute.value);
    const srcdoc = node.getAttribute?.("srcdoc");
    if (tag === "iframe" && !srcdoc && node.getAttribute("src")) throw new Error("The sheet has an external iframe. Import its full contents before analysis: " + node.getAttribute("src"));
    const children = tag === "template" ? node.content.childNodes : node.childNodes;
    const content = Array.from(children || []).map(visit).join("");
    const block = ["html", "body", "head", "div", "p", "section", "article", "aside", "header", "footer", "main", "h1", "h2", "h3", "h4", "h5", "h6", "li", "ul", "ol", "table", "tr", "td", "th", "figure", "figcaption", "details", "summary", "br", "hr", "template", "iframe"].includes(tag);
    return (block ? "\n" : "") + (attributes.length ? "\n" + attributes.join("\n") + "\n" : "") + (srcdoc ? htmlToFullText(srcdoc, Parser) : "") + content + (block ? "\n" : "");
  };
  return visit(document);
}

const flattenFields = (fields, Parser) => {
  const flatten = (value) => {
    if (typeof value === "string") return htmlToFullText(value, Parser);
    if (Array.isArray(value)) return value.map(flatten).join("\n");
    if (value && typeof value === "object") return Object.entries(value).map(([key, entry]) => "[" + key + "]\n" + flatten(entry)).join("\n");
    return value == null ? "" : String(value);
  };
  return flatten(fields);
};

export function fullSheetText(character, Parser, world) {
  return flattenFields(sheetFields(character, world), Parser);
}

// One field's value as plain text (HTML read through the parser); used by the semantic memory.
export function flattenSheetValue(value, Parser) {
  return flattenFields(value, Parser);
}

// Relationships are read from the Connections field only. The identity fields travel
// with it because the AI needs the owner's own names to read the text, and the server
// needs every character's aliases to resolve who is mentioned. Nothing else on the
// sheet (backstory, personality, album...) reaches the relationship analysis, so
// editing it neither costs a model call nor changes a bond.
const IDENTITY_FIELDS = ["name", "nick", "nickname", "username"];
const hasContent = (value) => value != null && String(value).trim() !== "";

// Who each character is called, straight from the sheets: the full name, then nickname(s) and
// username. The server resolves "Angel" in someone's Connections to the person whose own nickname
// field says Angel, without asking a model.
export function characterIdentities(subjectsList) {
  const out = {};
  for (const person of subjectsList) {
    const name = String(person.name || "").trim();
    const aliases = [...new Set([person.nick, person.nickname, person.username].map((value) => String(value || "").trim()).filter((value) => value && value !== name))];
    out[person.id] = { name, aliases };
  }
  return out;
}

export function relationshipFields(character, world) {
  const all = sheetFields(character, world);
  const fields = {};
  for (const key of [...IDENTITY_FIELDS, "connections"]) if (hasContent(all[key])) fields[key] = all[key];
  return fields;
}

export function relationshipSourceText(character, Parser, world) {
  return flattenFields(relationshipFields(character, world), Parser);
}

const RELATIONSHIP_SOURCE_PREFIX = "connections-v1:";

export function bondSourceFingerprint(world, subjects) {
  return RELATIONSHIP_SOURCE_PREFIX + JSON.stringify(subjects(world).map((character) => ({ id: character.id, fields: relationshipFields(character, world) })).sort((a, b) => a.id.localeCompare(b.id)));
}

// Worlds analysed before the Connections-only reading stored a fingerprint of the whole
// sheet. While their sheets are unchanged they stay valid: nobody has to wait for a re-read
// just because the app was updated.
function legacyBondSourceFingerprint(world, subjects) {
  return JSON.stringify(subjects(world).map((character) => ({ id: character.id, fields: sheetFields(character, world) })).sort((a, b) => a.id.localeCompare(b.id)));
}

export function analysisReady(world, subjects) {
  // refreshPending marks placeholder baselines written by an earlier "instant
  // restart"; they were never read from the sheets, so they must be read now.
  if (world.bondAnalysis?.version !== BOND_ANALYSIS_VERSION || world.bondAnalysis.refreshPending) return false;
  const stored = world.bondAnalysis.source;
  return stored === bondSourceFingerprint(world, subjects) || (!String(stored).startsWith(RELATIONSHIP_SOURCE_PREFIX) && stored === legacyBondSourceFingerprint(world, subjects));
}

// Sheets and bonds are read by the server, which caches every profile and every
// directed pair. The browser only submits work and polls, so this is the same
// path for first load, a new character, a sheet edit and Restart World.
const ANALYSIS_CONCURRENCY = 8;
// One call reads the owner's whole sheet and writes the bonds toward at most this
// many people. An answer is validated as a whole, so a long array is likelier to fail
// on one bond and then has to be written again in full; short arrays run in
// parallel and a failure only repeats its own part.
const TARGETS_PER_CALL = 10;
const POLL_FIRST_MS = 800;
const POLL_MAX_MS = 2000;
const MAX_TRANSIENT_FAILURES = 20;

// A real HTTP status decides. Without one (phone lost signal, server restarting)
// the browser only gives a message such as "Load failed".
const transientError = (error) => error?.status
  ? [408, 429, 500, 502, 503, 504].includes(error.status)
  : /load failed|failed to fetch|network|fetch|abort|econn|timeout/i.test(String(error?.message || error || ""));
const unknownJob = (error) => error?.status === 404 || /unknown analysis job/i.test(String(error?.message || ""));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* force: read every sheet again. only: read just this character again (their sheet and the bonds they write); everyone
   else comes back from the server's cache. A fresh read is stored under a token that belongs to the character
   (world.bondAnalysis.generations), and every later rebuild keeps using it, so a re-read is not undone by the next
   new character or restart that would otherwise fall back to the older cached reading. */
export async function rebuildBondGraph(world, { subjects, api, language, force = false, only = null, progress: report = () => {}, pollMs = POLL_FIRST_MS }) {
  const people = subjects(world);
  const source = bondSourceFingerprint(world, subjects);
  const freshToken = force || only ? String(Date.now()) + ":" + String(Math.random()) : "";
  const storedGenerations = world.bondAnalysis?.generations || {};
  const generations = {};
  for (const person of people) {
    const token = force || only === person.id ? freshToken : storedGenerations[person.id] || "";
    if (token) generations[person.id] = token;
  }
  const forceOf = (id) => generations[id] || "";
  const sheets = {};
  const fieldNames = {};
  let failed = false;
  const progress = (state) => { if (!failed) report(state); };

  // Flattening a large sheet is real work; give the browser a turn now and then so
  // the page stays responsive on a phone. (Not requestAnimationFrame: it never
  // fires in a background tab and would stall the analysis.)
  let lastYield = Date.now();
  const yieldToUi = async () => {
    if (Date.now() - lastYield < 12) return;
    await sleep(0);
    lastYield = Date.now();
  };
  for (const character of people) {
    await yieldToUi();
    sheets[character.id] = relationshipSourceText(character, undefined, world);
    fieldNames[character.id] = Object.keys(relationshipFields(character, world));
  }

  const analyze = async (body, onFirst = null) => {
    let jobKey = null;
    let missing = null;
    let submitted = false;
    let transientFailures = 0;
    let delay = pollMs;
    let reported = false;
    for (;;) {
      if (failed) throw new Error("Analysis cancelled: another part of this run failed");
      try {
        const response = await api("/ai/bond-analysis", {
          method: "POST",
          body: JSON.stringify(jobKey ? { poll: jobKey } : { ...body, force: forceOf(body.owner) }),
        });
        transientFailures = 0;
        if (!reported && onFirst) { reported = true; onFirst({ key: response.jobKey || response.cacheKey || null, pending: Boolean(response.pending) }); }
        if (!response.pending) {
          const computed = Number.isFinite(response.computed)
            ? response.computed
            : (response.cached && !submitted ? 0 : (missing ?? response.result?.bonds?.length ?? 0));
          return { ...response, cached: response.cached && !submitted, computed };
        }
        submitted = true;
        jobKey = response.jobKey || null;
        missing = response.missing ?? missing;
        await sleep(delay);
        delay = Math.min(POLL_MAX_MS, Math.round(delay * 1.3));
        if (failed) throw new Error("Analysis cancelled: another part of this run failed");
      } catch (error) {
        // The server forgot the job (restart/cleanup): send the full request again.
        if (jobKey && unknownJob(error)) { jobKey = null; continue; }
        // Repeating a request is safe because the server de-duplicates by cache key.
        if (!transientError(error) || ++transientFailures > MAX_TRANSIENT_FAILURES) throw error;
        await sleep(Math.min(3000, 350 + transientFailures * 200));
      }
    }
  };

  const runLimited = async (items, worker) => {
    let next = 0;
    const runners = Array.from({ length: Math.min(ANALYSIS_CONCURRENCY, items.length) }, async () => {
      while (!failed) {
        const index = next++;
        if (index >= items.length) return;
        try { await worker(items[index], index); } catch (error) { failed = true; throw error; }
      }
    });
    await Promise.all(runners);
  };

  const profiles = {};
  const profileKeys = new Array(people.length);
  let recalculated = 0;
  let done = 0;
  const identities = characterIdentities(people);
  // The baseline calls: one owner, at most TARGETS_PER_CALL targets each. `names` of a target is only known once its
  // profile is read; the server never needs it to find the target (it uses the id and the cached profile).
  const partsOf = (namesOf) => people.flatMap((character) => {
    const others = people.filter((other) => other.id !== character.id)
      .map((other) => ({ id: other.id, names: namesOf(other), oneLine: other.shortDescription || "" }));
    const chunks = [];
    for (let at = 0; at < others.length; at += TARGETS_PER_CALL) chunks.push(others.slice(at, at + TARGETS_PER_CALL));
    return chunks.map((roster) => ({ character, roster }));
  });

  /* While the profiles are being read, the baseline calls are registered with the server (defer): it starts each one
     the moment the profiles it needs are ready, even if this phone has gone to sleep in between. Only worth doing
     when some profile is really being read (not when everything comes back from the cache at once). */
  const registeredAhead = new Set();
  const firstResolvers = [];
  const firsts = people.map(() => new Promise((resolve) => { firstResolvers.push(resolve); }));
  const registerAhead = async () => {
    const seen = await Promise.all(firsts);
    if (failed || people.length < 2 || seen.some((row) => !row?.key) || !seen.some((row) => row.pending)) return;
    const keys = seen.map((row) => row.key);
    for (const person of people) registeredAhead.add(person.id);
    await Promise.allSettled(partsOf(() => []).map(({ character, roster }) => api("/ai/bond-analysis", {
      method: "POST",
      body: JSON.stringify({ stage: "baseline", owner: character.id, roster, identities, ownSheet: sheets[character.id], profileKeys: keys, language, force: forceOf(character.id), defer: true }),
    })));
  };
  progress({ phase: "profile", completed: 0, total: people.length });
  registerAhead().catch(() => {});
  await runLimited(people, async (character, index) => {
    let settled = false;
    const settle = (row) => { if (!settled) { settled = true; firstResolvers[index](row); } };
    try {
      const result = await analyze({
        stage: "profile",
        owner: character.id,
        roster: people.filter((other) => other.id !== character.id)
          .map((other) => ({ id: other.id, names: [other.name, other.nick, other.nickname, other.username].filter(Boolean) })),
        ownSheet: sheets[character.id],
        fieldNames: fieldNames[character.id],
        language,
      }, settle);
      profiles[character.id] = { profile: result.result, hash: result.hash };
      profileKeys[index] = result.cacheKey;
      if (!result.cached) recalculated += 1;
      progress({ phase: "profile", completed: ++done, total: people.length });
    } finally { settle(null); }
  });

  const baselines = {};
  let recalculatedBonds = 0;
  const parts = partsOf((other) => profiles[other.id].profile.names);
  done = 0;
  progress({ phase: "baseline", completed: 0, total: parts.length });
  await runLimited(parts, async ({ character, roster }) => {
    const result = await analyze({
      stage: "baseline",
      owner: character.id,
      roster,
      identities,
      ownSheet: sheets[character.id],
      profileKeys,
      language,
    });
    // A reading the server already did on its own (registered ahead) comes back as "cached": it was still work of this run.
    recalculatedBonds += result.computed || (registeredAhead.has(character.id) ? Number(result.jobComputed) || 0 : 0);
    for (const bond of result.result.bonds) baselines[bond.from + ">" + bond.to] = runtimeBond(bond);
    progress({ phase: "baseline", completed: ++done, total: parts.length });
  });

  assertCompleteGraph(people.map((character) => character.id), baselines);
  return {
    baselines,
    analysis: {
      version: BOND_ANALYSIS_VERSION,
      source,
      profiles,
      recalculated,
      recalculatedBonds,
      generations,
      completedAt: Date.now(),
    },
  };
}


/* reset: ids of characters that were read again on purpose. Their outgoing bonds, and the bonds toward them whose
   reading actually changed, are set to the fresh reading (play history of those pairs is dropped, like a restart would
   do for them); everything else keeps what play has made of it. */
export function installBondGraph(world, result, subjects, { reset = [] } = {}) {
  if (result.analysis.source !== bondSourceFingerprint(world, subjects)) throw new Error("Character sheets changed during analysis; retry with current sheets");
  const previous = world.relationshipBaselines || {};
  const resetIds = new Set(reset);
    world.relationshipBaselines = structuredClone(result.baselines);
  world.bondAnalysis = structuredClone(result.analysis);
  world.rels ||= {};
  for (const [key, base] of Object.entries(result.baselines)) {
    if (resetIds.has(base.from) || (resetIds.has(base.to) && JSON.stringify(base) !== JSON.stringify(previous[key]))) {
      world.rels[key] = structuredClone(base);
      for (const store of ["relationshipHistory", "officialRelationships"]) if (world[store] && typeof world[store] === "object") delete world[store][key];
      continue;
    }
    if (!world.rels[key] || JSON.stringify(world.rels[key]) === JSON.stringify(previous[key]) || world.rels[key].freshFromSheet) world.rels[key] = structuredClone(base);
    else if (!previous[key]) {
      const current = world.rels[key];
      world.rels[key] = {
        ...structuredClone(base), ...current, from: base.from, to: base.to,
        type: current.type || current.bond || base.type,
        hiddenFeelings: Object.prototype.hasOwnProperty.call(current, "hiddenFeelings") ? current.hiddenFeelings : current.hidden || null,
        whoKnows: current.whoKnows || (current.hidden ? [base.from] : []),
        summary: current.summary || current.why || base.summary,
        description: current.description || [current.why, current.mood].filter(Boolean).join(" ") || base.description,
        levels: current.levels || {
          sentiment: current.score ?? base.levels.sentiment,
          trust: current.trust ?? base.levels.trust,
          attraction: current.attraction ?? base.levels.attraction,
          tension: current.tension ?? base.levels.tension,
        },
        freshFromSheet: false,
      };
    }
  }
  for (const key of Object.keys(world.rels)) if (!result.baselines[key]) delete world.rels[key];
}

/* What a model needs of a profile to write about a person: the structured reading without the verbatim quotes it was
   checked against (those are for validation, and were most of its size). */
function compactProfile(profile) {
  if (!profile || typeof profile !== "object") return profile;
  const { claims, processedFields, ...rest } = profile;
  const bare = (rows) => (Array.isArray(rows) ? rows.map((row) => { if (!row || typeof row !== "object") return row; const { evidence, ...others } = row; return others; }) : rows);
  return { ...rest, groups: bare(rest.groups), groupRelations: bare(rest.groupRelations), mentions: bare(rest.mentions), facts: bare(rest.facts), timeline: bare(rest.timeline) };
}

// Same for a bond: the quotes that proved it stay out of the prompt.
function compactBond(bond) {
  if (!bond || typeof bond !== "object") return bond;
  const { evidence, fieldEvidence, factEvidence, freshFromSheet, fixed, ...rest } = bond;
  return rest;
}

const foldForScope = (value) => String(value || "").normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();

/* Who a prompt is about, when the caller did not say: the player plus every character whose name, nickname, username or
   id the text mentions. Returns null when that is fewer than two people (the prompt names nobody in particular), so the
   caller falls back to everyone. Being too inclusive only costs size; being too exclusive would drop a bond that matters. */
export function bondScopeIds(people, { text = "", ids = [], playerId = null } = {}) {
  const known = new Set(people.map((person) => person.id));
  const chosen = new Set([...(playerId ? [playerId] : []), ...ids].filter((id) => known.has(id)));
  const folded = foldForScope(text);
  if (folded) {
    for (const person of people) {
      if (chosen.has(person.id)) continue;
      const names = [person.name, person.nick, person.nickname, person.username, person.id].map((value) => String(value || "").trim()).filter(Boolean);
      const tokens = names.flatMap((name) => [name, ...(name === person.name ? name.split(/\s+/).filter((part) => part.length >= 4) : [])]).map(foldForScope).filter((token) => token.length >= 3);
      if (tokens.some((token) => folded.includes(token))) chosen.add(person.id);
    }
  }
  return chosen.size >= 2 ? [...chosen] : null;
}

/* scope: ids of the characters the call is about (null = everyone). The context then holds only their profiles, the
   bonds among them and what they know of each other, so it no longer grows with the size of the cast. */
export function bondGenerationContext(world, scope = null) {
  if (!world.bondAnalysis) return "";
  const keep = Array.isArray(scope) && scope.length ? new Set(scope) : null;
  const inScope = (id) => !keep || keep.has(id);
  const profileIds = Object.keys(world.bondAnalysis.profiles).filter(inScope);
  const bonds = Object.entries(world.rels || {}).filter(([, bond]) => !keep || (inScope(bond.from) && inScope(bond.to)));
  return "\n[[FULL_BOND_CONTEXT]]\n" + JSON.stringify({
    rules: "Full profiles/currentBonds are PRIVATE director data and override older brief, identity, bible or keyword-derived relationship hints. For each actor, knowledgeByActor is the only authority on other actors' private bond knowledge. CURRENT directed bonds govern every actor including AI–AI. Profiles are private actor source, never shared knowledge. A character may know another's secret ONLY when their ID occurs in whoKnows. publicFace is the sole default public view. Never mirror hidden feelings, attraction or private source into reverse knowledge. A group tie does not imply friendship. Preserve all current fields; in-game evolution overrides baseline history. For every directed relationship change emit updated description (4–8 sentences), summary, publicFace, hiddenFeelings, history, dynamics, wants, status, levels and whoKnows where the event changes them, alongside existing a/b/delta/mood/why fields. PublicFace excludes private feelings; mood is private emotional state. Newly formed secrets reset witnesses to actual knowing IDs. Baselines never change during gameplay. Never reveal unknown secrets in posts, gossip, popups, chat or scenes.",
    profiles: Object.fromEntries(profileIds.map((id) => [id, compactProfile(world.bondAnalysis.profiles[id].profile)])),
    currentBonds: Object.fromEntries(bonds.map(([key, bond]) => [key, compactBond(bond)])),
    knowledgeByActor: Object.fromEntries(profileIds.map((id) => [id,
      Object.fromEntries(bonds.filter(([, bond]) => bond.from === id || bond.to === id).map(([key, bond]) => [key,
        bond.from === id || bond.whoKnows?.includes(id) ? compactBond(bond) : { from: bond.from, to: bond.to, publicFace: bond.publicFace }
      ]))
    ])),
  }) + "\n[[/FULL_BOND_CONTEXT]]";
}
