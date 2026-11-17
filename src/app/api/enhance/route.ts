import { route, ok, body, HttpError } from "@/lib/http";
import { enhancePrompt } from "@/lib/enhance";
import { getDB } from "@/lib/store";
export const dynamic = "force-dynamic";
export const POST = route(async (req, _ctx, user) => {
  const { prompt = "", presetId } = await body<{ prompt?: string; presetId?: string }>(req);
  if (String(prompt).trim().length < 3) throw new HttpError(400, "Type a few words first, then enhance.");
  const s = getDB(user.uid).settings;
  return ok(await enhancePrompt(String(prompt), presetId, { model: s.promptModel, effort: s.effort }));
});
