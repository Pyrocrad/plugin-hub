"use client";
import { useState } from "react";
import { useHousehold } from "@/lib/store";
import { groupByCategory, guessCategory, lowStockSuggestions } from "@/lib/domain/shopping";
import { normalizeName } from "@/lib/domain/names";
import { normalizeUnit, formatQuantity } from "@/lib/domain/units";
import { parseQuickAdd } from "@/lib/domain/parse";
import { LOCATIONS, type Location, type ShoppingItem } from "@/lib/domain/types";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Empty, Sheet } from "@/components/ui";

const DEFAULT_LOC: Record<string, Location> = { meat: "fridge", fish: "fridge", dairy: "fridge", eggs: "fridge", vegetables: "fridge", frozen: "freezer" };

export default function ShoppingPage() {
  const { shopping, inventory, household, rpc, reload, upsertLocal, memberName, recipes } = useHousehold();
  const [text, setText] = useState("");
  const [buying, setBuying] = useState<ShoppingItem | null>(null);
  const open = shopping.filter((s) => s.status === "open");
  const done = shopping.filter((s) => s.status === "purchased").slice(0, 15);
  const low = lowStockSuggestions(inventory.filter((i) => i.status !== "spoiled" && i.status !== "discarded"), shopping);

  async function add(name: string, quantity: number | null, unit: string | null) {
    const r = await rpc<ShoppingItem>("add_shopping_item", { p_household: household!.id, p_name: name, p_normalized: normalizeName(name), p_quantity: quantity, p_unit: unit ? normalizeUnit(unit) : null, p_category: guessCategory(name) });
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
    await rpc("purchase_shopping_item", { p_item: s.id, p_add_to_inventory: false });
    reload();
  }

  return (
    <div className="space-y-4">
      <h1 className="h1">Shopping list</h1>
      <form onSubmit={submit} className="flex gap-2">
        <input className="input" placeholder="Add items: 2 l milk, bread, 6 eggs" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={!text.trim()}>Add</button>
      </form>

      {low.length > 0 && (
        <div className="card p-3 text-sm">
          <div className="mb-2 text-xs font-medium text-violet-700">Running low</div>
          <div className="flex flex-wrap gap-1.5">{low.map((i) => <button key={i.id} className="chip bg-violet-50 py-1 text-violet-700" onClick={() => add(i.name, null, null)}>＋ {i.name}</button>)}</div>
        </div>
      )}

      {open.length === 0 ? <Empty icon="🛒" title="All done!">Missing recipe ingredients can be added from any recipe.</Empty> : (
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
          <ul className="space-y-1 px-1 text-sm text-stone-400">{done.map((s) => <li key={s.id} className="line-through">{s.name} <span className="no-underline">· {memberName(s.purchased_by)}</span></li>)}</ul>
        </section>
      )}

      <BuySheet key={buying?.id ?? "none"} item={buying} onClose={() => setBuying(null)} onQuick={quickTick} />
    </div>
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
  const { rpc, reload, toast } = useHousehold();
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
        <button className="btn-primary w-full py-3" onClick={async () => {
          const r = await rpc("purchase_shopping_item", { p_item: item.id, p_add_to_inventory: true, p_location: loc, p_expiry: expiry || null, p_expiry_type: type, p_quantity: qty ? Number(qty) : null });
          await reload();
          toast(r ? `${item.name} added to ${loc}` : `${item.name} was already ticked off`);
          onClose();
        }}>Add to inventory</button>
        <button className="btn-ghost w-full" onClick={() => { onQuick(item); onClose(); }}>Just tick off</button>
      </div>
    </Sheet>
  );
}
