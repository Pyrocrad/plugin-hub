"use client";
import { useState } from "react";
import { useHousehold, today } from "@/lib/store";
import type { InventoryItem, Location } from "@/lib/domain/types";
import { LOCATIONS } from "@/lib/domain/types";
import { addDays, daysLeft, effectiveExpiry, expiryAdvice, FREEZER_DAYS } from "@/lib/domain/expiry";
import { formatQuantity, quickSteps } from "@/lib/domain/units";
import { ExpiryBadge, Sheet, StorePicker, timeAgo } from "./ui";

export function useInventoryActions() {
  const { rpc, upsertLocal, toast } = useHousehold();
  return {
    consume: async (it: InventoryItem, amount: number) => {
      const r = await rpc<InventoryItem>("adjust_inventory", { p_item: it.id, p_delta: -amount, p_reason: "consumed", p_expected_version: it.version });
      if (r) {
        upsertLocal("inventory", r);
        toast(r.quantity === 0 ? `${it.name} finished` : `−${formatQuantity(amount, it.unit)} ${it.name}`);
      }
      return r;
    },
    useAll: async (it: InventoryItem) => {
      const r = await rpc<InventoryItem>("adjust_inventory", { p_item: it.id, p_delta: -it.quantity, p_reason: "consumed", p_expected_version: it.version });
      if (r) { upsertLocal("inventory", r); toast(`${it.name} finished`); }
      return r;
    },
    setQty: async (it: InventoryItem, q: number) => {
      const r = await rpc<InventoryItem>("set_inventory_quantity", { p_item: it.id, p_quantity: q, p_expected_version: it.version });
      if (r) upsertLocal("inventory", r);
      return r;
    },
    restock: async (it: InventoryItem, amount: number) => {
      const r = await rpc<InventoryItem>("adjust_inventory", { p_item: it.id, p_delta: amount, p_reason: "restocked", p_expected_version: it.version });
      if (r) upsertLocal("inventory", r);
      return r;
    },
    discard: async (it: InventoryItem, reason: "spoiled" | "discarded") => {
      const r = await rpc<InventoryItem>("discard_inventory", { p_item: it.id, p_reason: reason });
      if (r) { upsertLocal("inventory", r); toast(`${it.name} marked ${reason}`); }
      return r;
    },
    move: async (it: InventoryItem, loc: Location, newExpiry: string | null, keep: boolean) => {
      const r = await rpc<InventoryItem>("move_inventory", { p_item: it.id, p_location: loc, p_new_expiry: newExpiry, p_keep_expiry: keep });
      if (r) { upsertLocal("inventory", r); toast(`Moved to ${loc}`); }
      return r;
    },
  };
}

