import { route, ok } from "@/lib/http";
import { usageSummary } from "@/lib/usage";
export const dynamic = "force-dynamic";
export const GET = route(async (_r, _c, user) => ok({ usage: usageSummary(user.uid) }));
