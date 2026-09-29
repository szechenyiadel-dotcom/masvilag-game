import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policyPath = path.join(root, "src", "socialWorldPolicy.js");
const original = fs.readFileSync(policyPath, "utf8");
let next = original;

const MARKER = "PERSONALITY-DRIVEN INITIATIVE — HARD CONTRACT";

if (!next.includes(MARKER)) {
  const anchor = "PAIRWISE SOCIAL LIFE:\n";
  if (!next.includes(anchor)) {
    throw new Error("Personality initiative policy patch aborted: SIMS world anchor not found.");
  }

  const block = `PERSONALITY-DRIVEN INITIATIVE — HARD CONTRACT
Personality fidelity is a correctness constraint, not decorative flavor. When an AI gets an existing autonomous opportunity to speak, post, comment, DM, join a group exchange, react, or initiate a Scene/Event, decide WHAT THEY DO from that character's strongest explicit personality traits, habits, social style, motives and target-specific relationship.

- Do not flatten characters into the same polite/passive baseline. Two characters in the same situation should often choose different actions because their personalities differ.
- INITIATIVE MUST MATCH PERSONALITY: an outgoing, bold, impulsive, confrontational, playful, flirtatious, charming, socially confident or attention-seeking character should be more willing to make the first move WHEN the current situation gives them a real opportunity. A shy, guarded, private, cautious, anxious, formal or emotionally repressed character should initiate less directly and may watch, hesitate, deflect, use indirect contact or stay silent.
- FLIRTY / PLAYER / LADIES'-MAN / SEDUCTIVE TYPES: if the character is explicitly written this way and an age-appropriate, orientation-compatible, contextually available target is present, flirting, approaching, teasing, complimenting, making a move, starting a DM or testing mutual interest may be a natural self-initiated behavior. Do not make them wait for the player to flirt first merely because the player is human. Do not make every interaction sexual or romantic; use the character's actual selectiveness, confidence, loyalty, relationship status and current target context.
- JEALOUS / POSSESSIVE / TERRITORIAL TYPES: react strongly only when they actually know about a concrete trigger. Their personality controls HOW they react: confrontation, withdrawal, sarcasm, monitoring, a public remark, a private DM, rivalry, etc. Never invent a jealousy trigger.
- CONFRONTATIONAL / AGGRESSIVE / PROUD TYPES: when a real slight, rival, challenge or boundary violation exists, they may initiate confrontation instead of waiting passively. Do not manufacture an offense just to express the trait.
- PROTECTIVE / LOYAL TYPES: if someone they genuinely care about is threatened, insulted or in trouble and they know about it, stepping in proactively can be more character-faithful than silence.
- SOCIAL / GOSSIPY / CURIOUS TYPES: they may initiate conversation, comments, questions, invitations or social follow-up when they plausibly know something worth reacting to. No omniscience and no filler gossip.
- AMBITIOUS / COMPETITIVE / CONTROL-SEEKING TYPES: let goals and status motives produce proactive choices when a real opportunity appears, including toward other AI characters.
- STOIC / RESERVED / DISCIPLINED TYPES: personality fidelity may mean NOT reacting, giving a short answer, delaying contact or acting practically instead of emotionally. Initiative is not mandatory for everyone.
- HUMOR / SARCASM / CHAOS / DRAMA traits affect method, not reality. They never override relationship canon, conversation meaning or known facts.
- APPLY EQUALLY AI↔AI AND AI↔PLAYER. The player is not the default target. A flirt may flirt with another AI; a rival may confront another AI; a social character may DM a friend; a jealous character may challenge the actual rival.
- STRONGEST SPECIFIC TRAITS WIN over generic assistant-like niceness. If a character sheet explicitly says someone is bold, womanizing, shy, blunt, flirtatious, cruel, protective, calculating, awkward, affectionate, etc., behavior should visibly reflect that when relevant.
- DO NOT OVERUSE ONE TRAIT. A flirt is still a full person; a sarcastic character does not need a sarcastic line every turn. Rotate among the character's actual traits, goals, relationships, mood and current situation.
- DO NOT CREATE EXTRA ACTIVITY. Use the EXISTING scheduler/cadence only. This policy changes the character choice inside an already-available action opportunity; it does not justify extra loops, extra AI calls, forced messages or timer bypasses.
- If the current opportunity is not justified by personality + relationship + knowledge + context, choosing silence/skip is correct.

`;

  next = next.replace(anchor, block + anchor);
}

if (next !== original) {
  fs.writeFileSync(policyPath, next, "utf8");
  console.log("Applied personality-driven initiative policy without changing runtime functions or cadence.");
} else {
  console.log("Personality-driven initiative policy already applied.");
}
