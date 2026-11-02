"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useHousehold } from "@/lib/store";
import { RecipeCard } from "@/components/RecipeCard";
import { Empty } from "@/components/ui";

const QUICK = ["What can I cook tonight?", "Something with chicken and veg from the fridge", "Quick, under 30 minutes", "What should I cook to avoid throwing food away?", "Surprise me with something new", "Nothing I need to shop for", "Similar to the recipes we rated 5/5"];

function RecipesInner() {
  const { recipes, toast, reload } = useHousehold();
  const params = useSearchParams();
  const [prompt, setPrompt] = useState(params.get("q") ?? "");
  const [maxMinutes, setMaxMinutes] = useState<number | "">("");
  const [noShopping, setNoShopping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ message: string; ids: string[] } | null>(null);
  const [filter, setFilter] = useState<"saved" | "all">("saved");
  const fired = useRef(false);

  async function ask(p = prompt) {
    setBusy(true);
    setResult(null);
    const quick = /under\s*(\d+)|less than\s*(\d+)/i.exec(p);
    const minutes = maxMinutes || (quick ? Number(quick[1] ?? quick[2]) : /quick/i.test(p) ? 30 : undefined);
    try {
      const r = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p, maxMinutes: minutes || undefined, noShopping: noShopping || /without (going )?shopping|no shopping|nothing i need to shop/i.test(p) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await reload();
      setResult({ message: j.message, ids: j.recipeIds });
    } catch (e: any) {
      toast(e.message || "The chef couldn't answer", "error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (params.get("q") && !fired.current) { fired.current = true; ask(params.get("q")!); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fresh = result ? result.ids.map((id) => recipes.find((r) => r.id === id)).filter(Boolean) : [];
  const library = recipes.filter((r) => (filter === "saved" ? r.saved : true) && !result?.ids.includes(r.id));

  return (
    <div className="space-y-5">
      <h1 className="h1">Your chef</h1>
      <form className="card space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <textarea className="input min-h-20 text-base" placeholder="What should we cook tonight?" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5">⏱ max <input className="input w-20 py-1" inputMode="numeric" placeholder="—" value={maxMinutes} onChange={(e) => setMaxMinutes(e.target.value ? Number(e.target.value) : "")} /> min</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={noShopping} onChange={(e) => setNoShopping(e.target.checked)} /> no shopping</label>
          <button className="btn-primary ml-auto" disabled={busy}>{busy ? "Thinking…" : "Ask chef"}</button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {QUICK.map((q) => <button type="button" key={q} className="chip shrink-0 bg-stone-100 py-1 text-stone-700 hover:bg-stone-200" onClick={() => { setPrompt(q); ask(q); }}>{q}</button>)}
        </div>
      </form>

      {busy && (
        <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="card h-72 animate-pulse bg-stone-100" />)}</div>
      )}
      {result && (
        <section className="space-y-3">
          <p className="rounded-2xl bg-brand-50 p-3 text-sm text-brand-900">👩‍🍳 {result.message}</p>
          <div className="grid gap-4 sm:grid-cols-3">{fresh.map((r) => <RecipeCard key={r!.id} recipe={r!} />)}</div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="h2">Recipe library</h2>
          <select className="input w-40 py-1" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="saved">Saved & cooked</option><option value="all">All suggestions</option>
          </select>
        </div>
        {library.length === 0 ? <Empty icon="📚" title="No recipes yet">Ask your chef above – recipes you cook or save land here.</Empty> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{library.slice(0, 30).map((r) => <RecipeCard key={r.id} recipe={r} />)}</div>
        )}
      </section>
    </div>
  );
}
export default function RecipesPage() {
  return <Suspense><RecipesInner /></Suspense>;
}
