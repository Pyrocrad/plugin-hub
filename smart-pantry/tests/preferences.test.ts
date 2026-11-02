import { describe, expect, it } from "vitest";
import { householdAgreement, learnUserTaste } from "@/lib/domain/preferences";
import { rating, recipe } from "./helpers";

describe("preference learning", () => {
  it("one low rating does not create a dislike", () => {
    const r = recipe({ main_ingredients: ["mushroom"], cuisine: "French" });
    const t = learnUserTaste("u1", [r], [rating("u1", r.id, 1)], []);
    expect(t.features.find((f) => f.value === "mushroom")?.stance).toBe("neutral");
  });
  it("repeated low ratings across recipes create a dislike", () => {
    const a = recipe({ main_ingredients: ["mushrooms"] });
    const b = recipe({ main_ingredients: ["mushroom"] });
    const t = learnUserTaste("u1", [a, b], [rating("u1", a.id, 1), rating("u1", b.id, 2)], []);
    expect(t.features.find((f) => f.value === "mushroom")?.stance).toBe("dislike");
  });
  it("repeated 5s create a love, and only the latest rating per recipe counts", () => {
    const a = recipe({ main_ingredients: ["salmon"], cuisine: "Japanese" });
    const b = recipe({ main_ingredients: ["salmon"], cuisine: "Japanese" });
    const t = learnUserTaste("u1", [a, b], [rating("u1", a.id, 1, "2026-01-01"), rating("u1", a.id, 5, "2026-02-01"), rating("u1", b.id, 5)], []);
    expect(t.features.find((f) => f.value === "salmon")?.stance).toBe("love");
    expect(t.ratedCount).toBe(2);
  });
  it("explicit overrides beat learned stances", () => {
    const a = recipe({ main_ingredients: ["mushroom"] });
    const b = recipe({ main_ingredients: ["mushroom"] });
    const t = learnUserTaste("u1", [a, b], [rating("u1", a.id, 1), rating("u1", b.id, 1)], [
      { id: "o", household_id: "h", user_id: "u1", kind: "ingredient", value: "Mushrooms", stance: "like" },
    ]);
    const f = t.features.find((f) => f.value === "mushroom")!;
    expect(f.stance).toBe("like");
    expect(f.source).toBe("override");
  });
  it("keeps users separate and classifies household agreement", () => {
    const r = recipe({});
    const ratings = [rating("me", r.id, 5), rating("partner", r.id, 2)];
    expect(householdAgreement(r.id, ratings, ["me", "partner"]).agreement).toBe("split");
    expect(learnUserTaste("partner", [r], ratings, []).avgRating).toBe(2);
  });
});
