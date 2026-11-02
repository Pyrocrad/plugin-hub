"use client";
import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useHousehold } from "@/lib/store";
import { matchIngredients } from "@/lib/domain/matching";
import { shoppingFromMatches } from "@/lib/domain/shopping";
import { formatQuantity } from "@/lib/domain/units";
import { householdAgreement } from "@/lib/domain/preferences";
import { supabaseBrowser } from "@/lib/supabase/client";
import { preferredStore } from "@/lib/domain/stores";
import { CookSheet, RateForm } from "@/components/CookSheet";
import { RecipeImage, Sheet, Stars, Empty, timeAgo } from "@/components/ui";

const STATUS = {
  have: { label: "At home", cls: "bg-emerald-100 text-emerald-800", dot: "✓" },
  partial: { label: "Not enough", cls: "bg-amber-100 text-amber-800", dot: "◐" },
  missing: { label: "To buy", cls: "bg-orange-100 text-orange-800", dot: "＋" },
  check: { label: "Check amount", cls: "bg-sky-100 text-sky-800", dot: "?" },
};
const AGREE: Record<string, string> = { all_love: "💚 You all love this", split: "⚖️ Opinions differ", all_dislike: "👎 Nobody liked this", mixed: "🤷 Mixed feelings", single: "" };

export default function RecipeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { recipes, inventory, cookings, ratings, members, user, household, rpc, reload, toast, memberName, upsertLocal, shopping } = useHousehold();
  const recipe = recipes.find((r) => r.id === id);
  const [cooking, setCooking] = useState(false);
  const [rateFor, setRateFor] = useState<string | null>(null);
  const matches = useMemo(() => (recipe ? matchIngredients(recipe.ingredients, inventory) : []), [recipe, inventory]);

  if (!recipe) return <Empty icon="🔍" title="Recipe not found"><Link href="/recipes" className="text-brand-700">Back to recipes</Link></Empty>;

  const toBuy = shoppingFromMatches(matches);
  const history = cookings.filter((c) => c.recipe_id === recipe.id);
  const agreement = householdAgreement(recipe.id, ratings, members.map((m) => m.id));
  const [desc, why] = (recipe.description ?? "").split("\n\n");

  async function addMissing() {
    let n = 0;
    for (const d of toBuy) {
      const r = await rpc("add_shopping_item", { p_household: household!.id, p_name: d.name, p_normalized: d.normalized_name, p_quantity: d.quantity, p_unit: d.unit, p_category: d.category, p_recipe: recipe!.id, p_store: preferredStore(d.name, inventory, shopping) });
      if (r) n++;
    }
    await reload();
    toast(`${n} item${n === 1 ? "" : "s"} added to the shopping list`);
  }
  async function toggleSave() {
    const { data } = await supabaseBrowser().from("recipes").update({ saved: !recipe!.saved }).eq("id", recipe!.id).select().single();
    if (data) upsertLocal("recipes", data);
  }

  return (
    <article className="space-y-5">
      <Link href="/recipes" className="text-sm text-stone-500">← Recipes</Link>
      <div className="card overflow-hidden">
        <RecipeImage title={recipe.title} url={recipe.image_url} className="h-52 md:h-72" />
        <div className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="h1">{recipe.title}</h1>
            <button className="btn-ghost shrink-0" onClick={toggleSave}>{recipe.saved ? "★ Saved" : "☆ Save"}</button>
          </div>
          <p className="text-stone-600">{desc}</p>
          {why && <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">👩‍🍳 {why}</p>}
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="chip bg-stone-100">Prep {recipe.prep_minutes} min</span>
            <span className="chip bg-stone-100">Cook {recipe.cook_minutes} min</span>
            <span className="chip bg-stone-100">{recipe.difficulty}</span>
            <span className="chip bg-stone-100">{recipe.servings} servings</span>
            {recipe.cuisine && <span className="chip bg-stone-100">{recipe.cuisine}</span>}
            {recipe.nutrition?.kcal && <span className="chip bg-stone-100">~{Math.round(recipe.nutrition.kcal)} kcal{recipe.nutrition.protein_g ? ` · ${Math.round(recipe.nutrition.protein_g)} g protein` : ""} /serving (est.)</span>}
            {AGREE[agreement.agreement] && <span className="chip bg-violet-50 text-violet-700">{AGREE[agreement.agreement]}</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-5">
        <section className="card p-4 md:col-span-2">
          <h2 className="h2 mb-3">Ingredients</h2>
          <ul className="space-y-2">
            {matches.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={`chip mt-0.5 w-6 justify-center ${STATUS[m.status].cls}`}>{STATUS[m.status].dot}</span>
                <div className="flex-1">
                  <span className="font-medium">{m.ingredient.quantity != null ? `${formatQuantity(m.ingredient.quantity, m.ingredient.unit ?? "pcs")} ` : ""}</span>{m.ingredient.name}
                  {m.ingredient.optional && <span className="text-stone-400"> (optional)</span>}
                  {m.status === "partial" && <div className="text-xs text-amber-700">short by {formatQuantity(m.missingQuantity ?? 0, m.ingredient.unit ?? "pcs")}</div>}
                  {m.note && <div className="text-xs text-sky-700">{m.note}</div>}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-stone-500">{Object.values(STATUS).map((s) => <span key={s.label}><span className={`chip ${s.cls}`}>{s.dot}</span> {s.label}</span>)}</div>
          {toBuy.length > 0 && (
            <div className="mt-4 rounded-xl bg-orange-50 p-3 text-sm">
              <div className="font-medium text-orange-900">Need to buy: {toBuy.map((t) => t.name).join(", ")}</div>
              {recipe.estimated_missing_cost != null && <div className="text-xs text-orange-800">≈ {household?.currency} {recipe.estimated_missing_cost.toFixed(2)} (AI estimate)</div>}
              <button className="btn mt-2 w-full bg-orange-600 text-white hover:bg-orange-700" onClick={addMissing}>＋ Add missing to shopping list</button>
            </div>
          )}
        </section>
        <section className="card p-4 md:col-span-3">
          <h2 className="h2 mb-3">Method</h2>
          <ol className="space-y-3">
            {recipe.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{i + 1}</span>{s}</li>
            ))}
          </ol>
        </section>
      </div>

      <button className="btn-primary sticky bottom-20 w-full py-3 text-base shadow-lg md:bottom-4" onClick={() => setCooking(true)}>🍳 I cooked this</button>

      {history.length > 0 && (
        <section className="card p-4">
          <h2 className="h2 mb-2">Cooked {history.length}×</h2>
          <ul className="divide-y divide-stone-100">
            {history.map((c) => {
              const rs = ratings.filter((r) => r.cooking_id === c.id);
              const mine = rs.find((r) => r.user_id === user?.id);
              return (
                <li key={c.id} className="space-y-1 py-2 text-sm">
                  <div className="flex justify-between"><span>{memberName(c.cooked_by)} · {new Date(c.cooked_at).toLocaleDateString()}</span><span className="text-stone-400">{timeAgo(c.cooked_at)}</span></div>
                  {c.modifications && <div className="text-xs text-stone-500">Changes: {c.modifications}</div>}
                  {rs.map((r) => <div key={r.id} className="flex items-center gap-2 text-xs"><span className="w-16">{memberName(r.user_id)}</span><Stars value={r.rating} size="text-sm" />{r.comment && <span className="text-stone-500">“{r.comment}”</span>}</div>)}
                  <button className="text-xs text-brand-700" onClick={() => setRateFor(c.id)}>{mine ? "Change my rating" : "Rate this"}</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <CookSheet recipe={recipe} open={cooking} onClose={() => setCooking(false)} />
      <Sheet open={!!rateFor} onClose={() => setRateFor(null)} title="Your rating">
        {rateFor && <RateForm cookingId={rateFor} recipeId={recipe.id} onDone={() => setRateFor(null)} initial={ratings.find((r) => r.cooking_id === rateFor && r.user_id === user?.id)} />}
      </Sheet>
    </article>
  );
}
