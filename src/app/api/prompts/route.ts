import { route, ok, body, HttpError } from "@/lib/http";
import { getDB, newId, save } from "@/lib/store";
export const POST = route(async (req, _c, user) => {
  const { title = "", text = "" } = await body<{ title?: string; text?: string }>(req);
  const t = String(text).trim();
  if (!t) throw new HttpError(400, "Write a prompt first.");
  const p = { id: newId("prm"), title: String(title).trim().slice(0, 60) || t.slice(0, 40), text: t.slice(0, 8000), createdAt: new Date().toISOString() };
  getDB(user.uid).prompts.unshift(p);
  save(user.uid);
  return ok({ prompt: p }, 201);
});
