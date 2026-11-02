import { describe, expect, it } from "vitest";
import { matchIngredients } from "@/lib/domain/matching";
import { shoppingFromMatches } from "@/lib/domain/shopping";
import { item } from "./helpers";

describe("ingredient matching", () => {
  it("converts units and plans exact deductions", () => {
    const chicken = item({ name: "Chicken breasts", quantity: 0.5, unit: "kg" });
    const [m] = matchIngredients([{ name: "chicken breast", quantity: 200, unit: "g" }], [chicken]);
    expect(m.status).toBe("have");
    expect(m.deductions).toEqual([{ item_id: chicken.id, item_name: "Chicken breasts", amount: 0.2, unit: "kg" }]);
  });
  it("reports partial availability and the shortfall", () => {
    const milk = item({ name: "Milk", quantity: 200, unit: "ml" });
    const [m] = matchIngredients([{ name: "milk", quantity: 0.5, unit: "l" }], [milk]);
    expect(m.status).toBe("partial");
    expect(m.missingQuantity).toBe(0.3);
  });
  it("uses earliest-expiring stock first", () => {
    const late = item({ name: "cream", quantity: 200, unit: "ml", expiry_date: "2026-12-01" });
    const soon = item({ name: "cream", quantity: 200, unit: "ml", expiry_date: "2026-11-03" });
    const [m] = matchIngredients([{ name: "cream", quantity: 250, unit: "ml" }], [late, soon]);
    expect(m.deductions.map((d) => d.item_id)).toEqual([soon.id, late.id]);
    expect(m.deductions[1].amount).toBe(50);
  });
  it("never assumes availability for incomparable units", () => {
    const [m] = matchIngredients([{ name: "spinach", quantity: 200, unit: "g" }], [item({ name: "spinach", quantity: 1, unit: "bag" })]);
    expect(m.status).toBe("check");
  });
  it("ignores consumed and spoiled items", () => {
    const [m] = matchIngredients([{ name: "egg", quantity: 2, unit: "pcs" }], [item({ name: "eggs", quantity: 6, status: "spoiled" })]);
    expect(m.status).toBe("missing");
  });
  it("does not double count one item across two ingredient lines", () => {
    const eggs = item({ name: "eggs", quantity: 3, unit: "pcs" });
    const ms = matchIngredients([{ name: "egg", quantity: 2, unit: "pcs" }, { name: "egg", quantity: 2, unit: "pcs" }], [eggs]);
    expect(ms[0].status).toBe("have");
    expect(ms[1].status).toBe("partial");
    expect(ms[1].missingQuantity).toBe(1);
  });
  it("shopping list only contains what is actually missing", () => {
    const ms = matchIngredients(
      [{ name: "onion", quantity: 2, unit: "pcs" }, { name: "lime", quantity: 1, unit: "pcs" }, { name: "cilantro", quantity: null, unit: null, optional: true }],
      [item({ name: "onions", quantity: 5 })],
    );
    expect(shoppingFromMatches(ms)).toEqual([{ name: "lime", normalized_name: "lime", quantity: 1, unit: "pcs", category: "fruit" }]);
  });
});
