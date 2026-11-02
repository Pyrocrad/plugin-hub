import type { Cooking, InventoryItem, Rating, Recipe } from "./types";
import { matchIngredients, matchSummary } from "./matching";
import { daysLeft } from "./expiry";
import { latestRatings } from "./preferences";
import { daysBetween } from "./expiry";

export interface RankedRecipe {
  recipe: Recipe;
  score: number;
  have: number;
  total: number;
  missing: number;
  usesExpiring: string[];
  avgRating: number | null;
  lastCookedDays: number | null;
  reasons: string[];
}

/**
 * Free (no-AI) recommendations: rank the household's own recipes by
 *  • how much is already at home (never assumes: uses the deterministic matcher)
 *  • how many soon-expiring products they use
 *  • how much the household liked them
 *  • not having cooked them very recently
 */
export function rankRecipes(input: { recipes: Recipe[]; inventory: InventoryItem[]; ratings: Rating[]; cookings: Cooking[]; memberIds: string[]; today: string; maxMinutes?: number; noShopping?: boolean }): RankedRecipe[] {
  const { recipes, inventory, ratings, cookings, memberIds, today } = input;
  const latest = latestRatings(ratings);
  const out: RankedRecipe[] = [];
  for (const recipe of recipes.filter((r) => r.saved)) {
    const time = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
    if (input.maxMinutes && time > input.maxMinutes) continue;
    const matches = matchIngredients(recipe.ingredients, inventory);
    const sum = matchSummary(matches);
    if (input.noShopping && sum.missing.length > 0) continue;
    const usesExpiring = [...new Set(matches.flatMap((m) => m.deductions)
      .map((d) => inventory.find((i) => i.id === d.item_id)!)
      .filter((i) => { const d = daysLeft(i, today); return i.expiry_type !== "none" && d != null && d >= 0 && d <= 3; })
      .map((i) => i.name))];
    const rs = memberIds.map((u) => latest.get(u)?.get(recipe.id)?.rating).filter((x): x is number => x != null);
    const avg = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
    const last = cookings.filter((c) => c.recipe_id === recipe.id).map((c) => c.cooked_at.slice(0, 10)).sort().pop();
    const lastDays = last ? daysBetween(last, today) : null;

    const coverage = sum.total ? sum.have / sum.total : 0;
    let score = coverage * 50 + usesExpiring.length * 12 + (avg != null ? (avg - 3) * 8 : 0);
    if (rs.some((r) => r <= 2)) score -= 10; // someone disliked it
    if (lastDays != null && lastDays < 5) score -= 20; // just had it
    const reasons: string[] = [];
    if (usesExpiring.length) reasons.push(`Gebruikt ${usesExpiring.join(", ")} (bijna over datum)`);
    if (sum.missing.length === 0 && sum.check.length === 0) reasons.push("Alles in huis");
    if (avg != null && avg >= 4) reasons.push(`Jullie gaven ★ ${avg.toFixed(1)}`);
    if (lastDays != null && lastDays < 5) reasons.push(`${lastDays === 0 ? "Vandaag" : `${lastDays} dagen geleden`} nog gegeten`);
    out.push({ recipe, score, have: sum.have, total: sum.total, missing: sum.missing.length, usesExpiring, avgRating: avg, lastCookedDays: lastDays, reasons });
  }
  return out.sort((a, b) => b.score - a.score);
}
