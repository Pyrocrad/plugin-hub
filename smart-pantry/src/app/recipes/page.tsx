"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useHousehold, today } from "@/lib/store";
import { rankRecipes } from "@/lib/domain/rank";
import { RecipeCard } from "@/components/RecipeCard";
import { Empty } from "@/components/ui";
import { ClaudeAppBridge } from "@/components/ClaudeAppBridge";

const QUICK = ["Wat kan ik vanavond koken?", "Iets met kip en groenten uit de koelkast", "Snel, onder 30 minuten", "Wat moet ik koken om niets weg te gooien?", "Verras me met iets nieuws", "Niets waarvoor ik moet winkelen", "Iets zoals de recepten die we 5/5 gaven"];

function RecipesInner() {
  const { recipes, toast, reload, aiEnabled } = useHousehold();
  const params = useSearchParams();
  const [prompt, setPrompt] = useState(params.get("q") ?? "");
  const [maxMinutes, setMaxMinutes] = useState<number | "">("");
  const [noShopping, setNoShopping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ message: string; ids: string[] } | null>(null);
  const [filter, setFilter] = useState<"saved" | "all">("saved");
  const fired = useRef(false);

  async function ask(p = prompt) {
    if (!aiEnabled) return;
    setBusy(true);
    setResult(null);
    const quick = /onder\s*(\d+)|minder dan\s*(\d+)|under\s*(\d+)/i.exec(p);
    const minutes = maxMinutes || (quick ? Number(quick[1] ?? quick[2] ?? quick[3]) : /snel/i.test(p) ? 30 : undefined);
    try {
      const r = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p, maxMinutes: minutes || undefined, noShopping: noShopping || /niet (meer )?winkelen|zonder winkelen|waarvoor ik moet winkelen/i.test(p) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await reload();
      setResult({ message: j.message, ids: j.recipeIds });
    } catch (e: any) {
      toast(e.message || "De chef kon niet antwoorden", "error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (aiEnabled && params.get("q") && !fired.current) { fired.current = true; ask(params.get("q")!); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiEnabled]);

  const fresh = result ? result.ids.map((id) => recipes.find((r) => r.id === id)).filter(Boolean) : [];
  const library = recipes.filter((r) => (filter === "saved" ? r.saved : true) && !result?.ids.includes(r.id));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="h1">Jouw chef</h1>
        <Link href="/recipes/new" className="btn-ghost">＋ Eigen recept</Link>
      </div>
      {aiEnabled ? (
        <form className="card space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <textarea className="input min-h-20 text-base" placeholder="Wat koken we vanavond?" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5">⏱ max <input className="input w-20 py-1" inputMode="numeric" placeholder="—" value={maxMinutes} onChange={(e) => setMaxMinutes(e.target.value ? Number(e.target.value) : "")} /> min</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={noShopping} onChange={(e) => setNoShopping(e.target.checked)} /> niet winkelen</label>
            <button className="btn-primary ml-auto" disabled={busy}>{busy ? "Even denken…" : "Vraag de chef"}</button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {QUICK.map((q) => <button type="button" key={q} className="chip shrink-0 bg-stone-100 py-1 text-stone-700 hover:bg-stone-200" onClick={() => { setPrompt(q); ask(q); }}>{q}</button>)}
          </div>
        </form>
      ) : (
        <>
          <FreeChef maxMinutes={maxMinutes} setMaxMinutes={setMaxMinutes} noShopping={noShopping} setNoShopping={setNoShopping} />
          <ClaudeAppBridge maxMinutes={maxMinutes || undefined} noShopping={noShopping} />
        </>
      )}

      {busy && <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="card h-72 animate-pulse bg-stone-100" />)}</div>}
      {result && (
        <section className="space-y-3">
          <p className="rounded-2xl bg-brand-50 p-3 text-sm text-brand-900">👩‍🍳 {result.message}</p>
          <div className="grid gap-4 sm:grid-cols-3">{fresh.map((r) => <RecipeCard key={r!.id} recipe={r!} />)}</div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="h2">Receptenboek</h2>
          <select className="input w-44 py-1" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="saved">Bewaard & gekookt</option><option value="all">Alle suggesties</option>
          </select>
        </div>
        {library.length === 0 ? <Empty icon="📚" title="Nog geen recepten">{aiEnabled ? "Vraag het de chef hierboven" : "Voeg je eigen recepten toe"} – recepten die je kookt of bewaart komen hier.</Empty> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{library.slice(0, 30).map((r) => <RecipeCard key={r.id} recipe={r} />)}</div>
        )}
      </section>
    </div>
  );
}

/** Free mode: no AI, ranks your own recipes by what's at home, what expires, and your ratings. */
function FreeChef({ maxMinutes, setMaxMinutes, noShopping, setNoShopping }: { maxMinutes: number | ""; setMaxMinutes: (v: number | "") => void; noShopping: boolean; setNoShopping: (v: boolean) => void }) {
  const { recipes, inventory, ratings, cookings, members } = useHousehold();
  const ranked = useMemo(() => rankRecipes({ recipes, inventory, ratings, cookings, memberIds: members.map((m) => m.id), today: today(), maxMinutes: maxMinutes || undefined, noShopping }),
    [recipes, inventory, ratings, cookings, members, maxMinutes, noShopping]);
  return (
    <section className="space-y-3">
      <div className="card space-y-2 p-4">
        <div className="flex items-center gap-2"><span className="chip bg-emerald-100 text-emerald-800">Gratis modus</span><span className="text-sm text-stone-500">zonder AI</span></div>
        <p className="text-sm text-stone-600">Suggesties uit <b>jullie eigen recepten</b>: eerst wat jullie al in huis hebben, wat bijna over datum gaat en wat jullie het lekkerst vonden.</p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5">⏱ max <input className="input w-20 py-1" inputMode="numeric" placeholder="—" value={maxMinutes} onChange={(e) => setMaxMinutes(e.target.value ? Number(e.target.value) : "")} /> min</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={noShopping} onChange={(e) => setNoShopping(e.target.checked)} /> niet winkelen</label>
        </div>
      </div>
      {ranked.length === 0 ? (
        <Empty icon="📒" title="Nog geen passende recepten"><Link href="/recipes/new" className="text-brand-700">Voeg jullie vaste recepten toe →</Link></Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {ranked.slice(0, 3).map((r, i) => (
            <div key={r.recipe.id} className="space-y-1.5">
              <div className="px-1 text-xs font-medium text-brand-700">{["🥇 Beste keuze", "🥈 Ook goed", "🥉 Of anders"][i]}</div>
              <RecipeCard recipe={r.recipe} />
              {r.reasons.length > 0 && <ul className="px-1 text-xs text-stone-500">{r.reasons.map((x) => <li key={x}>• {x}</li>)}</ul>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function RecipesPage() {
  return <Suspense><RecipesInner /></Suspense>;
}
