"use client";
import { useState } from "react";
import { Columns2, Copy, FolderInput, Pencil, RefreshCw, Star, Trash2 } from "lucide-react";
import type { Gen } from "@/lib/types";
import { useApp } from "./AppProvider";
import { CompareSlider, DownloadMenu, Modal, SmartImg, Thumb } from "./ui";
import { fmtDate, fmtTime } from "@/lib/client";
import { fmtUsd } from "@/lib/pricing";
import { MODELS, QUALITIES } from "@/lib/models";

export function Lightbox({ gen, imageId, onClose, onEdit }: { gen: Gen; imageId: string; onClose: () => void; onEdit?: (gen: Gen, imageId: string) => void }) {
  const { patchGen, deleteGen, editImage, reuse, projects, toast, settings, setDraft, submit } = useApp();
  const [cmp, setCmp] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const img = gen.images.find((i) => i.id === imageId) || gen.images[0];
  if (!img) return null;
  const parentRef = gen.input.refs[0];
  const model = MODELS.find((m) => m.id === gen.input.model)?.name || gen.input.model;
  const q = QUALITIES.find((x) => x.id === gen.input.quality)?.label || gen.input.quality;
  const project = projects.find((p) => p.id === gen.input.projectId);
  return (
    <Modal onClose={onClose} label="Image details">
      <div className="lb">
        <div className="lb-view">
          {cmp && parentRef ? <CompareSlider before={parentRef} after={img.id} ratio={`${img.width}/${img.height}`} beforeLabel="Original" afterLabel="Result" /> : <SmartImg id={img.id} alt={gen.input.prompt} w={img.width} h={img.height} eager className="lb-img" />}
        </div>
        <aside className="lb-side">
          <div className="lb-actions">
            <DownloadMenu imageId={img.id} ext={img.ext} primary />
            <button className="btn ghost" onClick={() => { (onEdit ?? editImage)(gen, img.id); onClose(); }}><Pencil size={16} /> Edit</button>
            <button className={`icon-btn${gen.favorite ? " on" : ""}`} aria-pressed={gen.favorite} aria-label={gen.favorite ? "Remove favourite" : "Add to favourites"} onClick={() => patchGen(gen.id, { favorite: !gen.favorite })}><Star size={18} fill={gen.favorite ? "currentColor" : "none"} /></button>
          </div>
          <div className="lb-block">
            <div className="lb-label">Prompt</div>
            <p className="lb-prompt">{gen.input.prompt}</p>
            <div className="row gap8 wrap">
              <button className="btn quiet sm" onClick={() => { navigator.clipboard?.writeText(gen.input.prompt); toast("Prompt copied.", "ok"); }}><Copy size={14} /> Copy</button>
              <button className="btn quiet sm" onClick={() => { reuse(gen); onClose(); }}><RefreshCw size={14} /> Reuse settings</button>
              <button className="btn quiet sm" onClick={async () => { setDraft({}); await submit({ ...gen.input }); onClose(); }}><RefreshCw size={14} /> Regenerate</button>
            </div>
          </div>
          <dl className="lb-meta">
            <div><dt>Model</dt><dd>{model}</dd></div>
            <div><dt>Quality</dt><dd>{q}{gen.input.complexity ? ` · ${gen.input.complexity} complexity` : ""}</dd></div>
            <div><dt>Size</dt><dd>{img.width}×{img.height}</dd></div>
            <div><dt>Created</dt><dd>{fmtDate(gen.createdAt)}{gen.durationMs ? ` · ${fmtTime(gen.durationMs)}` : ""}</dd></div>
            <div><dt>Cost</dt><dd>{gen.demo ? "Demo · not charged" : gen.costActual != null ? `${fmtUsd(gen.costActual)} (measured)` : `≈ ${fmtUsd(gen.costEstimate)} (estimate)`}</dd></div>
          </dl>
          {parentRef && (
            <div className="lb-block">
              <div className="lb-label">References used ({gen.input.refs.length})</div>
              <div className="lb-refs">{gen.input.refs.map((r) => <Thumb key={r} id={r} />)}</div>
              <button className={`btn ${cmp ? "primary" : "ghost"} sm`} onClick={() => setCmp((c) => !c)}><Columns2 size={14} /> {cmp ? "Show result" : "Before / after"}</button>
            </div>
          )}
          <div className="lb-block">
            <div className="lb-label">Project</div>
            <label className="select-wrap">
              <FolderInput size={15} />
              <select value={gen.input.projectId} onChange={(e) => patchGen(gen.id, { projectId: e.target.value })} aria-label="Move to project">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            {project && <span className="muted tiny">Currently in “{project.name}”</span>}
          </div>
          <div className="lb-danger">
            {confirm ? (
              <>
                <span>Delete this generation permanently?</span>
                <button className="btn danger sm" onClick={() => { deleteGen(gen.id); onClose(); }}>Delete</button>
                <button className="btn quiet sm" onClick={() => setConfirm(false)}>Keep</button>
              </>
            ) : (
              <button className="btn quiet sm" onClick={() => setConfirm(true)}><Trash2 size={14} /> Delete</button>
            )}
          </div>
          {settings.watermark.enabled && <p className="muted tiny">Watermark on exports is on in Settings.</p>}
        </aside>
      </div>
    </Modal>
  );
}
