"use client";
import { useState } from "react";
import { useHousehold, today } from "@/lib/store";
import { buildAiContext } from "@/lib/domain/context";
import { aiRecipeToRow, buildBridgePrompt, parseBridgeReply } from "@/lib/ai/prompt";
import { supabaseBrowser } from "@/lib/supabase/client";
import { RecipeCard } from "./RecipeCard";
import type { Recipe } from "@/lib/domain/types";

/**
 * Use your existing Claude Pro subscription at no extra cost: the app prepares the full
 * question (stock, expiry, tastes), you paste it in the Claude app and paste the answer back.
 */
export function ClaudeAppBridge({ maxMinutes, noShopping }: { maxMinutes?: number; noShopping?: boolean }) {
  const { inventory, recipes, cookings, ratings, overrides, members, household, user, upsertLocal, toast } = useHousehold();
  const [question, setQuestion] = useState("Wat koken we vanavond?");
  const [answer, setAnswer] = useState("");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ message: string; recipes: Recipe[] } | null>(null);
  const [busy, setBusy] = useState(false);

  async function copy() {
    const context = buildAiContext({ today: today(), inventory, recipes: recipes.filter((r) => r.saved), cookings, ratings, overrides, members });
    const text = buildBridgePrompt(context, question, { maxMinutes, noShopping });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast("Vraag gekopieerd – plak ze in de Claude-app");
    } catch {
      toast("Kopiëren lukte niet – probeer opnieuw", "error");
    }
  }

  async function importAnswer() {
    setBusy(true);
    try {
      const parsed = parseBridgeReply(answer);
      const rows = parsed.recipes.map((r) => aiRecipeToRow(r, household!.id, user!.id));
      const { data, error } = process.env.NEXT_PUBLIC_DEMO === "1"
        ? { data: rows.map((r, i) => ({ ...r, id: `demo-${Date.now()}-${i}`, saved: false, tags: r.tags, created_at: new Date().toISOString() })), error: null }
        : await supabaseBrowser().from("recipes").insert(rows).select();
      if (error) throw new Error(error.message);
      (data as Recipe[]).forEach((r) => upsertLocal("recipes", r));
      setResult({ message: parsed.message, recipes: data as Recipe[] });
      setAnswer("");
      setCopied(false);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <span className="chip bg-orange-100 text-orange-800">Claude Pro</span>
        <span className="text-sm font-medium">Vraag het via je eigen Claude-app</span>
      </div>
      <p className="text-sm text-stone-600">Zonder extra kosten: de app zet jullie voorraad, vervaldata en smaak klaar in één vraag. Jij plakt ze in Claude en plakt het antwoord hier terug.</p>
      <ol className="space-y-3 text-sm">
        <li className="space-y-2">
          <div className="font-medium">1. Wat wil je vragen?</div>
          <input className="input" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={copy}>{copied ? "✓ Gekopieerd" : "📋 Kopieer vraag"}</button>
            <a className="btn-ghost" href="https://claude.ai/new" target="_blank" rel="noreferrer">Open Claude ↗</a>
          </div>
        </li>
        <li className="space-y-2">
          <div className="font-medium">2. Plak de vraag in Claude, wacht op het antwoord en kopieer het volledige antwoord</div>
        </li>
        <li className="space-y-2">
          <div className="font-medium">3. Plak het antwoord hier</div>
          <textarea className="input min-h-24 font-mono text-xs" placeholder="Plak hier het antwoord van Claude…" value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <button className="btn-primary w-full" disabled={!answer.trim() || busy} onClick={importAnswer}>{busy ? "Inlezen…" : "Recepten inlezen"}</button>
        </li>
      </ol>
      {result && (
        <div className="space-y-3 pt-2">
          {result.message && <p className="rounded-2xl bg-brand-50 p-3 text-sm text-brand-900">👩‍🍳 {result.message}</p>}
          <div className="grid gap-4 sm:grid-cols-3">{result.recipes.map((r) => <RecipeCard key={r.id} recipe={r} />)}</div>
        </div>
      )}
    </section>
  );
}

/** Instruction to paste with a photo in the Claude app; the reply goes into "Typ / spreek". */
export const LIST_PHOTO_INSTRUCTION =
  "Lees de foto (boodschappenlijstje of kasticket). Geef ALLEEN de voedingsproducten, elk op een eigen regel, " +
  "in het formaat 'hoeveelheid eenheid product' in het Nederlands, bv. '2 l halfvolle melk' of '6 eieren'. " +
  "Geen andere tekst, geen opsommingstekens.";
