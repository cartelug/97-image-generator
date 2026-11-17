"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, MessageSquarePlus, Trash2 } from "lucide-react";

export type ThreadInfo = { id: string; title: string; createdAt: string; updatedAt: string; messages: number; active: boolean };

function group(list: ThreadInfo[]) {
  const now = new Date();
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = day(now);
  const out: { label: string; items: ThreadInfo[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];
  for (const t of list) {
    const d = (today - day(new Date(t.updatedAt))) / 86_400_000;
    out[d < 1 ? 0 : d < 2 ? 1 : d < 8 ? 2 : 3].items.push(t);
  }
  return out.filter((g) => g.items.length);
}

export function ThreadList({ list, activeId, loaded, onSelect, onNew, onDelete }: { list: ThreadInfo[]; activeId?: string; loaded: boolean; onSelect: (id: string) => void; onNew: () => void; onDelete: (id: string) => void }) {
  const groups = useMemo(() => group(list), [list]);
  const [arm, setArm] = useState<string | null>(null);
  useEffect(() => {
    if (!arm) return;
    const t = setTimeout(() => setArm(null), 2600);
    return () => clearTimeout(t);
  }, [arm]);
  return (
    <nav className="threads" aria-label="Chats">
      <button className="btn ghost new-chat" onClick={onNew}><MessageSquarePlus size={16} /> New chat</button>
      <div className="threads-scroll">
        {!loaded && <div className="threads-load"><i /><i /><i /><i /></div>}
        {loaded && !list.length && <p className="muted tiny threads-empty">Your chats appear here. Each one keeps its own thread of messages and images.</p>}
        {groups.map((g) => (
          <section key={g.label}>
            <h2>{g.label}</h2>
            <ul>
              {g.items.map((t) => (
                <li key={t.id} className={`thread${t.id === activeId ? " on" : ""}`}>
                  <button className="thread-open" onClick={() => onSelect(t.id)} aria-current={t.id === activeId ? "page" : undefined} title={t.title}>
                    <span className="clamp1">{t.title}</span>
                    {t.active && <Loader2 className="spin" size={13} aria-label="Working" />}
                  </button>
                  <button className={`thread-del${arm === t.id ? " arm" : ""}`} aria-label={arm === t.id ? `Confirm: delete ${t.title}` : `Delete ${t.title}`} onClick={() => (arm === t.id ? (setArm(null), onDelete(t.id)) : setArm(t.id))}>
                    {arm === t.id ? <Check size={13} strokeWidth={3} /> : <Trash2 size={13} />}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}

