import type { InventoryItem, RecipeIngredient } from "./types";
import { nameMatchScore, normalizeName } from "./names";
import { convert, normalizeUnit, round } from "./units";
import { effectiveExpiry } from "./expiry";

export type IngredientStatus = "have" | "partial" | "missing" | "check";

export interface Deduction {
  item_id: string;
  item_name: string;
  amount: number; // in the item's own unit
  unit: string;
}

export interface IngredientMatch {
  ingredient: RecipeIngredient;
  status: IngredientStatus;
  /** Amount still needed, expressed in the ingredient's unit (for the shopping list). */
  missingQuantity: number | null;
  deductions: Deduction[];
  note?: string;
}

// Staples where an exact amount is rarely tracked; still only "have" if they exist.
const PANTRY_STAPLES = new Set(["salt", "pepper", "black pepper", "water", "oil", "olive oil"]);

/**
 * Match recipe ingredients against active inventory. Deterministic and conservative:
 * if units can't be compared we return "check" instead of assuming it's enough.
 * Earliest-expiring stock is used first (FEFO).
 */
export function matchIngredients(ingredients: RecipeIngredient[], inventory: InventoryItem[], scale = 1): IngredientMatch[] {
  const remaining = new Map(inventory.filter((i) => i.status === "active" && i.quantity > 0).map((i) => [i.id, i.quantity]));
  return ingredients.map((ing) => {
    const candidates = inventory
      .filter((i) => remaining.get(i.id))
      .map((i) => ({ item: i, score: nameMatchScore(ing.name, i.name) }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score || (effectiveExpiry(a.item) ?? "9999").localeCompare(effectiveExpiry(b.item) ?? "9999"));

    if (candidates.length === 0) {
      if (water(ing.name)) return { ingredient: ing, status: "have", missingQuantity: null, deductions: [] };
      return { ingredient: ing, status: "missing", missingQuantity: ing.quantity != null ? round(ing.quantity * scale) : null, deductions: [] };
    }

    if (ing.quantity == null) {
      // "salt to taste" – we have some; nothing to deduct automatically.
      return { ingredient: ing, status: "have", missingQuantity: null, deductions: [] };
    }

    let needed = ing.quantity * scale; // in ingredient unit
    const ingUnit = normalizeUnit(ing.unit);
    const deductions: Deduction[] = [];
    let incomparable = false;
    for (const { item } of candidates) {
      if (needed <= 1e-9) break;
      const avail = remaining.get(item.id)!;
      const availInIng = convert(avail, item.unit, ingUnit);
      if (availInIng == null) {
        incomparable = true;
        continue;
      }
      const take = Math.min(needed, availInIng);
      const takeInItem = convert(take, ingUnit, item.unit)!;
      deductions.push({ item_id: item.id, item_name: item.name, amount: round(takeInItem), unit: item.unit });
      remaining.set(item.id, round(avail - takeInItem));
      needed = round(needed - take);
    }
    if (needed <= 1e-6) return { ingredient: ing, status: "have", missingQuantity: 0, deductions };
    if (PANTRY_STAPLES.has(normalizeName(ing.name)) && deductions.length === 0 && incomparable)
      return { ingredient: ing, status: "check", missingQuantity: null, deductions, note: "Different unit – check amount" };
    if (deductions.length === 0 && incomparable)
      return { ingredient: ing, status: "check", missingQuantity: null, deductions, note: "In stock but in a different unit – confirm amount" };
    return {
      ingredient: ing,
      status: deductions.length ? "partial" : "missing",
      missingQuantity: round(needed),
      deductions,
    };
  });
}

function water(n: string) {
  return normalizeName(n) === "water";
}

export function matchSummary(matches: IngredientMatch[]) {
  const required = matches.filter((m) => !m.ingredient.optional);
  return {
    have: required.filter((m) => m.status === "have").length,
    total: required.length,
    missing: required.filter((m) => m.status === "missing" || m.status === "partial"),
    check: required.filter((m) => m.status === "check"),
  };
}
