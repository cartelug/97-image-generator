"use client";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Check, Columns2, Copy, Loader2, Maximize2, Pencil, RefreshCw, Star, X } from "lucide-react";
import { useApp } from "../AppProvider";
import { CompareSlider, DownloadMenu, SmartImg, Thumb } from "../ui";
import { Logo } from "../Logo";
import { PRESETS } from "@/lib/presets";
import { PRESET_ICONS, applyPreset } from "./preset";
import { fmtTime } from "@/lib/client";
import { fmtUsd } from "@/lib/pricing";
import { MODELS, QUALITIES } from "@/lib/models";
import { Lightbox } from "../Lightbox";
import type { Gen } from "@/lib/types";

const STEPS = [
  { id: "preparing", label: "Preparing your references" },
  { id: "rendering", label: "Rendering" },
  { id: "saving", label: "Saving to your gallery" },
];

function Running({ gen }: { gen: Gen }) {
  const { cancel } = useApp();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const [w, h] = gen.size === "auto" ? [1, 1] : gen.size.split("x").map(Number);
  const idx = Math.max(0, STEPS.findIndex((s) => s.id === (gen.phase === "queued" ? "preparing" : gen.phase)));
  const sec = Math.max(0, Math.round((now - new Date(gen.createdAt).getTime()) / 1000));
  const model = MODELS.find((m) => m.id === gen.input.model)?.name;
  return (
    <div className="stage-card running" role="status" aria-live="polite">
      <div className="skeleton" style={{ aspectRatio: `${w}/${h}` }}>
        <div className="skeleton-mark"><Logo height={64} /></div>
        <div className="shimmer" aria-hidden />
      </div>
      <div className="progress-card">
        <div className="progress-rail" aria-hidden><i /></div>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.id} className={i < idx ? "done" : i === idx ? "now" : ""}>
              {i < idx ? <Check size={14} /> : i === idx ? <Loader2 className="spin" size={14} /> : <span className="pip" />}
              {s.id === "rendering" ? `Rendering with ${model}` : s.label}
            </li>
          ))}
        </ol>
        <div className="progress-foot">
          <span className="mono">{Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}</span>
          <span className="muted tiny">High-quality renders can take 1–3 minutes. You can leave this page — it keeps rendering.</span>
          <button className="btn quiet sm" onClick={() => cancel(gen.id)}><X size={14} /> Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Failed({ gen }: { gen: Gen }) {
  const { retry, reuse, submitting, deleteGen } = useApp();
  const cancelled = gen.status === "cancelled";
  return (
    <div className="stage-card failed" role="alert">
      <div className={`fail-icon${cancelled ? " muted" : ""}`}><AlertCircle size={26} /></div>
      <h3>{cancelled ? "Generation cancelled" : "That didn’t go through"}</h3>
      <p>{gen.error}</p>
      {gen.errorDetail && <details className="fail-detail"><summary>Technical details</summary><code>{gen.errorDetail}</code></details>}
      <p className="muted tiny">Your prompt and references are safe.</p>
      <div className="row gap8 center-row">
        <button className="btn primary" onClick={() => retry(gen)} disabled={submitting}><RefreshCw size={16} /> Retry</button>
        <button className="btn ghost" onClick={() => reuse(gen)}><Pencil size={16} /> Edit prompt</button>
        <button className="btn quiet" onClick={() => deleteGen(gen.id)}>Dismiss</button>
      </div>
    </div>
  );
}

