import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG PLAYER POST COMMENT GUARANTEE v1";

function countMatches(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  return [...text.matchAll(new RegExp(regex.source, flags))].length;
}

function replaceOne(regex, replacement, label, required = true) {
  const count = countMatches(next, regex);
  if (count === 1) {
    next = next.replace(regex, replacement);
    return true;
  }
  if (!required && count === 0) return false;
  throw new Error(`Player-post comment guarantee aborted: ${label} expected 1 match, found ${count}.`);
}

function patchBlock(startAnchor, endAnchor, transform, label) {
  const start = next.indexOf(startAnchor);
  const end = start >= 0 ? next.indexOf(endAnchor, start + startAnchor.length) : -1;
  if (start < 0 || end < 0) throw new Error(`Player-post comment guarantee aborted: ${label} boundary not found.`);
  const block = next.slice(start, end);
  const patched = transform(block);
  if (patched === block) throw new Error(`Player-post comment guarantee aborted: ${label} did not change.`);
  next = next.slice(0, start) + patched + next.slice(end);
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
    ...Object.entries(extra || {}).filter(([key]) => !["postId"].includes(key)).map(([key, value]) => key + "=" + String(value))
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
`;

  replaceOne(
    /async function\s+runSimulationAction\s*\(/,
    helper + "\nasync function runSimulationAction(",
    "diagnostic helper insertion"
  );

  replaceOne(
    /const signalSimulation = useCallback\(\(event\) => \{\s*if \(!event \|\| !event\.type\) return false;/m,
    `const signalSimulation = useCallback((event) => {\n    if (!event || !event.type) return false;\n    if (event.type === "player-post" && event.postId) {\n      update((n) => {\n        const p = (n.posts || []).find((row) => row && row.id === event.postId);\n        playerPostCommentDiagnostic(n, p, "signal", { queued: true });\n        if (typeof channelPublicPostFollowerEffect === "function") channelPublicPostFollowerEffect(n, event.postId);\n      });\n      const commentQueued = requestSimulationAction(\n        mkAction(\n          "comments",\n          \`player-post-comments:\${event.postId}\`,\n          {\n            postId: event.postId,\n            trigger: "player-post",\n            minComments: 2,\n            maxComments: 4,\n            requireHumanAuthor: true,\n          },\n          "manual"\n        )\n      );\n      console.info("[player-post-comments]", "stage=queue", "post=" + event.postId, "queued=" + commentQueued);\n    }`,
    "player-post high-priority signal"
  );

  {
    const needle = 'String(action.payload && action.payload.postId || "")';
    const count = next.split(needle).length - 1;
    if (count !== 2) {
      throw new Error(`Player-post comment guarantee aborted: event trigger post-id anchors expected 2, found ${count}.`);
    }
    next = next.split(needle).join('String(eventFeedTrigger === "player-post" ? "" : (action.payload && action.payload.postId || ""))');
  }

  replaceOne(
    /if \(now\(\) - \(Number\(post\.ts\) \|\| 0\) > LIVE_WORLD_FRESH_COMMENT_WINDOW_MS\) \{/,
    'if (commentTrigger !== "player-post" && now() - (Number(post.ts) || 0) > LIVE_WORLD_FRESH_COMMENT_WINDOW_MS) {',
    "player-post freshness exemption"
  );

  patchBlock('if (action.type === "comments") {', 'if (action.type === "note-react") {', (block) => {
    let out = block;

    const postDecl = /const post = \(view\.posts \|\| \[\]\)\.find\(\(p\) => p\.id === \(action\.payload && action\.payload\.postId\)\);/;
    if (!postDecl.test(out)) return block;
    out = out.replace(postDecl, (match) => match + String.raw`
    const playerPostJob = String(action.payload && action.payload.trigger || "") === "player-post";
    if (playerPostJob) {
      playerPostCommentDiagnostic(view, post, "start", {
        exists: Boolean(post),
        requiredHuman: Boolean(action.payload && action.payload.requireHumanAuthor),
      });
      if (!post) {
        console.warn("[player-post-comments] stopped=post-missing", "post=" + String(action.payload && action.payload.postId || ""));
        return null;
      }
      if (!isHuman(view, post.authorId)) {
        console.warn("[player-post-comments] stopped=author-not-human", "post=" + post.id, "author=" + String(post.authorId || ""));
        return null;
      }
    }`);

    const callPatterns = [
      /const \{ out, label \} = await genComments\(view, post\);/,
      /const generated = await genComments\(view, post\);/,
    ];
    let callPattern = callPatterns.find((rx) => rx.test(out));
    if (!callPattern) return block;
    const originalCall = out.match(callPattern)[0];
    let replacement = originalCall;
    if (originalCall.startsWith("const { out, label }")) {
      replacement = String.raw`let generatedCommentsResult;
    try {
      if (playerPostJob) playerPostCommentDiagnostic(view, post, "ai-call", { providerRequest: "starting" });
      generatedCommentsResult = await genComments(view, post);
      if (playerPostJob) {
        const rawCount = safeAiComments(generatedCommentsResult && generatedCommentsResult.out).length;
        playerPostCommentDiagnostic(view, post, "ai-result", { status: "success", rawComments: rawCount });
      }
    } catch (commentError) {
      if (playerPostJob) {
        console.error("[player-post-comments]", "stage=ai-result", "status=failed", "post=" + post.id, commentError);
        update((n) => {
          const livePost = (n.posts || []).find((row) => row && row.id === post.id);
          playerPostCommentFailureNotice(n, livePost || post, commentError);
        });
      }
      throw commentError;
    }
    const { out, label } = generatedCommentsResult;`;
    } else {
      replacement = String.raw`let generated;
    try {
      if (playerPostJob) playerPostCommentDiagnostic(view, post, "ai-call", { providerRequest: "starting" });
      generated = await genComments(view, post);
      if (playerPostJob) playerPostCommentDiagnostic(view, post, "ai-result", { status: "success" });
    } catch (commentError) {
      if (playerPostJob) {
        console.error("[player-post-comments]", "stage=ai-result", "status=failed", "post=" + post.id, commentError);
        update((n) => {
          const livePost = (n.posts || []).find((row) => row && row.id === post.id);
          playerPostCommentFailureNotice(n, livePost || post, commentError);
        });
      }
      throw commentError;
    }`;
    }
    out = out.replace(callPattern, replacement);

    const applyLine = /update\(\(n\) => \{ n\.autoAt = now\(\); applyComments\(n, post\.id, out, label\); \}\);/;
    if (applyLine.test(out)) {
      out = out.replace(applyLine, String.raw`update((n) => {
      n.autoAt = now();
      const livePost = (n.posts || []).find((row) => row && row.id === post.id);
      const before = livePost ? safePostComments(livePost).length : 0;
      applyComments(n, post.id, out, label);
      const afterPost = (n.posts || []).find((row) => row && row.id === post.id);
      const after = afterPost ? safePostComments(afterPost).length : before;
      if (playerPostJob) playerPostCommentDiagnostic(n, afterPost || post, "saved", { applied: Math.max(0, after - before), visibleComments: after });
    });`);
    }

    return out;
  }, "player-post comment action diagnostics");

  patchBlock("function applyComments(", "async function genReply(", (block) => {
    const loopStart = block.indexOf("(out.comments || []).forEach((c) => {");
    const likesStart = block.indexOf("(out.likes || []).forEach", loopStart);
    if (loopStart < 0 || likesStart < 0) return block;
    let loop = block.slice(loopStart, likesStart);
    if (loop.includes("commentRowError")) return block;
    loop = loop.replace(
      "(out.comments || []).forEach((c) => {",
      `(out.comments || []).forEach((c) => {\n      try {`
    );
    const closeAt = loop.lastIndexOf("    });");
    if (closeAt < 0) return block;
    loop = loop.slice(0, closeAt) + String.raw`      } catch (commentRowError) {
        console.warn(
          "[player-post-comments] comment-skip",
          "post=" + String(postId || ""),
          "character=" + String(c && (c.id !== undefined ? c.id : c.name) || ""),
          commentRowError
        );
      }
` + loop.slice(closeAt);
    return block.slice(0, loopStart) + loop + block.slice(likesStart);
  }, "per-comment fault isolation");
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied guaranteed high-priority player-post comments with diagnostics and fault isolation.");
} else {
  console.log("Player-post comment guarantee v1 already applied.");
}
