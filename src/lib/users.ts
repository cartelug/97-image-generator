import crypto from "node:crypto";
import { isProd } from "./config";
import type { Me } from "./types";

type U = Me & { password: string };

export function listUsers(): U[] {
  const raw = process.env.APP_USERS || (isProd() ? "" : "demo@the97.world:97demo");
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf(":");
      const email = pair.slice(0, i).trim().toLowerCase();
      const password = pair.slice(i + 1);
      const uid = crypto.createHash("sha256").update(email).digest("hex").slice(0, 16);
      const name = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return { uid, email, name, password };
    })
    .filter((u) => u.email && u.password);
}

const h = (s: string) => crypto.createHash("sha256").update(s).digest();

export function checkLogin(email: string, password: string): Me | null {
  const e = email.trim().toLowerCase();
  let found: U | null = null;
  for (const u of listUsers()) if (u.email === e) found = u;
  // compare against a dummy when unknown so timing doesn't reveal valid emails
  const ok = crypto.timingSafeEqual(h(password), h(found ? found.password : "x".repeat(24) + Math.random()));
  if (!found || !ok) return null;
  return { uid: found.uid, email: found.email, name: found.name };
}

const attempts = new Map<string, { n: number; t: number }>();
export function rateLimited(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.t > 15 * 60_000) return false;
  return a.n >= 6;
}
export function noteFailure(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.t > 15 * 60_000) attempts.set(key, { n: 1, t: now });
  else a.n++;
}
export function clearFailures(key: string) {
  attempts.delete(key);
}
