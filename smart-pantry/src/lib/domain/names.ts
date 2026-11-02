// Ingredient-name normalisation so "Chicken breasts" matches "chicken breast".
const SYNONYMS: Record<string, string> = {
  scallion: "spring onion", "green onion": "spring onion", cilantro: "coriander",
  aubergine: "eggplant", courgette: "zucchini", "bell pepper": "pepper", capsicum: "pepper",
  "double cream": "heavy cream", "whipping cream": "heavy cream", "cooking cream": "cream",
  "plain flour": "flour", "all-purpose flour": "flour", "minced beef": "ground beef",
  "beef mince": "ground beef", "chicken fillet": "chicken breast", "chicken filet": "chicken breast",
};

const STOP = new Set(["fresh", "organic", "large", "small", "medium", "ripe", "free-range", "chopped", "sliced", "diced", "a", "of", "the"]);

export function singular(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("oes")) return w.slice(0, -2);
  if (/(ch|sh|ss|x)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function normalizeName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9à-ÿ\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map(singular)
    .join(" ")
    .trim();
  return SYNONYMS[base] ?? base;
}

/** Score how well an inventory item name matches a recipe ingredient (0..1). */
export function nameMatchScore(ingredient: string, itemName: string): number {
  const a = normalizeName(ingredient);
  const b = normalizeName(itemName);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aw = new Set(a.split(" "));
  const bw = new Set(b.split(" "));
  // "chicken breast" vs "chicken" – the generic one is contained in the specific one.
  const contained = [...aw].every((w) => bw.has(w)) || [...bw].every((w) => aw.has(w));
  if (contained) return 0.8;
  return 0;
}
