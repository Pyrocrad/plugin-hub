"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useHousehold } from "@/lib/store";

function OnboardingInner() {
  const { rpc, reload } = useHousehold();
  const router = useRouter();
  const [name, setName] = useState("Our kitchen");
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
        <h1 className="h1 text-center">Set up your household</h1>
        <div className="card space-y-3 p-5">
          <h2 className="h2">Join your partner&apos;s household</h2>
          <input className="input font-mono uppercase tracking-widest" placeholder="INVITE CODE" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn-primary w-full" disabled={busy || code.length < 6} onClick={() => go(() => rpc("join_household", { p_code: code }))}>Join household</button>
        </div>
        <div className="text-center text-sm text-stone-400">or</div>
        <div className="card space-y-3 p-5">
          <h2 className="h2">Create a new household</h2>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-ghost w-full" disabled={busy || !name} onClick={() => go(() => rpc("create_household", { p_name: name }))}>Create</button>
        </div>
      </div>
    </div>
  );
}
export default function Onboarding() {
  return <Suspense><OnboardingInner /></Suspense>;
}