function Done({ gen }: { gen: Gen }) {
  const { patchGen, editImage, submit, toast } = useApp();
  const [idx, setIdx] = useState(0);
  const [cmp, setCmp] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { setIdx(0); setCmp(false); }, [gen.id]);
  const img = gen.images[idx] || gen.images[0];
  const ref0 = gen.input.refs[0];
  const model = MODELS.find((m) => m.id === gen.input.model)?.name;
  const q = QUALITIES.find((x) => x.id === gen.input.quality)?.label;
  if (!img) return null;
  return (
    <div className="stage-card done">
      <div className="viewer">
        {cmp && ref0 ? (
          <CompareSlider before={ref0} after={img.id} ratio={`${img.width}/${img.height}`} beforeLabel="Original" afterLabel="Result" />
        ) : (
          <button className="viewer-btn" onClick={() => setOpen(true)} aria-label="Open image details">
            <SmartImg id={img.id} alt={gen.input.prompt} w={img.width} h={img.height} eager className="viewer-img" />
            <span className="viewer-zoom"><Maximize2 size={16} /></span>
          </button>
        )}
      </div>
      {gen.images.length > 1 && (
        <div className="variants" role="tablist" aria-label="Variations">
          {gen.images.map((im, i) => (
            <button key={im.id} role="tab" aria-selected={i === idx} className={i === idx ? "on" : ""} onClick={() => setIdx(i)}><Thumb id={im.id} alt={`Variation ${i + 1}`} /></button>
          ))}
        </div>
      )}
      <div className="actions">
        <DownloadMenu imageId={img.id} ext={img.ext} primary />
        <button className="btn ghost" onClick={() => submit({ ...gen.input })}><RefreshCw size={16} /> Regenerate</button>
        <button className="btn ghost" onClick={() => editImage(gen, img.id)}><Pencil size={16} /> Edit</button>
        {ref0 && <button className={`btn ${cmp ? "primary" : "ghost"}`} onClick={() => setCmp((c) => !c)} aria-pressed={cmp}><Columns2 size={16} /> Before / after</button>}
        <button className={`icon-btn${gen.favorite ? " on" : ""}`} aria-pressed={gen.favorite} aria-label={gen.favorite ? "Remove favourite" : "Add to favourites"} onClick={() => patchGen(gen.id, { favorite: !gen.favorite })}><Star size={18} fill={gen.favorite ? "currentColor" : "none"} /></button>
        <button className="icon-btn" aria-label="Copy prompt" onClick={() => { navigator.clipboard?.writeText(gen.input.prompt); toast("Prompt copied.", "ok"); }}><Copy size={17} /></button>
      </div>
      <div className="meta-line mono">
        <span>{model}</span><span>{q}</span><span>{img.width}×{img.height}</span><span>{fmtTime(gen.durationMs)}</span>
        <span>{gen.demo ? "demo · free" : gen.costActual != null ? `${fmtUsd(gen.costActual)} measured` : `≈ ${fmtUsd(gen.costEstimate)}`}</span>
      </div>
      {open && <Lightbox gen={gen} imageId={img.id} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Welcome() {
  const { draft, setDraft } = useApp();
  return (
    <div className="welcome">
      <div className="welcome-glow" aria-hidden />
      <Logo height={78} />
      <h1>Generate extraordinary.</h1>
      <p className="welcome-sub">Design without limits.</p>
      <ol className="flow" aria-label="How it works">
        {["Describe", "Upload references", "Generate", "Download"].map((s, i) => (<li key={s}><i>{i + 1}</i>{s}{i < 3 && <ArrowRight size={14} />}</li>))}
      </ol>
      <div className="preset-grid">
        {PRESETS.map((p) => {
          const Icon = PRESET_ICONS[p.icon];
          return (
            <button key={p.id} className="preset-card" onClick={() => { applyPreset({ ...draft, presetId: undefined }, setDraft, p); document.getElementById("prompt")?.focus(); }}>
              <Icon size={20} strokeWidth={1.6} />
              <b>{p.name}</b>
              <em>{p.blurb}</em>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Stage() {
  const { gens, activeId } = useApp();
  const active = gens.find((g) => g.id === activeId) ?? gens[0];
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeId && window.innerWidth < 1000) top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeId]);
  return (
    <div className="stage" ref={top}>
      {!active ? <Welcome /> : active.status === "running" ? <Running gen={active} /> : active.status === "done" ? <Done gen={active} /> : <Failed gen={active} />}
    </div>
  );
}
