// Dev tool: a tiny pretend OpenAI server so you can test the real code path WITHOUT spending credit.
// Run:  npm run fake-openai   then start the app with OPENAI_API_KEY=sk-test OPENAI_BASE_URL=http://localhost:4010
import http from "node:http";


import sharp from "sharp";
const log = [];
let flaky = 0;
const png = await sharp({ create: { width: 1024, height: 1280, channels: 3, background: "#335" } }).png().toBuffer();
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c); const buf = Buffer.concat(chunks);
  if (req.url === "/__log") { res.end(JSON.stringify(log)); return; }
  const auth = req.headers.authorization;
  let fields = {}, images = 0;
  if ((req.headers["content-type"] || "").startsWith("multipart")) {
    const fd = await new Response(buf, { headers: { "content-type": req.headers["content-type"] } }).formData();
    for (const [k, v] of fd.entries()) { if (typeof v === "string") fields[k] = v; else images++; }
  } else if (buf.length) fields = JSON.parse(buf.toString());
  if (String(req.url).endsWith("/responses")) {
    // Pretend GPT-6.1 Sol: reads the last user message, decides a count, and calls generate_images.
    const last = [...(fields.input || [])].reverse().find((m) => m.role === "user");
    const parts = last?.content || [];
    const text = parts.filter((c) => c.type === "input_text").map((c) => c.text).join(" ");
    const sent = (fields.input || []).flatMap((m) => m.content || []).filter((c) => c.type === "input_image").length;
    const m = text.match(/(\d{1,3})/);
    const count = m ? Number(m[1]) : 1;
    log.push({ url: req.url, model: fields.model, effort: fields.reasoning?.effort, tools: (fields.tools || []).length, maxOut: fields.max_output_tokens, store: fields.store, inputImages: sent, turns: (fields.input || []).length, count });
    const out = (o) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    const usage = { input_tokens: 400, output_tokens: 900, output_tokens_details: { reasoning_tokens: 700 } };
    if (/QUOTA/.test(text)) { res.writeHead(429, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: { message: "You exceeded your current quota", code: "insufficient_quota" } })); }
    if (/(hello|hi there|thanks|thank you)/i.test(text) && !/image|make|create|generate/i.test(text)) return out({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "Hi! What would you like to create today?" }] }], usage });
    const distinct = /different|each|series|styles/i.test(text);
    const args = { count, prompt: "FAKE PROMPT: " + text.slice(0, 160), aspect: "16:9", use_reference_ids: [], ...(distinct ? { prompts: Array.from({ length: count }, (_, i) => `FAKE #${i + 1}: ` + text.slice(0, 80)) } : {}) };
    await new Promise((r) => setTimeout(r, 300));
    return out({ status: "completed", output: [{ type: "reasoning", summary: [] }, { type: "message", content: [{ type: "output_text", text: `Making ${count} image${count === 1 ? "" : "s"}.` }] }, { type: "function_call", name: "generate_images", call_id: "call_1", arguments: JSON.stringify(args) }], usage });
  }
  log.push({ url: req.url, auth: auth?.slice(0, 10), ct: (req.headers["content-type"] || "").split(";")[0], fields: { ...fields, prompt: String(fields.prompt).slice(0, 60) }, images });
  const prompt = String(fields.prompt || "");
  const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (prompt.includes("QUOTA")) return send(429, { error: { message: "You exceeded your current quota", code: "insufficient_quota" } });
  if (prompt.includes("MOD")) return send(400, { error: { message: "Your request was rejected by the safety system.", code: "moderation_blocked" } });
  if (prompt.includes("FLAKY") && flaky++ < 1) return send(500, { error: { message: "server error" } });
  const n = Number(fields.n || 1);
  await new Promise((r) => setTimeout(r, 400));
  send(200, { data: Array.from({ length: n }, () => ({ b64_json: png.toString("base64") })), usage: { input_tokens: 60 + images * 1100, input_tokens_details: { text_tokens: 60, image_tokens: images * 1100 }, output_tokens: 4160 * n } });
}).listen(4010, () => console.log("fake openai on 4010"));
