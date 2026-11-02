"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHousehold } from "@/lib/store";
import { supabaseBrowser } from "@/lib/supabase/client";
import { parseQuickAdd } from "@/lib/domain/parse";
import { normalizeName } from "@/lib/domain/names";
import { formatQuantity } from "@/lib/domain/units";

/** Add a family recipe by hand – works without AI (free mode). */
export default function NewRecipe() {
  const { household, user, upsertLocal, toast } = useHousehold();
  const router = useRouter();
  const [f, setF] = useState({ title: "", description: "", cuisine: "", servings: 2, prep: 10, cook: 20, difficulty: "easy", ingredients: "", steps: "" });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });

  const ingredients = f.ingredients.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const optional = /\(optioneel\)|optioneel/i.test(line);
    const clean = line.replace(/\(?optioneel\)?/i, "").trim();
    const hasAmount = /^\d/.test(clean);
    const p = parseQuickAdd(clean)[0];
    return { name: p.name, quantity: hasAmount ? p.quantity : null, unit: hasAmount ? p.unit : null, optional };
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim() || !ingredients.length) return toast("Geef een naam en minstens één ingrediënt", "error");
    setBusy(true);
    const { data, error } = await supabaseBrowser().from("recipes").insert({
      household_id: household!.id, title: f.title.trim(), description: f.description || null, cuisine: f.cuisine.trim().toLowerCase() || null,
      main_ingredients: ingredients.filter((i) => !i.optional).slice(0, 5).map((i) => normalizeName(i.name)), methods: [],
      ingredients, steps: f.steps.split("\n").map((s) => s.replace(/^\d+[.)]\s*/, "").trim()).filter(Boolean),
      prep_minutes: f.prep, cook_minutes: f.cook, difficulty: f.difficulty, servings: f.servings, kind: "manual", source: "manual", saved: true, created_by: user!.id,
    }).select().single();
    setBusy(false);
    if (error) return toast(error.message, "error");
    upsertLocal("recipes", data);
    toast("Recept bewaard");
    router.replace(`/recipes/${data.id}`);
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Link href="/recipes" className="text-sm text-stone-500">← Recepten</Link>
      <h1 className="h1">Eigen recept</h1>
      <div className="card space-y-3 p-4">
        <div><label className="label">Naam</label><input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="bv. Stoofvlees van mama" required /></div>
        <div><label className="label">Korte beschrijving (optioneel)</label><input className="input" value={f.description} onChange={(e) => set({ description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div><label className="label">Keuken</label><input className="input" value={f.cuisine} onChange={(e) => set({ cuisine: e.target.value })} placeholder="belgisch" /></div>
          <div><label className="label">Porties</label><input className="input" inputMode="numeric" value={f.servings} onChange={(e) => set({ servings: Number(e.target.value) || 1 })} /></div>
          <div><label className="label">Voorbereiden (min)</label><input className="input" inputMode="numeric" value={f.prep} onChange={(e) => set({ prep: Number(e.target.value) || 0 })} /></div>
          <div><label className="label">Koken (min)</label><input className="input" inputMode="numeric" value={f.cook} onChange={(e) => set({ cook: Number(e.target.value) || 0 })} /></div>
          <div><label className="label">Moeilijkheid</label>
            <select className="input" value={f.difficulty} onChange={(e) => set({ difficulty: e.target.value })}><option value="easy">makkelijk</option><option value="medium">gemiddeld</option><option value="hard">moeilijk</option></select>
          </div>
        </div>
      </div>
      <div className="card space-y-2 p-4">
        <label className="label">Ingrediënten – één per regel, met hoeveelheid</label>
        <textarea className="input min-h-36 font-mono text-sm" value={f.ingredients} onChange={(e) => set({ ingredients: e.target.value })}
          placeholder={"1 kg rundvlees\n2 uien\n1 fles bruin bier\n2 sneden peperkoek\nmosterd (optioneel)"} />
        {ingredients.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 text-xs">{ingredients.map((i, n) => <li key={n} className="chip bg-stone-100 text-stone-700">{i.quantity != null ? `${formatQuantity(i.quantity, i.unit ?? "pcs")} ` : ""}{i.name}{i.optional ? " (opt.)" : ""}</li>)}</ul>
        )}
      </div>
      <div className="card space-y-2 p-4">
        <label className="label">Bereiding – één stap per regel</label>
        <textarea className="input min-h-36" value={f.steps} onChange={(e) => set({ steps: e.target.value })} placeholder={"Vlees in blokjes snijden en aanbakken.\nUien erbij en glazig bakken.\n…"} />
      </div>
      <button className="btn-primary w-full py-3" disabled={busy}>{busy ? "Bewaren…" : "Recept bewaren"}</button>
    </form>
  );
}
