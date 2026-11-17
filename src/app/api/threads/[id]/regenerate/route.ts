import { route, ok, body, safeId } from "@/lib/http";
import { regenerate, threadView } from "@/lib/chat";
export const dynamic = "force-dynamic";
export const POST = route(async (req, ctx, user) => {
  const { id } = await ctx.params;
  const { msgId = "", effort } = await body<{ msgId?: string; effort?: string }>(req);
  regenerate(user.uid, safeId(id, "thr"), safeId(String(msgId), "msg"), effort);
  return ok(threadView(user.uid, id));
});
