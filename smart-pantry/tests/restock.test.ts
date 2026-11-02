import { describe, expect, it } from "vitest";
import { restockSuggestions } from "@/lib/domain/restock";
import type { InventoryEvent } from "@/lib/domain/types";
import { item, recipe } from "./helpers";

const today = "2026-11-02";
let n = 0;
const ev = (item_id: string, delta: number, unit: string, day: string, reason = "consumed"): InventoryEvent => ({
  id: ++n, household_id: "h", item_id, user_id: "u", reason, quantity_before: null, quantity_after: null, delta, unit,
  location_from: null, location_to: null, note: null, created_at: `${day}T12:00:00Z`,
});

describe("restock suggestions", () => {
  it("flags regularly used products that are running low", () => {
    const milk = item({ name: "Milk", quantity: 0.5, unit: "l" });
    const events = [1, 4, 7, 10, 13].map((d) => ev(milk.id, -1, "l", `2026-10-${String(18 + d).padStart(2, "0")}`.replace("-10-3", "-10-3")));
    const s = restockSuggestions({ inventory: [milk], events, cookings: [], recipes: [], shopping: [], today });
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ name: "Milk", unit: "ml" });
    expect(s[0].daysLeft).toBeLessThan(7);
    expect(s[0].quantity).toBeGreaterThan(0);
  });
  it("ignores well-stocked items and items already on the list", () => {
    const rice = item({ name: "Rice", quantity: 5, unit: "kg" });
    const events = [ev(rice.id, -100, "g", "2026-10-20"), ev(rice.id, -100, "g", "2026-10-28")];
    expect(restockSuggestions({ inventory: [rice], events, cookings: [], recipes: [], shopping: [], today })).toHaveLength(0);
    const eggs = item({ name: "Eggs", quantity: 0, unit: "pcs", status: "consumed" });
    const ev2 = [ev(eggs.id, -6, "pcs", "2026-10-25"), ev(eggs.id, -6, "pcs", "2026-10-30")];
    const list = [{ id: "s", household_id: "h", name: "eggs", normalized_name: "egg", category: "eggs", quantity: 6, unit: "pcs", notes: null, recipe_id: null, status: "open" as const, added_by: null, purchased_by: null, purchased_at: null, created_at: "" }];
    expect(restockSuggestions({ inventory: [eggs], events: ev2, cookings: [], recipes: [], shopping: list, today })).toHaveLength(0);
  });
  it("suggests ingredients of frequently cooked recipes that are missing", () => {
    const r = recipe({ ingredients: [{ name: "coconut milk", quantity: 400, unit: "ml" }, { name: "salt", quantity: null, unit: null }] });
    const cookings = ["2026-10-10", "2026-10-24"].map((d, i) => ({ id: `c${i}`, household_id: "h", recipe_id: r.id, cooked_by: "u", cooked_at: `${d}T18:00:00Z`, followed_exactly: true, modifications: null, servings: 2 }));
    const s = restockSuggestions({ inventory: [], events: [], cookings, recipes: [r], shopping: [], today });
    expect(s.map((x) => x.name)).toEqual(["coconut milk"]);
    expect(s[0].quantity).toBe(500);
  });
});
