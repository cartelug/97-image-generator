import { route, ok, body, HttpError, safeId } from "@/lib/http";
import { getDB, save, DEFAULT_PROJECT } from "@/lib/store";
export const PATCH = route(async (req, ctx, user) => {
  const { id } = await ctx.params;
  const p = getDB(user.uid).projects.find((x) => x.id === safeId(id, "proj"));
  if (!p) throw new HttpError(404, "Not found.");
  const { name } = await body<{ name?: string }>(req);
  if (name && String(name).trim()) p.name = String(name).trim().slice(0, 60);
  save(user.uid);
  return ok({ project: p });
});
export const DELETE = route(async (_req, ctx, user) => {
  const { id } = await ctx.params;
  safeId(id, "proj");
  if (id === DEFAULT_PROJECT) throw new HttpError(400, "The Unsorted project can’t be deleted.");
  const db = getDB(user.uid);
  db.projects = db.projects.filter((p) => p.id !== id);
  for (const g of db.generations) if (g.input.projectId === id) g.input.projectId = DEFAULT_PROJECT;
  save(user.uid);
  return ok({ ok: true });
});
