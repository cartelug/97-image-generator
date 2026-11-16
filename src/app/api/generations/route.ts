import { route, ok } from "@/lib/http";
import { getDB } from "@/lib/store";
export const dynamic = "force-dynamic";
export const GET = route(async (req, _ctx, user) => {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || "").toLowerCase();
  const project = sp.get("project");
  const fav = sp.get("favorite") === "1";
  const limit = Math.min(500, Number(sp.get("limit")) || 200);
  let list = getDB(user.uid).generations.slice().reverse();
  if (project) list = list.filter((g) => g.input.projectId === project);
  if (fav) list = list.filter((g) => g.favorite);
  if (q) list = list.filter((g) => g.input.prompt.toLowerCase().includes(q));
  return ok({ generations: list.slice(0, limit), total: list.length });
});
