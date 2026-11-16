import { route, ok, body, HttpError, safeId } from "@/lib/http";
import { getDB, save, flush } from "@/lib/store";
import { cancelGeneration } from "@/lib/jobs";
import { removeFiles } from "@/lib/files";
export const dynamic = "force-dynamic";

export const GET = route(async (_req, ctx, user) => {
  const { id } = await ctx.params;
  const g = getDB(user.uid).generations.find((x) => x.id === safeId(id, "gen"));
  if (!g) throw new HttpError(404, "Not found.");
  return ok({ generation: g });
});

export const PATCH = route(async (req, ctx, user) => {
  const { id } = await ctx.params;
  const db = getDB(user.uid);
  const g = db.generations.find((x) => x.id === safeId(id, "gen"));
  if (!g) throw new HttpError(404, "Not found.");
  const b = await body<{ favorite?: boolean; projectId?: string }>(req);
  if (typeof b.favorite === "boolean") g.favorite = b.favorite;
  if (b.projectId && db.projects.some((p) => p.id === b.projectId)) g.input.projectId = b.projectId;
  save(user.uid);
  return ok({ generation: g });
});

export const DELETE = route(async (_req, ctx, user) => {
  const { id } = await ctx.params;
  const db = getDB(user.uid);
  const i = db.generations.findIndex((x) => x.id === safeId(id, "gen"));
  if (i < 0) throw new HttpError(404, "Not found.");
  const g = db.generations[i];
  cancelGeneration(g.id);
  db.generations.splice(i, 1);
  await removeFiles(user.uid, g.images.map((x) => x.id), Object.fromEntries(g.images.map((x) => [x.id, x.ext])));
  await flush(user.uid);
  return ok({ ok: true });
});
