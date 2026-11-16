"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUser, Images, SlidersHorizontal, Sparkles, Columns2, Check, TriangleAlert, Info } from "lucide-react";
import { Logo } from "./Logo";
import { useApp } from "./AppProvider";
import { fmtUsd } from "@/lib/pricing";

const NAV = [
  { href: "/studio", label: "Studio", Icon: Sparkles },
  { href: "/gallery", label: "Gallery", Icon: Images },
  { href: "/compare", label: "Compare", Icon: Columns2 },
  { href: "/account", label: "Account", Icon: CircleUser },
  { href: "/settings", label: "Settings", Icon: SlidersHorizontal },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { demo, usage, toasts, me, dismissToast } = useApp();
  const b = usage?.budget;
  const pct = b && b.monthlyUsd > 0 && usage ? usage.spent / b.monthlyUsd : 0;
  const navIdx = NAV.findIndex((n) => path.startsWith(n.href));
  return (
    <div className="shell">
      <nav className="rail" aria-label="Main">
        <Link href="/studio" className="rail-brand" aria-label="97 Image Generator — Studio">
          <Logo height={30} />
        </Link>
        <div className="rail-links" style={{ ["--i" as string]: Math.max(0, navIdx) }}>
          {navIdx >= 0 && <span className="rail-ind" aria-hidden />}
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={`rail-link${path.startsWith(href) ? " on" : ""}`} aria-current={path.startsWith(href) ? "page" : undefined}>
              <Icon size={20} strokeWidth={1.75} />
              <span>{label}</span>
            </Link>
          ))}
        </div>
        <div className="rail-foot" title={me?.email}>
          <span className="rail-avatar">{(me?.name || "?").slice(0, 1)}</span>
        </div>
      </nav>
      <div className="main">
        <header className="topbar">
          <Link href="/studio" className="top-logo" aria-label="Studio"><Logo height={22} /></Link>
          <div className="top-brand">
            <b>97 IMAGE GENERATOR</b>
            <span>THE 97 WORLD</span>
          </div>
          {usage && b && b.monthlyUsd > 0 && !demo && (
            <Link href="/account" className={`budget-chip${pct >= 1 ? " over" : pct >= b.warnPct / 100 ? " warn" : ""}`} title="Spend tracked by this app (estimates + measured usage). Not your live OpenAI balance.">
              <span className="dot" />
              {fmtUsd(usage.spent)} <em>of {fmtUsd(b.monthlyUsd)} this month</em>
            </Link>
          )}
        </header>
        {demo && (
          <div className="banner" role="note">
            <Info size={15} /> <b>Demo mode.</b> No OpenAI key is set, so images are free placeholders. Add <code>OPENAI_API_KEY</code> on the server to generate for real.
          </div>
        )}
        <main className="content">{children}</main>
      </div>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}${t.out ? " out" : ""}`} onClick={() => dismissToast(t.id)}>
            {t.kind === "ok" ? <Check size={16} /> : t.kind === "error" ? <TriangleAlert size={16} /> : <Info size={16} />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
