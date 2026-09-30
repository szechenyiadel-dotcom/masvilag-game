import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "src", "App.jsx");
const original = fs.readFileSync(appPath, "utf8");
let next = original;

const MARKER = "MÁSVILÁG DIRECT DM CONTINUITY v1";

function countMatches(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  return [...text.matchAll(new RegExp(regex.source, flags))].length;
}

function replaceInBlock(startAnchor, endAnchor, transform, label) {
  const start = next.indexOf(startAnchor);
  const end = start >= 0 ? next.indexOf(endAnchor, start + startAnchor.length) : -1;
  if (start < 0 || end < 0) {
    throw new Error(`Direct DM continuity patch aborted: ${label} block boundary not found.`);
  }
  const block = next.slice(start, end);
  const patched = transform(block);
  if (patched === block) {
    throw new Error(`Direct DM continuity patch aborted: ${label} block did not change.`);
  }
  next = next.slice(0, start) + patched + next.slice(end);
}

if (!next.includes(`/* ${MARKER} */`)) {
  const helper = String.raw`
/* ${MARKER} */
function directDmProtectedHistory(w, c, ck) {
  return ((w && w.chats && w.chats[ck]) || [])
    .slice(-14)
    .map((m) => {
      if (!m) return "";
      const speaker = m.from === "me"
        ? (w.player && w.player.name || "Player")
        : (c && c.name || "Character");
      const image = (m.imageId || m.image)
        ? " [IMAGE: " + String(m.imageDescription || "image").replace(/\s+/g, " ").trim() + "]"
        : "";
      return speaker + ": " + String(m.text || "") + image;
    })
    .filter(Boolean)
    .join("\n");
}

function directDmOwnRecent(w, c, ck) {
  return ((w && w.chats && w.chats[ck]) || [])
    .filter((m) => m && m.from !== "me" && String(m.text || "").trim())
    .slice(-5)
    .map((m, index) => String(index + 1) + ". " + String(m.text || "").trim())
    .join("\n");
}

function directDmVoiceCard(w, c) {
  if (!c) return "";
  try {
    if (typeof voiceStyleCardsForIds === "function") {
      return String(voiceStyleCardsForIds(w, [c.id], c.id) || "");
    }
  } catch {}
  if (c.aiVoiceStyleCard && typeof c.aiVoiceStyleCard === "object") {
    return String(c.aiVoiceStyleCard.card || "");
  }
  return "";
}

function directDmProtectedTail(w, c, ck, latestText) {
  const history = directDmProtectedHistory(w, c, ck);
  const ownRecent = directDmOwnRecent(w, c, ck);
  const styleCard = directDmVoiceCard(w, c);
  const latest = String(latestText || "");

  return "\n\n[MÁSVILÁG_DIRECT_DM_PROTECTED_TAIL_V1]\n" +
    "PROTECTED DIRECT-DM CONTEXT — NEVER OMIT THIS BLOCK.\n\n" +
    "VOICE / WRITING-STYLE CARD — MANDATORY FOR THIS SPEAKER ONLY:\n" +
    (styleCard || "No separate style card available; follow the character canon already above.") + "\n\n" +
    "LATEST 14 MESSAGES FROM THIS EXACT DM, BOTH SIDES, VERBATIM:\n" +
    (history || "No earlier DM history.") + "\n\n" +
    "YOUR LAST 5 OWN DM MESSAGES — DO NOT REUSE THEIR OPENINGS, PHRASES, METAPHORS OR FLIRT/THREAT FORMULAS:\n" +
    (ownRecent || "No earlier authored DM messages.") + "\n\n" +
    "MANDATORY RESPONSE BEHAVIOR:\n" +
    "- React DIRECTLY to the latest player message: its literal content, tone and intention. Continue this same conversational beat; do not jump to a generic new topic.\n" +
    "- If the player reciprocates flirtation, respond to the fact that they reciprocated it. If they ask a question, answer it when your character knows. If they reject you, react to that rejection. If they agree, react to the agreement.\n" +
    "- Relationship level and personality decide HOW you react (embarrassed, pleased, teasing, defensive, sarcastic, possessive, calm, etc.), never WHETHER you acknowledge what was just said.\n" +
    "- Do not repeat the same opening, image, threat, joke, metaphor, pet name pattern or distinctive 4+ word phrase from your recent DM messages.\n" +
    "- Reply in the language of this DM conversation/latest player message: English conversation -> natural English; Hungarian conversation -> natural correct Hungarian, except character-sheet style rules intentionally overriding spelling/punctuation/casing.\n" +
    "- Keep the exact JSON response schema requested earlier in the prompt.\n\n" +
    "AMIRE MOST VÁLASZOLNOD KELL (SZÓ SZERINT):\n" +
    latest;
}

function directDmPrebudgetPrompt(prompt, protectedTail) {
  const base = String(prompt || "");
  const tail = String(protectedTail || "");
  const cap = Math.max(28000, Number(AI_MAX_PROMPT_CHARS) || 82000);

  if (tail.length >= cap) {
    console.warn(
      "[dm-prompt-tail] protected context is unusually large",
      "tailChars=" + tail.length,
      "cap=" + cap
    );
    return tail;
  }

  const backgroundBudget = Math.max(4000, cap - tail.length);
  let background = base;
  if (background.length > backgroundBudget) {
    background = preserveEdges(background, backgroundBudget, "dm background");
    if (background.length > backgroundBudget) {
      background = background.slice(0, backgroundBudget);
    }
  }
  return background + tail;
}

function directDmPromptDebugLog(prompt, c, latestText, retry = false) {
  const value = String(prompt || "");
  console.info(
    "[dm-prompt-tail]",
    retry ? "retry=1" : "retry=0",
    "bot=" + String(c && c.name || "") + "[" + String(c && c.id || "") + "]",
    "promptChars=" + value.length,
    "latestChars=" + String(latestText || "").length,
    "tail=" + value.slice(-500)
  );
}

function directDmReplyLooksRepetitive(w, c, text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!w || !c || !value) return false;

  const ck = chatKey(w.meId, c.id);
  const old = ((w.chats && w.chats[ck]) || [])
    .filter((m) => m && m.from !== "me" && String(m.text || "").trim())
    .slice(-5)
    .map((m) => String(m.text || "").replace(/\s+/g, " ").trim());

  const base = normUtterance(value);
  const words = base.split(" ").filter(Boolean);
  const opening = words.slice(0, Math.min(6, words.length)).join(" ");

  for (const prior of old) {
    const previous = normUtterance(prior);
    if (!previous) continue;
    if (previous === base) return true;

    const previousWords = previous.split(" ").filter(Boolean);
    const previousOpening = previousWords
      .slice(0, Math.min(6, previousWords.length))
      .join(" ");

    if (opening.length >= 18 && previousOpening && opening === previousOpening) return true;
    if (
      words.length >= 4 &&
      previousWords.length >= 4 &&
      jaccard(wordSet(base), wordSet(previous)) >= 0.58
    ) {
      return true;
    }

    for (let index = 0; index <= words.length - 4; index += 1) {
      const phrase = words.slice(index, index + 4).join(" ");
      if (phrase.length >= 18 && previous.includes(phrase)) return true;
    }
  }

  return false;
}

async function askDirectDmJSONInteractive(w, system, prompt, options = {}) {
  const charId = String(options.dmCharId || "");
  const ck = String(options.dmChatKey || "");
  const latestText = String(options.dmLatestText || "");
  const forward = { ...options };
  delete forward.dmCharId;
  delete forward.dmChatKey;
  delete forward.dmLatestText;

  const c = charId ? charById(w, charId) : null;
  const protectedTail = c
    ? directDmProtectedTail(w, c, ck || chatKey(w.meId, c.id), latestText)
    : "";
  const finalPrompt = directDmPrebudgetPrompt(prompt, protectedTail);

  directDmPromptDebugLog(finalPrompt, c, latestText, false);

  const out = await askWorldJSONInteractive(
    w,
    system,
    finalPrompt,
    { ...forward, maxTries: 1 }
  );

  const firstReply = String(out && out.reply !== undefined ? out.reply : "").trim();
  if (!c || !firstReply || !directDmReplyLooksRepetitive(w, c, firstReply)) {
    return out;
  }

  const retryPrompt =
    directDmProtectedTail(w, c, ck || chatKey(w.meId, c.id), latestText) +
    "\n\nONE STRICT REWRITE ONLY:\n" +
    "The rejected draft repeated your recent DM language. Write a genuinely new reply that still reacts directly to the exact latest player message. " +
    "Do not reuse the same opening, metaphor, threat/flirt formula, or distinctive phrase.\n" +
    "REJECTED DRAFT:\n" + firstReply + "\n\n" +
    "Return ONLY JSON in this exact minimal form: {\"reply\":\"your rewritten reply\"}\n\n" +
    "AMIRE MOST VÁLASZOLNOD KELL (SZÓ SZERINT):\n" + latestText;

  directDmPromptDebugLog(retryPrompt, c, latestText, true);

  const retryOut = await askWorldJSONInteractive(
    w,
    system,
    retryPrompt,
    { ...forward, maxTries: 1, maxTokens: Math.min(500, Number(forward.maxTokens) || 500) }
  );

  const replacement = String(
    retryOut && retryOut.reply !== undefined ? retryOut.reply : ""
  ).trim();

  return replacement
    ? { ...(out || {}), reply: replacement }
    : out;
}
`;

  const chatAnchor = /function\s+Chat\s*\(/;
  if (countMatches(next, chatAnchor) !== 1) {
    throw new Error("Direct DM continuity patch aborted: Chat function anchor changed.");
  }
  next = next.replace(chatAnchor, helper + "\nfunction Chat(");

  replaceInBlock(
    "const send = async (override) => {",
    "function Groups(",
    (block) => {
      let out = block;
      const callAt = out.indexOf("const out = await askWorldJSONInteractive(");
      if (callAt < 0) return block;

      out =
        out.slice(0, callAt) +
        out.slice(callAt).replace(
          "const out = await askWorldJSONInteractive(",
          "const out = await askDirectDmJSONInteractive("
        );

      out = out.replace(
        /\{ maxTries: 1, maxTokens: 650, timeoutMs: 28000 \}/,
        "{ maxTries: 1, maxTokens: 650, timeoutMs: 28000, dmCharId: c.id, dmChatKey: ck, dmLatestText: t }"
      );

      return out;
    },
    "normal player-to-bot DM"
  );
}

if (next !== original) {
  fs.writeFileSync(appPath, next, "utf8");
  console.log("Applied protected direct-DM continuity and single repetition retry.");
} else {
  console.log("Direct DM continuity v1 already applied.");
}
