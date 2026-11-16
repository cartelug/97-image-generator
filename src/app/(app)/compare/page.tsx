"use client";
import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Columns2, SplitSquareHorizontal } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { CompareSlider, SmartImg, Thumb } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { useState } from "react";

function Inner() {
  const { gens } = useApp();
  const router = useRouter();
  const sp = useSearchParams();
  const a = sp.get("a");
  const b = sp.get("b");
  const [mode, setMode] = useState<"slider" | "side">("slider");
  const images = useMemo(() => gens.filter((g) => g.status === "done").flatMap((g) => g.images.map((img) => ({ gen: g, img }))), [gens]);
  const A = images.find((x) => x.img.id === a);
  const B = images.find((x) => x.img.id === b);
  const set = (k: "a" | "b", id: string) => {
    const p = new URLSearchParams({ a: a || "", b: b || "" });
    p.set(k, id);
    router.replace(`/compare?${p.toString()}`);
  };
  const pick = (id: string) => {
    if (!A) return set("a", id);
    if (!B && id !== A.img.id) return set("b", id);
    // both chosen: replace B, shift if re-clicking
    set("b", id);
  };
  return (
    <div className="page compare">
      <div className="page-head">
        <div>
          <h1>Compare</h1>
          <p className="muted">Pick any two images to compare — original vs edit, or two directions side by side.</p>
        </div>
        {A && B && (
          <div className="seg sm" role="radiogroup" aria-label="Compare mode">
            <button role="radio" aria-checked={mode === "slider"} className={mode === "slider" ? "on" : ""} onClick={() => setMode("slider")}><SplitSquareHorizontal size={14} /> Slider</button>
            <button role="radio" aria-checked={mode === "side"} className={mode === "side" ? "on" : ""} onClick={() => setMode("side")}><Columns2 size={14} /> Side by side</button>
          </div>
        )}
      </div>
      {A && B ? (
        mode === "slider" ? (
          <div className="cmp-wrap"><CompareSlider before={A.img.id} after={B.img.id} ratio={`${B.img.width}/${B.img.height}`} beforeLabel="A" afterLabel="B" /></div>
        ) : (
          <div className="side-by-side">
            <figure><SmartImg id={A.img.id} alt="Image A" w={A.img.width} h={A.img.height} eager /><figcaption><b>A</b> {A.gen.input.prompt}</figcaption></figure>
            <figure><SmartImg id={B.img.id} alt="Image B" w={B.img.width} h={B.img.height} eager /><figcaption><b>B</b> {B.gen.input.prompt}</figcaption></figure>
          </div>
        )
      ) : (
        <div className="empty slim">
          <Logo height={44} />
          <h3>{!A ? "Choose the first image (A)" : "Now choose the second image (B)"}</h3>
        </div>
      )}
      <div className="step-head"><span className="eyebrow">Your images</span><span className="muted tiny">{A ? "A selected" : ""}{B ? " · B selected" : ""}</span></div>
      <div className="pick-strip">
        {images.slice(0, 60).map(({ img }) => (
          <button key={img.id} className={`hist${img.id === a ? " on a" : ""}${img.id === b ? " on b" : ""}`} onClick={() => pick(img.id)} aria-label="Select image">
            <Thumb id={img.id} />
            {img.id === a && <span className="hist-n">A</span>}
            {img.id === b && <span className="hist-n">B</span>}
          </button>
        ))}
        {!images.length && <p className="muted">Generate a couple of images first.</p>}
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
