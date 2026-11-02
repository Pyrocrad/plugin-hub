"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useHousehold } from "@/lib/store";
import { groupByCategory, guessCategory, lowStockSuggestions } from "@/lib/domain/shopping";
import { normalizeName } from "@/lib/domain/names";
import { normalizeUnit, formatQuantity } from "@/lib/domain/units";
import { parseQuickAdd } from "@/lib/domain/parse";
import { LOCATIONS, catNL, type Location, type ShoppingItem } from "@/lib/domain/types";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Empty, Sheet, StoreChip, StorePicker } from "@/components/ui";
import { preferredStore, sortForStore } from "@/lib/domain/stores";
import { estimateShelfLife } from "@/lib/domain/shelflife";
import { addDays } from "@/lib/domain/expiry";
import { restockSuggestions } from "@/lib/domain/restock";
import { today } from "@/lib/store";

const DEFAULT_LOC: Record<string, Location> = { meat: "fridge", fish: "fridge", dairy: "fridge", eggs: "fridge", vegetables: "fridge", frozen: "freezer" };

export default function ShoppingPage() {
  return <Suspense><ShoppingInner /></Suspense>;
}

function ShoppingInner() {
  const { shopping, inventory, household, rpc, reload, upsertLocal, memberName, recipes, events, cookings, storeProducts } = useHousehold();
  const params = useSearchParams();
  const [text, setText] = useState("");
  const [buying, setBuying] = useState<ShoppingItem | null>(null);
  const stores = household?.stores ?? [];
  const [tab, setTab] = useState<string>(params.get("store") ?? "all"); // "all" | store name | "none"
  const [addStore, setAddStore] = useState<string | null>(null);
  const allOpen = shopping.filter((s) => s.status === "open");
  const open = allOpen.filter((s) => tab === "all" || (tab === "none" ? !s.store : s.store === tab));
  const done = shopping.filter((s) => s.status === "purchased").slice(0, 15);
  const low = lowStockSuggestions(inventory.filter((i) => i.status !== "spoiled" && i.status !== "discarded"), shopping);
  const smart = restockSuggestions({ inventory, events, cookings, recipes, shopping, today: today() });
  const suggestions = [
    ...smart.map((x) => ({ key: x.normalized_name, name: x.name, quantity: x.quantity as number | null, unit: x.unit as string | null, reason: x.reason })),
    ...low.filter((i) => !smart.some((x) => x.normalized_name === normalizeName(i.name)))
      .map((i) => ({ key: normalizeName(i.name), name: i.name, quantity: null, unit: null, reason: `Onder je waarschuwingsniveau (nog ${formatQuantity(i.quantity, i.unit)})` })),
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

  const row = (s: ShoppingItem, n?: number) => (
<li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                  {n != null && <span className="w-5 text-right text-xs tabular-nums text-stone-400">{n}</span>}
                  <button className="h-6 w-6 shrink-0 rounded-full border-2 border-stone-300 hover:border-brand-500" onClick={() => setBuying(s)} aria-label={`${s.name} gekocht`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{s.name} {s.quantity != null && <span className="font-normal text-stone-500">· {formatQuantity(s.quantity, s.unit ?? "pcs")}</span>}</div>
                    <div className="truncate text-xs text-stone-400">
                      {memberName(s.added_by)}{s.recipe_id && ` · voor ${recipes.find((r) => r.id === s.recipe_id)?.title ?? "een recept"}`}{s.notes && ` · ${s.notes}`}
                    </div>
                  </div>
                  <StoreCycle item={s} stores={stores} />
                  <NoteButton item={s} />
                  <button className="text-stone-300 hover:text-red-500" onClick={() => remove(s)} aria-label="Verwijderen">✕</button>
                </li>
  );
  const inStore = tab !== "all" && tab !== "none";
  const walk = inStore ? sortForStore(open, storeProducts, tab) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Boodschappen</h1>
        {stores.length > 0 && <Link href={`/stores${inStore ? `?s=${encodeURIComponent(tab)}` : ""}`} className="btn-ghost text-xs">🧭 Winkelindeling</Link>}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input className="input" placeholder="Toevoegen: 2 l melk, brood, 6 eieren" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={!text.trim()}>Voeg toe</button>
      </form>
      {text.trim() && <StorePicker stores={stores} value={addStore} onChange={setAddStore} label="Kopen bij" />}

      {stores.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[["all", "Alles"], ...stores.map((x) => [x, `🏪 ${x}`]), ["none", "Geen winkel"]].map(([id, label]) => {
            const n = id === "all" ? allOpen.length : allOpen.filter((s) => (id === "none" ? !s.store : s.store === id)).length;
            return <button key={id} onClick={() => setTab(id)} className={`btn shrink-0 ${tab === id ? "bg-stone-900 text-white" : "btn-ghost"}`}>{label} <span className="opacity-60">{n}</span></button>;
          })}
        </div>
      )}

      {suggestions.length > 0 && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between bg-gradient-to-r from-violet-50 to-brand-50 px-4 py-3">
            <div>
              <h2 className="h2">💡 Voorgesteld</h2>
              <p className="text-xs text-stone-500">Op basis van wat jullie vaak gebruiken en jullie vaste recepten</p>
            </div>
            <button className="btn-ghost text-xs" onClick={async () => { for (const x of suggestions) await add(x.name, x.quantity, x.unit, x.store); }}>Alles toevoegen</button>
          </div>
          <ul className="divide-y divide-stone-100">
            {suggestions.map((x) => (
              <li key={x.key} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="font-medium"><span className="capitalize">{x.name}</span>{x.quantity != null && <span className="font-normal text-stone-500"> · {formatQuantity(x.quantity, x.unit ?? "pcs")}</span>}</div>
                  <div className="flex items-center gap-1.5"><span className="truncate text-xs text-violet-700">{x.reason}</span><StoreChip store={x.store} stores={stores} /></div>
                </div>
                <button className="btn bg-brand-600 px-3 py-1.5 text-xs text-white" onClick={() => add(x.name, x.quantity, x.unit, x.store)}>＋ Voeg toe</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {walk && open.length > 0 ? (
        <>
          {walk.ordered.length > 0 && (
            <section>
              <h2 className="mb-1 px-1 text-sm font-medium text-stone-500">🚶 In wandelvolgorde van {tab}</h2>
              <ul className="card divide-y divide-stone-100">{walk.ordered.map((s, i) => row(s, i + 1))}</ul>
            </section>
          )}
          {walk.unplaced.length > 0 && (
            <section>
              <h2 className="mb-1 px-1 text-sm font-medium text-stone-500">Nog niet in je indeling van {tab} <Link href={`/stores?s=${encodeURIComponent(tab)}`} className="text-brand-700">· plaatsen →</Link></h2>
              <ul className="card divide-y divide-stone-100">{walk.unplaced.map((s) => row(s))}</ul>
            </section>
          )}
        </>
      ) : open.length === 0 ? <Empty icon="🛒" title={tab === "all" ? "Alles gekocht!" : "Niets voor deze winkel"}>Ontbrekende ingrediënten kan je toevoegen vanuit elk recept.</Empty> : (
        groupByCategory(open).map(([cat, items]) => (
          <section key={cat}>
            <h2 className="mb-1 px-1 text-sm font-medium capitalize text-stone-500">{catNL(cat)}</h2>
            <ul className="card divide-y divide-stone-100">
              {items.map((s) => row(s))}
            </ul>
          </section>
        ))
      )}

      {done.length > 0 && (
        <section>
          <h2 className="mb-1 px-1 text-sm font-medium text-stone-400">Recent gekocht</h2>
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
    <button title="Winkel wijzigen" onClick={async () => {
      const { data } = await supabaseBrowser().from("shopping_items").update({ store: next }).eq("id", item.id).select().single();
      if (data) upsertLocal("shopping", data);
    }}>{item.store ? <StoreChip store={item.store} stores={stores} /> : <span className="chip bg-white text-stone-400 ring-1 ring-dashed ring-stone-300">＋ winkel</span>}</button>
  );
}

function NoteButton({ item }: { item: ShoppingItem }) {
  const { upsertLocal } = useHousehold();
  return (
    <button className="text-xs text-stone-400 hover:text-stone-700" onClick={async () => {
      const notes = prompt("Notitie bij dit product", item.notes ?? "");
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
  const [typed, setTyped] = useState<{ expiry: string; type: "use_by" | "best_before" } | null>(null);
  if (!item) return null;
  // Until someone types a date, use the typical shelf life for this product and place.
  const est = estimateShelfLife(item.name, item.category, loc);
  const expiry = typed?.expiry ?? (est ? addDays(today(), est.days) : "");
  const type = typed?.type ?? (est?.type === "use_by" ? "use_by" : "best_before");
  return (
    <Sheet open onClose={onClose} title={`${item.name} gekocht`}>
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {LOCATIONS.map((l) => <button key={l.id} onClick={() => setLoc(l.id)} className={`btn ${loc === l.id ? "bg-brand-600 text-white" : "btn-ghost"}`}>{l.icon}</button>)}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input className="input" inputMode="decimal" placeholder={`${item.quantity ?? 1} ${item.unit ?? "pcs"}`} value={qty} onChange={(e) => setQty(e.target.value)} />
          <input className="input" type="date" value={expiry} onChange={(e) => setTyped({ expiry: e.target.value, type })} aria-label="Vervaldatum" />
          <select className="input" value={type} onChange={(e) => setTyped({ expiry, type: e.target.value as "use_by" | "best_before" })}><option value="best_before">Ten minste houdbaar</option><option value="use_by">Te gebruiken tot</option></select>
        </div>
        {!typed && est && <p className="text-xs text-stone-500">📅 Geschat: {catNL(item.category)} blijft {LOCATIONS.find((l) => l.id === loc)?.label.toLowerCase()} meestal ~{est.days} dagen goed. Staat er een datum op de verpakking? Vul die in.</p>}
        <StorePicker stores={household?.stores ?? []} value={store} onChange={setStore} label="Gekocht bij" />
        <button className="btn-primary w-full py-3" onClick={async () => {
          const r = await rpc("purchase_shopping_item", { p_item: item.id, p_add_to_inventory: true, p_location: loc, p_expiry: expiry || null, p_expiry_type: type, p_quantity: qty ? Number(qty) : null, p_store: store, p_estimated: !typed && Boolean(est), p_days_after_opening: est?.openedDays ?? null });
          await reload();
          toast(r ? `${item.name} in ${LOCATIONS.find((l) => l.id === loc)?.label.toLowerCase()} gezet` : `${item.name} was al afgevinkt`);
          onClose();
        }}>In voorraad zetten</button>
        <button className="btn-ghost w-full" onClick={() => { onQuick(item); onClose(); }}>Enkel afvinken</button>
      </div>
    </Sheet>
  );
}
