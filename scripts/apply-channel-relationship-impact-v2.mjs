import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG CHANNEL RELATIONSHIP IMPACT v2";

function allMatches(regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  return [...next.matchAll(new RegExp(regex.source, flags))];
}
function replaceOne(regex, replacement, label, required = true) {
  const count = allMatches(regex).length;
  if (count === 1) {
    next = next.replace(regex, replacement);
    return true;
  }
  if (!required && count === 0) return false;
  throw new Error(`Channel relationship v2 aborted: ${label} expected 1 match, found ${count}.`);
}

if (!next.includes(`/* ${MARKER} */`)) {
  const helper = String.raw`
/* ${MARKER} */
const RELATIONSHIP_CHANNEL_SETTINGS = Object.freeze({
  dm: 0.45,
  public: 1,
  roleplay: 1.8,
  severeDm: 2.2,
  maxDm: 2,
  maxSevereDm: 4,
  maxPublic: 4,
  maxRoleplay: 8,
  publicHostilityEscalation: 3,
});

let RELATIONSHIP_CHANNEL_CONTEXT = null;

function withRelationshipChannel(channel, ctx, fn) {
  const prev = RELATIONSHIP_CHANNEL_CONTEXT;
  RELATIONSHIP_CHANNEL_CONTEXT = { channel, ...(ctx || {}) };
  try {
    return fn();
  } finally {
    RELATIONSHIP_CHANNEL_CONTEXT = prev;
  }
}

function channelTone(text) {
  const s = String(text || "").toLowerCase();
  if (/gyűlöl|utállak|undorító|szánalmas|értéktelen|rohadj|fuck you|hate you|disgusting|pathetic|worthless|fenyeget|megöllek|kill you/i.test(s)) return -2;
  if (/bunkó|idióta|hülye|hazug|cringe|loser|annoying|stupid|rude|liar|coward/i.test(s)) return -1;
  if (/szeretlek|imádlak|büszke vagyok|gyönyörű|csodálatos|love you|adore|proud of|gorgeous|beautiful|❤️|❤|🥰|😍|💖|💕/iu.test(s)) return 2;
  if (/köszi|köszön|gratul|bocsánat|sajnálom|cuki|szép|dögös|vicces|haha|lol|thanks|congrats|sorry|cute|pretty|hot|funny|😂|🤣/iu.test(s)) return 1;
  return 0;
}

function severeDm(text) {
  return /szeretlek|szerelmes|i love you|in love|szakít|break up|it's over|its over|gyűlöl|utállak|hate you|fenyeget|megöllek|kill you|titkom|titkot|secret|vallomás|confess/i.test(String(text || ""));
}

function channelDelta(channel, text, aiDelta = 0) {
  let tone = channelTone(text);
  const ai = Number(aiDelta) || 0;
  if (!tone && ai) tone = ai > 0 ? (Math.abs(ai) >= 8 ? 2 : 1) : (Math.abs(ai) >= 8 ? -2 : -1);
  if (!tone) return 0;
  let weight = RELATIONSHIP_CHANNEL_SETTINGS[channel] || 1;
  const severe = channel === "dm" && severeDm(text);
  if (severe) weight *= RELATIONSHIP_CHANNEL_SETTINGS.severeDm;
  let delta = Math.round(tone * 2 * weight);
  if (!delta) delta = tone > 0 ? 1 : -1;
  const cap =
    channel === "roleplay" ? RELATIONSHIP_CHANNEL_SETTINGS.maxRoleplay :
    channel === "public" ? RELATIONSHIP_CHANNEL_SETTINGS.maxPublic :
    severe ? RELATIONSHIP_CHANNEL_SETTINGS.maxSevereDm :
    RELATIONSHIP_CHANNEL_SETTINGS.maxDm;
  return Math.max(-cap, Math.min(cap, delta));
}

function channelScaleChanges(changes, channel, ctx = {}) {
  return (Array.isArray(changes) ? changes : [])
    .map((ch) => {
      if (!ch || typeof ch !== "object") return null;
      const reason = String(ch.why || ctx.reason || "interaction");
      const text = [ctx.text, ch.why, ch.mood].filter(Boolean).join(" ");
      return {
        ...ch,
        delta: channelDelta(channel, text, ch.delta),
        why: reason,
      };
    })
    .filter(Boolean);
}

function applyChannelRelationshipChanges(w, changes, channel, ctx = {}) {
  const rows = channelScaleChanges(changes, channel, ctx);
  if (!rows.length) return;
  const before = rows.map((ch) => ({
    a: findChar(w, ch.a),
    b: findChar(w, ch.b),
    score: Number((getRel(w, findChar(w, ch.a), findChar(w, ch.b)) || {}).score) || 0,
  }));
  legacyChannelApplyChanges(w, rows);
  rows.forEach((ch, i) => {
    const a = findChar(w, ch.a);
    const b = findChar(w, ch.b);
    if (!a || !b || a === b) return;
    const oldScore = before[i] ? before[i].score : 0;
    const newScore = Number((getRel(w, a, b) || {}).score) || 0;
    const actual = newScore - oldScore;
    if (actual) {
      console.info(
        "[relationship-change]",
        "from=" + a,
        "toward=" + b,
        "delta=" + actual,
        "channel=" + channel,
        "reason=" + String(ch.why || ctx.reason || "interaction").slice(0, 160),
        "score=" + oldScore + "->" + newScore
      );
    }
  });
}

function applyChanges(n, changes) {
  const ctx = RELATIONSHIP_CHANNEL_CONTEXT;
  if (!ctx || !ctx.channel) return legacyChannelApplyChanges(n, changes);
  return applyChannelRelationshipChanges(n, changes, ctx.channel, ctx);
}

function applyComments(...args) {
  return withRelationshipChannel("public", { reason: "timeline-comments" }, () => legacyChannelApplyComments(...args));
}
function applyReplies(...args) {
  return withRelationshipChannel("public", { reason: "timeline-replies" }, () => legacyChannelApplyReplies(...args));
}
function applyWorldStep(...args) {
  return withRelationshipChannel("public", { reason: "timeline-feed" }, () => legacyChannelApplyWorldStep(...args));
}
function applySceneChangesWithStatus(...args) {
  return withRelationshipChannel("roleplay", { reason: "roleplay" }, () => legacyChannelApplySceneChangesWithStatus(...args));
}

function normalizedOfficialKind(rel) {
  const r = rel || EMPTY_REL;
  const score = Math.max(-100, Math.min(100, Number(r.score) || 0));
  const bond = String(r.bond || r.type || "").toLowerCase();

  if (r.fixed && bond) return { kind: "fixed", rank: 1000, raw: String(r.bond || r.type || "") };
  if (/spouse|házastárs|férj|feleség|married|házas/.test(bond)) return { kind: "spouse", rank: 90 };
  if (/engaged|jegyes|fiancé|fiance/.test(bond)) return { kind: "engaged", rank: 80 };
  if (/dating|járnak|partner|boyfriend|girlfriend|párkapcsolat|couple/.test(bond)) return { kind: "dating", rank: 70 };
  if (/exes|\bex\b|volt pár/.test(bond)) return { kind: "exes", rank: 65 };
  if (/best friend|legjobb barát/.test(bond) || score >= 80) return { kind: "best-friend", rank: 60 };
  if (/close friend|közeli barát/.test(bond) || score >= 55) return { kind: "friend", rank: 50 };
  if (/\bfriend\b|barát/.test(bond) || score >= 35) return { kind: "friend", rank: 50 };
  if (/fan|rajong/.test(bond)) return { kind: "fan", rank: 45, unilateral: true };
  if (/enemy|ellenség/.test(bond) || score <= -70) return { kind: "enemy", rank: 45, unilateral: true };
  if (/rival|rivális/.test(bond) || score <= -30) return { kind: "rival", rank: 40, unilateral: true };
  if (score >= 15) return { kind: "acquaintance", rank: 30 };
  if (score <= -6) return { kind: "tense", rank: 25 };
  return { kind: "stranger", rank: 10 };
}

function officialKindLabel(kind, lang = CURRENT_LANG) {
  const en = lang === "en";
  const map = {
    spouse: en ? "Married" : "Házasok",
    engaged: en ? "Engaged" : "Jegyesek",
    dating: en ? "Dating" : "Randizgatnak / pár",
    exes: en ? "Exes" : "Exek",
    "best-friend": en ? "Best friends" : "Legjobb barátok",
    friend: en ? "Friends" : "Barátok",
    acquaintance: en ? "Acquaintances" : "Ismerősök",
    stranger: en ? "Strangers" : "Idegenek",
    tense: en ? "Tense" : "Feszült",
    rival: en ? "Rival" : "Rivális",
    enemy: en ? "Enemy" : "Ellenség",
    fan: en ? "Admires them" : "Rajong érte",
  };
  return map[kind] || String(kind || "");
}

function explicitMutualStatus(w, a, b) {
  const ra = getRel(w, a, b) || EMPTY_REL;
  const rb = getRel(w, b, a) || EMPTY_REL;
  const text = [
    ra.bond, ra.type, ra.why, ra.mood,
    rb.bond, rb.type, rb.why, rb.mood,
  ].filter(Boolean).join(" ").toLowerCase();
  if (/spouse|married|házas|férj|feleség/.test(text)) return "spouse";
  if (/engaged|jegyes|fiancé|fiance/.test(text)) return "engaged";
  if (/dating|járnak|összejöttek|got together|became a couple|párkapcsolat/.test(text)) return "dating";
  if (/exes|\bex\b|szakítottak|broke up/.test(text)) return "exes";
  if (/best friend|legjobb barát/.test(text)) return "best-friend";
  return "";
}

function officialRelationshipStatusForPair(w, ownerId, targetId, lang = CURRENT_LANG) {
  const own = getRel(w, ownerId, targetId) || EMPTY_REL;
  const reverse = getRel(w, targetId, ownerId) || EMPTY_REL;

  if (own.fixed && (own.bond || own.type)) return localizedBond(own.bond || own.type, lang);

  const explicit = explicitMutualStatus(w, ownerId, targetId);
  if (explicit) return officialKindLabel(explicit, lang);

  const a = normalizedOfficialKind(own);
  const b = normalizedOfficialKind(reverse);

  if (a.unilateral) return officialKindLabel(a.kind, lang);

  const mutualKinds = ["spouse", "engaged", "dating", "exes", "best-friend"];
  if (mutualKinds.includes(a.kind) || mutualKinds.includes(b.kind)) {
    const sharedRank = Math.min(a.rank, b.rank);
    const shared =
      sharedRank >= 60 ? "best-friend" :
      sharedRank >= 50 ? "friend" :
      sharedRank >= 30 ? "acquaintance" :
      "stranger";
    return officialKindLabel(shared, lang);
  }

  const sharedRank = Math.min(a.rank, b.rank);
  const shared =
    sharedRank >= 60 ? "best-friend" :
    sharedRank >= 50 ? "friend" :
    sharedRank >= 30 ? "acquaintance" :
    sharedRank <= 10 ? "stranger" :
    "acquaintance";
  return officialKindLabel(shared, lang);
}

function channelAwareEventDelta(w, event) {
  const old = Number(commentRepairDeterministicDelta(w, event)) || 0;
  if (!event) return old;
  const t = String(event.type || "").toLowerCase();
  const src = String(event.source || "").toLowerCase();
  if (!["post", "comment", "reply"].includes(t) && src !== "public_social" && src !== "player") return old;
  return channelDelta("public", event.text, old);
}

function channelRegisterPublicHostility(w, event) {
  if (!w || !event || !isHuman(w, event.actorId) || channelTone(event.text) > -2) return;
  const t = String(event.type || "").toLowerCase();
  if (!["post", "comment", "reply"].includes(t)) return;
  w.sim = w.sim && typeof w.sim === "object" ? w.sim : {};
  w.sim.channelRelationship = w.sim.channelRelationship || {};
  const s = w.sim.channelRelationship;
  s.publicHostility = s.publicHostility || {};
  const id = String(event.actorId);
  s.publicHostility[id] = (Number(s.publicHostility[id]) || 0) + 1;
  if (s.publicHostility[id] >= RELATIONSHIP_CHANNEL_SETTINGS.publicHostilityEscalation) {
    event.tags = Array.isArray(event.tags) ? event.tags : [];
    if (!event.tags.includes("repeated-public-hostility")) event.tags.push("repeated-public-hostility");
    console.info("[public-hostility] escalation-eligible", "actor=" + id, "count=" + s.publicHostility[id]);
  }
}

function channelPublicPostFollowerEffect(w, postId) {
  const p = (w.posts || []).find((x) => x && x.id === postId);
  if (!p || !isHuman(w, p.authorId)) return;
  w.sim = w.sim && typeof w.sim === "object" ? w.sim : {};
  w.sim.channelRelationship = w.sim.channelRelationship || {};
  const state = w.sim.channelRelationship;
  state.publicPostFollowerSeen = state.publicPostFollowerSeen || {};
  if (state.publicPostFollowerSeen[postId]) return;
  state.publicPostFollowerSeen[postId] = now();

  const tone = channelTone(p.text);
  const dramaWorld = /drama|chaos|botrány|pletyka|tabloid|celebrity|influencer|viral|hírnév/i.test(
    JSON.stringify({ u: w.universe || {}, l: w.lore || "", s: w.summary || "" })
  );
  const bots = (w.chars || []).filter((c) => c && !isHuman(w, c.id) && !isMediaAccount(w, c.id));
  let changed = null;

  if (tone > 0) {
    changed = bots.find((x) => !isFollowing(w, x.id, p.authorId) && (Number((getRel(w, x.id, p.authorId) || {}).score) || 0) >= 0);
    if (changed) setFollowState(w, changed.id, p.authorId, true, "public-post-reaction");
  } else if (tone <= -2 && !dramaWorld) {
    changed = bots.find((x) => isFollowing(w, x.id, p.authorId) && (Number((getRel(w, x.id, p.authorId) || {}).score) || 0) < 15);
    if (changed) setFollowState(w, changed.id, p.authorId, false, "public-post-reaction");
  } else if (tone <= -2 && dramaWorld) {
    changed = bots.find((x) =>
      !isFollowing(w, x.id, p.authorId) &&
      /dram|chaot|gossip|plety|provoc|impuls|curious|kíváncsi/i.test(String(x.personality || "") + " " + String(x.traits || ""))
    );
    if (changed) setFollowState(w, changed.id, p.authorId, true, "public-post-drama-reaction");
  }
  console.info("[public-post-followers]", "post=" + postId, "tone=" + tone, "changed=" + (changed ? 1 : 0), "dramaWorld=" + dramaWorld);
}
`;

  replaceOne(/function\s+applyChanges\s*\(/, "function legacyChannelApplyChanges(", "applyChanges rename");
  replaceOne(/function\s+applyComments\s*\(/, "function legacyChannelApplyComments(", "applyComments rename");
  replaceOne(/function\s+applyReplies\s*\(/, "function legacyChannelApplyReplies(", "applyReplies rename");
  replaceOne(/function\s+applyWorldStep\s*\(/, "function legacyChannelApplyWorldStep(", "applyWorldStep rename");
  replaceOne(/function\s+applySceneChangesWithStatus\s*\(/, "function legacyChannelApplySceneChangesWithStatus(", "scene relationship wrapper rename");

  replaceOne(
    /function\s+relLabel\s*\(r\)\s*\{/,
    helper + "\nfunction relLabel(r) {",
    "helper insertion"
  );

  replaceOne(
    /const delta = commentRepairDeterministicDelta\(w, event\);/,
    `channelRegisterPublicHostility(w, event);\n  const delta = channelAwareEventDelta(w, event);`,
    "public deterministic delta"
  );

  replaceOne(
    /applyChanges\(\s*n,\s*dmChanges\s*\);/,
    `applyChannelRelationshipChanges(n, dmChanges, "dm", { text: t, reason: "direct-dm" });`,
    "direct DM channel weighting"
  );

  replaceOne(
    /\{r\.mood\s*\?\s*localizedRelationshipDisplayText\(r\.mood,\s*CURRENT_LANG\)\s*:\s*relLabel\(r\)\}/,
    `{r.mood\n            ? localizedRelationshipDisplayText(r.mood, CURRENT_LANG)\n            : relLabel(r)}\n          <div className="hint" style={{ marginTop: 3 }}>{tt("Hivatalos státusz: ", "Official status: ")}{officialRelationshipStatusForPair(w, from, to, CURRENT_LANG)}</div>`,
    "RelPair official status"
  );

  replaceOne(
    /\{r\.score > 0 \? "\+" : ""\}\{r\.score\} · \{relLabel\(r\)\}<\/span>/,
    `{r.score > 0 ? "+" : ""}{r.score} · {officialRelationshipStatusForPair(w, c.id, w.meId, CURRENT_LANG)}</span>`,
    "character list official status",
    false
  );

  const starredNeedle = '${playerText ? `${w.player.name} most ezt teszi vagy mondja:\\n"${playerText}"` : "A játékos most nem lép közbe; a szereplők maguktól viszik tovább a jelenetet."}';
  if (next.includes(starredNeedle)) {
    next = next.replace(
      starredNeedle,
      starredNeedle + '\n${playerText && /\\*[^*]+\\*/s.test(playerText) ? "SZEREPJÁTÉK-MÓD: csillagos narráció érkezett; válaszolj narrált cselekvéssel és párbeszéddel, a helyszínhez/hangulathoz igazodva, a játékos helyett nem cselekedve." : "NORMÁL MÓD: csillagos narráció nélkül ne erőltess külön action-narrációt; természetesen reagálj a karakter saját stílusában."}'
    );
  }

  replaceOne(
    /kind:\s*"action",\s*\n\s*text:\s*playerText,/,
    `kind: /\\*[^*]+\\*/s.test(playerText) ? "action" : "speech",\n          text: playerText,`,
    "starred player turn mode"
  );
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied channel-weighted directional relationships v2, mutual official statuses, and starred RP mode.");
} else {
  console.log("Channel relationship impact v2 already applied.");
}
