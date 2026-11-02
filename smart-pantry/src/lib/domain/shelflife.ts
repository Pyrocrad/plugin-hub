import type { ExpiryType, Location } from "./types";
import { matchKey } from "./names";

/**
 * Typical shelf life (days) after purchase, per storage place.
 * Conservative household guidance (fresh, unopened). Products with a printed date
 * should use that date instead – these are only defaults for when there is none.
 * opened = days it keeps once opened (in the fridge).
 */
interface Shelf { fridge?: number; freezer?: number; pantry?: number; opened?: number; type: ExpiryType }
const T: [string[], Shelf][] = [
  // vegetables
  [["broccoli", "bloemkool", "cauliflower"], { fridge: 5, freezer: 300, pantry: 1, type: "best_before" }],
  [["tomaat", "tomato", "kerstomaat", "cherry tomato"], { fridge: 7, pantry: 5, type: "best_before" }],
  [["spinazie", "spinach", "sla", "lettuce", "rucola", "veldsla", "salade"], { fridge: 4, type: "best_before" }],
  [["wortel", "carrot"], { fridge: 21, pantry: 5, freezer: 300, type: "best_before" }],
  [["paprika", "pepper", "bell pepper"], { fridge: 10, pantry: 3, freezer: 240, type: "best_before" }],
  [["courgette", "zucchini", "aubergine", "eggplant"], { fridge: 6, pantry: 2, type: "best_before" }],
  [["komkommer", "cucumber"], { fridge: 7, pantry: 2, type: "best_before" }],
  [["champignon", "mushroom"], { fridge: 5, freezer: 240, type: "best_before" }],
  [["prei", "leek"], { fridge: 10, freezer: 240, type: "best_before" }],
  [["witloof", "chicory"], { fridge: 7, type: "best_before" }],
  [["boon", "sperzieboon", "green bean"], { fridge: 5, freezer: 300, type: "best_before" }],
  [["lente-ui", "spring onion"], { fridge: 7, type: "best_before" }],
  [["ui", "onion", "sjalot", "shallot"], { pantry: 30, fridge: 30, type: "best_before" }],
  [["look", "garlic"], { pantry: 60, type: "best_before" }],
  [["aardappel", "potato"], { pantry: 30, type: "best_before" }],
  [["kool", "cabbage", "spruit", "brussels sprout"], { fridge: 14, type: "best_before" }],
  [["verse kruiden", "peterselie", "parsley", "koriander", "coriander", "basilicum", "basil", "bieslook"], { fridge: 5, type: "best_before" }],
  [["avocado"], { pantry: 4, fridge: 7, type: "best_before" }],
  // fruit
  [["banaan", "banana"], { pantry: 5, type: "best_before" }],
  [["appel", "apple"], { fridge: 30, pantry: 14, type: "best_before" }],
  [["peer", "pear"], { fridge: 10, pantry: 5, type: "best_before" }],
  [["citroen", "lemon", "limoen", "lime"], { fridge: 21, pantry: 7, type: "best_before" }],
  [["sinaasappel", "orange", "mandarijn"], { fridge: 21, pantry: 10, type: "best_before" }],
  [["aardbei", "strawberry", "framboos", "raspberry", "bes", "berry", "blauwe bes", "blueberry"], { fridge: 3, freezer: 240, type: "best_before" }],
  [["druif", "grape"], { fridge: 7, type: "best_before" }],
  [["kiwi"], { fridge: 21, pantry: 5, type: "best_before" }],
  // meat & fish (fresh = safety date)
  [["gehakt", "ground beef", "mince"], { fridge: 1, freezer: 90, type: "use_by" }],
  [["kip", "kippenborst", "chicken", "chicken breast", "kalkoen", "turkey"], { fridge: 2, freezer: 270, type: "use_by" }],
  [["rundvlees", "biefstuk", "steak", "stoofvlees", "runderstoofvlees", "varkensvlees", "pork", "lamb", "lam"], { fridge: 3, freezer: 180, type: "use_by" }],
  [["worst", "sausage", "chipolata"], { fridge: 2, freezer: 60, type: "use_by" }],
  [["ham", "salami", "charcuterie", "beleg", "kipfilet beleg"], { fridge: 5, opened: 3, type: "use_by" }],
  [["spek", "bacon", "spekblokje"], { fridge: 7, freezer: 30, opened: 5, type: "use_by" }],
  [["zalm", "salmon", "kabeljauw", "cod", "vis", "fish", "tonijn steak"], { fridge: 1, freezer: 90, type: "use_by" }],
  [["garnaal", "scampi", "shrimp", "prawn", "mossel", "mussel"], { fridge: 1, freezer: 90, type: "use_by" }],
  // dairy & eggs
  [["melk", "milk"], { fridge: 7, opened: 4, freezer: 90, type: "use_by" }],
  [["room", "cream", "kookroom"], { fridge: 10, opened: 4, type: "use_by" }],
  [["yoghurt", "yogurt", "platte kaas", "skyr"], { fridge: 10, opened: 4, type: "use_by" }],
  [["boter", "butter"], { fridge: 60, freezer: 180, type: "best_before" }],
  [["harde kaas", "parmezaan", "parmesan", "gruyère", "comté", "oude kaas"], { fridge: 60, opened: 21, type: "best_before" }],
  [["kaas", "cheese", "gouda", "geraspte kaas"], { fridge: 21, opened: 7, freezer: 90, type: "best_before" }],
  [["mozzarella", "verse kaas", "ricotta", "feta", "mascarpone"], { fridge: 7, opened: 3, type: "use_by" }],
  [["ei", "egg"], { fridge: 28, pantry: 21, type: "best_before" }],
  // bread & dry goods
  [["brood", "bread", "pistolet", "stokbrood", "baguette", "croissant"], { pantry: 3, freezer: 90, type: "best_before" }],
  [["tortilla", "wrap", "pita"], { pantry: 7, opened: 4, freezer: 90, type: "best_before" }],
  [["rijst", "rice", "pasta", "spaghetti", "penne", "noedel", "noodle", "couscous", "quinoa", "bloem", "flour", "linzen", "lentil"], { pantry: 365, type: "best_before" }],
  [["blik", "tomatenblokje", "kokosmelk", "coconut milk", "kikkererwt", "chickpea", "bonen in blik"], { pantry: 540, opened: 3, type: "best_before" }],
  [["sojasaus", "soy sauce", "olijfolie", "olive oil", "olie", "azijn", "vinegar", "honing", "honey"], { pantry: 365, type: "best_before" }],
  [["mosterd", "mustard", "mayonaise", "mayo", "ketchup", "pesto"], { pantry: 180, opened: 60, type: "best_before" }],
  [["diepvries", "frozen", "erwt", "diepvreeserwt", "pea"], { freezer: 240, fridge: 2, type: "best_before" }],
];

