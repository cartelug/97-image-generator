import type { Quality, Complexity, Format } from "./types";

export const MODELS = [
  { id: "gpt-image-2.6-sunburst", name: "Sunburst", tag: "Precision", blurb: "Highest detail, text and edit consistency" },
  { id: "gpt-image-2.6-flare", name: "Flare", tag: "Fast", blurb: "Fast drafts and quick iteration" },
] as const;
export const DEFAULT_MODEL = MODELS[0].id;

export const QUALITIES: { id: Quality; label: string; blurb: string }[] = [
  { id: "low", label: "Draft", blurb: "Fastest, cheapest" },
  { id: "medium", label: "Standard", blurb: "Balanced" },
  { id: "high", label: "High", blurb: "Recommended" },
  { id: "xhigh", label: "Ultra", blurb: "Extra detail" },
  { id: "max", label: "Max", blurb: "Highest rendering quality" },
  { id: "auto", label: "Auto", blurb: "Model decides" },
];

export const COMPLEXITIES: { id: Complexity | "default"; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

export const FORMATS: { id: Format; label: string }[] = [
  { id: "png", label: "PNG" },
  { id: "jpeg", label: "JPEG" },
  { id: "webp", label: "WebP" },
];

// Official rates, USD per 1M tokens (GPT-Image-2.6). Overridable on the server via env.
export const DEFAULT_RATES = { textIn: 5, imageIn: 8, imageOut: 30 };
