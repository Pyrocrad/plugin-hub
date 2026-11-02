"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

function LoginInner() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = mode === "in"
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password, options: { data: { display_name: name }, emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    if (mode === "up" && !res.data.session) return setMsg("Bevestig je e-mailadres via de mail in je inbox en meld je daarna aan.");
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-stone-50 to-amber-50 p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="text-center">
          <div className="text-4xl">🥕</div>
          <h1 className="h1 mt-2">Smart Pantry</h1>
          <p className="text-sm text-stone-500">Een persoonlijke chef die je keuken kent.</p>
        </div>
        {mode === "up" && <div><label className="label">Je naam</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>}
        <div><label className="label">E-mail</label><input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label className="label">Wachtwoord</label><input className="input" type="password" minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        {msg && <p className="rounded-xl bg-amber-50 p-2 text-sm text-amber-800">{msg}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "…" : mode === "in" ? "Aanmelden" : "Account maken"}</button>
        <button type="button" className="w-full text-sm text-brand-700" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Nieuw? Maak een account" : "Al een account? Meld je aan"}
        </button>
      </form>
    </div>
  );
}
export default function Login() {
  return <Suspense><LoginInner /></Suspense>;
}
