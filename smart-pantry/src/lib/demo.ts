// Sample household used when NEXT_PUBLIC_DEMO=1 (screenshots, UI previews). No backend needed.
import type { Cooking, InventoryEvent, InventoryItem, PreferenceOverride, Profile, Rating, Recipe, ShoppingItem } from "./domain/types";

const A = "u-alex", S = "u-sam", H = "demo-household";
const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const ts = (n: number, h = 18) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.toISOString(); };

let i = 0;
const item = (name: string, category: string, quantity: number, unit: string, location: InventoryItem["location"], expiry: number | null, type: InventoryItem["expiry_type"] = "best_before", extra: Partial<InventoryItem> = {}): InventoryItem => ({
  id: `it${++i}`, household_id: H, name, category, quantity, unit, location, purchase_date: day(-3), expiry_date: expiry == null ? null : day(expiry),
  expiry_type: expiry == null ? "none" : type, opened_at: null, days_after_opening: null, low_stock_threshold: null, barcode: null, notes: null, store: i % 3 === 0 ? "Delhaize" : "Lidl",
  status: "active", version: 1, created_by: A, updated_by: i % 3 ? A : S, created_at: ts(-3), updated_at: ts(-(i % 4), 9 + i % 10), ...extra,
});

export const demoMembers: Profile[] = [
  { id: A, display_name: "Alex", avatar_color: "#16a34a", diet: [], allergies: [] },
  { id: S, display_name: "Sam", avatar_color: "#e11d48", diet: [], allergies: ["peanuts"] },
];

export const demoInventory: InventoryItem[] = [
  item("Chicken breast", "meat", 500, "g", "fridge", 1, "use_by"),
  item("Broccoli", "vegetables", 1, "pcs", "fridge", 2),
  item("Cooking cream", "dairy", 200, "ml", "fridge", 3, "use_by", { opened_at: day(-1), days_after_opening: 4 }),
  item("Whole milk", "dairy", 400, "ml", "fridge", 5, "use_by", { opened_at: day(-2), days_after_opening: 5 }),
  item("Greek yoghurt", "dairy", 2, "pcs", "fridge", 0, "use_by"),
  item("Eggs", "eggs", 4, "pcs", "fridge", 12),
  item("Spinach", "vegetables", 150, "g", "fridge", 2),
  item("Parmesan", "dairy", 120, "g", "fridge", 30),
  item("Cherry tomatoes", "vegetables", 250, "g", "fridge", 4),
  item("Lemons", "fruit", 2, "pcs", "fridge", 14),
  item("Salmon fillets", "fish", 2, "pcs", "freezer", 75),
  item("Frozen peas", "vegetables", 600, "g", "freezer", 200),
  item("Minced beef", "meat", 500, "g", "freezer", 90),
  item("Basmati rice", "pasta & rice", 1.5, "kg", "pantry", 300),
  item("Spaghetti", "pasta & rice", 500, "g", "pantry", 240),
  item("Chopped tomatoes", "sauces", 2, "pcs", "pantry", 400),
  item("Olive oil", "oils", 0.6, "l", "pantry", 365),
  item("Garlic", "vegetables", 6, "pcs", "pantry", 20),
  item("Onions", "vegetables", 3, "pcs", "pantry", 25),
  item("Coconut milk", "sauces", 1, "pcs", "pantry", 500),
  item("Soy sauce", "sauces", 150, "ml", "pantry", 200, "best_before", { low_stock_threshold: 200 }),
  item("Bread", "bread", 0.5, "pcs", "pantry", 1),
];

const rec = (id: string, title: string, kind: string, cuisine: string, mins: [number, number], main: string[], methods: string[], ingredients: Recipe["ingredients"], desc: string, why: string, cost: number | null, kcal: number, steps: string[]): Recipe => ({
  id, household_id: H, title, description: `${desc}\n\n${why}`, cuisine, tags: [], main_ingredients: main, methods, ingredients, steps,
  prep_minutes: mins[0], cook_minutes: mins[1], difficulty: "easy", servings: 2, image_url: null, kind, source: "ai", saved: true,
  estimated_missing_cost: cost, nutrition: { kcal, protein_g: 38 }, created_by: A, created_at: ts(0, 17),
});

