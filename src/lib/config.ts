import path from "node:path";
import { DEFAULT_RATES } from "./models";

export const isProd = () => process.env.NODE_ENV === "production";
export const dataDir = () => path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
export const apiKey = () => (process.env.OPENAI_API_KEY || "").trim();
export const demoMode = () => process.env.MOCK_OPENAI === "1" || !apiKey();
export const openaiBase = () => (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
export const promptModel = () => process.env.OPENAI_PROMPT_MODEL || "gpt-5.5";
export const defaultBudget = () => Number(process.env.MONTHLY_BUDGET_USD) || 5;
export const rates = () => ({
  textIn: Number(process.env.PRICE_TEXT_IN) || DEFAULT_RATES.textIn,
  imageIn: Number(process.env.PRICE_IMAGE_IN) || DEFAULT_RATES.imageIn,
  imageOut: Number(process.env.PRICE_IMAGE_OUT) || DEFAULT_RATES.imageOut,
});
export const MAX_REFS = 16;
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_CONCURRENT = 3;
