import { apiKey, openaiBase } from "./config";
import { friendly, OpenAIError } from "./openai";
import type { Effort } from "./types";

export type SolCall = { id: string; name: string; args: Record<string, any> };
export type SolResult = { text: string; calls: SolCall[]; usage: { input: number; output: number; reasoning: number } | null };

/**
 * One turn with the prompt model (GPT-6.1 Sol) through the Responses API — the endpoint that supports
 * reasoning effort + tool calling. Stateless (store:false): we send the whole conversation every time.
 */
export async function callSol(o: {
  model: string;
  effort: Effort;
  instructions: string;
  input: unknown;
  tools?: unknown[];
  signal?: AbortSignal;
  maxOutput?: number;
}): Promise<SolResult> {
  const body: Record<string, unknown> = {
    model: o.model,
    instructions: o.instructions,
    input: o.input,
    reasoning: { effort: o.effort },
    // reasoning tokens count against this; the higher efforts need real headroom
    max_output_tokens: o.maxOutput ?? 32000,
    store: false,
  };
  if (o.tools?.length) {
    body.tools = o.tools;
    body.tool_choice = "auto";
    body.parallel_tool_calls = false;
  }
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${openaiBase()}/responses`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: o.signal,
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {}
      if (!res.ok) {
        const msg = String(json?.error?.message || "");
        if (res.status === 400 && /effort|reasoning/i.test(msg)) throw new OpenAIError(400, `The prompt model doesn’t accept the “${o.effort}” effort. Pick another effort and retry.`, msg);
        if (res.status === 404) throw new OpenAIError(404, `The prompt model “${o.model}” isn’t available to your OpenAI account yet. Pick another in Settings, or check OPENAI_PROMPT_MODEL.`, msg);
        throw new OpenAIError(res.status, friendly(res.status, json), msg || text.slice(0, 400));
      }
      const out: any[] = Array.isArray(json?.output) ? json.output : [];
      const reply = out
        .filter((i) => i?.type === "message")
        .flatMap((i) => (Array.isArray(i.content) ? i.content : []))
        .filter((c: any) => c?.type === "output_text" && typeof c.text === "string")
        .map((c: any) => c.text)
        .join("\n")
        .trim();
      const calls: SolCall[] = out
        .filter((i) => i?.type === "function_call")
        .map((i) => {
          let args: Record<string, any> = {};
          try {
            args = JSON.parse(i.arguments || "{}");
          } catch {}
          return { id: String(i.call_id || i.id || ""), name: String(i.name || ""), args };
        });
      if (json?.status === "incomplete" && !reply && !calls.length)
        throw new OpenAIError(502, "The prompt model ran out of room while thinking. Lower the effort and press Retry.", JSON.stringify(json?.incomplete_details || {}));
      const u = json?.usage;
      return { text: reply, calls, usage: u ? { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, reasoning: u.output_tokens_details?.reasoning_tokens ?? 0 } : null };
    } catch (e) {
      last = e;
      if (o.signal?.aborted) throw e;
      const retryable = e instanceof OpenAIError ? e.status >= 500 || (e.status === 429 && !/credit|Add funds/i.test(e.message)) : e instanceof TypeError;
      if (!retryable || attempt === 2) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  if (last instanceof OpenAIError) throw last;
  throw new OpenAIError(502, "Could not reach OpenAI. Check the server’s internet connection and retry.", String(last));
}
