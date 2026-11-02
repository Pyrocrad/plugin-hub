"use client";
import { useState } from "react";
import { useHousehold } from "@/lib/store";
import { groupByCategory, guessCategory, lowStockSuggestions } from "@/lib/domain/shopping";
import { normalizeName } from "@/lib/domain/names";
import { normalizeUnit, formatQuantity } from "@/lib/domain/units";
import { parseQuickAdd } from "@/lib/domain/parse";
import { LOCATIONS, type Location, type ShoppingItem } from "@/lib/domain/types";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Empty, Sheet, StoreChip, StorePicker } from "@/components/ui";
import { preferredStore } from "@/lib/domain/stores";
import { restockSuggestions } from "@/lib/domain/restock";
import { today } from "@/lib/store";

const DEFAULT_LOC: Record<string, Location> = { meat: "fridge", fish: "fridge", dairy: "fridge", eggs: "fridge", vegetables: "fridge", frozen: "freezer" };

export default function ShoppingPage() {
  const { shopping, inventory, household, rpc, reload, upsertLocal, memberName, recipes, events, cookings } = useHousehold();
  const [text, setText] = useState("");
  const [buying, setBuying] = useState<ShoppingItem | null>(null);
  const stores = household?.stores ?? [];
  const [tab, setTab] = useState<string>("all"); // "all" | store name | "none"
  const [addStore, setAddStore] = useState<string | null>(null);
  const allOpen = shopping.filter((s) => s.status === "open");
  const open = allOpen.filter((s) => tab === "all" || (tab === "none" ? !s.store : s.store === tab));
  const done = shopping.filter((s) => s.status === "purchased").slice(0, 15);
  const low = lowStockSuggestions(inventory.filter((i) => i.status !== "spoiled" && i.status !== "discarded"), shopping);
  const smart = restockSuggestions({ inventory, events, cookings, recipes, shopping, today: today() });
  const suggestions = [
    ...smart.map((x) => ({ key: x.normalized_name, name: x.name, quantity: x.quantity as number | null, unit: x.unit as string | null, reason: x.reason })),
    ...low.filter((i) => !smart.some((x) => x.normalized_name === normalizeName(i.name)))
      .map((i) => ({ key: normalizeName(i.name), name: i.name, quantity: null, unit: null, reason: `Below your alert level (${formatQuantity(i.quantity, i.unit)} left)` })),
  ]
    .map((x) => ({ ...x, store: preferredStore(x.name, inventory, shopping) }))
    .filter((x) => tab === "all" || tab === "none" || !x.store || x.store === tab)
    .slice(0, 12);

  async function add(name: string, quantity: number | null, unit: string | null, store?: string | null) {
    // Store: picked explicitly → the open tab → where you last bought it.
    const st = store ?? addStore ?? (tab !== "all" && tab !== "none" ? tab : null) ?? preferredStore(name, inventory, shopping);
    const r = await rpc<ShoppingItem>("add_shopping_item", { p_household: household!.id, p_name: name, p_normalized: normalizeName(name), p_quantity: quantity, p_unit: unit ? normalizeUnit(unit) : null, p_category: guessCategory(name), p_store: st });
    if (r) upsertLocal("shopping", r);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    for (const p of parseQuickAdd(text)) {
      const explicit = p.quantity !== 1 || p.unit !== "pcs";
      await add(p.name, explicit ? p.quantity : null, explicit ? p.unit : null);
    }
    setText("");
  }
  async function remove(s: ShoppingItem) {
    await supabaseBrowser().from("shopping_items").delete().eq("id", s.id);
    reload();
  }
  async function quickTick(s: ShoppingItem) {
    await rpc("purchase_shopping_item", { p_item: s.id, p_add_to_inventory: false, p_store: s.store });
    reload();
  }

  return (
    <div className="space-y-4">
      <h1 className="h1">Shopping list</h1>
      <form onSubmit={submit} className="flex gap-2">
        <input className="input" placeholder="Add items: 2 l milk, bread, 6 eggs" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={!text.trim()}>Add</button>
      </form>
      {text.trim() && <StorePicker stores={stores} value={addStore} onChange={setAddStore} label="Get it at" />}

      {stores.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[["all", "All"], ...stores.map((x) => [x, `🏪 ${x}`]), ["none", "No store"]].map(([id, label]) => {
            const n = id === "all" ? allOpen.length : allOpen.filter((s) => (id === "none" ? !s.store : s.store === id)).length;
            return <button key={id} onClick={() => setTab(id)} className={`btn shrink-0 ${tab === id ? "bg-stone-900 text-white" : "btn-ghost"}`}>{label} <span className="opacity-60">{n}</span></button>;
          })}
        </div>
      )}

      {suggestions.length > 0 && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between bg-gradient-to-r from-violet-50 to-brand-50 px-4 py-3">
            <div>
              <h2 className="h2">💡 Suggested for you</h2>
              <p className="text-xs text-stone-500">Based on what you use often and your regular recipes</p>
            </div>
            <button className="btn-ghost text-xs" onClick={async () => { for (const x of suggestions) await add(x.name, x.quantity, x.unit, x.store); }}>Add all</button>
          </div>
          <ul className="divide-y divide-stone-100">
            {suggestions.map((x) => (
              <li key={x.key} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="font-medium"><span className="capitalize">{x.name}</span>{x.quantity != null && <span className="font-normal text-stone-500"> · {formatQuantity(x.quantity, x.unit ?? "pcs")}</span>}</div>
                  <div className="flex items-center gap-1.5"><span className="truncate text-xs text-violet-700">{x.reason}</span><StoreChip store={x.store} stores={stores} /></div>
                </div>
                <button className="btn bg-brand-600 px-3 py-1.5 text-xs text-white" onClick={() => add(x.name, x.quantity, x.unit, x.store)}>＋ Add</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {open.length === 0 ? <Empty icon="🛒" title={tab === "all" ? "All done!" : "Nothing for this store"}>Missing recipe ingredients can be added from any recipe.</Empty> : (
        groupByCategory(open).map(([cat, items]) => (
          <section key={cat}>
            <h2 className="mb-1 px-1 text-sm font-medium capitalize text-stone-500">{cat}</h2>
            <ul className="card divide-y divide-stone-100">
              {items.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                  <button className="h-6 w-6 shrink-0 rounded-full border-2 border-stone-300 hover:border-brand-500" onClick={() => setBuying(s)} aria-label={`Bought ${s.name}`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{s.name} {s.quantity != null && <span className="font-normal text-stone-500">· {formatQuantity(s.quantity, s.unit ?? "pcs")}</span>}</div>
                    <div className="truncate text-xs text-stone-400">
                      {memberName(s.added_by)}{s.recipe_id && ` · for ${recipes.find((r) => r.id === s.recipe_id)?.title ?? "a recipe"}`}{s.notes && ` · ${s.notes}`}
                    </div>
                  </div>
                  <StoreCycle item={s} stores={stores} />
                  <NoteButton item={s} />
                  <button className="text-stone-300 hover:text-red-500" onClick={() => remove(s)} aria-label="Remove">✕</button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {done.length > 0 && (
        <section>
          <h2 className="mb-1 px-1 text-sm font-medium text-stone-400">Recently bought</h2>
          <ul className="space-y-1 px-1 text-sm text-stone-400">{done.map((s) => <li key={s.id}><span className="line-through">{s.name}</span> · {memberName(s.purchased_by)}{s.store && ` · ${s.store}`}</li>)}</ul>
        </section>
      )}

      <BuySheet key={buying?.id ?? "none"} item={buying} onClose={() => setBuying(null)} onQuick={quickTick} />
    </div>
  );
}

/** Tap the store chip to move an item to the other store (or none). */
function StoreCycle({ item, stores }: { item: ShoppingItem; stores: string[] }) {
  const { upsertLocal } = useHousehold();
  if (!stores.length) return null;
  const order = [...stores, null];
  const next = order[(order.indexOf(item.store) + 1) % order.length];
  return (
    <button title="Change store" onClick={async () => {
      const { data } = await supabaseBrowser().from("shopping_items").update({ store: next }).eq("id", item.id).select().single();
      if (data) upsertLocal("shopping", data);
    }}>{item.store ? <StoreChip store={item.store} stores={stores} /> : <span className="chip bg-white text-stone-400 ring-1 ring-dashed ring-stone-300">＋ store</span>}</button>
  );
}

function NoteButton({ item }: { item: ShoppingItem }) {
  const { upsertLocal } = useHousehold();
  return (
    <button className="text-xs text-stone-400 hover:text-stone-700" onClick={async () => {
      const notes = prompt("Note for this item", item.notes ?? "");
      if (notes === null) return;
      const { data } = await supabaseBrowser().from("shopping_items").update({ notes: notes || null }).eq("id", item.id).select().single();
      if (data) upsertLocal("shopping", data);
    }}>✎</button>
  );
}

/** Ticking an item off offers to put it straight into the inventory. */
function BuySheet({ item, onClose, onQuick }: { item: ShoppingItem | null; onClose: () => void; onQuick: (s: ShoppingItem) => void }) {
  const { rpc, reload, toast, household } = useHousehold();
  const [store, setStore] = useState<string | null>(item?.store ?? null);
  const [loc, setLoc] = useState<Location>(item ? DEFAULT_LOC[item.category] ?? "pantry" : "fridge");
  const [qty, setQty] = useState("");
  const [expiry, setExpiry] = useState("");
  const [type, setType] = useState<"use_by" | "best_before">("best_before");
  if (!item) return null;
  return (
    <Sheet open onClose={onClose} title={`Bought ${item.name}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {LOCATIONS.map((l) => <button key={l.id} onClick={() => setLoc(l.id)} className={`btn ${loc === l.id ? "bg-brand-600 text-white" : "btn-ghost"}`}>{l.icon}</button>)}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input className="input" inputMode="decimal" placeholder={`${item.quantity ?? 1} ${item.unit ?? "pcs"}`} value={qty} onChange={(e) => setQty(e.target.value)} />
          <input className="input" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} aria-label="Expiry" />
          <select className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="best_before">Best-before</option><option value="use_by">Use-by</option></select>
        </div>
        <StorePicker stores={household?.stores ?? []} value={store} onChange={setStore} label="Bought at" />
        <button className="btn-primary w-full py-3" onClick={async () => {
          const r = await rpc("purchase_shopping_item", { p_item: item.id, p_add_to_inventory: true, p_location: loc, p_expiry: expiry || null, p_expiry_type: type, p_quantity: qty ? Number(qty) : null, p_store: store });
          await reload();
          toast(r ? `${item.name} added to ${loc}` : `${item.name} was already ticked off`);
          onClose();
        }}>Add to inventory</button>
        <button className="btn-ghost w-full" onClick={() => { onQuick(item); onClose(); }}>Just tick off</button>
      </div>
    </Sheet>
  );
}
