import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHousehold } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/http";
import { buildAiContext } from "@/lib/domain/context";
import { normalizeName } from "@/lib/domain/names";
import { toDay } from "@/lib/domain/expiry";
import { findDishPhoto, suggestRecipes } from "@/lib/ai/claude";

export const maxDuration = 120;

const Body = z.object({
  prompt: z.string().max(500).default(""),
  maxMinutes: z.number().int().min(5).max(600).optional(),
  noShopping: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const { sb, user, householdId } = await requireHousehold();

    // Fresh read from the database on every request: inventory changes are reflected immediately.
    const [inv, recipes, cookings, ratings, overrides, members] = await Promise.all([
      sb.from("inventory_items").select("*").eq("household_id", householdId).eq("status", "active"),
      sb.from("recipes").select("*").eq("household_id", householdId).eq("saved", true).order("created_at", { ascending: false }).limit(300),
      sb.from("cookings").select("*").eq("household_id", householdId).order("cooked_at", { ascending: false }).limit(200),
      sb.from("ratings").select("*").eq("household_id", householdId),
      sb.from("preference_overrides").select("*").eq("household_id", householdId),
      sb.from("household_members").select("user_id, profiles:user_id(*)").eq("household_id", householdId),
    ]);
    for (const r of [inv, recipes, cookings, ratings, overrides, members]) if (r.error) throw r.error;

    const profiles = (members.data ?? []).map((m: any) => m.profiles).filter(Boolean);
    const context = buildAiContext({
      today: toDay(new Date()),
      inventory: inv.data!,
      recipes: recipes.data!,
      cookings: cookings.data!,
      ratings: ratings.data!,
      overrides: overrides.data!,
      members: profiles,
    });

    const result = await suggestRecipes(context, body.prompt, body);
    const photos = await Promise.all(result.recipes.map((r) => findDishPhoto(r.image_query)));

    const rows = result.recipes.map((r, i) => ({
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
      image_url: photos[i],
      kind: r.kind,
      source: "ai",
      estimated_missing_cost: r.estimated_missing_cost,
      nutrition: r.nutrition,
      created_by: user.id,
    }));
    const { data: saved, error } = await sb.from("recipes").insert(rows).select("id");
    if (error) throw error;

    return NextResponse.json({ message: result.message, recipeIds: saved!.map((s) => s.id) });
  } catch (e) {
    return errorResponse(e);
  }
}
