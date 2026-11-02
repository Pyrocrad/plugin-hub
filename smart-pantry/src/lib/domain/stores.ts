import type { InventoryItem, ShoppingItem, StoreProduct } from "./types";
import { normalizeName } from "./names";

/** Store this household most recently bought a product at (null if never recorded). */
export function preferredStore(name: string, inventory: InventoryItem[], shopping: ShoppingItem[] = []): string | null {
  const n = normalizeName(name);
  const seen: { store: string; at: string }[] = [
    ...inventory.filter((i) => i.store && normalizeName(i.name) === n).map((i) => ({ store: i.store!, at: i.created_at })),
    ...shopping.filter((s) => s.store && s.status === "purchased" && s.normalized_name === n).map((s) => ({ store: s.store!, at: s.purchased_at ?? s.created_at })),
  ];
  if (!seen.length) return null;
  return seen.sort((a, b) => b.at.localeCompare(a.at))[0].store;
}

/** Match a store name read from a receipt ("LIDL BELGIUM GMBH") to one of the household's stores. */
export function matchStore(raw: string | null | undefined, stores: string[]): string | null {
  if (!raw) return null;
  const r = raw.toLowerCase();
  return stores.find((s) => r.includes(s.toLowerCase()) || s.toLowerCase().includes(r.trim())) ?? null;
}

const STORE_COLORS = ["bg-sky-100 text-sky-800", "bg-amber-100 text-amber-800", "bg-fuchsia-100 text-fuchsia-800", "bg-teal-100 text-teal-800"];
export function storeColor(store: string, stores: string[]): string {
  const i = stores.indexOf(store);
  return STORE_COLORS[(i < 0 ? 3 : i) % STORE_COLORS.length];
}


/** One row per product for a store, in walking order (duplicate spellings merged). */
export function storeCatalogue(all: StoreProduct[], store: string): (StoreProduct & { keys: string[] })[] {
  const out = new Map<string, StoreProduct & { keys: string[] }>();
  for (const p of all.filter((p) => p.store === store).sort((a, b) => a.position - b.position)) {
    const k = normalizeName(p.name);
    const prev = out.get(k);
    if (prev) prev.keys.push(p.normalized_name);
    else out.set(k, { ...p, keys: [p.normalized_name] });
  }
  return [...out.values()];
}

/**
 * Order a store's shopping items by the household's walking order.
 * Items the store has never seen go last, grouped by category.
 */
export function sortForStore<T extends { name: string; category: string }>(items: T[], all: StoreProduct[], store: string): { ordered: T[]; unplaced: T[] } {
  const pos = new Map(storeCatalogue(all, store).map((p, i) => [normalizeName(p.name), i]));
  const ordered = items.filter((i) => pos.has(normalizeName(i.name))).sort((a, b) => pos.get(normalizeName(a.name))! - pos.get(normalizeName(b.name))!);
  const unplaced = items.filter((i) => !pos.has(normalizeName(i.name))).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return { ordered, unplaced };
}

/** Move one entry in a list (drag & drop / arrow buttons). */
export function move<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list];
  const [x] = copy.splice(from, 1);
  copy.splice(Math.max(0, Math.min(to, copy.length)), 0, x);
  return copy;
}
