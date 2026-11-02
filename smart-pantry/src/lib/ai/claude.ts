import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AiRecipeSet, ScanResult, recipeToolSchema, scanToolSchema } from "./schemas";

// The key is read on the server only. It is never sent to the browser.
function client() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured on the server");
  return new Anthropic({ apiKey: key, maxRetries: 2, timeout: 90_000 });
}
const MODEL = () => process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const VISION_MODEL = () => process.env.CLAUDE_VISION_MODEL || MODEL();

const CHEF_SYSTEM = `You are the household's personal chef. You plan meals from what is ACTUALLY in their kitchen.

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
  if (!block || block.type !== "tool_use") throw new Error("Claude returned no recipes");
  const parsed = AiRecipeSet.safeParse(block.input);
  if (!parsed.success) throw new Error("Claude returned malformed recipes: " + parsed.error.issues[0]?.message);
  return { ...parsed.data, usage: res.usage };
}

const SCAN_PROMPTS = {
  photo: "Identify every distinct grocery product visible in this photo. Estimate quantity and unit from packaging when readable; otherwise count pieces. Choose a sensible storage location.",
  receipt: "This is a supermarket receipt. Extract every FOOD product purchased (skip bags, deposits, discounts, non-food). Expand abbreviations to clear generic product names. Use quantities/weights printed on the receipt; default to 1 pcs if unknown. Include price per line if visible.",
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
  if (!block || block.type !== "tool_use") throw new Error("No products detected");
  const parsed = ScanResult.safeParse(block.input);
  if (!parsed.success) throw new Error("Could not read the scan result");
  return parsed.data.items;
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
