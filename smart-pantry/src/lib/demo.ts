import { normalizeName } from "./domain/names";
// Sample household used when NEXT_PUBLIC_DEMO=1 (screenshots, UI previews). No backend needed.
import type { StoreProduct, Cooking, InventoryEvent, InventoryItem, PreferenceOverride, Profile, Rating, Recipe, ShoppingItem } from "./domain/types";

const A = "u-alex", S = "u-sam", H = "demo-household";
const day = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const ts = (n: number, h = 18) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.toISOString(); };

let i = 0;
const item = (name: string, category: string, quantity: number, unit: string, location: InventoryItem["location"], expiry: number | null, type: InventoryItem["expiry_type"] = "best_before", extra: Partial<InventoryItem> = {}): InventoryItem => ({
  id: `it${++i}`, household_id: H, name, category, quantity, unit, location, purchase_date: day(-3), expiry_date: expiry == null ? null : day(expiry),
  expiry_type: expiry == null ? "none" : type, expiry_estimated: ["vegetables", "fruit"].includes(category), opened_at: null, days_after_opening: null, low_stock_threshold: null, barcode: null, notes: null, store: i % 3 === 0 ? "Delhaize" : "Colruyt",
  status: "active", version: 1, created_by: A, updated_by: i % 3 ? A : S, created_at: ts(-3), updated_at: ts(-(i % 4), 9 + i % 10), ...extra,
});

export const demoMembers: Profile[] = [
  { id: A, display_name: "Alex", avatar_color: "#16a34a", diet: [], allergies: [] },
  { id: S, display_name: "Sam", avatar_color: "#e11d48", diet: [], allergies: ["peanuts"] },
];

export const demoInventory: InventoryItem[] = [
  item("Kipfilet", "meat", 500, "g", "fridge", 1, "use_by"),
  item("Broccoli", "vegetables", 1, "pcs", "fridge", 2),
  item("Kookroom", "dairy", 200, "ml", "fridge", 3, "use_by", { opened_at: day(-1), days_after_opening: 4 }),
  item("Halfvolle melk", "dairy", 400, "ml", "fridge", 5, "use_by", { opened_at: day(-2), days_after_opening: 5 }),
  item("Griekse yoghurt", "dairy", 2, "pcs", "fridge", 0, "use_by"),
  item("Eieren", "eggs", 4, "pcs", "fridge", 12),
  item("Spinazie", "vegetables", 150, "g", "fridge", 2),
  item("Parmezaan", "dairy", 120, "g", "fridge", 30),
  item("Kerstomaten", "vegetables", 250, "g", "fridge", 4),
  item("Citroenen", "fruit", 2, "pcs", "fridge", 14),
  item("Zalmfilets", "fish", 2, "pcs", "freezer", 75),
  item("Diepvreeserwten", "vegetables", 600, "g", "freezer", 200),
  item("Gehakt", "meat", 500, "g", "freezer", 90),
  item("Basmatirijst", "pasta & rice", 1.5, "kg", "pantry", 300),
  item("Spaghetti", "pasta & rice", 500, "g", "pantry", 240),
  item("Tomatenblokjes", "sauces", 2, "pcs", "pantry", 400),
  item("Olijfolie", "oils", 0.6, "l", "pantry", 365),
  item("Look", "vegetables", 6, "pcs", "pantry", 20),
  item("Uien", "vegetables", 3, "pcs", "pantry", 25),
  item("Kokosmelk", "sauces", 1, "pcs", "pantry", 500),
  item("Sojasaus", "sauces", 150, "ml", "pantry", 200, "best_before", { low_stock_threshold: 200 }),
  item("Brood", "bread", 0.5, "pcs", "pantry", 1),
];

const rec = (id: string, title: string, kind: string, cuisine: string, mins: [number, number], main: string[], methods: string[], ingredients: Recipe["ingredients"], desc: string, why: string, cost: number | null, kcal: number, steps: string[]): Recipe => ({
  id, household_id: H, title, description: `${desc}\n\n${why}`, cuisine, tags: [], main_ingredients: main, methods, ingredients, steps,
  prep_minutes: mins[0], cook_minutes: mins[1], difficulty: "easy", servings: 2, image_url: null, kind, source: "ai", saved: true,
  estimated_missing_cost: cost, nutrition: { kcal, protein_g: 38 }, created_by: A, created_at: ts(0, 17),
});

