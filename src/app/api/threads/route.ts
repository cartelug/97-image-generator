import { route, ok } from "@/lib/http";
import { listThreads } from "@/lib/chat";
export const dynamic = "force-dynamic";
export const GET = route(async (_req, _ctx, user) => ok({ threads: listThreads(user.uid) }));
