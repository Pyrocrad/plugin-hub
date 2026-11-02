// Ingredient-name normalisation so "Chicken breasts" matches "chicken breast".
const SYNONYMS: Record<string, string> = {
  scallion: "spring onion", "green onion": "spring onion", cilantro: "coriander",
  aubergine: "eggplant", courgette: "zucchini", "bell pepper": "pepper", capsicum: "pepper",
  "double cream": "heavy cream", "whipping cream": "heavy cream", "cooking cream": "cream",
  "plain flour": "flour", "all-purpose flour": "flour", "minced beef": "ground beef",
  "beef mince": "ground beef", "chicken fillet": "chicken breast", "chicken filet": "chicken breast",
  // Dutch / Flemish
  kipfilet: "kippenborst", kipfilets: "kippenborst", "kip filet": "kippenborst", gehakt: "gehakt", "gemengd gehakt": "gehakt",
  "rundsgehakt": "gehakt", eitje: "ei", eitjes: "ei", lente_ui: "lente-ui", "lente ui": "lente-ui", "lente uitjes": "lente-ui",
  courgettes: "courgette", "kookroom": "room", "slagroom": "room", "volle melk": "melk", "halfvolle melk": "melk",
};

const STOP = new Set(["fresh", "organic", "large", "small", "medium", "ripe", "free-range", "chopped", "sliced", "diced", "a", "of", "the",
  "vers", "verse", "bio", "biologisch", "biologische", "grote", "groot", "kleine", "klein", "rijpe", "gesneden", "gehakte", "van", "de", "het", "een"]);

export function singular(w: string): string {
  if (w.length <= 3) return w;
  // Dutch plurals: eieren→ei, tomaten→tomat(=tomaat), aardappelen→aardappel, uien→ui
  if (w.endsWith("eren") && w.length > 5) return w.slice(0, -4);
  if (w.endsWith("en") && w.length > 3 && !ENGLISH_EN.has(w)) return w.slice(0, -2);
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("oes")) return w.slice(0, -2);
  if (/(ch|sh|ss|x)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

// English words ending in -en that are not plurals.
const ENGLISH_EN = new Set(["chicken", "green", "linen", "frozen", "kitchen", "garden", "oven", "ramen", "golden", "chicken breast"]);
/** Collapse doubled vowels so "tomaat" and stem "tomat" compare equal. */
function dutchVowels(w: string) {
  return w.replace(/aa/g, "a").replace(/ee/g, "e").replace(/oo/g, "o").replace(/uu/g, "u");
}

export function normalizeName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9à-ÿ\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .join(" ")
    .trim();
  const syn = SYNONYMS[cleaned];
  if (syn) return syn.split(" ").map(singular).join(" ");
  const base = cleaned.split(" ").map(singular).join(" ");
  return SYNONYMS[base] ? SYNONYMS[base].split(" ").map(singular).join(" ") : base;
}

/** Comparison key: also treats "tomaat" and "tomat(en)" as the same word. */
export function matchKey(name: string): string {
  return dutchVowels(normalizeName(name));
}

/** Score how well an inventory item name matches a recipe ingredient (0..1). */
export function nameMatchScore(ingredient: string, itemName: string): number {
  const a = matchKey(ingredient);
  const b = matchKey(itemName);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aw = new Set(a.split(" "));
  const bw = new Set(b.split(" "));
  // "chicken breast" vs "chicken" – the generic one is contained in the specific one.
  const contained = [...aw].every((w) => bw.has(w)) || [...bw].every((w) => aw.has(w));
  if (contained) return 0.8;
  return 0;
}
