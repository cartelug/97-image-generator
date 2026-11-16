"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, BookmarkPlus, ChevronDown, Loader2, Plus, Stamp, Undo2, Upload, WandSparkles, X, Check, ArrowRight, Trash2, Info, RotateCw, TriangleAlert, History as HistoryIcon } from "lucide-react";
import { useApp, useUploads, type PendingUpload, type RefItem } from "../AppProvider";
import { Segmented, Thumb, Toggle, useOutside } from "../ui";
import { PRESETS } from "@/lib/presets";
import { PRESET_ICONS, applyPreset } from "./preset";
import { ASPECTS, TIERS, sizeFor } from "@/lib/sizes";
import { COMPLEXITIES, FORMATS, MODELS, QUALITIES } from "@/lib/models";
import { estimateCost, fmtUsd } from "@/lib/pricing";
import { api, ApiError, morph } from "@/lib/client";

const STAGE_LABEL: Record<PendingUpload["stage"], string> = { queued: "Waiting", compressing: "Optimising", uploading: "Uploading", processing: "Processing", done: "Ready", error: "Failed" };

/** One reference on its way up: local preview + a ring that tracks the real bytes sent. */
function UploadTile({ u, onRetry, onRemove }: { u: PendingUpload; onRetry: () => void; onRemove: () => void }) {
  const C = 2 * Math.PI * 17;
  const pct = u.stage === "uploading" ? u.pct : u.stage === "processing" || u.stage === "done" ? 1 : 0;
  const spinning = u.stage === "queued" || u.stage === "compressing" || u.stage === "processing";
  return (
    <li className={`up-tile is-${u.stage}`} aria-label={`${u.name}: ${STAGE_LABEL[u.stage]}${u.stage === "uploading" ? ` ${Math.round(u.pct * 100)}%` : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={u.preview} alt="" draggable={false} />
      <span className="up-veil" aria-hidden />
      {u.stage === "error" ? (
        <button type="button" className="up-center up-retry" onClick={onRetry} title={u.error}>
          <TriangleAlert size={16} />
          <b>Retry</b>
        </button>
      ) : (
        <span className="up-center" aria-hidden>
          <svg className={`up-ring${spinning ? " spinning" : ""}`} viewBox="0 0 40 40">
            <circle className="track" cx="20" cy="20" r="17" />
            <circle className="bar" cx="20" cy="20" r="17" strokeDasharray={C} strokeDashoffset={spinning && u.stage !== "processing" ? C * 0.72 : C * (1 - pct)} />
          </svg>
          {u.stage === "done" ? <Check className="up-check" size={16} strokeWidth={3} /> : <b className="up-pct">{u.stage === "uploading" ? Math.round(u.pct * 100) : ""}</b>}
        </span>
      )}
      <span className="up-label">{u.stage === "uploading" ? `${Math.round(u.pct * 100)}%` : STAGE_LABEL[u.stage]}</span>
      {(u.stage === "error" || u.stage === "queued") && (
        <button type="button" className="ref-x" aria-label={`Remove ${u.name}`} onClick={onRemove}><X size={12} /></button>
      )}
    </li>
  );
}

export function Composer() {
  const { draft, setDraft, settings, usage, demo, submit, submitting, uploadFiles, addBrandRef, removeAsset, assets, projects, createProject, prompts, savePrompt, deletePrompt, toast, updateSettings, gens } = useApp();
  const { pending, retryUpload, dismissUpload } = useUploads();
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [enh, setEnh] = useState(false);
  const [undo, setUndo] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [newProj, setNewProj] = useState<string | null>(null);
  const savedRef = useOutside(saved, () => setSaved(false));

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    const min = parseFloat(getComputedStyle(el).minHeight) || 96;
    el.style.height = Math.min(window.innerWidth < 700 ? 240 : 360, Math.max(min, el.scrollHeight)) + "px";
  }, [draft.prompt]);

  const size = sizeFor(draft.aspect, draft.tier);
  const est = useMemo(() => estimateCost({ quality: draft.quality, w: size.w, h: size.h, n: draft.n, refs: draft.refs.length, promptChars: draft.prompt.length, calibration: usage?.calibration }), [draft.quality, size.w, size.h, draft.n, draft.refs.length, draft.prompt.length, usage?.calibration]);
  const b = usage?.budget;
  const left = b && b.monthlyUsd > 0 && usage ? b.monthlyUsd - usage.spent : null;
  const over = !demo && b?.enforce && left != null && est.usd > left;
  const warn = !demo && b && left != null && b.monthlyUsd > 0 && usage!.spent / b.monthlyUsd >= b.warnPct / 100;
  const editing = !!draft.parentId && draft.refs.length > 0;
  // "Previously uploaded" tray: everything you've uploaded (plus references you just took off that weren't uploads)
  // that isn't currently attached. Tapping one flies it into the references; removing a reference flies it back.
  const [shelf, setShelf] = useState<RefItem[]>([]);
  const [arm, setArm] = useState<string | null>(null);
  useEffect(() => {
    if (!arm) return;
    const t = setTimeout(() => setArm(null), 2600);
    return () => clearTimeout(t);
  }, [arm]);
  const tray = useMemo(() => {
    const attached = new Set(draft.refs.map((r) => r.id));
    const fromAssets: RefItem[] = assets.map((a) => ({ id: a.id, name: a.name, kind: a.brand ? "brand" : "upload" }));
    const known = new Set(fromAssets.map((x) => x.id));
    return [...shelf.filter((x) => !known.has(x.id)), ...fromAssets].filter((x) => !attached.has(x.id));
  }, [assets, shelf, draft.refs]);
  const assetIds = useMemo(() => new Set(assets.map((a) => a.id)), [assets]);
  const vtn = (id: string) => `v-${id}`;
  const running = gens.filter((g) => g.status === "running").length;
  const room = 16 - draft.refs.length - pending.filter((p) => p.stage !== "error").length;
  function addRefs(items: RefItem[]) {
    const take = items.slice(0, Math.max(0, room));
    if (!take.length) return toast("You can use up to 16 reference images.", "error");
    if (take.length < items.length) toast(`Added ${take.length} — the limit is 16 references.`);
    try {
      navigator.vibrate?.(8);
    } catch {}
    morph(() => setDraft((d) => ({ refs: [...d.refs, ...take.filter((t) => !d.refs.some((r) => r.id === t.id))].slice(0, 16) })));
  }
  function removeRef(r: RefItem) {
    morph(() => {
      if (!assetIds.has(r.id)) setShelf((s) => [r, ...s.filter((x) => x.id !== r.id)].slice(0, 8));
      setDraft((d) => ({ refs: d.refs.filter((x) => x.id !== r.id), ...(d.refs.length === 1 ? { parentId: undefined, preserve: false } : {}) }));
    });
  }
  const moving = pending.filter((p) => p.stage !== "error" && p.stage !== "done");
  const failed = pending.filter((p) => p.stage === "error").length;
  const upPct = moving.length ? Math.round((moving.reduce((s, p) => s + (p.stage === "uploading" ? p.pct : p.stage === "processing" ? 1 : 0), 0) / moving.length) * 100) : 0;

  async function enhance() {
    if (draft.prompt.trim().length < 3) return toast("Type a few words first, then enhance.", "error");
    setEnh(true);
    try {
      const r = await api<{ prompt: string; source: string }>("/api/enhance", { json: { prompt: draft.prompt, presetId: draft.presetId } });
      setUndo(draft.prompt);
      setDraft({ prompt: r.prompt });
      toast(r.source === "openai" ? "Prompt enhanced." : "Prompt enhanced with the built-in enhancer.", "ok");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not enhance the prompt.", "error");
    } finally {
      setEnh(false);
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (files.length) {
      e.preventDefault();
      uploadFiles(files);
    }
  }

  return (
    <section className="composer" aria-label="Create an image">
      <div className="step">
        <div className="step-head">
          <label htmlFor="prompt" className="eyebrow"><i>1</i> {editing ? "Describe the edit" : "Describe"}</label>
          <div className="row gap6">
            {undo !== null && (
              <button className="btn quiet sm" onClick={() => { setDraft({ prompt: undo }); setUndo(null); }}><Undo2 size={14} /> Undo</button>
            )}
            <button className="btn quiet sm" onClick={enhance} disabled={enh} title="Rewrite your prompt with richer detail"><>{enh ? <Loader2 className="spin" size={14} /> : <WandSparkles size={14} />}</> Enhance</button>
            <div className="menu-wrap" ref={savedRef}>
              <button className="btn quiet sm" onClick={() => setSaved((s) => !s)} aria-haspopup="menu" aria-expanded={saved}><Bookmark size={14} /> Saved{prompts.length ? ` · ${prompts.length}` : ""}</button>
              {saved && (
                <div className="menu wide" role="menu">
                  <button className="menu-item" disabled={!draft.prompt.trim()} onClick={() => { savePrompt(draft.prompt); setSaved(false); }}>
                    <span><BookmarkPlus size={14} /> Save current prompt</span>
                  </button>
                  {prompts.length === 0 && <p className="menu-empty">Saved prompts appear here so you can reuse them in one click.</p>}
                  {prompts.map((p) => (
                    <div key={p.id} className="menu-row">
                      <button className="menu-item" onClick={() => { setDraft({ prompt: p.text }); setSaved(false); }}><span className="clamp1">{p.title}</span></button>
                      <button className="icon-btn sm" aria-label={`Delete saved prompt ${p.title}`} onClick={() => deletePrompt(p.id)}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="prompt-wrap">
        <textarea
          id="prompt"
          ref={ta}
          className="prompt"
          value={draft.prompt}
          placeholder={editing ? "e.g. Change the background to a sunset beach. Keep the person and outfit exactly the same." : "Describe the image you want — subject, setting, light, mood, any text to include…"}
          onChange={(e) => setDraft({ prompt: e.target.value })}
          onPaste={onPaste}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && draft.prompt.trim()) submit();
          }}
        />
        {draft.prompt.length > 0 && <span className="prompt-count mono" aria-hidden>{draft.prompt.length.toLocaleString()}</span>}
        </div>
        <div className="presets" role="group" aria-label="Presets">
          {PRESETS.map((p) => {
            const Icon = PRESET_ICONS[p.icon];
            return (
              <button key={p.id} type="button" className={`chip${draft.presetId === p.id ? " on" : ""}`} aria-pressed={draft.presetId === p.id} onClick={() => applyPreset(draft, setDraft, p)} title={p.blurb}>
                <Icon size={15} /> {p.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="step">
        <div className="step-head">
          <span className="eyebrow"><i>2</i> {editing ? "Image to edit & references" : "References"} <em>optional</em></span>
          {moving.length > 0 ? (
            <span className="up-sum tiny" role="status" aria-live="polite"><i className="up-dot" /> Uploading {moving.length} · {upPct}%</span>
          ) : failed > 0 ? (
            <span className="up-sum tiny err" role="status">{failed} failed — tap to retry</span>
          ) : (
            <span className="muted tiny">{draft.refs.length}/16</span>
          )}
        </div>
        <div
          className={`drop${drag ? " over" : ""}${draft.refs.length || pending.length ? " has" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); uploadFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"))); }}
        >
          {(draft.refs.length > 0 || pending.length > 0) && (
            <ul className="refs">
              {draft.refs.map((r, i) => (
                <li key={r.id} style={{ viewTransitionName: vtn(r.id) }}>
                  <Thumb id={r.id} alt={r.name} />
                  {i === 0 && editing && <span className="ref-badge">Editing</span>}
                  {r.kind === "brand" && <span className="ref-badge brand">97</span>}
                  <button className="ref-x" aria-label={`Remove ${r.name}`} onClick={() => removeRef(r)}><X size={12} /></button>
                </li>
              ))}
              {pending.map((u) => <UploadTile key={u.key} u={u} onRetry={() => retryUpload(u.key)} onRemove={() => dismissUpload(u.key)} />)}
            </ul>
          )}
          <button type="button" className="drop-btn" onClick={() => fileIn.current?.click()}>
            <Upload size={18} />
            <span><b>Upload images</b> or drop them here</span>
            <em>PNG · JPEG · WebP · paste works too</em>
          </button>
          <input ref={fileIn} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { const el = e.target; const picked = Array.from(el.files || []); uploadFiles(picked).finally(() => { el.value = ""; }); }} />
        </div>
        <div className="row gap8 wrap">
          <button className="btn quiet sm" onClick={addBrandRef} title="Adds the official THE 97 logo so the model uses the real artwork"><Stamp size={14} /> Add official 97 logo</button>
        </div>
        {tray.length > 0 && (
          <div className="tray" role="group" aria-label="Previously uploaded images">
            <div className="tray-head">
              <span className="tray-title"><HistoryIcon size={13} /> Previously uploaded <em className="mono">{tray.length}</em></span>
              {tray.length > 1 && room > 0 && <button type="button" className="tray-all" onClick={() => addRefs(tray)}><Plus size={13} /> Add all</button>}
            </div>
            <ul className="tray-strip">
              {tray.map((t) => (
                <li key={t.id} className="tray-item" style={{ viewTransitionName: vtn(t.id) }}>
                  <button type="button" className="tray-add" onClick={() => addRefs([t])} disabled={room <= 0} aria-label={`Add ${t.name} to references`} title={room <= 0 ? "16 references is the maximum" : `Add ${t.name}`}>
                    <Thumb id={t.id} alt="" />
                    <span className="tray-plus" aria-hidden><Plus size={18} strokeWidth={2.4} /></span>
                    {t.kind === "brand" && <span className="ref-badge brand">97</span>}
                  </button>
                  {assetIds.has(t.id) && (
                    <button type="button" className={`tray-del${arm === t.id ? " arm" : ""}`} aria-label={arm === t.id ? `Confirm: delete ${t.name} permanently` : `Delete ${t.name} from your uploads`} onClick={() => { if (arm === t.id) { setArm(null); removeAsset(t.id); } else setArm(t.id); }}>
                      {arm === t.id ? <Check size={11} strokeWidth={3} /> : <X size={11} />}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {draft.refs.length > 0 && (
          <Toggle checked={draft.preserve} onChange={(v) => setDraft({ preserve: v })} label="Preserve everything else" hint="Only change what you describe; keep subject, layout, colours and text" />
        )}
      </div>

      <div className="step">
        <div className="step-head"><span className="eyebrow"><i>3</i> Format</span><span className="muted tiny mono">{size.auto ? "auto size" : `${size.w}×${size.h}`}</span></div>
        <div className="aspects" role="radiogroup" aria-label="Aspect ratio">
          {ASPECTS.map((a) => {
            const r = a.w / a.h;
            const w = r >= 1 ? 22 : Math.round(22 * r);
            const h = r >= 1 ? Math.round(22 / r) : 22;
            return (
              <button key={a.id} role="radio" aria-checked={draft.aspect === a.id} className={`aspect${draft.aspect === a.id ? " on" : ""}`} onClick={() => setDraft({ aspect: a.id })} title={a.use}>
                <span className="glyph"><i style={a.id === "auto" ? undefined : { width: w, height: h }} className={a.id === "auto" ? "auto" : ""} /></span>
                <b>{a.id === "auto" ? "Auto" : a.id}</b>
                <em>{a.label}</em>
              </button>
            );
          })}
        </div>
        <div className="models" role="radiogroup" aria-label="Model">
          {MODELS.map((m) => (
            <button key={m.id} role="radio" aria-checked={draft.model === m.id} className={`model${draft.model === m.id ? " on" : ""}`} onClick={() => setDraft({ model: m.id })}>
              <b>{m.name}</b><span className="tag">{m.tag}</span>
              <em>{m.blurb}</em>
            </button>
          ))}
        </div>
      </div>

      <details className="adv">
        <summary><span>Advanced settings</span><ChevronDown size={16} /></summary>
        <div className="adv-body">
          <div className="field-row"><label>Quality</label><Segmented small label="Quality" value={draft.quality} options={QUALITIES.map((q) => ({ id: q.id, label: q.label, hint: q.blurb }))} onChange={(v) => setDraft({ quality: v })} /></div>
          <div className="field-row"><label>Resolution</label><Segmented small label="Resolution" value={draft.tier} options={TIERS.map((t) => ({ id: t.id, label: t.label, hint: t.blurb }))} onChange={(v) => setDraft({ tier: v })} /></div>
          <div className="field-row"><label>Complexity</label><Segmented small label="Complexity" value={draft.complexity} options={COMPLEXITIES} onChange={(v) => setDraft({ complexity: v })} /></div>
          <div className="field-row"><label>Images</label><Segmented small label="Number of images" value={String(draft.n)} options={[1, 2, 3, 4].map((n) => ({ id: String(n), label: String(n) }))} onChange={(v) => setDraft({ n: Number(v) })} /></div>
          <div className="field-row"><label>File</label><Segmented small label="File format" value={draft.format} options={FORMATS} onChange={(v) => setDraft({ format: v })} /></div>
          <Toggle checked={draft.transparent} onChange={(v) => setDraft({ transparent: v, ...(v && draft.format === "jpeg" ? { format: "png" as const } : {}) })} label="Transparent background" hint="Saved as PNG/WebP" />
          <div className="field-row">
            <label>Project</label>
            {newProj === null ? (
              <div className="row gap6">
                <select className="select" value={draft.projectId} onChange={(e) => setDraft({ projectId: e.target.value })} aria-label="Project">
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className="icon-btn sm" aria-label="New project" onClick={() => setNewProj("")}><Plus size={15} /></button>
              </div>
            ) : (
              <form className="row gap6" onSubmit={async (e) => { e.preventDefault(); const p = await createProject(newProj); if (p) setDraft({ projectId: p.id }); setNewProj(null); }}>
                <input className="input" autoFocus placeholder="Project name" value={newProj} onChange={(e) => setNewProj(e.target.value)} />
                <button className="icon-btn sm" aria-label="Create project"><Check size={15} /></button>
                <button type="button" className="icon-btn sm" aria-label="Cancel" onClick={() => setNewProj(null)}><X size={15} /></button>
              </form>
            )}
          </div>
          <button className="btn quiet sm" onClick={() => { updateSettings({ model: draft.model, quality: draft.quality, complexity: draft.complexity, aspect: draft.aspect, tier: draft.tier, format: draft.format }); toast("Saved as your defaults.", "ok"); }}>Save these as my defaults</button>
        </div>
      </details>

      <div className={`gen-bar${running ? " busy" : ""}`}>
        <div className="gen-est" aria-live="polite">
          {demo ? (
            <span><b>Free</b> · demo mode</span>
          ) : (
            <span title={est.calibrated ? "Estimate calibrated from your real past generations" : "Starting estimate — refines itself after your first real generations"}>
              <b className="mono">≈ {fmtUsd(est.usd)}</b> <em>estimate{est.calibrated ? " · calibrated" : ""}</em>
            </span>
          )}
          <span className="muted tiny">{draft.n} image{draft.n > 1 ? "s" : ""} · {MODELS.find((m) => m.id === draft.model)?.name} · {QUALITIES.find((q) => q.id === draft.quality)?.label}</span>
        </div>
        {over && <p className="gen-note danger"><Info size={14} /> This would go over your monthly budget. Lower quality/size or raise the limit in Account.</p>}
        {!over && warn && <p className="gen-note warn"><Info size={14} /> You’ve used {Math.round((usage!.spent / b!.monthlyUsd) * 100)}% of your monthly budget.</p>}
        <button className="btn primary xl" disabled={submitting || !draft.prompt.trim()} onClick={() => submit()}>
          {submitting ? <><Loader2 className="spin" size={20} /> Starting…</> : <>Generate Image <ArrowRight className="go-arrow" size={20} /></>}
        </button>
        <p className="muted tiny center gen-hint">{!draft.prompt.trim() ? "Describe your image to begin" : running ? `${running} rendering · you can keep creating` : "Ctrl / ⌘ + Enter to generate"}</p>
      </div>
    </section>
  );
}
