import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { filesDir, getDB, newId, save } from "./store";
import { HttpError } from "./http";
import type { Asset, ImageRec } from "./types";

const p = (uid: string, name: string) => path.join(filesDir(uid), name);

export async function saveGenerated(uid: string, buf: Buffer, ext: string): Promise<ImageRec> {
  const id = newId("img");
  const img = sharp(buf);
  const meta = await img.metadata();
  await fs.promises.writeFile(p(uid, `${id}.${ext}`), buf);
  await sharp(buf).resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toFile(p(uid, `${id}.thumb.webp`));
  return { id, ext, width: meta.width || 0, height: meta.height || 0, bytes: buf.length };
}

export async function saveUpload(uid: string, buf: Buffer, name: string, brand = false): Promise<Asset> {
  let out: Buffer;
  let meta: { width?: number; height?: number };
  try {
    // normalise: honour EXIF rotation, strip metadata, cap at 2048px (cheaper + faster for the API), keep transparency as PNG
    const pipeline = sharp(buf, { failOn: "error" }).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true });
    out = await pipeline.png({ compressionLevel: 6 }).toBuffer();
    meta = await sharp(out).metadata();
  } catch {
    throw new HttpError(400, `“${name}” is not a readable image. Use PNG, JPEG or WebP.`);
  }
  const id = newId("ref");
  await fs.promises.writeFile(p(uid, `${id}.png`), out);
  await sharp(out).resize({ width: 360, height: 360, fit: "inside", withoutEnlargement: true }).webp({ quality: 74 }).toFile(p(uid, `${id}.thumb.webp`));
  const asset: Asset = { id, name: name.slice(0, 120), ext: "png", width: meta.width || 0, height: meta.height || 0, bytes: out.length, createdAt: new Date().toISOString(), brand };
  const db = getDB(uid);
  db.assets.push(asset);
  save(uid);
  return asset;
}

/** Resolve an id (img_… or ref_…) to its stored file info. */
export function locate(uid: string, id: string): { file: string; thumb: string; ext: string } | null {
  const db = getDB(uid);
  if (id.startsWith("ref_")) {
    const a = db.assets.find((x) => x.id === id);
    return a ? { file: p(uid, `${a.id}.${a.ext}`), thumb: p(uid, `${a.id}.thumb.webp`), ext: a.ext } : null;
  }
  for (const g of db.generations) {
    const i = g.images.find((x) => x.id === id);
    if (i) return { file: p(uid, `${i.id}.${i.ext}`), thumb: p(uid, `${i.id}.thumb.webp`), ext: i.ext };
  }
  return null;
}

export async function removeFiles(uid: string, ids: string[], exts: Record<string, string>) {
  for (const id of ids) {
    for (const f of [p(uid, `${id}.${exts[id] || "png"}`), p(uid, `${id}.thumb.webp`)]) await fs.promises.rm(f, { force: true });
  }
}