const BY_CATEGORY: Record<string, Shelf> = {
  vegetables: { fridge: 5, pantry: 3, freezer: 240, type: "best_before" },
  fruit: { fridge: 7, pantry: 4, freezer: 240, type: "best_before" },
  meat: { fridge: 2, freezer: 120, type: "use_by" },
  fish: { fridge: 1, freezer: 90, type: "use_by" },
  dairy: { fridge: 7, opened: 4, type: "use_by" },
  eggs: { fridge: 28, type: "best_before" },
  bread: { pantry: 3, freezer: 90, type: "best_before" },
  frozen: { freezer: 240, type: "best_before" },
};

export interface ShelfEstimate { days: number; type: ExpiryType; openedDays: number | null; source: "product" | "category" }

/** Typical days until a product goes off in a given place, or null if unknown (then: don't guess). */
export function estimateShelfLife(name: string, category: string, location: Location): ShelfEstimate | null {
  const k = matchKey(name);
  const words = k.split(" ");
  let hit: Shelf | undefined;
  let source: ShelfEstimate["source"] = "product";
  // Longest matching key wins ("kokosmelk" before "melk", "harde kaas" before "kaas").
  let best = 0;
  for (const [keys, shelf] of T) for (const key of keys) {
    const kk = matchKey(key);
    const matches = k === kk || words.includes(kk) || (kk.length >= 4 && (k.endsWith(kk) || k.startsWith(kk))) || (kk.includes(" ") && k.includes(kk));
    if (matches && kk.length > best) { best = kk.length; hit = shelf; }
  }
  if (!hit) { hit = BY_CATEGORY[category]; source = "category"; }
  if (!hit) return null;
  const place = location === "other" ? "pantry" : location;
  const days = hit[place] ?? (place === "freezer" ? undefined : place === "pantry" ? hit.fridge && Math.max(1, Math.floor(hit.fridge / 3)) : hit.pantry);
  if (days == null) return null;
  return { days, type: place === "freezer" ? "best_before" : hit.type, openedDays: hit.opened ?? null, source };
}
