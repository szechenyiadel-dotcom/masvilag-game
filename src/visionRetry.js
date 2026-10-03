/*
 * Reading a picture (album upload, post, chat photo) is background work on free capacity. When the
 * server has none right now it answers 503 + Retry-After; these helpers decide what to do with each
 * kind of failure so a picture is never silently left unread.
 */

export const VISION_RETRY_MIN_MS = 15000;
export const VISION_RETRY_MAX_MS = 10 * 60 * 1000;
export const VISION_MAX_ATTEMPTS = 8;
export const VISION_PATIENCE_MS = 25000;

/* "waiting": no free capacity at the moment · "transient": network or server hiccup ·
   "hard": this picture or request can never work, trying again would only waste capacity. */
export function classifyVisionError(error) {
  const status = Number(error && error.status);
  if (!status) return "transient";
  if ([408, 429, 503].includes(status)) return "waiting";
  if (status >= 500) return "transient";
  return "hard";
}

/* When to come back after the nth failed try: the server's Retry-After if it gave one, otherwise
   15 s, 30 s, 1 min, 2 min... up to 10 minutes. */
export function visionRetryDelayMs(error, attempt = 1) {
  const hinted = Number(error && error.retryAfter) * 1000;
  const delay = Number.isFinite(hinted) && hinted > 0
    ? Math.max(hinted, VISION_RETRY_MIN_MS)
    : VISION_RETRY_MIN_MS * Math.pow(2, Math.max(0, Number(attempt) - 1));
  return Math.min(VISION_RETRY_MAX_MS, delay);
}

/* For the moment someone is waiting (a post, a chat photo): try, and if the server says "wait", wait
   a little and try again, but never longer than maxWaitMs in total. `pending` tells the caller the
   picture still has to be read later; a hard failure is never pending. */
export async function readImagePatiently(analyze, { maxWaitMs = VISION_PATIENCE_MS, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  const started = now();
  let attempts = 0;
  for (;;) {
    attempts += 1;
    try {
      const text = String((await analyze()) || "").trim();
      return { text, pending: false, attempts };
    } catch (error) {
      if (classifyVisionError(error) === "hard") return { text: "", pending: false, attempts, error };
      const hinted = Number(error && error.retryAfter) * 1000;
      const delay = Number.isFinite(hinted) && hinted > 0 ? hinted : 4000;
      if (now() - started + delay > maxWaitMs) return { text: "", pending: true, attempts, error };
      await sleep(delay);
    }
  }
}

/* Posts whose picture could not be read yet, oldest forgotten last: the next one to try. */
export function nextPostToRead(posts, { attempted = new Set(), maxAttempts = VISION_MAX_ATTEMPTS, hasSource = () => true } = {}) {
  return (Array.isArray(posts) ? posts : [])
    .filter((post) =>
      post && post.id && post.imageAnalysisPending === true &&
      !String(post.imageDescription || "").trim() &&
      (Number(post.imageAnalysisAttempts) || 0) < maxAttempts &&
      !attempted.has(post.id) &&
      hasSource(post)
    )
    .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0))[0] || null;
}
