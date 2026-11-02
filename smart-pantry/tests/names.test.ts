import { describe, expect, it } from "vitest";
import { nameMatchScore, normalizeName } from "@/lib/domain/names";

describe("Dutch and English name matching", () => {
  it.each([
    ["tomaten", "tomaat"], ["eieren", "ei"], ["Eitjes", "ei"], ["uien", "ui"], ["aardappelen", "aardappel"],
    ["verse spinazie", "spinazie"], ["Kipfilet", "kippenborst"], ["Halfvolle melk", "melk"], ["Chicken breasts", "chicken breast"], ["eggs", "egg"],
  ])("%s ≈ %s", (a, b) => expect(nameMatchScore(a, b)).toBe(1));
  it("keeps distinct products apart", () => {
    expect(nameMatchScore("melk", "kokosmelk")).toBe(0);
    expect(normalizeName("green onion")).toBe(normalizeName("spring onion"));
  });
});

import { guessCategory } from "@/lib/domain/shopping";
describe("categories in Dutch", () => {
  it.each([["Rode uien", "vegetables"], ["Fruitsap", "drinks"], ["Kipfilet", "meat"], ["Eieren", "eggs"], ["Volle melk", "dairy"], ["Bananen", "fruit"], ["Zalmfilet", "fish"], ["Basmatirijst", "pasta & rice"]])(
    "%s → %s", (n, c) => expect(guessCategory(n)).toBe(c));
});
