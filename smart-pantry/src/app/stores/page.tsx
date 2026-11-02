"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useHousehold } from "@/lib/store";
import { move, storeCatalogue } from "@/lib/domain/stores";
import { normalizeName } from "@/lib/domain/names";
import { guessCategory } from "@/lib/domain/shopping";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Empty } from "@/components/ui";

// Typical supermarket route, used for the one-tap "sort by aisle type" start.
const AISLE = ["fruit", "vegetables", "bread", "meat", "fish", "dairy", "eggs", "pasta & rice", "grains", "legumes", "sauces", "oils", "spices", "baking", "snacks", "drinks", "frozen", "other"];

function StoresInner() {
  const { household, storeProducts, setStoreProducts, reloadStoreProducts, shopping, rpc, upsertLocal, toast } = useHousehold();
  const stores = household?.stores ?? [];
  const params = useSearchParams();
  const [store, setStore] = useState(params.get("s") ?? stores[0] ?? "");
  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");
  const catalogue = useMemo(() => storeCatalogue(storeProducts, store), [storeProducts, store]);
  const [order, setOrder] = useState(catalogue);
  useEffect(() => setOrder(catalogue), [catalogue]);
  const onList = new Set(shopping.filter((s) => s.status === "open").map((s) => normalizeName(s.name)));

  async function save(next: typeof order) {
    setOrder(next);
    // Optimistic local update, then one transactional save that partners receive live.
    const keys = next.flatMap((p) => p.keys);
    const pos = new Map(keys.map((k, i) => [k, i]));
    setStoreProducts(storeProducts.map((p) => (p.store === store && pos.has(p.normalized_name) ? { ...p, position: pos.get(p.normalized_name)! } : p)));
    await rpc("set_store_order", { p_household: household!.id, p_store: store, p_names: keys });
  }

  // ── touch/mouse drag on the ≡ handle ──
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  function onPointerDown(e: React.PointerEvent, i: number) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ from: i, to: i });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    let to = drag.to;
    rows.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (e.clientY > r.top && e.clientY < r.bottom) to = i;
    });
    if (to !== drag.to) setDrag({ ...drag, to });
    if (e.clientY < 80) window.scrollBy(0, -12);
    if (e.clientY > window.innerHeight - 120) window.scrollBy(0, 12);
  }
  function onPointerUp() {
    if (drag && drag.from !== drag.to) save(move(order, drag.from, drag.to));
    setDrag(null);
  }
  const shown = drag ? move(order, drag.from, drag.to) : order;
  const filtered = q ? shown.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())) : shown;

  async function addToList(name: string, category: string) {
    const r = await rpc<any>("add_shopping_item", { p_household: household!.id, p_name: name, p_normalized: normalizeName(name), p_category: category, p_store: store });
    if (r) { upsertLocal("shopping", r); toast(`${name} added to the ${store} list`); }
  }
  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await rpc("remember_store_product", { p_household: household!.id, p_store: store, p_norm: normalizeName(name), p_name: name, p_category: guessCategory(name) });
    setNewName("");
    reloadStoreProducts();
  }
  async function remove(keys: string[]) {
    await supabaseBrowser().from("store_products").delete().eq("household_id", household!.id).eq("store", store).in("normalized_name", keys);
    setStoreProducts(storeProducts.filter((p) => !(p.store === store && keys.includes(p.normalized_name))));
  }

  if (!stores.length) return <Empty icon="🏪" title="No stores yet"><Link href="/settings" className="text-brand-700">Add your stores in Settings →</Link></Empty>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Store layout</h1>
        <Link href={`/shopping?store=${encodeURIComponent(store)}`} className="btn-ghost">🛒 List</Link>
      </div>
      <div className="flex gap-1.5">
        {stores.map((s) => <button key={s} onClick={() => setStore(s)} className={`btn ${store === s ? "bg-stone-900 text-white" : "btn-ghost"}`}>🏪 {s} <span className="opacity-60">{storeCatalogue(storeProducts, s).length}</span></button>)}
      </div>
      <p className="text-sm text-stone-500">
        Everything you buy at {store}, in the order you walk through the shop. Drag ≡ to reorder; your shopping list for {store} follows this order.
        Products tagged with {store} are added here automatically.
      </p>
      <div className="flex gap-2">
        <input className="input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-ghost shrink-0 text-xs" onClick={() => confirm("Reorder by aisle type (fruit & veg first, frozen last)? You can fine-tune after.") &&
          save([...order].sort((a, b) => AISLE.indexOf(a.category) - AISLE.indexOf(b.category)))}>Sort by aisle type</button>
      </div>

      {order.length === 0 ? <Empty icon="🧭" title={`Nothing for ${store} yet`}>Tag products or shopping items with {store}, or add them below.</Empty> : (
        <ol className="card divide-y divide-stone-100 select-none" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {filtered.map((p) => {
            const i = shown.indexOf(p);
            const dragging = drag && shown[drag.to] === p;
            return (
              <li key={p.normalized_name} ref={(el) => { rows.current[i] = el; }} className={`flex items-center gap-2 px-2 py-2 ${dragging ? "bg-brand-50 shadow-inner" : ""}`}>
                <span className="w-6 text-right text-xs tabular-nums text-stone-400">{i + 1}</span>
                <button aria-label={`Drag ${p.name}`} className="cursor-grab touch-none px-2 py-1 text-xl text-stone-400 active:cursor-grabbing" onPointerDown={(e) => onPointerDown(e, i)} disabled={!!q}>≡</button>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="text-xs text-stone-400">{p.category}</div>
                </div>
                {onList.has(normalizeName(p.name))
                  ? <span className="chip bg-brand-50 text-brand-700">on list</span>
                  : <button className="chip bg-stone-100 py-1 text-stone-600 hover:bg-stone-200" onClick={() => addToList(p.name, p.category)}>＋ list</button>}
                <div className="flex flex-col">
                  <button aria-label="Move up" className="px-1 text-xs text-stone-400 disabled:opacity-20" disabled={i === 0 || !!q} onClick={() => save(move(order, i, i - 1))}>▲</button>
                  <button aria-label="Move down" className="px-1 text-xs text-stone-400 disabled:opacity-20" disabled={i === order.length - 1 || !!q} onClick={() => save(move(order, i, i + 1))}>▼</button>
                </div>
                <button aria-label={`Remove ${p.name} from ${store}`} className="px-1 text-stone-300 hover:text-red-500" onClick={() => remove(p.keys)}>✕</button>
              </li>
            );
          })}
        </ol>
      )}
      <form onSubmit={addProduct} className="flex gap-2">
        <input className="input" placeholder={`Add a product you buy at ${store}`} value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={!newName.trim()}>Add</button>
      </form>
    </div>
  );
}
export default function StoresPage() {
  return <Suspense><StoresInner /></Suspense>;
}
