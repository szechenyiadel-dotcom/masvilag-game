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
  return world.bondAnalysis?.version === BOND_ANALYSIS_VERSION && world.bondAnalysis.source === bondSourceFingerprint(world, subjects);
}

export async function rebuildBondGraph(world, { subjects, api, language, force = false, progress = () => {}, fastRestart = false }) {
  const people = subjects(world);
  const source = bondSourceFingerprint(world, subjects);
  const profiles = {};
  const sheets = {};
  const profileKeys = new Array(people.length);
  let recalculated = 0;
  let recalculatedBonds = 0;
  const forceRun = force ? String(Date.now()) + ":" + String(Math.random()) : "";
  const pollDelay = fastRestart ? 700 : 3000;
  const concurrency = fastRestart ? Math.min(4, Math.max(1, people.length)) : 1;

  const analyze = async (body) => {
    const options = { method: "POST", body: JSON.stringify({ ...body, force: forceRun, restartFast: fastRestart }) };
    let submitted = false;
    for (;;) {
      const response = await api("/ai/bond-analysis", options);
      if (!response.pending) return { ...response, cached: response.cached && !submitted };
      submitted = true;
      await new Promise(resolve => setTimeout(resolve, pollDelay));
    }
  };

  const runLimited = async (items, limit, worker) => {
    let next = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        await worker(items[index], index);
      }
    });
    await Promise.all(runners);
  };

  for (const character of people) sheets[character.id] = fullSheetText(character, undefined, world);

  await runLimited(people, concurrency, async (character, index) => {
    const roster = people
      .filter((other) => other.id !== character.id)
      .map((other) => ({ id: other.id, names: [other.name, other.nick, other.nickname, other.username].filter(Boolean) }));
    progress({ phase: "profile", owner: character.name, completed: Object.keys(profiles).length, total: people.length });
    const result = await analyze({
      stage: "profile",
      owner: character.id,
      roster,
      ownSheet: sheets[character.id],
      fieldNames: Object.keys(sheetFields(character, world)),
      language,
    });
    profiles[character.id] = { profile: result.result, hash: result.hash };
    profileKeys[index] = result.cacheKey;
    if (!result.cached) recalculated += 1;
  });

  const baselines = {};
  await runLimited(people, concurrency, async (character) => {
    const roster = people
      .filter((other) => other.id !== character.id)
      .map((other) => ({ id: other.id, names: profiles[other.id].profile.names, oneLine: other.shortDescription || "" }));
    progress({
      phase: "baseline",
      owner: character.name,
      completed: Object.keys(baselines).length,
      total: people.length * (people.length - 1),
    });
    const result = await analyze({
      stage: "baseline",
      owner: character.id,
      roster,
      ownSheet: sheets[character.id],
      profileKeys,
      language,
    });
    if (!result.cached) recalculatedBonds += result.result.bonds.length;
    for (const bond of result.result.bonds) baselines[bond.from + ">" + bond.to] = runtimeBond(bond);
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
