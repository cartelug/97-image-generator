import { route, ok, body, HttpError } from "@/lib/http";
import { enhancePrompt } from "@/lib/enhance";
export const dynamic = "force-dynamic";
export const POST = route(async (req) => {
  const { prompt = "", presetId } = await body<{ prompt?: string; presetId?: string }>(req);
  if (String(prompt).trim().length < 3) throw new HttpError(400, "Type a few words first, then enhance.");
  return ok(await enhancePrompt(String(prompt), presetId));
});
