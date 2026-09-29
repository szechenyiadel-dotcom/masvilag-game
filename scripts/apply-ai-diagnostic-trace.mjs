import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = path.join(root, "server", "proxy.js");
const original = fs.readFileSync(serverPath, "utf8");
let next = original;

const marker = "MÁSVILÁG AI DIAGNOSTIC TRACE v1";

if (!next.includes(marker)) {
  const routeAnchor = `app.post(\n  [\n    "/ai/messages",`;
  if (!next.includes(routeAnchor)) {
    throw new Error("AI diagnostic trace aborted: message route anchor changed.");
  }

  const helpers = `/* ${marker} */\nconst AI_DIAG = {\n  minuteKey: \"\",\n  total: 0,\n  bySource: Object.create(null),\n};\n\nfunction aiDiagText(value) {\n  if (typeof value === \"string\") return value;\n  if (Array.isArray(value)) {\n    return value.map((item) => {\n      if (typeof item === \"string\") return item;\n      if (item && typeof item.text === \"string\") return item.text;\n      if (item && typeof item.content === \"string\") return item.content;\n      return \"\";\n    }).join(\"\\n\");\n  }\n  if (value && typeof value === \"object\") {\n    if (typeof value.text === \"string\") return value.text;\n    if (typeof value.content === \"string\") return value.content;\n  }\n  return \"\";\n}\n\nfunction aiDiagSystem(body = {}) {\n  return aiDiagText(body.system);\n}\n\nfunction aiDiagPrompt(body = {}) {\n  const messages = Array.isArray(body.messages) ? body.messages : [];\n  return messages.map((message) => aiDiagText(message && message.content)).filter(Boolean).join(\"\\n\");\n}\n\nfunction aiDiagSource(body = {}, system = \"\", prompt = \"\") {\n  const explicit = String(body.source || body.requestSource || body.request_source || \"\").trim();\n  if (explicit) return explicit.slice(0, 80);\n\n  const text = (String(system || \"\") + \"\\n\" + String(prompt || \"\")).toLowerCase();\n  if (text.includes(\"social-post meaning parser\") || text.includes(\"post meaning\") || text.includes(\"meaning analysis\")) return \"meaning-analysis\";\n  if (text.includes(\"recovery-queue\") || text.includes(\"auto-follow\") || text.includes(\"autofollow\")) return \"recovery-queue\";\n  if (text.includes(\"group chat\") || text.includes(\"groupchat\") || text.includes(\"csoportos chat\")) return \"group-chat\";\n  if (text.includes(\"roleplay\") || text.includes(\"scene\") || text.includes(\"jelenet\")) return \"scene\";\n  if (text.includes(\"direct message\") || text.includes(\"private message\") || /(^|[^a-z])dm([^a-z]|$)/.test(text)) return \"dm\";\n  if (text.includes(\"comment\") || text.includes(\"komment\") || text.includes(\"reply\") || text.includes(\"válaszkomment\")) return \"comments\";\n  if (text.includes(\"note\") || text.includes(\"jegyzet\")) return \"notes\";\n  if (text.includes(\"social post\") || text.includes(\"feed\") || text.includes(\"poszt\")) return \"feed-post\";\n  return \"autonomy-other\";\n}\n\nfunction flushAiDiagMinute(force = false) {\n  if (!AI_DIAG.total && !force) return;\n  console.info(\n    \"[ai-trace-minute]\",\n    AI_DIAG.minuteKey || new Date().toISOString().slice(0, 16),\n    \`total=\${AI_DIAG.total}\`,\n    \`sources=\${JSON.stringify(AI_DIAG.bySource)}\`\n  );\n  AI_DIAG.total = 0;\n  AI_DIAG.bySource = Object.create(null);\n}\n\nfunction recordAiDiagnostic(body = {}) {\n  const timestamp = new Date().toISOString();\n  const minuteKey = timestamp.slice(0, 16);\n  if (AI_DIAG.minuteKey && AI_DIAG.minuteKey !== minuteKey) flushAiDiagMinute();\n  AI_DIAG.minuteKey = minuteKey;\n\n  const system = aiDiagSystem(body);\n  const prompt = aiDiagPrompt(body);\n  const source = aiDiagSource(body, system, prompt);\n  AI_DIAG.total += 1;\n  AI_DIAG.bySource[source] = (AI_DIAG.bySource[source] || 0) + 1;\n\n  console.info(\n    \"[ai-trace]\",\n    timestamp,\n    \`source=\${source}\`,\n    \`systemChars=\${system.length}\`,\n    \`promptChars=\${prompt.length}\`,\n    \`totalChars=\${system.length + prompt.length}\`,\n    \`provider=\${String(body.provider || \"default\")}\`,\n    \`model=\${String(body.model || \"default\")}\`\n  );\n}\n\nsetInterval(() => flushAiDiagMinute(), 60 * 1000).unref?.();\n\n`;

  next = next.replace(routeAnchor, helpers + routeAnchor);

  const handlerAnchor = `  async (req, res) => {\n    const requestedProvider =`;
  if (!next.includes(handlerAnchor)) {
    throw new Error("AI diagnostic trace aborted: message handler anchor changed.");
  }
  next = next.replace(
    handlerAnchor,
    `  async (req, res) => {\n    recordAiDiagnostic(req.body || {});\n    const requestedProvider =`
  );
}

if (next !== original) {
  fs.writeFileSync(serverPath, next, "utf8");
  console.log("Applied temporary AI diagnostic trace.");
} else {
  console.log("AI diagnostic trace already applied.");
}
