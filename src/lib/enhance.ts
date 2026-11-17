import { demoMode } from "./config";
import { PRESETS } from "./presets";
import { callSol } from "./responses";
import type { Effort } from "./types";

const GENERIC =
  "Photorealistic, richly detailed, natural believable lighting, true-to-life materials and textures, professional composition with a clear focal point, crisp focus, no distortion, correct anatomy and perfectly spelled text.";

export function localEnhance(prompt: string, presetId?: string) {
  const preset = PRESETS.find((p) => p.id === presetId);
  const base = prompt.trim().replace(/[\s.]+$/, "");
  return `${base}. ${preset ? preset.direction : GENERIC}`;
}

export async function enhancePrompt(prompt: string, presetId: string | undefined, opt: { model: string; effort: Effort }): Promise<{ prompt: string; source: "openai" | "local" }> {
  if (demoMode()) return { prompt: localEnhance(prompt, presetId), source: "local" };
  const preset = PRESETS.find((p) => p.id === presetId);
  try {
    const r = await callSol({
      model: opt.model,
      effort: opt.effort,
      maxOutput: 16000,
      signal: AbortSignal.timeout(150_000),
      instructions:
        "You are an expert prompt writer for a photorealistic AI image model. Rewrite the user's prompt into one rich, specific, self-contained prompt (about 170 words, or longer if the input is long: never drop details): subject, setting, composition and framing, lens and lighting, materials, colour palette, mood. Keep every explicit requirement and any quoted text exactly. Never invent brand names, logos or text the user did not give. Output ONLY the rewritten prompt, no preface." +
        (preset ? ` Target style: ${preset.name} — ${preset.direction}` : ""),
      input: prompt,
    });
    if (r.text.length < 10) throw new Error("empty");
    return { prompt: r.text, source: "openai" };
  } catch {
    return { prompt: localEnhance(prompt, presetId), source: "local" };
  }
}
