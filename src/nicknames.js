/* A nickname field often carries a note next to the name: "Dagger (her hero name, not everyone uses)". The name is what
   people say; the note is information about it. The two must never travel as one string: a model (and the vocative
   rewriting that follows it) would write the note out loud, brackets and all. */

/* What a note says when the nickname is NOT everyone's normal way to address the person. */
const RESTRICTING = /\b(?:hero|code[\s-]?name|alias|aka|a\.k\.a|stage name|street name|not everyone|not all|only|some people|a few|few people|rarely|secret|private)\b|h[őo]s|k[óo]dn[ée]v|[áa]ln[ée]v|nem mindenki|csak |n[ée]h[áa]nyan|titkos/iu;

/* name: the nickname itself; note: whatever was written next to it; plain: true when it is just a name (or a list of
   names) with nothing restricting its use, so it is the person's normal way to be addressed. */
export function nicknameInfo(raw) {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (!text) return { name: "", note: "", plain: true };
  const at = text.search(/\s*[(\[]|\s+[—–-]\s+|\s*[;:]\s|\s*,\s|\s+\/\s+/);
  const head = (at < 0 ? text : text.slice(0, at)).replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  const note = (at < 0 ? "" : text.slice(at)).replace(/^[\s(\[—–;:,\/-]+|[\s)\]]+$/g, "").trim();
  const words = head.split(/\s+/).filter(Boolean);
  if (!head || words.length > 3 || head.length > 40) return { name: "", note: text, plain: false };
  return { name: head, note, plain: !note || !RESTRICTING.test(note) };
}

/* The nickname to use as a default way of addressing someone: only when it is a plain one. */
export const plainNickname = (raw) => { const info = nicknameInfo(raw); return info.plain ? info.name : ""; };

const escapeRe = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* The glosses a model adds after a name or alias, which read like a dossier and never like speech. */
const GLOSSES = [
  /\s*[(\[]\s*(?:(?:her|his|their|the|a|an|my|your|our)\s+)?(?:(?:real|true|legal|full|hero|code|stage|street|pet|nick)[\s-]*)?(?:names?|nicknames?|alias(?:es)?|codenames?|handles?)\b[^)\]]*[)\]]/giu,
  /\s*[(\[]\s*(?:aka|a\.k\.a\.?|not everyone|not all|only (?:some|a few)|becen[ée]v|h[őo]s(?:n[ée]v)?|k[óo]dn[ée]v|[áa]ln[ée]v)\b[^)\]]*[)\]]/giu,
  /\s*[(\[]\s*(?:a\s+|az\s+)?(?:h[őo]s|k[óo]d|[áa]ln[ée]v|becen[ée]v|beceneve)\w*[^)\]]*[)\]]/giu,
];

/* people: [{ name, nick }]. Removes the bracketed glosses, and keeps ONE form where a name and its alias were stacked
   ("Tandy, Dagger", "Tandy (Dagger)", Tandy "Dagger" Bowen): the one written first. */
export function stripAliasGloss(value, people = []) {
  let text = String(value || "");
  if (!text) return text;
  for (const gloss of GLOSSES) text = text.replace(gloss, "");
  for (const person of people) {
    const alias = nicknameInfo(person && person.nick).name;
    const full = String((person && person.name) || "").replace(/\s+/g, " ").trim();
    const words = full.split(/\s+/).filter(Boolean);
    if (!alias || !words.length) continue;
    const first = words[0];
    if (first.toLowerCase() === alias.toLowerCase()) continue;
    const a = escapeRe(alias);
    for (const name of [...new Set([full, first])]) {
      const n = escapeRe(name);
      const end = "(?=\\s*(?:[,.!?…;:\"”’')\\]]|$))";
      text = text
        .replace(new RegExp(`(?<![\\p{L}\\p{N}])(${n})\\s*[(\\[]\\s*${a}\\s*[)\\]]`, "giu"), "$1")
        .replace(new RegExp(`(?<![\\p{L}\\p{N}])(${n})\\s*(?:,|/|—|–|-|aka|a\\.k\\.a\\.?)\\s*${a}(?![\\p{L}\\p{N}'’])${end}`, "giu"), "$1")
        .replace(new RegExp(`(?<![\\p{L}\\p{N}])(${a})\\s*(?:,|/|—|–|-|aka|a\\.k\\.a\\.?)\\s*${n}(?![\\p{L}\\p{N}'’])${end}`, "giu"), "$1")
        .replace(new RegExp(`(?<![\\p{L}\\p{N}])(${a})\\s*[(\\[]\\s*${n}\\s*[)\\]]`, "giu"), "$1");
    }
    if (words.length > 1) text = text.replace(new RegExp(`(?<![\\p{L}\\p{N}])(${escapeRe(first)})\\s+["“'‘]${a}["”'’]\\s+(${escapeRe(words.slice(1).join(" "))})(?![\\p{L}\\p{N}])`, "giu"), "$1 $2");
  }
  return text.replace(/[ \t]{2,}/g, " ").replace(/\s+([,.!?;:…])/g, "$1");
}
