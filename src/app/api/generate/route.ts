import { route, ok, body } from "@/lib/http";
import { createGeneration } from "@/lib/jobs";
import type { GenInput } from "@/lib/types";
export const dynamic = "force-dynamic";
export const POST = route(async (req, _ctx, user) => ok({ generation: createGeneration(user.uid, await body<Partial<GenInput>>(req)) }, 202));
