import { describe, expect, it } from "vitest";
import { buildBridgePrompt, parseBridgeReply } from "@/lib/ai/prompt";

const recipe = { kind: "practical", title: "Broccolisoep", description: "Romig", why: "Broccoli moet op", cuisine: "belgisch", main_ingredients: ["broccoli"], methods: ["koken"],
  prep_minutes: 10, cook_minutes: 20, difficulty: "easy", servings: 2, ingredients: [{ name: "Broccoli", quantity: 1, unit: "pcs" }, { name: "zout", quantity: 0, unit: null }], steps: ["Koken", "Mixen"],
  uses_expiring: ["Broccoli"], estimated_missing_cost: null, nutrition: null, image_query: "broccoli soup" };

describe("Claude app bridge", () => {
  it("builds a prompt with the household context and the format", () => {
    const p = buildBridgePrompt({ stock: [{ name: "Broccoli" }] }, "Iets snel", { maxMinutes: 20 });
    expect(p).toContain('"Broccoli"');
    expect(p).toContain("maximaal 20 minuten");
    expect(p).toContain("```json");
  });
  it("reads a fenced answer with chatter around it", () => {
    const text = "Hier zijn drie ideeën!\n```json\n" + JSON.stringify({ message: "Smakelijk", recipes: [recipe] }) + "\n```\nLaat maar weten.";
    const r = parseBridgeReply(text);
    expect(r.recipes[0].title).toBe("Broccolisoep");
    expect(r.recipes[0].ingredients[1].quantity).toBeNull();
  });
  it("tolerates missing optional fields and unfenced JSON", () => {
    const { tags, uses_expiring, nutrition, image_query, ...minimal } = recipe as any;
    expect(parseBridgeReply("ok " + JSON.stringify({ recipes: [minimal] })).recipes).toHaveLength(1);
  });
  it("gives a clear Dutch error for garbage", () => {
    expect(() => parseBridgeReply("sorry, ik weet het niet")).toThrow(/Geen recepten gevonden/);
  });
});
