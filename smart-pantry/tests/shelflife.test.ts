import { describe, expect, it } from "vitest";
import { estimateShelfLife } from "@/lib/domain/shelflife";

describe("shelf life", () => {
  it("knows common fresh products", () => {
    expect(estimateShelfLife("Broccoli", "vegetables", "fridge")).toMatchObject({ days: 5, type: "best_before" });
    expect(estimateShelfLife("Tomaten", "vegetables", "fridge")?.days).toBe(7);
    expect(estimateShelfLife("Kerstomaten", "vegetables", "pantry")?.days).toBe(5);
    expect(estimateShelfLife("Gehakt", "meat", "fridge")).toMatchObject({ days: 1, type: "use_by" });
    expect(estimateShelfLife("Kipfilet", "meat", "freezer")).toMatchObject({ days: 270, type: "best_before" });
  });
  it("prefers the most specific product", () => {
    expect(estimateShelfLife("Kokosmelk", "sauces", "pantry")?.days).toBe(540);
    expect(estimateShelfLife("Halfvolle melk", "dairy", "fridge")).toMatchObject({ days: 7, openedDays: 4, type: "use_by" });
    expect(estimateShelfLife("Parmezaan", "dairy", "fridge")?.days).toBe(60);
  });
  it("falls back to the category, or admits it doesn't know", () => {
    expect(estimateShelfLife("Pastinaak", "vegetables", "fridge")).toMatchObject({ days: 5, source: "category" });
    expect(estimateShelfLife("Toiletpapier", "other", "pantry")).toBeNull();
    expect(estimateShelfLife("Spinazie", "vegetables", "freezer")).toBeNull();
  });
});
