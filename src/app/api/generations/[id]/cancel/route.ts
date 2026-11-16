import { route, ok, safeId } from "@/lib/http";
import { cancelGeneration } from "@/lib/jobs";
export const POST = route(async (_req, ctx) => {
  const { id } = await ctx.params;
  return ok({ cancelled: cancelGeneration(safeId(id, "gen")) });
});
