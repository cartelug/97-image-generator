// OpenAI size rules for GPT-Image 2.5/2.6: multiples of 16, ratio between 1:3 and 3:1,
// max edge 3840, total pixels 655,360 – 8,294,400. Above 2560x1440 is experimental.
export const ASPECTS = [
  { id: "1:1", label: "Square", use: "Feed · Logos", w: 1, h: 1 },
  { id: "4:5", label: "Portrait", use: "Instagram", w: 4, h: 5 },
  { id: "9:16", label: "Story", use: "Reels · TikTok", w: 9, h: 16 },
  { id: "16:9", label: "Wide", use: "Cinema · YouTube", w: 16, h: 9 },
  { id: "3:2", label: "Photo", use: "Landscape", w: 3, h: 2 },
  { id: "2:3", label: "Tall", use: "Posters", w: 2, h: 3 },
  { id: "auto", label: "Auto", use: "Model picks", w: 1, h: 1 },
] as const;

export const TIERS = [
  { id: "standard", label: "Standard", blurb: "≈1–1.5 MP · fastest" },
  { id: "high", label: "High-res", blurb: "≈2–3 MP" },
  { id: "ultra", label: "4K", blurb: "up to 8 MP · experimental" },
] as const;

const TABLE: Record<string, Record<string, [number, number]>> = {
  standard: { "1:1": [1024, 1024], "4:5": [1024, 1280], "9:16": [864, 1536], "16:9": [1536, 864], "3:2": [1536, 1024], "2:3": [1024, 1536] },
  high: { "1:1": [1536, 1536], "4:5": [1536, 1920], "9:16": [1152, 2048], "16:9": [2048, 1152], "3:2": [2160, 1440], "2:3": [1440, 2160] },
  ultra: { "1:1": [2880, 2880], "4:5": [2304, 2880], "9:16": [2160, 3840], "16:9": [3840, 2160], "3:2": [3456, 2304], "2:3": [2304, 3456] },
};

export function validSize(w: number, h: number) {
  const px = w * h;
  const r = w / h;
  return w % 16 === 0 && h % 16 === 0 && Math.max(w, h) <= 3840 && px >= 655_360 && px <= 8_294_400 && r >= 1 / 3 && r <= 3;
}

export function sizeFor(aspect: string, tier: string): { w: number; h: number; param: string; auto: boolean } {
  if (aspect === "auto") return { w: 1024, h: 1024, param: "auto", auto: true };
  const row = TABLE[tier] || TABLE.standard;
  const [w, h] = row[aspect] || row["1:1"];
  return { w, h, param: `${w}x${h}`, auto: false };
}

export function allSizes() {
  return Object.entries(TABLE).flatMap(([tier, row]) => Object.entries(row).map(([aspect, [w, h]]) => ({ tier, aspect, w, h })));
}
