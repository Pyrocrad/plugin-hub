import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "@/lib/domain/parse";

describe("quick add parser", () => {
  it("parses mixed lines", () => {
    expect(parseQuickAdd("2 l milk, 6 eggs and 500g chicken breast; bananas")).toEqual([
      { name: "Milk", quantity: 2, unit: "l", category: "dairy" },
      { name: "Eggs", quantity: 6, unit: "pcs", category: "eggs" },
      { name: "Chicken breast", quantity: 500, unit: "g", category: "meat" },
      { name: "Bananas", quantity: 1, unit: "pcs", category: "fruit" },
    ]);
  });
  it("handles decimal commas and 'of'", () => {
    expect(parseQuickAdd("1,5 kg of potatoes")[0]).toMatchObject({ name: "Potatoes", quantity: 1.5, unit: "kg" });
  });
});
