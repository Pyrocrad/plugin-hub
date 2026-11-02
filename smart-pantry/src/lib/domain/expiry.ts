import type { InventoryItem, ExpiryType } from "./types";

export type Urgency = "expired" | "today" | "within2" | "within5" | "within7" | "fresh" | "unknown";

export const URGENCY_META: Record<Urgency, { label: string; color: string; rank: number }> = {
  expired: { label: "Past date", color: "bg-red-600 text-white", rank: 0 },
  today: { label: "Today", color: "bg-red-500 text-white", rank: 1 },
  within2: { label: "≤ 2 days", color: "bg-orange-500 text-white", rank: 2 },
  within5: { label: "≤ 5 days", color: "bg-amber-400 text-amber-950", rank: 3 },
  within7: { label: "≤ 7 days", color: "bg-yellow-200 text-yellow-900", rank: 4 },
  fresh: { label: "Fresh", color: "bg-emerald-100 text-emerald-800", rank: 5 },
  unknown: { label: "No date", color: "bg-slate-100 text-slate-600", rank: 6 },
};

/** Parse a YYYY-MM-DD date as a local calendar day (no timezone drift). */
export function parseDay(d: string): Date {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, day);
}
export function toDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function addDays(d: string, n: number): string {
  const x = parseDay(d);
  x.setDate(x.getDate() + n);
  return toDay(x);
}
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
}

/**
 * Effective date = the earlier of the printed date and (opened + days_after_opening).
 * Opened milk with a printed date two weeks away is still only good for a few days.
 */
export function effectiveExpiry(item: Pick<InventoryItem, "expiry_date" | "opened_at" | "days_after_opening">): string | null {
  const printed = item.expiry_date;
  const opened = item.opened_at && item.days_after_opening != null ? addDays(item.opened_at, item.days_after_opening) : null;
  if (printed && opened) return printed < opened ? printed : opened;
  return printed ?? opened;
}

export function daysLeft(item: Pick<InventoryItem, "expiry_date" | "opened_at" | "days_after_opening">, today: string): number | null {
  const e = effectiveExpiry(item);
  return e == null ? null : daysBetween(today, e);
}

export function urgencyOf(item: Pick<InventoryItem, "expiry_date" | "opened_at" | "days_after_opening" | "expiry_type">, today: string): Urgency {
  if (item.expiry_type === "none") return "unknown";
  const d = daysLeft(item, today);
  if (d == null) return "unknown";
  if (d < 0) return "expired";
  if (d === 0) return "today";
  if (d <= 2) return "within2";
  if (d <= 5) return "within5";
  if (d <= 7) return "within7";
  return "fresh";
}

/**
 * Safety wording. Use-by is a safety date, best-before is a quality date.
 * We never claim something is safe just because the date has not passed.
 */
export function expiryAdvice(type: ExpiryType, days: number | null): string {
  if (days == null || type === "none") return "No date recorded – check the product yourself.";
  if (type === "use_by") {
    if (days < 0) return "Use-by date has passed. Do not eat – discard it.";
    if (days === 0) return "Use-by date is today. Eat today or freeze it now (if suitable).";
    return `Use by in ${days} day${days === 1 ? "" : "s"}. Follow storage instructions; a date is not a safety guarantee.`;
  }
  if (days < 0) return "Best-before has passed. Quality may be lower – look, smell and taste before using.";
  return `Best before in ${days} day${days === 1 ? "" : "s"} (quality date, not a safety guarantee).`;
}

export function groupByUrgency<T extends InventoryItem>(items: T[], today: string): Record<Urgency, T[]> {
  const out = { expired: [], today: [], within2: [], within5: [], within7: [], fresh: [], unknown: [] } as Record<Urgency, T[]>;
  for (const it of items) if (it.status === "active") out[urgencyOf(it, today)].push(it);
  for (const k of Object.keys(out) as Urgency[]) out[k].sort((a, b) => (effectiveExpiry(a) ?? "9999").localeCompare(effectiveExpiry(b) ?? "9999"));
  return out;
}

/** Typical freezer life in days for common categories (used when moving to freezer). */
export const FREEZER_DAYS: Record<string, number> = { meat: 120, fish: 90, bread: 90, vegetables: 240, fruit: 240, dairy: 60, other: 90 };
