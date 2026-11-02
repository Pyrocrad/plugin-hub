"use client";
import { useState } from "react";
import { useHousehold, today } from "@/lib/store";
import type { InventoryItem, Location } from "@/lib/domain/types";
import { LOCATIONS, catNL } from "@/lib/domain/types";
import { addDays, daysLeft, effectiveExpiry, expiryAdvice, FREEZER_DAYS } from "@/lib/domain/expiry";
import { formatQuantity, quickSteps } from "@/lib/domain/units";
import { ExpiryBadge, Sheet, StorePicker, timeAgo } from "./ui";

export const REASON_NL: Record<string, string> = {
  purchased: "gekocht", consumed: "gebruikt", cooked: "gekookt", spoiled: "bedorven", discarded: "weggegooid",
  corrected: "gecorrigeerd", moved: "verplaatst", opened: "geopend", restocked: "aangevuld",
};

export function useInventoryActions() {
  const { rpc, upsertLocal, toast } = useHousehold();
  return {
    consume: async (it: InventoryItem, amount: number) => {
      const r = await rpc<InventoryItem>("adjust_inventory", { p_item: it.id, p_delta: -amount, p_reason: "consumed", p_expected_version: it.version });
      if (r) {
        upsertLocal("inventory", r);
        toast(r.quantity === 0 ? `${it.name} is op` : `−${formatQuantity(amount, it.unit)} ${it.name}`);
      }
      return r;
    },
    useAll: async (it: InventoryItem) => {
      const r = await rpc<InventoryItem>("adjust_inventory", { p_item: it.id, p_delta: -it.quantity, p_reason: "consumed", p_expected_version: it.version });
      if (r) { upsertLocal("inventory", r); toast(`${it.name} is op`); }
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
      if (r) { upsertLocal("inventory", r); toast(`${it.name} ${reason === "spoiled" ? "als bedorven gemarkeerd" : "weggegooid"}`); }
      return r;
    },
    move: async (it: InventoryItem, loc: Location, newExpiry: string | null, keep: boolean) => {
      const r = await rpc<InventoryItem>("move_inventory", { p_item: it.id, p_location: loc, p_new_expiry: newExpiry, p_keep_expiry: keep });
      if (r) { upsertLocal("inventory", r); toast(`Verplaatst naar ${LOCATIONS.find((l) => l.id === loc)?.label.toLowerCase()}`); }
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
          <div className="text-xs text-stone-500">{catNL(item.category)} · {LOCATIONS.find((l) => l.id === item.location)?.label} · aangepast door {memberName(item.updated_by)} {timeAgo(item.updated_at)}</div>
        </div>
        <ExpiryBadge item={item} />
      </div>
      <p className={`rounded-xl p-2.5 text-xs ${item.expiry_type === "use_by" && d != null && d <= 0 ? "bg-red-50 text-red-800" : "bg-stone-50 text-stone-600"}`}>
        {expiryAdvice(item.expiry_type, d)}
      </p>

      {item.status === "active" && (
        <section className="space-y-2">
          <div className="label">Iets gebruiken</div>
          <div className="flex flex-wrap gap-2">
            {quickSteps(item.quantity, item.unit).map((s) => (
              <button key={s} className="btn-ghost" onClick={() => a.consume(item, s)}>−{formatQuantity(s, item.unit)}</button>
            ))}
            <button className="btn-primary" onClick={() => a.useAll(item).then((r) => r && onClose())}>Alles op</button>
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(amount); if (n > 0) a.consume(item, n).then(() => setAmount("")); }}>
            <input className="input" inputMode="decimal" placeholder={`Hoeveelheid in ${item.unit}`} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button className="btn-ghost shrink-0">Gebruik</button>
          </form>
        </section>
      )}

      <section className="space-y-2">
        <div className="label">Resterende hoeveelheid corrigeren</div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(qty); if (n >= 0) a.setQty(item, n); }}>
          <input className="input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          <span className="self-center text-sm text-stone-500">{item.unit}</span>
          <button className="btn-ghost shrink-0">Bewaar</button>
        </form>
      </section>

      <section className="space-y-2">
        <div className="label">Verplaatsen naar</div>
        <div className="grid grid-cols-4 gap-2">
          {LOCATIONS.map((l) => (
            <button key={l.id} disabled={l.id === item.location} className={`btn ${l.id === item.location ? "bg-brand-50 text-brand-700" : "btn-ghost"}`}
              onClick={() => {
                if (l.id === "freezer" && item.location !== "freezer") {
                  const days = FREEZER_DAYS[item.category] ?? FREEZER_DAYS.other;
                  if (confirm(`Ingevroren blijft ${catNL(item.category)} meestal ~${days} dagen goed. Nieuwe diepvriesdatum instellen?`)) return a.move(item, l.id, addDays(today(), days), false);
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
          <label className="label">Datum ({item.expiry_type === "use_by" ? "te gebruiken tot" : "ten minste houdbaar tot"})</label>
          <input className="input" type="date" defaultValue={item.expiry_date ?? ""} onBlur={(e) => e.target.value !== (item.expiry_date ?? "") && sbUpdate(item, { expiry_date: e.target.value || null })} />
        </div>
        <div>
          <label className="label">Soort datum</label>
          <select className="input" value={item.expiry_type} onChange={(e) => sbUpdate(item, { expiry_type: e.target.value })}>
            <option value="use_by">Te gebruiken tot (veiligheid)</option>
            <option value="best_before">Ten minste houdbaar tot (kwaliteit)</option>
            <option value="none">Geen datum</option>
          </select>
        </div>
        <div>
          <label className="label">Geopend op</label>
          <input className="input" type="date" defaultValue={item.opened_at ?? ""} onBlur={(e) => e.target.value !== (item.opened_at ?? "") && sbUpdate(item, { opened_at: e.target.value || null })} />
        </div>
        <div>
          <label className="label">Houdbaar na openen (dagen)</label>
          <input className="input" inputMode="numeric" defaultValue={item.days_after_opening ?? ""} onBlur={(e) => sbUpdate(item, { days_after_opening: e.target.value ? Number(e.target.value) : null })} />
        </div>
        {!item.opened_at && <button className="btn-ghost col-span-2" onClick={() => sbUpdate(item, { opened_at: today() })}>Vandaag geopend</button>}
        {effectiveExpiry(item) !== item.expiry_date && effectiveExpiry(item) && <p className="col-span-2 text-xs text-stone-500">Werkelijke datum na openen: {effectiveExpiry(item)}</p>}
        <div className="col-span-2">
          <label className="label">Waarschuwen bij weinig voorraad vanaf</label>
          <input className="input" inputMode="decimal" placeholder={`bv. 1 ${item.unit}`} defaultValue={item.low_stock_threshold ?? ""} onBlur={(e) => sbUpdate(item, { low_stock_threshold: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div className="col-span-2">
          <StorePicker stores={household?.stores ?? []} value={item.store} onChange={(st) => sbUpdate(item, { store: st })} label="Gekocht bij" />
        </div>
        <div className="col-span-2">
          <label className="label">Notities</label>
          <input className="input" defaultValue={item.notes ?? ""} onBlur={(e) => e.target.value !== (item.notes ?? "") && sbUpdate(item, { notes: e.target.value || null })} />
        </div>
      </section>

      {item.status === "active" && (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-danger" onClick={() => a.discard(item, "spoiled").then((r) => r && onClose())}>🤢 Bedorven</button>
          <button className="btn-danger" onClick={() => a.discard(item, "discarded").then((r) => r && onClose())}>🗑️ Weggooien</button>
        </div>
      )}

      {history.length > 0 && (
        <section>
          <div className="label">Geschiedenis</div>
          <ul className="divide-y divide-stone-100 text-sm">
            {history.map((e) => (
              <li key={e.id} className="flex justify-between py-1.5">
                <span>{REASON_NL[e.reason] ?? e.reason}{e.delta ? ` ${Number(e.delta) > 0 ? "+" : ""}${Number(e.delta)} ${e.unit}` : e.location_to ? ` → ${e.location_to}` : ""}</span>
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
      if (!data) { toast("Iemand anders heeft dit product net aangepast – vernieuwd.", "error"); return reload(); }
      upsertLocal("inventory", data);
    },
  };
}
