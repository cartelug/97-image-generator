"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Brain, Check, ChevronDown, FolderOpen, Minus, Paperclip, Plus, SlidersHorizontal, Square, X } from "lucide-react";
import { useApp, useUploads } from "../AppProvider";
import { Segmented, Thumb, Toggle, useOutside } from "../ui";
import { UploadTile } from "../studio/Composer";
import { EFFORTS, FORMATS, MODELS, QUALITIES } from "@/lib/models";
import { ASPECTS, TIERS } from "@/lib/sizes";
import type { ChatOpts, Settings } from "@/lib/types";

const KEY = "97ig.chat.opts.v1";

function initOpts(s: Settings): ChatOpts {
  const base: ChatOpts = { model: s.model, aspect: "ai", tier: s.tier, quality: s.quality, format: s.format, transparent: false, count: "auto", effort: s.effort };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && typeof saved === "object") return { ...base, ...saved };
  } catch {}
  return base;
}

export function ChatComposer({ text, setText, busy, onSend, onStop, focusTick }: { text: string; setText: (t: string) => void; busy: boolean; onSend: (text: string, refs: string[], opts: ChatOpts) => Promise<boolean>; onStop: () => void; focusTick: number }) {
  const { settings, assets, gens, chatRefs, setChatRefs, uploadFiles, maxBatch, toast, updateSettings } = useApp();
  const { pending: allPending, retryUpload, dismissUpload } = useUploads();
  const pending = useMemo(() => allPending.filter((p) => p.dest === "chat"), [allPending]);
  const [opts, setOpts] = useState<ChatOpts>(() => initOpts(settings));
  const [sending, setSending] = useState(false);
  const [drag, setDrag] = useState(false);
  const [menu, setMenu] = useState<"" | "effort" | "opts" | "lib">("");
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const close = () => setMenu("");
  const effortRef = useOutside(menu === "effort", close);
  const optsRef = useOutside(menu === "opts", close);
  const libRef = useOutside(menu === "lib", close);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(opts));
    } catch {}
  }, [opts]);
  const set = (p: Partial<ChatOpts>) => setOpts((o) => ({ ...o, ...p }));

  // grow with the text (no length limit — the box just scrolls after a point)
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(window.innerWidth < 700 ? 180 : 280, Math.max(24, el.scrollHeight)) + "px";
  }, [text]);
  useEffect(() => {
    if (focusTick) ta.current?.focus();
  }, [focusTick]);

  const moving = pending.filter((p) => p.stage !== "error" && p.stage !== "done");
  const canSend = !busy && !sending && moving.length === 0 && (text.trim().length > 0 || chatRefs.length > 0);

  async function submit() {
    if (!canSend) return;
    setSending(true);
    try {
      const ok = await onSend(text.trim(), chatRefs.map((r) => r.id), opts);
      if (ok) {
        setText("");
        setChatRefs([]);
      }
    } finally {
      setSending(false);
    }
  }

  const library = useMemo(() => {
    const used = new Set(chatRefs.map((r) => r.id));
    const up = assets.filter((a) => !used.has(a.id)).slice(0, 12).map((a) => ({ id: a.id, name: a.name, kind: a.brand ? ("brand" as const) : ("upload" as const) }));
    const made = gens
      .filter((g) => g.status === "done")
      .flatMap((g) => g.images.map((i) => i.id))
      .filter((id) => !used.has(id))
      .slice(0, 12)
      .map((id) => ({ id, name: "Earlier image", kind: "result" as const }));
    return { up, made };
  }, [assets, gens, chatRefs]);

  const addRef = (r: { id: string; name: string; kind: "upload" | "result" | "brand" }) => {
    if (chatRefs.length + moving.length >= 16) return toast("You can attach up to 16 images.", "error");
    setChatRefs((l) => (l.some((x) => x.id === r.id) ? l : [...l, r]));
  };

  const effort = EFFORTS.find((e) => e.id === opts.effort) || EFFORTS[2];
  const countLabel = opts.count === "auto" ? "Count from prompt" : `${opts.count} image${opts.count === 1 ? "" : "s"}`;
  const aspectLabel = opts.aspect === "ai" ? "AI picks shape" : opts.aspect === "auto" ? "Auto shape" : opts.aspect;

  return (
    <div
      className={`cc${drag ? " over" : ""}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); uploadFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/")), "chat"); }}
    >
      {(chatRefs.length > 0 || pending.length > 0) && (
        <ul className="cc-refs" aria-label="Attached images">
          {chatRefs.map((r) => (
            <li key={r.id} className="cc-ref">
              <Thumb id={r.id} alt={r.name} />
              <button className="ref-x" aria-label={`Remove ${r.name}`} onClick={() => setChatRefs((l) => l.filter((x) => x.id !== r.id))}><X size={12} /></button>
            </li>
          ))}
          {pending.map((u) => <UploadTile key={u.key} u={u} onRetry={() => retryUpload(u.key)} onRemove={() => dismissUpload(u.key)} />)}
        </ul>
      )}
      <textarea
        ref={ta}
        className="cc-input"
        rows={1}
        value={text}
        placeholder={chatRefs.length ? "Describe the change, or what to make with these images…" : "Message 97…  e.g. “make 12 logo variations for a coffee brand”"}
        aria-label="Message"
        onChange={(e) => setText(e.target.value)}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
          if (files.length) { e.preventDefault(); uploadFiles(files, "chat"); }
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
          const fine = window.matchMedia("(pointer: fine)").matches;
          if (fine || e.metaKey || e.ctrlKey) { e.preventDefault(); submit(); }
        }}
      />
      <div className="cc-bar">
        <div className="cc-left">
          <button className="cc-icon" aria-label="Attach images" title="Attach images" onClick={() => fileIn.current?.click()}><Paperclip size={18} /></button>
          <input ref={fileIn} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { const el = e.target; const picked = Array.from(el.files || []); uploadFiles(picked, "chat").finally(() => { el.value = ""; }); }} />
          <div className="menu-wrap" ref={libRef}>
            <button className="cc-icon" aria-label="Add from your library" title="Add from your uploads and earlier images" aria-haspopup="dialog" aria-expanded={menu === "lib"} onClick={() => setMenu(menu === "lib" ? "" : "lib")}><FolderOpen size={18} /></button>
            {menu === "lib" && (
              <div className="cc-pop lib" role="dialog" aria-label="Your library">
                {!library.up.length && !library.made.length && <p className="muted tiny">Images you upload or generate show up here so you can reuse them.</p>}
                {library.up.length > 0 && <><h3>Your uploads</h3><ul>{library.up.map((r) => <li key={r.id}><button onClick={() => addRef(r)} aria-label={`Attach ${r.name}`}><Thumb id={r.id} alt="" /><span><Plus size={16} /></span></button></li>)}</ul></>}
                {library.made.length > 0 && <><h3>Earlier results</h3><ul>{library.made.map((r) => <li key={r.id}><button onClick={() => addRef(r)} aria-label="Attach earlier image"><Thumb id={r.id} alt="" /><span><Plus size={16} /></span></button></li>)}</ul></>}
              </div>
            )}
          </div>
          <div className="menu-wrap" ref={effortRef}>
            <button className="cc-pill" aria-haspopup="menu" aria-expanded={menu === "effort"} onClick={() => setMenu(menu === "effort" ? "" : "effort")} title="How hard GPT-6.1 Sol thinks before it writes your prompts">
              <Brain size={14} /> <span>{effort.short}</span> <ChevronDown size={13} />
            </button>
            {menu === "effort" && (
              <div className="cc-pop effort" role="menu" aria-label="Thinking effort">
                <h3>GPT-6.1 Sol · thinking effort</h3>
                {EFFORTS.map((e) => (
                  <button key={e.id} role="menuitemradio" aria-checked={opts.effort === e.id} className={`menu-item${opts.effort === e.id ? " on" : ""}`} onClick={() => { set({ effort: e.id }); close(); }}>
                    <span><b>{e.label}</b><em>{e.blurb}</em></span>
                    {opts.effort === e.id && <Check size={15} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="menu-wrap" ref={optsRef}>
            <button className="cc-pill" aria-haspopup="dialog" aria-expanded={menu === "opts"} onClick={() => setMenu(menu === "opts" ? "" : "opts")}>
              <SlidersHorizontal size={14} /> <span className="cc-sum">{countLabel} · {aspectLabel}</span> <span className="cc-sum-s">Options</span>
            </button>
            {menu === "opts" && (
              <div className="cc-pop opts" role="dialog" aria-label="Image options">
                <div className="field-row"><label>How many</label>
                  <div className="cnt">
                    <Segmented small label="How many images" value={opts.count === "auto" ? "auto" : "fixed"} options={[{ id: "auto", label: "From my message" }, { id: "fixed", label: "Fixed number" }]} onChange={(v) => set({ count: v === "auto" ? "auto" : typeof opts.count === "number" ? opts.count : 4 })} />
                    {opts.count !== "auto" && (
                      <div className="stepper">
                        <button aria-label="Fewer" onClick={() => set({ count: Math.max(1, (opts.count as number) - 1) })}><Minus size={14} /></button>
                        <input type="number" inputMode="numeric" min={1} max={maxBatch} value={opts.count} aria-label="Number of images" onChange={(e) => set({ count: Math.min(maxBatch, Math.max(1, Math.floor(Number(e.target.value)) || 1)) })} />
                        <button aria-label="More" onClick={() => set({ count: Math.min(maxBatch, (opts.count as number) + 1) })}><Plus size={14} /></button>
                      </div>
                    )}
                  </div>
                </div>
                <p className="tiny muted cc-hint">“From my message” reads the number out of what you write, like “make 12 logo variations”. Up to {maxBatch} per message.</p>
                <div className="field-row"><label>Shape</label><Segmented small label="Aspect ratio" value={opts.aspect} options={[{ id: "ai", label: "AI picks" }, ...ASPECTS.map((a) => ({ id: a.id as string, label: a.id === "auto" ? "Auto" : a.id }))]} onChange={(v) => set({ aspect: v })} /></div>
                <div className="field-row"><label>Quality</label><Segmented small label="Quality" value={opts.quality} options={QUALITIES.map((q) => ({ id: q.id, label: q.label, hint: q.blurb }))} onChange={(v) => set({ quality: v })} /></div>
                <div className="field-row"><label>Resolution</label><Segmented small label="Resolution" value={opts.tier} options={TIERS.map((t) => ({ id: t.id as string, label: t.label, hint: t.blurb }))} onChange={(v) => set({ tier: v })} /></div>
                <div className="field-row"><label>Image model</label><Segmented small label="Image model" value={opts.model} options={MODELS.map((m) => ({ id: m.id as string, label: m.name }))} onChange={(v) => set({ model: v })} /></div>
                <div className="field-row"><label>File</label><Segmented small label="File format" value={opts.format} options={FORMATS} onChange={(v) => set({ format: v, ...(v === "jpeg" ? { transparent: false } : {}) })} /></div>
                <Toggle checked={opts.transparent} onChange={(v) => set({ transparent: v, ...(v && opts.format === "jpeg" ? { format: "png" as const } : {}) })} label="Transparent background" hint="Saved as PNG/WebP" />
                <button className="btn quiet sm" onClick={() => { updateSettings({ effort: opts.effort, model: opts.model, quality: opts.quality, tier: opts.tier, format: opts.format }); toast("Saved as your defaults.", "ok"); }}>Save as my defaults</button>
              </div>
            )}
          </div>
        </div>
        {busy ? (
          <button className="cc-send stop" onClick={onStop} aria-label="Stop"><Square size={14} fill="currentColor" /></button>
        ) : (
          <button className="cc-send" disabled={!canSend} onClick={submit} aria-label="Send">{sending ? <span className="spinner-dot" /> : <ArrowUp size={18} strokeWidth={2.4} />}</button>
        )}
      </div>
    </div>
  );
}
