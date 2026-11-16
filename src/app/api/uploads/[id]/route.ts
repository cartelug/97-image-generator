import { route, ok, HttpError, safeId } from "@/lib/http";
import { getDB, save } from "@/lib/store";
import { removeFiles } from "@/lib/files";
export const DELETE = route(async (_req, ctx, user) => {
  const { id } = await ctx.params;
  const db = getDB(user.uid);
  const i = db.assets.findIndex((a) => a.id === safeId(id, "ref"));
  if (i < 0) throw new HttpError(404, "Not found.");
  const [a] = db.assets.splice(i, 1);
  await removeFiles(user.uid, [a.id], { [a.id]: a.ext });
  save(user.uid);
  return ok({ ok: true });
});
