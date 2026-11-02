"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useHousehold } from "@/lib/store";

function OnboardingInner() {
  const { rpc, reload } = useHousehold();
  const router = useRouter();
  const [name, setName] = useState("Onze keuken");
  const [code, setCode] = useState(useSearchParams().get("invite") ?? "");
  const [busy, setBusy] = useState(false);

  async function go(fn: () => Promise<unknown>) {
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    if (ok) {
      await reload();
      router.replace("/");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-stone-50 to-amber-50 p-4">
      <div className="w-full max-w-md space-y-4">
        <h1 className="h1 text-center">Je huishouden instellen</h1>
        <div className="card space-y-3 p-5">
          <h2 className="h2">Bij het huishouden van je partner</h2>
          <input className="input font-mono uppercase tracking-widest" placeholder="UITNODIGINGSCODE" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn-primary w-full" disabled={busy || code.length < 6} onClick={() => go(() => rpc("join_household", { p_code: code }))}>Aansluiten</button>
        </div>
        <div className="text-center text-sm text-stone-400">of</div>
        <div className="card space-y-3 p-5">
          <h2 className="h2">Nieuw huishouden maken</h2>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-ghost w-full" disabled={busy || !name} onClick={() => go(() => rpc("create_household", { p_name: name }))}>Maken</button>
        </div>
      </div>
    </div>
  );
}
export default function Onboarding() {
  return <Suspense><OnboardingInner /></Suspense>;
}
