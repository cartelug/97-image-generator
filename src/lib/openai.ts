import { apiKey, openaiBase } from "./config";
import type { Complexity, Format, Quality, Usage } from "./types";

export class OpenAIError extends Error {
  constructor(public status: number, message: string, public detail = "") {
    super(message);
  }
}

export type ImageCall = {
  model: string;
  prompt: string;
  size: string;
  quality: Quality;
  complexity?: Complexity;
  n: number;
  format: Format;
  transparent: boolean;
  refs: { buf: Buffer; name: string }[];
  signal: AbortSignal;
};

function friendly(status: number, body: { error?: { message?: string; code?: string } } | null): string {
  const msg = body?.error?.message || "";
  const code = body?.error?.code || "";
  if (status === 401) return "OpenAI rejected the API key. Check OPENAI_API_KEY on the server.";
  if (code === "insufficient_quota" || code === "billing_hard_limit_reached" || (status === 429 && /quota|credit|billing/i.test(msg)))
    return "Your OpenAI account is out of credit. Add funds at platform.openai.com → Billing, then press Retry.";
  if (status === 429) return "OpenAI is rate-limiting requests. Wait a few seconds and press Retry.";
  if (code === "moderation_blocked" || /safety system|moderation/i.test(msg))
    return "OpenAI’s safety system blocked this request. Rephrase the prompt or change the reference image, then retry.";
  if (status === 403 && /verif/i.test(msg))
    return "OpenAI requires organization verification for this model. Verify at platform.openai.com → Settings → Organization → General, then retry.";
  if (status === 404) return "This model isn’t available to your OpenAI account yet. Try Flare, or check the model name.";
  if (status >= 500) return "OpenAI had a temporary problem. Press Retry in a moment.";
  return msg || "OpenAI could not complete the request.";
}

async function once(c: ImageCall): Promise<{ images: Buffer[]; usage: Usage | null }> {
  const base = openaiBase();
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey()}` };
  const common: Record<string, string | number> = { model: c.model, prompt: c.prompt, n: c.n, size: c.size, quality: c.quality, output_format: c.format, moderation: "auto" };
  if (c.transparent) common.background = "transparent";
  if (c.complexity) common.complexity = c.complexity;

  let res: Response;
  if (c.refs.length === 0) {
    res = await fetch(`${base}/images/generations`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(common), signal: c.signal });
  } else {
    const fd = new FormData();
    for (const [k, v] of Object.entries(common)) fd.append(k, String(v));
    c.refs.forEach((r, i) => fd.append("image[]", new Blob([new Uint8Array(r.buf)], { type: "image/png" }), r.name || `reference-${i + 1}.png`));
    res = await fetch(`${base}/images/edits`, { method: "POST", headers, body: fd, signal: c.signal });
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}
  if (!res.ok) throw new OpenAIError(res.status, friendly(res.status, json), json?.error?.message || text.slice(0, 400));
  const images = (json?.data || []).filter((d: any) => d?.b64_json).map((d: any) => Buffer.from(d.b64_json, "base64"));
  if (!images.length) throw new OpenAIError(502, "OpenAI returned no image. Press Retry.", text.slice(0, 400));
  const u = json?.usage;
  const usage: Usage | null = u
    ? {
        inputText: u.input_tokens_details?.text_tokens ?? (c.refs.length ? 0 : u.input_tokens ?? 0),
        inputImage: u.input_tokens_details?.image_tokens ?? 0,
        output: u.output_tokens ?? 0,
      }
    : null;
  return { images, usage };
}

export async function callOpenAI(c: ImageCall) {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await once(c);
    } catch (e) {
      last = e;
      if (c.signal.aborted) throw e;
      const retryable = e instanceof OpenAIError ? (e.status >= 500 || (e.status === 429 && !/credit|Add funds/i.test(e.message))) : e instanceof TypeError; // network error
      if (!retryable || attempt === 2) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  if (last instanceof OpenAIError) throw last;
  throw new OpenAIError(502, "Could not reach OpenAI. Check the server’s internet connection and retry.", String(last));
}
