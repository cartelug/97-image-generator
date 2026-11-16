export type Quality = "low" | "medium" | "high" | "xhigh" | "max" | "auto";
export type Complexity = "low" | "medium" | "high";
export type Format = "png" | "jpeg" | "webp";

export type ImageRec = { id: string; ext: string; width: number; height: number; bytes: number };

export type GenInput = {
  prompt: string;
  model: string;
  aspect: string; // "1:1" | ... | "auto"
  tier: string; // "standard" | "high" | "ultra"
  quality: Quality;
  complexity?: Complexity; // undefined = model default
  n: number;
  format: Format;
  transparent: boolean;
  refs: string[]; // ref_xxx (uploads) or img_xxx (earlier results)
  preserve: boolean;
  projectId: string;
  parentId?: string; // generation this edit came from
  presetId?: string;
};

export type Usage = { inputText: number; inputImage: number; output: number };

export type Gen = {
  id: string;
  input: GenInput;
  size: string; // "1024x1280" | "auto"
  status: "running" | "done" | "error" | "cancelled";
  phase?: string;
  error?: string;
  errorDetail?: string;
  images: ImageRec[];
  costEstimate: number;
  costActual?: number;
  usage?: Usage;
  demo?: boolean;
  favorite: boolean;
  createdAt: string;
  finishedAt?: string;
  durationMs?: number;
};

export type Asset = { id: string; name: string; ext: string; width: number; height: number; bytes: number; createdAt: string; brand?: boolean };
export type Project = { id: string; name: string; color: string; createdAt: string };
export type SavedPrompt = { id: string; title: string; text: string; createdAt: string };

export type Watermark = { enabled: boolean; position: "bottom-right" | "bottom-left" | "top-right" | "top-left"; opacity: number; scale: number };
export type Settings = {
  model: string;
  quality: Quality;
  complexity: Complexity | "default";
  aspect: string;
  tier: string;
  format: Format;
  watermark: Watermark;
  budget: { monthlyUsd: number; warnPct: number; enforce: boolean };
};

export type DB = {
  version: 1;
  projects: Project[];
  generations: Gen[];
  assets: Asset[];
  prompts: SavedPrompt[];
  settings: Settings;
};

export type Me = { uid: string; email: string; name: string };
