import { route, ok } from "@/lib/http";
import { getDB } from "@/lib/store";
import { usageSummary } from "@/lib/usage";
import { demoMode } from "@/lib/config";
import { MODELS } from "@/lib/models";
export const dynamic = "force-dynamic";

export const GET = route(async (_req, _ctx, user) => {
  const db = getDB(user.uid);
  return ok({
    user,
    demo: demoMode(),
    models: MODELS,
    settings: db.settings,
    projects: db.projects,
    prompts: db.prompts,
    assets: db.assets.slice(-60).reverse(),
    generations: db.generations.slice(-400).reverse(),
    usage: usageSummary(user.uid),
  });
});
