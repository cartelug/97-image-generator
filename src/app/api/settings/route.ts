import { route, ok, body } from "@/lib/http";
import { getDB, save } from "@/lib/store";
import { MODELS, QUALITIES, PROMPT_MODELS, EFFORTS } from "@/lib/models";
import { promptModel } from "@/lib/config";
import { ASPECTS } from "@/lib/sizes";
import type { Settings } from "@/lib/types";
export const dynamic = "force-dynamic";

const num = (v: unknown, lo: number, hi: number, d: number) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);

export const PATCH = route(async (req, _c, user) => {
  const b = await body<Partial<Settings>>(req);
  const db = getDB(user.uid);
  const s = db.settings;
  if (b.model && MODELS.some((m) => m.id === b.model)) s.model = b.model;
  if (b.promptModel && (PROMPT_MODELS.some((m) => m.id === b.promptModel) || b.promptModel === promptModel())) s.promptModel = b.promptModel;
  if (b.effort && EFFORTS.some((e) => e.id === b.effort)) s.effort = b.effort;
  if (b.quality && QUALITIES.some((q) => q.id === b.quality)) s.quality = b.quality;
  if (b.complexity && ["default", "low", "medium", "high"].includes(b.complexity)) s.complexity = b.complexity;
  if (b.aspect && ASPECTS.some((a) => a.id === b.aspect)) s.aspect = b.aspect;
  if (b.tier && ["standard", "high", "ultra"].includes(b.tier)) s.tier = b.tier;
  if (b.format && ["png", "jpeg", "webp"].includes(b.format)) s.format = b.format;
  if (b.watermark) {
    const w = b.watermark;
    if (typeof w.enabled === "boolean") s.watermark.enabled = w.enabled;
    if (w.position && ["bottom-right", "bottom-left", "top-right", "top-left"].includes(w.position)) s.watermark.position = w.position;
    if (w.opacity != null) s.watermark.opacity = num(w.opacity, 0.1, 1, s.watermark.opacity);
    if (w.scale != null) s.watermark.scale = num(w.scale, 0.05, 0.4, s.watermark.scale);
  }
  if (b.budget) {
    if (b.budget.monthlyUsd != null) s.budget.monthlyUsd = num(b.budget.monthlyUsd, 0, 100000, s.budget.monthlyUsd);
    if (b.budget.warnPct != null) s.budget.warnPct = num(b.budget.warnPct, 10, 100, s.budget.warnPct);
    if (typeof b.budget.enforce === "boolean") s.budget.enforce = b.budget.enforce;
  }
  save(user.uid);
  return ok({ settings: s });
});