export function ItemSheet({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  const { inventory, events, memberName } = useHousehold();
  const live = item ? inventory.find((i) => i.id === item.id) ?? item : null; // stays in sync with partner edits
  return (
    <Sheet open={!!live} onClose={onClose} title={live?.name ?? ""}>
      {live && <ItemSheetBody item={live} onClose={onClose} history={events.filter((e) => e.item_id === live.id).slice(0, 8)} memberName={memberName} />}
    </Sheet>
  );
}

function ItemSheetBody({ item, onClose, history, memberName }: { item: InventoryItem; onClose: () => void; history: ReturnType<typeof useHousehold>["events"]; memberName: (id: string | null) => string }) {
  const a = useInventoryActions();
  const { sbUpdate } = useUpdate();
  const { household } = useHousehold();
  const [amount, setAmount] = useState("");
  const [qty, setQty] = useState(String(item.quantity));
  const d = daysLeft(item, today());

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-2xl bg-stone-50 p-4">
        <div>
          <div className="text-3xl font-semibold">{formatQuantity(item.quantity, item.unit)}</div>
          <div className="text-xs text-stone-500">{item.category} · {LOCATIONS.find((l) => l.id === item.location)?.label} · updated by {memberName(item.updated_by)} {timeAgo(item.updated_at)}</div>
        </div>
        <ExpiryBadge item={item} />
      </div>
      <p className={`rounded-xl p-2.5 text-xs ${item.expiry_type === "use_by" && d != null && d <= 0 ? "bg-red-50 text-red-800" : "bg-stone-50 text-stone-600"}`}>
        {expiryAdvice(item.expiry_type, d)}
      </p>

      {item.status === "active" && (
        <section className="space-y-2">
          <div className="label">Use some</div>
          <div className="flex flex-wrap gap-2">
            {quickSteps(item.quantity, item.unit).map((s) => (
              <button key={s} className="btn-ghost" onClick={() => a.consume(item, s)}>−{formatQuantity(s, item.unit)}</button>
            ))}
            <button className="btn-primary" onClick={() => a.useAll(item).then((r) => r && onClose())}>Use all</button>
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(amount); if (n > 0) a.consume(item, n).then(() => setAmount("")); }}>
            <input className="input" inputMode="decimal" placeholder={`Amount in ${item.unit}`} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button className="btn-ghost shrink-0">Use</button>
          </form>
        </section>
      )}

      <section className="space-y-2">
        <div className="label">Correct remaining quantity</div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(qty); if (n >= 0) a.setQty(item, n); }}>
          <input className="input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          <span className="self-center text-sm text-stone-500">{item.unit}</span>
          <button className="btn-ghost shrink-0">Save</button>
        </form>
      </section>

      <section className="space-y-2">
        <div className="label">Move to</div>
        <div className="grid grid-cols-4 gap-2">
          {LOCATIONS.map((l) => (
            <button key={l.id} disabled={l.id === item.location} className={`btn ${l.id === item.location ? "bg-brand-50 text-brand-700" : "btn-ghost"}`}
              onClick={() => {
                if (l.id === "freezer" && item.location !== "freezer") {
                  const days = FREEZER_DAYS[item.category] ?? FREEZER_DAYS.other;
                  if (confirm(`Freezing usually keeps ${item.category} ~${days} days. Set a new freezer date?`)) return a.move(item, l.id, addDays(today(), days), false);
                }
                a.move(item, l.id, null, true);
              }}>
              {l.icon}<span className="hidden sm:inline">{l.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Date ({item.expiry_type === "use_by" ? "use-by" : "best-before"})</label>
          <input className="input" type="date" defaultValue={item.expiry_date ?? ""} onBlur={(e) => e.target.value !== (item.expiry_date ?? "") && sbUpdate(item, { expiry_date: e.target.value || null })} />
        </div>
        <div>
          <label className="label">Date type</label>
          <select className="input" value={item.expiry_type} onChange={(e) => sbUpdate(item, { expiry_type: e.target.value })}>
            <option value="use_by">Use-by (safety)</option>
            <option value="best_before">Best-before (quality)</option>
            <option value="none">No date</option>
          </select>
        </div>
        <div>
          <label className="label">Opened on</label>
          <input className="input" type="date" defaultValue={item.opened_at ?? ""} onBlur={(e) => e.target.value !== (item.opened_at ?? "") && sbUpdate(item, { opened_at: e.target.value || null })} />
        </div>
        <div>
          <label className="label">Keeps after opening (days)</label>
          <input className="input" inputMode="numeric" defaultValue={item.days_after_opening ?? ""} onBlur={(e) => sbUpdate(item, { days_after_opening: e.target.value ? Number(e.target.value) : null })} />
        </div>
        {!item.opened_at && <button className="btn-ghost col-span-2" onClick={() => sbUpdate(item, { opened_at: today() })}>Mark opened today</button>}
        {effectiveExpiry(item) !== item.expiry_date && effectiveExpiry(item) && <p className="col-span-2 text-xs text-stone-500">Effective date after opening: {effectiveExpiry(item)}</p>}
        <div className="col-span-2">
          <label className="label">Low-stock alert at</label>
          <input className="input" inputMode="decimal" placeholder={`e.g. 1 ${item.unit}`} defaultValue={item.low_stock_threshold ?? ""} onBlur={(e) => sbUpdate(item, { low_stock_threshold: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div className="col-span-2">
          <StorePicker stores={household?.stores ?? []} value={item.store} onChange={(st) => sbUpdate(item, { store: st })} label="Bought at" />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <input className="input" defaultValue={item.notes ?? ""} onBlur={(e) => e.target.value !== (item.notes ?? "") && sbUpdate(item, { notes: e.target.value || null })} />
        </div>
      </section>

      {item.status === "active" && (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-danger" onClick={() => a.discard(item, "spoiled").then((r) => r && onClose())}>🤢 Spoiled</button>
          <button className="btn-danger" onClick={() => a.discard(item, "discarded").then((r) => r && onClose())}>🗑️ Discard</button>
        </div>
      )}

      {history.length > 0 && (
        <section>
          <div className="label">History</div>
          <ul className="divide-y divide-stone-100 text-sm">
            {history.map((e) => (
              <li key={e.id} className="flex justify-between py-1.5">
                <span>{e.reason}{e.delta ? ` ${Number(e.delta) > 0 ? "+" : ""}${Number(e.delta)} ${e.unit}` : e.location_to ? ` → ${e.location_to}` : ""}</span>
                <span className="text-stone-400">{memberName(e.user_id)} · {timeAgo(e.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Metadata edits (dates, notes) – a plain update guarded by the row version. */
function useUpdate() {
  const { upsertLocal, toast, reload } = useHousehold();
  return {
    sbUpdate: async (item: InventoryItem, patch: Record<string, unknown>) => {
      const { supabaseBrowser } = await import("@/lib/supabase/client");
      const { data, error } = await supabaseBrowser().from("inventory_items").update(patch).eq("id", item.id).eq("version", item.version).select().maybeSingle();
      if (error) return toast(error.message, "error");
      if (!data) { toast("Someone else just changed this item – refreshed.", "error"); return reload(); }
      upsertLocal("inventory", data);
    },
  };
}
