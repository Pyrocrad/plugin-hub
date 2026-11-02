"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useHousehold, today } from "@/lib/store";
import { LOCATIONS, type InventoryItem, type Location } from "@/lib/domain/types";
import { URGENCY_META, effectiveExpiry, urgencyOf } from "@/lib/domain/expiry";
import { ItemRow } from "@/components/ItemRow";
import { ItemSheet } from "@/components/ItemSheet";
import { AddSheet } from "@/components/AddSheet";
import { Empty } from "@/components/ui";

function InventoryInner() {
  const { inventory } = useHousehold();
  const params = useSearchParams();
  const [loc, setLoc] = useState<Location | "all">((params.get("loc") as Location) ?? "all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"expiry" | "name" | "category">("expiry");
  const [open, setOpen] = useState<InventoryItem | null>(null);
  const [adding, setAdding] = useState(params.get("add") === "1");

  const active = inventory.filter((i) => i.status === "active");
  const list = useMemo(() => {
    const t = today();
    return active
      .filter((i) => (loc === "all" || i.location === loc) && i.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) =>
        sort === "name" ? a.name.localeCompare(b.name)
        : sort === "category" ? a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
        : URGENCY_META[urgencyOf(a, t)].rank - URGENCY_META[urgencyOf(b, t)].rank || (effectiveExpiry(a) ?? "9").localeCompare(effectiveExpiry(b) ?? "9"));
  }, [active, loc, q, sort]);

  const groups = loc === "all" ? LOCATIONS.map((l) => ({ ...l, items: list.filter((i) => i.location === l.id) })).filter((g) => g.items.length) : [{ ...LOCATIONS.find((l) => l.id === loc)!, items: list }];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">My inventory</h1>
        <button className="btn-primary" onClick={() => setAdding(true)}>＋ Add</button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[{ id: "all" as const, label: "All", icon: "🏠" }, ...LOCATIONS].map((l) => (
          <button key={l.id} onClick={() => setLoc(l.id)} className={`btn shrink-0 ${loc === l.id ? "bg-stone-900 text-white" : "btn-ghost"}`}>
            {l.icon} {l.label} <span className="opacity-60">{l.id === "all" ? active.length : active.filter((i) => i.location === l.id).length}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-36" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="expiry">Use first</option><option value="name">A–Z</option><option value="category">Category</option>
        </select>
      </div>
      {list.length === 0 ? (
        <Empty icon="🧺" title={q ? "Nothing matches" : "Nothing here yet"}>Tap “Add” to type, speak, scan a barcode, or photograph your groceries.</Empty>
      ) : groups.map((g) => (
        <section key={g.id}>
          <h2 className="mb-1.5 px-1 text-sm font-medium text-stone-500">{g.icon} {g.label}</h2>
          <ul className="card divide-y divide-stone-100">{g.items.map((i) => <ItemRow key={i.id} item={i} onOpen={() => setOpen(i)} />)}</ul>
        </section>
      ))}
      <ItemSheet item={open} onClose={() => setOpen(null)} />
      <AddSheet open={adding} onClose={() => setAdding(false)} initialLocation={loc === "all" ? undefined : loc} />
    </div>
  );
}
export default function InventoryPage() {
  return <Suspense><InventoryInner /></Suspense>;
}
