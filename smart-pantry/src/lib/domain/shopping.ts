import type { InventoryItem, ShoppingItem } from "./types";
import type { IngredientMatch } from "./matching";
import { normalizeName } from "./names";
import { normalizeUnit } from "./units";

export interface ShoppingDraft {
  name: string;
  normalized_name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
}

/** Turn missing/partial recipe ingredients into shopping-list entries. Never adds what we have. */
export function shoppingFromMatches(matches: IngredientMatch[]): ShoppingDraft[] {
  return matches
    .filter((m) => !m.ingredient.optional && (m.status === "missing" || m.status === "partial"))
    .map((m) => ({
      name: m.ingredient.name,
      normalized_name: normalizeName(m.ingredient.name),
      quantity: m.missingQuantity,
      unit: m.ingredient.unit ? normalizeUnit(m.ingredient.unit) : null,
      category: guessCategory(m.ingredient.name),
    }));
}

/** Items at/below their low-stock threshold that aren't already on the list. */
export function lowStockSuggestions(inventory: InventoryItem[], list: ShoppingItem[]): InventoryItem[] {
  const open = new Set(list.filter((s) => s.status === "open").map((s) => s.normalized_name));
  return inventory.filter(
    (i) => i.low_stock_threshold != null && i.status !== "spoiled" && i.quantity <= i.low_stock_threshold && !open.has(normalizeName(i.name)),
  );
}

export function groupByCategory<T extends { category: string }>(items: T[]): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const i of items) m.set(i.category, [...(m.get(i.category) ?? []), i]);
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
}

const CATEGORY_WORDS: [string, string[]][] = [
  ["meat", ["chicken", "beef", "pork", "lamb", "bacon", "sausage", "mince", "ham", "turkey"]],
  ["fish", ["salmon", "tuna", "cod", "shrimp", "prawn", "fish", "mussel"]],
  ["dairy", ["milk", "cream", "cheese", "yoghurt", "yogurt", "butter", "parmesan", "mozzarella", "feta"]],
  ["eggs", ["egg"]],
  ["vegetables", ["onion", "garlic", "carrot", "broccoli", "spinach", "tomato", "pepper", "potato", "zucchini", "lettuce", "mushroom", "leek", "cabbage", "cucumber", "eggplant"]],
  ["fruit", ["apple", "banana", "lemon", "lime", "orange", "berry", "avocado", "pear", "mango"]],
  ["pasta & rice", ["pasta", "rice", "noodle", "spaghetti", "penne", "couscous"]],
  ["grains", ["flour", "oat", "quinoa", "bulgur"]],
  ["bread", ["bread", "tortilla", "wrap", "pita"]],
  ["legumes", ["bean", "lentil", "chickpea"]],
  ["spices", ["salt", "cumin", "paprika", "oregano", "thyme", "basil", "cinnamon", "chili", "curry"]],
  ["sauces", ["sauce", "ketchup", "mayo", "mustard", "soy", "stock", "broth", "vinegar", "paste"]],
  ["oils", ["oil"]],
];
export function guessCategory(name: string): string {
  const n = normalizeName(name);
  for (const [cat, words] of CATEGORY_WORDS) if (words.some((w) => n.includes(w))) return cat;
  return "other";
}