export const demoRecipes: Recipe[] = [
  rec("r1", "Romige citroenkip met broccoli", "practical", "italiaans", [10, 20], ["kippenborst", "broccoli", "room"], ["bakken"],
    [{ name: "Kipfilet", quantity: 400, unit: "g" }, { name: "Broccoli", quantity: 1, unit: "pcs" }, { name: "Kookroom", quantity: 200, unit: "ml" },
     { name: "Look", quantity: 2, unit: "pcs" }, { name: "Citroenen", quantity: 1, unit: "pcs" }, { name: "Parmezaan", quantity: 40, unit: "g" }, { name: "Spaghetti", quantity: 200, unit: "g" }],
    "Goudbruin gebakken kip in een zachte citroen-looksaus met broccoli, door de spaghetti geschept.",
    "Gebruikt de kip (morgen vervaldag), de broccoli en de geopende room samen – je hoeft niets te kopen.", null, 720,
    ["Snijd de kip in reepjes en kruid met peper en zout.", "Kook de spaghetti; voeg de broccoliroosjes de laatste 3 minuten toe.", "Bak de kip gaar in olijfolie, 6–7 min.", "Voeg look toe, dan de room, citroenrasp en -sap; 2 min laten sudderen.", "Schep de pasta, broccoli en parmezaan erdoor. Opdienen."]),
  rec("r2", "Teriyaki-zalm met rijst", "favourite", "japans", [10, 15], ["zalm", "rijst", "sojasaus"], ["oven"],
    [{ name: "Zalmfilets", quantity: 2, unit: "pcs" }, { name: "Basmatirijst", quantity: 150, unit: "g" }, { name: "Sojasaus", quantity: 3, unit: "tbsp" },
     { name: "Honing", quantity: 1, unit: "tbsp" }, { name: "Lente-ui", quantity: 2, unit: "pcs" }, { name: "Diepvreeserwten", quantity: 100, unit: "g" }],
    "Gelakte zalm op luchtige rijst met erwtjes en lente-ui.",
    "Jullie gaven de miso-zalm allebei 5/5 – dit is een snelle doordeweekse variant.", 2.1, 610,
    ["Laat de zalm een nacht ontdooien in de koelkast.", "Kook de rijst.", "Meng sojasaus en honing en bestrijk de zalm.", "12 min in de oven op 200 °C, halverwege opnieuw insmeren.", "Serveer op de rijst met erwtjes en lente-ui."]),
  rec("r3", "Turkse eieren (çılbır) met spinazie", "discovery", "turks", [10, 10], ["ei", "yoghurt", "spinazie"], ["pocheren"],
    [{ name: "Eieren", quantity: 4, unit: "pcs" }, { name: "Griekse yoghurt", quantity: 1, unit: "pcs" }, { name: "Spinazie", quantity: 150, unit: "g" },
     { name: "Look", quantity: 1, unit: "pcs" }, { name: "Brood", quantity: 0.5, unit: "pcs" }, { name: "Pul biber", quantity: 1, unit: "tsp" }],
    "Gepocheerde eieren op yoghurt met look, gestoofde spinazie en chiliboter.",
    "Nieuw voor jullie: een techniek (pocheren) en keuken die jullie nog niet probeerden, met de yoghurt die vandaag vervalt.", 1.5, 480,
    ["Roer geraspte look door de yoghurt en verdeel over de borden.", "Laat de spinazie slinken in een pan.", "Pocheer de eieren 3 minuten.", "Smelt boter met pul biber.", "Leg spinazie en eieren op de yoghurt en besprenkel met de chiliboter."]),
  rec("r4", "Thaise groene curry met kip", "favourite", "thais", [15, 20], ["kip", "kokosmelk"], ["stoven"],
    [{ name: "Kipfilet", quantity: 400, unit: "g" }, { name: "Kokosmelk", quantity: 400, unit: "ml" }, { name: "Basmatirijst", quantity: 150, unit: "g" }], "Geurige doordeweekse curry.", "", null, 650, ["Koken."]),
  rec("r5", "Spaghetti bolognaise", "favourite", "italiaans", [10, 40], ["gehakt", "tomaat"], ["stoven"],
    [{ name: "Gehakt", quantity: 500, unit: "g" }, { name: "Tomatenblokjes", quantity: 2, unit: "pcs" }, { name: "Spaghetti", quantity: 300, unit: "g" }], "Klassieke bolognaise.", "", null, 700, ["Koken."]),
  rec("r6", "Champignonrisotto", "discovery", "italiaans", [10, 30], ["champignon", "rijst"], ["stoven"], [{ name: "Champignons", quantity: 300, unit: "g" }], "Romige risotto.", "", null, 550, ["Koken."]),
];