export const demoRecipes: Recipe[] = [
  rec("r1", "Creamy lemon chicken & broccoli", "practical", "Italian", [10, 20], ["chicken breast", "broccoli", "cream"], ["pan-fry"],
    [{ name: "Chicken breast", quantity: 400, unit: "g" }, { name: "Broccoli", quantity: 1, unit: "pcs" }, { name: "Cooking cream", quantity: 200, unit: "ml" },
     { name: "Garlic", quantity: 2, unit: "pcs" }, { name: "Lemons", quantity: 1, unit: "pcs" }, { name: "Parmesan", quantity: 40, unit: "g" }, { name: "Spaghetti", quantity: 200, unit: "g" }],
    "Golden seared chicken in a silky lemon-garlic cream with tender broccoli, tossed through spaghetti.",
    "Uses the chicken (use-by tomorrow), broccoli and opened cream together – zero shopping needed.", null, 720,
    ["Slice the chicken and season with salt and pepper.", "Cook the spaghetti; add broccoli florets for the last 3 minutes.", "Sear the chicken in olive oil until cooked through, 6–7 min.", "Add garlic, then cream, lemon zest and juice; simmer 2 min.", "Toss in the pasta, broccoli and parmesan. Serve."]),
  rec("r2", "Teriyaki salmon rice bowls", "favourite", "Japanese", [10, 15], ["salmon", "rice", "soy sauce"], ["bake"],
    [{ name: "Salmon fillets", quantity: 2, unit: "pcs" }, { name: "Basmati rice", quantity: 150, unit: "g" }, { name: "Soy sauce", quantity: 3, unit: "tbsp" },
     { name: "Honey", quantity: 1, unit: "tbsp" }, { name: "Spring onion", quantity: 2, unit: "pcs" }, { name: "Frozen peas", quantity: 100, unit: "g" }],
    "Sticky glazed salmon over fluffy rice with peas and spring onion.",
    "You both rated the miso salmon 5/5 – this is a quick weeknight cousin.", 2.1, 610,
    ["Defrost salmon overnight in the fridge.", "Cook rice.", "Mix soy sauce and honey, brush over salmon.", "Bake 12 min at 200 °C, glazing halfway.", "Serve over rice with peas and spring onion."]),
  rec("r3", "Turkish eggs (çılbır) with spinach", "discovery", "Turkish", [10, 10], ["egg", "yoghurt", "spinach"], ["poach"],
    [{ name: "Eggs", quantity: 4, unit: "pcs" }, { name: "Greek yoghurt", quantity: 1, unit: "pcs" }, { name: "Spinach", quantity: 150, unit: "g" },
     { name: "Garlic", quantity: 1, unit: "pcs" }, { name: "Bread", quantity: 0.5, unit: "pcs" }, { name: "Aleppo pepper", quantity: 1, unit: "tsp" }],
    "Poached eggs on garlicky yoghurt with wilted spinach and chilli butter.",
    "New for you: a technique (poaching) and cuisine you haven't tried, using yoghurt that expires today.", 1.5, 480,
    ["Stir grated garlic into the yoghurt and spread on plates.", "Wilt the spinach in a pan.", "Poach the eggs 3 minutes.", "Melt butter with Aleppo pepper.", "Top yoghurt with spinach and eggs, drizzle with chilli butter."]),
  rec("r4", "Thai green chicken curry", "favourite", "Thai", [15, 20], ["chicken", "coconut milk"], ["simmer"],
    [{ name: "Chicken breast", quantity: 400, unit: "g" }, { name: "Coconut milk", quantity: 400, unit: "ml" }, { name: "Basmati rice", quantity: 150, unit: "g" }], "Fragrant weeknight curry.", "", null, 650, ["Cook."]),
  rec("r5", "Spaghetti bolognese", "favourite", "Italian", [10, 40], ["ground beef", "tomato"], ["simmer"],
    [{ name: "Minced beef", quantity: 500, unit: "g" }, { name: "Chopped tomatoes", quantity: 2, unit: "pcs" }, { name: "Spaghetti", quantity: 300, unit: "g" }], "Classic ragù.", "", null, 700, ["Cook."]),
  rec("r6", "Mushroom risotto", "discovery", "Italian", [10, 30], ["mushroom", "rice"], ["simmer"], [{ name: "Mushrooms", quantity: 300, unit: "g" }], "Earthy risotto.", "", null, 550, ["Cook."]),
];

