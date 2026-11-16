"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Check, Columns2, FolderPlus, Loader2, Pencil, Search, Star, Trash2, X } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Thumb } from "@/components/ui";
import { Lightbox } from "@/components/Lightbox";
import { Logo } from "@/components/Logo";
import type { Gen } from "@/lib/types";

type Tile = { gen: Gen; img: Gen["images"][number] };

export default function GalleryPage() {
  const { gens, projects, patchGen, deleteGen, createProject, renameProject, deleteProject, settings } = useApp();
  const router = useRouter();
  const [proj, setProj] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [open, setOpen] = useState<Tile | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [wm, setWm] = useState(settings.watermark.enabled);
  const [fmt, setFmt] = useState("original");
  const [confirmDel, setConfirmDel] = useState(false);
  // Render tiles in chunks as you scroll: a big library opens instantly instead of mounting hundreds of images.
  const PAGE = 36;
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  const done = useMemo(() => gens.filter((g) => g.status === "done" && g.images.length), [gens]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, fav: 0 };
    for (const g of done) {
      c.all += g.images.length;
      if (g.favorite) c.fav += g.images.length;
      c[g.input.projectId] = (c[g.input.projectId] || 0) + g.images.length;
    }
    return c;
  }, [done]);
  const tiles: Tile[] = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return done
      .filter((g) => (proj === "all" ? true : proj === "fav" ? g.favorite : g.input.projectId === proj))
      .filter((g) => !ql || g.input.prompt.toLowerCase().includes(ql))
      .flatMap((g) => g.images.map((img) => ({ gen: g, img })));
  }, [done, proj, q]);

  useEffect(() => setLimit(PAGE), [proj, q]);
  const shown = useMemo(() => tiles.slice(0, limit), [tiles, limit]);
  const more = tiles.length > limit;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more) return;
    const io = new IntersectionObserver((es) => es[0]?.isIntersecting && setLimit((l) => l + PAGE), { rootMargin: "900px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, limit]);

  const byImg = (id: string) => tiles.find((t) => t.img.id === id);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const selGens = Array.from(new Set(sel.map((id) => byImg(id)?.gen.id).filter(Boolean) as string[]));
  const currentProject = projects.find((p) => p.id === proj);

  return (
    <div className="page gallery">
      <div className="page-head">
        <div>
          <h1>Gallery</h1>
          <p className="muted">{counts.all} image{counts.all === 1 ? "" : "s"} across {projects.length} project{projects.length === 1 ? "" : "s"}</p>
        </div>
        <div className="row gap8">
          <label className="search"><Search size={16} /><input placeholder="Search prompts" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search prompts" /></label>
          <button className={`btn ${selecting ? "primary" : "ghost"}`} onClick={() => { setSelecting((s) => !s); setSel([]); }}>{selecting ? "Done" : "Select"}</button>
        </div>
      </div>

      <div className="projects" role="tablist" aria-label="Projects">
        <button role="tab" aria-selected={proj === "all"} className={`pchip${proj === "all" ? " on" : ""}`} onClick={() => setProj("all")}>All <em>{counts.all}</em></button>
        <button role="tab" aria-selected={proj === "fav"} className={`pchip${proj === "fav" ? " on" : ""}`} onClick={() => setProj("fav")}><Star size={13} /> Favourites <em>{counts.fav}</em></button>
        {projects.map((p) => (
          <button key={p.id} role="tab" aria-selected={proj === p.id} className={`pchip${proj === p.id ? " on" : ""}`} onClick={() => setProj(p.id)}>
            <i className="pdot" style={{ background: p.color }} /> {p.name} <em>{counts[p.id] || 0}</em>
          </button>
        ))}
        {adding === null ? (
          <button className="pchip add" onClick={() => setAdding("")}><FolderPlus size={14} /> New project</button>
        ) : (
          <form className="row gap6" onSubmit={async (e) => { e.preventDefault(); const p = await createProject(adding); if (p) setProj(p.id); setAdding(null); }}>
            <input className="input sm" autoFocus placeholder="Project name" value={adding} onChange={(e) => setAdding(e.target.value)} />
            <button className="icon-btn sm" aria-label="Create"><Check size={14} /></button>
            <button type="button" className="icon-btn sm" aria-label="Cancel" onClick={() => setAdding(null)}><X size={14} /></button>
          </form>
        )}
      </div>

      {currentProject && currentProject.name !== "Unsorted" && (
        <div className="row gap8 proj-tools">
          {renaming === null ? (
            <>
              <button className="btn quiet sm" onClick={() => setRenaming(currentProject.name)}><Pencil size={14} /> Rename “{currentProject.name}”</button>
              <button className="btn quiet sm" onClick={() => { deleteProject(currentProject.id); setProj("all"); }}><Trash2 size={14} /> Delete project (images move to Unsorted)</button>
            </>
          ) : (
            <form className="row gap6" onSubmit={(e) => { e.preventDefault(); renameProject(currentProject.id, renaming); setRenaming(null); }}>
              <input className="input sm" autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} />
              <button className="icon-btn sm" aria-label="Save"><Check size={14} /></button>
            </form>
          )}
        </div>
      )}

      {tiles.length === 0 ? (
        <div className="empty">
          <Logo height={54} />
          <h3>{done.length ? "Nothing matches" : "Your gallery starts here"}</h3>
          <p className="muted">{done.length ? "Try another project or search." : "Generate your first image in the Studio and it will appear here, organised by project."}</p>
          {!done.length && <button className="btn primary" onClick={() => router.push("/studio")}>Open Studio</button>}
        </div>
      ) : (
        <>
        <div className="grid">
          {shown.map((t) => {
            const on = sel.includes(t.img.id);
            return (
              <div key={t.img.id} className={`tile${on ? " sel" : ""}`}>
                <button className="tile-main" style={{ aspectRatio: `${t.img.width}/${t.img.height}` }} onClick={() => (selecting ? toggle(t.img.id) : setOpen(t))} aria-label={t.gen.input.prompt.slice(0, 80)}>
                  <Thumb id={t.img.id} alt={t.gen.input.prompt} />
                </button>
                {selecting && <span className={`tick${on ? " on" : ""}`} aria-hidden>{on && <Check size={14} />}</span>}
                {!selecting && (
                  <button className={`tile-star${t.gen.favorite ? " on" : ""}`} aria-pressed={t.gen.favorite} aria-label="Favourite" onClick={() => patchGen(t.gen.id, { favorite: !t.gen.favorite })}><Star size={15} fill={t.gen.favorite ? "currentColor" : "none"} /></button>
                )}
                {t.gen.input.refs.length > 0 && <span className="tile-badge">Edit</span>}
              </div>
            );
          })}
        </div>
        {more && <div ref={sentinel} className="grid-more" aria-hidden><Loader2 className="spin" size={18} /></div>}
        </>
      )}

      {selecting && (
        <div className="selbar" role="toolbar" aria-label="Selection actions">
          <b>{sel.length} selected</b>
          <button className="btn ghost sm" disabled={sel.length !== 2} onClick={() => router.push(`/compare?a=${sel[0]}&b=${sel[1]}`)}><Columns2 size={15} /> Compare</button>
          <select className="select sm" value={fmt} onChange={(e) => setFmt(e.target.value)} aria-label="Export format">
            <option value="original">Original</option><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option>
          </select>
          <label className="menu-check inline"><input type="checkbox" checked={wm} onChange={(e) => setWm(e.target.checked)} /><i>{wm && <Check size={12} />}</i><span>97 watermark</span></label>
          <a className={`btn primary sm${sel.length ? "" : " disabled"}`} aria-disabled={!sel.length} href={sel.length ? `/api/export?ids=${sel.join(",")}&format=${fmt}&wm=${wm ? 1 : 0}` : undefined} download><Archive size={15} /> Export ZIP</a>
          <select className="select sm" value="" onChange={(e) => { if (e.target.value) { selGens.forEach((id) => patchGen(id, { projectId: e.target.value })); setSel([]); } }} aria-label="Move to project" disabled={!sel.length}>
            <option value="">Move to…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {confirmDel ? (
            <><span className="tiny">Delete {selGens.length} generation(s)?</span><button className="btn danger sm" onClick={() => { selGens.forEach(deleteGen); setSel([]); setConfirmDel(false); }}>Delete</button><button className="btn quiet sm" onClick={() => setConfirmDel(false)}>Keep</button></>
          ) : (
            <button className="btn quiet sm" disabled={!sel.length} onClick={() => setConfirmDel(true)}><Trash2 size={15} /> Delete</button>
          )}
        </div>
      )}
      {open && <Lightbox gen={open.gen} imageId={open.img.id} onClose={() => setOpen(null)} />}
    </div>
  );
}
