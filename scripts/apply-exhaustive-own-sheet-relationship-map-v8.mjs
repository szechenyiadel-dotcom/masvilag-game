import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG EXHAUSTIVE OWN-SHEET RELATIONSHIP MAP v8";

function renameOne(name, replacement) {
  const rx = new RegExp("function\\s+" + name + "\\s*\\(");
  const matches = [...next.matchAll(new RegExp(rx.source, "g"))];
  if (matches.length !== 1) {
    throw new Error("Relationship v8 aborted: " + name + " expected once, found " + matches.length);
  }
  next = next.replace(rx, "function " + replacement + "(");
}

function replaceExact(oldText, newText, label) {
  const first = next.indexOf(oldText);
  const second = first >= 0 ? next.indexOf(oldText, first + oldText.length) : -1;
  if (first < 0 || second >= 0) {
    throw new Error("Relationship v8 aborted: " + label + " anchor mismatch.");
  }
  next = next.slice(0, first) + newText + next.slice(first + oldText.length);
}

if (!next.includes("/* " + MARKER + " */")) {
  renameOne("relationshipReadingSnippet", "legacyV8PairRelationshipReadingSnippet");
  renameOne("relationshipReadingHash", "legacyV8PairRelationshipReadingHash");
  renameOne("relationshipReadingCacheKey", "legacyV8PairRelationshipReadingCacheKey");
  renameOne("relationshipReadingDueTargets", "legacyV8PairRelationshipReadingDueTargets");
  renameOne("relationshipReadingResult", "legacyV8PairRelationshipReadingResult");
  renameOne("genRelationshipReading", "legacyV8PairGenRelationshipReading");
  renameOne("inferCanonicalRelationshipBaseline", "legacyV8PairInferCanonicalRelationshipBaseline");
  renameOne("planAutoAction", "legacyV8PairPlanAutoAction");
  renameOne("runRelationshipReadingAction", "legacyV8PairRunRelationshipReadingAction");

  replaceExact(
    "const RELATIONSHIP_READING_BATCH = 1;",
    "const RELATIONSHIP_READING_BATCH = 48;",
    "relationship reading batch"
  );

  replaceExact(
    '  else if (cooldownLeft() > 1500) label = tt("AI pihen · " + Math.ceil(cooldownLeft() / 1000) + " mp", "AI resting · " + Math.ceil(cooldownLeft() / 1000) + "s");',
    '  else if (visibleCooldownLeft() > 1500) label = tt("AI pihen · " + Math.ceil(visibleCooldownLeft() / 1000) + " mp", "AI resting · " + Math.ceil(visibleCooldownLeft() / 1000) + "s");',
    "AI status chip visible cooldown"
  );

  const helper = `
/* ${MARKER} */
const REL_V8_RUNTIME_SKIP = /^(?:id|aiContextSummary|aiVoiceStyleCard|brief|briefSrc|avatar|avatarUrl|cover|coverUrl|image|imageId|images|album|albums|photos|media|posts|comments|msgs|messages|chats|scenes|memory|memories|followers|following|baseFollowers|followerDelta|rels|relationships|relationship|socialEvents|sim|notifications|invitations|createdAt|updatedAt|arrivalTrendAt)$/i;
const REL_V8_ROMANCE_WORDS = /(?:\\bcrush\\b|mutual\\s+crush|secret\\s+crush|dating|girlfriend|boyfriend|wife|husband|spouse|lover|romantic|romance|in\\s+love|love\\s+interest|attraction|attracted|flirt|fl[oö]rt|vonzalom|vonz[oó]d|szerelmes|szerelem|j[aá]rnak|randi|jegyes|fianc|titkos\\s+viszony|secret\\s+affair)/i;
const REL_V8_PERSONAL_WORDS = /(?:best\\s+friend|close\\s+friend|friendship|friends?|bar[aá]t|close\\s+to|k[oö]zel\\s+[aá]ll|rival|riv[aá]lis|enemy|enem(?:y|ies)|ellens[eé]g|hate|hates|hatred|gy[uű]l[oö]l|ut[aá]l|despis|loath|resent|harag|jealous|f[eé]lt[eé]ken|protect|v[eé]d|trust|b[ií]zik|distrust|bizalmatlan|fear|f[eé]l\\s+t[oő]le|admire|fel[nn]e|respect|tisztel|love|szeret|crush|attract|vonz|obsess|megsz[aá]ll|ex(?:es)?\\b|former\\s+(?:girlfriend|boyfriend|partner)|testv[eé]r|sibling|family|csal[aá]d|roommate|lak[oó]t[aá]rs|gets?\\s+along|j[oó]ban\\s+vannak|cannot\\s+stand|ki\\s+nem\\s+[aá]llhat)/i;

function relV8Text(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value, null, 2); } catch (_) { try { return String(value); } catch (_) { return ""; } }
}

function relV8FullOwnSheet(actor) {
  if (!actor || typeof actor !== "object") return "";
  const preferred = [
    "name", "nick", "nickname", "username", "displayName", "gender", "orientation", "birth", "birthday",
    "job", "school", "university", "college", "city", "bio", "looks", "connections", "personality", "traits",
    "speech", "voice", "goals", "fears", "likes", "secrets", "backstory", "extra", "skills", "abilities",
    "combat", "rank", "role", "organization", "organisation", "affiliation", "faction", "team", "dojo", "academy"
  ];
  const seen = new Set();
  const rows = [];
  const add = (key, value) => {
    if (seen.has(key) || REL_V8_RUNTIME_SKIP.test(key)) return;
    const text = relV8Text(value).trim();
    if (!text) return;
    seen.add(key);
    rows.push("[" + key + "]\\n" + text);
  };
  preferred.forEach((key) => add(key, actor[key]));
  Object.entries(actor).forEach(([key, value]) => add(key, value));
  return rows.join("\\n\\n");
}

function relV8SheetHash(actor) {
  return simsSocialStableHash("v8-own-sheet|" + relV8FullOwnSheet(actor));
}

function relV8TargetIdentityFingerprint(w, target) {
  if (!target) return "";
  return [
    String(target.id || ""),
    String(target.name || ""),
    String(target.nick || target.nickname || ""),
    String(target.username || ""),
    String(target.gender || ""),
    String(target.orientation || ""),
    relV6StructuralSummary(w, target),
  ].join("|");
}

function relationshipReadingSnippet(w, actor, target) {
  if (!w || !actor || !target || actor.id === target.id || isMediaAccount(w, target.id)) return "";
  return [
    "v8-own-sheet-map",
    "actor=" + String(actor.id || ""),
    "sheet=" + relV8SheetHash(actor),
    "target=" + relV8TargetIdentityFingerprint(w, target),
    "derived=" + String(relV6DerivedRole(w, actor, target) || ""),
  ].join("|");
}

function relationshipReadingHash(snippet) {
  return simsSocialStableHash("v8-exhaustive-own-sheet|" + String(snippet || ""));
}

function relationshipReadingCacheKey(actor, target, snippet) {
  return "rr8-exhaustive-own-sheet:" + simsSocialStableHash(
    String(actor && actor.name || "") + "|" +
    String(target && target.name || "") + "|" +
    relationshipReadingHash(snippet)
  );
}

function relationshipReadingDueTargets(w, actor) {
  const state = relationshipReadingState(w);
  const done = (state && state[actor.id] && state[actor.id].targets) || {};
  return allSubjects(w)
    .filter((target) => target && target.id && target.id !== actor.id && !isMediaAccount(w, target.id))
    .map((target) => ({ target, snippet: relationshipReadingSnippet(w, actor, target) }))
    .filter((row) => row.snippet && (!done[row.target.id] || done[row.target.id].hash !== relationshipReadingHash(row.snippet)))
    .sort((x, y) => (isHuman(w, y.target.id) ? 1 : 0) - (isHuman(w, x.target.id) ? 1 : 0));
}

function relV8Roster(w, actor) {
  return allSubjects(w)
    .filter((c) => c && c.id && c.id !== actor.id && !isMediaAccount(w, c.id))
    .map((c) => ({
      id: String(c.id),
      name: String(c.name || ""),
      nick: String(c.nick || c.nickname || ""),
      username: String(c.username || ""),
    }));
}

function relV8RosterText(w, actor) {
  return relV8Roster(w, actor)
    .map((c) => "- id=" + c.id + " | name=" + c.name + (c.nick ? " | nick=" + c.nick : "") + (c.username ? " | @" + c.username : ""))
    .join("\\n");
}

function relV8Chunks(text, max = 14000) {
  const raw = String(text || "");
  if (!raw) return [];
  const out = [];
  let at = 0;
  while (at < raw.length) {
    let end = Math.min(raw.length, at + max);
    if (end < raw.length) {
      const split = raw.lastIndexOf("\\n\\n", end);
      if (split > at + Math.floor(max * 0.55)) end = split + 2;
    }
    out.push(raw.slice(at, end));
    at = end;
  }
  return out;
}

function relV8ForeignIdsInFact(w, actor, targetId, text) {
  let ids = [];
  try { ids = explicitNamedCharacterIdsInText(w, String(text || ""), actor.id) || []; } catch (_) { ids = []; }
  return [...new Set(ids.map(String))].filter((id) => id !== String(targetId) && id !== String(actor.id));
}

async function relV8ExtractOwnSheetFacts(w, actor) {
  const sheet = relV8FullOwnSheet(actor);
  const chunks = relV8Chunks(sheet, 14000);
  const roster = relV8Roster(w, actor);
  const validIds = new Set(roster.map((r) => r.id));
  const facts = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const prompt = [
      "EXHAUSTIVE OWN-SHEET RELATIONSHIP EXTRACTION — PASS " + (i + 1) + "/" + chunks.length + ".",
      "You are reading ONLY " + String(actor.name || actor.id) + "'s own character sheet.",
      "Read EVERY line of this block. Extract EVERY relationship fact in this block that belongs to one of the ACTIVE CHARACTERS in the roster.",
      "HARD DIRECTION RULE: every fact must describe how THIS SHEET'S OWNER relates to that target, or an objective structural tie involving them. Never use another person's feelings to define the owner.",
      "HARD PERSON SEPARATION: do not transfer one person's sentence, emotion, history, title, mentor, enemy, crush, friend or event to another target. If a passage is about X, it belongs only to X.",
      "HARD NO-INVENTION: personality alone does not create a relationship. Being flirty does not create a crush. Being teammates does not create friendship or attraction. A role/group creates only the structural relation it actually supports.",
      "If a sentence names a third active character while talking about a target, do NOT use that third-person material as a relationship fact for the target.",
      "Use targetId from the roster exactly. Ignore non-active people.",
      "",
      "ACTIVE ROSTER:",
      relV8RosterText(w, actor),
      "",
      "OWN-SHEET BLOCK:",
      chunks[i],
      "",
      'JSON ONLY: {"facts":[{"targetId":"","fact":"concise paraphrase of ONLY the owner→target fact","kind":"structural|history|friendship|hostility|romance|family|trust|fear|rivalry|other"}]}'
    ].join("\\n");

    const out = await askWorldJSON(w, SHEET_ANALYST_SYSTEM, prompt, {
      maxTokens: 2600,
      priority: 58,
      source: "relationship-reading",
      quality: "deep",
      timeoutMs: 110000,
    });
    if (!out || out.skip) throw new Error("exhaustive relationship sheet pass failed");

    const rows = Array.isArray(out.facts) ? out.facts : [];
    for (const row of rows) {
      const targetId = String(row && row.targetId || "");
      const fact = String(row && row.fact || "").trim();
      if (!validIds.has(targetId) || !fact) continue;
      if (relV8ForeignIdsInFact(w, actor, targetId, fact).length) continue;
      const key = targetId + "|" + fact.toLowerCase();
      if (facts.some((old) => old.key === key)) continue;
      facts.push({
        key,
        targetId,
        fact,
        kind: String(row && row.kind || "other").trim().toLowerCase(),
      });
    }
  }
  return facts;
}

function relV8PairOwnEvidence(w, actor, target) {
  let conn = "";
  let elsewhere = "";
  try { conn = String(connectionCanonSnippetAbout(w, actor, target, 50000) || ""); } catch (_) {}
  try { elsewhere = String(relV6PairPassages(w, actor, target, 16000) || ""); } catch (_) {}
  return [conn, elsewhere].filter(Boolean).join("\\n");
}

function relV8ExplicitRomance(w, actor, target) {
  if (!w || !actor || !target) return false;
  if (!romanceTargetAllowed(w, actor.id, target.id)) return false;
  let cue = null;
  try { cue = connectionRelationshipCue(w, actor, target); } catch (_) { cue = null; }
  if (cue && cue.romantic) return true;
  let exact = "";
  try { exact = String(exactConnectionBondLabel(w, actor, target) || ""); } catch (_) {}
  return REL_V8_ROMANCE_WORDS.test(exact);
}

function relV8HasPersonalEvidence(w, actor, target) {
  const source = relV8PairOwnEvidence(w, actor, target);
  return REL_V8_PERSONAL_WORDS.test(source);
}

function relV8NonRomanticBond(w, actor, target) {
  let exact = "";
  try { exact = String(exactConnectionBondLabel(w, actor, target) || "").trim(); } catch (_) { exact = ""; }
  if (exact && !REL_V8_ROMANCE_WORDS.test(exact)) return exact;
  const derived = String(relV6DerivedRole(w, actor, target) || "");
  if (derived && derived !== "explicit") return derived;
  const af = factionFlags(actor);
  const tf = factionFlags(target);
  if (karateFactionRivalryFlags(af, tf)) return "Rivális";
  return "";
}

function relV8DefaultScoreForBond(value) {
  const text = String(value || "").toLowerCase();
  if (/ellens|enemy|hate/.test(text)) return -75;
  if (/rival|riv[aá]lis/.test(text)) return -35;
  if (/best friend|legjobb/.test(text)) return 82;
  if (/close friend|k[oö]zeli bar/.test(text)) return 68;
  if (/friend|bar[aá]t/.test(text)) return 52;
  if (/mentor|tan[ií]tv[aá]ny|student|teacher|tan[aá]r|coach|edz[oő]|teammate|csapatt[aá]rs|coworker|munkat[aá]rs|classmate|oszt[aá]lyt[aá]rs/.test(text)) return 24;
  if (/family|testv[eé]r|anya|apa|sibling|parent/.test(text)) return 65;
  return 0;
}

function relV8StripRomanceLayer(value) {
  return String(value || "")
    .split(/\\s*(?:\\+|\\/|\\||,|;)\\s*/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => !REL_V8_ROMANCE_WORDS.test(x))
    .join(" + ");
}

function relV8SanitizeRow(w, actor, target, input) {
  if (!input || typeof input !== "object") return input;
  let row = relV6SanitizeRow(w, actor, target, { ...input });
  if (!row || typeof row !== "object") return row;

  if (!relV6RowIsPairPure(w, actor, target, row)) return null;

  const exactBond = relV8NonRomanticBond(w, actor, target);
  const explicitRomance = relV8ExplicitRomance(w, actor, target);
  const orientation = romanceOrientationState(w, actor.id, target.id);
  const personal = relV8HasPersonalEvidence(w, actor, target);
  const structuralOnly = Boolean(exactBond && /mentor|tan[ií]tv[aá]ny|student|teacher|tan[aá]r|coach|edz[oő]|teammate|csapatt[aá]rs|coworker|munkat[aá]rs|classmate|oszt[aá]lyt[aá]rs/i.test(exactBond) && !personal);

  const romanceSeen = REL_V8_ROMANCE_WORDS.test([
    row.bond, row.role, row.mood, row.hidden, row.why, row.label, row.description,
    ...(Array.isArray(row.layers) ? row.layers : []),
  ].filter(Boolean).join(" ")) || Number(row.attraction) > 0;

  if (!explicitRomance || orientation.blocked) {
    row.attraction = 0;
    row.layers = (Array.isArray(row.layers) ? row.layers : []).filter((x) => !REL_V8_ROMANCE_WORDS.test(String(x || "")));
    if (REL_V8_ROMANCE_WORDS.test(String(row.bond || ""))) row.bond = exactBond || relV8StripRomanceLayer(row.bond);
    if (REL_V8_ROMANCE_WORDS.test(String(row.role || ""))) row.role = String(relV6DerivedRole(w, actor, target) || "").replace(/^explicit$/, "");
    if (REL_V8_ROMANCE_WORDS.test(String(row.hidden || ""))) row.hidden = "";
    if (REL_V8_ROMANCE_WORDS.test(String(row.mood || ""))) row.mood = "";
    if (REL_V8_ROMANCE_WORDS.test(String(row.why || ""))) row.why = "";
    if (REL_V8_ROMANCE_WORDS.test(String(row.label || ""))) row.label = "";
    if (REL_V8_ROMANCE_WORDS.test(String(row.description || ""))) row.description = "";
    if (romanceSeen && exactBond && (!Number.isFinite(Number(row.score)) || Number(row.score) > 45)) row.score = relV8DefaultScoreForBond(exactBond);
  }

  if (structuralOnly) {
    row.bond = exactBond;
    row.role = String(relV6DerivedRole(w, actor, target) || "").replace(/^explicit$/, "");
    row.layers = [exactBond];
    row.attraction = 0;
    row.obsession = 0;
    row.hidden = "";
    row.mood = "";
    row.description = "";
    row.label = "";
    row.why = "";
    row.score = relV8DefaultScoreForBond(exactBond);
  }

  if (!String(row.bond || "").trim() && exactBond) row.bond = exactBond;
  return row;
}

function relationshipReadingResult(w, actor, target) {
  if (!w || !actor || !target) return null;
  const state = w.sim && w.sim.relationshipReading;
  const row = state && state[actor.id] && state[actor.id].targets && state[actor.id].targets[target.id];
  if (!row) return null;
  const snippet = relationshipReadingSnippet(w, actor, target);
  if (!snippet || row.hash !== relationshipReadingHash(snippet)) return null;
  return relV8SanitizeRow(w, actor, target, row);
}

function relV8ConservativeBaseline(w, actor, target) {
  const exactBond = relV8NonRomanticBond(w, actor, target);
  let bond = exactBond;
  let score = relV8DefaultScoreForBond(bond);

  let exactAll = "";
  try { exactAll = String(exactConnectionBondLabel(w, actor, target) || "").trim(); } catch (_) {}
  if (exactAll && relV8ExplicitRomance(w, actor, target)) {
    bond = exactAll;
    score = /crush|vonzalom|attract/i.test(exactAll) ? 38 : 55;
  }

  return {
    score,
    bond,
    mood: "",
    hidden: "",
    why: "",
    role: String(relV6DerivedRole(w, actor, target) || "").replace(/^explicit$/, ""),
    source: "sheet-conservative-v8",
    fixed: false,
  };
}

function inferCanonicalRelationshipBaseline(w, actor, target) {
  if (!w || !actor || !target || actor.id === target.id) return null;
  const reading = relationshipReadingResult(w, actor, target);
  if (reading) {
    const clean = relV8SanitizeRow(w, actor, target, reading);
    if (clean) {
      return {
        score: clampRelationshipScore(Number(clean.score) || 0),
        bond: String(clean.bond || "").trim().slice(0, 180),
        mood: String(clean.description || clean.mood || "").trim().slice(0, 1400),
        hidden: String(clean.hidden || "").trim().slice(0, 600),
        why: String(clean.why || "").trim().slice(0, 1000),
        role: String(clean.role || "").trim().slice(0, 100),
        layers: (Array.isArray(clean.layers) ? clean.layers : []).slice(0, 12),
        source: "sheet-ai-v8",
        fixed: false,
      };
    }
  }
  return relV8ConservativeBaseline(w, actor, target);
}

function relV8TargetSynthesisCard(w, actor, target, facts) {
  const exactBond = relV8NonRomanticBond(w, actor, target);
  const derived = String(relV6DerivedRole(w, actor, target) || "").replace(/^explicit$/, "");
  const orientation = romanceOrientationState(w, actor.id, target.id);
  const explicitRomance = relV8ExplicitRomance(w, actor, target);
  return [
    "TARGET id=" + String(target.id) + " | name=" + String(target.name || ""),
    "EXTRACTED FACTS FROM ACTOR'S OWN FULL SHEET:",
    facts.length ? facts.map((f) => "- [" + f.kind + "] " + f.fact).join("\\n") : "- none",
    "DETERMINISTIC EXACT/STRUCTURAL BOND: " + (exactBond || "(none)"),
    "CODE-DERIVED ROLE: " + (derived || "(none)"),
    "ACTOR ORIENTATION TOWARD THIS TARGET: " + (orientation.blocked ? "BLOCKED (" + orientation.reason + ")" : "not blocked"),
    "EXPLICIT TARGET-SPECIFIC ROMANCE IN ACTOR'S OWN SHEET: " + (explicitRomance ? "YES" : "NO"),
  ].join("\\n");
}

async function genRelationshipReading(w, actor, due) {
  if (!actor || !Array.isArray(due) || !due.length) return { targets: [] };

  /*
   * ONE exhaustive own-sheet pass first. This is the source of relationship
   * facts for ALL active targets. We do not read target sheets for feelings.
   */
  const facts = await relV8ExtractOwnSheetFacts(w, actor);
  const byTarget = new Map();
  facts.forEach((fact) => {
    if (!byTarget.has(fact.targetId)) byTarget.set(fact.targetId, []);
    byTarget.get(fact.targetId).push(fact);
  });

  const wanted = due.map((d) => d.target).filter(Boolean);
  const output = [];
  const batchSize = 8;

  for (let at = 0; at < wanted.length; at += batchSize) {
    const targets = wanted.slice(at, at + batchSize);
    const prompt = [
      "EXHAUSTIVE OWN-SHEET RELATIONSHIP MAP — SYNTHESIS.",
      "Actor / sheet owner: " + String(actor.name || actor.id) + " [" + String(actor.id) + "]",
      "You are building THIS ACTOR'S directed relationships. The actor's own sheet is the ONLY emotional authority.",
      "OUTPUT LANGUAGE — HARD: " + (worldLanguage(w, w.meId) === "en"
        ? "ENGLISH ONLY in every returned user-visible field: bond, role, layers, mood, hidden, description, why and label. Never return Hungarian words or phrases."
        : "HUNGARIAN ONLY in every returned user-visible field."),
      "",
      "HARD RULES:",
      "- Use ONLY the extracted facts under each exact target. Never move a fact from one target to another.",
      "- Never import another character's feelings, history, crush, enemy, mentor, or event into this actor's relationship.",
      "- If there are no personal facts, do NOT invent personality-based feelings.",
      "- Teammate means teammate unless the actor's own facts explicitly add friendship, rivalry, hostility, romance, etc.",
      "- Structural roles (teammate, mentor/student, coworker, classmate) do NOT imply attraction, friendship, hatred, obsession, jealousy or secret feelings.",
      "- Romance is allowed ONLY when EXPLICIT TARGET-SPECIFIC ROMANCE says YES. If it says NO, attraction MUST be 0 and bond/mood/hidden/layers/description may not be romantic.",
      "- If orientation says BLOCKED, romance is impossible even if the model thinks it would be dramatic.",
      "- Do not mention any third active character in the result.",
      "- Detailed description is welcome only when the actor's own facts are detailed. If the source only says teammate, keep it simple.",
      "",
      ...targets.map((target) => relV8TargetSynthesisCard(w, actor, target, byTarget.get(String(target.id)) || [])),
      "",
      "Return one row for EVERY target above.",
      'JSON ONLY: {"targets":[{"id":"","score":0,"bond":"","role":"","layers":[],"mood":"","hidden":"","attraction":0,"fear":0,"obsession":0,"trust":0,"description":"","why":"","label":""}]}'
    ].join("\\n\\n");

    const out = await askWorldJSON(w, SHEET_ANALYST_SYSTEM, prompt, {
      maxTokens: 4200,
      priority: 58,
      source: "relationship-reading",
      quality: "deep",
      timeoutMs: 110000,
    });
    if (!out || out.skip) throw new Error("exhaustive relationship synthesis failed");

    const rows = Array.isArray(out.targets) ? out.targets : [];
    for (const target of targets) {
      const raw = rows.find((row) => row && findChar(w, row.id) === target.id);
      if (!raw) continue;
      const clean = relV8SanitizeRow(w, actor, target, raw);
      if (!clean) continue;
      output.push({ ...clean, id: target.id });
    }
  }

  return { targets: output };
}

async function runRelationshipReadingAction(view, update, action) {
  const actorId = String(action && action.payload && action.payload.actorId || "");
  const actor = charById(view, actorId);
  update((n) => { ensureSimState(n).relationshipReadingLastAt = now(); });
  if (!actor) return null;

  let due = relationshipReadingDueTargets(view, actor);
  if (action && action.payload && action.payload.playerFirst) {
    const me = view.meId;
    due = due
      .filter((row) => actor.id === me || row.target.id === me)
      .concat(due.filter((row) => !(actor.id === me || row.target.id === me)));
  }
  due = due.slice(0, RELATIONSHIP_READING_BATCH);
  if (!due.length) return "relationship-reading-nothing";

  /*
   * v8: ONE exhaustive actor sheet job at a time.
   * The legacy runner launched up to three full-sheet actor jobs in parallel.
   * That creates giant simultaneous prompts and can trip provider quotas.
   * Accuracy is preserved; only burst concurrency is removed.
   */
  let out = null;
  try {
    out = await genRelationshipReading(view, actor, due);
  } catch (error) {
    update((n) => {
      const st = relationshipReadingState(n);
      st[actor.id] = { ...(st[actor.id] || {}), failedAt: now() };
      groundedEventLog(
        n,
        "relationship-reading",
        "failed",
        actor.name + ": " + String(error && error.message || error || "AI error"),
        "sheet:" + actor.id
      );
    });
    return null;
  }

  if (out && out.skip === true) return "relationship-reading-skip";

  try {
    relationshipReadingCachePut(view, [{ actor, due, out }]);
  } catch (_) {}

  update((n) => {
    const rows = Array.isArray(out && out.targets) ? out.targets : [];
    applyRelationshipReadingRows(n, actor.id, due, rows);
  });

  return "relationship-reading";
}

function planAutoAction(view) {
  const followBack = groundedDueFollowBackAction(view);
  if (followBack) return followBack;

  /*
   * A keep-characters restart must rebuild relationships from the OWN sheets
   * promptly. Do not block the whole relationship pass behind N sequential
   * identity-canon calls. v8 reads raw structural fields itself.
   */
  if (view && view.sim && view.sim.relationshipReadingForceFresh) {
    const playerReading = relationshipReadingDueAction(view, { playerOnly: true });
    if (playerReading) return playerReading;
    const reading = relationshipReadingDueAction(view);
    if (reading) return reading;
    const identity = identityCanonDueAction(view);
    if (identity) return identity;
    const bible = characterBibleDueAction(view);
    if (bible) return bible;
    const labels = relationshipLabelDueAction(view);
    if (labels) return labels;
    return legacyGroundedPlanAutoAction(view);
  }

  return legacyV8PairPlanAutoAction(view);
}
`;

  next += helper;
  fs.writeFileSync(appPath, next, "utf8");
  console.log("[patch-status] exhaustive-own-sheet-relationship-map=v8 applied; full-sheet-chunks=on; own-sheet-emotions-only=on; romance-evidence-lock=on");
} else {
  console.log("[patch-status] exhaustive-own-sheet-relationship-map=v8 already applied");
}
