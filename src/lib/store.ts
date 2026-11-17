import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir, defaultBudget, promptModel } from "./config";
import { DEFAULT_MODEL, DEFAULT_EFFORT } from "./models";
import type { DB, Settings } from "./types";

type Entry = { db: DB; chain: Promise<void>; timer?: NodeJS.Timeout };
const g = globalThis as unknown as { __97db?: Map<string, Entry> };
const cache: Map<string, Entry> = (g.__97db ||= new Map());

export const newId = (prefix: string) => `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
export const userDir = (uid: string) => path.join(dataDir(), "users", uid);
export const filesDir = (uid: string) => path.join(userDir(uid), "files");
const dbFile = (uid: string) => path.join(userDir(uid), "db.json");

export const DEFAULT_PROJECT = "proj_0000000000000000";

export function defaultSettings(): Settings {
  return {
    promptModel: promptModel(),
    effort: DEFAULT_EFFORT,
    model: DEFAULT_MODEL,
    quality: "high",
    complexity: "default",
    aspect: "4:5",
    tier: "standard",
    format: "png",
    watermark: { enabled: false, position: "bottom-right", opacity: 0.85, scale: 0.12 },
    budget: { monthlyUsd: defaultBudget(), warnPct: 80, enforce: true },
  };
}

function fresh(): DB {
  return {
    version: 1,
    projects: [{ id: DEFAULT_PROJECT, name: "Unsorted", color: "#8b8b95", createdAt: new Date().toISOString() }],
    threads: [],
    generations: [],
    assets: [],
    prompts: [],
    settings: defaultSettings(),
  };
}

export function getDB(uid: string): DB {
  let e = cache.get(uid);
  if (e) return e.db;
  fs.mkdirSync(filesDir(uid), { recursive: true });
  let db = fresh();
  try {
    const raw = JSON.parse(fs.readFileSync(dbFile(uid), "utf8")) as DB;
    const d = defaultSettings();
    db = { ...db, ...raw, settings: { ...d, ...raw.settings, watermark: { ...d.watermark, ...raw.settings?.watermark }, budget: { ...d.budget, ...raw.settings?.budget } } };
    if (!db.projects.some((p) => p.id === DEFAULT_PROJECT)) db.projects.unshift(fresh().projects[0]);
  } catch {
    /* first run */
  }
  // anything still "running" from a previous process was interrupted
  for (const gen of db.generations) {
    if (gen.status === "running") {
      gen.status = "error";
      gen.error = "The server restarted while this image was rendering. Press Retry.";
    }
  }
  db.threads ||= [];
  for (const t of db.threads) {
    for (const m of t.messages) {
      if (m.role === "assistant" && (m.status === "thinking" || m.status === "working")) {
        m.status = "error";
        m.error = "The server restarted while this was in progress. Press Retry.";
        for (const it of m.items || []) if (it.status === "pending" || it.status === "running") it.status = "error";
      }
    }
  }
  e = { db, chain: Promise.resolve() };
  cache.set(uid, e);
  return db;
}

export function save(uid: string) {
  const e = cache.get(uid);
  if (!e) return;
  if (e.timer) clearTimeout(e.timer);
  e.timer = setTimeout(() => {
    e.chain = e.chain.then(async () => {
      const tmp = dbFile(uid) + ".tmp";
      await fs.promises.writeFile(tmp, JSON.stringify(e.db));
      await fs.promises.rename(tmp, dbFile(uid));
    }).catch((err) => console.error("[store] save failed", err));
  }, 80);
}

export async function flush(uid: string) {
  const e = cache.get(uid);
  if (!e) return;
  if (e.timer) clearTimeout(e.timer);
  e.chain = e.chain.then(async () => {
    const tmp = dbFile(uid) + ".tmp";
    await fs.promises.writeFile(tmp, JSON.stringify(e.db));
    await fs.promises.rename(tmp, dbFile(uid));
  });
  await e.chain;
}
