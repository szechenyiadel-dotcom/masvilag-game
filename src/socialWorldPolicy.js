/*
 * MÁSVILÁG — isolated social-world policy layer
 *
 * This module intentionally does NOT replace the existing world engine.
 * It only strengthens AI-facing contracts for the requested social behavior:
 * - realistic alternation of major social actions,
 * - immediate/contextual comment replies with third-party participation,
 * - exact, directional and nuanced relationship interpretation.
 *
 * Keeping this outside App.jsx makes the change easy to remove/audit and avoids
 * disturbing already-working post/DM/note/comment/roleplay implementations.
 */

const SOCIAL_POLICY_MARKER = "[MASVILAG_SOCIAL_WORLD_POLICY_V1]";

const RELATIONSHIP_POLICY = `
${SOCIAL_POLICY_MARKER}
RELATIONSHIP INTERPRETATION — HARD CONTRACT
When any character text, Connections field, memory, canon capsule, profile text, scene history or exact-pair context contains relationship information, read the FULL wording before deciding behavior. Never flatten a nuanced relationship into a generic label such as "crush", "friend", "enemy" or "ex" when the source says more.

For EVERY relevant pair, preserve all distinctions that are actually present in source canon:
- DIRECTION: A→B and B→A are separate facts. Never mirror feelings automatically.
- RECIPROCITY: mutual, one-sided, unknown, mistaken, rejected, conflicted or asymmetrical.
- SELF-AWARENESS: openly acknowledged; privately acknowledged; suspected but denied; subconscious / not admitted even to themself; confused; deliberately suppressed.
- DISCLOSURE: public; known only to one person; secret; hidden from the target; hidden from everyone; accidentally exposed; rumored only.
- INTENSITY / KIND: attraction, crush, infatuation, love, obsession, jealousy, possessiveness, sexual tension, affection, loyalty, rivalry, resentment, fear, distrust, friendship, situationship, dating, exes, family-like bond, etc. Keep the source's actual nuance rather than upgrading or downgrading it.
- STATUS / TIMELINE: current vs past; unresolved; on-and-off; newly developing; long-term; ended but lingering; pretending to be over it.
- BEHAVIORAL CONTRADICTION: what the character feels may differ from what they consciously believe, say publicly, tell the target, or show in behavior.
- KNOWLEDGE BOUNDARY: a character may act only on what THEY know. Private canon from another person's mind is not automatically known to them.

Examples of required fidelity:
- "A secretly loves B but will not admit it even to herself" is NOT merely "A has a crush on B". Preserve secrecy, love/intensity, denial/self-awareness state and A→B direction.
- "A likes B, B does not like A that way" must remain asymmetric. Never turn it into mutual flirting.
- "B secretly crushes on A" must never be reversed into A crushing on B.
- jealousy, flirting, hostility or protectiveness must follow the exact directional pair canon and current context, not a generic relationship label.

Before producing any relationship-driven line or action, internally resolve: WHO feels WHAT toward WHOM, how strongly, whether they admit it to themselves, whether they admit/show it to the other person, who else knows, whether it is reciprocated, and what current event activates it. Do not expose secret internal facts in public dialogue unless canon/current events justify the reveal.
`;

const COMMENT_POLICY = `
COMMENT / REPLY REALISM — HARD CONTRACT
Fresh-post activity is a live conversation, not a single-bot exchange.
- For a fresh post, comments may keep arriving throughout its configured fresh-comment window.
- A direct reply to a comment is high-priority and should receive a contextual reply immediately when an eligible character would naturally answer.
- The responder is NOT limited to the player, the post author, the previous bot, or the person originally addressed. Any eligible character who can see the public thread may join when the situation naturally invites it — especially arguments, jealousy, flirting, teasing, defending someone, correcting someone, rivalry or social pile-ons.
- Third-party entry must be grounded in that character's own knowledge, relationship and personality. Do not inject unrelated people merely to create noise.
- Preserve exact reply threading and who is answering whom.
- Do not create endless AI↔AI ping-pong. After a natural exchange, stop unless new content, a human reply, a materially new participant or a meaningful escalation creates a fresh reason to continue.
- Do not repeatedly paraphrase the same comeback. Every additional reply must add a new reaction, angle, escalation, joke, boundary, correction or social consequence.
`;

const RHYTHM_POLICY = `
WORLD SOCIAL RHYTHM — HARD CONTRACT
The world should feel continuously alive. Across autonomous social activity, keep a realistic mixture of POST, DM, NOTE and public COMMENT/REPLY activity instead of letting one major action type dominate for many turns.
- COMMENT and COMMENT_REPLY are conversational bursts and MAY repeat naturally.
- For the other major social actions (POST, DM, NOTE), avoid long same-type streaks. If the current request allows choosing among action types, strongly prefer a different major type after the same one has just occurred, while still respecting character motivation and context.
- Do not alternate mechanically in a fixed pattern. Realism wins: vary timing, author and channel according to ongoing events.
- A DM may trigger a later post/note; a post may trigger comments/DMs; a note may provoke a reply or DM. Let consequences cross channels naturally.
- Never create filler solely to satisfy rotation. Every action must have a plausible actor, motive and current-context reason.
`;

function isAiEndpoint(url) {
  try {
    const raw = typeof url === "string" ? url : (url && url.url) || "";
    const parsed = new URL(raw, window.location.href);
    return /\/ai\/(messages|chat|respond)$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

function isJsonBody(init) {
  if (!init || typeof init.body !== "string") return false;
  const headers = new Headers(init.headers || {});
  const type = String(headers.get("content-type") || "").toLowerCase();
  return !type || type.includes("application/json");
}

function appendPolicy(value, policy) {
  const text = String(value || "");
  if (text.includes(SOCIAL_POLICY_MARKER)) return text;
  return `${text}\n\n${policy}`.trim();
}

function strengthenAiPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;

  const next = { ...payload };
  const combinedPolicy = `${RELATIONSHIP_POLICY}\n${COMMENT_POLICY}\n${RHYTHM_POLICY}`;

  // Providers in the existing proxy all accept a top-level system field.
  // Keep the existing system prompt intact and append only the policy contract.
  next.system = appendPolicy(next.system, combinedPolicy);

  return next;
}

const originalFetch = window.fetch.bind(window);

window.fetch = async function masvilagPolicyFetch(input, init = {}) {
  if (!isAiEndpoint(input) || !isJsonBody(init)) {
    return originalFetch(input, init);
  }

  try {
    const parsed = JSON.parse(init.body);
    const strengthened = strengthenAiPayload(parsed);
    return originalFetch(input, {
      ...init,
      body: JSON.stringify(strengthened),
    });
  } catch {
    // Never block a working AI request because of the policy layer.
    return originalFetch(input, init);
  }
};
