import { route, ok, body } from "@/lib/http";
import { sendMessage, threadView } from "@/lib/chat";
import type { ChatOpts } from "@/lib/types";
export const dynamic = "force-dynamic";
export const POST = route(async (req, _ctx, user) => {
  const b = await body<{ threadId?: string; text?: string; refs?: string[]; opts?: Partial<ChatOpts> }>(req);
  const t = sendMessage(user.uid, b);
  return ok(threadView(user.uid, t.id), 202);
});
