"use client";
import { flushSync } from "react-dom";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = any>(url: string, opts: { method?: string; json?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  const init: RequestInit = { method: opts.method || (opts.json || opts.form ? "POST" : "GET"), signal: opts.signal, credentials: "same-origin" };
  if (opts.json !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(opts.json);
  } else if (opts.form) init.body = opts.form;
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(0, "Can’t reach the server. Check your connection — your work is saved on this device.");
  }
  if (res.status === 401 && !url.includes("/auth/")) {
    if (typeof window !== "undefined" && !location.pathname.startsWith("/login")) location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status}).`);
  return data as T;
}

export const imgUrl = (id: string, o: { thumb?: boolean } = {}) => `/api/images/${id}${o.thumb ? "?thumb=1" : ""}`;
export const dlUrl = (id: string, format = "original", wm = false) => `/api/images/${id}?dl=1&format=${format}&wm=${wm ? 1 : 0}`;

export const fmtTime = (ms?: number) => (ms == null ? "" : ms < 1000 ? "<1s" : ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`);
export const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Run a state change inside a View Transition so elements that share a `view-transition-name`
 * fly from where they were to where they land (e.g. an upload moving between the tray and the
 * references). Browsers without the API, and people who prefer reduced motion, just get the update.
 */
export function morph(update: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!d.startViewTransition || reduce || document.hidden) return update();
  try {
    const t = d.startViewTransition(() => {
      flushSync(update);
    }) as { ready?: Promise<unknown>; finished?: Promise<unknown>; updateCallbackDone?: Promise<unknown> } | undefined;
    // A newer transition (rapid taps) skips the older one on purpose; that's not an error.
    t?.ready?.catch(() => {});
    t?.finished?.catch(() => {});
    t?.updateCallbackDone?.catch(() => {});
  } catch {
    update();
  }
}
