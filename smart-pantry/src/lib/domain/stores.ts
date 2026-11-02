import type { InventoryItem, ShoppingItem } from "./types";
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
