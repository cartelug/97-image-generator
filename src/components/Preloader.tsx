"use client";
import { useEffect, useRef, useState } from "react";

export function Preloader() {
  const [p, setP] = useState(0);
  const [fade, setFade] = useState(false);
  const [gone, setGone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (document.documentElement.dataset.boot === "seen") {
      setGone(true);
      return;
    }
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minMs = reduce ? 250 : 1300; // short on purpose: never hold the app hostage
    const t0 = performance.now();
    let done = 0;
    const total = 3;
    const mark = () => void done++;
    mark(); // 1) app hydrated
    (document.fonts?.ready ?? Promise.resolve()).then(mark, mark); // 2) fonts ready
    const img = new Image(); // 3) the real logo decoded
    img.src = "/brand/97-mark-white.png";
    (img.decode ? img.decode() : Promise.resolve()).then(mark, mark);

    let raf = 0;
    let shown = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setP(1);
      setFade(true);
      try {
        sessionStorage.setItem("97ig.boot", "1");
      } catch {}
      setTimeout(() => setGone(true), reduce ? 80 : 650);
    };
    const tick = () => {
      const el = performance.now() - t0;
      const target = Math.min(Math.min(1, el / minMs), done / total);
      shown += (target - shown) * 0.18;
      setP(shown);
      if (shown > 0.985 && done >= total && el >= minMs) return finish();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const safety = setTimeout(finish, 4000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(safety);
    };
  }, []);

  if (gone) return null;
  return (
    <div className={`preloader${fade ? " is-fading" : ""}`} role="status" aria-label="Loading 97 Image Generator" aria-live="polite">
      <div className="pre-stage">
        <div className="pre-glow" aria-hidden />
        <div className="pre-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/97-mark-white.png" alt="THE 97" width={172} height={151} draggable={false} />
          <span className="pre-sweep" aria-hidden />
        </div>
        <div className="pre-bar" aria-hidden>
          <i style={{ transform: `scaleX(${p})` }} />
        </div>
        <div className="pre-text">97 IMAGE GENERATOR</div>
        <div className="pre-sub">THE 97 WORLD</div>
      </div>
    </div>
  );
}
