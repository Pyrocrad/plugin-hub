"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHousehold } from "@/lib/store";
import { supabaseBrowser } from "@/lib/supabase/client";

const COLORS = ["#16a34a", "#e11d48", "#2563eb", "#9333ea", "#ea580c", "#0891b2"];

export default function SettingsPage() {
  const { user, members, household, rpc, reload, toast } = useHousehold();
  const router = useRouter();
  const me = members.find((m) => m.id === user?.id);
  const [name, setName] = useState(me?.display_name ?? "");
  const [diet, setDiet] = useState((me?.diet ?? []).join(", "));
  const [allergies, setAllergies] = useState((me?.allergies ?? []).join(", "));
  const [color, setColor] = useState(me?.avatar_color ?? COLORS[0]);
  const [hhName, setHhName] = useState(household?.name ?? "");
  const [currency, setCurrency] = useState(household?.currency ?? "EUR");
  const [invite, setInvite] = useState<string | null>(null);
  const [stores, setStores] = useState<string[]>(household?.stores ?? []);
  const [newStore, setNewStore] = useState("");
  const list = (s: string) => s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

  async function saveProfile() {
    const { error } = await supabaseBrowser().from("profiles").update({ display_name: name, diet: list(diet), allergies: list(allergies), avatar_color: color }).eq("id", user!.id);
    if (error) return toast(error.message, "error");
    toast("Profile saved");
    reload();
  }
  async function saveHousehold() {
    const { error } = await supabaseBrowser().from("households").update({ name: hhName, currency, stores }).eq("id", household!.id);
    if (error) return toast(error.message, "error");
    toast("Household saved");
    reload();
  }
  async function makeInvite() {
    const c = await rpc<string>("create_invite", { p_household: household!.id });
    if (c) setInvite(c);
  }
  const link = invite && typeof window !== "undefined" ? `${location.origin}/onboarding?invite=${invite}` : "";

  return (
    <div className="space-y-5">
      <h1 className="h1">Settings</h1>
      <nav className="grid grid-cols-2 gap-2 md:hidden">
        <Link href="/history" className="card p-3 text-sm">📖 History</Link>
        <Link href="/preferences" className="card p-3 text-sm">❤️ Preferences</Link>
      </nav>

      <section className="card space-y-3 p-4">
        <h2 className="h2">My profile</h2>
        <div><label className="label">Display name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Diet (comma separated, e.g. vegetarian, low-carb)</label><input className="input" value={diet} onChange={(e) => setDiet(e.target.value)} /></div>
        <div><label className="label">Allergies – the chef will never use these</label><input className="input" value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="e.g. peanuts, shellfish" /></div>
        <div className="flex gap-2">{COLORS.map((c) => <button key={c} onClick={() => setColor(c)} className={`h-7 w-7 rounded-full ${color === c ? "ring-2 ring-stone-900 ring-offset-2" : ""}`} style={{ background: c }} aria-label={c} />)}</div>
        <button className="btn-primary" onClick={saveProfile}>Save profile</button>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="h2">Household</h2>
        <div className="grid grid-cols-3 gap-2">
          <input className="input col-span-2" value={hhName} onChange={(e) => setHhName(e.target.value)} />
          <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} />
        </div>
        <div>
          <div className="label">Our stores – tag products and split the shopping list per store</div>
          <div className="flex flex-wrap gap-2">
            {stores.map((st) => (
              <span key={st} className="chip gap-1 bg-stone-100 py-1 text-stone-700">🏪 {st}
                <button aria-label={`Remove ${st}`} className="text-stone-400 hover:text-red-500" onClick={() => setStores(stores.filter((x) => x !== st))}>✕</button>
              </span>
            ))}
          </div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = newStore.trim(); if (v && !stores.includes(v)) setStores([...stores, v]); setNewStore(""); }}>
            <input className="input" placeholder="e.g. Lidl" value={newStore} onChange={(e) => setNewStore(e.target.value)} />
            <button className="btn-ghost shrink-0">Add store</button>
          </form>
        </div>
        <button className="btn-primary" onClick={saveHousehold}>Save household</button>
        <div>
          <div className="label">Members</div>
          <ul className="flex flex-wrap gap-2">{members.map((m) => <li key={m.id} className="chip gap-1.5 bg-stone-100 py-1 text-stone-700"><span className="h-2.5 w-2.5 rounded-full" style={{ background: m.avatar_color }} />{m.display_name}</li>)}</ul>
        </div>
        <div className="rounded-2xl bg-brand-50 p-3">
          <div className="text-sm font-medium text-brand-900">Invite your partner</div>
          {invite ? (
            <div className="mt-2 space-y-2">
              <div className="font-mono text-2xl tracking-widest">{invite}</div>
              <button className="btn-primary" onClick={() => (navigator.share ? navigator.share({ title: "Join our kitchen", url: link }) : navigator.clipboard.writeText(link).then(() => toast("Link copied")))}>Share invite link</button>
              <p className="text-xs text-brand-800">Valid for 7 days, single use.</p>
            </div>
          ) : <button className="btn-primary mt-2" onClick={makeInvite}>Create invite code</button>}
        </div>
      </section>

      <section className="card space-y-2 p-4 text-sm text-stone-600">
        <h2 className="h2 text-stone-900">About your data</h2>
        <p>Your inventory, recipes and ratings live in your household database. The AI only receives a compact summary (current stock, learned tastes, recent meals) when you ask for recipes or scan a photo.</p>
        <p>Expiry dates are guidance. Use-by dates are about safety; best-before dates are about quality. Always check food before eating it.</p>
      </section>

      <button className="btn-danger w-full" onClick={async () => { await supabaseBrowser().auth.signOut(); router.replace("/login"); }}>Sign out</button>
    </div>
  );
}
