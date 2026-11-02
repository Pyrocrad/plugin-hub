import { describe, expect, it } from "vitest";
import { convert, formatQuantity, normalizeUnit, quickSteps } from "@/lib/domain/units";

describe("units", () => {
  it("normalises aliases", () => {
    expect(normalizeUnit("Grams")).toBe("g");
    expect(normalizeUnit("litres")).toBe("l");
    expect(normalizeUnit("")).toBe("pcs");
    expect(normalizeUnit("pack")).toBe("pack");
  });
  it("converts within a dimension only", () => {
    expect(convert(1.5, "kg", "g")).toBe(1500);
    expect(convert(250, "ml", "l")).toBe(0.25);
    expect(convert(2, "tbsp", "ml")).toBe(30);
    expect(convert(100, "g", "ml")).toBeNull();
    expect(convert(1, "pack", "g")).toBeNull();
  });
  it("formats", () => {
    expect(formatQuantity(1500, "g")).toBe("1.5 kg");
    expect(formatQuantity(0.25, "l")).toBe("250 ml");
    expect(formatQuantity(6, "pcs")).toBe("6 st.");
  });
  it("quick steps never exceed what is left", () => {
    expect(quickSteps(1000, "ml")).toEqual([100, 250, 500]);
    expect(quickSteps(200, "ml")).toEqual([100]);
    expect(quickSteps(1, "pcs")).toEqual([]);
  });
});
