import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AiRecipeSet, ScanResult, recipeToolSchema, scanToolSchema } from "./schemas";
import { CHEF_SYSTEM } from "./prompt";

// The key is read on the server only. It is never sent to the browser.
function client() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("De AI is niet ingesteld (geen API-sleutel) – de app werkt in gratis modus.");
  return new Anthropic({ apiKey: key, maxRetries: 2, timeout: 90_000 });
}
const MODEL = () => process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const VISION_MODEL = () => process.env.CLAUDE_VISION_MODEL || MODEL();



export async function suggestRecipes(context: unknown, request: string, opts: { maxMinutes?: number; noShopping?: boolean }) {
  const extra = [
    opts.maxMinutes ? `Total time (prep+cook) must be ≤ ${opts.maxMinutes} minutes.` : "",
    opts.noShopping ? "No shopping allowed: every non-optional ingredient must come from stock (water/salt/pepper excepted)." : "",
  ].filter(Boolean).join("\n");

  const res = await client().messages.create({
    model: MODEL(),
    max_tokens: 8000,
    // Static instructions are cached; only the household context changes per call.
    system: [{ type: "text", text: CHEF_SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [{ name: "submit_recipes", description: "Return the recipe suggestions.", input_schema: recipeToolSchema as unknown as Anthropic.Tool.InputSchema }],
    tool_choice: { type: "tool", name: "submit_recipes" },
    messages: [
      {
        role: "user",
        content: `Household context (JSON):\n${JSON.stringify(context)}\n\nRequest: ${request || "What should we cook tonight?"}\n${extra}`,
      },
    ],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("De chef gaf geen recepten terug – probeer opnieuw.");
  const parsed = AiRecipeSet.safeParse(block.input);
  if (!parsed.success) throw new Error("De chef gaf een onleesbaar antwoord – probeer opnieuw.");
  return { ...parsed.data, usage: res.usage };
}

const SCAN_PROMPTS = {
  photo: "Identify every distinct grocery product visible in this photo. Use Dutch (Flemish) generic product names. Estimate quantity and unit from packaging when readable; otherwise count pieces. Choose a sensible storage location.",
  list: "This is a photo of a grocery/shopping list (handwritten, printed, or a phone screenshot) of products the household has just bought. Read every line, including messy handwriting. Each line is one product; parse quantities like '2x', '500g', '1 l', '6 eggs'. Use clear generic product names in Dutch (translate if the list is in another language). Ignore crossed-out lines and non-food items. If a line is illegible, give your best guess with confidence low. Default to 1 pcs if no quantity.",
  receipt: "This is a supermarket receipt. Put the shop name in store_name. Extract every FOOD product purchased (skip bags, deposits, discounts, non-food). Expand abbreviations to clear generic Dutch product names (e.g. 'HALFV MELK 1L' → 'Halfvolle melk'). Use quantities/weights printed on the receipt; default to 1 pcs if unknown. Include price per line if visible.",
} as const;

export async function scanImage(base64: string, mediaType: "image/jpeg" | "image/png" | "image/webp", mode: keyof typeof SCAN_PROMPTS) {
  const res = await client().messages.create({
    model: VISION_MODEL(),
    max_tokens: 4000,
    tools: [{ name: "submit_items", description: "Return detected products.", input_schema: scanToolSchema as unknown as Anthropic.Tool.InputSchema }],
    tool_choice: { type: "tool", name: "submit_items" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: SCAN_PROMPTS[mode] + " Mark confidence low if unsure. The user will review before saving." },
        ],
      },
    ],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Geen producten herkend");
  const parsed = ScanResult.safeParse(block.input);
  if (!parsed.success) throw new Error("Het scanresultaat kon niet gelezen worden");
  return { items: parsed.data.items, store: parsed.data.store_name ?? null };
}

/** Optional dish photo via Unsplash (server-side key). Falls back to null → UI placeholder. */
export async function findDishPhoto(query: string): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`https://api.unsplash.com/search/photos?per_page=1&orientation=landscape&query=${encodeURIComponent(query + " food")}`, {
      headers: { Authorization: `Client-ID ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.results?.[0]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}
