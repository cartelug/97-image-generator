import { getDB } from "./store";
import type { Gen, Quality } from "./types";
import type { Calibration } from "./pricing";

export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
const cost = (g: Gen) => (g.demo ? 0 : g.costActual ?? g.costEstimate);

export function usageSummary(uid: string) {
  const db = getDB(uid);
  const mk = monthKey();
  const month = db.generations.filter((g) => g.status === "done" && g.createdAt.slice(0, 7) === mk && !g.demo);
  const spent = month.reduce((s, g) => s + cost(g), 0);
  const images = month.reduce((s, g) => s + g.images.length, 0);
  const verified = month.filter((g) => g.costActual != null).length;
  const byModel: Record<string, { usd: number; images: number }> = {};
  for (const g of month) {
    const m = (byModel[g.input.model] ||= { usd: 0, images: 0 });
    m.usd += cost(g);
    m.images += g.images.length;
  }
  const recent = db.generations
    .filter((g) => g.status === "done")
    .slice(-12)
    .reverse()
    .map((g) => ({ id: g.id, at: g.createdAt, model: g.input.model, quality: g.input.quality, images: g.images.length, usd: cost(g), actual: g.costActual != null, demo: !!g.demo, thumb: g.images[0]?.id }));

  // calibration: measured output tokens per megapixel per quality, from real (non-demo) generations
  const cal: Calibration = {};
  const buckets: Partial<Record<Quality, number[]>> = {};
  for (const g of db.generations) {
    if (g.status !== "done" || g.demo || !g.usage?.output || g.size === "auto") continue;
    const [w, h] = g.size.split("x").map(Number);
    if (!w || !h) continue;
    const per = g.usage.output / (((w * h) / 1e6) * g.images.length);
    (buckets[g.input.quality] ||= []).push(per);
  }
  for (const [q, arr] of Object.entries(buckets) as [Quality, number[]][]) {
    const last = arr.slice(-8);
    cal[q] = last.reduce((a, b) => a + b, 0) / last.length;
  }
  return { month: mk, spent, images, verified, unverified: month.length - verified, byModel, recent, calibration: cal, budget: db.settings.budget };
}
