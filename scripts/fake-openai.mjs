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
