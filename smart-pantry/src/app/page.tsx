"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useHousehold, today } from "@/lib/store";
import { LOCATIONS } from "@/lib/domain/types";
import { groupByUrgency } from "@/lib/domain/expiry";
import { formatQuantity } from "@/lib/domain/units";
import { lowStockSuggestions } from "@/lib/domain/shopping";
import { latestRatings } from "@/lib/domain/preferences";
import { ExpiryBadge, RecipeImage, timeAgo, Avatar } from "@/components/ui";
import { ItemSheet } from "@/components/ItemSheet";
import type { InventoryItem } from "@/lib/domain/types";

const PROMPTS = ["What can I cook tonight?", "Something quick under 30 min", "Use what's about to expire", "Surprise me", "No shopping needed"];

export default function Dashboard() {
  const { inventory, events, shopping, recipes, cookings, ratings, members, memberName, user } = useHousehold();
  const router = useRouter();
  const [ask, setAsk] = useState("");
  const [open, setOpen] = useState<InventoryItem | null>(null);
  const t = today();
  const active = inventory.filter((i) => i.status === "active");
  const g = useMemo(() => groupByUrgency(active, t), [active, t]);
  const urgent = [...g.expired, ...g.today, ...g.within2, ...g.within5];
  const openShop = shopping.filter((s) => s.status === "open");
  const low = lowStockSuggestions(inventory.filter((i) => i.status === "active"), shopping);
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const suggestions = recipes.filter((r) => r.source === "ai" && r.kind).slice(0, 3);
  const latest = latestRatings(ratings);
  const top = recipes
    .map((r) => {
      const rs = [...latest.values()].map((m) => m.get(r.id)?.rating).filter((x): x is number => x != null);
      return { r, avg: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0 };
    })
    .filter((x) => x.avg >= 4).sort((a, b) => b.avg - a.avg).slice(0, 4);
  const month = new Date(Date.now() - 30 * 86400000).toISOString();
  const wasted = events.filter((e) => (e.reason === "spoiled" || e.reason === "discarded") && e.created_at >= month).length;
  const used = events.filter((e) => (e.reason === "consumed" || e.reason === "cooked") && e.created_at >= month).length;
  const recentActivity = events.filter((e) => ["consumed", "cooked", "purchased", "spoiled"].includes(e.reason)).slice(0, 6);
  const nameOf = (id: string) => inventory.find((i) => i.id === id)?.name ?? "item";
  const me = members.find((m) => m.id === user?.id);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-stone-500">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="h1">Hi {me?.display_name ?? "there"} 👋</h1>
      </header>

      <form className="card bg-gradient-to-br from-brand-600 to-emerald-700 p-4 text-white" onSubmit={(e) => { e.preventDefault(); router.push(`/recipes?q=${encodeURIComponent(ask || PROMPTS[0])}`); }}>
        <div className="mb-2 text-sm font-medium opacity-90">👩‍🍳 Ask your chef</div>
        <div className="flex gap-2">
          <input className="input border-0 text-stone-900" placeholder="What should we cook tonight?" value={ask} onChange={(e) => setAsk(e.target.value)} />
          <button className="btn shrink-0 bg-white text-brand-700">Ask</button>
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto">
          {PROMPTS.slice(1).map((p) => <Link key={p} href={`/recipes?q=${encodeURIComponent(p)}`} className="chip shrink-0 bg-white/15 py-1 text-white hover:bg-white/25">{p}</Link>)}
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {LOCATIONS.slice(0, 3).map((l) => (
          <Link key={l.id} href={`/inventory?loc=${l.id}`} className="card p-4 hover:ring-brand-500">
            <div className="text-2xl">{l.icon}</div>
            <div className="mt-1 text-2xl font-semibold">{active.filter((i) => i.location === l.id).length}</div>
            <div className="text-xs text-stone-500">{l.label}</div>
          </Link>
        ))}
        <div className="card p-4">
          <div className="text-2xl">♻️</div>
          <div className="mt-1 text-2xl font-semibold">{used + wasted ? Math.round((used / (used + wasted)) * 100) : 100}%</div>
          <div className="text-xs text-stone-500">used, not wasted (30d)</div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="h2">⏳ Use soon</h2>
            {urgent.length > 0 && <Link href="/recipes?q=Use%20what%27s%20about%20to%20expire" className="text-sm text-brand-700">Cook with these →</Link>}
          </div>
          {g.expired.some((i) => i.expiry_type === "use_by") && (
            <p className="mb-2 rounded-xl bg-red-50 p-2 text-xs text-red-800">⚠︎ {g.expired.filter((i) => i.expiry_type === "use_by").map((i) => i.name).join(", ")} passed the use-by date – don&apos;t eat; mark as discarded.</p>
          )}
          {urgent.length === 0 ? <p className="text-sm text-stone-500">Nothing urgent. 🎉</p> : (
            <ul className="space-y-1.5">
              {urgent.slice(0, 7).map((i) => (
                <li key={i.id}><button onClick={() => setOpen(i)} className="flex w-full items-center justify-between text-left text-sm">
                  <span className="truncate">{i.name} <span className="text-stone-400">· {formatQuantity(i.quantity, i.unit)}</span></span><ExpiryBadge item={i} />
                </button></li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between"><h2 className="h2">🛒 Shopping list</h2><Link href="/shopping" className="text-sm text-brand-700">Open →</Link></div>
          {openShop.length === 0 ? <p className="text-sm text-stone-500">List is empty.</p> : (
            <ul className="flex flex-wrap gap-1.5">{openShop.slice(0, 12).map((s) => <li key={s.id} className="chip bg-stone-100 py-1 text-stone-700">{s.name}</li>)}</ul>
          )}
          {low.length > 0 && <p className="mt-3 text-xs text-violet-700">Running low: {low.map((i) => i.name).join(", ")}</p>}
        </section>
      </div>

      {suggestions.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between"><h2 className="h2">✨ Latest suggestions</h2><Link href="/recipes" className="text-sm text-brand-700">More →</Link></div>
          <div className="grid gap-3 sm:grid-cols-3">
            {suggestions.map((r) => (
              <Link key={r.id} href={`/recipes/${r.id}`} className="card overflow-hidden hover:ring-brand-500">
                <RecipeImage title={r.title} url={r.image_url} className="h-28" />
                <div className="p-3"><div className="text-xs uppercase tracking-wide text-brand-700">{r.kind}</div><div className="font-medium">{r.title}</div></div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        <section className="card p-4">
          <h2 className="h2 mb-2">🍳 Recently cooked</h2>
          {cookings.length === 0 ? <p className="text-sm text-stone-500">Nothing yet.</p> : (
            <ul className="space-y-1.5 text-sm">{cookings.slice(0, 5).map((c) => <li key={c.id}><Link href={`/recipes/${c.recipe_id}`} className="hover:underline">{recipeById.get(c.recipe_id)?.title}</Link> <span className="text-stone-400">· {memberName(c.cooked_by)} · {timeAgo(c.cooked_at)}</span></li>)}</ul>
          )}
        </section>
        <section className="card p-4">
          <h2 className="h2 mb-2">⭐ Top rated</h2>
          {top.length === 0 ? <p className="text-sm text-stone-500">Rate recipes after cooking to teach your chef.</p> : (
            <ul className="space-y-1.5 text-sm">{top.map(({ r, avg }) => <li key={r.id}><Link href={`/recipes/${r.id}`} className="hover:underline">{r.title}</Link> <span className="text-amber-500">★ {avg.toFixed(1)}</span></li>)}</ul>
          )}
        </section>
        <section className="card p-4">
          <h2 className="h2 mb-2">🔄 Household activity</h2>
          <ul className="space-y-1.5 text-sm">
            {recentActivity.map((e) => {
              const m = members.find((x) => x.id === e.user_id);
              return <li key={e.id} className="flex items-center gap-1.5"><Avatar name={memberName(e.user_id)} color={m?.avatar_color} /><span className="truncate">{e.reason} {nameOf(e.item_id)}{e.delta ? ` (${Number(e.delta) > 0 ? "+" : ""}${Number(e.delta)} ${e.unit})` : ""}</span><span className="ml-auto shrink-0 text-xs text-stone-400">{timeAgo(e.created_at)}</span></li>;
            })}
          </ul>
        </section>
      </div>
      <ItemSheet item={open} onClose={() => setOpen(null)} />
    </div>
  );
}
