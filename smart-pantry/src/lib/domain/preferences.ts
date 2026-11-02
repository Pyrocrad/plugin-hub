import type { Cooking, PreferenceOverride, Rating, Recipe, Stance } from "./types";
import { normalizeName } from "./names";

/**
 * Preference learning – deterministic, explainable, correctable.
 *
 * Every rating becomes a signal (5→+2, 4→+1, 3→0, 2→−1, 1→−2) that is attributed to the
 * recipe's features (main ingredients, cuisine, cooking methods). Scores are shrunk toward
 * zero by a prior (SHRINK) so a single bad dinner can't brand an ingredient as disliked:
 * a "dislike" label requires evidence from at least MIN_EVIDENCE different recipes.
 * Explicit user overrides always win over anything learned.
 */
export const SIGNAL: Record<number, number> = { 5: 2, 4: 1, 3: 0, 2: -1, 1: -2 };
const SHRINK = 2;
const MIN_EVIDENCE = 2;

export type FeatureKind = "ingredient" | "cuisine" | "method";
export interface LearnedFeature {
  kind: FeatureKind;
  value: string;
  score: number; // shrunk mean signal, roughly −2..+2
  evidence: number; // distinct recipes rated
  stance: Stance;
  source: "learned" | "override";
}

export interface UserTaste {
  userId: string;
  features: LearnedFeature[];
  ratedCount: number;
  avgRating: number | null;
  typicalMinutes: number | null; // median total time of recipes rated ≥ 4
  topRecipes: { recipeId: string; title: string; rating: number }[];
  rejected: { recipeId: string; title: string; rating: number }[];
}

export function stanceFromScore(score: number, evidence: number): Stance {
  if (score >= 1 && evidence >= MIN_EVIDENCE) return "love";
  if (score >= 0.4) return "like";
  if (score <= -0.6 && evidence >= MIN_EVIDENCE) return "dislike";
  return "neutral";
}

/** Latest rating per (user, recipe). Re-cooking & re-rating replaces older opinions. */
export function latestRatings(ratings: Rating[]): Map<string, Map<string, Rating>> {
  const byUser = new Map<string, Map<string, Rating>>();
  for (const r of [...ratings].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, new Map());
    byUser.get(r.user_id)!.set(r.recipe_id, r);
  }
  return byUser;
}

export function learnUserTaste(userId: string, recipes: Recipe[], ratings: Rating[], overrides: PreferenceOverride[]): UserTaste {
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const mine = latestRatings(ratings).get(userId) ?? new Map<string, Rating>();
  const acc = new Map<string, { kind: FeatureKind; value: string; sum: number; n: number }>();
  const add = (kind: FeatureKind, raw: string, s: number) => {
    const value = kind === "ingredient" ? normalizeName(raw) : raw.trim().toLowerCase();
    if (!value) return;
    const key = `${kind}:${value}`;
    const a = acc.get(key) ?? { kind, value, sum: 0, n: 0 };
    a.sum += s;
    a.n += 1;
    acc.set(key, a);
  };

  const rated: { recipe: Recipe; rating: number }[] = [];
  for (const r of mine.values()) {
    const recipe = recipeById.get(r.recipe_id);
    if (!recipe) continue;
    rated.push({ recipe, rating: r.rating });
    const s = SIGNAL[r.rating] ?? 0;
    new Set(recipe.main_ingredients).forEach((i) => add("ingredient", i, s));
    if (recipe.cuisine) add("cuisine", recipe.cuisine, s);
    new Set(recipe.methods).forEach((m) => add("method", m, s));
  }

  const features = new Map<string, LearnedFeature>();
  for (const [key, a] of acc) {
    const score = a.sum / (a.n + SHRINK);
    features.set(key, { kind: a.kind, value: a.value, score: Math.round(score * 100) / 100, evidence: a.n, stance: stanceFromScore(score, a.n), source: "learned" });
  }
  for (const o of overrides.filter((o) => o.user_id === userId)) {
    const value = o.kind === "ingredient" ? normalizeName(o.value) : o.value.trim().toLowerCase();
    const key = `${o.kind}:${value}`;
    const prev = features.get(key);
    features.set(key, { kind: o.kind, value, score: prev?.score ?? 0, evidence: prev?.evidence ?? 0, stance: o.stance, source: "override" });
  }

  const good = rated.filter((r) => r.rating >= 4).map((r) => (r.recipe.prep_minutes ?? 0) + (r.recipe.cook_minutes ?? 0)).filter((m) => m > 0).sort((a, b) => a - b);
  return {
    userId,
    features: [...features.values()].sort((a, b) => b.score - a.score),
    ratedCount: rated.length,
    avgRating: rated.length ? Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 10) / 10 : null,
    typicalMinutes: good.length ? good[Math.floor(good.length / 2)] : null,
    topRecipes: rated.filter((r) => r.rating >= 4).sort((a, b) => b.rating - a.rating).slice(0, 8).map((r) => ({ recipeId: r.recipe.id, title: r.recipe.title, rating: r.rating })),
    rejected: rated.filter((r) => r.rating <= 2).slice(0, 8).map((r) => ({ recipeId: r.recipe.id, title: r.recipe.title, rating: r.rating })),
  };
}

export type Agreement = "all_love" | "split" | "all_dislike" | "mixed" | "single";

/** How the household as a whole feels about a recipe (latest rating per member). */
export function householdAgreement(recipeId: string, ratings: Rating[], memberIds: string[]): { agreement: Agreement; byUser: Record<string, number> } {
  const latest = latestRatings(ratings);
  const byUser: Record<string, number> = {};
  for (const uid of memberIds) {
    const r = latest.get(uid)?.get(recipeId);
    if (r) byUser[uid] = r.rating;
  }
  const vals = Object.values(byUser);
  if (vals.length <= 1) return { agreement: "single", byUser };
  if (vals.every((v) => v >= 4)) return { agreement: "all_love", byUser };
  if (vals.every((v) => v <= 2)) return { agreement: "all_dislike", byUser };
  if (vals.some((v) => v >= 4) && vals.some((v) => v <= 2)) return { agreement: "split", byUser };
  return { agreement: "mixed", byUser };
}

export function lastCooked(recipeId: string, cookings: Cooking[]): string | null {
  return cookings.filter((c) => c.recipe_id === recipeId).map((c) => c.cooked_at).sort().pop() ?? null;
}
