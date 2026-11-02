import { describe, expect, it } from "vitest";
import { rankRecipes } from "@/lib/domain/rank";
import { item, rating, recipe } from "./helpers";

const today = "2026-11-02";
describe("free recipe ranking", () => {
  const inv = [item({ name: "kip", quantity: 500, unit: "g", expiry_date: "2026-11-03", expiry_type: "use_by" }), item({ name: "rijst", quantity: 1, unit: "kg" })];
  const withExpiring = recipe({ title: "Kip met rijst", ingredients: [{ name: "kip", quantity: 300, unit: "g" }, { name: "rijst", quantity: 200, unit: "g" }] });
  const missingStuff = recipe({ title: "Zalm", ingredients: [{ name: "zalm", quantity: 2, unit: "pcs" }, { name: "rijst", quantity: 200, unit: "g" }] });
  it("prefers recipes that use expiring stock and need no shopping", () => {
    const r = rankRecipes({ recipes: [missingStuff, withExpiring], inventory: inv, ratings: [], cookings: [], memberIds: [], today });
    expect(r[0].recipe.title).toBe("Kip met rijst");
    expect(r[0].usesExpiring).toEqual(["kip"]);
  });
  it("respects no-shopping and time limits", () => {
    expect(rankRecipes({ recipes: [missingStuff, withExpiring], inventory: inv, ratings: [], cookings: [], memberIds: [], today, noShopping: true }).map((x) => x.recipe.title)).toEqual(["Kip met rijst"]);
    expect(rankRecipes({ recipes: [withExpiring], inventory: inv, ratings: [], cookings: [], memberIds: [], today, maxMinutes: 20 })).toHaveLength(0);
  });
  it("uses household ratings", () => {
    const a = recipe({ title: "A", ingredients: [{ name: "rijst", quantity: 100, unit: "g" }] });
    const b = recipe({ title: "B", ingredients: [{ name: "rijst", quantity: 100, unit: "g" }] });
    const r = rankRecipes({ recipes: [a, b], inventory: inv, ratings: [rating("u1", b.id, 5), rating("u2", b.id, 5), rating("u1", a.id, 2)], cookings: [], memberIds: ["u1", "u2"], today });
    expect(r.map((x) => x.recipe.title)).toEqual(["B", "A"]);
  });
});
