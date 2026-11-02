"use client";
import { useEffect, type ReactNode } from "react";
import { URGENCY_META, daysLeft, urgencyOf } from "@/lib/domain/expiry";
import type { InventoryItem } from "@/lib/domain/types";
import { today } from "@/lib/store";

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl md:max-w-lg md:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-ghost h-8 w-8 rounded-full p-0" onClick={onClose} aria-label="Sluiten">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ExpiryBadge({ item }: { item: InventoryItem }) {
  const u = urgencyOf(item, today());
  const d = daysLeft(item, today());
  const label = d == null || item.expiry_type === "none" ? "Geen datum" : d < 0 ? `${-d}d over datum` : d === 0 ? "Vandaag" : `${d}d`;
  return (
    <span className={`chip ${URGENCY_META[u].color}`} title={item.expiry_type === "use_by" ? "Te gebruiken tot (veiligheid)" : "Ten minste houdbaar tot (kwaliteit)"}>
      {item.expiry_type === "use_by" && d != null ? "⚠︎ " : ""}{label}
    </span>
  );
}

export function Stars({ value, onChange, size = "text-2xl" }: { value: number; onChange?: (v: number) => void; size?: string }) {
  return (
    <div className={`flex ${size}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} className={`px-0.5 ${n <= value ? "text-amber-400" : "text-stone-300"}`} aria-label={`${n} sterren`}>★</button>
      ))}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-2 text-4xl">{icon}</div>
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-sm text-stone-500">{children}</div>
    </div>
  );
}

const PALETTE = ["from-orange-200 to-rose-200", "from-lime-200 to-emerald-200", "from-amber-200 to-yellow-100", "from-sky-200 to-indigo-200", "from-fuchsia-200 to-pink-100"];
const EMOJI: [RegExp, string][] = [[/curry|dal/i, "🍛"], [/pasta|spaghetti|penne|lasagn|bolognaise/i, "🍝"], [/soup|stew|soep|stoofvlees|stoverij|stoemp/i, "🍲"], [/salad|salade/i, "🥗"], [/taco|burrito|wrap/i, "🌮"], [/pizza/i, "🍕"], [/rice|risotto|paella|rijst/i, "🍚"], [/noodle|ramen|pad|noedel/i, "🍜"], [/fish|salmon|cod|zalm|vis|kabeljauw/i, "🐟"], [/chicken|kip/i, "🍗"], [/egg|eieren|omelet|frittata|shakshuka|çılbır/i, "🍳"], [/burger/i, "🍔"], [/cake|pie|tart|taart/i, "🥧"], [/friet/i, "🍟"]];

export function RecipeImage({ title, url, className = "h-40" }: { title: string; url: string | null; className?: string }) {
  if (url) return <img src={url} alt={title} className={`${className} w-full object-cover`} loading="lazy" />;
  const h = [...title].reduce((a, c) => a + c.charCodeAt(0), 0);
  const emoji = EMOJI.find(([r]) => r.test(title))?.[1] ?? "🍽️";
  return <div className={`${className} flex w-full items-center justify-center bg-gradient-to-br ${PALETTE[h % PALETTE.length]} text-6xl`} aria-label={title}>{emoji}</div>;
}

export function Avatar({ name, color }: { name: string; color?: string }) {
  return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ background: color ?? "#78716c" }} title={name}>{name.slice(0, 1).toUpperCase()}</span>;
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "net nu";
  if (s < 3600) return `${Math.floor(s / 60)} min geleden`;
  if (s < 86400) return `${Math.floor(s / 3600)} u geleden`;
  return `${Math.floor(s / 86400)} d geleden`;
}

/** Chip row to pick one of the household's stores (or none). */
export function StorePicker({ stores, value, onChange, label = "Winkel" }: { stores: string[]; value: string | null; onChange: (s: string | null) => void; label?: string }) {
  if (!stores.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-stone-500">{label}</span>
      {stores.map((s) => (
        <button key={s} type="button" onClick={() => onChange(value === s ? null : s)}
          className={`chip py-1 ${value === s ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"}`}>🏪 {s}</button>
      ))}
    </div>
  );
}

export function StoreChip({ store, stores }: { store: string | null; stores: string[] }) {
  if (!store) return null;
  const COLORS = ["bg-sky-100 text-sky-800", "bg-amber-100 text-amber-800", "bg-fuchsia-100 text-fuchsia-800"];
  const i = stores.indexOf(store);
  return <span className={`chip ${i < 0 ? "bg-stone-100 text-stone-600" : COLORS[i % COLORS.length]}`}>{store}</span>;
}
