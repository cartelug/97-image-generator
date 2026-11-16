// Edge-safe (used by middleware): only depends on `jose`.
import { SignJWT, jwtVerify } from "jose";
import type { Me } from "./types";

export const COOKIE = "97ig_session";

function secretKey(): Uint8Array | null {
  const s = process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-only-secret-please-change-this-32chars");
  return s.length >= 16 ? new TextEncoder().encode(s) : null;
}

export function sessionConfigured() {
  return secretKey() !== null;
}

export async function signSession(me: Me, days = 14) {
  const k = secretKey();
  if (!k) throw new Error("SESSION_SECRET is not set");
  return new SignJWT({ email: me.email, name: me.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(me.uid)
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(k);
}

export async function verifySession(token: string | undefined): Promise<Me | null> {
  const k = secretKey();
  if (!k || !token) return null;
  try {
    const { payload } = await jwtVerify(token, k, { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { uid: String(payload.sub), email: String(payload.email || ""), name: String(payload.name || "") };
  } catch {
    return null;
  }
}
