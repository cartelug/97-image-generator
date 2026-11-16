"use client";
import { useEffect, useState } from "react";
import { ExternalLink, LogOut, ShieldCheck } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Thumb, Toggle } from "@/components/ui";
import { fmtUsd } from "@/lib/pricing";
import { fmtDate } from "@/lib/client";
import { MODELS } from "@/lib/models";

export default function AccountPage() {
  const { me, usage, settings, updateSettings, demo, logout, refreshUsage, toast } = useApp();
  const [limit, setLimit] = useState(String(settings.budget.monthlyUsd));
  const [warn, setWarn] = useState(String(settings.budget.warnPct));
  useEffect(() => { refreshUsage(); }, [refreshUsage]);
  const b = settings.budget;
  const spent = usage?.spent ?? 0;
  const pct = b.monthlyUsd > 0 ? Math.min(100, (spent / b.monthlyUsd) * 100) : 0;
  const state = pct >= 100 ? "over" : pct >= b.warnPct ? "warn" : "";
  return (
    <div className="page account">
      <div className="page-head">
        <div>
          <h1>Account</h1>
          <p className="muted">{me?.name} · {me?.email}</p>
        </div>
        <button className="btn ghost" onClick={logout}><LogOut size={16} /> Sign out</button>
      </div>

      <div className="cards">
        <section className="card span2">
          <div className="eyebrow">Tracked spend · {usage?.month}</div>
          <div className="bignum mono">{fmtUsd(spent)}<span> of {b.monthlyUsd > 0 ? fmtUsd(b.monthlyUsd) : "no limit"}</span></div>
          <div className={`meter ${state}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Budget used"><i style={{ width: `${pct}%` }} /></div>
          <p className="muted tiny">
            {demo ? "Demo mode: nothing is charged." : `${usage?.images ?? 0} image(s) this month · ${usage?.verified ?? 0} measured from OpenAI’s reported usage${usage?.unverified ? `, ${usage.unverified} estimated` : ""}.`}
          </p>
          <div className="note">
            <ShieldCheck size={16} />
            <span>This is spend <b>tracked by this app</b>. It is <b>not</b> your live OpenAI balance — OpenAI doesn’t expose that to this app. Check your real credit balance at{" "}
              <a href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noreferrer">platform.openai.com → Billing <ExternalLink size={12} /></a>.</span>
          </div>
        </section>

        <section className="card">
          <div className="eyebrow">Spending controls</div>
          <label className="field"><span>Monthly limit (USD) <em>0 = no limit</em></span><input className="input" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} /></label>
          <label className="field"><span>Warn me at (%)</span><input className="input" inputMode="numeric" value={warn} onChange={(e) => setWarn(e.target.value)} /></label>
          <Toggle checked={b.enforce} onChange={(v) => updateSettings({ budget: { enforce: v } })} label="Block generations over the limit" hint="Stops a render that would pass your monthly budget" />
          <button className="btn primary" onClick={async () => { await updateSettings({ budget: { monthlyUsd: Number(limit) || 0, warnPct: Number(warn) || 80 } }); toast("Budget saved.", "ok"); }}>Save budget</button>
        </section>

        <section className="card">
          <div className="eyebrow">By model</div>
          {usage && Object.keys(usage.byModel).length ? (
            <ul className="kv">
              {Object.entries(usage.byModel).map(([m, v]) => (
                <li key={m}><span>{MODELS.find((x) => x.id === m)?.name || m}</span><span className="mono">{fmtUsd(v.usd)} · {v.images} img</span></li>
              ))}
            </ul>
          ) : <p className="muted tiny">No paid generations yet this month.</p>}
          <div className="eyebrow" style={{ marginTop: 18 }}>Connection</div>
          <p className="tiny">{demo ? <>🟡 <b>Demo mode</b> — add <code>OPENAI_API_KEY</code> on the server.</> : <>🟢 <b>Live</b> — secret key is stored on the server only.</>}</p>
        </section>

        <section className="card span2">
          <div className="eyebrow">Recent generations</div>
          {usage?.recent.length ? (
            <ul className="ledger">
              {usage.recent.map((r) => (
                <li key={r.id}>
                  {r.thumb ? <Thumb id={r.thumb} /> : <span className="ph" />}
                  <div><b>{MODELS.find((x) => x.id === r.model)?.name || r.model}</b><span className="muted tiny"> {r.quality} · {r.images} img · {fmtDate(r.at)}</span></div>
                  <span className="mono">{r.demo ? "demo" : fmtUsd(r.usd)}<em className="tiny muted"> {r.demo ? "" : r.actual ? "measured" : "est."}</em></span>
                </li>
              ))}
            </ul>
          ) : <p className="muted tiny">Nothing yet — your first generations will show up here.</p>}
        </section>
      </div>
    </div>
  );
}
