"use client";
import { useEffect, useState } from "react";
import { AlertCircle, Archive, Check, Copy, Download, Loader2, Pencil, RefreshCw, Square, Star } from "lucide-react";
import { useApp } from "../AppProvider";
import { Logo } from "../Logo";
import { Thumb } from "../ui";
import { dlUrl, fmtTime } from "@/lib/client";
import { EFFORTS, PROMPT_MODELS } from "@/lib/models";
import { sizeFor } from "@/lib/sizes";
import type { Gen, Msg } from "@/lib/types";

export type MsgHandlers = {
  onOpen: (gen: Gen, imageId: string) => void;
  onAttach: (imageId: string) => void;
  onRetry: (m: Msg) => void;
  onStop: (m: Msg) => void;
  onEditPrompt: (text: string) => void;
};

function useNow(on: boolean, every = 500) {
  const [n, setN] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setN(Date.now());
    const t = setInterval(() => setN(Date.now()), every);
    return () => clearInterval(t);
  }, [on, every]);
  return n;
}

const effortLabel = (id?: string) => EFFORTS.find((e) => e.id === id)?.label || id || "";

function Think({ msg, onStop }: { msg: Msg; onStop: () => void }) {
  const now = useNow(true, 400);
  const sec = Math.max(0, Math.round((now - new Date(msg.createdAt).getTime()) / 1000));
  return (
    <div className="m-think" role="status" aria-live="polite">
      <span className="dots" aria-hidden><i /><i /><i /></span>
      <span>Thinking</span>
      <em>{effortLabel(msg.effort)} effort</em>
      <span className="mono m-sec">{sec}s</span>
      <button className="m-stop" onClick={onStop} aria-label="Stop"><Square size={11} fill="currentColor" /> Stop</button>
    </div>
  );
}

function DoneTile({ gen, id, w, h, onOpen, onAttach }: { gen: Gen; id: string; w: number; h: number; onOpen: () => void; onAttach: () => void }) {
  const { patchGen } = useApp();
  return (
    <div className="btile" style={{ aspectRatio: `${w || 1}/${h || 1}` }}>
      <button className="btile-open" onClick={onOpen} aria-label={`Open image: ${gen.input.prompt.slice(0, 60)}`}>
        <Thumb id={id} alt={gen.input.prompt.slice(0, 120)} />
      </button>
      <div className="btile-actions">
        <button className={gen.favorite ? "on" : ""} aria-pressed={gen.favorite} aria-label={gen.favorite ? "Remove favourite" : "Add to favourites"} onClick={() => patchGen(gen.id, { favorite: !gen.favorite })}><Star size={14} fill={gen.favorite ? "currentColor" : "none"} /></button>
        <a href={dlUrl(id)} download aria-label="Download"><Download size={14} /></a>
        <button aria-label="Edit this image in the chat" title="Edit this image" onClick={onAttach}><Pencil size={14} /></button>
      </div>
    </div>
  );
}

function WaitTile({ state, error, ratio }: { state: string; error?: string; ratio: number }) {
  const bad = state === "error" || state === "cancelled";
  return (
    <div className={`btile wait${bad ? " bad" : ""}`} style={{ aspectRatio: String(ratio) }} title={error}>
      {!bad && <span className="shimmer" aria-hidden />}
      <span className="btile-state">
        {bad ? <AlertCircle size={16} /> : state === "pending" || state === "queued" ? <span className="pip" /> : <Loader2 className="spin" size={16} />}
        <b>{state === "pending" || state === "queued" ? "Queued" : state === "error" ? "Failed" : state === "cancelled" ? "Stopped" : state === "saving" ? "Saving" : state === "preparing" ? "Preparing" : "Rendering"}</b>
      </span>
    </div>
  );
}

