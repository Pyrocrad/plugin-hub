export type Location = "fridge" | "freezer" | "pantry" | "other";
export type ExpiryType = "use_by" | "best_before" | "none";
export type ItemStatus = "active" | "consumed" | "spoiled" | "discarded";

export interface InventoryItem {
  id: string;
  household_id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: Location;
  purchase_date: string | null;
  expiry_date: string | null;
  expiry_type: ExpiryType;
  opened_at: string | null;
  days_after_opening: number | null;
  low_stock_threshold: number | null;
  barcode: string | null;
  notes: string | null;
  store: string | null;
  status: ItemStatus;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  optional?: boolean;
}

export interface Recipe {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  cuisine: string | null;
  tags: string[];
  main_ingredients: string[];
  methods: string[];
  ingredients: RecipeIngredient[];
  steps: string[];
  prep_minutes: number | null;
  cook_minutes: number | null;
  difficulty: "easy" | "medium" | "hard" | null;
  servings: number | null;
  image_url: string | null;
  kind: string | null;
  source: "ai" | "manual";
  saved: boolean;
  estimated_missing_cost: number | null;
  nutrition: { kcal?: number; protein_g?: number } | null;
  created_by: string | null;
  created_at: string;
}

export interface Cooking {
  id: string;
  household_id: string;
  recipe_id: string;
  cooked_by: string;
  cooked_at: string;
  followed_exactly: boolean;
  modifications: string | null;
  servings: number | null;
}

export interface Rating {
  id: string;
  household_id: string;
  cooking_id: string;
  recipe_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export type Stance = "love" | "like" | "neutral" | "dislike" | "never";
export interface PreferenceOverride {
  id: string;
  household_id: string;
  user_id: string;
  kind: "ingredient" | "cuisine" | "method";
  value: string;
  stance: Stance;
}

export interface ShoppingItem {
  id: string;
  household_id: string;
  name: string;
  normalized_name: string;
  category: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  recipe_id: string | null;
  store: string | null;
  status: "open" | "purchased";
  added_by: string | null;
  purchased_by: string | null;
  purchased_at: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_color: string;
  diet: string[];
  allergies: string[];
}

export interface InventoryEvent {
  id: number;
  household_id: string;
  item_id: string;
  user_id: string | null;
  reason: string;
  quantity_before: number | null;
  quantity_after: number | null;
  delta: number | null;
  unit: string | null;
  location_from: string | null;
  location_to: string | null;
  note: string | null;
  created_at: string;
}

export const CATEGORIES = [
  "vegetables", "fruit", "meat", "fish", "dairy", "eggs", "grains", "bread", "pasta & rice",
  "legumes", "spices", "sauces", "oils", "baking", "snacks", "drinks", "frozen", "other",
] as const;

export const LOCATIONS: { id: Location; label: string; icon: string }[] = [
  { id: "fridge", label: "Fridge", icon: "🧊" },
  { id: "freezer", label: "Freezer", icon: "❄️" },
  { id: "pantry", label: "Pantry", icon: "🥫" },
  { id: "other", label: "Other", icon: "📦" },
];

export interface StoreProduct {
  household_id: string;
  store: string;
  normalized_name: string;
  name: string;
  category: string;
  position: number;
}
