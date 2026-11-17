"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowDown, Check, MessageSquarePlus, Menu, Pencil, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/client";
import { useApp } from "../AppProvider";
import { Logo } from "../Logo";
import { Lightbox } from "../Lightbox";
import { ChatComposer } from "./ChatComposer";
import { MessageView, type MsgHandlers } from "./MessageView";
import { ThreadList, type ThreadInfo } from "./ThreadList";
import type { ChatOpts, Gen, Msg, Thread } from "@/lib/types";

type View = { thread: Thread; generations: Gen[] };

const IDEAS = [
  { t: "Make 12 logo variations for a specialty coffee brand called “Ember”", s: "12 images from one message" },
  { t: "Create 6 different poster styles for a jazz night, each with the title “BLUE HOUR”", s: "A series, each its own prompt" },
  { t: "Photoreal portrait of an elderly fisherman at golden hour, 85mm, natural skin texture", s: "One careful image" },
  { t: "Make 3 sneaker launch ad concepts for Instagram stories", s: "Vertical, AI picks the shape" },
];

const isActive = (t: Thread | null) => !!t?.messages.some((m) => m.role === "assistant" && (m.status === "thinking" || m.status === "working"));

export function ChatApp() {
  const params = useParams<{ id?: string[] }>();
  const id = params?.id?.[0];
  const router = useRouter();
  const { toast, upsertGens, refreshUsage, setChatRefs, gens: appGens, chatRefs, demo } = useApp();
  const [list, setList] = useState<ThreadInfo[]>([]);
  const [listReady, setListReady] = useState(false);
  const [thread, setThread] = useState<Thread | null>(null);
  const [local, setLocal] = useState<Record<string, Gen>>({});
  const [loading, setLoading] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [open, setOpen] = useState<{ gen: Gen; imageId: string } | null>(null);
  const [text, setText] = useState("");
  const [focusTick, setFocusTick] = useState(0);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [delArm, setDelArm] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [away, setAway] = useState(false);
  const wasActive = useRef(false);

  const refreshList = useCallback(async () => {
    try {
      setList((await api<{ threads: ThreadInfo[] }>("/api/threads")).threads);
    } catch {}
    setListReady(true);
  }, []);
  useEffect(() => void refreshList(), [refreshList]);

  const apply = useCallback((v: View) => {
    setThread(v.thread);
    setLocal((prev) => {
      const n = { ...prev };
      for (const g of v.generations) n[g.id] = g;
      return n;
    });
    // finished images join the app-wide library (Gallery, history); running ones are polled here, not there
    upsertGens(v.generations.filter((g) => g.status !== "running"));
    setList((l) => {
      const row: ThreadInfo = { id: v.thread.id, title: v.thread.title, createdAt: v.thread.createdAt, updatedAt: v.thread.updatedAt, messages: v.thread.messages.length, active: isActive(v.thread) };
      return l.some((x) => x.id === row.id) ? l.map((x) => (x.id === row.id ? row : x)) : [row, ...l];
    });
  }, [upsertGens]);

  // open the thread in the URL
  useEffect(() => {
    if (!id) {
      setThread(null);
      return;
    }
    if (thread?.id === id) return;
    let dead = false;
    setLoading(true);
    api<View>(`/api/threads/${id}`)
      .then((v) => !dead && (apply(v), (stick.current = true)))
      .catch((e) => {
        if (dead) return;
        toast(e instanceof ApiError && e.status === 404 ? "That chat no longer exists." : "Couldn’t open that chat.", "error");
        router.replace("/chat");
      })
      .finally(() => !dead && setLoading(false));
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // live updates while the assistant is thinking / rendering
  const active = isActive(thread);
  useEffect(() => {
    if (!thread?.id || !active) return;
    const tid = thread.id;
    let dead = false;
    const t = setInterval(async () => {
      if (document.hidden) return;
      try {
        const v = await api<View>(`/api/threads/${tid}`);
        if (!dead) apply(v);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) router.replace("/chat");
      }
    }, 800);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [thread?.id, active, apply, router]);

  useEffect(() => {
    if (wasActive.current && !active && thread) {
      refreshUsage();
      refreshList();
      const last = thread.messages[thread.messages.length - 1];
      if (last?.status === "done" && last.items?.length) {
        try {
          navigator.vibrate?.(14);
        } catch {}
      }
    }
    wasActive.current = active;
  }, [active, thread, refreshUsage, refreshList]);

  // keep the newest message in view unless you've scrolled up
  const sig = useMemo(() => thread?.messages.map((m) => `${m.id}:${m.status}:${m.items?.filter((i) => i.status === "done").length ?? 0}`).join("|") ?? "", [thread]);
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [sig, loading]);
  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    stick.current = near;
    setAway(!near);
  };

  // app-wide copies win once a render finishes, so a favourite toggled here (or in the Gallery) shows everywhere
  const gens = useMemo(() => {
    const m: Record<string, Gen> = { ...local };
    for (const g of appGens) if (g.status !== "running" && local[g.id]) m[g.id] = g;
    return m;
  }, [local, appGens]);

  async function send(t: string, refs: string[], opts: ChatOpts) {
    try {
      const v = await api<View>("/api/chat", { json: { threadId: thread?.id, text: t, refs, opts } });
      stick.current = true;
      apply(v);
      if (!id) router.replace(`/chat/${v.thread.id}`);
      return true;
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn’t send that. Try again.", "error");
      return false;
    }
  }

  const lastAi = thread ? [...thread.messages].reverse().find((m) => m.role === "assistant") : undefined;
  async function stop(m: Msg) {
    if (!thread) return;
    try {
      apply(await api<View>(`/api/threads/${thread.id}/cancel`, { json: { msgId: m.id } }));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn’t stop that.", "error");
    }
  }
  async function retry(m: Msg) {
    if (!thread) return;
    try {
      stick.current = true;
      apply(await api<View>(`/api/threads/${thread.id}/regenerate`, { json: { msgId: m.id } }));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn’t retry that.", "error");
    }
  }
  async function removeThread(tid: string) {
    try {
      await api(`/api/threads/${tid}`, { method: "DELETE" });
      setList((l) => l.filter((x) => x.id !== tid));
      if (tid === thread?.id) {
        setThread(null);
        router.replace("/chat");
      }
      toast("Chat deleted. Its images stay in your Gallery.", "ok");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn’t delete that chat.", "error");
    }
  }
  async function rename(title: string) {
    setRenaming(null);
    if (!thread || !title.trim() || title.trim() === thread.title) return;
    try {
      apply(await api<View>(`/api/threads/${thread.id}`, { method: "PATCH", json: { title } }));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn’t rename.", "error");
    }
  }
  const attach = (imageId: string) => {
    setChatRefs((l) => (l.some((x) => x.id === imageId) ? l : l.length >= 16 ? l : [...l, { id: imageId, name: "Image to edit", kind: "result" }]));
    setFocusTick((n) => n + 1);
    toast("Attached. Describe the change.");
  };

  const handlers: MsgHandlers = {
    onOpen: (gen, imageId) => setOpen({ gen, imageId }),
    onAttach: attach,
    onRetry: retry,
    onStop: stop,
    onEditPrompt: (t) => { setText(t); setFocusTick((n) => n + 1); },
  };

  const go = (path: string) => {
    setDrawer(false);
    router.push(path);
  };
  const newChat = () => {
    setThread(null);
    setText("");
    setChatRefs([]);
    go("/chat");
    setFocusTick((n) => n + 1);
  };
  useEffect(() => {
    setDelArm(false);
  }, [thread?.id]);
  useEffect(() => {
    if (!delArm) return;
    const t = setTimeout(() => setDelArm(false), 2600);
    return () => clearTimeout(t);
  }, [delArm]);

  return (
    <div className={`chat${drawer ? " drawer-open" : ""}`}>
      <aside className="chat-side" aria-label="Chat history">
        <ThreadList list={list} loaded={listReady} activeId={thread?.id ?? id} onSelect={(tid) => go(`/chat/${tid}`)} onNew={newChat} onDelete={removeThread} />
      </aside>
      <div className="chat-scrim" onClick={() => setDrawer(false)} aria-hidden />
      <section className="chat-main" aria-label="Conversation">
        <header className="chat-head">
          <button className="icon-btn sm chat-menu" onClick={() => setDrawer(true)} aria-label="Open chat history"><Menu size={17} /></button>
          {thread && renaming !== null ? (
            <input className="input sm chat-title-edit" autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} onBlur={() => rename(renaming)} onKeyDown={(e) => { if (e.key === "Enter") rename(renaming); if (e.key === "Escape") setRenaming(null); }} aria-label="Chat title" />
          ) : (
            <button className="chat-title" onClick={() => thread && setRenaming(thread.title)} disabled={!thread} title={thread ? "Rename chat" : undefined}>
              <span className="clamp1">{thread?.title || "New chat"}</span>
              {thread && <Pencil size={12} />}
            </button>
          )}
          <div className="chat-head-actions">
            {thread && (
              <button className={`btn quiet sm${delArm ? " danger" : ""}`} onClick={() => (delArm ? (setDelArm(false), removeThread(thread.id)) : setDelArm(true))} aria-label={delArm ? "Confirm delete chat" : "Delete chat"}>
                {delArm ? <><Check size={14} /> Delete?</> : <Trash2 size={14} />}
              </button>
            )}
            <button className="btn ghost sm" onClick={newChat}><MessageSquarePlus size={14} /> <span className="hide-s">New chat</span></button>
          </div>
        </header>

        <div className="chat-scroll" ref={scroller} onScroll={onScroll}>
          <div className="chat-col">
            {!thread && !loading && (
              <div className="chat-welcome">
                <div className="welcome-glow" aria-hidden />
                <Logo height={60} />
                <h1>What shall we create?</h1>
                <p className="welcome-sub">Chat with GPT-6.1 Sol. Ask for any number of images, and it reads the count right from your message.{demo ? " (Demo mode: free placeholder images.)" : ""}</p>
                <div className="idea-grid">
                  {IDEAS.map((i) => (
                    <button key={i.t} className="idea" onClick={() => { setText(i.t); setFocusTick((n) => n + 1); }}>
                      <b>{i.t}</b>
                      <em>{i.s}</em>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {loading && !thread && <div className="chat-loading" aria-label="Loading chat"><i /><i /><i /></div>}
            {thread?.messages.map((m, i) => (
              <MessageView key={m.id} msg={m} prev={thread.messages[i - 1]} gens={gens} last={m.id === lastAi?.id && i === thread.messages.length - 1} h={handlers} />
            ))}
          </div>
        </div>
        <div className="chat-foot">
          {away && (
            <button className="to-bottom" onClick={() => { stick.current = true; scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }} aria-label="Jump to latest"><ArrowDown size={16} /></button>
          )}
          <ChatComposer text={text} setText={setText} busy={active} onSend={send} onStop={() => lastAi && stop(lastAi)} focusTick={focusTick} />
          <p className="chat-note tiny">{chatRefs.length ? "Attached images are used as references or edited." : "GPT-6.1 Sol can make mistakes. Check important details, such as spelling inside images."}</p>
        </div>
      </section>
      {open && <Lightbox gen={open.gen} imageId={open.imageId} onClose={() => setOpen(null)} onEdit={(_g, imageId) => attach(imageId)} />}
    </div>
  );
}
