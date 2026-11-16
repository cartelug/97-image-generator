import sharp from "sharp";
import path from "node:path";
import crypto from "node:crypto";
import type { Format, Quality, Usage } from "./types";
import { BASE_TOKENS_PER_MP } from "./pricing";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function wrap(s: string, n: number, max: number) {
  const words = s.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > n) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
    if (lines.length >= max) break;
  }
  if (cur && lines.length < max) lines.push(cur);
  return lines;
}

/** Demo mode: renders a branded placeholder so the whole app can be tested without spending credit. */
export async function mockImages(o: { prompt: string; w: number; h: number; n: number; format: Format; quality: Quality; signal: AbortSignal }) {
  const { w, h } = o;
  await new Promise<void>((res, rej) => {
    const t = setTimeout(res, 2600);
    o.signal.addEventListener("abort", () => {
      clearTimeout(t);
      rej(new Error("aborted"));
    });
  });
  const out: Buffer[] = [];
  for (let i = 0; i < o.n; i++) {
    const hash = crypto.createHash("md5").update(o.prompt + i).digest();
    const hue = (hash[0] / 255) * 360;
    const hue2 = (hue + 40 + hash[1] / 6) % 360;
    const fs = Math.round(Math.min(w, h) * 0.034);
    const lines = wrap(o.prompt, Math.max(18, Math.floor((w * 0.8) / (fs * 0.55))), 6);
    const text = lines.map((l, k) => `<text x="${w * 0.08}" y="${h * 0.76 + k * fs * 1.35}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${fs}" fill="#fff" fill-opacity=".86">${esc(l)}</text>`).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},55%,16%)"/><stop offset="1" stop-color="hsl(${hue2},60%,7%)"/></linearGradient>
      <radialGradient id="r" cx=".72" cy=".25" r=".7"><stop offset="0" stop-color="hsl(${hue2},90%,60%)" stop-opacity=".55"/><stop offset="1" stop-color="hsl(${hue2},90%,50%)" stop-opacity="0"/></radialGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#r)"/>
      <text x="${w * 0.08}" y="${h * 0.1}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${fs * 0.8}" letter-spacing="${fs * 0.25}" fill="#fff" fill-opacity=".6">DEMO MODE · NO API KEY · NOT CHARGED</text>${text}</svg>`;
    let img = sharp(Buffer.from(svg));
    const logo = await sharp(path.join(process.cwd(), "public/brand/97-mark-white.png")).resize({ width: Math.round(w * 0.3) }).toBuffer();
    const lm = await sharp(logo).metadata();
    img = img.composite([{ input: logo, left: Math.round(w * 0.08), top: Math.round(h * 0.2 - (lm.height || 0) * 0.0) }]);
    out.push(await (o.format === "jpeg" ? img.jpeg({ quality: 92 }) : o.format === "webp" ? img.webp({ quality: 92 }) : img.png()).toBuffer());
  }
  const mp = (w * h) / 1e6;
  const usage: Usage = { inputText: Math.ceil(o.prompt.length / 4), inputImage: 0, output: Math.round(BASE_TOKENS_PER_MP[o.quality] * mp * o.n) };
  return { images: out, usage };
}
