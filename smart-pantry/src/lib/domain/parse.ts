import { normalizeUnit } from "./units";
import { guessCategory } from "./shopping";

export interface ParsedLine {
  name: string;
  quantity: number;
  unit: string;
  category: string;
}

/**
 * Deterministic quick-add parser (typed or voice-dictated), no AI cost:
 *   "2 l milk, 6 eggs and 500g chicken breast; 1 kg potatoes"
 */
export function parseQuickAdd(text: string): ParsedLine[] {
  return text
    .split(/,(?!\d)|;|\n|\band\b|\ben\b/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = /^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+\.?)?\s+(.*)$/.exec(s) ?? /^(\d+(?:[.,]\d+)?)([a-zA-Z]+)\s*(.*)$/.exec(s);
      if (!m) return { name: cap(s), quantity: 1, unit: "pcs", category: guessCategory(s) };
      const qty = Number(m[1].replace(",", "."));
      let unit = normalizeUnit(m[2] ?? "");
      let name = m[3];
      const known = ["g", "kg", "mg", "ml", "cl", "dl", "l", "pcs", "tbsp", "tsp", "cup", "oz", "lb", "pack", "can", "jar", "bunch"];
      if (!known.includes(unit)) {
        // "6 eggs" – the word was the product, not a unit.
        name = `${m[2] ?? ""} ${name}`.trim();
        unit = "pcs";
      }
      name = name.replace(/^of\s+/i, "");
      return { name: cap(name), quantity: qty, unit, category: guessCategory(name) };
    });
}
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
