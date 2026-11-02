// Shared between the server (API) and the browser ("ask via your Claude app" bridge).
import { AiRecipeSet, type AiRecipe } from "./schemas";
import { normalizeName } from "@/lib/domain/names";

export const CHEF_SYSTEM = `You are the household's personal chef. You plan meals from what is ACTUALLY in their kitchen.

Language: the household lives in Belgium and speaks Dutch (Flemish). Write EVERYTHING the user sees in natural
Belgian Dutch: message, titles, descriptions, "why", steps and ingredient names. Also give cuisine, main_ingredients
and methods in Dutch, lowercase (e.g. "italiaans", "kip", "roerbakken"). Prices are in euro, think Belgian supermarket
prices (Delhaize/Colruyt). image_query stays in English.

Hard rules:
- Allergies listed under allergies_NEVER_USE must never appear, not even optional.
- Respect each person's diet and "never" items. Avoid "dislikes" unless explicitly asked.
- Only treat an ingredient as available if it is in "stock". Never assume anything else is at home
  except water, salt and black pepper. Everything else you need must be listed as an ingredient
  (the app computes what's missing deterministically, so be precise with names, quantities and units).
- When using stock, use the stock item's name so the app can match it, and do not exceed stock quantities
  unless you intend the household to buy the rest.
- Use metric units: g, kg, ml, l, pcs, tbsp, tsp.
- Prioritise items with low days_left. For "use_by" items close to their date, recommend cooking them
  thoroughly and soon; never say food is safe just because the date hasn't passed. If something
  is past its use_by date, do not use it.
- Cater to everyone: prefer dishes all members are likely to enjoy; if members disagree, explain
  the trade-off in "why".

Default answer = exactly three recipes:
 1. kind "favourite": close to their top-rated dishes and loved features, mostly from stock.
 2. kind "practical": built around the most urgent stock (combine several expiring items), minimal shopping.
 3. kind "discovery": something they have NOT cooked (see ever_cooked_titles) – a new cuisine, technique or
    flavour pairing that is a sensible step from what they like, never using disliked items.
If the user asks for something specific, still return up to three options but you may use kind "custom".
Honour time limits strictly (prep + cook). Keep steps concrete and numbered-ready (no numbering in text).`;

/**
 * Prompt to paste into the Claude app (claude.ai / Claude Pro). Same rules and context as the
 * built-in chef; Claude is asked to end with one JSON block the app can import.
 */
export function buildBridgePrompt(context: unknown, request: string, opts: { maxMinutes?: number; noShopping?: boolean } = {}) {
  return [
    CHEF_SYSTEM,
    "",
    "Huishouden (JSON, uit onze keuken-app):",
    JSON.stringify(context),
    "",
    `Vraag: ${request || "Wat koken we vanavond?"}`,
    opts.maxMinutes ? `Totale tijd (voorbereiden + koken) maximaal ${opts.maxMinutes} minuten.` : "",
    opts.noShopping ? "Niet winkelen: elk niet-optioneel ingrediënt moet uit de voorraad komen (water/zout/peper uitgezonderd)." : "",
    "",
    "ANTWOORDFORMAAT – belangrijk: antwoord met precies één codeblok ```json ... ``` en verder niets, met dit formaat:",
    '{"message": "1-2 zinnen", "recipes": [{"kind": "favourite|practical|discovery|custom", "title": "", "description": "", "why": "", "cuisine": "", "main_ingredients": [""], "methods": [""], "tags": [], "prep_minutes": 0, "cook_minutes": 0, "difficulty": "easy|medium|hard", "servings": 2, "ingredients": [{"name": "", "quantity": 0, "unit": "g|kg|ml|l|pcs|tbsp|tsp", "optional": false}], "steps": [""], "uses_expiring": [""], "estimated_missing_cost": null, "nutrition": {"kcal": 0, "protein_g": 0}, "image_query": "english words"}]}',
    "Gebruik null voor onbekende getallen. Exact 3 recepten tenzij de vraag iets anders vraagt.",
  ].filter((l) => l !== "").join("\n");
}

/** Read Claude's pasted answer: finds the JSON (with or without ``` fences) and validates it. */
export function parseBridgeReply(text: string): { message: string; recipes: AiRecipe[] } {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  let raw = fenced ? fenced[1] : text;
  if (!fenced) {
    const a = text.indexOf("{"), b = text.lastIndexOf("}");
    if (a < 0 || b < a) throw new Error("Geen recepten gevonden in de geplakte tekst. Plak het volledige antwoord van Claude.");
    raw = text.slice(a, b + 1);
  }
  let json: unknown;
  try { json = JSON.parse(raw.replace(/[“”]/g, '"')); } catch { throw new Error("Het antwoord kon niet gelezen worden. Vraag Claude om 'enkel het json-blok' en plak opnieuw."); }
  // Be lenient with what chat models tend to leave out.
  const j = json as any;
  if (Array.isArray(j?.recipes)) j.recipes = j.recipes.map((r: any) => ({ tags: [], uses_expiring: [], estimated_missing_cost: null, nutrition: null, image_query: r?.title ?? "dish", why: "", cuisine: null, methods: [], kind: "custom", ...r,
    ingredients: (r?.ingredients ?? []).map((i: any) => ({ unit: null, ...i, quantity: i?.quantity === 0 ? null : i?.quantity ?? null })) }));
  const parsed = AiRecipeSet.safeParse({ message: "", ...j });
  if (!parsed.success) throw new Error("Het antwoord mist onderdelen (" + (parsed.error.issues[0]?.path.join(".") ?? "?") + "). Vraag Claude om het formaat exact te volgen.");
  return parsed.data;
}

/** Database row for a recipe suggested by Claude (API or app). */
export function aiRecipeToRow(r: AiRecipe, householdId: string, userId: string, imageUrl: string | null = null) {
  return {
    household_id: householdId,
    title: r.title,
    description: r.description + (r.why ? `\n\n${r.why}` : ""),
    cuisine: r.cuisine,
    tags: [...r.tags, ...r.uses_expiring.map((u) => `uses:${u}`)],
    main_ingredients: r.main_ingredients.map(normalizeName),
    methods: r.methods.map((m) => m.toLowerCase()),
    ingredients: r.ingredients,
    steps: r.steps,
    prep_minutes: r.prep_minutes,
    cook_minutes: r.cook_minutes,
    difficulty: r.difficulty,
    servings: r.servings,
    image_url: imageUrl,
    kind: r.kind,
    source: "ai" as const,
    estimated_missing_cost: r.estimated_missing_cost,
    nutrition: r.nutrition,
    created_by: userId,
  };
}
