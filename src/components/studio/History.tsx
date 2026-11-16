"use client";
import Link from "next/link";
import { AlertCircle, ArrowRight, Loader2, Star } from "lucide-react";
import { useApp } from "../AppProvider";
import { Thumb } from "../ui";

export function History() {
  const { gens, activeId, setActiveId } = useApp();
  const list = gens.slice(0, 30);
  if (!list.length) return null;
  const cur = activeId ?? list[0]?.id;
  return (
    <section className="history" aria-label="Recent generations">
      <div className="step-head">
        <span className="eyebrow">History</span>
        <Link href="/gallery" className="link">Open gallery <ArrowRight size={14} /></Link>
      </div>
      <div className="hist-strip">
        {list.map((g) => (
          <button key={g.id} className={`hist${g.id === cur ? " on" : ""}`} onClick={() => setActiveId(g.id)} aria-label={`${g.input.prompt.slice(0, 60)} — ${g.status}`} title={g.input.prompt.slice(0, 120)}>
            {g.images[0] ? <Thumb id={g.images[0].id} /> : <span className="hist-ph">{g.status === "running" ? <Loader2 className="spin" size={18} /> : <AlertCircle size={18} />}</span>}
            {g.favorite && <Star size={11} className="hist-star" fill="currentColor" />}
            {g.images.length > 1 && <span className="hist-n">{g.images.length}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
