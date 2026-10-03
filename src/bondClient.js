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

export function fullSheetText(character, Parser, world) {
  const flatten = (value) => {
    if (typeof value === "string") return htmlToFullText(value, Parser);
    if (Array.isArray(value)) return value.map(flatten).join("\n");
    if (value && typeof value === "object") return Object.entries(value).map(([key, entry]) => "[" + key + "]\n" + flatten(entry)).join("\n");
    return value == null ? "" : String(value);
  };
  return flatten(sheetFields(character, world));
}

export function bondSourceFingerprint(world, subjects) {
  return JSON.stringify(subjects(world).map((character) => ({ id: character.id, fields: sheetFields(character, world) })).sort((a, b) => a.id.localeCompare(b.id)));
}

export function analysisReady(world, subjects) {
  // refreshPending marks placeholder baselines written by an earlier "instant
  // restart"; they were never read from the sheets, so they must be read now.
  return world.bondAnalysis?.version === BOND_ANALYSIS_VERSION && !world.bondAnalysis.refreshPending && world.bondAnalysis.source === bondSourceFingerprint(world, subjects);
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
const POLL_FIRST_MS = 1500;
const POLL_MAX_MS = 4000;
const MAX_TRANSIENT_FAILURES = 20;

// A real HTTP status decides. Without one (phone lost signal, server restarting)
// the browser only gives a message such as "Load failed".
const transientError = (error) => error?.status
  ? [408, 429, 500, 502, 503, 504].includes(error.status)
  : /load failed|failed to fetch|network|fetch|abort|econn|timeout/i.test(String(error?.message || error || ""));
const unknownJob = (error) => error?.status === 404 || /unknown analysis job/i.test(String(error?.message || ""));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function rebuildBondGraph(world, { subjects, api, language, force = false, progress: report = () => {}, pollMs = POLL_FIRST_MS }) {
  const people = subjects(world);
  const source = bondSourceFingerprint(world, subjects);
  const forceRun = force ? String(Date.now()) + ":" + String(Math.random()) : "";
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
    sheets[character.id] = fullSheetText(character, undefined, world);
    fieldNames[character.id] = Object.keys(sheetFields(character, world));
  }

  const analyze = async (body) => {
    let jobKey = null;
    let missing = null;
    let submitted = false;
    let transientFailures = 0;
    let delay = pollMs;
    for (;;) {
      if (failed) throw new Error("Analysis cancelled: another part of this run failed");
      try {
        const response = await api("/ai/bond-analysis", {
          method: "POST",
          body: JSON.stringify(jobKey ? { poll: jobKey } : { ...body, force: forceRun }),
        });
        transientFailures = 0;
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
  progress({ phase: "profile", completed: 0, total: people.length });
  await runLimited(people, async (character, index) => {
    const result = await analyze({
      stage: "profile",
      owner: character.id,
      roster: people.filter((other) => other.id !== character.id)
        .map((other) => ({ id: other.id, names: [other.name, other.nick, other.nickname, other.username].filter(Boolean) })),
      ownSheet: sheets[character.id],
      fieldNames: fieldNames[character.id],
      language,
    });
    profiles[character.id] = { profile: result.result, hash: result.hash };
    profileKeys[index] = result.cacheKey;
    if (!result.cached) recalculated += 1;
    progress({ phase: "profile", completed: ++done, total: people.length });
  });

  const baselines = {};
  let recalculatedBonds = 0;
  const parts = people.flatMap((character) => {
    const others = people.filter((other) => other.id !== character.id)
      .map((other) => ({ id: other.id, names: profiles[other.id].profile.names, oneLine: other.shortDescription || "" }));
    const chunks = [];
    for (let at = 0; at < others.length; at += TARGETS_PER_CALL) chunks.push(others.slice(at, at + TARGETS_PER_CALL));
    return chunks.map((roster) => ({ character, roster }));
  });
  done = 0;
  progress({ phase: "baseline", completed: 0, total: parts.length });
  await runLimited(parts, async ({ character, roster }) => {
    const result = await analyze({
      stage: "baseline",
      owner: character.id,
      roster,
      ownSheet: sheets[character.id],
      profileKeys,
      language,
    });
    recalculatedBonds += result.computed;
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
      completedAt: Date.now(),
    },
  };
}


export function installBondGraph(world, result, subjects) {
  if (result.analysis.source !== bondSourceFingerprint(world, subjects)) throw new Error("Character sheets changed during analysis; retry with current sheets");
  const previous = world.relationshipBaselines || {};
    world.relationshipBaselines = structuredClone(result.baselines);
  world.bondAnalysis = structuredClone(result.analysis);
  world.rels ||= {};
  for (const [key, base] of Object.entries(result.baselines)) {
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

export function bondGenerationContext(world) {
  if (!world.bondAnalysis) return "";
  return "\n[[FULL_BOND_CONTEXT]]\n" + JSON.stringify({
    rules: "Full profiles/currentBonds are PRIVATE director data and override older brief, identity, bible or keyword-derived relationship hints. For each actor, knowledgeByActor is the only authority on other actors' private bond knowledge. CURRENT directed bonds govern every actor including AI–AI. Profiles are private actor source, never shared knowledge. A character may know another's secret ONLY when their ID occurs in whoKnows. publicFace is the sole default public view. Never mirror hidden feelings, attraction or private source into reverse knowledge. A group tie does not imply friendship. Preserve all current fields; in-game evolution overrides baseline history. For every directed relationship change emit updated description (4–8 sentences), summary, publicFace, hiddenFeelings, history, dynamics, wants, status, levels and whoKnows where the event changes them, alongside existing a/b/delta/mood/why fields. PublicFace excludes private feelings; mood is private emotional state. Newly formed secrets reset witnesses to actual knowing IDs. Baselines never change during gameplay. Never reveal unknown secrets in posts, gossip, popups, chat or scenes.",
    profiles: Object.fromEntries(Object.entries(world.bondAnalysis.profiles).map(([id, entry]) => [id, entry.profile])),
    currentBonds: world.rels,
    knowledgeByActor: Object.fromEntries(Object.keys(world.bondAnalysis.profiles).map(id => [id,
      Object.fromEntries(Object.entries(world.rels || {}).filter(([, bond]) => bond.from === id || bond.to === id).map(([key, bond]) => [key,
        bond.from === id || bond.whoKnows?.includes(id) ? bond : { from: bond.from, to: bond.to, publicFace: bond.publicFace }
      ]))
    ])),
  }) + "\n[[/FULL_BOND_CONTEXT]]";
}