const ck = (id: string, recipe_id: string, by: string, d: number, extra: Partial<Cooking> = {}): Cooking => ({ id, household_id: H, recipe_id, cooked_by: by, cooked_at: ts(d), followed_exactly: true, modifications: null, servings: 2, ...extra });
export const demoCookings: Cooking[] = [
  ck("c1", "r4", S, -1), ck("c2", "r5", A, -3, { followed_exactly: false, modifications: "Added red wine and extra garlic" }), ck("c3", "r4", A, -8),
  ck("c4", "r6", S, -10), ck("c5", "r5", S, -16), ck("c6", "r2", A, -20),
];
const rt = (id: string, c: string, r: string, u: string, v: number, comment: string | null = null, d = -1): Rating => ({ id, household_id: H, cooking_id: c, recipe_id: r, user_id: u, rating: v, comment, created_at: ts(d, 21) });
export const demoRatings: Rating[] = [
  rt("x1", "c1", "r4", A, 5, "Best one yet"), rt("x2", "c1", "r4", S, 5), rt("x3", "c2", "r5", A, 5, null, -3), rt("x4", "c2", "r5", S, 4, "A bit salty", -3),
  rt("x5", "c4", "r6", A, 4, null, -10), rt("x6", "c4", "r6", S, 2, "Not a fan of mushrooms", -10), rt("x7", "c6", "r2", A, 5, null, -20), rt("x8", "c6", "r2", S, 5, null, -20),
];
export const demoOverrides: PreferenceOverride[] = [{ id: "o1", household_id: H, user_id: A, kind: "ingredient", value: "coriander", stance: "love" }];

let e = 0;
const ev = (item_id: string, reason: string, before: number, after: number, unit: string, by: string, d: number, h = 12): InventoryEvent => ({
  id: ++e, household_id: H, item_id, user_id: by, reason, quantity_before: before, quantity_after: after, delta: after - before, unit, location_from: null, location_to: null, note: null, created_at: ts(d, h),
});
export const demoEvents: InventoryEvent[] = [
  ev("it4", "consumed", 650, 400, "ml", S, 0, 8), ev("it1", "purchased", 0, 500, "g", A, 0, 7), ev("it5", "consumed", 3, 2, "pcs", S, -1, 10),
  ev("it6", "consumed", 6, 4, "pcs", A, -1, 9), ev("it22", "spoiled", 0.5, 0, "pcs", S, -2, 19), ev("it4", "consumed", 1000, 650, "ml", A, -2, 8),
  ev("it4", "consumed", 500, 250, "ml", A, -6, 8), ev("it4", "consumed", 1000, 500, "ml", S, -10, 8), ev("it6", "consumed", 10, 6, "pcs", S, -9, 9),
  ev("it6", "consumed", 6, 2, "pcs", A, -15, 9), ev("it22", "consumed", 1, 0.5, "pcs", A, -4, 8), ev("it22", "consumed", 1, 0.5, "pcs", S, -11, 8),
];
const sh = (id: string, name: string, n: string, category: string, quantity: number | null, unit: string | null, by: string, extra: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id, household_id: H, name, normalized_name: n, category, quantity, unit, notes: null, recipe_id: null, store: null, status: "open", added_by: by, purchased_by: null, purchased_at: null, created_at: ts(-1), ...extra,
});
export const demoShopping: ShoppingItem[] = [
  sh("s1", "Honey", "honey", "other", 1, "tbsp", A, { recipe_id: "r2", store: "Delhaize" }), sh("s2", "Spring onion", "spring onion", "vegetables", 2, "pcs", A, { recipe_id: "r2", store: "Lidl" }),
  sh("s3", "Bananas", "banana", "fruit", 6, "pcs", S, { notes: "not too ripe", store: "Lidl" }), sh("s4", "Toilet paper", "toilet paper", "other", null, null, S),
  sh("s5", "Oat milk", "oat milk", "drinks", 1, "l", S, { status: "purchased", purchased_by: A, purchased_at: ts(-1) }),
];
export const demoHousehold = { id: H, name: "Alex & Sam's kitchen", currency: "EUR", expiry_alert_days: 3, stores: ["Lidl", "Delhaize"] };
export const demoUser = { id: A, email: "alex@example.com" };
