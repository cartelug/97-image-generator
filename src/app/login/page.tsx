"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { api, ApiError } from "@/lib/client";

function Form() {
  const sp = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const email = String(fd.get("email") || "");
    const password = String(fd.get("password") || "");
    setBusy(true);
    setErr("");
    try {
      await api("/api/auth/login", { json: { email, password } });
      const next = sp.get("next");
      location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/chat";
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Could not sign in.");
      setBusy(false);
    }
  }
  return (
    <form className="login-card" onSubmit={go}>
      <div className="login-logo">
        <Logo height={72} />
      </div>
      <h1>97 IMAGE GENERATOR</h1>
      <p className="login-sub">Generate extraordinary. Design without limits.</p>
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="username" required autoFocus />
      </label>
      <label className="field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {err && <div className="form-error" role="alert">{err}</div>}
      <button className="btn primary lg" disabled={busy}>
        {busy ? <Loader2 className="spin" size={18} /> : <>Sign in <ArrowRight size={18} /></>}
      </button>
      <p className="login-foot">THE 97 WORLD · Official AI Creative Studio</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="login">
      <div className="login-glow" aria-hidden />
      <Suspense>
        <Form />
      </Suspense>
    </main>
  );
}
