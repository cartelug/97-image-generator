import { route, ok, body, HttpError } from "@/lib/http";
import { getDB, newId, save } from "@/lib/store";
export const dynamic = "force-dynamic";
const COLORS = ["#ffc247", "#7dd3fc", "#f9a8d4", "#86efac", "#c4b5fd", "#fdba74", "#fca5a5"];
export const GET = route(async (_r, _c, user) => ok({ projects: getDB(user.uid).projects }));
export const POST = route(async (req, _c, user) => {
  const { name = "" } = await body<{ name?: string }>(req);
  const n = String(name).trim().slice(0, 60);
  if (!n) throw new HttpError(400, "Give the project a name.");
  const db = getDB(user.uid);
  const p = { id: newId("proj"), name: n, color: COLORS[db.projects.length % COLORS.length], createdAt: new Date().toISOString() };
  db.projects.push(p);
  save(user.uid);
  return ok({ project: p }, 201);
});
