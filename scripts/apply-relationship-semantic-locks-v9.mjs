import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;
const MARKER = "MÁSVILÁG RELATIONSHIP SEMANTIC LOCKS v9";

function renameOne(name, replacement) {
  const rx = new RegExp("function\\s+" + name + "\\s*\\(");
  const matches = [...next.matchAll(new RegExp(rx.source, "g"))];
  if (matches.length !== 1) throw new Error("Relationship v9 aborted: " + name + " expected once, found " + matches.length);
  next = next.replace(rx, "function " + replacement + "(");
}

function replaceExact(oldText, newText, label) {
  const first = next.indexOf(oldText);
  const second = first >= 0 ? next.indexOf(oldText, first + oldText.length) : -1;
  if (first < 0 || second >= 0) throw new Error("Relationship v9 aborted: " + label + " anchor mismatch.");
  next = next.slice(0, first) + newText + next.slice(first + oldText.length);
}

if (!next.includes("/* " + MARKER + " */")) {
  renameOne("exactConnectionBondLabel", "legacyV9ExactConnectionBondLabel");
  renameOne("connectionRelationshipCue", "legacyV9ConnectionRelationshipCue");
  renameOne("relV8ExplicitRomance", "legacyV9RelV8ExplicitRomance");
  renameOne("relV8NonRomanticBond", "legacyV9RelV8NonRomanticBond");
  renameOne("relV8SanitizeRow", "legacyV9RelV8SanitizeRow");
  renameOne("directedRomanticOfficialKind", "legacyV9DirectedRomanticOfficialKind");
  renameOne("relationshipRomanceActive", "legacyV9RelationshipRomanceActive");
  renameOne("relationshipCrushActive", "legacyV9RelationshipCrushActive");
  renameOne("officialRelationshipStatusForPair", "legacyV9OfficialRelationshipStatusForPair");
  renameOne("relLabel", "legacyV9RelLabel");
  renameOne("relationshipReadingHash", "legacyV9RelationshipReadingHash");
  renameOne("relationshipReadingCacheKey", "legacyV9RelationshipReadingCacheKey");

  /* Relationship output language validation must include bond/role-ish fields. */
  replaceExact(
    "if (!/^(?:id|ids|language|image|imageId|imagePrompt|postId|post_id|targetId|target_id|a|b|to|from|authorId|reply_to|replyTo|kind|type|status|bond|hangnem|tone)$/i.test(key)) out.push(value);",
    "if (!/^(?:id|ids|language|image|imageId|imagePrompt|postId|post_id|targetId|target_id|a|b|to|from|authorId|reply_to|replyTo|kind|type|status|hangnem|tone)$/i.test(key)) out.push(value);",
    "generated language validation relationship fields"
  );

  const helper = `
/* ${MARKER} */
const REL_V9_ROMANTIC_STATUS_RE = /(?:\\b(?:dating|boyfriend|girlfriend|couple|partner|spouse|wife|husband|engaged|fianc[eé]|married)\\b|j[aá]rnak|p[aá]rkapcsolat|bar[aá]tn[oő]je|pasija|feles[eé]g|f[eé]rj|jegyes|h[aá]zas)/i;
const REL_V9_CRUSH_RE = /(?:\\b(?:crush|attraction|attracted|romantic|in love|love interest)\\b|vonzalom|vonz[oó]d|szerelmes|szerelem)/i;
const REL_V9_FAKE_RE = /(?:[aá]lkapcsolat|[aá]l-kapcsolat|kamu ?(?:kapcsolat|p[aá]r)|fake[- ]?dat|fake (?:relationship|couple|girlfriend|boyfriend)|pretend(?:ing)? to (?:date|be (?:a )?couple|be together)|fake-dating)/i;
const REL_V9_MENTOR_RE = /(?:\\b(?:my|his|her|their|your)\\s+(?:sensei|mentor|teacher|coach|master)\\b|\\b(?:sensei|mentor|teacher|coach|master)\\s+(?:to|for|of)\\b|\\b(?:teaches|teaching|taught|mentors|mentoring|coaches|coaching|trains|training|trained)\\b|senseie|sensei-je|mentora|tan[aá]ra|edz[oő]je|mestere)/i;
const REL_V9_STUDENT_RE = /(?:\\b(?:my|his|her|their|your)\\s+(?:student|mentee|apprentice|trainee|prot[eé]g[eé])\\b|\\b(?:student|mentee|apprentice|trainee|prot[eé]g[eé])\\s+(?:of|under)\\b|tan[ií]tv[aá]nya|di[aá]kja)/i;
const REL_V9_TEAMMATE_RE = /(?:\\bteammates?\\b|team[- ]?mates?|dojo[- ]?mates?|csapatt[aá]rs|doj[oó]t[aá]rs)/i;

function relV9PairText(w, actor, target) {
  if (!w || !actor || !target) return "";
  let exact = "", elsewhere = "";
  try { exact = String(connectionCanonSnippetAbout(w, actor, target, 50000) || ""); } catch (_) {}
  try { elsewhere = String(relV6PairPassages(w, actor, target, 16000) || ""); } catch (_) {}
  return [exact, elsewhere].filter(Boolean).join("\\n");
}

function relV9WithoutFakeDating(text) {
  return String(text || "")
    .replace(/fake[- ]?dating/gi, " ")
    .replace(/fake\\s+(?:relationship|couple|girlfriend|boyfriend)/gi, " ")
    .replace(/pretend(?:ing)?\\s+to\\s+(?:date|be\\s+(?:a\\s+)?couple|be\\s+together)/gi, " ")
    .replace(/[aá]l[- ]?kapcsolat/gi, " ")
    .replace(/kamu\\s*(?:kapcsolat|p[aá]r)/gi, " ");
}

function relV9OrientationAllows(w, actor, target) {
  if (!actor || !target || actor.id === target.id) return false;
  const actorGender = characterGenderAttractionClass(actor);
  const targetGender = characterGenderAttractionClass(target);
  const orientation = characterOrientationAttractionClass(actor);

  if (orientation === "none") return false;
  if (orientation === "multi") return true;

  const binary =
    (actorGender === "male" || actorGender === "female") &&
    (targetGender === "male" || targetGender === "female");

  if (!binary) return true;
  if (orientation === "opposite") return actorGender !== targetGender;
  if (orientation === "same") return actorGender === targetGender;
  return true;
}

function relV9RoleClassRaw(c) {
  if (!c) return "";
  const text = [
    c.role, c.rank, c.job, c.occupation, c.affiliation, c.organization,
    c.organisation, c.faction, c.team, c.dojo, c.academy, c.school, c.university
  ].filter(Boolean).map(String).join(" ").toLowerCase();
  if (/\\b(?:sensei|teacher|mentor|coach|master|tan[aá]r|edz[oő]|mester)\\b/i.test(text)) return "mentor";
  if (/\\b(?:head\\s+student|student|mentee|apprentice|trainee|prot[eé]g[eé]|di[aá]k|tanul[oó]|tan[ií]tv[aá]ny)\\b/i.test(text)) return "student";
  return "";
}

function relV9NormalizeGroup(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\\b(?:head\\s+student|sensei|teacher|mentor|coach|master|student|mentee|apprentice|trainee|intern|employee|member|leader|captain|tan[aá]r|edz[oő]|mester|di[aá]k|tanul[oó]|tan[ií]tv[aá]ny|gyakornok|alkalmazott|tag|vezet[oő]|kapit[aá]ny)\\b/giu, " ")
    .replace(/\\b(?:dojo|academy|team|club|organization|organisation|faction|school|university|college|workplace)\\b/giu, " ")
    .replace(/[^\\p{L}\\p{N}]+/gu, " ")
    .replace(/\\s+/g, " ")
    .trim();
}

function relV9GroupRows(c) {
  if (!c) return [];
  const rows = [];
  const fields = [
    ["dojo", c.dojo], ["team", c.team], ["faction", c.faction],
    ["organization", c.organization], ["organization", c.organisation],
    ["affiliation", c.affiliation], ["academy", c.academy],
    ["school", c.school], ["school", c.university], ["school", c.college],
    ["role", c.role], ["job", c.job], ["job", c.occupation]
  ];
  for (const [kind, raw] of fields) {
    if (!raw) continue;
    const value = relV9NormalizeGroup(raw);
    if (!value || value.length < 3 || /^(?:male|female|man|woman|student|teacher|mentor|sensei)$/.test(value)) continue;
    if (!rows.some((r) => r.kind === kind && r.value === value)) rows.push({ kind, value });
  }

  try {
    const karate = karateFactionKey(factionFlags(c));
    if (karate && !rows.some((r) => r.kind === "dojo" && r.value === karate)) rows.push({ kind: "dojo", value: karate });
  } catch (_) {}

  return rows;
}

function relV9SharedGroup(w, actor, target) {
  const a = relV9GroupRows(actor);
  const b = relV9GroupRows(target);
  for (const left of a) {
    for (const right of b) {
      if (left.value !== right.value) continue;
      const kinds = new Set([left.kind, right.kind]);
      if (kinds.has("dojo") || kinds.has("team") || kinds.has("faction")) return { kind: "team", value: left.value };
      if (kinds.has("school") || kinds.has("academy")) return { kind: "school", value: left.value };
      if (kinds.has("organization") || kinds.has("job") || kinds.has("affiliation")) return { kind: "organization", value: left.value };
      return { kind: left.kind, value: left.value };
    }
  }
  return null;
}

function relV9StrictStructuralRole(w, actor, target) {
  const own = relV9PairText(w, actor, target);
  const low = own.toLowerCase();

  if (REL_V9_MENTOR_RE.test(low)) return "Mentor";
  if (REL_V9_STUDENT_RE.test(low)) return "Student";
  if (REL_V9_TEAMMATE_RE.test(low)) return "Teammate";

  const shared = relV9SharedGroup(w, actor, target);
  if (!shared) return "";

  const aRole = relV9RoleClassRaw(actor);
  const bRole = relV9RoleClassRaw(target);
  if (aRole === "mentor" && bRole === "student") return "Student";
  if (aRole === "student" && bRole === "mentor") return "Mentor";

  if (shared.kind === "team") return "Teammate";
  if (shared.kind === "school" && aRole === "student" && bRole === "student") return "Classmate";
  if (shared.kind === "organization") return "Coworker";
  return "";
}

function relV9CanonicalBondParts(w, actor, target) {
  const source = relV9PairText(w, actor, target);
  const low = source.toLowerCase();
  if (!low) {
    const structural = relV9StrictStructuralRole(w, actor, target);
    return structural ? [structural] : [];
  }

  const parts = [];
  const push = (x) => { if (x && !parts.includes(x)) parts.push(x); };

  const fake = REL_V9_FAKE_RE.test(low) || isFakeDatingText(low);
  const realText = relV9WithoutFakeDating(low);

  if (/mother|\\bmom\\b|\\bmum\\b|anya|édesany/.test(low)) push("Mother");
  if (/father|\\bdad\\b|apa|édesap/.test(low)) push("Father");
  if (/sister|brother|sibling|testv[eé]r/.test(low) && !/like (?:a )?(?:sister|brother|sibling)|chosen (?:sister|brother)/.test(low)) push("Sibling");
  if (/cousin|unokatestv[eé]r/.test(low)) push("Cousin");

  if (fake) push("Fake dating");
  else {
    if (/spouse|wife|husband|married|h[aá]zast[aá]rs|feles[eé]g|f[eé]rj/.test(realText)) push("Spouse");
    else if (/engaged|fianc[eé]|jegyes/.test(realText)) push("Engaged");
    else if (/\\b(?:dating|boyfriend|girlfriend|couple)\\b|j[aá]rnak|p[aá]rkapcsolat/.test(realText)) push("Dating");
    else if (/seeing each other|randizgat/.test(realText)) push("Seeing each other");
  }

  if (/\\bex(?:es)?\\b|ex-boyfriend|ex-girlfriend|volt p[aá]r/.test(low)) push("Exes");

  if (/best friend|ride\\s*or\\s*die|legjobb bar[aá]t|chosen (?:sister|brother)/.test(low)) push("Best friend");
  else if (/close friend|k[oö]zeli bar[aá]t/.test(low)) push("Close friend");
  else if (/\\bfriend\\b|bar[aá]t|ally|sz[oö]vets[eé]ges/.test(low)) push("Friend");

  if (connectionTextIsHostile(low)) push("Enemy");
  else if (/rival|riv[aá]lis|competition|verseng|vet[eé]lyt[aá]rs/.test(low)) push("Rival");

  const romanticText = relV9WithoutFakeDating(low);
  if (relV9OrientationAllows(w, actor, target)) {
    if (/mutual crush|mutual attraction|k[oö]lcs[oö]n[oö]s crush|k[oö]lcs[oö]n[oö]s vonzalom/.test(romanticText)) push("Mutual crush");
    else if (/obsess|romantic fixation|megsz[aá]ll/.test(romanticText) && REL_V9_CRUSH_RE.test(romanticText)) push("Obsession");
    else if (REL_V9_CRUSH_RE.test(romanticText)) push("Crush");
  }

  const structural = relV9StrictStructuralRole(w, actor, target);
  if (structural) push(structural);

  return parts.slice(0, 6);
}

function relationshipReadingHash(snippet) {
  return simsSocialStableHash("v9-semantic-locks|" + String(snippet || ""));
}

function relationshipReadingCacheKey(actor, target, snippet) {
  return "rr9-semantic-locks:" + simsSocialStableHash(
    String(actor && actor.name || "") + "|" +
    String(target && target.name || "") + "|" +
    relationshipReadingHash(snippet)
  );
}

function exactConnectionBondLabel(w, actor, target) {
  return relV9CanonicalBondParts(w, actor, target).join(" / ");
}

function connectionRelationshipCue(w, actor, target) {
  const snippet = relV9PairText(w, actor, target);
  const low = snippet.toLowerCase();
  const parts = relV9CanonicalBondParts(w, actor, target);
  const fake = parts.includes("Fake dating");
  const romanticText = relV9WithoutFakeDating(low);
  return {
    snippet,
    romantic: relV9OrientationAllows(w, actor, target) && parts.some((x) => ["Crush", "Mutual crush", "Obsession", "Dating", "Seeing each other", "Engaged", "Spouse"].includes(x)),
    close: parts.includes("Best friend") || parts.includes("Close friend"),
    friendly: parts.some((x) => ["Friend", "Close friend", "Best friend"].includes(x)),
    hostile: parts.includes("Enemy"),
    rival: parts.includes("Rival"),
    family: parts.some((x) => ["Mother", "Father", "Sibling", "Cousin"].includes(x)),
    mentor: parts.includes("Mentor") || parts.includes("Student"),
    jealous: /jealous|f[eé]lt[eé]ken|possessive|birtokl[oó]|territorial/.test(low),
    secret: /secret|hidden|titkos|rejtett|senki nem tud|doesn['’]?t know/.test(low),
    fakeDating: fake,
  };
}

function relV8ExplicitRomance(w, actor, target) {
  if (!w || !actor || !target || !relV9OrientationAllows(w, actor, target)) return false;
  const parts = relV9CanonicalBondParts(w, actor, target);
  if (parts.includes("Fake dating") && !parts.some((x) => ["Crush", "Mutual crush", "Obsession"].includes(x))) return false;
  return parts.some((x) => ["Dating", "Seeing each other", "Engaged", "Spouse", "Crush", "Mutual crush", "Obsession"].includes(x));
}

function relV8NonRomanticBond(w, actor, target) {
  const parts = relV9CanonicalBondParts(w, actor, target);
  const keep = parts.filter((x) => !["Dating", "Seeing each other", "Engaged", "Spouse", "Crush", "Mutual crush", "Obsession"].includes(x));
  return keep.join(" / ");
}

function relV9UnsupportedRestrictedText(w, actor, target, value) {
  const text = String(value || "");
  if (!text) return false;
  const parts = relV9CanonicalBondParts(w, actor, target);
  const lowParts = parts.join(" ").toLowerCase();
  const low = text.toLowerCase();

  const checks = [
    [/fake[- ]?dat|[aá]lkapcsolat/, "fake dating"],
    [/\\b(?:dating|boyfriend|girlfriend|couple|spouse|wife|husband|engaged|fianc[eé]|married)\\b|j[aá]rnak/, "dating"],
    [/\\b(?:crush|attraction|attracted|romantic|in love)\\b|vonzalom|szerelmes/, "crush"],
    [/\\b(?:sensei|mentor|teacher|coach|student|mentee|apprentice)\\b|tan[ií]tv[aá]ny|tan[aá]r|edz[oő]/, "mentor"],
    [/\\bteammate\\b|team[- ]?mate|csapatt[aá]rs|dojo[- ]?mate/, "teammate"],
  ];
  for (const [re, needed] of checks) {
    if (re.test(low)) {
      if (needed === "fake dating" && !parts.includes("Fake dating")) return true;
      if (needed === "dating") {
        const onlyFake = parts.includes("Fake dating") && !parts.some((x) => ["Dating","Seeing each other","Engaged","Spouse"].includes(x));
        if (onlyFake && !REL_V9_FAKE_RE.test(low)) return true;
        if (!parts.some((x) => ["Dating","Seeing each other","Engaged","Spouse","Fake dating"].includes(x))) return true;
      }
      if (needed === "crush" && !parts.some((x) => ["Crush","Mutual crush","Obsession"].includes(x))) return true;
      if (needed === "mentor" && !parts.some((x) => ["Mentor","Student"].includes(x))) return true;
      if (needed === "teammate" && !parts.includes("Teammate")) return true;
    }
  }
  return false;
}

function relV9LocalizeCanonical(value, lang) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .split(/\\s*\\/\\s*/)
    .map((x) => localizedBond(x, lang))
    .join(" / ");
}

function relV8SanitizeRow(w, actor, target, input) {
  if (!input || typeof input !== "object") return input;
  let row = legacyV9RelV8SanitizeRow(w, actor, target, { ...input });
  if (!row || typeof row !== "object") return row;

  const lang = worldLanguage(w, w.meId);
  const parts = relV9CanonicalBondParts(w, actor, target);
  const structuralOnly = parts.length > 0 && parts.every((x) => ["Mentor","Student","Teammate","Classmate","Coworker"].includes(x));
  const fake = parts.includes("Fake dating");
  const actualRomance = parts.some((x) => ["Dating","Seeing each other","Engaged","Spouse","Crush","Mutual crush","Obsession"].includes(x));
  const canonicalBond = parts.join(" / ");

  if (canonicalBond) {
    row.bond = relV9LocalizeCanonical(canonicalBond, lang);
    row.layers = parts.map((x) => localizedBond(x, lang));
  } else {
    row.bond = "";
    row.layers = [];
    row.score = 0;
  }

  const structural = relV9StrictStructuralRole(w, actor, target);
  row.role = structural ? localizedBond(structural, lang) : "";

  if (fake && !actualRomance) {
    row.attraction = 0;
    row.obsession = 0;
    for (const key of ["mood","hidden","description","why","label"]) {
      const value = String(row[key] || "");
      const low = value.toLowerCase();
      const soundsRealDating = REL_V9_ROMANTIC_STATUS_RE.test(low) && !REL_V9_FAKE_RE.test(low);
      if (REL_V9_CRUSH_RE.test(low) || soundsRealDating) row[key] = "";
    }
    row.bond = localizedBond("Fake dating", lang);
    row.layers = [localizedBond("Fake dating", lang)];
  }

  if (!actualRomance) row.attraction = 0;

  for (const key of ["mood","hidden","description","why","label"]) {
    if (relV9UnsupportedRestrictedText(w, actor, target, row[key])) row[key] = "";
  }

  if (structuralOnly) {
    row.attraction = 0;
    row.obsession = 0;
    row.hidden = "";
    if (!relV9PairText(w, actor, target).match(REL_V8_PERSONAL_WORDS)) {
      row.mood = "";
      row.description = "";
      row.why = "";
      row.label = "";
      row.score = relV8DefaultScoreForBond(parts[0]);
    }
  }

  if (lang === "en") {
    const visible = {
      bond: row.bond, role: row.role, layers: row.layers, mood: row.mood,
      hidden: row.hidden, description: row.description, why: row.why, label: row.label,
    };
    if (generatedTextLooksHungarian(visible)) {
      row.mood = "";
      row.hidden = "";
      row.description = "";
      row.why = "";
      row.label = "";
    }
  }

  if (!row.label && row.bond) row.label = row.bond;
  return row;
}

function directedRomanticOfficialKind(rel) {
  const bond = String(rel && (rel.bond || rel.type) || "");
  if (isFakeDatingText(bond)) return "fake-dating";
  return legacyV9DirectedRomanticOfficialKind(rel);
}

function relationshipRomanceActive(w, actorId, targetId, rel = null) {
  const actor = charById(w, actorId), target = charById(w, targetId);
  if (!actor || !target) return false;
  if (!relV9OrientationAllows(w, actor, target)) return false;
  const parts = relV9CanonicalBondParts(w, actor, target);
  if (parts.includes("Fake dating") && !parts.some((x) => ["Crush","Mutual crush","Obsession"].includes(x))) return false;
  return parts.some((x) => ["Dating","Seeing each other","Engaged","Spouse","Crush","Mutual crush","Obsession"].includes(x));
}

function relationshipCrushActive(w, actorId, targetId, rel = null) {
  const actor = charById(w, actorId), target = charById(w, targetId);
  if (!actor || !target) return false;
  if (!relV9OrientationAllows(w, actor, target)) return false;
  const parts = relV9CanonicalBondParts(w, actor, target);
  return parts.some((x) => ["Crush","Mutual crush","Obsession"].includes(x));
}

function officialRelationshipStatusForPair(w, ownerId, targetId, lang = CURRENT_LANG) {
  const actor = charById(w, ownerId), target = charById(w, targetId);
  if (actor && target) {
    const own = relV9CanonicalBondParts(w, actor, target);
    const reverse = relV9CanonicalBondParts(w, target, actor);
    if (own.includes("Fake dating") || reverse.includes("Fake dating")) return officialKindLabel("fake-dating", lang);
    const real = ["Spouse","Engaged","Dating","Seeing each other"];
    for (const x of real) {
      if (own.includes(x) && reverse.includes(x)) {
        const key = x === "Spouse" ? "spouse" : x === "Engaged" ? "engaged" : x === "Dating" ? "dating" : "seeing";
        return officialKindLabel(key, lang);
      }
    }
  }
  return legacyV9OfficialRelationshipStatusForPair(w, ownerId, targetId, lang);
}

function relLabel(r) {
  if (!r) return "";
  const lang = CURRENT_LANG;
  const bond = localizedBond(r.bond || r.type || "", lang);
  const rawLabel = String(r.label || "").trim();
  if (asLang(lang) === "en" && rawLabel && generatedTextLooksHungarian({ label: rawLabel })) {
    return bond || relType(r.score || 0);
  }
  if (rawLabel) return localizedRelationshipDisplayText(rawLabel, lang);
  if (r.mood) {
    const mood = localizedRelationshipDisplayText(r.mood, lang);
    if (!(asLang(lang) === "en" && generatedTextLooksHungarian({ mood }))) return mood;
  }
  return bond || relType(r.score || 0);
}
`;

  next += helper;
  fs.writeFileSync(appPath, next, "utf8");
  console.log("[patch-status] relationship-semantic-locks=v9 applied; cache=rr9; fake-dating-lock=on; strict-team-dojo=on; english-visible-guard=on");
} else {
  console.log("[patch-status] relationship-semantic-locks=v9 already applied");
}
