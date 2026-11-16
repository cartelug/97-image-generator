"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Download, X } from "lucide-react";
import { dlUrl, imgUrl } from "@/lib/client";
import { useApp } from "./AppProvider";

export function SmartImg({ id, alt, w, h, className = "", eager = false }: { id: string; alt: string; w?: number; h?: number; className?: string; eager?: boolean }) {
  const [full, setFull] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setFull(false);
    const el = ref.current;
    if (el?.complete && el.naturalWidth) setFull(true);
  }, [id]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      className={`smart-img${full ? " on" : ""} ${className}`}
      src={imgUrl(id)}
      alt={alt}
      width={w}
      height={h}
      style={{ backgroundImage: `url(${imgUrl(id, { thumb: true })})` }}
      onLoad={() => setFull(true)}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
    />
  );
}

export function Thumb({ id, alt = "", className = "" }: { id: string; alt?: string; className?: string }) {
  // Fades in once decoded, so grids never "pop" half-loaded. Cached images are marked ready before first paint.
  const [ok, setOk] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    setOk(!!(el?.complete && el.naturalWidth));
  }, [id]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} className={`thumb-img${ok ? " on" : ""} ${className}`} src={imgUrl(id, { thumb: true })} alt={alt} loading="lazy" decoding="async" draggable={false} onLoad={() => setOk(true)} onError={() => setOk(true)} />
  );
}

export function Segmented<T extends string>({ value, options, onChange, label, small = false }: { value: T; options: { id: T; label: string; hint?: string }[]; onChange: (v: T) => void; label: string; small?: boolean }) {
  // A single pill that slides to the selected option instead of jumping.
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [live, setLive] = useState(false);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const b = el.querySelector<HTMLElement>("button.on");
      setBox(b ? { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight } : null);
    };
    measure();
    const raf = requestAnimationFrame(() => setLive(true));
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [value]);
  return (
    <div ref={wrap} className={`seg has-thumb${small ? " sm" : ""}${live ? " live" : ""}`} role="radiogroup" aria-label={label}>
      {box && <span className="seg-thumb" aria-hidden style={{ transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h }} />}
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? "on" : ""} onClick={() => onChange(o.id)} title={o.hint}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle">
      <span className="toggle-text">
        <b>{label}</b>
        {hint && <em>{hint}</em>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden />
    </label>
  );
}

export function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open, close]);
  return ref;
}

export function DownloadMenu({ imageId, ext, primary = false }: { imageId: string; ext: string; primary?: boolean }) {
  const { settings } = useApp();
  const [open, setOpen] = useState(false);
  const [wm, setWm] = useState(settings.watermark.enabled);
  const ref = useOutside(open, () => setOpen(false));
  const items = [
    { f: "original", label: `Original ${ext.toUpperCase().replace("JPG", "JPEG")}`, hint: "Exactly as generated" },
    { f: "png", label: "PNG", hint: "Lossless" },
    { f: "jpeg", label: "JPEG", hint: "Smaller file" },
    { f: "webp", label: "WebP", hint: "Web-ready" },
  ];
  return (
    <div className="menu-wrap" ref={ref}>
      <div className="split">
        <a className={`btn ${primary ? "primary" : "ghost"} split-main`} href={dlUrl(imageId, "original", wm)} download>
          <Download size={17} /> Download
        </a>
        <button className={`btn ${primary ? "primary" : "ghost"} split-more`} aria-haspopup="menu" aria-expanded={open} aria-label="More download options" onClick={() => setOpen((o) => !o)}>
          <ChevronDown size={16} />
        </button>
      </div>
      {open && (
        <div className="menu" role="menu">
          {items.map((i) => (
            <a key={i.f} role="menuitem" className="menu-item" href={dlUrl(imageId, i.f, wm)} download onClick={() => setOpen(false)}>
              <span>{i.label}</span>
              <em>{i.hint}</em>
            </a>
          ))}
          <label className="menu-check">
            <input type="checkbox" checked={wm} onChange={(e) => setWm(e.target.checked)} />
            <i>{wm && <Check size={12} />}</i>
            <span>Add 97 watermark</span>
          </label>
        </div>
      )}
    </div>
  );
}

function cmpNum(r: string) {
  const [a, b] = r.split("/").map(Number);
  return a && b ? (a / b).toFixed(4) : "1";
}

export function CompareSlider({ before, after, beforeLabel = "Before", afterLabel = "After", ratio }: { before: string; after: string; beforeLabel?: string; afterLabel?: string; ratio?: string }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="cmp" style={ratio ? { aspectRatio: ratio, maxWidth: `calc(78dvh * ${cmpNum(ratio)})` } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="cmp-img" src={imgUrl(after)} alt={afterLabel} draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="cmp-img cmp-before" src={imgUrl(before)} alt={beforeLabel} draggable={false} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
      <span className="cmp-tag l">{beforeLabel}</span>
      <span className="cmp-tag r">{afterLabel}</span>
      <div className="cmp-line" style={{ left: `${pos}%` }} aria-hidden>
        <i />
      </div>
      <input className="cmp-range" type="range" min={0} max={100} step={0.5} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Reveal slider: drag to compare before and after" />
    </div>
  );
}

export function Modal({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const close = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => closeRef.current(), 220);
  };
  const closeFn = useRef(close);
  closeFn.current = close;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const key = (e: KeyboardEvent) => e.key === "Escape" && closeFn.current();
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, []);
  // Phones: the modal is a bottom sheet — pull it down to dismiss.
  const onTouchStart = (e: React.TouchEvent) => {
    const el = sheet.current;
    if (!el || window.innerWidth > 1000 || el.scrollTop > 0) return;
    if ((e.target as HTMLElement).closest(".cmp, input, select, textarea")) return;
    drag.current = { y: e.touches[0].clientY, dy: 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const d = drag.current;
    const el = sheet.current;
    if (!d || !el) return;
    d.dy = Math.max(0, e.touches[0].clientY - d.y);
    el.style.transition = "none";
    el.style.transform = `translateY(${d.dy}px)`;
  };
  const onTouchEnd = () => {
    const d = drag.current;
    const el = sheet.current;
    drag.current = null;
    if (!d || !el) return;
    el.style.transition = "";
    if (d.dy > 110) {
      el.style.transform = "translateY(100%)";
      setTimeout(() => closeRef.current(), 200);
    } else el.style.transform = "";
  };
  // Portal to <body> so animated/transformed ancestors (e.g. the stage card) can't trap the fixed overlay.
  return createPortal(
    <div className={`modal-back${leaving ? " leaving" : ""}`} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div ref={sheet} className="modal" role="dialog" aria-modal="true" aria-label={label} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <span className="sheet-grip" aria-hidden />
        <button className="icon-btn modal-x" onClick={close} aria-label="Close" autoFocus>
          <X size={18} />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}
