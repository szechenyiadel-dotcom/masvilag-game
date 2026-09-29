import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG COMMENT + REPLY RELIABILITY v1";

if (!next.includes(MARKER)) {
  const signalStart = next.indexOf("const signalSimulation = useCallback((event) => {");
  const signalEnd = signalStart >= 0
    ? next.indexOf("}, [requestSimulationAction]);", signalStart)
    : -1;

  if (signalStart < 0 || signalEnd < 0) {
    throw new Error("Comment/reply reliability patch aborted: signalSimulation boundary not found.");
  }

  let signal = next.slice(signalStart, signalEnd);

  /* Player-authored posts must get a real, small comment pass instead of an
     optional zero-comment wave. This does not alter global posting cadence. */
  const playerPostCommentAction = /(`event-post:\$\{event\.postId\}`,\s*)\{\s*postId:\s*event\.postId\s*\}(\s*,\s*"event")/m;
  if (!playerPostCommentAction.test(signal)) {
    throw new Error("Comment/reply reliability patch aborted: player-post comment action changed.");
  }
  signal = signal.replace(
    playerPostCommentAction,
    `$1{\n            postId: event.postId,\n            trigger: "player-post",\n            minComments: 1,\n            maxComments: 4,\n          }$2`
  );

  /* A direct reply or @mention is itself enough conversational reason for the
     addressed AI to answer. The old generic relevance threshold could reject
     short natural replies such as "yeah", "exactly", an emoji, or a name. */
  const naturalTargetBlock = /const naturalTarget = livePost && liveComment\s*\?\s*naturalCommentReplyTargets\(\s*live,\s*livePost,\s*liveComment\s*\)\s*\.find\(\(row\) => commentWarrantsAiReply\(\s*live,\s*livePost,\s*liveComment,\s*row\.id\s*\)\)\s*:\s*null\s*;/m;
  if (!naturalTargetBlock.test(signal)) {
    throw new Error("Comment/reply reliability patch aborted: direct reply target block changed.");
  }
  signal = signal.replace(
    naturalTargetBlock,
    `const replyTargets = livePost && liveComment\n        ? naturalCommentReplyTargets(live, livePost, liveComment)\n        : [];\n      const directTarget = replyTargets.find((row) =>\n        row && (row.reason === "mention" || row.reason === "parent")\n      );\n      const naturalTarget =\n        directTarget ||\n        replyTargets.find((row) =>\n          commentWarrantsAiReply(live, livePost, liveComment, row.id)\n        );`
  );

  /* Player-triggered comment/reply work belongs at the front of the existing
     simulation queue. This changes only queue priority for these two reactions;
     no timer, loop, cadence, DM, Scene, Note or world action is modified. */
  signal = signal.replace(
    /("comments",\s*`event-post:\$\{event\.postId\}`,[\s\S]*?maxComments:\s*4,[\s\S]*?\}\s*,\s*)"event"/m,
    `$1"coverage"`
  );
  signal = signal.replace(
    /("reply",\s*`event-reply:\$\{event\.postId\}:\$\{event\.commentId\}:\$\{naturalTarget \? naturalTarget\.id : "cast"\}`,[\s\S]*?trigger:\s*"player-comment",[\s\S]*?\}\s*,\s*)"event"/m,
    `$1"coverage"`
  );

  next = next.slice(0, signalStart) + signal + next.slice(signalEnd);

  /* The existing quota repair already knows how to recover an empty/invalid
     comment generation. Enable it for the explicit player-post reaction too,
     with the small 1..4 limits supplied above. */
  const quotaAnchor = /const quotaEnforced\s*=\s*commentTrigger === "fresh-post"\s*\|\|\s*isGuaranteedCoverage\s*;/m;
  if (!quotaAnchor.test(next)) {
    throw new Error("Comment/reply reliability patch aborted: comment quota anchor changed.");
  }
  next = next.replace(
    quotaAnchor,
    `const quotaEnforced =\n      commentTrigger === "fresh-post" ||\n      commentTrigger === "player-post" ||\n      isGuaranteedCoverage; /* ${MARKER} */`
  );
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied reliable player-post comments + direct comment replies.");
} else {
  console.log("Comment + reply reliability already applied.");
}
