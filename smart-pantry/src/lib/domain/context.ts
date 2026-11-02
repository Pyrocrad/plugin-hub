import type { Cooking, InventoryItem, PreferenceOverride, Profile, Rating, Recipe } from "./types";
import { daysLeft, urgencyOf } from "./expiry";
import { householdAgreement, learnUserTaste } from "./preferences";

/**
 * Builds the compact, structured context sent to Claude. Only what's needed:
 * active stock (no history rows), summarised tastes (not raw rating tables),
 * and a short list of recent dishes to avoid repetition. ~1–3k tokens typically.
 */
export function buildAiContext(input: {
  today: string;
  inventory: InventoryItem[];
  recipes: Recipe[];
  cookings: Cooking[];
  ratings: Rating[];
  overrides: PreferenceOverride[];
  members: Profile[];
}) {
  const { today, inventory, recipes, cookings, ratings, overrides, members } = input;
  const active = inventory.filter((i) => i.status === "active" && i.quantity > 0);

  const stock = active
    .map((i) => ({
      name: i.name,
      qty: Number(i.quantity),
      unit: i.unit,
      where: i.location,
      days_left: daysLeft(i, today),
      date_type: i.expiry_type,
      opened: Boolean(i.opened_at),
      urgency: urgencyOf(i, today),
    }))
    .sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999));

  const memberIds = members.map((m) => m.id);
  const people = members.map((m) => {
    const t = learnUserTaste(m.id, recipes, ratings, overrides);
    const pick = (stances: string[]) => t.features.filter((f) => stances.includes(f.stance)).map((f) => `${f.kind}:${f.value}${f.source === "override" ? "(stated)" : ""}`);
    return {
      name: m.display_name,
      diet: m.diet,
      allergies_NEVER_USE: m.allergies,
      loves: pick(["love"]).slice(0, 12),
      likes: pick(["like"]).slice(0, 12),
      dislikes: pick(["dislike"]).slice(0, 12),
      never: pick(["never"]),
      typical_total_minutes: t.typicalMinutes,
      top_rated: t.topRecipes.map((r) => `${r.title} (${r.rating}/5)`),
      rejected: t.rejected.map((r) => `${r.title} (${r.rating}/5)`),
    };
  });

  const recentIds = [...cookings].sort((a, b) => b.cooked_at.localeCompare(a.cooked_at)).slice(0, 15);
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const recent = recentIds.map((c) => {
    const r = recipeById.get(c.recipe_id);
    const ag = householdAgreement(c.recipe_id, ratings, memberIds);
    return r ? `${r.title} [${c.cooked_at.slice(0, 10)}; ${ag.agreement}]` : null;
  }).filter(Boolean);

  const cookedTitles = new Set(cookings.map((c) => recipeById.get(c.recipe_id)?.title.toLowerCase()).filter(Boolean));

  return {
    today,
    stock,
    people,
    recently_cooked: recent,
    ever_cooked_titles: [...cookedTitles].slice(0, 60),
  };
}
