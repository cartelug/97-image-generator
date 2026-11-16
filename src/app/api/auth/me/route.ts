import { route, ok } from "@/lib/http";
export const dynamic = "force-dynamic";
export const GET = route(async (_req, _ctx, user) => ok({ user }));
