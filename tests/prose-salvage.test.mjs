import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { salvageSingleFieldJson } from "../server/aiPolicy.js";

const body = (t) => ({ messages: [{ role: "user", content: t }] });

test("A one-line reply answered as prose is wrapped into the one-field JSON the prompt asked for", () => {
  assert.equal(
    salvageSingleFieldJson(body('Return ONLY JSON in this exact minimal form: {"reply":"your reply"}'), 'Language: en\n\n"Nice try, but you\'re not fooling anyone."'),
    JSON.stringify({ reply: "Nice try, but you're not fooling anyone.", language: "en" })
  );
  assert.equal(salvageSingleFieldJson(body('{"language":"en","comment":"..."}'), "Well, well. Tandy."), JSON.stringify({ comment: "Well, well. Tandy.", language: "en" }));
});

test("Multi-comment schemas, long or multi-paragraph prose and JSON answers are never wrapped", () => {
  assert.equal(salvageSingleFieldJson(body('{"comments":[{"id":"x","text":"..."}]}'), "Hello there"), "");
  assert.equal(salvageSingleFieldJson(body('{"reply":"x"}'), "first\n\nsecond paragraph"), "");
  assert.equal(salvageSingleFieldJson(body('{"reply":"x"}'), "x".repeat(800)), "");
  assert.equal(salvageSingleFieldJson(body('{"reply":"x"}'), '{"reply":"ok"}'), "");
});

test("Only comment requests use the salvage, before the no-JSON skip", () => {
  const proxy = fs.readFileSync(new URL("../server/proxy.js", import.meta.url), "utf8");
  assert.match(proxy, /player-post-comment\/\.test\(kindOfRequest\)\) \{\n\s+const salvaged = salvageSingleFieldJson\(task\.body, answered\);/);
});
