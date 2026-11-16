import type { Quality } from "./types";
import { DEFAULT_RATES } from "./models";

export type Rates = typeof DEFAULT_RATES;

// STARTING GUESS for output image tokens per megapixel. OpenAI does not publish a per-image
// price table for 2.6, so the app measures real token usage after each generation and the
// estimate self-corrects ("calibration"). Estimates are always labelled as estimates.
export const BASE_TOKENS_PER_MP: Record<Quality, number> = { low: 280, medium: 1100, high: 4200, xhigh: 6500, max: 9000, auto: 4200 };
export type Calibration = Partial<Record<Quality, number>>;

export function estimateCost(o: { quality: Quality; w: number; h: number; n: number; refs: number; promptChars: number; calibration?: Calibration; rates?: Rates }) {
  const r = o.rates || DEFAULT_RATES;
  const mp = (o.w * o.h) / 1_000_000;
  const perMp = o.calibration?.[o.quality] ?? BASE_TOKENS_PER_MP[o.quality];
  const outTokens = perMp * mp * o.n;
  const inText = Math.ceil(o.promptChars / 4);
  const inImg = o.refs * 1100; // ≈ cost of one ≤1MP reference at high fidelity
  const usd = (outTokens * r.imageOut + inText * r.textIn + inImg * r.imageIn) / 1_000_000;
  return { usd, outTokens: Math.round(outTokens), calibrated: o.calibration?.[o.quality] != null };
}

export function actualCost(u: { inputText: number; inputImage: number; output: number }, r: Rates = DEFAULT_RATES) {
  return (u.inputText * r.textIn + u.inputImage * r.imageIn + u.output * r.imageOut) / 1_000_000;
}

export function fmtUsd(v: number) {
  if (v === 0) return "$0.00";
  if (v < 0.01) return "<$0.01";
  return "$" + v.toFixed(v < 1 ? 3 : 2).replace(/(\.\d\d)0$/, "$1");
}
