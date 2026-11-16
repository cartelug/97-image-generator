"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import type { Asset, Gen, GenInput, Me, Project, SavedPrompt, Settings } from "@/lib/types";
import type { Calibration } from "@/lib/pricing";

export type RefItem = { id: string; name: string; kind: "upload" | "result" | "brand" };
export type Draft = {
  prompt: string;
  refs: RefItem[];
  aspect: string;
  tier: string;
  model: string;
  quality: GenInput["quality"];
  complexity: Settings["complexity"];
  n: number;
  format: GenInput["format"];
  transparent: boolean;
  projectId: string;
  presetId?: string;
  preserve: boolean;
  parentId?: string;
};
export type Usage = {
  month: string;
  spent: number;
  images: number;
  verified: number;
  unverified: number;
  byModel: Record<string, { usd: number; images: number }>;
  recent: { id: string; at: string; model: string; quality: string; images: number; usd: number; actual: boolean; demo: boolean; thumb?: string }[];
  calibration: Calibration;
  budget: Settings["budget"];
};
export type Toast = { id: number; msg: string; kind: "info" | "ok" | "error"; out?: boolean };
/** A reference image on its way to the server, with its real progress. */
export type PendingUpload = { key: string; name: string; preview: string; stage: "queued" | "compressing" | "uploading" | "processing" | "done" | "error"; pct: number; error?: string };

type Ctx = {
  pending: PendingUpload[];
  retryUpload: (key: string) => void;
  dismissUpload: (key: string) => void;
  dismissToast: (id: number) => void;
  ready: boolean;
  me: Me | null;
  demo: boolean;
  settings: Settings;
  projects: Project[];
  prompts: SavedPrompt[];
  assets: Asset[];
  gens: Gen[];
  usage: Usage | null;
  draft: Draft;
  setDraft: (p: Partial<Draft>) => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  toasts: Toast[];
  toast: (msg: string, kind?: Toast["kind"]) => void;
  submit: (override?: Partial<GenInput>) => Promise<Gen | null>;
  submitting: boolean;
  cancel: (id: string) => Promise<void>;
  retry: (g: Gen) => Promise<void>;
  patchGen: (id: string, p: { favorite?: boolean; projectId?: string }) => Promise<void>;
  deleteGen: (id: string) => Promise<void>;
  uploadFiles: (files: File[]) => Promise<void>;
  addBrandRef: () => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  updateSettings: (p: Partial<Settings> | Record<string, unknown>) => Promise<void>;
  createProject: (name: string) => Promise<Project | null>;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  savePrompt: (text: string) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  editImage: (g: Gen, imageId: string) => void;
  reuse: (g: Gen) => void;
  refreshUsage: () => Promise<void>;
  logout: () => Promise<void>;
};

const C = createContext<Ctx | null>(null);
export const useApp = () => {
  const v = useContext(C);
  if (!v) throw new Error("useApp outside provider");
  return v;
};

const DRAFT_KEY = "97ig.draft.v1";
const emptyDraft = (s: Settings): Draft => ({ prompt: "", refs: [], aspect: s.aspect, tier: s.tier, model: s.model, quality: s.quality, complexity: s.complexity, n: 1, format: s.format, transparent: false, projectId: "proj_0000000000000000", preserve: false });

/** Make an in-memory copy of a picked image, downscaled to ≤2048px so phones upload fast. */
async function prepareUpload(file: File): Promise<File> {
  const name = file.name || "reference.jpg";
  try {
    if (typeof createImageBitmap === "function") {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 2048 / Math.max(bmp.width, bmp.height));
      if (scale < 1 || file.size > 4 * 1024 * 1024) {
        const c = document.createElement("canvas");
        c.width = Math.round(bmp.width * scale);
        c.height = Math.round(bmp.height * scale);
        c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
        bmp.close?.();
        const png = file.type === "image/png" || file.type === "image/webp";
        const blob = await new Promise<Blob | null>((r) => c.toBlob(r, png ? "image/png" : "image/jpeg", 0.92));
        if (blob) return new File([blob], name.replace(/\.[^.]+$/, "") + (png ? ".png" : ".jpg"), { type: blob.type });
      }
      bmp.close?.();
    }
  } catch {}
  const buf = await file.arrayBuffer();
  return new File([buf], name, { type: file.type || "image/jpeg" });
}

