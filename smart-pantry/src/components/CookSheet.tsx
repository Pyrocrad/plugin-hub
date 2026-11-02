"use client";
import { useMemo, useState } from "react";
import { useHousehold } from "@/lib/store";
import type { Recipe } from "@/lib/domain/types";
import { matchIngredients } from "@/lib/domain/matching";
import { formatQuantity } from "@/lib/domain/units";
import { Sheet, Stars } from "./ui";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * "I cooked this": shows planned deductions, lets the cook adjust each amount,
 * then deducts ONLY the confirmed amounts in a single transaction.
 */
export function CookSheet({ recipe, open, onClose }: { recipe: Recipe; open: boolean; onClose: () => void }) {
  const { inventory, rpc, reload, toast } = useHousehold();
  const [servings, setServings] = useState(recipe.servings ?? 2);
  const scale = servings / (recipe.servings || servings || 1);
  const matches = useMemo(() => matchIngredients(recipe.ingredients, inventory, scale), [recipe, inventory, scale]);
  const planned = matches.flatMap((m) => m.deductions.map((d) => ({ ...d, ingredient: m.ingredient.name })));
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [skip, setSkip] = useState<Record<string, boolean>>({});
  const [exact, setExact] = useState(true);
  const [mods, setMods] = useState("");
  const [step, setStep] = useState<"confirm" | "rate">("confirm");
  const [cookingId, setCookingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    const deductions = planned
      .filter((d) => !skip[d.item_id + d.ingredient])
      .map((d) => ({ item_id: d.item_id, amount: Number(amounts[d.item_id + d.ingredient] ?? d.amount) }))
      .filter((d) => d.amount > 0);
    const id = await rpc<string>("cook_recipe", { p_recipe: recipe.id, p_deductions: deductions, p_followed_exactly: exact, p_modifications: mods || null, p_servings: servings });
    setBusy(false);
    if (!id) return;
    await reload();
    toast(`Voorraad bijgewerkt (${deductions.length} product${deductions.length === 1 ? "" : "en"})`);
    setCookingId(id);
    setStep("rate");
  }

  return (
    <Sheet open={open} onClose={onClose} title={step === "confirm" ? "Ik heb dit gekookt" : "Hoe was het?"}>
      {step === "confirm" ? (
        <div className="space-y-4">
          <label className="flex items-center justify-between text-sm">Aantal porties
            <input className="input w-20" inputMode="numeric" value={servings} onChange={(e) => setServings(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <div>
            <div className="label">Van de voorraad aftrekken – pas aan als je meer of minder gebruikte</div>
            {planned.length === 0 ? <p className="text-sm text-stone-500">Niets in voorraad om af te trekken.</p> : (
              <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200">
                {planned.map((d) => {
                  const key = d.item_id + d.ingredient;
                  const stock = inventory.find((i) => i.id === d.item_id);
                  return (
                    <li key={key} className={`flex items-center gap-2 p-2.5 text-sm ${skip[key] ? "opacity-40" : ""}`}>
                      <input type="checkbox" checked={!skip[key]} onChange={(e) => setSkip({ ...skip, [key]: !e.target.checked })} aria-label="Aftrekken" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{d.item_name}</div>
                        <div className="text-xs text-stone-500">in voorraad {stock ? formatQuantity(stock.quantity, stock.unit) : "?"}</div>
                      </div>
                      <input className="input w-20 py-1 text-right" inputMode="decimal" value={amounts[key] ?? String(d.amount)} onChange={(e) => setAmounts({ ...amounts, [key]: e.target.value })} disabled={skip[key]} />
                      <span className="w-8 text-xs text-stone-500">{d.unit === "pcs" ? "st." : d.unit}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {matches.some((m) => m.status === "check") && <p className="mt-2 text-xs text-amber-700">Sommige ingrediënten staan in een andere eenheid in de voorraad ({matches.filter((m) => m.status === "check").map((m) => m.ingredient.name).join(", ")}). Pas die indien nodig aan in de voorraad.</p>}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)} /> Ik heb het recept exact gevolgd</label>
          {!exact && <textarea className="input" placeholder="Wat heb je aangepast?" value={mods} onChange={(e) => setMods(e.target.value)} />}
          <button className="btn-primary w-full py-3" disabled={busy} onClick={confirm}>{busy ? "Bewaren…" : "Bevestigen & voorraad bijwerken"}</button>
        </div>
      ) : (
        <RateForm cookingId={cookingId!} recipeId={recipe.id} onDone={onClose} />
      )}
    </Sheet>
  );
}

export function RateForm({ cookingId, recipeId, onDone, initial }: { cookingId: string; recipeId: string; onDone: () => void; initial?: { rating: number; comment: string | null } }) {
  const { household, user, upsertLocal, toast } = useHousehold();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  async function save() {
    const { data, error } = await supabaseBrowser().from("ratings")
      .upsert({ household_id: household!.id, cooking_id: cookingId, recipe_id: recipeId, user_id: user!.id, rating, comment: comment || null }, { onConflict: "cooking_id,user_id" })
      .select().single();
    if (error) return toast(error.message, "error");
    upsertLocal("ratings", data);
    toast("Bedankt – je chef heeft iets bijgeleerd");
    onDone();
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-center"><Stars value={rating} onChange={setRating} size="text-4xl" /></div>
      <textarea className="input" placeholder="Opmerkingen? (optioneel)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={onDone}>Later</button>
        <button className="btn-primary flex-1" disabled={!rating} onClick={save}>Score bewaren</button>
      </div>
    </div>
  );
}
