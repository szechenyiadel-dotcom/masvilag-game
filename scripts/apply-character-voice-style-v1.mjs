import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG CHARACTER VOICE STYLE v1";

function countMatches(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  return [...text.matchAll(new RegExp(regex.source, flags))].length;
}

function replaceOne(regex, replacement, label) {
  const count = countMatches(next, regex);
  if (count !== 1) {
    throw new Error(`Character voice style patch aborted: ${label} expected 1 match, found ${count}.`);
  }
  next = next.replace(regex, replacement);
}

if (!next.includes(`/* ${MARKER} */`)) {
  /* Prevent the stored voice card from feeding back into the sheet hash. */
  const skipOld = /const skip = \/\^\(\?:aiContextSummary\|avatar\|avatarUrl\|image\|imageId\|images\|album\|albums\|photos\|media\|posts\|comments\|msgs\|messages\|chats\|scenes\|memory\|memories\)\$\/i;/;
  if (skipOld.test(next)) {
    next = next.replace(
      skipOld,
      'const skip = /^(?:aiContextSummary|aiVoiceStyleCard|avatar|avatarUrl|image|imageId|images|album|albums|photos|media|posts|comments|msgs|messages|chats|scenes|memory|memories)$/i;'
    );
  } else if (!next.includes("aiContextSummary|aiVoiceStyleCard|avatar")) {
    throw new Error("Character voice style patch aborted: characterSheetSourceParts skip anchor not found.");
  }

  replaceOne(
    /function\s+voiceCard\s*\(/,
    "function legacyVoiceStyleVoiceCard(",
    "voiceCard"
  );
  replaceOne(
    /function\s+worldContext\s*\(/,
    "function legacyVoiceStyleWorldContext(",
    "worldContext"
  );
  replaceOne(
    /function\s+cleanGeneratedUtterance\s*\(/,
    "function legacyVoiceStyleCleanGeneratedUtterance(",
    "cleanGeneratedUtterance"
  );
  replaceOne(
    /function\s+cleanGeneratedComment\s*\(/,
    "function legacyVoiceStyleCleanGeneratedComment(",
    "cleanGeneratedComment"
  );

  /* A single stricter regeneration is allowed only in the high-level generators
     below. The provider/gate itself is not touched. */
  const generatorRenames = [
    [/async function\s+genReply\s*\(/, "async function legacyVoiceStyleGenReply(", "genReply"],
    [/async function\s+genComments\s*\(/, "async function legacyVoiceStyleGenComments(", "genComments"],
    [/async function\s+genDM\s*\(/, "async function legacyVoiceStyleGenDM(", "genDM"],
    [/async function\s+genWorldStep\s*\(/, "async function legacyVoiceStyleGenWorldStep(", "genWorldStep"],
    [/async function\s+genNote\s*\(/, "async function legacyVoiceStyleGenNote(", "genNote"],
  ];
  for (const [regex, replacement, label] of generatorRenames) {
    replaceOne(regex, replacement, label);
  }

  const helper = String.raw`

/* ${MARKER} */
const VOICE_STYLE_CARD_VERSION = 1;
const VOICE_STYLE_PREFIX_MAX = 7600;
let VOICE_STYLE_STRICT_RETRY_IDS = null;

function voiceStyleRawSheet(c) {
  if (!c || typeof c !== "object") return "";
  const skip = /^(?:aiContextSummary|aiVoiceStyleCard|avatar|avatarUrl|image|imageId|images|album|albums|photos|media|posts|comments|msgs|messages|chats|scenes|memory|memories)$/i;
  return Object.entries(c)
    .filter(([key]) => !skip.test(String(key || "")))
    .map(([key, value]) => {
      let rendered = "";
      try {
        rendered = typeof simsSocialStringify === "function"
          ? simsSocialStringify(value)
          : String(value == null ? "" : value);
      } catch {
        rendered = String(value == null ? "" : value);
      }
      return rendered ? String(key) + ": " + rendered : "";
    })
    .filter(Boolean)
    .join("\n");
}

function voiceStyleSourceHash(c) {
  const raw = voiceStyleRawSheet(c);
  return typeof simsSocialStableHash === "function"
    ? simsSocialStableHash(raw)
    : String(raw.length) + ":" + raw.slice(0, 80);
}

function voiceStyleUnique(rows, max = 8) {
  const out = [];
  for (const raw of rows || []) {
    const value = String(raw || "").replace(/\s+/g, " ").trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase("hu-HU");
    if (out.some((item) => item.key === key)) continue;
    out.push({ key, value });
    if (out.length >= max) break;
  }
  return out.map((item) => item.value);
}

function voiceStyleKeywordSnippets(raw, pattern, max = 8) {
  const text = String(raw || "");
  if (!text) return [];
  const lines = text.split(/\n+/).filter(Boolean);
  const direct = lines
    .filter((line) => pattern.test(line))
    .map((line) => line.slice(0, 420));
  if (direct.length >= max) return voiceStyleUnique(direct, max);

  const extra = [];
  const probe = new RegExp(pattern.source, pattern.flags.replace("g", ""));
  let cursor = 0;
  while (cursor < text.length && extra.length < max) {
    const slice = text.slice(cursor);
    const match = slice.match(probe);
    if (!match || match.index == null) break;
    const at = cursor + match.index;
    const start = Math.max(0, at - 170);
    const end = Math.min(text.length, at + Math.max(match[0].length, 20) + 220);
    extra.push(text.slice(start, end).replace(/\s+/g, " ").trim());
    cursor = at + Math.max(1, match[0].length);
  }
  return voiceStyleUnique([...direct, ...extra], max);
}

function voiceStyleTraitCandidates(c, raw) {
  const rows = [];
  const traitKey = /personality|traits?|temperament|character|szem[eé]lyis[eé]g|jellem|term[eé]szet|attitude|demeanou?r/i;
  Object.entries(c || {}).forEach(([key, value]) => {
    if (!traitKey.test(key)) return;
    const rendered = typeof simsSocialStringify === "function"
      ? simsSocialStringify(value)
      : String(value || "");
    String(rendered || "")
      .split(/[\n;,|•]+/)
      .map((x) => x.replace(/\s+/g, " ").trim())
      .filter((x) => x.length >= 2 && x.length <= 150)
      .forEach((x) => rows.push(x));
  });
  if (rows.length < 3) {
    voiceStyleKeywordSnippets(
      raw,
      /calm|nyugodt|reserved|visszafogott|stoic|sztoikus|shy|f[eé]l[eé]nk|impulsive|impulz[ií]v|lobban[eé]kony|confront|aggress|playful|j[aá]t[eé]kos|sarcast|szarkaszt|funny|humor|flirt|protect|v[eé]delmez|jealous|f[eé]lt[eé]ken|possess|birtokl|loyal|h[uű]s[eé]g|cold|hideg|warm|kedves|blunt|nyers|direct|egyenes/gi,
      5
    ).forEach((x) => rows.push(x));
  }
  return voiceStyleUnique(rows, 5);
}

function voiceStyleExampleCandidates(c, raw) {
  const rows = [];
  const exampleKey = /example|sample|quote|speechExample|messageExample|p[eé]lda|p[eé]ldamondat|id[eé]zet|mintamondat/i;
  Object.entries(c || {}).forEach(([key, value]) => {
    if (!exampleKey.test(key)) return;
    const rendered = typeof simsSocialStringify === "function"
      ? simsSocialStringify(value)
      : String(value || "");
    String(rendered || "")
      .split(/\n+/)
      .map((x) => x.replace(/\s+/g, " ").trim())
      .filter((x) => x.length >= 2)
      .slice(0, 4)
      .forEach((x) => rows.push(x.slice(0, 320)));
  });
  if (!rows.length) {
    voiceStyleKeywordSnippets(
      raw,
      /(?:example|sample|quote|p[eé]lda(?:mondat)?|id[eé]zet|mintamondat)\s*[:：-]/gi,
      3
    ).forEach((x) => rows.push(x));
  }
  return voiceStyleUnique(rows, 3);
}

function extractCharacterVoiceStyleCard(c) {
  const raw = voiceStyleRawSheet(c);
  const sourceHash = voiceStyleSourceHash(c);
  const current = c && c.aiVoiceStyleCard && typeof c.aiVoiceStyleCard === "object"
    ? c.aiVoiceStyleCard
    : null;
  if (current && current.version === VOICE_STYLE_CARD_VERSION && current.sourceHash === sourceHash && current.card) {
    return current;
  }

  const upper = /(?:csupa|mindig|kiz[aá]r[oó]lag|all|always).{0,28}(?:nagybet[uű]|caps(?:\s*lock)?|uppercase)|(?:caps(?:\s*lock)?|uppercase).{0,28}(?:[ií]r|write|speaks?|besz[eé]l)/i.test(raw);
  const lower = /(?:csupa|mindig|kiz[aá]r[oó]lag|all|always).{0,28}(?:kisbet[uű]|lowercase)|(?:lowercase).{0,28}(?:[ií]r|write|speaks?|besz[eé]l)/i.test(raw);
  const noEmoji = /(?:nem|soha|nincs|without|no|never).{0,28}(?:emoji|emodzsi)|(?:emoji|emodzsi).{0,28}(?:nem haszn[aá]l|tilos|never|none)/i.test(raw);
  const manyEmoji = /(?:sok|rengeteg|gyakran|often|lots? of|many|heavy).{0,24}(?:emoji|emodzsi)|(?:emoji|emodzsi).{0,24}(?:sok|gyakran|often|heavy)/i.test(raw);
  const noPunctuation = /(?:nem|soha|nincs|without|no|never).{0,32}(?:[ií]r[aá]sjel|punctuation)|(?:[ií]r[aá]sjel|punctuation).{0,32}(?:n[eé]lk[uü]l|nem haszn[aá]l|none|never)/i.test(raw);
  const noFinalPeriod = /(?:nem|soha|never|doesn.?t).{0,36}(?:pontot|mondatv[eé]gi pont|period|full stop).{0,20}(?:v[eé]g[eé]n|end)?|(?:no|without).{0,20}(?:final )?(?:period|full stop)/i.test(raw);
  const shortMessages = /(?:nagyon |mindig |usually |többnyire )?(?:rövid|t[oö]m[oö]r|short|brief).{0,28}(?:[uü]zenet|message|mondat|reply|v[aá]lasz)|(?:one[- ]?word|egy szavas|1[-– ]?3 szavas)/i.test(raw);
  const longMessages = /(?:hossz[uú]|r[eé]szletes|long|lengthy|detailed).{0,28}(?:[uü]zenet|message|mondat|reply|v[aá]lasz|monol[oó]g)/i.test(raw);
  const typos = /el[ií]r[aá]s|typo|misspell|helyes[ií]r[aá]si hib|sz[aá]nd[eé]kosan hib[aá]san/i.test(raw);
  const slang = /szleng|slang|internet speak|netes nyelv|gen z|gen-z|rövid[ií]t[eé]s/i.test(raw);
  const profanity = /k[aá]romkod|swear|profan|curse|tr[aá]g[aá]r|cs[uú]ny[aá]n besz[eé]l/i.test(raw);
  const alwaysSwears = /(?:mindig|álland[oó]an|folyamatosan|every|always).{0,30}(?:k[aá]romkod|swear|profan|curse)/i.test(raw);
  const nickname = /becen[eé]v|nickname|pet name|bec[eé]z/i.test(raw);
  const languageMix = /nyelvkever|language mix|mix(?:es|ing)? (?:hungarian|english|languages?)|hunglish|magyar.{0,18}angol|angol.{0,18}magyar/i.test(raw);

  let casing = "";
  if (upper && !lower) casing = "upper";
  else if (lower && !upper) casing = "lower";

  const stylePattern = /caps|uppercase|lowercase|nagybet[uű]|kisbet[uű]|emoji|emodzsi|[ií]r[aá]sjel|punctuation|pontot|period|full stop|szleng|slang|k[aá]romkod|swear|profan|el[ií]r[aá]s|typo|rövid [uü]zenet|short message|hossz[uú] [uü]zenet|long message|becen[eé]v|nickname|language mix|nyelvkever|speech|besz[eé]dst[ií]lus|[ií]r[aá]sm[oó]d|writing style/gi;
  const evidence = voiceStyleKeywordSnippets(raw, stylePattern, 8);
  const traits = voiceStyleTraitCandidates(c, raw);
  const examples = voiceStyleExampleCandidates(c, raw);

  const rules = {
    casing,
    noEmoji,
    noPunctuation,
    noFinalPeriod,
  };
  const soft = {
    manyEmoji: !noEmoji && manyEmoji,
    shortMessages,
    longMessages,
    typos,
    slang,
    profanity,
    alwaysSwears,
    nickname,
    languageMix,
  };

  const hardRows = [];
  if (casing === "upper") hardRows.push("MECHANICAL CASING: every authored message must be ALL CAPS / uppercase.");
  if (casing === "lower") hardRows.push("MECHANICAL CASING: every authored message must be all lowercase.");
  if (noEmoji) hardRows.push("EMOJI: use no emoji.");
  else if (manyEmoji) hardRows.push("EMOJI: this character explicitly uses many/frequent emoji when natural.");
  if (noPunctuation) hardRows.push("PUNCTUATION: this character uses no sentence punctuation.");
  else if (noFinalPeriod) hardRows.push("PUNCTUATION: do not end messages with a period/full stop.");
  if (shortMessages) hardRows.push("LENGTH: strongly prefer the explicitly short/brief message style.");
  if (longMessages) hardRows.push("LENGTH: this character tends toward longer/detailed messages when the situation supports it.");
  if (typos) hardRows.push("TYPOS: preserve the explicitly described typo/misspelling habit; do not overdo beyond canon.");
  if (slang) hardRows.push("SLANG: preserve the explicitly described slang/register.");
  if (profanity) hardRows.push("PROFANITY: preserve the explicitly described swearing level; do not sanitize the character into generic politeness.");
  if (nickname) hardRows.push("NICKNAMES: use established nicknames/pet names only for people the sheet/relationship supports.");
  if (languageMix) hardRows.push("LANGUAGE: preserve the explicitly described language mixing pattern.");

  const card = [
    "VOICE / WRITING STYLE CARD — HARD PERFORMANCE CONTRACT FOR " + String(c && c.name || c && c.id || "CHARACTER") + " [" + String(c && c.id || "") + "]",
    "This card controls ONLY this character's authored voice. It is author/performance data, NOT in-world knowledge other characters can quote or discover.",
    hardRows.length ? "EXPLICIT STYLE RULES:\n- " + hardRows.join("\n- ") : "EXPLICIT STYLE RULES: follow the sheet's natural writing/speech register; do not drift into generic assistant voice.",
    traits.length ? "TOP PERSONALITY / DELIVERY TRAITS:\n- " + traits.join("\n- ") : "",
    evidence.length ? "SHEET EVIDENCE — paraphrase/obey, do not quote as exposition:\n- " + evidence.join("\n- ") : "",
    examples.length ? "VOICE EXAMPLES FROM THE SHEET — imitate the pattern, never mechanically repeat the sentence:\n- " + examples.join("\n- ") : "",
    "LANGUAGE CONTRACT: Hungarian stays natural and grammatical unless the sheet explicitly requires slang/typos. Address the player in E/2; the speaker refers to themself in E/1.",
  ].filter(Boolean).join("\n\n").slice(0, 3600);

  const result = {
    version: VOICE_STYLE_CARD_VERSION,
    sourceHash,
    rules,
    soft,
    traits,
    examples,
    evidence,
    card,
    updatedAt: now(),
  };
  if (c && typeof c === "object") c.aiVoiceStyleCard = result;
  return result;
}

function characterVoiceStyleCard(c) {
  const card = extractCharacterVoiceStyleCard(c);
  return card && card.card ? String(card.card) : "";
}

function voiceStyleRetryInstruction(c) {
  if (!c || !VOICE_STYLE_STRICT_RETRY_IDS || !VOICE_STYLE_STRICT_RETRY_IDS.has(String(c.id || ""))) return "";
  return [
    "STRICT VOICE RETRY — THE PREVIOUS DRAFT VIOLATED THIS CHARACTER'S EXPLICIT STYLE.",
    "Obey the VOICE / WRITING STYLE CARD literally. Keep the content natural, but do not relax casing, message-length tendency, emoji policy, punctuation policy, slang/register, or the stated personality delivery.",
    "This is the only automatic style retry.",
  ].join("\n");
}

function voiceCard(c) {
  if (!c || typeof c !== "object") return "";
  const style = characterVoiceStyleCard(c);
  const strict = voiceStyleRetryInstruction(c);
  let summary = "";
  try {
    const contextSummary = ensureCharacterContextSummary(c);
    summary = String(contextSummary && contextSummary.private || "").slice(0, 2800);
  } catch {}
  return [
    style,
    strict,
    summary
      ? "COMPACT SELF-CANON — RELEVANT PORTRAYAL CONTEXT; DO NOT LEAK PRIVATE FACTS AS OTHER CHARACTERS' KNOWLEDGE:\n" + summary
      : "",
  ].filter(Boolean).join("\n\n").slice(0, 6500);
}

function voiceStyleCardsForIds(w, ids, actorId) {
  if (!w) return "";
  const unique = [];
  const add = (id) => {
    const value = String(id || "").trim();
    if (value && !unique.includes(value)) unique.push(value);
  };
  if (Array.isArray(ids)) ids.forEach(add);
  else add(ids);
  add(actorId);

  const rows = unique
    .slice(0, 8)
    .map((id) => charById(w, id))
    .filter((c) => c && !isHuman(w, c.id))
    .map((c) => characterVoiceStyleCard(c))
    .filter(Boolean);

  return rows.length
    ? "VOICE STYLE CARDS — PRESERVED PROMPT PREFIX. EACH CARD APPLIES ONLY TO ITS OWN SPEAKER:\n\n" + rows.join("\n\n--- NEXT SPEAKER CARD ---\n\n")
    : "";
}

function worldContext(...args) {
  const w = args[0];
  const ids = args[1];
  const actorId = args.length >= 4 ? args[3] : "";
  const options = args.length >= 5 && args[4] && typeof args[4] === "object" ? args[4] : {};
  const prefix = voiceStyleCardsForIds(w, ids, actorId);
  let base = String(legacyVoiceStyleWorldContext(...args) || "");

  /* Social-thread context gets a tighter local cap. The prefix is never part of
     this trimming operation, so voice cards cannot be lost to app compaction. */
  if (options.socialScope === true && base.length > 12500) {
    const head = Math.min(9000, base.length);
    const tail = Math.min(3200, Math.max(0, base.length - head));
    base = base.slice(0, head) +
      "\n...[public social background compacted; voice cards preserved above]...\n" +
      (tail ? base.slice(-tail) : "");
  }

  if (prefix) {
    const idsLogged = (Array.isArray(ids) ? ids : [ids])
      .filter(Boolean)
      .slice(0, 8)
      .map((id) => {
        const c = charById(w, id);
        return c ? String(c.name || id) + "[" + id + "]" : String(id);
      });
    console.info(
      "[voice-style] cards-preserved",
      "speakers=" + idsLogged.join(","),
      "prefixChars=" + prefix.length,
      "socialScope=" + String(Boolean(options.socialScope))
    );
  }

  return [prefix.slice(0, VOICE_STYLE_PREFIX_MAX), base].filter(Boolean).join("\n\n");
}

function voiceStyleProtectTokens(text) {
  const tokens = [];
  const masked = String(text || "").replace(
    /https?:\/\/[^\s]+|www\.[^\s]+|@[A-Za-z0-9_.]+|#[\p{L}\p{N}_]+/gu,
    (match) => {
      const marker = "§" + tokens.length + "§";
      tokens.push(match);
      return marker;
    }
  );
  return {
    masked,
    restore(value) {
      return String(value || "").replace(/§(\d+)§/g, (_, index) => tokens[Number(index)] || "");
    },
  };
}

function voiceStyleStripEmoji(text) {
  return String(text || "")
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]+/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +\n/g, "\n")
    .trim();
}

function applyCharacterVoiceStyle(w, id, text) {
  const value = String(text || "");
  if (!value || !w || !id || isHuman(w, id)) return value;
  const c = charById(w, id);
  if (!c) return value;
  const style = extractCharacterVoiceStyleCard(c);
  const rules = style && style.rules ? style.rules : {};
  const protectedText = voiceStyleProtectTokens(value);
  let out = protectedText.masked;

  if (rules.casing === "upper") out = out.toLocaleUpperCase("hu-HU");
  else if (rules.casing === "lower") out = out.toLocaleLowerCase("hu-HU");

  if (rules.noEmoji) out = voiceStyleStripEmoji(out);
  if (rules.noPunctuation) {
    out = out
      .replace(/[.!?,;:…。！？；：]+/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/ +\n/g, "\n")
      .trim();
  } else if (rules.noFinalPeriod) {
    out = out.replace(/[.。]+\s*$/g, "").trimEnd();
  }

  return protectedText.restore(out).trim();
}

function cleanGeneratedUtterance(...args) {
  const w = args[0];
  const id = args[1];
  const base = legacyVoiceStyleCleanGeneratedUtterance(...args);
  return applyCharacterVoiceStyle(w, id, base);
}

function cleanGeneratedComment(...args) {
  const w = args[0];
  const id = args[1];
  const base = legacyVoiceStyleCleanGeneratedComment(...args);
  return applyCharacterVoiceStyle(w, id, base);
}

function voiceStyleHasEmoji(text) {
  return /\p{Extended_Pictographic}/u.test(String(text || ""));
}

function voiceStyleExplicitProfanity(text) {
  return /fuck|shit|damn|bitch|fasz|kurva|geci|bazd|baszd|pics[aá]|szar/i.test(String(text || ""));
}

function voiceStyleSoftMismatch(w, id, text) {
  if (!w || !id || !text || isHuman(w, id)) return false;
  const c = charById(w, id);
  if (!c) return false;
  const style = extractCharacterVoiceStyleCard(c);
  const soft = style && style.soft ? style.soft : {};
  const value = String(text || "").trim();
  const words = value.split(/\s+/).filter(Boolean);

  if (soft.shortMessages && (value.length > 360 || words.length > 55)) return true;
  if (soft.longMessages && value.length < 18 && words.length <= 3) return true;
  if (soft.manyEmoji && value.length >= 8 && !voiceStyleHasEmoji(value)) return true;
  if (soft.alwaysSwears && value.length >= 12 && !voiceStyleExplicitProfanity(value)) return true;
  return false;
}

function voiceStyleMismatchIdsFromOutput(w, out, fallbackActorId = "") {
  const bad = new Set();
  const inspect = (id, text) => {
    const actorId = String(id || fallbackActorId || "");
    if (actorId && voiceStyleSoftMismatch(w, actorId, text)) bad.add(actorId);
  };
  if (!out || typeof out !== "object") return bad;

  inspect(fallbackActorId, out.text || out.dmText || out.opening || "");
  ["comments", "replies", "posts", "messages", "notes", "turns"].forEach((key) => {
    const rows = Array.isArray(out[key]) ? out[key] : [];
    rows.forEach((row) => {
      if (!row || typeof row !== "object") return;
      const id = row.id !== undefined ? row.id : (row.authorId !== undefined ? row.authorId : row.name);
      inspect(id, row.text || row.message || row.content || "");
    });
  });
  return bad;
}

async function voiceStyleRunWithSingleRetry(w, firstRun, retryRun, fallbackActorId = "") {
  const first = await firstRun();
  const bad = voiceStyleMismatchIdsFromOutput(w, first, fallbackActorId);
  if (!bad.size) return first;

  console.warn(
    "[voice-style] soft mismatch; one strict retry",
    "characters=" + [...bad].join(",")
  );
  VOICE_STYLE_STRICT_RETRY_IDS = bad;
  try {
    const second = await retryRun();
    return second || first;
  } catch (err) {
    console.warn("[voice-style] strict retry failed; keeping first result", err);
    return first;
  } finally {
    VOICE_STYLE_STRICT_RETRY_IDS = null;
  }
}

async function genReply(...args) {
  const w = args[0];
  return voiceStyleRunWithSingleRetry(
    w,
    () => legacyVoiceStyleGenReply(...args),
    () => legacyVoiceStyleGenReply(...args)
  );
}

async function genComments(...args) {
  const w = args[0];
  return voiceStyleRunWithSingleRetry(
    w,
    () => legacyVoiceStyleGenComments(...args),
    () => legacyVoiceStyleGenComments(...args)
  );
}

async function genDM(...args) {
  const w = args[0];
  const bot = args[1];
  return voiceStyleRunWithSingleRetry(
    w,
    () => legacyVoiceStyleGenDM(...args),
    () => legacyVoiceStyleGenDM(...args),
    bot && bot.id
  );
}

async function genWorldStep(...args) {
  const w = args[0];
  return voiceStyleRunWithSingleRetry(
    w,
    () => legacyVoiceStyleGenWorldStep(...args),
    () => legacyVoiceStyleGenWorldStep(...args)
  );
}

async function genNote(...args) {
  const w = args[0];
  const bot = args[1];
  return voiceStyleRunWithSingleRetry(
    w,
    () => legacyVoiceStyleGenNote(...args),
    () => legacyVoiceStyleGenNote(...args),
    bot && bot.id
  );
}
`;

  next += helper;
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied character voice style v1: stored style cards, protected prompt prefix, per-character mechanical enforcement, single strict retry.");
} else {
  console.log("Character voice style v1 already applied.");
}
