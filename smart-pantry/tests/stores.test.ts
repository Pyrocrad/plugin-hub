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
