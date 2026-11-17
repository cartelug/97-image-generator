"use client";
import { useApp } from "@/components/AppProvider";
import { Segmented, Toggle } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { COMPLEXITIES, EFFORTS, FORMATS, MODELS, PROMPT_MODELS, QUALITIES } from "@/lib/models";
import { ASPECTS, TIERS } from "@/lib/sizes";
import type { Settings } from "@/lib/types";

const POS: Settings["watermark"]["position"][] = ["top-left", "top-right", "bottom-left", "bottom-right"];

export default function SettingsPage() {
  const { settings: s, updateSettings, toast } = useApp();
  const w = s.watermark;
  const set = (p: Record<string, unknown>) => updateSettings(p);
  return (
    <div className="page settings">
      <div className="page-head">
        <div><h1>Settings</h1><p className="muted">Defaults for every new image, and branded exports.</p></div>
      </div>
      <div className="cards">
        <section className="card">
          <div className="eyebrow">Chat &amp; prompt model</div>
          <div className="field-row"><label>Model</label><Segmented small label="Prompt model" value={s.promptModel} options={[...PROMPT_MODELS.map((m) => ({ id: m.id as string, label: m.name })), ...(PROMPT_MODELS.some((m) => m.id === s.promptModel) ? [] : [{ id: s.promptModel, label: s.promptModel }])]} onChange={(v) => set({ promptModel: v })} /></div>
          <div className="field-row"><label>Effort</label><Segmented small label="Thinking effort" value={s.effort} options={EFFORTS.map((e) => ({ id: e.id, label: e.label, hint: e.blurb }))} onChange={(v) => set({ effort: v })} /></div>
          <p className="muted tiny">GPT-6.1 Sol reads your whole chat and every image, decides how many images to make, and writes the image prompts. Higher effort thinks longer and is more accurate on text, counts and layouts. It also powers Enhance in the Studio.</p>
        </section>

        <section className="card">
          <div className="eyebrow">Generation defaults</div>
          <div className="field-row"><label>Model</label><Segmented small label="Default model" value={s.model} options={MODELS.map((m) => ({ id: m.id, label: m.name }))} onChange={(v) => set({ model: v })} /></div>
          <div className="field-row"><label>Quality</label><Segmented small label="Default quality" value={s.quality} options={QUALITIES.map((q) => ({ id: q.id, label: q.label }))} onChange={(v) => set({ quality: v })} /></div>
          <div className="field-row"><label>Complexity</label><Segmented small label="Default complexity" value={s.complexity} options={COMPLEXITIES} onChange={(v) => set({ complexity: v })} /></div>
          <div className="field-row"><label>Aspect</label><Segmented small label="Default aspect ratio" value={s.aspect} options={ASPECTS.map((a) => ({ id: a.id, label: a.id }))} onChange={(v) => set({ aspect: v })} /></div>
          <div className="field-row"><label>Resolution</label><Segmented small label="Default resolution" value={s.tier} options={TIERS.map((t) => ({ id: t.id, label: t.label }))} onChange={(v) => set({ tier: v })} /></div>
          <div className="field-row"><label>File</label><Segmented small label="Default file format" value={s.format} options={FORMATS} onChange={(v) => set({ format: v })} /></div>
          <p className="muted tiny">New sessions start with these. You can still change anything per image in the Studio.</p>
        </section>

        <section className="card">
          <div className="eyebrow">Branded exports</div>
          <Toggle checked={w.enabled} onChange={(v) => set({ watermark: { enabled: v } })} label="Add the 97 mark to downloads" hint="Uses the official logo, on by default for every export when enabled" />
          <div className="field-row"><label>Position</label>
            <Segmented small label="Watermark position" value={w.position} options={POS.map((p) => ({ id: p, label: p.replace("-", " ") }))} onChange={(v) => set({ watermark: { position: v } })} />
          </div>
          <label className="field"><span>Opacity <em>{Math.round(w.opacity * 100)}%</em></span><input type="range" min={20} max={100} value={Math.round(w.opacity * 100)} onChange={(e) => set({ watermark: { opacity: Number(e.target.value) / 100 } })} /></label>
          <label className="field"><span>Size <em>{Math.round(w.scale * 100)}% of width</em></span><input type="range" min={6} max={30} value={Math.round(w.scale * 100)} onChange={(e) => set({ watermark: { scale: Number(e.target.value) / 100 } })} /></label>
          <div className="wm-preview" aria-hidden>
            <div className={`wm-mark ${w.position}`} style={{ opacity: w.opacity, width: `${w.scale * 100}%` }}><Logo height={40} /></div>
            <span>Preview</span>
          </div>
          <p className="muted tiny">The mark flips between white and black automatically so it stays readable on light or dark corners. Your original files are never changed.</p>
          <button className="btn ghost sm" onClick={() => toast("Download any image to see the branded export.")}>How it looks on a real export</button>
        </section>
      </div>
    </div>
  );
}
