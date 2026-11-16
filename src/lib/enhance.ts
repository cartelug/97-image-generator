import { apiKey, demoMode, openaiBase, promptModel } from "./config";
import { PRESETS } from "./presets";

const GENERIC =
  "Photorealistic, richly detailed, natural believable lighting, true-to-life materials and textures, professional composition with a clear focal point, crisp focus, no distortion, correct anatomy and perfectly spelled text.";

export function localEnhance(prompt: string, presetId?: string) {
  const preset = PRESETS.find((p) => p.id === presetId);
  const base = prompt.trim().replace(/[\s.]+$/, "");
  return `${base}. ${preset ? preset.direction : GENERIC}`;
}

export async function enhancePrompt(prompt: string, presetId?: string): Promise<{ prompt: string; source: "openai" | "local" }> {
  if (demoMode()) return { prompt: localEnhance(prompt, presetId), source: "local" };
  const preset = PRESETS.find((p) => p.id === presetId);
  try {
    const res = await fetch(`${openaiBase()}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: promptModel(),
        messages: [
          {
            role: "system",
            content:
              "You are an expert prompt writer for a photorealistic AI image model. Rewrite the user's prompt into one rich, specific prompt (max 170 words): subject, setting, composition and framing, lens and lighting, materials, colour palette, mood. Keep every explicit requirement and any quoted text exactly. Never invent brand names, logos or text the user did not give. Output ONLY the rewritten prompt, no preface." +
              (preset ? ` Target style: ${preset.name} — ${preset.direction}` : ""),
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const json: any = await res.json();
    const text = String(json?.choices?.[0]?.message?.content || "").trim();
    if (text.length < 10) throw new Error("empty");
    return { prompt: text, source: "openai" };
  } catch {
    return { prompt: localEnhance(prompt, presetId), source: "local" };
  }
}
