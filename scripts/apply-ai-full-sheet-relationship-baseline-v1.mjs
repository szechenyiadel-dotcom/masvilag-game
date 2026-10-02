import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG NATIVE FULL-SHEET RELATIONSHIP READING v6";

function renameOne(name, replacement) {
  const rx = new RegExp("function\\\\s+" + name + "\\\\s*\\\\(");
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
const REL_V6_ROLE_WORDS = /\\\\b(?:head\\\\s+student|sensei|teacher|tan[aá]r|mentor|coach|edz[oő]|master|mester|leader|vezet[oő]|student|di[aá]k|tanul[oó]|tan[ií]tv[aá]ny|mentee|trainee|apprentice|tanonc|intern|gyakornok|employee|alkalmazott|boss|f[oő]n[oö]k|captain|kapit[aá]ny|member|tag)\\\\b/giu;
const REL_V6_MENTORISH = /\\\\b(?:sensei|teacher|tan[aá]r|mentor|coach|edz[oő]|master|mester|tan[ií]tv[aá]ny|student|di[aá]k|tanul[oó]|mentee|trainee|apprentice|tanonc)\\\\b/iu;

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
    String(raw).trim().split(/[^\\\\p{L}\\\\p{N}_-]+/u).filter((x) => x.length >= 3).forEach((x) => {
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

function relV6FullFieldsMentioning(person, other) {
  if (!person || !other) return "";
  const rows = [];
  Object.entries(person).forEach(([key, value]) => {
    if (REL_V6_RUNTIME_SKIP.test(key) || /^(?:connections?|kapcsolatok?)$/i.test(key)) return;
    const text = relV6Text(value);
    if (!text || !relV6Mentions(text, other)) return;
    rows.push("[" + key + "]\\\\n" + text);
  });
  return rows.join("\\\\n\\\\n");
}

function relV6Connections(person) {
  if (!person || typeof person !== "object") return "";
  return Object.entries(person)
    .filter(([key]) => /^(?:connections?|kapcsolatok?|relationshipsCanon|relationshipCanon)$/i.test(key))
    .map(([key, value]) => "[" + key + "]\\\\n" + relV6Text(value))
    .filter(Boolean)
    .join("\\\\n\\\\n");
}

function relV6NormalizeAffiliation(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/^the\\\\s+/, "")
    .replace(REL_V6_ROLE_WORDS, " ")
    .replace(/\\\\b(?:dojo|academy|team|club|organization|organisation|group|faction|school|university|college)\\\\b/giu, " ")
    .replace(/[^\\\\p{L}\\\\p{N}]+/gu, " ")
    .replace(/\\\\s+/g, " ")
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
    String(value).split(/[\\\\n,;|/]+/).forEach((piece) => {
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
  if (/\\\\b(?:sensei|teacher|tan[aá]r|mentor|coach|edz[oő]|master|mester)\\\\b/i.test(text)) return "mentor";
  if (/\\\\b(?:head\\\\s+student|student|di[aá]k|tanul[oó]|tan[ií]tv[aá]ny|mentee|trainee|apprentice|tanonc)\\\\b/i.test(text)) return "student";
  return "";
}

function relV6ExplicitPairRole(w, actor, target) {
  let text = "";
  try { text += String(connectionCanonSnippetAbout(w, actor, target, 50000) || ""); } catch (_) {}
  text += "\\\\n" + relV6FullFieldsMentioning(actor, target);
  text += "\\\\n" + relV6FullFieldsMentioning(target, actor);
  return REL_V6_MENTORISH.test(text);
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
  return rows.length ? rows.join("\\\\n") : "(none)";
}

function relationshipReadingSnippet(w, actor, target) {
  if (!w || !actor || !target || actor.id === target.id || isMediaAccount(w, target.id)) return "";
  const actorConnections = relV6Connections(actor);
  const targetConnections = relV6Connections(target);
  const actorOther = relV6FullFieldsMentioning(actor, target);
  const targetOther = relV6FullFieldsMentioning(target, actor);
  const direct = relV6Mentions(actorConnections, target) || Boolean(actorOther);
  const reverse = relV6Mentions(targetConnections, actor) || Boolean(targetOther);
  if (!direct && !reverse) return "";
  return [
    "PAIR: " + String(actor.name || actor.id) + " → " + String(target.name || target.id),
    "",
    "ACTOR FULL CONNECTIONS SECTION — READ ALL OF IT, BUT ONLY FACTS ABOUT THIS TARGET MAY DEFINE THIS PAIR:",
    actorConnections || "(none)",
    "",
    "ACTOR OTHER FULL SHEET FIELDS THAT MENTION TARGET:",
    actorOther || "(none)",
    "",
    "ACTOR STRUCTURAL DATA:",
    relV6StructuralSummary(w, actor),
    "",
    "TARGET STRUCTURAL DATA:",
    relV6StructuralSummary(w, target),
    "",
    "REVERSE FULL CONNECTIONS SECTION — OBJECTIVE SHARED HISTORY/STRUCTURE ONLY; NEVER COPY TARGET'S PRIVATE FEELINGS INTO ACTOR:",
    targetConnections || "(none)",
    "",
    "TARGET OTHER FULL SHEET FIELDS THAT MENTION ACTOR — OBJECTIVE FACTS ONLY:",
    targetOther || "(none)",
  ].join("\\\\n");
}

function relationshipReadingHash(snippet) {
  return simsSocialStableHash("v6-fullsheet-strict-groups|" + String(snippet || ""));
}

function relationshipReadingCacheKey(actor, target, snippet) {
  return "rr6-fullsheet-strict-groups:" + simsSocialStableHash(String(actor && actor.name || "") + "|" + String(target && target.name || "") + "|" + relationshipReadingHash(snippet));
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
  const parts = String(value || "").split(/\\\\s*(?:\\\\+|\\\\/|\\\\||,|;)\\\\s*/).filter(Boolean);
  const kept = parts.filter((part) => !REL_V6_MENTORISH.test(part));
  return kept.join(" + ");
}

function relV6SanitizeRow(w, actor, target, input) {
  if (!input || typeof input !== "object") return input;
  const row = { ...input };
  const explicit = relV6ExplicitPairRole(w, actor, target);
  const derived = relV6DerivedRole(w, actor, target);
  const hasMentorish = REL_V6_MENTORISH.test(String(row.role || "") + " " + String(row.bond || ""));
  if (hasMentorish && !explicit && !derived) {
    row.role = "";
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
    ].join("\\\\n\\\\n");
    const out = await askWorldJSON(w, SHEET_ANALYST_SYSTEM, prompt, { maxTokens: 1800, priority: 55, source: "relationship-reading", quality: "deep", timeoutMs: 110000 });
    if (!out || out.skip) throw new Error("relationship source pass failed");
    (Array.isArray(out.facts) ? out.facts : []).forEach((fact) => {
      const text = String(fact || "").trim();
      if (text && !facts.includes(text)) facts.push(text);
    });
  }
  return facts.join("\\\\n- ");
}

async function genRelationshipReading(w, actor, due) {
  const en = worldLanguage(w, w.meId) === "en";
  const lang = en ? "English" : "Hungarian";
  const targetRow = due && due[0];
  if (!targetRow || !targetRow.target) return { targets: [] };
  const target = targetRow.target;
  let source = String(targetRow.snippet || "");
  if (source.length > 38000) {
    source = "FACTS EXTRACTED FROM COMPLETE MULTI-PASS READING:\\\\n- " + await relV6ExtractLongSource(w, actor, target, source);
  }
  const shared = relV6SharedAffiliations(w, actor, target);
  const derivedRole = relV6DerivedRole(w, actor, target);
  const prompt = [
    "RELATIONSHIP READING v6 — ONE PAIR, DEEP FULL-SHEET ANALYSIS.",
    "Actor: " + String(actor.name || actor.id) + " [" + String(actor.id) + "]",
    "Target: " + String(target.name || target.id) + " [" + String(target.id) + "]",
    "",
    "Read EVERY supplied fact before deciding. The ACTOR'S full Connections section is authoritative for actor → target, plus every other actor field that mentions this target. Reverse-sheet material is only shared objective history/structure; never copy the target's private feelings into the actor.",
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
  ].join("\\\\n");
  const out = await askWorldJSON(w, SHEET_ANALYST_SYSTEM, prompt, { maxTokens: 3000, priority: 55, source: "relationship-reading", quality: "deep", timeoutMs: 110000 });
  if (!out || out.skip) return out;
  const rows = Array.isArray(out.targets) ? out.targets : [];
  out.targets = rows.map((row) => relV6SanitizeRow(w, actor, target, row));
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
  console.log("[patch-status] native-full-sheet-relationship-reading=v6 applied; cache=rr6; strict-cross-group-role-validation=on");
} else {
  console.log("[patch-status] native-full-sheet-relationship-reading=v6 already applied");
}
