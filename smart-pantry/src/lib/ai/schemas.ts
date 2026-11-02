import { z } from "zod";

export const AiIngredient = z.object({
  name: z.string().min(1),
  quantity: z.number().nonnegative().nullable(),
  unit: z.string().nullable(),
  optional: z.boolean().optional().default(false),
});

export const AiRecipe = z.object({
  kind: z.enum(["favourite", "practical", "discovery", "custom"]),
  title: z.string().min(1),
  description: z.string(),
  why: z.string(),
  cuisine: z.string().nullable(),
  main_ingredients: z.array(z.string()).max(8),
  methods: z.array(z.string()).max(4),
  tags: z.array(z.string()).max(8).default([]),
  prep_minutes: z.number().int().min(0).max(600),
  cook_minutes: z.number().int().min(0).max(1440),
  difficulty: z.enum(["easy", "medium", "hard"]),
  servings: z.number().int().min(1).max(20),
  ingredients: z.array(AiIngredient).min(1).max(30),
  steps: z.array(z.string().min(1)).min(1).max(25),
  uses_expiring: z.array(z.string()).default([]),
  estimated_missing_cost: z.number().nonnegative().nullable(),
  nutrition: z.object({ kcal: z.number().nullable(), protein_g: z.number().nullable() }).nullable(),
  image_query: z.string(),
});
export type AiRecipe = z.infer<typeof AiRecipe>;

export const AiRecipeSet = z.object({ message: z.string(), recipes: z.array(AiRecipe).min(1).max(3) });

export const ScannedItem = z.object({
  name: z.string().min(1),
  category: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
  location: z.enum(["fridge", "freezer", "pantry", "other"]),
  expiry_type: z.enum(["use_by", "best_before", "none"]),
  suggested_shelf_days: z.number().int().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  price: z.number().nullable().optional(),
});
export const ScanResult = z.object({ items: z.array(ScannedItem).max(80), store_name: z.string().nullable().optional() });
export type ScannedItem = z.infer<typeof ScannedItem>;

/** JSON schema handed to Claude as a tool input schema (mirrors AiRecipe). */
export const recipeToolSchema = {
  type: "object",
  required: ["message", "recipes"],
  properties: {
    message: { type: "string", description: "One or two friendly sentences addressed to the household." },
    recipes: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        required: ["kind", "title", "description", "why", "cuisine", "main_ingredients", "methods", "prep_minutes", "cook_minutes", "difficulty", "servings", "ingredients", "steps", "uses_expiring", "estimated_missing_cost", "nutrition", "image_query"],
        properties: {
          kind: { type: "string", enum: ["favourite", "practical", "discovery", "custom"] },
          title: { type: "string" },
          description: { type: "string" },
          why: { type: "string", description: "Why this fits: name the preferences/expiring items it uses." },
          cuisine: { type: ["string", "null"] },
          main_ingredients: { type: "array", items: { type: "string" }, description: "2-6 defining ingredients, generic names" },
          methods: { type: "array", items: { type: "string" }, description: "e.g. roast, stir-fry, braise, bake, raw" },
          tags: { type: "array", items: { type: "string" } },
          prep_minutes: { type: "integer" },
          cook_minutes: { type: "integer" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          servings: { type: "integer" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "quantity", "unit"],
              properties: {
                name: { type: "string", description: "Use the stock item's name when using stock" },
                quantity: { type: ["number", "null"] },
                unit: { type: ["string", "null"], description: "g, kg, ml, l, pcs, tbsp, tsp" },
                optional: { type: "boolean" },
              },
            },
          },
          steps: { type: "array", items: { type: "string" } },
          uses_expiring: { type: "array", items: { type: "string" } },
          estimated_missing_cost: { type: ["number", "null"], description: "Rough cost of ingredients NOT in stock, household currency" },
          nutrition: {
            type: ["object", "null"],
            properties: { kcal: { type: ["number", "null"] }, protein_g: { type: ["number", "null"] } },
            description: "Rough per-serving estimate",
          },
          image_query: { type: "string", description: "2-4 word photo search query for the finished dish" },
        },
      },
    },
  },
} as const;

export const scanToolSchema = {
  type: "object",
  required: ["items"],
  properties: {
    store_name: { type: ["string", "null"], description: "Shop name if printed (receipts), else null" },
    items: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "category", "quantity", "unit", "location", "expiry_type", "suggested_shelf_days", "confidence"],
        properties: {
          name: { type: "string", description: "Generic product name, e.g. 'Whole milk'" },
          category: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string", description: "g, kg, ml, l or pcs" },
          location: { type: "string", enum: ["fridge", "freezer", "pantry", "other"] },
          expiry_type: { type: "string", enum: ["use_by", "best_before", "none"] },
          suggested_shelf_days: { type: ["integer", "null"], description: "Typical days until expiry from purchase; null if unknown" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          price: { type: ["number", "null"] },
        },
      },
    },
  },
} as const;
