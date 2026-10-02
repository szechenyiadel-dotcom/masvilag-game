import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG PAIR-ISOLATED RELATIONSHIP READING v7";

function renameOne(name, replacement) {
  const rx = new RegExp("function\\s+" + name + "\\s*\\(");
  const matches = [...next.matchAll(new RegExp(rx.source, "g"))];
  if (matches.length !== 1) throw new Error("Relationship v6 aborted: " + name + " expected once, found " + matches.length);
  next = next.replace(rx, "function " + replacement + "(");
}

function replaceExact(oldText, newText, label) {
  const first = next.indexOf(oldText);
  const second = first >= 0 ? next.indexOf(oldText, first + oldText.length) : -1;
  if (first < 0 || second >= 0) throw new Error("Relationship v6 aborted: " + label + " anchor mismatch.");
  next = next.slice(0, first) + newText + next.slice(first + oldText.length);
}

if (!next.includes("/* " + MARKER + " */")) {
  renameOne("relationshipReadingSnippet", "legacyV6RelationshipReadingSnippet");
  renameOne("relationshipReadingHash", "legacyV6RelationshipReadingHash");
  renameOne("relationshipReadingResult", "legacyV6RelationshipReadingResult");
  renameOne("genRelationshipReading", "legacyV6GenRelationshipReading");
  renameOne("applyRelationshipReadingRows", "legacyV6ApplyRelationshipReadingRows");
  renameOne("relationshipReadingCacheKey", "legacyV6RelationshipReadingCacheKey");
  renameOne("structuralRelationshipHash", "legacyV6StructuralRelationshipHash");
  renameOne("structuralReadingDue", "legacyV6StructuralReadingDue");
  renameOne("inferCanonicalRelationshipBaseline", "legacyV6InferCanonicalRelationshipBaseline");

  replaceExact(
    "const RELATIONSHIP_READING_BATCH = 8;",
    "const RELATIONSHIP_READING_BATCH = 1;",
    "relationship batch"
  );

  replaceExact(
    'const IDENTITY_CANON_VERSION = "4";',
    'const IDENTITY_CANON_VERSION = "5";',
    "identity canon version"
  );

  const helper = `
/* \${MARKER} */
const REL_V6_RUNTIME_SKIP = /^(?:id|aiContextSummary|aiVoiceStyleCard|avatar|avatarUrl|cover|coverUrl|image|imageId|images|album|albums|photos|media|posts|comments|msgs|messages|chats|scenes|memory|memories|followers|following|baseFollowers|followerDelta|rels|relationships|relationship|socialEvents|sim|notifications|invitations)$/i;
const REL_V6_STRUCTURAL_KEYS = /^(?:job|occupation|profession|school|university|college|role|rank|organization|organisation|affiliation|faction|team|dojo|academy|club|department|workplace|employer)$/i;
const REL_V6_ROLE_WORDS = /\\b(?:head\\s+student|sensei|teacher|tan[aá]r|mentor|coach|edz[oő]|master|mester|leader|vezet[oő]|student|di[aá]k|tanul[oó]|tan[ií]tv[aá]ny|mentee|trainee|apprentice|tanonc|intern|gyakornok|employee|alkalmazott|boss|f[oő]n[oö]k|captain|kapit[aá]ny|member|tag)\\b/giu;
const REL_V6_MENTORISH = /\\b(?:sensei|teacher|tan[aá]r|mentor|coach|edz[oő]|master|mester|tan[ií]tv[aá]ny|student|di[aá]k|tanul[oó]|mentee|trainee|apprentice|tanonc)\\b/iu;

function relV6Text(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value, null, 2); } catch (_) { try { return String(value); } catch (_) { return ""; } }
}

function relV6Aliases(c) {
  if (!c) return [];
  const out = [];
  [c.name, c.nick, c.nickname, c.username, c.displayName].filter(Boolean).forEach((raw) => {
    const text = String(raw).trim().toLowerCase();
    if (text.length >= 2 && !out.includes(text)) out.push(text);
    String(raw).trim().split(/[^\\p{L}\\p{N}_-]+/u).filter((x) => x.length >= 3).forEach((x) => {
      const low = x.toLowerCase();
      if (!out.includes(low)) out.push(low);
    });
  });
  return out;
}

function relV6Mentions(text, c) {
  const low = String(text || "").toLowerCase();
  return Boolean(low && relV6Aliases(c).some((name) => low.includes(name)));
}

function relV6PairPassages(w, person, other, maxChars = 12000) {
  if (!w || !person || !other || person.id === other.id) return "";
  let raw = "";
  try { raw = String(sheetPassagesAbout(person, other, Math.max(4000, maxChars)) || ""); } catch (_) { raw = ""; }
  if (!raw) return "";

  /*
   * HARD PAIR ISOLATION:
   * sheetPassagesAbout() already returns only sentences that explicitly name THIS
   * target. Connections is handled separately by connectionCanonSnippetAbout(),
   * so remove every [connections] passage here to prevent another person's row
   * from ever entering this pair prompt.
   */
  const parts = raw
    .split(" | ")
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .filter((x) => !/^\\[(?:connections?|kapcsolatok?)\\]/i.test(x));

  const clean = [];
  for (const part of parts) {
    let ok = false;
    try { ok = textExplicitlyMentionsCharacter(w, part, other, { relationshipOnly: true }); } catch (_) { ok = false; }
    if (!ok) continue;
    if (!clean.includes(part)) clean.push(part);
  }
  return clean.join(" | ").slice(0, maxChars);
}

function relV6ForeignIdsInGeneratedRow(w, actor, target, row) {
  if (!w || !actor || !target || !row || typeof row !== "object") return [];
  const text = [
    row.bond, row.role, row.mood, row.hidden, row.why, row.label, row.description,
    ...(Array.isArray(row.layers) ? row.layers : []),
  ].filter(Boolean).join(" | ");
  if (!text) return [];
  let ids = [];
  try { ids = explicitNamedCharacterIdsInText(w, text, actor.id) || []; } catch (_) { ids = []; }
  const allowed = new Set([String(actor.id), String(target.id)]);
  return [...new Set(ids.map(String))].filter((id) => !allowed.has(id));
}

function relV6RowIsPairPure(w, actor, target, row) {
  return relV6ForeignIdsInGeneratedRow(w, actor, target, row).length === 0;
}

function relV6NormalizeAffiliation(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^the\\s+/, "")
    .replace(REL_V6_ROLE_WORDS, " ")
    .replace(/\\b(?:dojo|academy|team|club|organization|organisation|group|faction|school|university|college)\\b/giu, " ")
    .replace(/[^\\p{L}\\p{N}]+/gu, " ")
    .replace(/\\s+/g, " ")
    .trim();
}

function relV6RawAffiliations(w, c) {
  if (!c) return [];
  const raw = [];
  Object.entries(c).forEach(([key, value]) => {
    if (!REL_V6_STRUCTURAL_KEYS.test(key)) return;
    const text = relV6Text(value);
    if (text) raw.push(text);
  });
  const normalized = [];
  raw.forEach((value) => {
    String(value).split(/[\\n,;|/]+/).forEach((piece) => {
      const n = relV6NormalizeAffiliation(piece);
      if (n.length >= 2 && !normalized.includes(n)) normalized.push(n);
    });
  });
  if (normalized.length) return normalized;
  try {
    const d = identityCanonFor(w, c.id);
    if (d) {
      const values = [];
      if (Array.isArray(d.affiliations)) d.affiliations.forEach((a) => values.push(a && a.name));
      if (d.group) values.push(d.group);
      values.filter(Boolean).forEach((value) => {
        const n = relV6NormalizeAffiliation(value);
        if (n.length >= 2 && !normalized.includes(n)) normalized.push(n);
      });
    }
  } catch (_) {}
  return normalized;
}

function relV6SharedAffiliations(w, a, b) {
  const aa = relV6RawAffiliations(w, a);
  const bb = relV6RawAffiliations(w, b);
  return aa.filter((x) => bb.includes(x));
}

function relV6RoleClass(w, c) {
  if (!c) return "";
  const bits = [];
  Object.entries(c).forEach(([key, value]) => {
    if (!REL_V6_STRUCTURAL_KEYS.test(key)) return;
    bits.push(relV6Text(value));
  });
  try {
    const d = identityCanonFor(w, c.id);
    if (d) {
      bits.push(d.role, d.group);
      if (Array.isArray(d.affiliations)) d.affiliations.forEach((a) => bits.push(a && a.role));
    }
  } catch (_) {}
  const text = bits.filter(Boolean).join(" ").toLowerCase();
  if (/\\b(?:sensei|teacher|tan[aá]r|mentor|coach|edz[oő]|master|mester)\\b/i.test(text)) return "mentor";
  if (/\\b(?:head\\s+student|student|di[aá]k|tanul[oó]|tan[ií]tv[aá]ny|mentee|trainee|apprentice|tanonc)\\b/i.test(text)) return "student";
  return "";
}

function relV6ExplicitPairRole(w, actor, target) {
  let text = "";
  try { text += String(connectionCanonSnippetAbout(w, actor, target, 50000) || ""); } catch (_) {}
  text += "\\n" + relV6PairPassages(w, actor, target, 12000);
  text += "\\n" + relV6PairPassages(w, target, actor, 8000);
  const low = text.toLowerCase();
  if (!low || !REL_V6_MENTORISH.test(low)) return false;
  return /\\b(?:his|her|their|my|your)\\s+(?:sensei|teacher|mentor|coach|master|student|mentee|apprentice|trainee)\\b/i.test(low) ||
    /\\b(?:sensei|teacher|mentor|coach|master)\\s+(?:of|to|for)\\b/i.test(low) ||
    /\\b(?:student|mentee|apprentice|trainee)\\s+(?:of|under)\\b/i.test(low) ||
    /\\b(?:teaches|teaching|taught|coaches|coaching|mentors|mentoring|trains|training|trained by|training under)\\b/i.test(low) ||
    /\\b(?:senseie|sensei-je|mentora|tan[aá]ra|edz[oő]je|mestere|tan[ií]tv[aá]nya|mentor[aá]lja|tan[ií]tja|edzi|k[eé]pzi)\\b/i.test(low);
}

function relV6DerivedRole(w, actor, target) {
  if (relV6ExplicitPairRole(w, actor, target)) return "explicit";
  const shared = relV6SharedAffiliations(w, actor, target);
  if (!shared.length) return "";
  const a = relV6RoleClass(w, actor);
  const b = relV6RoleClass(w, target);
  if (a === "mentor" && b === "student") return "Tanítvány";
  if (a === "student" && b === "mentor") return "Mentor";
  if (a || b) return "Csapattárs";
  return "Csapattárs";
}

function relV6StructuralSummary(w, c) {
  if (!c) return "(none)";
  const rows = [];
  Object.entries(c).forEach(([key, value]) => {
    if (!REL_V6_STRUCTURAL_KEYS.test(key)) return;
    const text = relV6Text(value);
    if (text) rows.push(key + ": " + text);
  });
  try {
    const line = identityCanonLine(w, c);
    if (line) rows.push("identity-canon: " + line);
  } catch (_) {}
  return rows.length ? rows.join("\\n") : "(none)";
}

function relationshipReadingSnippet(w, actor, target) {
  if (!w || !actor || !target || actor.id === target.id || isMediaAccount(w, target.id)) return "";
  let actorExact = "", targetExact = "";
  try { actorExact = String(connectionCanonSnippetAbout(w, actor, target, 50000) || ""); } catch (_) {}
  try { targetExact = String(connectionCanonSnippetAbout(w, target, actor, 50000) || ""); } catch (_) {}
  const actorOther = relV6PairPassages(w, actor, target, 14000);
  const targetOther = relV6PairPassages(w, target, actor, 9000);
  const direct = Boolean(actorExact || actorOther);
  const reverse = Boolean(targetExact || targetOther);
  if (!direct && !reverse) return "";

  /*
   * IMPORTANT: do NOT include actor.connections or target.connections wholesale.
   * The model sees ONLY the exact target's parsed Connections entry plus exact
   * target-naming passages elsewhere. This makes cross-person leakage impossible
   * at the input level.
   */
  return [
    "PAIR-ISOLATED SOURCE: " + String(actor.name || actor.id) + " → " + String(target.name || target.id),
    "ALLOWED PEOPLE IN THIS READING: " + String(actor.name || actor.id) + " AND " + String(target.name || target.id) + " ONLY.",
    "",
    "ACTOR → THIS EXACT TARGET — CONNECTIONS ENTRY:",
    actorExact || "(none)",
    "",
    "ACTOR SHEET — ONLY PASSAGES THAT EXPLICITLY NAME THIS EXACT TARGET:",
    actorOther || "(none)",
    "",
    "ACTOR STRUCTURAL DATA:",
    relV6StructuralSummary(w, actor),
    "",
    "TARGET STRUCTURAL DATA:",
    relV6StructuralSummary(w, target),
    "",
    "TARGET → ACTOR — EXACT CONNECTIONS ENTRY, OBJECTIVE SHARED FACTS ONLY:",
    targetExact || "(none)",
    "",
    "TARGET SHEET — ONLY PASSAGES THAT EXPLICITLY NAME THE ACTOR, OBJECTIVE SHARED FACTS ONLY:",
    targetOther || "(none)",
    "",
    "NO OTHER CHARACTER'S CONNECTION ENTRY OR STORY MAY BE USED FOR THIS PAIR.",
  ].join("\\n");
}

function relationshipReadingHash(snippet) {
  return simsSocialStableHash("v7-pair-isolated|" + String(snippet || ""));
}

function relationshipReadingCacheKey(actor, target, snippet) {
  return "rr7-pair-isolated:" + simsSocialStableHash(String(actor && actor.name || "") + "|" + String(target && target.name || "") + "|" + relationshipReadingHash(snippet));
}

function structuralRelationshipHash(w, actor, target) {
  return "s2-strict-groups|" + simsSocialStableHash(
    identityCanonLine(w, actor) + "|" +
    identityCanonLine(w, target) + "|" +
    relV6RawAffiliations(w, actor).join(",") + "|" +
    relV6RawAffiliations(w, target).join(",") + "|" +
    relV6RoleClass(w, actor) + "|" + relV6RoleClass(w, target)
  );
}

function relV6StripBadStructural(value) {
  const parts = String(value || "").split(/\\s*(?:\\+|\\/|\\||,|;)\\s*/).filter(Boolean);
  const kept = parts.filter((part) => !REL_V6_MENTORISH.test(part));
  return kept.join(" + ");
}

function relV6SanitizeRow(w, actor, target, input) {
  if (!input || typeof input !== "object") return input;
  const row = { ...input };
  const explicit = relV6ExplicitPairRole(w, actor, target);
  const derived = relV6DerivedRole(w, actor, target);
  const derivedMentorish = /^(?:Mentor|Tan[ií]tv[aá]ny)$/i.test(String(derived || ""));
  const hasMentorish = REL_V6_MENTORISH.test(String(row.role || "") + " " + String(row.bond || ""));
  if (hasMentorish && !explicit && !derivedMentorish) {
    row.role = derived && derived !== "explicit" ? derived : "";
    row.bond = relV6StripBadStructural(row.bond);
    row.layers = (Array.isArray(row.layers) ? row.layers : []).filter((x) => !REL_V6_MENTORISH.test(String(x || "")));
  } else if (!explicit && derived && derived !== "explicit") {
    row.role = derived;
  }
  if (derived && derived !== "explicit") {
    const layers = Array.isArray(row.layers) ? row.layers.map(String) : [];
    if (!layers.some((x) => x.toLowerCase() === derived.toLowerCase())) layers.push(derived);
    row.layers = layers;
  }
  const desc = String(row.description || row.mood || "").trim();
  if (desc) row.description = desc;
  return row;
}

function relationshipReadingResult(w, actor, target) {
  const row = legacyV6RelationshipReadingResult(w, actor, target);
  return row ? relV6SanitizeRow(w, actor, target, row) : row;
}

function inferCanonicalRelationshipBaseline(w, actor, target) {
  const base = legacyV6InferCanonicalRelationshipBaseline(w, actor, target);
  if (!base || !actor || !target || actor.id === target.id) return base;
  const beforeBond = String(base.bond || base.type || "");
  const beforeRole = String(base.role || "");
  const hadMentorish = REL_V6_MENTORISH.test(beforeBond + " " + beforeRole);
  if (!hadMentorish) return base;
  const clean = relV6SanitizeRow(w, actor, target, {
    ...base,
    bond: beforeBond,
    role: beforeRole,
    layers: Array.isArray(base.layers) ? base.layers : [],
  });
  const out = { ...base, bond: String(clean.bond || ""), role: String(clean.role || "") };
  if (hadMentorish && !REL_V6_MENTORISH.test(out.bond + " " + out.role) && !out.bond) {
    out.score = 0;
    if (REL_V6_MENTORISH.test(String(out.mood || ""))) out.mood = "";
    if (REL_V6_MENTORISH.test(String(out.hidden || ""))) out.hidden = "";
  }
  return out;
}

async function relV6ExtractLongSource(w, actor, target, source) {
  const chunkSize = 15000;
  const chunks = [];
  for (let at = 0; at < source.length; at += chunkSize) chunks.push(source.slice(at, at + chunkSize));
  const facts = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const prompt = [
      "RELATIONSHIP SOURCE PASS " + (i + 1) + "/" + chunks.length + ".",
      "Read this ENTIRE block and extract EVERY fact relevant to " + String(actor.name || actor.id) + " → " + String(target.name || target.id) + ".",
      "Keep separate layers: formal role, shared organization/dojo/school/work, friendship, rivalry, hostility, romance, family, loyalty, distrust, secrecy, one-sided feelings, history.",
      "Do not copy reverse private feelings into the actor.",
      "Sensei/mentor/teacher/student relations require either an explicit pair statement OR the SAME concrete named organization plus complementary roles. Different organizations can NEVER create teacher/student merely because one person is a sensei and the other a student.",
      "SOURCE:",
      chunks[i],
      'JSON ONLY: {"facts":["..."]}'
    ].join("\\n\\n");
    const out = await askWorldJSON(w, SHEET_ANALYST_SYSTEM, prompt, { maxTokens: 1800, priority: 55, source: "relationship-reading", quality: "deep", timeoutMs: 110000 });
    if (!out || out.skip) throw new Error("relationship source pass failed");
    (Array.isArray(out.facts) ? out.facts : []).forEach((fact) => {
      const text = String(fact || "").trim();
      if (text && !facts.includes(text)) facts.push(text);
    });
  }
  return facts.join("\\n- ");
}

async function genRelationshipReading(w, actor, due) {
  const en = worldLanguage(w, w.meId) === "en";
  const lang = en ? "English" : "Hungarian";
  const targetRow = due && due[0];
  if (!targetRow || !targetRow.target) return { targets: [] };
  const target = targetRow.target;
  let source = String(targetRow.snippet || "");
  if (source.length > 38000) {
    source = "FACTS EXTRACTED FROM COMPLETE MULTI-PASS READING:\\n- " + await relV6ExtractLongSource(w, actor, target, source);
  }
  const shared = relV6SharedAffiliations(w, actor, target);
  const derivedRole = relV6DerivedRole(w, actor, target);
  const prompt = [
    "RELATIONSHIP READING v6 — ONE PAIR, DEEP FULL-SHEET ANALYSIS.",
    "Actor: " + String(actor.name || actor.id) + " [" + String(actor.id) + "]",
    "Target: " + String(target.name || target.id) + " [" + String(target.id) + "]",
    "",
    "PAIR ISOLATION — HARD: the source has already been filtered to this exact pair. Use ONLY facts explicitly supplied for ACTOR ↔ TARGET. Never import, infer, recall or mention any third character, even if you know them from another sheet, prior call, character bible, world context or stereotype. The ACTOR exact-target Connections entry is highest authority. Other actor passages are allowed only because they explicitly name this target. Reverse-sheet material is objective shared history/structure only; never copy target-private feelings into the actor.",
    "MULTI-LAYER RULE: preserve ALL supported layers simultaneously. A person can be student + rival + friend, mentor + enemy, coworker + ex, teammate + crush, etc. Do not collapse a layered relationship to one generic word.",
    "STRUCTURAL HARD RULE: Sensei/mentor/teacher/coach ↔ student/mentee exists only if (A) the pair is explicitly named that way in the sheets, OR (B) both belong to the SAME concrete named organization/dojo/team/school/workplace and their roles are complementary. A Wasabi sensei is NOT the teacher/mentor of an Iron Dragons student merely because one is a sensei and the other is a student. Different named organizations = no inferred teacher/student link.",
    "Exact shared affiliations detected by code: " + (shared.length ? shared.join(", ") : "(none)"),
    "Code-supported structural role from actor side: " + (derivedRole || "(none)"),
    "",
    "Return:",
    "- score -100..100",
    "- bond = strongest personal/official relationship layer; if multiple equally important layers, combine them briefly rather than deleting one",
    "- role = formal structural tie from actor side, or empty",
    "- layers = every supported relationship layer",
    "- mood = concise current emotional dynamic",
    "- hidden = actor-side hidden/denied feeling only",
    "- attraction/fear/obsession/trust 0..100",
    "- description = detailed 3–6 sentence " + lang + " paraphrase explaining how they know each other, formal hierarchy/affiliation, major history, current personal dynamic, conflicts/loyalty/attraction, and one-sided/hidden nuance when present",
    "- why = short factual basis",
    "- label = vivid 2–6 word tag",
    "Never quote the sheet wording verbatim. Never invent.",
    "",
    "FULL SOURCE:",
    source,
    "",
    'JSON ONLY: {"targets":[{"id":"' + String(target.id) + '","score":0,"bond":"","role":"","layers":[],"mood":"","hidden":"","attraction":0,"fear":0,"obsession":0,"trust":0,"description":"","why":"","label":""}]}'
  ].join("\\n");
  let out = await askWorldJSON(w, SHEET_ANALYST_SYSTEM, prompt, { maxTokens: 3000, priority: 55, source: "relationship-reading", quality: "deep", timeoutMs: 110000 });
  if (!out || out.skip) return out;

  let rows = (Array.isArray(out.targets) ? out.targets : [])
    .filter((row) => row && findChar(w, row.id) === target.id)
    .map((row) => relV6SanitizeRow(w, actor, target, row));

  const leaked = rows.some((row) => !relV6RowIsPairPure(w, actor, target, row));
  if (leaked) {
    const badIds = [...new Set(rows.flatMap((row) => relV6ForeignIdsInGeneratedRow(w, actor, target, row)))];
    console.warn("[relationship-reading] rejected third-person leakage", actor.id, target.id, badIds.join(","));

    const recoveryPrompt = [
      "PAIR-ISOLATED RELATIONSHIP RECOVERY.",
      "Rewrite the relationship using ONLY these two people: " + String(actor.name || actor.id) + " and " + String(target.name || target.id) + ".",
      "HARD: do not mention, imply, compare with, defend, attack, become jealous over, or explain the relationship through ANY third person.",
      "If a claim cannot be supported without a third person, OMIT that claim entirely.",
      "Do not invent events.",
      "",
      "PAIR SOURCE:",
      source,
      "",
      'JSON ONLY: {"targets":[{"id":"' + String(target.id) + '","score":0,"bond":"","role":"","layers":[],"mood":"","hidden":"","attraction":0,"fear":0,"obsession":0,"trust":0,"description":"","why":"","label":""}]}'
    ].join("\\n");

    try {
      out = await askWorldJSON(w, SHEET_ANALYST_SYSTEM, recoveryPrompt, { maxTokens: 2200, priority: 55, source: "relationship-reading", quality: "deep", timeoutMs: 110000 });
      rows = (out && Array.isArray(out.targets) ? out.targets : [])
        .filter((row) => row && findChar(w, row.id) === target.id)
        .map((row) => relV6SanitizeRow(w, actor, target, row))
        .filter((row) => relV6RowIsPairPure(w, actor, target, row));
    } catch (_) {
      rows = [];
    }
  }

  /* Wrong pair data is worse than no AI reading. Never persist a contaminated row. */
  out = out && typeof out === "object" ? out : {};
  out.targets = rows.filter((row) => relV6RowIsPairPure(w, actor, target, row));
  return out;
}

function applyRelationshipReadingRows(n, actorId, due, rows) {
  const actor = charById(n, actorId);
  const clean = (rows || []).map((row) => {
    const target = row ? charById(n, findChar(n, row.id)) : null;
    return actor && target ? relV6SanitizeRow(n, actor, target, row) : row;
  });
  legacyV6ApplyRelationshipReadingRows(n, actorId, due, clean);
  const state = relationshipReadingState(n);
  const store = ensureRelationshipBaselineStore(n);
  due.forEach(({ target }) => {
    const row = clean.find((r) => r && findChar(n, r.id) === target.id);
    const liveTarget = charById(n, target.id);
    if (!row || !actor || !liveTarget) return;
    const sanitized = relV6SanitizeRow(n, actor, liveTarget, row);
    const entry = state && state[actorId] && state[actorId].targets && state[actorId].targets[target.id];
    const desc = String(sanitized.description || sanitized.mood || "").trim().slice(0, 1400);
    const layers = (Array.isArray(sanitized.layers) ? sanitized.layers : []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 12);
    if (entry) {
      entry.description = desc;
      entry.layers = layers;
      if (desc) entry.mood = desc;
      entry.role = String(sanitized.role || entry.role || "").slice(0, 100);
    }
    const key = relKey(actorId, target.id);
    if (store[key]) {
      if (desc) store[key].mood = desc;
      store[key].role = String(sanitized.role || store[key].role || "").slice(0, 100);
      store[key].layers = layers;
      store[key].relationshipDescription = desc;
      store[key].source = "connections-ai-v6";
    }
    const live = n.rels && n.rels[key];
    if (live && live.freshFromSheet === true) {
      n.rels[key] = {
        ...live,
        role: String(sanitized.role || live.role || "").slice(0, 100),
        layers,
        relationshipDescription: desc,
        mood: desc || live.mood,
      };
    }
  });
}

function structuralReadingDue(w) {
  if (!w) return null;
  const state = relationshipReadingState(w);
  if (!state) return null;
  const targets = allSubjects(w).filter((c) => c && c.id && !isMediaAccount(w, c.id) && identityCanonFor(w, c.id));
  for (const target of targets) {
    const actors = [];
    for (const actor of targets) {
      if (!actor || actor.id === target.id || isMediaAccount(w, actor.id)) continue;
      if (relationshipReadingSnippet(w, actor, target)) continue;
      const shared = relV6SharedAffiliations(w, actor, target);
      if (!shared.length) continue;
      const meta = state[actor.id] || {};
      const row = meta.targets && meta.targets[target.id];
      const hash = structuralRelationshipHash(w, actor, target);
      if (row && row.structural && row.hash === hash) continue;
      if (meta.structuralFailedAt && now() - Number(meta.structuralFailedAt) < RELATIONSHIP_READING_RETRY_MS) continue;
      actors.push({ actor, hash });
      if (actors.length >= STRUCTURAL_READING_BATCH) break;
    }
    if (actors.length) return { target, actors };
  }
  return null;
}
`;

  next += helper;
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("[patch-status] pair-isolated-relationship-reading=v7 applied; cache=rr7; third-person-leakage=blocked");
} else {
  console.log("[patch-status] pair-isolated-relationship-reading=v7 already applied");
}
