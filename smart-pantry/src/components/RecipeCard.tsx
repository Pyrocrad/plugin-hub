"use client";
import Link from "next/link";
import type { Recipe } from "@/lib/domain/types";
import { matchIngredients, matchSummary } from "@/lib/domain/matching";
import { useHousehold } from "@/lib/store";
import { RecipeImage } from "./ui";

const KIND: Record<string, { label: string; cls: string }> = {
  favourite: { label: "❤️ Favoriet", cls: "bg-rose-50 text-rose-700" },
  practical: { label: "♻️ Opmaken", cls: "bg-amber-50 text-amber-800" },
  discovery: { label: "🧭 Ontdekking", cls: "bg-indigo-50 text-indigo-700" },
  custom: { label: "✨ Voor jou", cls: "bg-brand-50 text-brand-700" },
  manual: { label: "📒 Eigen recept", cls: "bg-stone-100 text-stone-700" },
};

export const DIFF: Record<string, string> = { easy: "makkelijk", medium: "gemiddeld", hard: "moeilijk" };

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const { inventory } = useHousehold();
  const s = matchSummary(matchIngredients(recipe.ingredients, inventory));
  const k = KIND[recipe.kind ?? ""] ?? null;
  return (
    <Link href={`/recipes/${recipe.id}`} className="card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <RecipeImage title={recipe.title} url={recipe.image_url} />
      <div className="flex flex-1 flex-col p-4">
        {k && <span className={`chip mb-2 self-start ${k.cls}`}>{k.label}</span>}
        <h3 className="font-semibold leading-snug">{recipe.title}</h3>
        <p className="mt-1 line-clamp-3 text-sm text-stone-500">{recipe.description?.split("\n\n")[0]}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-3 text-xs">
          <span className="chip bg-stone-100 text-stone-700">⏱ {(recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0)} min</span>
          <span className="chip bg-stone-100 text-stone-700">{DIFF[recipe.difficulty ?? ""] ?? recipe.difficulty}</span>
          <span className={`chip ${s.missing.length === 0 && s.check.length === 0 ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-700"}`}>
            🏠 {s.have}/{s.total} in huis
          </span>
          {s.missing.length > 0 && <span className="chip bg-orange-50 text-orange-700">🛒 {s.missing.length} te kopen</span>}
        </div>
      </div>
    </Link>
  );
}
