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
    toast("Profiel bewaard");
    reload();
  }
  async function saveHousehold() {
    const { error } = await supabaseBrowser().from("households").update({ name: hhName, currency, stores }).eq("id", household!.id);
    if (error) return toast(error.message, "error");
    toast("Huishouden bewaard");
    reload();
  }
  async function makeInvite() {
    const c = await rpc<string>("create_invite", { p_household: household!.id });
    if (c) setInvite(c);
  }
  const link = invite && typeof window !== "undefined" ? `${location.origin}/onboarding?invite=${invite}` : "";

  return (
    <div className="space-y-5">
      <h1 className="h1">Instellingen</h1>
      <nav className="grid grid-cols-3 gap-2 md:hidden">
        <Link href="/history" className="card p-3 text-sm">📖 Geschiedenis</Link>
        <Link href="/preferences" className="card p-3 text-sm">❤️ Voorkeuren</Link>
        <Link href="/stores" className="card p-3 text-sm">🧭 Winkels</Link>
      </nav>

      <section className="card space-y-3 p-4">
        <h2 className="h2">Mijn profiel</h2>
        <div><label className="label">Naam</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Dieet (gescheiden door komma's, bv. vegetarisch, koolhydraatarm)</label><input className="input" value={diet} onChange={(e) => setDiet(e.target.value)} /></div>
        <div><label className="label">Allergieën – de chef gebruikt deze nooit</label><input className="input" value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="bv. pinda's, schaaldieren" /></div>
        <div className="flex gap-2">{COLORS.map((c) => <button key={c} onClick={() => setColor(c)} className={`h-7 w-7 rounded-full ${color === c ? "ring-2 ring-stone-900 ring-offset-2" : ""}`} style={{ background: c }} aria-label={c} />)}</div>
        <button className="btn-primary" onClick={saveProfile}>Profiel bewaren</button>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="h2">Huishouden</h2>
        <div className="grid grid-cols-3 gap-2">
          <input className="input col-span-2" value={hhName} onChange={(e) => setHhName(e.target.value)} />
          <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} />
        </div>
        <div>
          <div className="label">Onze winkels – geef producten een winkel en splits de boodschappenlijst per winkel</div>
          <div className="flex flex-wrap gap-2">
            {stores.map((st) => (
              <span key={st} className="chip gap-1 bg-stone-100 py-1 text-stone-700">🏪 {st}
                <button aria-label={`${st} verwijderen`} className="text-stone-400 hover:text-red-500" onClick={() => setStores(stores.filter((x) => x !== st))}>✕</button>
              </span>
            ))}
          </div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = newStore.trim(); if (v && !stores.includes(v)) setStores([...stores, v]); setNewStore(""); }}>
            <input className="input" placeholder="bv. Colruyt" value={newStore} onChange={(e) => setNewStore(e.target.value)} />
            <button className="btn-ghost shrink-0">Winkel toevoegen</button>
          </form>
        </div>
        <button className="btn-primary" onClick={saveHousehold}>Huishouden bewaren</button>
        <div>
          <div className="label">Leden</div>
          <ul className="flex flex-wrap gap-2">{members.map((m) => <li key={m.id} className="chip gap-1.5 bg-stone-100 py-1 text-stone-700"><span className="h-2.5 w-2.5 rounded-full" style={{ background: m.avatar_color }} />{m.display_name}</li>)}</ul>
        </div>
        <div className="rounded-2xl bg-brand-50 p-3">
          <div className="text-sm font-medium text-brand-900">Nodig je partner uit</div>
          {invite ? (
            <div className="mt-2 space-y-2">
              <div className="font-mono text-2xl tracking-widest">{invite}</div>
              <button className="btn-primary" onClick={() => (navigator.share ? navigator.share({ title: "Kom in onze keuken", url: link }) : navigator.clipboard.writeText(link).then(() => toast("Link gekopieerd")))}>Uitnodiging delen</button>
              <p className="text-xs text-brand-800">7 dagen geldig, één keer te gebruiken.</p>
            </div>
          ) : <button className="btn-primary mt-2" onClick={makeInvite}>Uitnodigingscode maken</button>}
        </div>
      </section>

      <section className="card space-y-2 p-4 text-sm text-stone-600">
        <h2 className="h2 text-stone-900">Over je gegevens</h2>
        <p>Jullie voorraad, recepten en scores staan in jullie eigen databank. De AI krijgt enkel een korte samenvatting (huidige voorraad, geleerde smaken, recente maaltijden) als je om recepten vraagt of een foto scant.</p>
        <p>Vervaldata zijn een richtlijn. “Te gebruiken tot” gaat over veiligheid, “ten minste houdbaar tot” over kwaliteit. Controleer eten altijd voor je het opeet.</p>
      </section>

      <button className="btn-danger w-full" onClick={async () => { await supabaseBrowser().auth.signOut(); router.replace("/login"); }}>Afmelden</button>
    </div>
  );
}