const ck = (id: string, recipe_id: string, by: string, d: number, extra: Partial<Cooking> = {}): Cooking => ({ id, household_id: H, recipe_id, cooked_by: by, cooked_at: ts(d), followed_exactly: true, modifications: null, servings: 2, ...extra });
export const demoCookings: Cooking[] = [
  ck("c1", "r4", S, -1), ck("c2", "r5", A, -3, { followed_exactly: false, modifications: "Rode wijn en extra look toegevoegd" }), ck("c3", "r4", A, -8),
  ck("c4", "r6", S, -10), ck("c5", "r5", S, -16), ck("c6", "r2", A, -20),
];
const rt = (id: string, c: string, r: string, u: string, v: number, comment: string | null = null, d = -1): Rating => ({ id, household_id: H, cooking_id: c, recipe_id: r, user_id: u, rating: v, comment, created_at: ts(d, 21) });
export const demoRatings: Rating[] = [
  rt("x1", "c1", "r4", A, 5, "De beste tot nu toe"), rt("x2", "c1", "r4", S, 5), rt("x3", "c2", "r5", A, 5, null, -3), rt("x4", "c2", "r5", S, 4, "Wat zout", -3),
  rt("x5", "c4", "r6", A, 4, null, -10), rt("x6", "c4", "r6", S, 2, "Geen fan van champignons", -10), rt("x7", "c6", "r2", A, 5, null, -20), rt("x8", "c6", "r2", S, 5, null, -20),
];
export const demoOverrides: PreferenceOverride[] = [{ id: "o1", household_id: H, user_id: A, kind: "ingredient", value: "koriander", stance: "love" }];

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
  id, household_id: H, name, normalized_name: normalizeName(name), category, quantity, unit, notes: null, recipe_id: null, store: null, status: "open", added_by: by, purchased_by: null, purchased_at: null, created_at: ts(-1), ...extra,
});
export const demoShopping: ShoppingItem[] = [
  sh("s1", "Honing", "honey", "other", 1, "tbsp", A, { recipe_id: "r2", store: "Delhaize" }), sh("s2", "Lente-ui", "spring onion", "vegetables", 2, "pcs", A, { recipe_id: "r2", store: "Colruyt" }),
  sh("s3", "Bananen", "banana", "fruit", 6, "pcs", S, { notes: "niet te rijp", store: "Colruyt" }), sh("s4", "Toiletpapier", "toilet paper", "other", null, null, S, { store: "Colruyt" }), sh("s6", "Eieren", "egg", "eggs", 12, "pcs", A, { store: "Colruyt" }), sh("s7", "Uien", "onion", "vegetables", 1, "kg", S, { store: "Colruyt" }), sh("s8", "Koffiebonen", "coffee bean", "drinks", 1, "pcs", A, { store: "Colruyt" }),
  sh("s5", "Havermelk", "oat milk", "drinks", 1, "l", S, { status: "purchased", purchased_by: A, purchased_at: ts(-1) }),
];
export const demoHousehold = { id: H, name: "Keuken van Alex & Sam", currency: "EUR", expiry_alert_days: 3, stores: ["Delhaize", "Colruyt"] };
export const demoUser = { id: A, email: "alex@example.com" };

const walk = (store: string, names: [string, string][]): StoreProduct[] =>
  names.map(([name, category], position) => ({ household_id: H, store, normalized_name: normalizeName(name), name, category, position }));
export const demoStoreProducts: StoreProduct[] = [
  ...walk("Colruyt", [["Bananen", "fruit"], ["Citroenen", "fruit"], ["Lente-ui", "vegetables"], ["Broccoli", "vegetables"], ["Kerstomaten", "vegetables"], ["Uien", "vegetables"],
    ["Look", "vegetables"], ["Basmatirijst", "pasta & rice"], ["Spaghetti", "pasta & rice"], ["Tomatenblokjes", "sauces"], ["Kokosmelk", "sauces"], ["Olijfolie", "oils"],
    ["Toiletpapier", "other"], ["Kipfilet", "meat"], ["Gehakt", "meat"], ["Eieren", "eggs"], ["Halfvolle melk", "dairy"], ["Griekse yoghurt", "dairy"], ["Diepvreeserwten", "frozen"]]),
  ...walk("Delhaize", [["Brood", "bread"], ["Spinazie", "vegetables"], ["Honing", "other"], ["Sojasaus", "sauces"], ["Parmezaan", "dairy"], ["Kookroom", "dairy"], ["Zalmfilets", "fish"]]),
];
