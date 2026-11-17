import sharp from "sharp";
import { getDB, newId, save, DEFAULT_PROJECT } from "./store";
import { HttpError, ID_RE } from "./http";
import { demoMode, maxBatch, MAX_REFS, rates } from "./config";
import { callSol } from "./responses";
import { OpenAIError } from "./openai";
import { startGeneration, cancelGeneration } from "./jobs";
import { locate } from "./files";
import { ASPECTS, sizeFor } from "./sizes";
import { estimateCost } from "./pricing";
import { usageSummary } from "./usage";
import { EFFORTS, MODELS, QUALITIES } from "./models";
import type { BatchItem, ChatOpts, Gen, Msg, Plan, Thread } from "./types";

// In-memory handles for work in flight (cancel buttons need them). A restart clears them; store.ts marks interrupted work as failed.
const g = globalThis as unknown as { __97turn?: Map<string, AbortController>; __97batch?: Map<string, { cancelled: boolean }> };
const turns = (g.__97turn ||= new Map());
const batches = (g.__97batch ||= new Map());

const CONCURRENCY = 3; // renders in flight at once inside one chat message
const ACTIVE = new Set(["thinking", "working"]);
const isActive = (t: Thread) => t.messages.some((m) => m.role === "assistant" && m.status && ACTIVE.has(m.status));

/* ───────────── options ───────────── */

export function cleanOpts(uid: string, raw: Partial<ChatOpts> = {}): ChatOpts {
  const db = getDB(uid);
  const s = db.settings;
  const n = Math.floor(Number(raw.count));
  return {
    model: MODELS.some((m) => m.id === raw.model) ? String(raw.model) : s.model,
    aspect: raw.aspect === "ai" || ASPECTS.some((a) => a.id === raw.aspect) ? String(raw.aspect) : "ai",
    tier: ["standard", "high", "ultra"].includes(String(raw.tier)) ? String(raw.tier) : s.tier,
    quality: QUALITIES.some((q) => q.id === raw.quality) ? (raw.quality as ChatOpts["quality"]) : s.quality,
    format: ["png", "jpeg", "webp"].includes(String(raw.format)) ? (raw.format as ChatOpts["format"]) : s.format,
    transparent: !!raw.transparent,
    count: raw.count === "auto" || raw.count == null || !Number.isFinite(n) ? "auto" : Math.min(maxBatch(), Math.max(1, n)),
    effort: EFFORTS.some((e) => e.id === raw.effort) ? (raw.effort as ChatOpts["effort"]) : s.effort,
    projectId: db.projects.some((p) => p.id === raw.projectId) ? raw.projectId : DEFAULT_PROJECT,
  };
}

/* ───────────── reading threads ───────────── */

export function listThreads(uid: string) {
  return getDB(uid)
    .threads.slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((t) => ({ id: t.id, title: t.title, createdAt: t.createdAt, updatedAt: t.updatedAt, messages: t.messages.length, active: isActive(t) }));
}

export function getThread(uid: string, id: string): Thread {
  const t = getDB(uid).threads.find((x) => x.id === id);
  if (!t) throw new HttpError(404, "That chat no longer exists.");
  return t;
}

/** The thread plus every generation its messages point at, so the client can draw images and progress. */
export function threadView(uid: string, id: string) {
  const db = getDB(uid);
  const thread = getThread(uid, id);
  const ids = new Set<string>();
  for (const m of thread.messages) for (const it of m.items || []) if (it.genId) ids.add(it.genId);
  const generations = db.generations.filter((x) => ids.has(x.id));
  return { thread, generations };
}

function imagesOf(uid: string, m: Msg): string[] {
  const db = getDB(uid);
  const out: string[] = [];
  for (const it of m.items || []) {
    const gen = it.genId ? db.generations.find((x) => x.id === it.genId) : undefined;
    if (gen?.status === "done") out.push(...gen.images.map((i) => i.id));
  }
  return out;
}

const titleOf = (t: string, hasImages: boolean) => {
  const s = t.replace(/\s+/g, " ").trim();
  if (!s) return hasImages ? "Image edit" : "New chat";
  return s.length > 48 ? s.slice(0, 47) + "…" : s;
};