/** Upload one file with XHR so we can report real byte progress. */
function xhrUpload(file: File, onProgress: (p: number) => void): Promise<Asset[]> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("POST", "/api/uploads");
    x.withCredentials = true;
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.upload.onload = () => onProgress(1);
    x.onload = () => {
      let data: { assets?: Asset[]; error?: string } | null = null;
      try {
        data = JSON.parse(x.responseText);
      } catch {}
      if (x.status === 401 && !location.pathname.startsWith("/login")) location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
      if (x.status >= 200 && x.status < 300 && data?.assets?.length) resolve(data.assets);
      else reject(new ApiError(x.status, data?.error || `Upload failed (${x.status}).`));
    };
    x.onerror = () => reject(new ApiError(0, "Upload interrupted."));
    x.onabort = () => reject(new ApiError(0, "Upload cancelled."));
    const fd = new FormData();
    fd.append("files", file, file.name);
    x.send(fd);
  });
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [demo, setDemo] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [gens, setGens] = useState<Gen[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [draft, setDraftState] = useState<Draft | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const toastId = useRef(0);
  const prevStatus = useRef<Record<string, string>>({});

  const [pending, setPending] = useState<PendingUpload[]>([]);
  const pendingRef = useRef<PendingUpload[]>([]);
  pendingRef.current = pending;
  const rawFiles = useRef(new Map<string, File>());
  const readyFiles = useRef(new Map<string, File>());

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, out: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 260);
  }, []);

  const toast = useCallback((msg: string, kind: Toast["kind"] = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, msg, kind }]);
    setTimeout(() => dismissToast(id), kind === "error" ? 7000 : 3800);
  }, [dismissToast]);

  const fail = useCallback((e: unknown) => toast(e instanceof ApiError ? e.message : "Something went wrong.", "error"), [toast]);

  // initial load
  useEffect(() => {
    (async () => {
      try {
        const b = await api("/api/bootstrap");
        setMe(b.user);
        setDemo(b.demo);
        setSettings(b.settings);
        setProjects(b.projects);
        setPrompts(b.prompts);
        setAssets(b.assets);
        setGens(b.generations);
        setUsage(b.usage);
        let d = emptyDraft(b.settings);
        try {
          const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
          if (saved && typeof saved === "object") d = { ...d, ...saved, refs: Array.isArray(saved.refs) ? saved.refs : [] };
        } catch {}
        if (!b.projects.some((p: Project) => p.id === d.projectId)) d.projectId = "proj_0000000000000000";
        setDraftState(d);
        const running = (b.generations as Gen[]).find((g) => g.status === "running");
        if (running) setActiveId(running.id);
        for (const g of b.generations as Gen[]) prevStatus.current[g.id] = g.status;
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 401)) fail(e);
      } finally {
        setReady(true);
      }
    })();
  }, [fail]);

  // persist the draft so prompts + references survive failures, reloads and navigation
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [draft]);

  const setDraft = useCallback((p: Partial<Draft>) => setDraftState((d) => (d ? { ...d, ...p } : d)), []);

  const refreshUsage = useCallback(async () => {
    try {
      setUsage((await api("/api/usage")).usage);
    } catch {}
  }, []);

  // Only touch state when something visible changed, so polling doesn't re-render the whole app every tick.
  const upsert = useCallback((g: Gen) => setGens((list) => {
    const i = list.findIndex((x) => x.id === g.id);
    if (i < 0) return [g, ...list];
    const o = list[i];
    if (o.status === g.status && o.phase === g.phase && o.images.length === g.images.length && o.favorite === g.favorite && o.input.projectId === g.input.projectId && o.error === g.error) return list;
    const next = list.slice();
    next[i] = g;
    return next;
  }), []);

  // poll running generations
  const running = useMemo(() => gens.filter((g) => g.status === "running").map((g) => g.id).join(","), [gens]);
  useEffect(() => {
    if (!running) return;
    const ids = running.split(",");
    const t = setInterval(async () => {
      if (document.hidden) return; // nothing to animate while the tab is in the background
      for (const id of ids) {
        try {
          const { generation } = await api<{ generation: Gen }>(`/api/generations/${id}`);
          upsert(generation);
          const was = prevStatus.current[id];
          if (generation.status !== "running" && was !== generation.status) {
            prevStatus.current[id] = generation.status;
            if (generation.status === "done") {
              toast("Your image is ready.", "ok");
              try {
                navigator.vibrate?.(14);
              } catch {}
              refreshUsage();
            } else if (generation.status === "error") toast(generation.error || "Generation failed.", "error");
          }
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) setGens((l) => l.filter((x) => x.id !== id));
        }
      }
    }, 1200);
    return () => clearInterval(t);
  }, [running, upsert, toast, refreshUsage]);

  const toInput = (d: Draft): Partial<GenInput> => ({
    prompt: d.prompt, model: d.model, aspect: d.aspect, tier: d.tier, quality: d.quality,
    complexity: d.complexity === "default" ? undefined : d.complexity, n: d.n, format: d.format, transparent: d.transparent,
    refs: d.refs.map((r) => r.id), preserve: d.preserve && d.refs.length > 0, projectId: d.projectId, parentId: d.parentId, presetId: d.presetId,
  });

  const submit: Ctx["submit"] = useCallback(async (override) => {
    if (!draft) return null;
    setSubmitting(true);
    try {
      const { generation } = await api<{ generation: Gen }>("/api/generate", { json: { ...toInput(draft), ...override } });
      prevStatus.current[generation.id] = "running";
      upsert(generation);
      setActiveId(generation.id);
      router.push("/studio");
      return generation;
    } catch (e) {
      fail(e); // the draft is untouched, so nothing is lost
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [draft, upsert, fail, router]);

  const cancel = useCallback(async (id: string) => {
    try {
      await api(`/api/generations/${id}/cancel`, { method: "POST", json: {} });
    } catch (e) {
      fail(e);
    }
  }, [fail]);

  const retry = useCallback(async (g: Gen) => {
    setSubmitting(true);
    try {
      const { generation } = await api<{ generation: Gen }>("/api/generate", { json: g.input });
      prevStatus.current[generation.id] = "running";
      upsert(generation);
      setActiveId(generation.id);
    } catch (e) {
      fail(e);
    } finally {
      setSubmitting(false);
    }
  }, [upsert, fail]);

  const patchGen: Ctx["patchGen"] = useCallback(async (id, p) => {
    try {
      const { generation } = await api<{ generation: Gen }>(`/api/generations/${id}`, { method: "PATCH", json: p });
      upsert(generation);
    } catch (e) {
      fail(e);
    }
  }, [upsert, fail]);

  const deleteGen = useCallback(async (id: string) => {
    try {
      await api(`/api/generations/${id}`, { method: "DELETE" });
      setGens((l) => l.filter((x) => x.id !== id));
      setActiveId((a) => (a === id ? null : a));
      refreshUsage();
    } catch (e) {
      fail(e);
    }
  }, [fail, refreshUsage]);

  const patchPending = useCallback((key: string, p: Partial<PendingUpload>) => setPending((l) => l.map((x) => (x.key === key ? { ...x, ...p } : x))), []);
  const dropPending = useCallback((key: string) => {
    setPending((l) => {
      const hit = l.find((x) => x.key === key);
      if (hit) URL.revokeObjectURL(hit.preview);
      return l.filter((x) => x.key !== key);
    });
    rawFiles.current.delete(key);
    readyFiles.current.delete(key);
  }, []);

  /** Compress → upload (real %) → server processing → ready. Each file on its own, so one bad photo doesn't sink the rest. */
  const runUpload = useCallback(async (key: string) => {
    const raw = rawFiles.current.get(key);
    if (!raw) return;
    try {
      let f = readyFiles.current.get(key);
      if (!f) {
        patchPending(key, { stage: "compressing", pct: 0, error: undefined });
        // Copy each photo into memory first (and shrink big phone photos). iPhone Safari
        // fails the upload ("Load failed") if it still points at the original picked file.
        f = await prepareUpload(raw);
        readyFiles.current.set(key, f);
      }
      patchPending(key, { stage: "uploading", pct: 0, error: undefined });
      const made = await xhrUpload(f, (p) => patchPending(key, { pct: p, stage: p >= 1 ? "processing" : "uploading" }));
      const a = made[0];
      patchPending(key, { stage: "done", pct: 1 });
      await new Promise((r) => setTimeout(r, 520)); // let the ✓ land before the tile swaps
      setAssets((list) => [a, ...list]);
      setDraftState((d) => (d && d.refs.length < 16 ? { ...d, refs: [...d.refs, { id: a.id, name: a.name, kind: "upload" as const }] } : d));
      dropPending(key);
    } catch (e) {
      patchPending(key, { stage: "error", error: e instanceof ApiError ? e.message : "Upload failed." });
    }
  }, [patchPending, dropPending]);

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files.length || !draft) return;
    const busy = pendingRef.current.filter((p) => p.stage !== "error").length;
    const room = 16 - draft.refs.length - busy;
    if (room <= 0) return toast("You can use up to 16 reference images.", "error");
    if (files.length > room) toast(`Only ${room} more reference image${room === 1 ? "" : "s"} fit — added the first ${room}.`);
    const items = files.slice(0, room).map((file) => {
      const key = `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      rawFiles.current.set(key, file);
      return { key, name: file.name || "reference", preview: URL.createObjectURL(file), stage: "queued" as const, pct: 0 };
    });
    setPending((l) => [...l, ...items]);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(3, items.length) }, async () => {
      while (next < items.length) await runUpload(items[next++].key);
    }));
  }, [draft, toast, runUpload]);

  const retryUpload = useCallback((key: string) => void runUpload(key), [runUpload]);

  const addBrandRef = useCallback(async () => {
    try {
      const { asset } = await api<{ asset: Asset }>("/api/uploads/brand", { method: "POST", json: {} });
      setAssets((a) => (a.some((x) => x.id === asset.id) ? a : [asset, ...a]));
      setDraftState((d) => (d && !d.refs.some((r) => r.id === asset.id) ? { ...d, refs: [...d.refs, { id: asset.id, name: "THE 97 logo", kind: "brand" as const }] } : d));
      toast("Official 97 logo added as a reference.", "ok");
    } catch (e) {
      fail(e);
    }
  }, [fail, toast]);

  const removeAsset = useCallback(async (id: string) => {
    try {
      await api(`/api/uploads/${id}`, { method: "DELETE" });
      setAssets((a) => a.filter((x) => x.id !== id));
      setDraftState((d) => (d ? { ...d, refs: d.refs.filter((r) => r.id !== id) } : d));
    } catch (e) {
      fail(e);
    }
  }, [fail]);

  const updateSettings: Ctx["updateSettings"] = useCallback(async (p) => {
    try {
      const { settings: s } = await api<{ settings: Settings }>("/api/settings", { method: "PATCH", json: p });
      setSettings(s);
      refreshUsage();
    } catch (e) {
      fail(e);
    }
  }, [fail, refreshUsage]);

  const createProject = useCallback(async (name: string) => {
    try {
      const { project } = await api<{ project: Project }>("/api/projects", { json: { name } });
      setProjects((p) => [...p, project]);
      return project;
    } catch (e) {
      fail(e);
      return null;
    }
  }, [fail]);
  const renameProject = useCallback(async (id: string, name: string) => {
    try {
      const { project } = await api<{ project: Project }>(`/api/projects/${id}`, { method: "PATCH", json: { name } });
      setProjects((p) => p.map((x) => (x.id === id ? project : x)));
    } catch (e) {
      fail(e);
    }
  }, [fail]);
  const deleteProject = useCallback(async (id: string) => {
    try {
      await api(`/api/projects/${id}`, { method: "DELETE" });
      setProjects((p) => p.filter((x) => x.id !== id));
      setGens((l) => l.map((g) => (g.input.projectId === id ? { ...g, input: { ...g.input, projectId: "proj_0000000000000000" } } : g)));
    } catch (e) {
      fail(e);
    }
  }, [fail]);

  const savePrompt = useCallback(async (text: string) => {
    try {
      const { prompt } = await api<{ prompt: SavedPrompt }>("/api/prompts", { json: { text } });
      setPrompts((p) => [prompt, ...p]);
      toast("Prompt saved to your presets.", "ok");
    } catch (e) {
      fail(e);
    }
  }, [fail, toast]);
  const deletePrompt = useCallback(async (id: string) => {
    try {
      await api(`/api/prompts/${id}`, { method: "DELETE" });
      setPrompts((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      fail(e);
    }
  }, [fail]);

  const editImage: Ctx["editImage"] = useCallback((g, imageId) => {
    setDraftState((d) => (d ? { ...d, prompt: "", refs: [{ id: imageId, name: "Image to edit", kind: "result" }], preserve: true, parentId: g.id, aspect: g.input.aspect, tier: g.input.tier, model: g.input.model, quality: g.input.quality, projectId: g.input.projectId, presetId: undefined } : d));
    router.push("/studio");
    toast("Describe the change — everything else will be preserved.");
  }, [router, toast]);

  const reuse: Ctx["reuse"] = useCallback((g) => {
    const i = g.input;
    setDraftState((d) => (d ? { ...d, prompt: i.prompt, aspect: i.aspect, tier: i.tier, model: i.model, quality: i.quality, complexity: i.complexity || "default", n: i.n, format: i.format, transparent: i.transparent, projectId: i.projectId, presetId: i.presetId, preserve: i.preserve, parentId: i.parentId, refs: i.refs.map((id) => ({ id, name: id.startsWith("img_") ? "Earlier result" : "Reference", kind: id.startsWith("img_") ? ("result" as const) : ("upload" as const) })) } : d));
    router.push("/studio");
  }, [router]);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST", json: {} }).catch(() => {});
    location.href = "/login";
  }, []);

  if (!ready || !settings || !draft) return <>{ready ? <div className="boot-fail">Could not load your studio. Refresh to try again.</div> : null}</>;

  return (
    <C.Provider value={{ pending, retryUpload, dismissUpload: dropPending, dismissToast, ready, me, demo, settings, projects, prompts, assets, gens, usage, draft, setDraft, activeId, setActiveId, toasts, toast, submit, submitting, cancel, retry, patchGen, deleteGen, uploadFiles, addBrandRef, removeAsset, updateSettings, createProject, renameProject, deleteProject, savePrompt, deletePrompt, editImage, reuse, refreshUsage, logout }}>
      {children}
    </C.Provider>
  );
}
