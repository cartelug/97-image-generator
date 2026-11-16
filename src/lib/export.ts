import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { Watermark } from "./types";

export type OutFormat = "png" | "jpeg" | "webp";
export const MIME: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", jpg: "image/jpeg", webp: "image/webp" };

/** Re-encode (and optionally brand) an image for download. Original files are never modified. */
export async function renderExport(file: string, format: OutFormat, wm?: Watermark) {
  const src = await fs.promises.readFile(file);
  let img = sharp(src);
  if (wm?.enabled) {
    const meta = await sharp(src).metadata();
    const W = meta.width || 1024;
    const H = meta.height || 1024;
    const lw = Math.max(48, Math.round(W * wm.scale));
    const margin = Math.round(W * 0.035);
    // pick the logo tone that reads best on the corner it will sit in
    const approxH = Math.round(lw * 0.876);
    const left = wm.position.endsWith("right") ? W - lw - margin : margin;
    const top = wm.position.startsWith("bottom") ? H - approxH - margin : margin;
    let tone: "white" | "black" = "white";
    try {
      const st = await sharp(src).extract({ left: Math.max(0, left), top: Math.max(0, top), width: Math.min(lw, W - left), height: Math.min(approxH, H - top) }).stats();
      const lum = 0.2126 * st.channels[0].mean + 0.7152 * st.channels[1].mean + 0.0722 * st.channels[2].mean;
      tone = lum > 150 ? "black" : "white";
    } catch {}
    const logoFile = path.join(process.cwd(), "public/brand", tone === "white" ? "97-mark-white.png" : "97-mark-black.png");
    const logo = await sharp(logoFile).resize({ width: lw }).ensureAlpha().linear([1, 1, 1, wm.opacity], [0, 0, 0, 0]).png().toBuffer();
    const lm = await sharp(logo).metadata();
    const t = wm.position.startsWith("bottom") ? H - (lm.height || approxH) - margin : margin;
    img = img.composite([{ input: logo, left: Math.max(0, left), top: Math.max(0, t) }]);
  }
  const out = format === "jpeg" ? img.flatten({ background: "#ffffff" }).jpeg({ quality: 95, mozjpeg: true }) : format === "webp" ? img.webp({ quality: 95 }) : img.png();
  return out.toBuffer();
}
