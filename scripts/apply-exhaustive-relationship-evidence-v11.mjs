import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;
const MARKER = "MÁSVILÁG EXHAUSTIVE RELATIONSHIP EVIDENCE v11";

function renameOne(name, replacement) {
  const rx = new RegExp("function\\s+" + name + "\\s*\\(");
  const matches = [...next.matchAll(new RegExp(rx.source, "g"))];
  if (matches.length !== 1) throw new Error("Relationship v11 aborted: " + name + " expected once, found " + matches.length);
  next = next.replace(rx, "function " + replacement + "(");
}

if (!next.includes("/* " + MARKER + " */")) {
  renameOne("relV8ExtractOwnSheetFacts", "legacyV11RelV8ExtractOwnSheetFacts");
  renameOne("relV8TargetSynthesisCard", "legacyV11RelV8TargetSynthesisCard");
  renameOne("relV8SanitizeRow", "legacyV11RelV8SanitizeRow");
  renameOne("relationshipReadingHash", "legacyV11RelationshipReadingHash");
  renameOne("relationshipReadingCacheKey", "legacyV11RelationshipReadingCacheKey");
  renameOne("officialRelationshipStatusForPair", "legacyV11OfficialRelationshipStatusForPair");

  const helper = `
/* ${MARKER} */
const REL_V11_ONE_NIGHT_RE = /(?:\\bone[- ]?night stand\\b|\\bone night together\\b|\\bspent (?:the )?night together\\b|egy[eé]jszak[aá]s(?: kaland| kapcsolat| viszony)?|egy [eé]jszak[aá]t t[oö]lt[oö]ttek)/i;
const REL_V11_HOOKUP_RE = /(?:\\bhook(?:ed)? up\\b|\\bhookup\\b|\\bslept with\\b|\\bhad sex\\b|\\bsexual encounter\\b|lefek[uü]dt(?:ek)?|alkalmi viszony|alkalmi kapcsolat)/i;
const REL_V11_MEETING_RE = /(?:\\bfirst met\\b|\\bmet (?:at|in|during|through|when)\\b|\\bencountered\\b|\\bcrossed paths\\b|\\bknow each other\\b|\\bknew each other\\b|tal[aá]lkozt(?:ak|ak)|megismerked(?:tek|ett)|ismerik egym[aá]st|k[oö]z[oö]s m[uú]lt|shared history|history together)/i;
const REL_V11_OBSESSION_RE = /(?:\\bobsess(?:ed|ion|ive)?\\b|\\bfixat(?:ed|ion)\\b|megsz[aá]ll(?:ott|otts[aá]g)?|r[aá]kattan(?:t|va)?)/i;
const REL_V11_ATTRACTION_RE = /(?:\\battraction\\b|\\battracted\\b|\\bchemistry\\b|\\bsexual tension\\b|vonzalom|vonz[oó]d|k[eé]mia|szexu[aá]lis fesz[uü]lts[eé]g)/i;
const REL_V11_CRUSH_RE = /(?:\\bcrush\\b|\\bin love\\b|\\blove interest\\b|szerelmes|szerelem)/i;
const REL_V11_STRUCTURAL = new Set(["Mentor", "Student", "Teammate", "Classmate", "Coworker"]);
const REL_V11_REAL_DATING = new Set(["Dating", "Seeing each other", "Engaged", "Spouse"]);

function relV11RowText(row) {
  if (!row || typeof row !== "object") return "";
  return [row.bond, row.role, row.mood, row.hidden, row.why, row.label, row.description,
    ...(Array.isArray(row.layers) ? row.layers : [])].filter(Boolean).join(" ");
}

function relV11Localize(value, lang) {
  const key = String(value || "").trim();
  if (asLang(lang) === "en") return key;
  const hu = {"One-night stand":"Egyéjszakás kaland",Hookup:"Alkalmi viszony",Acquaintance:"Ismerős",Obsession:"Megszállottság",Attraction:"Vonzalom"};
  return hu[key] || localizedBond(key, lang);
}

function relV11Add(parts, value) {
  if (value && !parts.includes(value)) parts.push(value);
}

function relV11DirectedParts(w, actor, target, row) {
  const parts = [...relV9CanonicalBondParts(w, actor, target)];
  const source = String(relV9PairText(w, actor, target) || "").toLowerCase();
  const exact = String(relV9ExactPairConnectionText(w, actor, target) || "").toLowerCase();
  const rowText = relV11RowText(row).toLowerCase();
  const hasRow = Boolean(row && typeof row === "object");

  /* Directional emotions are accepted from the isolated owner-side AI row, not raw prose alone. */
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (["Crush", "Mutual crush", "Obsession"].includes(parts[i])) parts.splice(i, 1);
  }

  const shared = (re) => re.test(exact) || (hasRow && re.test(source) && re.test(rowText));
  if (shared(REL_V11_ONE_NIGHT_RE)) relV11Add(parts, "One-night stand");
  else if (shared(REL_V11_HOOKUP_RE)) relV11Add(parts, "Hookup");

  if (hasRow && REL_V11_OBSESSION_RE.test(source) && (Number(row.obsession) > 0 || REL_V11_OBSESSION_RE.test(rowText))) relV11Add(parts, "Obsession");

  if (hasRow && relV9OrientationAllows(w, actor, target)) {
    const mutual = /mutual crush|mutual attraction|k[oö]lcs[oö]n[oö]s crush|k[oö]lcs[oö]n[oö]s vonzalom/i;
    if (mutual.test(source) && mutual.test(rowText)) relV11Add(parts, "Mutual crush");
    else if (REL_V11_CRUSH_RE.test(source) && REL_V11_CRUSH_RE.test(rowText)) relV11Add(parts, "Crush");
    else if (REL_V11_ATTRACTION_RE.test(source) && (Number(row.attraction) > 0 || REL_V11_ATTRACTION_RE.test(rowText))) relV11Add(parts, "Attraction");
  }

  if (!relV9OrientationAllows(w, actor, target)) {
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      if (["Crush", "Mutual crush", "Attraction"].includes(parts[i])) parts.splice(i, 1);
    }
  }

  const personal = parts.some((x) => !REL_V11_STRUCTURAL.has(x));
  if (!personal && hasRow && REL_V11_MEETING_RE.test(source) && REL_V11_MEETING_RE.test(rowText)) relV11Add(parts, "Acquaintance");
  return parts.slice(0, 12);
}

function relV11Unsupported(w, actor, target, parts, value) {
  const low = String(value || "").toLowerCase();
  if (!low) return false;
  if (REL_V9_FAKE_RE.test(low) && !parts.includes("Fake dating")) return true;
  const negatedDating = /not\\s+dating|not\\s+a\\s+couple|aren['’]?t\\s+dating|never\\s+dated|nem\\s+j[aá]rnak|nem\\s+egy\\s+p[aá]r/i.test(low);
  if (REL_V9_ROMANTIC_STATUS_RE.test(low) && !REL_V9_FAKE_RE.test(low) && !negatedDating && !parts.some((x) => REL_V11_REAL_DATING.has(x))) return true;
  if (REL_V11_CRUSH_RE.test(low) && !parts.some((x) => ["Crush","Mutual crush"].includes(x))) return true;
  if (REL_V11_ATTRACTION_RE.test(low) && !parts.some((x) => ["Attraction","Crush","Mutual crush"].includes(x))) return true;
  if (REL_V11_OBSESSION_RE.test(low) && !parts.includes("Obsession")) return true;
  if (REL_V11_ONE_NIGHT_RE.test(low) && !parts.includes("One-night stand")) return true;
  if (REL_V11_HOOKUP_RE.test(low) && !parts.some((x) => ["Hookup","One-night stand"].includes(x))) return true;
  if (/(?:\\b(?:sensei|mentor|teacher|coach|student|mentee|apprentice)\\b|tan[ií]tv[aá]ny|tan[aá]r|edz[oő])/i.test(low) && !parts.some((x) => ["Mentor","Student"].includes(x))) return true;
  if (/(?:\\bteammates?\\b|team[- ]?mates?|dojo[- ]?mates?|csapatt[aá]rs|doj[oó]t[aá]rs)/i.test(low) && !parts.includes("Teammate")) return true;
  return false;
}

async function relV8ExtractOwnSheetFacts(w, actor) {
  const facts = await legacyV11RelV8ExtractOwnSheetFacts(w, actor);
  const merged = Array.isArray(facts) ? [...facts] : [];
  const sheet = relV8FullOwnSheet(actor);
  const chunks = relV8Chunks(sheet, 10000);
  const roster = relV8Roster(w, actor);
  const validIds = new Set(roster.map((r) => r.id));

  for (let i = 0; i < chunks.length; i += 1) {
    const known = merged.map((f) => "- targetId=" + f.targetId + " | " + f.fact).join("\\n") || "- none";
    const prompt = [
      "RELATIONSHIP COMPLETENESS AUDIT v11 — PASS " + (i + 1) + "/" + chunks.length + ".",
      "Sheet owner: " + String(actor.name || actor.id) + ". Read ONLY this owner's sheet block.",
      "The first extraction is listed below. Find EVERY relationship fact in this block that it MISSED.",
      "ATOMIC FACTS — HARD: the same target may need many rows. Meeting/history, one-night stand/hookup, attraction, obsession, fear, trust, friendship, hostility, rivalry and structural roles are separate facts. Never stop after one factor.",
      "DIRECTION — HARD: private feelings belong only to the sheet owner. If the TARGET is obsessed with/loves/hates the owner, do not reverse that into the owner's feeling. Objective shared events may be extracted.",
      "SEMANTICS — HARD: fake dating != dating; one-night stand/hookup != dating; obsession != romance unless romance is separately explicit; teammate != friend; sensei/student stays on the exact pair.",
      "THIRD PEOPLE — HARD: never move a fact from one named person to another. Omit third-person material from the pair fact.",
      "Return ONLY genuinely missing facts. If nothing is missing, return an empty facts array.",
      "",
      "ACTIVE ROSTER:\\n" + relV8RosterText(w, actor),
      "",
      "ALREADY EXTRACTED:\\n" + known,
      "",
      "OWN-SHEET BLOCK:\\n" + chunks[i],
      "",
      'JSON ONLY: {"facts":[{"targetId":"","fact":"one atomic missing owner→target or objective shared-history fact","kind":"structural|history|friendship|hostility|romance|family|trust|fear|rivalry|other"}]}'
    ].join("\\n");
    const out = await askWorldJSON(w, SHEET_ANALYST_SYSTEM, prompt, {maxTokens:3600,priority:58,source:"relationship-reading",quality:"deep",timeoutMs:110000});
    if (!out || out.skip) continue;
    for (const row of (Array.isArray(out.facts) ? out.facts : [])) {
      const targetId = String(row && row.targetId || "");
      const fact = String(row && row.fact || "").trim();
      if (!validIds.has(targetId) || !fact) continue;
      if (relV8ForeignIdsInFact(w, actor, targetId, fact).length) continue;
      const norm = fact.toLowerCase().replace(/\\s+/g, " ").trim();
      if (merged.some((x) => String(x.targetId) === targetId && String(x.fact || "").toLowerCase().replace(/\\s+/g, " ").trim() === norm)) continue;
      merged.push({key:targetId+"|"+norm,targetId,fact,kind:String(row && row.kind || "other").trim().toLowerCase()});
    }
  }
  return merged;
}

function relV8TargetSynthesisCard(w, actor, target, facts) {
  const rows = Array.isArray(facts) ? facts : [];
  const factText = rows.map((f) => String(f && f.fact || "")).join(" ");
  const orientation = romanceOrientationState(w, actor.id, target.id);
  const activeRomance = !orientation.blocked && (REL_V11_ATTRACTION_RE.test(factText) || REL_V11_CRUSH_RE.test(factText) || /\\b(?:dating|boyfriend|girlfriend|spouse|wife|husband|engaged|fianc[eé]|married)\\b|j[aá]rnak|p[aá]rkapcsolat/i.test(factText));
  return [
    "TARGET id="+String(target.id)+" | name="+String(target.name||""),
    "ALL EXTRACTED OWN-SHEET FACTS ("+rows.length+"):",
    rows.length ? rows.map((f,i)=>"- FACT "+(i+1)+" ["+f.kind+"] "+f.fact).join("\\n") : "- none",
    "COMPLETENESS — HARD: preserve EVERY fact above. Do not collapse the pair to one factor. Put distinct supported factors in layers and preserve history/details in description/why.",
    "HISTORY — HARD: a documented meeting, encounter, one-night stand, hookup or shared event means NOT STRANGERS even when they are not friends/dating.",
    "ONE-NIGHT/HOOKUP — HARD: history, not Dating unless Dating is separately explicit.",
    "OBSESSION — HARD: its own directed fact; not automatically romantic.",
    "STRUCTURE — HARD: teammate/sensei/student only when the exact pair/compatible shared group supports it.",
    "ACTOR ORIENTATION: "+(orientation.blocked?"BLOCKED ("+orientation.reason+")":"not blocked"),
    "EXPLICIT ACTIVE ROMANCE FROM OWNER FACTS: "+(activeRomance?"YES":"NO")
  ].join("\\n");
}

function relV8SanitizeRow(w, actor, target, input) {
  if (!input || typeof input !== "object") return input;
  let row = relV6SanitizeRow(w, actor, target, {...input});
  if (!row || typeof row !== "object" || !relV6RowIsPairPure(w, actor, target, row)) return null;
  const lang = worldLanguage(w, w.meId);
  const parts = relV11DirectedParts(w, actor, target, row);
  const canon = parts.map((x) => relV11Localize(x, lang));
  const layers = [];
  const add = (x) => { const v=String(x||"").trim(); if(v && !layers.some((y)=>y.toLowerCase()===v.toLowerCase())) layers.push(v); };
  canon.forEach(add);
  for (const x of (Array.isArray(row.layers)?row.layers:[])) {
    const v=String(x||"").trim();
    if (v && !relV11Unsupported(w,actor,target,parts,v) && relV6RowIsPairPure(w,actor,target,{layers:[v]})) add(v.slice(0,180));
  }
  row.layers = layers.slice(0,12);
  const rawBond = String(row.bond||"").trim();
  row.bond = canon.length ? canon.join(" / ").slice(0,220) : (!relV11Unsupported(w,actor,target,parts,rawBond) ? rawBond.slice(0,220) : "");
  const structural = relV9StrictStructuralRole(w, actor, target);
  row.role = structural ? relV11Localize(structural, lang) : "";
  if (!relV9OrientationAllows(w,actor,target) || !parts.some((x)=>["Dating","Seeing each other","Engaged","Spouse","Crush","Mutual crush","Attraction"].includes(x))) row.attraction=0;
  if (!parts.includes("Obsession")) row.obsession=0;
  for (const key of ["mood","hidden","description","why","label"]) if (relV11Unsupported(w,actor,target,parts,row[key])) row[key]="";
  if (!row.bond && String(row.description||row.mood||row.why||"").trim()) {
    row.bond=relV11Localize("Acquaintance",lang); row.layers.length||row.layers.push(row.bond);
    if (!Number.isFinite(Number(row.score)) || (Number(row.score)>-5 && Number(row.score)<15)) row.score=20;
  }
  if (lang === "en" && generatedTextLooksHungarian({bond:row.bond,role:row.role,layers:row.layers,mood:row.mood,hidden:row.hidden,description:row.description,why:row.why,label:row.label})) {
    row.mood=""; row.hidden=""; row.description=""; row.why=""; row.label="";
  }
  if (!row.label && row.bond) row.label=row.bond;
  return row;
}

function officialRelationshipStatusForPair(w, ownerId, targetId, lang = CURRENT_LANG) {
  const actor=charById(w,ownerId), target=charById(w,targetId);
  if (actor && target) {
    const live=getRel(w,ownerId,targetId)||null;
    const parts=relV11DirectedParts(w,actor,target,live);
    for (const x of ["Fake dating","One-night stand","Hookup","Obsession","Mutual crush","Crush","Attraction","Best friend","Close friend","Friend","Enemy","Rival","Mentor","Student","Teammate","Classmate","Coworker","Acquaintance"]) if(parts.includes(x)) return relV11Localize(x,lang);
  }
  return legacyV11OfficialRelationshipStatusForPair(w, ownerId, targetId, lang);
}

function relationshipReadingHash(snippet) { return simsSocialStableHash("v11-exhaustive-evidence|"+String(snippet||"")); }
function relationshipReadingCacheKey(actor,target,snippet) { return "rr11-exhaustive-evidence:"+simsSocialStableHash(String(actor&&actor.name||"")+"|"+String(target&&target.name||"")+"|"+relationshipReadingHash(snippet)); }
`;

  next += helper;
  fs.writeFileSync(appPath, next, "utf8");
  console.log("[patch-status] exhaustive-relationship-evidence=v11 applied; second-pass-audit=on; multi-fact-preservation=on; one-night-history=on; directed-obsession=on; rr11-reread=on");
} else {
  console.log("[patch-status] exhaustive-relationship-evidence=v11 already applied");
}
