import { describe, expect, it } from "vitest";
import { matchStore, preferredStore } from "@/lib/domain/stores";
import { item } from "./helpers";

describe("stores", () => {
  it("remembers the most recent store for a product", () => {
    const inv = [
      item({ name: "Milk", store: "Lidl", created_at: "2026-10-01" }),
      item({ name: "milk", store: "Delhaize", created_at: "2026-10-20" }),
      item({ name: "Bread", store: "Lidl", created_at: "2026-10-25" }),
    ];
    expect(preferredStore("Whole milk".replace("Whole ", ""), inv)).toBe("Delhaize");
    expect(preferredStore("Cheese", inv)).toBeNull();
  });
  it("matches receipt store names to household stores", () => {
    expect(matchStore("LIDL Belgium GmbH & Co", ["Lidl", "Delhaize"])).toBe("Lidl");
    expect(matchStore("Carrefour", ["Lidl", "Delhaize"])).toBeNull();
  });
});

import { move, sortForStore, storeCatalogue } from "@/lib/domain/stores";
const sp = (name: string, position: number, store = "Colruyt", normalized_name = name.toLowerCase()) => ({ household_id: "h", store, normalized_name, name, category: "other", position });

describe("store walking order", () => {
  const cat = [sp("Bananas", 0), sp("bread", 1), sp("Eggs", 2), sp("eggs", 3, "Colruyt", "egg"), sp("Milk", 0, "Delhaize")];
  it("merges spellings and keeps per-store order", () => {
    expect(storeCatalogue(cat, "Colruyt").map((p) => p.name)).toEqual(["Bananas", "bread", "Eggs"]);
    expect(storeCatalogue(cat, "Colruyt")[2].keys).toEqual(["eggs", "egg"]);
  });
  it("sorts the shopping list in walking order, unknown items last", () => {
    const list = [{ name: "egg", category: "eggs" }, { name: "Coffee", category: "drinks" }, { name: "banana", category: "fruit" }, { name: "Apples", category: "fruit" }];
    const r = sortForStore(list, cat, "Colruyt");
    expect(r.ordered.map((i) => i.name)).toEqual(["banana", "egg"]);
    expect(r.unplaced.map((i) => i.name)).toEqual(["Coffee", "Apples"]);
  });
  it("moves entries", () => {
    expect(move(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(move(["a", "b", "c"], 0, 5)).toEqual(["b", "c", "a"]);
  });
});
