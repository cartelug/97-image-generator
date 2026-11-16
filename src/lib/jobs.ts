import fs from "node:fs";
import { demoMode, MAX_CONCURRENT, MAX_REFS, rates } from "./config";
import { getDB, newId, save, DEFAULT_PROJECT } from "./store";
import { HttpError } from "./http";
import { MODELS, QUALITIES } from "./models";
import { sizeFor, ASPECTS } from "./sizes";
import { actualCost, estimateCost } from "./pricing";
import { usageSummary } from "./usage";
import { locate, saveGenerated } from "./files";
import { callOpenAI, OpenAIError } from "./openai";
import { mockImages } from "./mock";
import { PRESERVE_TEXT } from "./presets";
import type { Complexity, Format, Gen, GenInput, Quality } from "./types";

const g = globalThis as unknown as { __97ctl?: Map<string, AbortController> };
const controllers = (g.__97ctl ||= new Map());

function clean(uid: string, raw: Partial<GenInput>): GenInput {
  const db = getDB(uid);
  const prompt = String(raw.prompt || "").trim();
  if (!prompt) throw new HttpError(400, "Describe the image you want first.");
  if (prompt.length > 8000) throw new HttpError(400, "That prompt is too long (8,000 characters max).");
  const model = MODELS.some((m) => m.id === raw.model) ? String(raw.model) : MODELS[0].id;
  const aspect = ASPECTS.some((a) => a.id === raw.aspect) ? String(raw.aspect) : "1:1";
  const tier = ["standard", "high", "ultra"].includes(String(raw.tier)) ? String(raw.tier) : "standard";
  const quality = (QUALITIES.some((q) => q.id === raw.quality) ? raw.quality : "high") as Quality;
  const complexity = (["low", "medium", "high"].includes(String(raw.complexity)) ? raw.complexity : undefined) as Complexity | undefined;
  const n = Math.min(4, Math.max(1, Math.floor(Number(raw.n) || 1)));
  const transparent = !!raw.transparent;
  let format = (["png", "jpeg", "webp"].includes(String(raw.format)) ? raw.format : "png") as Format;
  if (transparent && format === "jpeg") format = "png";
  const refs = Array.isArray(raw.refs) ? raw.refs.map(String).slice(0, MAX_REFS + 1) : [];
  if (refs.length > MAX_REFS) throw new HttpError(400, `You can use up to ${MAX_REFS} reference images.`);
  for (const r of refs) if (!locate(uid, r)) throw new HttpError(400, "One of your reference images is no longer available. Remove it and add it again.");
  const projectId = db.projects.some((p) => p.id === raw.projectId) ? String(raw.projectId) : DEFAULT_PROJECT;
  return { prompt, model, aspect, tier, quality, complexity, n, format, transparent, refs, preserve: !!raw.preserve, projectId, parentId: raw.parentId ? String(raw.parentId) : undefined, presetId: raw.presetId ? String(raw.presetId) : undefined };
}

export function createGeneration(uid: string, raw: Partial<GenInput>): Gen {
  const db = getDB(uid);
  const input = clean(uid, raw);
  if (db.generations.filter((x) => x.status === "running").length >= MAX_CONCURRENT)
    throw new HttpError(429, `You already have ${MAX_CONCURRENT} images rendering. Wait for one to finish or cancel it.`);
  const s = sizeFor(input.aspect, input.tier);
  const usage = usageSummary(uid);
  const est = estimateCost({ quality: input.quality, w: s.w, h: s.h, n: input.n, refs: input.refs.length, promptChars: input.prompt.length, calibration: usage.calibration, rates: rates() });
  const b = db.settings.budget;
  if (!demoMode() && b.enforce && b.monthlyUsd > 0 && usage.spent + est.usd > b.monthlyUsd)
    throw new HttpError(402, `This would pass your $${b.monthlyUsd.toFixed(2)} monthly budget (about $${usage.spent.toFixed(2)} used, this image ≈ $${est.usd.toFixed(2)}). Raise the limit in Account, or lower quality/size.`);
  const gen: Gen = { id: newId("gen"), input, size: s.param, status: "running", phase: "queued", images: [], costEstimate: est.usd, demo: demoMode(), favorite: false, createdAt: new Date().toISOString() };
  db.generations.push(gen);
  save(uid);
  void run(uid, gen.id);
  return gen;
}

async function run(uid: string, id: string) {
  const db = getDB(uid);
  const gen = db.generations.find((x) => x.id === id);
  if (!gen) return;
  const ctrl = new AbortController();
  controllers.set(id, ctrl);
  const t0 = Date.now();
  const timeout = setTimeout(() => ctrl.abort(new Error("timeout")), 12 * 60_000);
  const phase = (p: string) => {
    gen.phase = p;
    save(uid);
  };
  try {
    phase("preparing");
    const refs = await Promise.all(gen.input.refs.map(async (r, i) => ({ buf: await fs.promises.readFile(locate(uid, r)!.file), name: `reference-${i + 1}.png` })));
    const s = sizeFor(gen.input.aspect, gen.input.tier);
    const prompt = gen.input.preserve && refs.length ? `${gen.input.prompt}\n\n${PRESERVE_TEXT}` : gen.input.prompt;
    phase("rendering");
    const out = gen.demo
      ? await mockImages({ prompt: gen.input.prompt, w: s.w, h: s.h, n: gen.input.n, format: gen.input.format, quality: gen.input.quality, signal: ctrl.signal })
      : await callOpenAI({ model: gen.input.model, prompt, size: gen.size, quality: gen.input.quality, complexity: gen.input.complexity, n: gen.input.n, format: gen.input.format, transparent: gen.input.transparent, refs, signal: ctrl.signal });
    phase("saving");
    const ext = gen.input.format === "jpeg" ? "jpg" : gen.input.format;
    for (const buf of out.images) gen.images.push(await saveGenerated(uid, buf, ext));
    if (out.usage) {
      gen.usage = out.usage;
      if (!gen.demo) gen.costActual = actualCost(out.usage, rates());
    }
    gen.status = "done";
    gen.phase = undefined;
  } catch (e) {
    if (ctrl.signal.aborted && (ctrl.signal.reason as Error | undefined)?.message !== "timeout") {
      gen.status = "cancelled";
      gen.error = "Cancelled.";
    } else {
      gen.status = "error";
      if ((ctrl.signal.reason as Error | undefined)?.message === "timeout") gen.error = "This took longer than 12 minutes and was stopped. Try a lower quality or size, then Retry.";
      else if (e instanceof OpenAIError) {
        gen.error = e.message;
        gen.errorDetail = e.detail;
      } else {
        console.error("[job]", e);
        gen.error = "Something went wrong while saving the image. Press Retry.";
        gen.errorDetail = String((e as Error)?.message || e);
      }
    }
    gen.phase = undefined;
  } finally {
    clearTimeout(timeout);
    controllers.delete(id);
    gen.finishedAt = new Date().toISOString();
    gen.durationMs = Date.now() - t0;
    save(uid);
  }
}

export function cancelGeneration(id: string) {
  const c = controllers.get(id);
  if (c) c.abort();
  return !!c;
}
