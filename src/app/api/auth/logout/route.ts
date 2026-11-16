import { route, ok } from "@/lib/http";
import { COOKIE } from "@/lib/session";
export const POST = route(async () => {
  const res = ok({ ok: true });
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}, { public: true });
