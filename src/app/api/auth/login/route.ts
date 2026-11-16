import { route, ok, body, HttpError } from "@/lib/http";
import { checkLogin, clearFailures, listUsers, noteFailure, rateLimited } from "@/lib/users";
import { COOKIE, sessionConfigured, signSession } from "@/lib/session";
import { getDB } from "@/lib/store";
export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const { email = "", password = "" } = await body<{ email?: string; password?: string }>(req);
  if (!sessionConfigured() || listUsers().length === 0) throw new HttpError(500, "Sign-in isn’t configured on the server yet. Set APP_USERS and SESSION_SECRET.");
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  const key = `${ip}|${String(email).toLowerCase()}`;
  if (rateLimited(key)) throw new HttpError(429, "Too many attempts. Wait 15 minutes and try again.");
  const me = checkLogin(String(email), String(password));
  if (!me) {
    noteFailure(key);
    throw new HttpError(401, "Wrong email or password.");
  }
  clearFailures(key);
  getDB(me.uid);
  const token = await signSession(me);
  const res = ok({ user: me });
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 14 * 86400 });
  return res;
}, { public: true });
