"use client";
import Link from "next/link";
import { useState } from "react";
import { useHousehold } from "@/lib/store";
import { householdAgreement } from "@/lib/domain/preferences";
import { Empty, Stars, RecipeImage } from "@/components/ui";
import { REASON_NL } from "@/components/ItemSheet";

export default function HistoryPage() {
  const { cookings, recipes, ratings, members, memberName, events, inventory } = useHousehold();
  const [tab, setTab] = useState<"meals" | "inventory">("meals");
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const ids = members.map((m) => m.id);
  const nameOf = (id: string) => inventory.find((i) => i.id === id)?.name ?? "product";

  return (
    <div className="space-y-4">
      <h1 className="h1">Geschiedenis</h1>
      <div className="grid w-72 grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 text-sm">
        {(["meals", "inventory"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-lg py-1.5 ${tab === t ? "bg-white font-medium shadow-sm" : "text-stone-500"}`}>{t === "meals" ? "Maaltijden" : "Voorraad"}</button>)}
      </div>
      {tab === "meals" ? (
        cookings.length === 0 ? <Empty icon="📖" title="Nog geen maaltijden">Tik op “Ik heb dit gekookt” bij een recept om je kookdagboek te starten.</Empty> : (
          <ul className="space-y-3">
            {cookings.map((c) => {
              const r = recipeById.get(c.recipe_id);
              if (!r) return null;
              const ag = householdAgreement(r.id, ratings, ids);
              const rs = ratings.filter((x) => x.cooking_id === c.id);
              return (
                <li key={c.id}>
                  <Link href={`/recipes/${r.id}`} className="card flex gap-3 overflow-hidden hover:ring-brand-500">
                    <div className="w-24 shrink-0"><RecipeImage title={r.title} url={r.image_url} className="h-full min-h-24" /></div>
                    <div className="flex-1 py-3 pr-3">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-stone-500">{new Date(c.cooked_at).toLocaleDateString("nl-BE", { weekday: "short", day: "numeric", month: "short" })} · door {memberName(c.cooked_by)}{!c.followed_exactly && " · aangepast"}</div>
                      <div className="mt-1 space-y-0.5">
                        {rs.length === 0 ? <span className="text-xs text-amber-700">Nog geen score</span> : rs.map((x) => <div key={x.id} className="flex items-center gap-2 text-xs"><span className="w-14 text-stone-500">{memberName(x.user_id)}</span><Stars value={x.rating} size="text-xs" />{x.comment && <span className="truncate text-stone-500">“{x.comment}”</span>}</div>)}
                      </div>
                      {ag.agreement === "split" && <span className="chip mt-1 bg-violet-50 text-violet-700">meningen verschillen</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <ul className="card divide-y divide-stone-100 text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-2 px-3 py-2">
              <span className={`chip ${e.reason === "spoiled" || e.reason === "discarded" ? "bg-red-50 text-red-700" : e.reason === "purchased" || e.reason === "restocked" ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"}`}>{REASON_NL[e.reason] ?? e.reason}</span>
              <span className="flex-1 truncate">{nameOf(e.item_id)} {e.delta ? <span className="text-stone-500">{Number(e.quantity_before)} → {Number(e.quantity_after)} {e.unit}</span> : e.location_to ? <span className="text-stone-500">{e.location_from} → {e.location_to}</span> : null}</span>
              <span className="shrink-0 text-xs text-stone-400">{memberName(e.user_id)} · {new Date(e.created_at).toLocaleString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
