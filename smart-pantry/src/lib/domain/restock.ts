import type { Cooking, InventoryEvent, InventoryItem, Recipe, ShoppingItem } from "./types";
import { normalizeName } from "./names";
import { convert, dimensionOf, normalizeUnit, round } from "./units";
import { daysBetween } from "./expiry";
import { guessCategory } from "./shopping";

export interface RestockSuggestion {
  name: string;
  normalized_name: string;
  category: string;
  quantity: number;
  unit: string;
  inStock: number;
  daysLeft: number | null; // days of stock left at the usual rate (null = none in stock)
  reason: string;
  score: number;
}

const BASE: Record<string, string> = { mass: "g", volume: "ml", count: "pcs" };

/**
 * Deterministic "you'll probably need this soon" list:
 *  • products you use regularly (from the consumption log) whose stock covers < `horizon` days
 *  • ingredients of recipes you cook often that are missing or low
 * Excludes anything already on the open shopping list.
 */
export function restockSuggestions(input: {
  inventory: InventoryItem[];
  events: InventoryEvent[];
  cookings: Cooking[];
  recipes: Recipe[];
  shopping: ShoppingItem[];
  today: string;
  windowDays?: number;
  horizon?: number;
}): RestockSuggestion[] {
  const { inventory, events, cookings, recipes, shopping, today } = input;
  const windowDays = input.windowDays ?? 30;
  const horizon = input.horizon ?? 7;
  const itemById = new Map(inventory.map((i) => [i.id, i]));
  const onList = new Set(shopping.filter((s) => s.status === "open").map((s) => s.normalized_name));

  type Acc = { name: string; unit: string; used: number; uses: number; first: string; stock: number; category: string; recipeHits: number; recipeQty: number };
  const acc = new Map<string, Acc>();
  const key = (name: string, unit: string) => `${normalizeName(name)}|${dimensionOf(unit) ?? normalizeUnit(unit)}`;
  const get = (name: string, unit: string, category?: string) => {
    const k = key(name, unit);
    const base = BASE[dimensionOf(unit) ?? ""] ?? normalizeUnit(unit);
    if (!acc.has(k)) acc.set(k, { name, unit: base, used: 0, uses: 0, first: today, stock: 0, category: category ?? guessCategory(name), recipeHits: 0, recipeQty: 0 });
    return acc.get(k)!;
  };
  const toBase = (q: number, unit: string, a: Acc) => convert(q, unit, a.unit) ?? (normalizeUnit(unit) === a.unit ? q : 0);

  for (const e of events) {
    if (e.reason !== "consumed" && e.reason !== "cooked") continue;
    if (daysBetween(e.created_at.slice(0, 10), today) > windowDays) continue;
    const it = itemById.get(e.item_id);
    if (!it || e.delta == null || Number(e.delta) >= 0) continue;
    const a = get(it.name, it.unit, it.category);
    a.used += toBase(-Number(e.delta), e.unit ?? it.unit, a);
    a.uses += 1;
    if (e.created_at.slice(0, 10) < a.first) a.first = e.created_at.slice(0, 10);
  }

  // Recipes cooked at least twice in the window count as "regulars".
  const counts = new Map<string, number>();
  for (const c of cookings) if (daysBetween(c.cooked_at.slice(0, 10), today) <= windowDays * 2) counts.set(c.recipe_id, (counts.get(c.recipe_id) ?? 0) + 1);
  for (const r of recipes) {
    const n = counts.get(r.id) ?? 0;
    if (n < 2) continue;
    for (const ing of r.ingredients) {
      if (ing.optional || ing.quantity == null) continue;
      const a = get(ing.name, ing.unit ?? "pcs");
      a.recipeHits += n;
      a.recipeQty = Math.max(a.recipeQty, toBase(ing.quantity, ing.unit ?? "pcs", a));
    }
  }

  for (const it of inventory) {
    if (it.status !== "active") continue;
    const k = key(it.name, it.unit);
    const a = acc.get(k);
    if (a) a.stock += toBase(it.quantity, it.unit, a);
  }

  const out: RestockSuggestion[] = [];
  for (const a of acc.values()) {
    const norm = normalizeName(a.name);
    if (onList.has(norm)) continue;
    const span = Math.max(14, daysBetween(a.first, today) + 1);
    const rate = a.used / span; // per day
    const regularUse = a.uses >= 2 && rate > 0;
    const daysLeft = regularUse ? (a.stock > 0 ? Math.floor(a.stock / rate) : 0) : null;
    let quantity = 0;
    let reason = "";
    let score = 0;
    if (regularUse && daysLeft! < horizon) {
      quantity = rate * horizon * 1.5 - a.stock; // ~1½ weeks of cover
      reason = a.stock <= 0 ? `Out of stock · you use it ${a.uses}× a month` : `~${daysLeft} day${daysLeft === 1 ? "" : "s"} left at your usual pace`;
      score = 10 - daysLeft! + a.uses;
    }
    if (a.recipeHits >= 2 && a.stock < a.recipeQty) {
      const need = a.recipeQty - a.stock;
      if (need > quantity) quantity = need;
      reason = reason || `Needed for recipes you cook often (${a.recipeHits}×)`;
      score = Math.max(score, 5 + a.recipeHits);
    }
    if (quantity <= 0) continue;
    out.push({ name: a.name, normalized_name: norm, category: a.category, quantity: nice(quantity, a.unit), unit: a.unit, inStock: round(a.stock), daysLeft, reason, score });
  }
  return out.sort((x, y) => y.score - x.score);
}

/** Round to shop-friendly amounts: 250 g steps, 0.5 l steps, whole pieces. */
function nice(q: number, unit: string): number {
  if (unit === "g") return q >= 1000 ? Math.ceil(q / 500) * 500 : Math.ceil(q / 250) * 250;
  if (unit === "ml") return Math.ceil(q / 500) * 500;
  return Math.ceil(q);
}
