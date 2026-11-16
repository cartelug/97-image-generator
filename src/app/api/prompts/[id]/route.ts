import { route, ok, safeId } from "@/lib/http";
import { getDB, save } from "@/lib/store";
export const DELETE = route(async (_req, ctx, user) => {
  const { id } = await ctx.params;
  const db = getDB(user.uid);
  db.prompts = db.prompts.filter((p) => p.id !== safeId(id, "prm"));
  save(user.uid);
  return ok({ ok: true });
});
