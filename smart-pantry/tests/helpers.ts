import type { InventoryItem, Rating, Recipe } from "@/lib/domain/types";
let n = 0;
export function item(p: Partial<InventoryItem>): InventoryItem {
  n++;
  return {
    id: `i${n}`, household_id: "h", name: "x", category: "other", quantity: 1, unit: "pcs", location: "fridge",
    purchase_date: null, expiry_date: null, expiry_type: "best_before", opened_at: null, days_after_opening: null,
    low_stock_threshold: null, barcode: null, notes: null, status: "active", version: 1, created_by: null,
    updated_by: null, created_at: "", updated_at: "", ...p,
  };
}
export function recipe(p: Partial<Recipe>): Recipe {
  n++;
  return {
    id: `r${n}`, household_id: "h", title: "R", description: null, cuisine: null, tags: [], main_ingredients: [], methods: [],
    ingredients: [], steps: [], prep_minutes: 10, cook_minutes: 20, difficulty: "easy", servings: 2, image_url: null,
    kind: null, source: "ai", saved: true, estimated_missing_cost: null, nutrition: null, created_by: null, created_at: "", ...p,
  };
}
export function rating(user: string, recipe_id: string, value: number, at = "2026-01-01"): Rating {
  n++;
  return { id: `x${n}`, household_id: "h", cooking_id: `c${n}`, recipe_id, user_id: user, rating: value, comment: null, created_at: at };
}