/* ───────────── the conversation → what the model sees ───────────── */

async function dataUrl(uid: string, id: string): Promise<string | null> {
  const loc = locate(uid, id);
  if (!loc) return null;
  try {
    const buf = await sharp(loc.file).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function buildInput(uid: string, thread: Thread, upto: Msg) {
  const msgs = thread.messages.slice(0, thread.messages.indexOf(upto));
  // Show the model the pixels of the most recent images (what you just attached, what it just made); older ones stay as ids.
  const attach = new Set<string>();
  for (let i = msgs.length - 1; i >= 0 && attach.size < 10; i--) {
    const m = msgs[i];
    const ids = m.role === "user" ? m.refs || [] : imagesOf(uid, m);
    for (const id of ids.slice(0, m.role === "user" ? 8 : 4)) if (attach.size < 10) attach.add(id);
  }
  const input: any[] = [];
  for (const m of msgs) {
    if (m.role === "user") {
      const parts: any[] = [{ type: "input_text", text: m.text || "(image attached)" }];
      for (const id of m.refs || []) {
        parts.push({ type: "input_text", text: `[attached image id: ${id}]` });
        if (attach.has(id)) {
          const url = await dataUrl(uid, id);
          if (url) parts.push({ type: "input_image", image_url: url });
        }
      }
      input.push({ role: "user", content: parts });
    } else if (m.status === "done") {
      const ids = imagesOf(uid, m);
      let t = m.text || "";
      if (m.plan && ids.length) t += `\n[You generated ${ids.length} image(s): ${ids.map((id) => `[${id}]`).join(" ")} · aspect ${m.plan.aspect} · prompt used: ${m.plan.prompt.slice(0, 1500)}]`;
      input.push({ role: "assistant", content: [{ type: "output_text", text: t || "(no text)" }] });
      const seen = ids.filter((id) => attach.has(id));
      if (seen.length) {
        const parts: any[] = [{ type: "input_text", text: "(the images from your previous reply, so you can see them)" }];
        for (const id of seen) {
          const url = await dataUrl(uid, id);
          if (url) parts.push({ type: "input_text", text: `[image id: ${id}]` }, { type: "input_image", image_url: url });
        }
        if (parts.length > 1) input.push({ role: "user", content: parts });
      }
    }
  }
  return input;
}

const instructions = (o: ChatOpts, maxN: number) => `You are the creative director inside "97 Image Generator" by THE 97 World: a ChatGPT-style image studio. You talk with the user in a normal chat thread and make images by calling the generate_images tool.

HOW TO BEHAVE
- Chat naturally. Answer questions, brainstorm, critique and explain in short, friendly replies. Whenever the user wants images (new images, variations, edits, a series, "make it darker", "same but wider"), call generate_images in the same turn. Do not ask permission, and do not ask questions you can reasonably decide yourself. Ask ONE brief question only when the request is truly impossible to act on.
- Before the tool call write one short sentence (two at most) about what you're making. Do not paste the full prompt into chat unless asked.
- Use the whole conversation: "it", "that one", "the second", "make it bluer" refer to images already in the thread. Image ids appear in [brackets]. Pass the ids to edit, or to use as references, in use_reference_ids.

QUANTITY — THE USER DECIDES
- Read the number from the request exactly: "ten" = 10, "a dozen" = 12, "3 per style across 4 styles" = 12. No number means 1. The maximum per message is ${maxN}; if asked for more, make ${maxN} and say so in one line.${typeof o.count === "number" ? `\n- The user has fixed the count at ${o.count} in the settings. Use count = ${o.count}.` : ""}
- If the images should DIFFER (a series, different styles/colours/scenes/characters, "each with…", brainstorming options), fill prompts with one complete prompt per image (its length equals count). Otherwise leave prompts empty and the same prompt renders count times as variations.

PROMPT CRAFT — THIS IS WHAT MAKES IMAGES ACCURATE
- The image model sees ONLY the prompt and the reference images, never this chat. Every prompt must be complete and self-contained.
- Keep every explicit requirement. Put text that must appear in the image in "double quotes", spelled exactly as given, and say where it goes and how it looks.
- State how many of each subject, who is left/right/front/back, colours, materials, clothing, pose, expression, camera (lens, angle, distance), lighting, setting, mood and style/medium. Add concrete detail the user implied. Never invent brand names, logos, slogans or text they didn't give.
- Say what to include rather than what to avoid.
- Look closely at every attached image before writing. Describe faces, products, logos and layouts from what you actually see.
- To EDIT an existing image: pass its id in use_reference_ids, describe only the change, and set preserve = true so everything else stays identical. To use an image as a style or subject reference instead, set preserve = false and say how to use it.
- Reply in the user's language. Text inside images stays in the language they want.

SETTINGS IN FORCE
- Aspect ratio: ${o.aspect === "ai" ? "you choose the best fit for the content (square for logos/icons, 4:5 for social posts, 9:16 for stories, 16:9 for banners and cinematic, 2:3 for posters, 3:2 for photos)" : `${o.aspect} (the user picked it; do not change it)`}.
- Quality ${o.quality}, resolution ${o.tier}, ${o.format.toUpperCase()}${o.transparent ? ", transparent background" : ""}.`;

const tool = (maxN: number) => ({
  type: "function",
  name: "generate_images",
  description: "Create or edit images. Call it whenever the user wants images, variations, a series or an edit of an earlier image. Put the exact number the user asked for in count.",
  strict: false,
  parameters: {
    type: "object",
    properties: {
      count: { type: "integer", minimum: 1, maximum: maxN, description: `Total number of images, exactly as the user asked (default 1, max ${maxN}).` },
      prompt: { type: "string", description: "The complete, self-contained image prompt. Used for every image when prompts is omitted." },
      prompts: { type: "array", items: { type: "string" }, description: "Only when the images should differ: one complete prompt per image, length = count." },
      aspect: { type: "string", enum: ["1:1", "4:5", "9:16", "16:9", "3:2", "2:3"], description: "Best aspect ratio. Ignored when the user fixed one." },
      use_reference_ids: { type: "array", items: { type: "string" }, description: "Ids of images from the conversation to edit or use as references." },
      preserve: { type: "boolean", description: "True for edits: keep everything not mentioned exactly as in the reference." },
      transparent: { type: "boolean", description: "True only if the user wants a transparent background." },
    },
    required: ["prompt", "count"],
  },
});

/* ───────────── the assistant turn ───────────── */

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100 };
const NOUN = "(?:images?|pictures?|photos?|variations?|versions?|options?|designs?|logos?|posters?|concepts?|renders?|shots?|styles?|ideas?|mockups?|banners?|flyers?|portraits?|illustrations?|wallpapers?|avatars?|icons?|thumbnails?)";

/** Pull "make 12 logos" / "three variations" out of a request. Used by Demo mode and as a safety net. */
export function parseCount(text: string): number | null {
  const t = text.toLowerCase();
  let m = t.match(new RegExp(`\\b(\\d{1,3})\\s+(?:[a-z-]+\\s+){0,2}?${NOUN}\\b`));
  if (m) return +m[1];
  m = t.match(new RegExp(`\\b(${Object.keys(WORDS).join("|")})\\s+(?:[a-z-]+\\s+){0,2}?${NOUN}\\b`));
  if (m) return WORDS[m[1]];
  m = t.match(/\b(?:generate|make|create|give me|show me|produce|render|draw)\s+(\d{1,3})\b/);
  return m ? +m[1] : null;
}

function guessAspect(t: string) {
  const s = t.toLowerCase();
  if (/\b(wide|banner|cinematic|landscape|youtube|widescreen)\b/.test(s)) return "16:9";
  if (/\b(story|reel|tiktok|vertical|phone wallpaper)\b/.test(s)) return "9:16";
  if (/\b(poster|portrait|flyer)\b/.test(s)) return "2:3";
  return "1:1";
}

function resolvePlan(uid: string, args: Record<string, any>, user: Msg, o: ChatOpts): Plan {
  const maxN = maxBatch();
  const prompts = Array.isArray(args.prompts) ? args.prompts.map((p: unknown) => String(p).trim()).filter(Boolean) : [];
  let count = Math.floor(Number(args.count)) || (prompts.length > 1 ? prompts.length : 1);
  if (prompts.length > 1 && o.count === "auto" && !Number(args.count)) count = prompts.length;
  if (typeof o.count === "number") count = o.count;
  count = Math.min(maxN, Math.max(1, count));
  const prompt = String(args.prompt || "").trim() || prompts[0] || user.text.trim();
  if (!prompt) throw new HttpError(400, "Describe the image you want first.");
  const fromModel: string[] = Array.isArray(args.use_reference_ids) ? args.use_reference_ids.map(String).filter((id: string) => ID_RE.test(id) && locate(uid, id)) : [];
  const refs = Array.from(new Set([...fromModel, ...(user.refs || [])])).slice(0, MAX_REFS);
  return {
    count,
    prompt,
    prompts: prompts.length > 1 ? prompts : undefined,
    aspect: o.aspect !== "ai" ? o.aspect : ASPECTS.some((a) => a.id === args.aspect) ? String(args.aspect) : "1:1",
    preserve: !!args.preserve && refs.length > 0,
    refs,
    transparent: o.transparent || !!args.transparent,
  };
}

function buildItems(plan: Plan): BatchItem[] {
  if (plan.prompts) return Array.from({ length: plan.count }, (_, i) => ({ prompt: plan.prompts![i % plan.prompts!.length], n: 1, status: "pending" as const }));
  const items: BatchItem[] = [];
  for (let left = plan.count; left > 0; left -= 4) items.push({ prompt: plan.prompt, n: Math.min(4, left), status: "pending" });
  return items;
}

async function decide(uid: string, thread: Thread, msg: Msg, user: Msg, o: ChatOpts, signal: AbortSignal): Promise<{ text: string; plan?: Plan }> {
  if (demoMode()) {
    await new Promise<void>((res, rej) => {
      const t = setTimeout(res, 900);
      signal.addEventListener("abort", () => {
        clearTimeout(t);
        rej(new Error("aborted"));
      });
    });
    const asked = typeof o.count === "number" ? o.count : parseCount(user.text) ?? 1;
    const count = Math.min(maxBatch(), Math.max(1, asked));
    const plan = resolvePlan(uid, { count, prompt: user.text, aspect: guessAspect(user.text) }, user, o);
    return { text: count > 1 ? `Creating ${count} images for you…` : "Creating your image…", plan };
  }
  const r = await callSol({
    model: msg.model!,
    effort: msg.effort!,
    instructions: instructions(o, maxBatch()),
    input: await buildInput(uid, thread, msg),
    tools: [tool(maxBatch())],
    signal,
  });
  const call = r.calls.find((c) => c.name === "generate_images");
  if (!call) return { text: r.text || "I’m not sure what to make yet. Tell me a bit more about the image you want." };
  return { text: r.text, plan: resolvePlan(uid, call.args, user, o) };
}

async function runTurn(uid: string, tid: string, mid: string) {
  const db = getDB(uid);
  const thread = db.threads.find((t) => t.id === tid);
  const msg = thread?.messages.find((m) => m.id === mid);
  if (!thread || !msg) return;
  const user = [...thread.messages.slice(0, thread.messages.indexOf(msg))].reverse().find((m) => m.role === "user");
  if (!user) return;
  const o = user.opts || cleanOpts(uid);
  const ctl = new AbortController();
  turns.set(mid, ctl);
  const t0 = Date.now();
  const fail = (e: unknown) => {
    if (ctl.signal.aborted) {
      msg.status = "cancelled";
      msg.error = "Stopped.";
    } else {
      msg.status = "error";
      if (e instanceof OpenAIError) {
        msg.error = e.message;
        msg.errorDetail = e.detail;
      } else if (e instanceof HttpError) msg.error = e.message;
      else {
        console.error("[chat]", e);
        msg.error = "Something went wrong. Press Retry.";
        msg.errorDetail = String((e as Error)?.message || e);
      }
    }
  };
  try {
    const d = await decide(uid, thread, msg, user, o, AbortSignal.any([ctl.signal, AbortSignal.timeout(6 * 60_000)]));
    msg.text = d.text;
    msg.thinkingMs = Date.now() - t0;
    if (!d.plan) {
      msg.status = "done";
      return;
    }
    const plan = d.plan;
    // budget guard for the WHOLE batch, before a single image is rendered
    if (!demoMode()) {
      const b = db.settings.budget;
      const sz = sizeFor(plan.aspect, o.tier);
      const usage = usageSummary(uid);
      const per = estimateCost({ quality: o.quality, w: sz.w, h: sz.h, n: 1, refs: plan.refs.length, promptChars: plan.prompt.length, calibration: usage.calibration, rates: rates() }).usd;
      if (b.enforce && b.monthlyUsd > 0 && usage.spent + per * plan.count > b.monthlyUsd) {
        const left = Math.max(0, b.monthlyUsd - usage.spent);
        const can = Math.floor(left / Math.max(per, 0.0001));
        msg.plan = plan;
        msg.status = "error";
        msg.error = `${plan.count} image${plan.count === 1 ? "" : "s"} would cost about $${(per * plan.count).toFixed(2)}, which passes your $${b.monthlyUsd.toFixed(2)} monthly budget ($${left.toFixed(2)} left${can > 0 ? `, about ${can} image${can === 1 ? "" : "s"}` : ""}). Raise the limit in Account, lower the quality, or ask for fewer.`;
        return;
      }
    }
    msg.plan = plan;
    msg.items = buildItems(plan);
    msg.status = "working";
    save(uid);
    await runBatch(uid, thread, msg, plan, o);
  } catch (e) {
    fail(e);
  } finally {
    turns.delete(mid);
    msg.finishedAt = new Date().toISOString();
    thread.updatedAt = msg.finishedAt;
    save(uid);
  }
}

async function runBatch(uid: string, thread: Thread, msg: Msg, plan: Plan, o: ChatOpts) {
  const db = getDB(uid);
  const items = msg.items!;
  const ctl = { cancelled: false };
  batches.set(msg.id, ctl);
  const complexity = db.settings.complexity === "default" ? undefined : db.settings.complexity;
  let halt = "";
  let next = 0;
  const worker = async () => {
    while (!ctl.cancelled) {
      const i = next++;
      if (i >= items.length) return;
      const it = items[i];
      if (halt) {
        it.status = "error";
        it.error = halt;
        continue;
      }
      it.status = "running";
      save(uid);
      try {
        const { gen, done } = startGeneration(
          uid,
          { prompt: it.prompt, model: o.model, aspect: plan.aspect, tier: o.tier, quality: o.quality, complexity, n: it.n, format: o.format, transparent: plan.transparent, refs: plan.refs, preserve: plan.preserve, projectId: o.projectId },
          { skipCap: true, threadId: thread.id, msgId: msg.id },
        );
        it.genId = gen.id;
        save(uid);
        await done;
        const final = db.generations.find((x) => x.id === gen.id);
        it.status = final?.status === "done" ? "done" : final?.status === "cancelled" ? "cancelled" : "error";
        if (final?.status === "error") {
          it.error = final.error;
          // no point hammering the API once the key or credit is the problem
          if (/out of credit|rejected the API key|monthly budget/i.test(final.error || "")) halt = final.error!;
        }
      } catch (e) {
        it.status = "error";
        it.error = e instanceof HttpError ? e.message : "Could not start this image.";
        if (e instanceof HttpError && (e.status === 402 || e.status === 429)) halt = e.message;
      }
      save(uid);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  batches.delete(msg.id);
  for (const it of items) if (it.status === "pending") it.status = ctl.cancelled ? "cancelled" : "error";
  const ok = items.filter((x) => x.status === "done").length;
  const bad = items.filter((x) => x.status === "error");
  if (ctl.cancelled) {
    msg.status = "cancelled";
    msg.error = ok ? `Stopped after ${ok} of ${items.length}.` : "Stopped.";
  } else if (!ok) {
    msg.status = "error";
    msg.error = bad[0]?.error || "No image was created.";
  } else {
    msg.status = "done";
    if (bad.length) msg.error = `${bad.length} of ${items.length} couldn’t be created: ${bad[0].error || "unknown error"}`;
  }
}

/* ───────────── actions ───────────── */

export function sendMessage(uid: string, input: { threadId?: string; text?: string; refs?: string[]; opts?: Partial<ChatOpts> }) {
  const db = getDB(uid);
  const text = String(input.text || "").trim();
  const refs = Array.isArray(input.refs) ? Array.from(new Set(input.refs.map(String))).slice(0, MAX_REFS + 1) : [];
  if (!text && !refs.length) throw new HttpError(400, "Say what you’d like to make first.");
  if (refs.length > MAX_REFS) throw new HttpError(400, `You can attach up to ${MAX_REFS} images.`);
  for (const r of refs) if (!ID_RE.test(r) || !locate(uid, r)) throw new HttpError(400, "One of your attached images is no longer available. Remove it and add it again.");
  const opts = cleanOpts(uid, input.opts);
  let thread = input.threadId ? db.threads.find((t) => t.id === input.threadId) : undefined;
  if (input.threadId && !thread) throw new HttpError(404, "That chat no longer exists.");
  const now = new Date().toISOString();
  if (!thread) {
    thread = { id: newId("thr"), title: titleOf(text, refs.length > 0), createdAt: now, updatedAt: now, messages: [] };
    db.threads.push(thread);
  } else if (isActive(thread)) throw new HttpError(409, "Wait for the current reply to finish, or stop it first.");
  thread.messages.push({ id: newId("msg"), role: "user", text, refs, opts, createdAt: now });
  const a: Msg = { id: newId("msg"), role: "assistant", text: "", createdAt: now, status: "thinking", model: db.settings.promptModel, effort: opts.effort };
  thread.messages.push(a);
  thread.updatedAt = now;
  save(uid);
  void runTurn(uid, thread.id, a.id);
  return thread;
}

/** Re-run the last assistant reply (also what "Retry" does after an error). */
export function regenerate(uid: string, tid: string, mid: string, effort?: string) {
  const db = getDB(uid);
  const thread = getThread(uid, tid);
  if (isActive(thread)) throw new HttpError(409, "Wait for the current reply to finish, or stop it first.");
  const i = thread.messages.findIndex((m) => m.id === mid);
  if (i < 0 || i !== thread.messages.length - 1 || thread.messages[i].role !== "assistant") throw new HttpError(400, "Only the latest reply can be re-run.");
  const user = thread.messages[i - 1];
  if (!user || user.role !== "user") throw new HttpError(400, "Nothing to re-run.");
  if (effort && EFFORTS.some((e) => e.id === effort)) user.opts = { ...(user.opts || cleanOpts(uid)), effort: effort as ChatOpts["effort"] };
  thread.messages.pop();
  const now = new Date().toISOString();
  const a: Msg = { id: newId("msg"), role: "assistant", text: "", createdAt: now, status: "thinking", model: db.settings.promptModel, effort: user.opts?.effort || db.settings.effort };
  thread.messages.push(a);
  thread.updatedAt = now;
  save(uid);
  void runTurn(uid, thread.id, a.id);
  return thread;
}

export function cancelMessage(uid: string, tid: string, mid: string) {
  const thread = getThread(uid, tid);
  const m = thread.messages.find((x) => x.id === mid);
  if (!m) throw new HttpError(404, "Not found.");
  const b = batches.get(mid);
  if (b) b.cancelled = true;
  for (const it of m.items || []) if (it.genId && it.status === "running") cancelGeneration(it.genId);
  turns.get(mid)?.abort();
  return thread;
}

export function renameThread(uid: string, tid: string, title: string) {
  const t = getThread(uid, tid);
  t.title = String(title).replace(/\s+/g, " ").trim().slice(0, 80) || t.title;
  save(uid);
  return t;
}

/** Deleting a chat keeps its images in your Gallery. */
export function deleteThread(uid: string, tid: string) {
  const db = getDB(uid);
  const t = getThread(uid, tid);
  for (const m of t.messages) if (m.role === "assistant" && m.status && ACTIVE.has(m.status)) cancelMessage(uid, tid, m.id);
  db.threads = db.threads.filter((x) => x.id !== tid);
  save(uid);
}

export type { Gen };
