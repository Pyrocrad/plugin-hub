// Deterministic unit handling. Claude never does arithmetic on the inventory.
export type Dimension = "mass" | "volume" | "count";

const UNITS: Record<string, { dim: Dimension; factor: number; canonical: string }> = {
  g: { dim: "mass", factor: 1, canonical: "g" },
  kg: { dim: "mass", factor: 1000, canonical: "kg" },
  mg: { dim: "mass", factor: 0.001, canonical: "mg" },
  oz: { dim: "mass", factor: 28.3495, canonical: "oz" },
  lb: { dim: "mass", factor: 453.592, canonical: "lb" },
  ml: { dim: "volume", factor: 1, canonical: "ml" },
  cl: { dim: "volume", factor: 10, canonical: "cl" },
  dl: { dim: "volume", factor: 100, canonical: "dl" },
  l: { dim: "volume", factor: 1000, canonical: "l" },
  tsp: { dim: "volume", factor: 5, canonical: "tsp" },
  tbsp: { dim: "volume", factor: 15, canonical: "tbsp" },
  cup: { dim: "volume", factor: 240, canonical: "cup" },
  pcs: { dim: "count", factor: 1, canonical: "pcs" },
};

const ALIASES: Record<string, string> = {
  gram: "g", grams: "g", gr: "g", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  milliliter: "ml", millilitre: "ml", milliliters: "ml", millilitres: "ml",
  liter: "l", litre: "l", liters: "l", litres: "l", lt: "l",
  teaspoon: "tsp", teaspoons: "tsp", tablespoon: "tbsp", tablespoons: "tbsp", el: "tbsp", tl: "tsp",
  cups: "cup", pounds: "lb", pound: "lb", lbs: "lb", ounce: "oz", ounces: "oz",
  pc: "pcs", piece: "pcs", pieces: "pcs", stuk: "pcs", stuks: "pcs", x: "pcs", "": "pcs",
  each: "pcs", unit: "pcs", units: "pcs", clove: "pcs", cloves: "pcs", egg: "pcs", eggs: "pcs",
};

export const UNIT_OPTIONS = ["g", "kg", "ml", "l", "pcs", "tbsp", "tsp", "cup", "pack", "can", "jar", "bunch"];

export function normalizeUnit(u: string | null | undefined): string {
  const k = (u ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (UNITS[k]) return k;
  if (k in ALIASES) return ALIASES[k];
  return k; // unknown/packaging units (pack, can, jar, bunch) are kept as-is
}

export function dimensionOf(u: string): Dimension | null {
  return UNITS[normalizeUnit(u)]?.dim ?? null;
}

/** Convert amount between units. Returns null if not convertible (never guesses). */
export function convert(amount: number, from: string, to: string): number | null {
  const f = normalizeUnit(from);
  const t = normalizeUnit(to);
  if (f === t) return amount;
  const a = UNITS[f];
  const b = UNITS[t];
  if (!a || !b || a.dim !== b.dim) return null;
  return round((amount * a.factor) / b.factor);
}

export function round(n: number, decimals = 3): number {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

/** Human friendly quantity: 1500 g → "1.5 kg", 0.25 l → "250 ml". */
export function formatQuantity(q: number, unit: string): string {
  const u = normalizeUnit(unit);
  if (u === "g" && q >= 1000) return `${trim(q / 1000)} kg`;
  if (u === "ml" && q >= 1000) return `${trim(q / 1000)} l`;
  if (u === "kg" && q < 1) return `${trim(q * 1000)} g`;
  if (u === "l" && q < 1) return `${trim(q * 1000)} ml`;
  return `${trim(q)} ${u}`;
}
function trim(n: number) {
  return String(round(n, 2));
}

/** Sensible quick-consume steps for an item, expressed in the item's own unit. */
export function quickSteps(quantity: number, unit: string): number[] {
  const u = normalizeUnit(unit);
  let steps: number[];
  if (u === "ml") steps = [100, 250, 500];
  else if (u === "l") steps = [0.1, 0.25, 0.5];
  else if (u === "g") steps = [50, 100, 250];
  else if (u === "kg") steps = [0.1, 0.25, 0.5];
  else steps = [1, 2];
  return steps.filter((s) => s < quantity);
}
