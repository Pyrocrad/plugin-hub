"use client";
import { catNL, type InventoryItem } from "@/lib/domain/types";
import { formatQuantity, quickSteps } from "@/lib/domain/units";
import { useHousehold } from "@/lib/store";
import { Avatar, ExpiryBadge, StoreChip } from "./ui";
import { useInventoryActions } from "./ItemSheet";

/** One-tap consumption right on the row – the thing that keeps the inventory honest. */
export function ItemRow({ item, onOpen }: { item: InventoryItem; onOpen: () => void }) {
  const a = useInventoryActions();
  const { members, household } = useHousehold();
  const who = members.find((m) => m.id === item.updated_by);
  const steps = quickSteps(item.quantity, item.unit).slice(0, 2);
  const low = item.low_stock_threshold != null && item.quantity <= item.low_stock_threshold;
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{item.name}</span>
          <ExpiryBadge item={item} />
          {item.opened_at && <span className="chip bg-sky-50 text-sky-700">open</span>}
          {low && <span className="chip bg-violet-50 text-violet-700">bijna op</span>}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500">
          <span className="whitespace-nowrap font-medium text-stone-700">{formatQuantity(item.quantity, item.unit)}</span>
          <span className="whitespace-nowrap">· {catNL(item.category)}</span>
          {item.store && <span className="ml-1"><StoreChip store={item.store} stores={household?.stores ?? []} /></span>}
          {who && <span className="ml-1 inline-flex items-center gap-1"><Avatar name={who.display_name} color={who.avatar_color} /></span>}
        </div>
      </button>
      <div className="flex shrink-0 gap-1">
        {steps.map((s) => (
          <button key={s} className="btn-ghost px-2 py-1.5 text-xs" onClick={() => a.consume(item, s)} aria-label={`Gebruik ${s} ${item.unit}`}>−{formatQuantity(s, item.unit)}</button>
        ))}
        <button className="btn bg-brand-50 px-2 py-1.5 text-xs text-brand-700 hover:bg-brand-100" onClick={() => a.useAll(item)}>Op</button>
      </div>
    </li>
  );
}
