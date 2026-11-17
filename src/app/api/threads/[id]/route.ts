import { route, ok, body, safeId } from "@/lib/http";
import { threadView, renameThread, deleteThread } from "@/lib/chat";
export const dynamic = "force-dynamic";

export const GET = route(async (_req, ctx, user) => {
  const { id } = await ctx.params;
  return ok(threadView(user.uid, safeId(id, "thr")));
});

export const PATCH = route(async (req, ctx, user) => {
  const { id } = await ctx.params;
  const { title = "" } = await body<{ title?: string }>(req);
  renameThread(user.uid, safeId(id, "thr"), String(title));
  return ok(threadView(user.uid, id));
});

export const DELETE = route(async (_req, ctx, user) => {
  const { id } = await ctx.params;
  deleteThread(user.uid, safeId(id, "thr"));
  return ok({ ok: true });
});