function Batch({ msg, gens, ratio, h }: { msg: Msg; gens: Record<string, Gen>; ratio: number; h: MsgHandlers }) {
  const items = msg.items || [];
  const total = msg.plan?.count ?? items.reduce((s, i) => s + i.n, 0);
  const done = items.reduce((s, i) => s + (i.status === "done" ? (gens[i.genId || ""]?.images.length ?? i.n) : 0), 0);
  const working = msg.status === "working";
  const tiles: React.ReactNode[] = [];
  items.forEach((it, i) => {
    const gen = it.genId ? gens[it.genId] : undefined;
    if (gen?.status === "done" && gen.images.length) {
      for (const img of gen.images) tiles.push(<DoneTile key={img.id} gen={gen} id={img.id} w={img.width} h={img.height} onOpen={() => h.onOpen(gen, img.id)} onAttach={() => h.onAttach(img.id)} />);
    } else {
      const st = it.status === "running" ? gen?.phase || "rendering" : it.status;
      for (let k = 0; k < it.n; k++) tiles.push(<WaitTile key={`${i}-${k}`} state={st} error={it.error} ratio={ratio} />);
    }
  });
  const dens = total <= 1 ? "n1" : total <= 4 ? "n4" : total <= 12 ? "n12" : "nmany";
  return (
    <div className="batch">
      {total > 1 && (
        <div className="batch-head">
          <b>{total} images</b>
          <span className="mono">{done}/{total}</span>
          {working && <div className="batch-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}><i style={{ transform: `scaleX(${total ? done / total : 0})` }} /></div>}
        </div>
      )}
      <div className={`bgrid ${dens}`}>{tiles}</div>
    </div>
  );
}

export function MessageView({ msg, prev, gens, last, h }: { msg: Msg; prev?: Msg; gens: Record<string, Gen>; last: boolean; h: MsgHandlers }) {
  const { toast } = useApp();
  const [copied, setCopied] = useState(false);

  if (msg.role === "user") {
    return (
      <div className="m m-user">
        <div className="bubble">
          {!!msg.refs?.length && <div className={`m-refs n${Math.min(msg.refs.length, 4)}`}>{msg.refs.map((r) => <Thumb key={r} id={r} alt="Attached image" />)}</div>}
          {msg.text && <p>{msg.text}</p>}
        </div>
        {msg.text && (
          <button className="m-mini" aria-label="Copy message" onClick={() => { navigator.clipboard?.writeText(msg.text); toast("Copied.", "ok"); }}><Copy size={13} /></button>
        )}
      </div>
    );
  }

  const tier = prev?.opts?.tier || "standard";
  const sz = sizeFor(msg.plan?.aspect || "1:1", tier);
  const ratio = sz.auto ? 1 : sz.w / sz.h;
  const ids = (msg.items || []).flatMap((i) => gens[i.genId || ""]?.images.map((x) => x.id) ?? []);
  const active = msg.status === "thinking" || msg.status === "working";
  const model = PROMPT_MODELS.find((m) => m.id === msg.model)?.name || msg.model;
  const copyPrompt = () => {
    navigator.clipboard?.writeText(msg.plan?.prompts?.join("\n\n") || msg.plan?.prompt || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="m m-ai">
      <span className="avatar" aria-hidden><Logo height={15} /></span>
      <div className="m-body">
        {msg.status === "thinking" && <Think msg={msg} onStop={() => h.onStop(msg)} />}
        {msg.text && <p className="m-text">{msg.text}</p>}
        {!!msg.items?.length && <Batch msg={msg} gens={gens} ratio={ratio} h={h} />}
        {msg.status === "working" && (
          <button className="m-stop solo" onClick={() => h.onStop(msg)}><Square size={11} fill="currentColor" /> Stop</button>
        )}
        {(msg.status === "error" || (msg.status === "cancelled" && msg.error)) && msg.error && (
          <div className={`m-err${msg.status === "cancelled" ? " soft" : ""}`} role="alert">
            <AlertCircle size={16} />
            <div>
              <p>{msg.error}</p>
              {msg.errorDetail && <details><summary>Technical details</summary><code>{msg.errorDetail}</code></details>}
            </div>
          </div>
        )}
        {msg.status === "done" && msg.error && <p className="m-warn tiny">{msg.error}</p>}
        {!active && (
          <div className="m-foot">
            {msg.plan && (
              <button className="m-act" onClick={copyPrompt}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy prompt"}</button>
            )}
            {ids.length > 1 && <a className="m-act" href={`/api/export?ids=${ids.join(",")}&format=original&wm=0`} download><Archive size={14} /> Download all</a>}
            {last && <button className="m-act" onClick={() => h.onRetry(msg)}><RefreshCw size={14} /> {msg.status === "error" ? "Retry" : "Regenerate"}</button>}
            {prev?.text && msg.status === "error" && <button className="m-act" onClick={() => h.onEditPrompt(prev.text)}><Pencil size={14} /> Edit message</button>}
            <span className="m-meta mono">{[model, effortLabel(msg.effort), msg.thinkingMs ? `${fmtTime(msg.thinkingMs)} thinking` : ""].filter(Boolean).join(" · ")}</span>
          </div>
        )}
        {!active && msg.plan && (
          <details className="m-prompt">
            <summary>Prompt used{msg.plan.prompts ? ` · ${msg.plan.prompts.length} prompts` : ""}</summary>
            {msg.plan.prompts ? <ol>{msg.plan.prompts.map((p, i) => <li key={i}>{p}</li>)}</ol> : <pre>{msg.plan.prompt}</pre>}
            <p className="tiny muted">{msg.plan.aspect} · {msg.plan.count} image{msg.plan.count === 1 ? "" : "s"}{msg.plan.preserve ? " · edit (preserve the rest)" : ""}{msg.plan.refs.length ? ` · ${msg.plan.refs.length} reference${msg.plan.refs.length === 1 ? "" : "s"}` : ""}</p>
          </details>
        )}
      </div>
    </div>
  );
}
