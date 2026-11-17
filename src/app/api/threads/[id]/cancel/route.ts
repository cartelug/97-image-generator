import { route, ok, body, safeId } from "@/lib/http";
import { cancelMessage, threadView } from "@/lib/chat";
export const dynamic = "force-dynamic";
export const POST = route(async (req, ctx, user) => {
  const { id } = await ctx.params;
  const { msgId = "" } = await body<{ msgId?: string }>(req);
  cancelMessage(user.uid, safeId(id, "thr"), safeId(String(msgId), "msg"));
  return ok(threadView(user.uid, id));
});
