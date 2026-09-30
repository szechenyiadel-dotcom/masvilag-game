import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG PLAYER POST COMMENT GUARANTEE v2";

function matches(regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  return [...next.matchAll(new RegExp(regex.source, flags))];
}
function replaceOne(regex, replacement, label) {
  const count = matches(regex).length;
  if (count !== 1) throw new Error(`Player-post comment guarantee v2 aborted: ${label} expected 1 match, found ${count}.`);
  next = next.replace(regex, replacement);
}

if (!next.includes(`/* ${MARKER} */`)) {
  const helper = String.raw`
/* ${MARKER} */
function playerPostCommentDiagnostic(w, post, stage, extra = {}) {
  const postId = String(post && post.id || extra.postId || "");
  const authorId = String(post && post.authorId || "");
  const ageMs = post ? Math.max(0, now() - (Number(post.ts) || 0)) : -1;
  const fresh = post ? ageMs <= LIVE_WORLD_FRESH_COMMENT_WINDOW_MS : false;
  const human = post ? Boolean(isHuman(w, post.authorId)) : false;
  console.info(
    "[player-post-comments]",
    "stage=" + String(stage || "unknown"),
    "post=" + postId,
    "author=" + authorId,
    "humanAuthor=" + human,
    "me=" + String(w && w.meId || ""),
    "fresh=" + fresh,
    "ageMs=" + ageMs,
    ...Object.entries(extra || {}).filter(([key]) => key !== "postId").map(([key, value]) => key + "=" + String(value))
  );
}

function playerPostCommentFailureNotice(w, post, error) {
  if (!w || !post || !isHuman(w, post.authorId)) return;
  const message = String(error && error.message || error || "AI comment generation failed")
    .replace(/\s+/g, " ")
    .slice(0, 220);
  pushNote(w, post.authorId, {
    icon: "⚠️",
    text: worldLanguage(w, post.authorId) === "en"
      ? "AI comments could not be generated for your post: " + message
      : "A botkommenteket most nem sikerült legenerálni a posztodhoz: " + message,
    link: { type: "post", id: post.id },
  });
}

function playerPostUsableCommentRows(w, out) {
  const seen = new Set();
  return safeAiComments(out).filter((row) => {
    try {
      if (!row || typeof row !== "object") return false;
      const actorId = findChar(w, row.id !== undefined ? row.id : (row.authorId !== undefined ? row.authorId : row.name));
      const text = String(row.text || "").trim();
      if (!actorId || isHuman(w, actorId) || !text || seen.has(actorId)) return false;
      seen.add(actorId);
      return true;
    } catch (error) {
      console.warn("[player-post-comments] comment-skip", error);
      return false;
    }
  }).slice(0, 4);
}

async function runSimulationAction(view, update, action, addImage) {
  if (!action || action.type !== "player-post-comments-guarantee") {
    return legacyPlayerPostRunSimulationAction(view, update, action, addImage);
  }
  const postId = String(action.payload && action.payload.postId || "");
  const post = (view.posts || []).find((row) => row && row.id === postId);
  playerPostCommentDiagnostic(view, post, "start", { exists: Boolean(post), trigger: "player-post" });

  if (!post) {
    console.warn("[player-post-comments] stopped=post-missing", "post=" + postId);
    return "player-post-comments-missing";
  }
  if (!isHuman(view, post.authorId)) {
    console.warn("[player-post-comments] stopped=author-not-human", "post=" + post.id, "author=" + String(post.authorId || ""));
    return "player-post-comments-not-human";
  }

  let label = "";
  let combinedRows = [];
  let combinedChanges = [];
  let calls = 0;
  let lastError = null;

  while (calls < 2 && combinedRows.length < 2) {
    calls += 1;
    try {
      playerPostCommentDiagnostic(view, post, "ai-call", { call: calls, providerRequest: "starting" });
      const generated = await genComments(view, post, { minComments: 2, maxComments: 4 });
      label = String(generated && generated.label || label || "");
      const out = generated && generated.out && typeof generated.out === "object" ? generated.out : {};
      const rows = playerPostUsableCommentRows(view, out);
      const existingActors = new Set(combinedRows.map((row) => findChar(view, row.id !== undefined ? row.id : (row.authorId !== undefined ? row.authorId : row.name))).filter(Boolean));
      rows.forEach((row) => {
        const actorId = findChar(view, row.id !== undefined ? row.id : (row.authorId !== undefined ? row.authorId : row.name));
        if (actorId && !existingActors.has(actorId) && combinedRows.length < 4) {
          existingActors.add(actorId);
          combinedRows.push(row);
        }
      });
      combinedChanges.push(...safeAiChanges(out));
      playerPostCommentDiagnostic(view, post, "ai-result", {
        call: calls,
        status: "success",
        provider: label || "unknown",
        usableComments: combinedRows.length,
      });
    } catch (error) {
      lastError = error;
      console.error("[player-post-comments]", "stage=ai-result", "call=" + calls, "status=failed", "post=" + post.id, error);
    }
  }

  if (!combinedRows.length) {
    const finalError = lastError || new Error("The AI returned no usable bot comments.");
    update((n) => {
      const livePost = (n.posts || []).find((row) => row && row.id === post.id);
      playerPostCommentFailureNotice(n, livePost || post, finalError);
    });
    playerPostCommentDiagnostic(view, post, "failed", { calls, reason: String(finalError.message || finalError) });
    return "player-post-comments-failed";
  }

  const safeOut = {
    comments: combinedRows,
    changes: combinedChanges,
    likes: [],
    memories: [],
    events: [],
    selfUpdates: [],
    relationshipUpdates: [],
  };

  update((n) => {
    const livePost = (n.posts || []).find((row) => row && row.id === post.id);
    const before = livePost ? safePostComments(livePost).length : 0;
    try {
      applyComments(n, post.id, safeOut, label);
    } catch (applyError) {
      console.error("[player-post-comments]", "stage=apply", "post=" + post.id, applyError);
      playerPostCommentFailureNotice(n, livePost || post, applyError);
      return;
    }
    const afterPost = (n.posts || []).find((row) => row && row.id === post.id);
    const after = afterPost ? safePostComments(afterPost).length : before;
    playerPostCommentDiagnostic(n, afterPost || post, "saved", {
      aiCalls: calls,
      provider: label || "unknown",
      applied: Math.max(0, after - before),
      visibleComments: after,
    });
  });

  return "player-post-comments";
}
`;

  replaceOne(
    /async function\s+runSimulationAction\s*\(view,\s*update,\s*action,\s*addImage\)\s*\{/,
    helper + "\nasync function legacyPlayerPostRunSimulationAction(view, update, action, addImage) {",
    "runSimulationAction wrapper"
  );

  replaceOne(
    /const signalSimulation = useCallback\(\(event\) => \{\s*if \(!event \|\| !event\.type\) return false;/m,
    `const signalSimulation = useCallback((event) => {\n    if (!event || !event.type) return false;\n    if (event.type === "player-post" && event.postId) {\n      update((n) => {\n        const p = (n.posts || []).find((row) => row && row.id === event.postId);\n        playerPostCommentDiagnostic(n, p, "signal", { queued: true });\n        if (typeof channelPublicPostFollowerEffect === "function") channelPublicPostFollowerEffect(n, event.postId);\n      });\n      const commentQueued = requestSimulationAction(\n        mkAction(\n          "player-post-comments-guarantee",\n          \`player-post-comments:\${event.postId}\`,\n          { postId: event.postId, trigger: "player-post", requireHumanAuthor: true },\n          "manual"\n        )\n      );\n      console.info("[player-post-comments]", "stage=queue", "post=" + event.postId, "queued=" + commentQueued);\n    }`,
    "player-post high-priority signal"
  );

  {
    const needle = 'String(action.payload && action.payload.postId || "")';
    const count = next.split(needle).length - 1;
    if (count !== 2) {
      throw new Error(`Player-post comment guarantee v2 aborted: event-feed post-id anchors expected 2, found ${count}.`);
    }
    next = next.split(needle).join('String(eventFeedTrigger === "player-post" ? "" : (action.payload && action.payload.postId || ""))');
  }

  replaceOne(
    /if \(now\(\) - \(Number\(post\.ts\) \|\| 0\) > LIVE_WORLD_FRESH_COMMENT_WINDOW_MS\) \{/,
    'if (commentTrigger !== "player-post" && now() - (Number(post.ts) || 0) > LIVE_WORLD_FRESH_COMMENT_WINDOW_MS) {',
    "player-post freshness exemption"
  );
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied player-post comment guarantee v2: independent manual-priority comments, diagnostics, multiplayer-safe ownership, provider failure notice.");
} else {
  console.log("Player-post comment guarantee v2 already applied.");
}
