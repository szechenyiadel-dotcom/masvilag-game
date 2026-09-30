import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG PLAYER POST COMMENT CONTENT ISOLATION v1";

function countMatches(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  return [...text.matchAll(new RegExp(regex.source, flags))].length;
}

function replaceOne(regex, replacement, label) {
  const count = countMatches(next, regex);
  if (count !== 1) {
    throw new Error(`Player-post comment content isolation aborted: ${label} expected 1 match, found ${count}.`);
  }
  next = next.replace(regex, replacement);
}

if (!next.includes(`/* ${MARKER} */`)) {
  replaceOne(
    /async function\s+genComments\s*\(/,
    "async function legacyPlayerPostContentGenComments(",
    "genComments"
  );

  replaceOne(
    /genComments\(view,\s*post,\s*\{\s*minComments:\s*2,\s*maxComments:\s*4\s*\}\)/,
    'genComments(view, post, { minComments: 2, maxComments: 4, playerPostContentIsolation: true })',
    "player-post guarantee genComments call"
  );

  replaceOne(
    /while\s*\(calls\s*<\s*2\s*&&\s*combinedRows\.length\s*<\s*2\)\s*\{/,
    "while (calls < 1 && combinedRows.length < 2) {",
    "player-post outer generation cap"
  );

  replaceOne(
    /applyComments\(n,\s*post\.id,\s*safeOut,\s*label\);/,
    `applyComments(n, post.id, safeOut, label);
      try {
        const afterApplyPost = (n.posts || []).find((row) => row && row.id === post.id);
        const newAiComments = afterApplyPost
          ? safePostComments(afterApplyPost)
              .slice(before)
              .filter((row) => row && row.id && row.authorId && !isHuman(n, row.authorId))
          : [];
        if (newAiComments.length >= 2 && typeof simEnqueue === "function" && typeof mkAction === "function") {
          const rootComment = newAiComments[0];
          const responder = newAiComments.find((row) => row.authorId !== rootComment.authorId);
          if (responder) {
            const queued = simEnqueue(
              n,
              mkAction(
                "reply",
                "player-post-ai-ai:" + post.id + ":" + rootComment.id + ":" + responder.authorId,
                {
                  postId: post.id,
                  commentId: rootComment.id,
                  rootId: rootComment.id,
                  targetId: responder.authorId,
                  trigger: "player-post-ai-ai",
                },
                "event"
              )
            );
            console.info(
              "[player-post-comments]",
              "stage=ai-ai-reply-queue",
              "post=" + post.id,
              "root=" + rootComment.id,
              "responder=" + responder.authorId,
              "queued=" + String(Boolean(queued))
            );
          }
        }
      } catch (threadError) {
        console.warn("[player-post-comments] AI-AI reply queue failed; root comments preserved", threadError);
      }`,
    "player-post AI-AI reply enqueue"
  );

  const helper = String.raw`

/* ${MARKER} */
const PLAYER_POST_COMMENT_TECH_LEAK_RE =
  /\b(?:variables?|json|prompt|backlog|queue|cache|tokens?|system(?:\s+(?:message|prompt))?|schema|payload|debug|api|function|javascript|typescript|field\s*name|internal\s+instruction|model\s+instruction)\b|(?:változó(?:k|kat|val)?|belső\s+utasítás|rendszerprompt|hibakeresési\s+szöveg)/iu;

const PLAYER_POST_COMMENT_FOLLOW_RE =
  /\b(?:follow(?:ing|ed)?|follow\s*back|unfollow(?:ed|ing)?|click(?:ing|ed)?\s+(?:the\s+)?follow|fan\s*club|add(?:ing|ed)?\s+(?:the\s+)?whole\s+(?:town|world|everyone)|bekövet(?:és|ett|ni)?|visszakövet(?:és|ett|ni)?|kikövet(?:és|ett|ni)?|követget(?:sz|ed|és)?)\b/iu;

const PLAYER_POST_COMMENT_POSITIVE_RE =
  /\b(?:love|adore|cute|pretty|beautiful|gorgeous|hot|amazing|iconic|proud|sweet|funny|perfect|slay|queen|king|support|szeret|imád|cuki|szép|gyönyörű|dögös|büszke|vicces|tökéletes|zseniális)\b|[❤️❤🥰😍💖💕😂🤣]/iu;

const PLAYER_POST_COMMENT_NEGATIVE_RE =
  /\b(?:hate|pathetic|stupid|idiot|annoying|embarrassing|cringe|loser|waste|shut\s*up|boring|desperate|utál|szánalmas|hülye|idióta|idegesítő|kínos|unalmas|rosszindulatú)\b/iu;

const PLAYER_POST_COMMENT_JEALOUS_RE =
  /\b(?:jealous|jealousy|possessive|mine|who(?:'s| is)\s+that|féltékeny|féltékenység|enyém|ki\s+ez)\b/iu;

function playerPostCommentPostContext(w, post) {
  const tagged = new Set();

  (Array.isArray(post && post.taggedIds) ? post.taggedIds : []).forEach((id) => {
    if (id && charById(w, id)) tagged.add(String(id));
  });
  (Array.isArray(post && post.mentions) ? post.mentions : []).forEach((value) => {
    const raw = typeof value === "object" ? (value.id || value.characterId || value.username || "") : value;
    const id = raw ? findChar(w, raw) : "";
    if (id) tagged.add(String(id));
  });

  const visibleText = String(post && (post.text || post.caption) || "");
  const handles = visibleText.match(/@[A-Za-z0-9_.-]+/g) || [];
  handles.forEach((handle) => {
    const clean = handle.slice(1).toLowerCase();
    const c = (w.chars || []).find((row) =>
      row &&
      [row.username, row.handle].filter(Boolean).some((name) =>
        String(name).replace(/^@/, "").toLowerCase() === clean
      )
    );
    if (c) tagged.add(c.id);
  });

  const imageDescription = String(
    post && (
      post.imageDescription ||
      post.imagePrompt ||
      post.imageAlt ||
      post.alt ||
      post.imageCaption ||
      ""
    ) || ""
  ).trim();

  return {
    postId: String(post && post.id || ""),
    authorId: String(post && post.authorId || ""),
    authorName: nameOfIn(w, post && post.authorId),
    text: visibleText,
    imageDescription,
    mood: String(post && (post.mood || post.feeling || post.vibe) || ""),
    visibleTags: Array.isArray(post && post.tags) ? post.tags.map(String).slice(0, 16) : [],
    taggedPeople: [...tagged].map((id) => ({
      id,
      name: nameOfIn(w, id),
    })),
  };
}

function playerPostCommentExpectedTone(rel) {
  const score = Number(rel && rel.score) || 0;
  const text = [
    rel && rel.bond,
    rel && rel.type,
    rel && rel.mood,
  ].filter(Boolean).join(" ").toLowerCase();

  if (/jealous|féltéken|possess|birtokl/.test(text)) return "jealous";
  if (/enemy|ellens|rival|rivális|hate|utál/.test(text) || score <= -20) return "negative";
  if (/crush|dating|partner|couple|pár|love|szeret|best friend|legjobb barát|close friend|közeli barát|friend|barát/.test(text) || score >= 15) return "positive";
  return "neutral";
}

function playerPostCommentGeneratedTone(text) {
  const value = String(text || "");
  if (PLAYER_POST_COMMENT_JEALOUS_RE.test(value)) return "jealous";
  if (PLAYER_POST_COMMENT_NEGATIVE_RE.test(value)) return "negative";
  if (PLAYER_POST_COMMENT_POSITIVE_RE.test(value)) return "positive";
  return "neutral";
}

function playerPostCommentVoiceCard(w, c) {
  if (!c) return "";
  try {
    if (typeof voiceStyleCardsForIds === "function") {
      return String(voiceStyleCardsForIds(w, [c.id], c.id) || "").slice(0, 2600);
    }
  } catch {}
  return String(c.aiVoiceStyleCard && c.aiVoiceStyleCard.card || "").slice(0, 2600);
}

function playerPostCommentCandidateCards(w, post, maxComments) {
  const cast = fairCommentCast(w, post.authorId, post)
    .filter((c) => c && c.id && !isHuman(w, c.id))
    .slice(0, Math.max(2, Math.min(8, Number(maxComments) || 4)));

  return cast.map((c) => {
    const rel = getRel(w, c.id, post.authorId) || EMPTY_REL;
    let official = "";
    try {
      if (typeof officialRelationshipStatusForPair === "function") {
        official = String(officialRelationshipStatusForPair(w, c.id, post.authorId, worldLanguage(w, post.authorId)) || "");
      }
    } catch {}

    return {
      id: c.id,
      name: c.name,
      voiceStyleCard: playerPostCommentVoiceCard(w, c),
      relationshipToPostAuthor: {
        score: Math.max(-100, Math.min(100, Number(rel.score) || 0)),
        type: String(rel.bond || rel.type || ""),
        officialStatus: official,
        currentMood: String(rel.mood || ""),
        expectedPublicTone: playerPostCommentExpectedTone(rel),
      },
    };
  });
}

function playerPostCommentHasFollowLeak(postContext, text) {
  const source = [
    postContext && postContext.text,
    postContext && postContext.imageDescription,
    postContext && postContext.mood,
    ...((postContext && postContext.visibleTags) || []),
  ].filter(Boolean).join(" ");
  if (PLAYER_POST_COMMENT_FOLLOW_RE.test(source)) return false;
  return PLAYER_POST_COMMENT_FOLLOW_RE.test(String(text || ""));
}

function playerPostCommentRowsFromOutput(w, out, cards, postContext) {
  const allowed = new Set(cards.map((row) => row.id));
  const seen = new Set();
  const rows = [];

  safeAiComments(out).forEach((row) => {
    try {
      if (!row || typeof row !== "object") return;
      const actorId = findChar(
        w,
        row.id !== undefined
          ? row.id
          : (row.authorId !== undefined ? row.authorId : row.name)
      );
      const text = String(row.text || "").trim();

      if (!actorId || !allowed.has(actorId) || isHuman(w, actorId) || !text || seen.has(actorId)) return;
      if (PLAYER_POST_COMMENT_TECH_LEAK_RE.test(text)) {
        console.warn("[player-post-comments] rejected=technical-leak", "character=" + actorId, "text=" + text.slice(0, 180));
        return;
      }
      if (playerPostCommentHasFollowLeak(postContext, text)) {
        console.warn("[player-post-comments] rejected=follow-context-leak", "character=" + actorId, "text=" + text.slice(0, 180));
        return;
      }

      seen.add(actorId);
      rows.push({ ...row, id: actorId, text });
    } catch (error) {
      console.warn("[player-post-comments] rejected=invalid-row", error);
    }
  });

  return rows;
}

function playerPostCommentBatchProblems(w, rows, cards, postContext, minComments) {
  const problems = [];
  const rawRows = Array.isArray(rows) ? rows : [];

  if (rawRows.length < Math.max(2, Number(minComments) || 2)) {
    problems.push("too-few-valid-comments");
  }

  const expectedById = new Map(cards.map((card) => [
    card.id,
    card.relationshipToPostAuthor.expectedPublicTone,
  ]));
  const expectedSet = new Set(
    rawRows.map((row) => expectedById.get(findChar(w, row.id)) || "neutral")
  );
  const generatedSet = new Set(
    rawRows.map((row) => playerPostCommentGeneratedTone(row.text))
  );

  if (rawRows.length >= 3 && expectedSet.size >= 2 && generatedSet.size <= 1) {
    problems.push("uniform-tone-despite-different-relationships");
  }

  const stop = new Set([
    "this","that","with","from","your","youre","just","really","like","have","what","when","then","they","them",
    "hogy","amit","csak","mert","egy","azt","most","vagy","volt","még","mar","már","nem","igen","neked","veled"
  ]);
  const tokenSets = rawRows.map((row) => new Set(
    String(row.text || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4 && !stop.has(token))
  ));
  let pairs = 0;
  let similar = 0;
  for (let i = 0; i < tokenSets.length; i += 1) {
    for (let j = i + 1; j < tokenSets.length; j += 1) {
      const a = tokenSets[i];
      const b = tokenSets[j];
      const union = new Set([...a, ...b]);
      if (!union.size) continue;
      pairs += 1;
      const common = [...a].filter((token) => b.has(token)).length;
      if (common / union.size >= 0.48) similar += 1;
    }
  }
  if (pairs >= 3 && similar / pairs >= 0.72) {
    problems.push("comments-repeat-the-same-topic-or-wording");
  }

  rawRows.forEach((row) => {
    if (PLAYER_POST_COMMENT_TECH_LEAK_RE.test(String(row.text || ""))) {
      problems.push("technical-language-leak");
    }
    if (playerPostCommentHasFollowLeak(postContext, row.text)) {
      problems.push("follow-event-leak");
    }
  });

  return [...new Set(problems)];
}

function playerPostCommentPrivateSystem(w, post) {
  const en = worldLanguage(w, post.authorId) === "en";
  return en
    ? [
        "You generate authentic social-media comments for exactly ONE visible player post.",
        "The CHARACTER CONTENT block in the user message is the entire visible subject of the comments.",
        "Do not use recent follows, unfollows, queues, backlogs, unrelated timeline events, or any fact not present in that block.",
        "COMMENTER CARDS are private behavioral instructions only. Never quote, expose, explain, or mention their fields.",
        "Each commenter must react to the actual post text/image/mood/tagged people and must sound like their own voice card and relationship to the post author.",
        "Positive/friendly relationships should read warm, supportive, playful or naturally flirty when appropriate; hostile relationships may be sharp; jealous relationships may be pointed; neutral relationships may be brief and neutral.",
        "Do not make all commenters share one attitude. Do not copy a theme from one commenter into all the others.",
        "Never output software/internal/model terminology such as variable, JSON, prompt, backlog, queue, cache, token, system, schema, payload, debug, API or function.",
        "Return only the requested structured object."
      ].join("\n")
    : [
        "Pontosan EGY látható játékos-poszthoz generálsz hiteles közösségimédia-kommenteket.",
        "A felhasználói üzenet CHARACTER CONTENT blokkja a kommentek TELJES látható témája.",
        "Ne használj korábbi follow/unfollow eseményt, queue/backlog tartalmat, más timeline-eseményt vagy bármi olyat, ami nincs ebben a blokkban.",
        "A COMMENTER CARDS privát viselkedési utasítás. A mezőit soha ne idézd, magyarázd vagy szivárogtasd ki.",
        "Minden kommentelő a konkrét poszt szövegére/képére/hangulatára/tagelt személyeire reagáljon, a saját voice cardja és a poszt szerzőjéhez fűződő kapcsolata szerint.",
        "Pozitív/baráti kapcsolatnál legyen meleg, támogató, játékos vagy indokoltan flörtös; ellenségesnél lehet éles; féltékenynél célzós; semlegesnél rövid és semleges.",
        "Ne legyen minden kommentelő ugyanolyan hangulatú. Egy komment témáját ne másold rá az összes többire.",
        "Soha ne írj ki programozási/belső modellkifejezést: variable, JSON, prompt, backlog, queue, cache, token, system, schema, payload, debug, API, function, változó, belső utasítás.",
        "Csak a kért strukturált objektumot add vissza."
      ].join("\n");
}

function playerPostCommentPrompt(w, post, postContext, cards, minComments, maxComments, retryProblems = [], rejectedRows = []) {
  const en = worldLanguage(w, post.authorId) === "en";
  const retryBlock = retryProblems.length
    ? [
        "",
        "[ONE ALLOWED REGENERATION]",
        "The previous batch was rejected for: " + retryProblems.join(", ") + ".",
        "Do not repeat these rejected comments:",
        JSON.stringify(rejectedRows.map((row) => ({ id: row.id, text: row.text })).slice(0, 6)),
      ].join("\n")
    : "";

  return [
    en ? "[CHARACTER CONTENT — VISIBLE POST ONLY]" : "[CHARACTER CONTENT — CSAK A LÁTHATÓ POSZT]",
    JSON.stringify(postContext),
    "",
    en ? "[COMMENTER CARDS — PRIVATE, NEVER OUTPUT THEIR FIELDS]" : "[COMMENTER CARDS — PRIVÁT, A MEZŐKET SOHA NE ÍRD KI]",
    JSON.stringify(cards),
    "",
    en ? "[TASK]" : "[FELADAT]",
    en
      ? ("Write " + minComments + "-" + maxComments + " top-level comments by DIFFERENT listed commenters. Every comment must directly make sense as a reaction to this exact post.")
      : ("Írj " + minComments + "-" + maxComments + " TOP-LEVEL kommentet KÜLÖNBÖZŐ felsorolt kommentelőktől. Mindegyik komment közvetlenül ennek a konkrét posztnak a reakciójaként legyen értelmes."),
    en
      ? "Use the relationship/voice differences; do not force everyone into the same negative, positive or sarcastic attitude."
      : "Használd a kapcsolat- és voice-különbségeket; ne kényszeríts mindenkit ugyanabba a negatív, pozitív vagy szarkasztikus hangnembe.",
    en
      ? '{"comments":[{"id":"EXACT_CHARACTER_ID","text":"natural comment"}],"changes":[]}'
      : '{"comments":[{"id":"PONTOS_KARAKTER_ID","text":"természetes komment"}],"changes":[]}',
    retryBlock,
  ].filter(Boolean).join("\n");
}

async function isolatedPlayerPostComments(w, post, options = {}) {
  const minComments = Math.max(2, Math.min(4, Math.round(Number(options.minComments) || 2)));
  const maxComments = Math.max(minComments, Math.min(4, Math.round(Number(options.maxComments) || 4)));
  const postContext = playerPostCommentPostContext(w, post);
  const cards = playerPostCommentCandidateCards(w, post, maxComments);

  if (cards.length < 2) {
    return legacyPlayerPostContentGenComments(w, post, options);
  }

  const logContext = {
    post: postContext,
    commenters: cards.map((card) => ({
      id: card.id,
      name: card.name,
      relationshipToPostAuthor: card.relationshipToPostAuthor,
      voiceStyleCard: card.voiceStyleCard,
    })),
  };

  let firstRows = [];
  let firstProblems = [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    console.info(
      "[player-post-comment-context]",
      "attempt=" + String(attempt + 1),
      "post=" + postContext.postId,
      "context=" + JSON.stringify(logContext).slice(0, 14000)
    );

    const prompt = playerPostCommentPrompt(
      w,
      post,
      postContext,
      cards,
      minComments,
      maxComments,
      attempt ? firstProblems : [],
      attempt ? firstRows : []
    );

    let out;
    try {
      out = await askWorldJSON(
        w,
        playerPostCommentPrivateSystem(w, post),
        prompt,
        {
          maxTokens: 900,
          priority: 65,
          source: "player-post-comments-isolated",
        }
      );
    } catch (error) {
      console.error(
        "[player-post-comments]",
        "stage=isolated-ai-result",
        "attempt=" + String(attempt + 1),
        "status=failed",
        "post=" + postContext.postId,
        error
      );
      throw error;
    }

    const rows = playerPostCommentRowsFromOutput(w, out, cards, postContext).slice(0, maxComments);
    const problems = playerPostCommentBatchProblems(w, rows, cards, postContext, minComments);

    console.info(
      "[player-post-comments]",
      "stage=isolated-ai-result",
      "attempt=" + String(attempt + 1),
      "status=" + (problems.length ? "rejected" : "success"),
      "post=" + postContext.postId,
      "usable=" + String(rows.length),
      "problems=" + (problems.join("|") || "none")
    );

    if (!problems.length) {
      return {
        out: { ...(out || {}), comments: rows, changes: [] },
        label: "isolated-player-post-comments",
      };
    }

    if (attempt === 0) {
      firstRows = rows;
      firstProblems = problems;
      continue;
    }

    return {
      out: { comments: rows, changes: [] },
      label: "isolated-player-post-comments-retry",
    };
  }

  return { out: { comments: [], changes: [] }, label: "isolated-player-post-comments" };
}

async function genComments(w, post, options = {}) {
  if (
    options &&
    options.playerPostContentIsolation === true &&
    post &&
    isHuman(w, post.authorId)
  ) {
    return isolatedPlayerPostComments(w, post, options);
  }
  return legacyPlayerPostContentGenComments(w, post, options);
}
`;

  next += helper;
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied player-post comment content isolation: post-only context, per-commenter voice/relationship cards, leak filtering, one semantic retry, and AI-AI reply seed.");
} else {
  console.log("Player-post comment content isolation v1 already applied.");
}
