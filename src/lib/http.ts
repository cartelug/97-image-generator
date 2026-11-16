import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, verifySession } from "./session";
import type { Me } from "./types";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function currentUser(): Promise<Me | null> {
  const c = await cookies();
  return verifySession(c.get(COOKIE)?.value);
}

function checkOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const hosts = [req.headers.get("x-forwarded-host"), req.headers.get("host")].filter(Boolean);
  let oh = "";
  try {
    oh = new URL(origin).host;
  } catch {}
  if (!hosts.includes(oh)) throw new HttpError(403, "Blocked: cross-site request.");
}

type Ctx = { params: Promise<Record<string, string>> };
export function route(fn: (req: NextRequest, ctx: Ctx, user: Me) => Promise<Response>, opts: { public?: boolean } = {}) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") checkOrigin(req);
      const user = await currentUser();
      if (!user && !opts.public) throw new HttpError(401, "Please sign in.");
      return await fn(req, ctx, user as Me);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error("[api]", e);
      return NextResponse.json({ error: "Something went wrong on the server. Please try again." }, { status: 500 });
    }
  };
}

export async function body<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid request body.");
  }
}

export const ID_RE = /^(gen|img|ref|proj|prm)_[a-f0-9]{16}$/;
export function safeId(id: string, prefix?: string) {
  if (!ID_RE.test(id) || (prefix && !id.startsWith(prefix + "_"))) throw new HttpError(400, "Invalid id.");
  return id;
}
