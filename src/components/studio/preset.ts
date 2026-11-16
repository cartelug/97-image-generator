import { Camera, Film, Frame, Megaphone, Smartphone, User } from "lucide-react";
import type { Draft } from "../AppProvider";
import type { Preset } from "@/lib/presets";

export const PRESET_ICONS = { poster: Frame, ad: Megaphone, product: Camera, portrait: User, social: Smartphone, cinema: Film } as const;

export function applyPreset(draft: Draft, setDraft: (p: Partial<Draft>) => void, p: Preset) {
  if (draft.presetId === p.id) return setDraft({ presetId: undefined });
  const prompt = draft.prompt.trim() ? `${draft.prompt.trim()}\n\n${p.direction}` : p.starter;
  setDraft({ prompt, aspect: p.aspect, quality: p.quality, presetId: p.id });
}
