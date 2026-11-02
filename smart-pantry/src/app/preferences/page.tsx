"use client";
import { useMemo, useState } from "react";
import { useHousehold } from "@/lib/store";
import { learnUserTaste, householdAgreement, type LearnedFeature } from "@/lib/domain/preferences";
import type { Stance } from "@/lib/domain/types";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Empty } from "@/components/ui";

const STANCES: { id: Stance; label: string; cls: string }[] = [
  { id: "love", label: "😍 Love", cls: "bg-rose-100 text-rose-800" },
  { id: "like", label: "🙂 Like", cls: "bg-emerald-100 text-emerald-800" },
  { id: "neutral", label: "😐 Neutral", cls: "bg-stone-100 text-stone-700" },
  { id: "dislike", label: "🙁 Dislike", cls: "bg-amber-100 text-amber-800" },
  { id: "never", label: "🚫 Never", cls: "bg-red-100 text-red-800" },
];

export default function PreferencesPage() {
  const { user, members, recipes, ratings, overrides, household, upsertLocal, reload, toast } = useHousehold();
  const [who, setWho] = useState(user!.id);
  const taste = useMemo(() => learnUserTaste(who, recipes, ratings, overrides), [who, recipes, ratings, overrides]);
  const isMe = who === user?.id;
  const [kind, setKind] = useState<"ingredient" | "cuisine" | "method">("ingredient");
  const [value, setValue] = useState("");
  const ids = members.map((m) => m.id);

  const shared = useMemo(() => {
    const out = { all_love: [] as string[], split: [] as string[], all_dislike: [] as string[] };
    for (const r of recipes) {
      const a = householdAgreement(r.id, ratings, ids).agreement;
      if (a in out) out[a as keyof typeof out].push(r.title);
    }
    return out;
  }, [recipes, ratings, ids]);

  async function setStance(f: Pick<LearnedFeature, "kind" | "value">, stance: Stance | null) {
    const sb = supabaseBrowser();
    if (stance === null) {
      await sb.from("preference_overrides").delete().eq("user_id", user!.id).eq("kind", f.kind).eq("value", f.value);
      return reload();
    }
    const { data, error } = await sb.from("preference_overrides").upsert({ household_id: household!.id, user_id: user!.id, kind: f.kind, value: f.value, stance }, { onConflict: "user_id,kind,value" }).select().single();
    if (error) return toast(error.message, "error");
    upsertLocal("overrides", data);
  }

  const groups: [string, LearnedFeature[]][] = [
    ["Ingredients", taste.features.filter((f) => f.kind === "ingredient")],
    ["Cuisines", taste.features.filter((f) => f.kind === "cuisine")],
    ["Cooking methods", taste.features.filter((f) => f.kind === "method")],
  ];

  return (
    <div className="space-y-5">
      <h1 className="h1">Preferences</h1>
      {members.length > 1 && (
        <div className="flex gap-1.5">{members.map((m) => <button key={m.id} onClick={() => setWho(m.id)} className={`btn ${who === m.id ? "bg-stone-900 text-white" : "btn-ghost"}`}>{m.id === user?.id ? "Me" : m.display_name}</button>)}</div>
      )}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4"><div className="text-2xl font-semibold">{taste.ratedCount}</div><div className="text-xs text-stone-500">recipes rated</div></div>
        <div className="card p-4"><div className="text-2xl font-semibold">{taste.avgRating ?? "–"}</div><div className="text-xs text-stone-500">average rating</div></div>
        <div className="card p-4"><div className="text-2xl font-semibold">{taste.typicalMinutes ?? "–"}</div><div className="text-xs text-stone-500">typical minutes (liked)</div></div>
      </div>

      <p className="text-sm text-stone-500">
        Learned from ratings. One bad dinner never makes something a “dislike” – that takes evidence from at least two recipes. {isMe ? "Tap a stance to correct it; your choice always wins." : ""}
      </p>

      {isMe && (
        <form className="card flex flex-wrap gap-2 p-3" onSubmit={(e) => { e.preventDefault(); if (value.trim()) setStance({ kind, value: value.trim().toLowerCase() }, "love").then(() => setValue("")); }}>
          <select className="input w-36" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="ingredient">Ingredient</option><option value="cuisine">Cuisine</option><option value="method">Method</option></select>
          <input className="input flex-1" placeholder="e.g. coriander, Thai, grilling" value={value} onChange={(e) => setValue(e.target.value)} />
          <button className="btn-primary">Add preference</button>
        </form>
      )}

      {taste.features.length === 0 ? <Empty icon="🧠" title="Nothing learned yet">Cook and rate a few recipes, or add preferences above.</Empty> : groups.map(([title, fs]) => fs.length > 0 && (
        <section key={title} className="card p-4">
          <h2 className="h2 mb-2">{title}</h2>
          <ul className="divide-y divide-stone-100">
            {fs.map((f) => (
              <li key={f.kind + f.value} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-28 flex-1 font-medium capitalize">{f.value}</span>
                <span className="text-xs text-stone-400">{f.source === "override" ? "set by you" : `${f.evidence} recipe${f.evidence === 1 ? "" : "s"} · score ${f.score}`}</span>
                <div className="flex gap-1">
                  {STANCES.map((s) => (
                    <button key={s.id} disabled={!isMe} onClick={() => setStance(f, s.id)} className={`chip py-1 ${f.stance === s.id ? s.cls + " ring-1 ring-current" : "bg-white text-stone-400 ring-1 ring-stone-200"}`} title={s.label}>{s.label.split(" ")[0]}</button>
                  ))}
                  {isMe && f.source === "override" && <button className="chip py-1 text-stone-400" onClick={() => setStance(f, null)} title="Back to learned">↺</button>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {members.length > 1 && (
        <section className="card grid gap-4 p-4 md:grid-cols-3">
          <div><h3 className="mb-1 text-sm font-semibold">💚 You both love</h3><ul className="text-sm text-stone-600">{shared.all_love.map((t) => <li key={t}>{t}</li>)}</ul></div>
          <div><h3 className="mb-1 text-sm font-semibold">⚖️ Opinions differ</h3><ul className="text-sm text-stone-600">{shared.split.map((t) => <li key={t}>{t}</li>)}</ul></div>
          <div><h3 className="mb-1 text-sm font-semibold">👎 Neither liked</h3><ul className="text-sm text-stone-600">{shared.all_dislike.map((t) => <li key={t}>{t}</li>)}</ul></div>
        </section>
      )}
    </div>
  );
}
