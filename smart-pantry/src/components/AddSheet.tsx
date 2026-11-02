"use client";
import { useEffect, useRef, useState } from "react";
import { useHousehold, today } from "@/lib/store";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CATEGORIES, LOCATIONS, catNL, type ExpiryType, type Location } from "@/lib/domain/types";
import { UNIT_OPTIONS, normalizeUnit } from "@/lib/domain/units";
import { parseQuickAdd } from "@/lib/domain/parse";
import { addDays } from "@/lib/domain/expiry";
import { guessCategory } from "@/lib/domain/shopping";
import { Sheet, StorePicker } from "./ui";
import { matchStore, preferredStore } from "@/lib/domain/stores";

export interface Draft {
  key: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: Location;
  expiry_date: string;
  expiry_type: ExpiryType;
  barcode?: string | null;
  confidence?: string;
  store?: string | null;
}

const DEFAULT_LOC: Record<string, Location> = { meat: "fridge", fish: "fridge", dairy: "fridge", eggs: "fridge", vegetables: "fridge", fruit: "pantry", frozen: "freezer" };
const DEFAULT_TYPE: Record<string, ExpiryType> = { meat: "use_by", fish: "use_by", dairy: "use_by" };
let k = 0;
export function draft(p: Partial<Draft> & { name: string }): Draft {
  const category = p.category ?? guessCategory(p.name);
  return {
    key: ++k, quantity: 1, unit: "pcs", expiry_date: "", category,
    location: DEFAULT_LOC[category] ?? "pantry", expiry_type: DEFAULT_TYPE[category] ?? "best_before", ...p,
  };
}

type Mode = "quick" | "scan" | "barcode";
export type ScanMode = "photo" | "receipt" | "list";

export function AddSheet({ open, onClose, initialLocation, sharedFiles }: { open: boolean; onClose: () => void; initialLocation?: Location; sharedFiles?: File[] }) {
  const { household, toast, upsertLocal, inventory } = useHousehold();
  const [mode, setMode] = useState<Mode>(sharedFiles?.length ? "scan" : "quick");
  const [store, setStore] = useState<string | null>(null);
  const stores = household?.stores ?? [];
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!open) { setDrafts([]); setStore(null); } }, [open]);
  const addDrafts = (ds: Draft[]) => setDrafts((p) => [...p, ...ds.map((d) => (initialLocation && !d.confidence ? { ...d, location: initialLocation } : d))]);

  async function saveAll() {
    const valid = drafts.filter((d) => d.name.trim() && d.quantity > 0);
    if (!valid.length) return;
    setSaving(true);
    const rows = valid.map((d) => ({
      household_id: household!.id, name: d.name.trim(), category: d.category, quantity: d.quantity, unit: normalizeUnit(d.unit),
      location: d.location, expiry_date: d.expiry_date || null, expiry_type: d.expiry_type, purchase_date: today(), barcode: d.barcode ?? null,
      store: d.store !== undefined ? d.store : store ?? preferredStore(d.name, inventory),
    }));
    const { data, error } = await supabaseBrowser().from("inventory_items").insert(rows).select();
    setSaving(false);
    if (error) return toast(error.message, "error");
    data!.forEach((r: any) => upsertLocal("inventory", r));
    toast(`${data!.length} product${data!.length > 1 ? "en" : ""} toegevoegd`);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Producten toevoegen">
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 text-sm">
        {([["quick", "✍️ Typ / spreek"], ["scan", "📷 Foto / lijst"], ["barcode", "▦ Barcode"]] as [Mode, string][]).map(([m, l]) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded-lg py-1.5 ${mode === m ? "bg-white font-medium shadow-sm" : "text-stone-500"}`}>{l}</button>
        ))}
      </div>
      {mode === "quick" && <QuickAdd onAdd={addDrafts} />}
      {mode === "scan" && <ScanAdd onAdd={addDrafts} onStore={(raw) => { const m = matchStore(raw, stores); if (m) setStore(m); }} initialFiles={sharedFiles} />}
      {mode === "barcode" && <BarcodeAdd onAdd={addDrafts} />}

      {drafts.length > 0 && (
        <div className="mt-5 space-y-3">
          <div className="label">Nakijken voor bewaren ({drafts.length})</div>
          <StorePicker stores={stores} value={store} onChange={setStore} label="Gekocht bij" />
          {!store && stores.length > 0 && <p className="text-xs text-stone-400">Geen winkel gekozen – elk product krijgt de winkel waar je het laatst kocht.</p>}
          {drafts.map((d) => (
            <DraftRow key={d.key} d={d} onChange={(nd) => setDrafts((p) => p.map((x) => (x.key === d.key ? nd : x)))} onRemove={() => setDrafts((p) => p.filter((x) => x.key !== d.key))} />
          ))}
          <button className="btn-primary w-full py-3" disabled={saving} onClick={saveAll}>{saving ? "Bewaren…" : `${drafts.length} toevoegen aan voorraad`}</button>
        </div>
      )}
    </Sheet>
  );
}

function DraftRow({ d, onChange, onRemove }: { d: Draft; onChange: (d: Draft) => void; onRemove: () => void }) {
  const set = (p: Partial<Draft>) => onChange({ ...d, ...p });
  return (
    <div className={`space-y-2 rounded-2xl border p-3 ${d.confidence === "low" ? "border-amber-300 bg-amber-50/50" : "border-stone-200"}`}>
      <div className="flex gap-2">
        <input className="input font-medium" value={d.name} onChange={(e) => set({ name: e.target.value, category: guessCategory(e.target.value) })} />
        <button className="btn-ghost shrink-0" onClick={onRemove} aria-label="Verwijderen">✕</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input className="input" inputMode="decimal" value={d.quantity} onChange={(e) => set({ quantity: Number(e.target.value) })} />
        <select className="input" value={d.unit} onChange={(e) => set({ unit: e.target.value })}>{[...new Set([d.unit, ...UNIT_OPTIONS])].map((u) => <option key={u} value={u}>{u === "pcs" ? "st." : u}</option>)}</select>
        <select className="input" value={d.location} onChange={(e) => set({ location: e.target.value as Location })}>{LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.icon} {l.label}</option>)}</select>
        <select className="input" value={d.category} onChange={(e) => set({ category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{catNL(c)}</option>)}</select>
        <input className="input" type="date" value={d.expiry_date} onChange={(e) => set({ expiry_date: e.target.value })} aria-label="Vervaldatum" />
        <select className="input" value={d.expiry_type} onChange={(e) => set({ expiry_type: e.target.value as ExpiryType })}>
          <option value="use_by">Te gebruiken tot</option><option value="best_before">Ten minste houdbaar</option><option value="none">Geen datum</option>
        </select>
      </div>
      {d.confidence === "low" && <p className="text-xs text-amber-700">De AI was hier niet zeker van – even nakijken.</p>}
    </div>
  );
}

function QuickAdd({ onAdd }: { onAdd: (d: Draft[]) => void }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const SR = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

  function voice() {
    if (!SR) return;
    if (listening) return recRef.current?.stop();
    const rec = new SR();
    rec.lang = "nl-BE";
    rec.interimResults = false;
    rec.onresult = (e: any) => setText((t) => (t ? t + ", " : "") + e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <div className="space-y-2">
      <textarea className="input min-h-24" placeholder={"2 l melk, 6 eieren, 500 g kipfilet\n1 kg aardappelen"} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex gap-2">
        {SR && <button className={`btn ${listening ? "bg-red-600 text-white" : "btn-ghost"}`} onClick={voice}>{listening ? "■ Stop" : "🎙️ Spreek"}</button>}
        <button className="btn-primary flex-1" disabled={!text.trim()} onClick={() => { onAdd(parseQuickAdd(text).map((p) => draft(p))); setText(""); }}>Toevoegen aan lijst</button>
      </div>
    </div>
  );
}

function ScanAdd({ onAdd, onStore, initialFiles }: { onAdd: (d: Draft[]) => void; onStore: (raw: string | null) => void; initialFiles?: File[] }) {
  const { toast } = useHousehold();
  const [busy, setBusy] = useState<null | ScanMode>(null);
  const [progress, setProgress] = useState("");

  async function handle(files: File[], mode: ScanMode) {
    setBusy(mode);
    try {
      let total = 0;
      for (const [n, file] of files.entries()) {
        if (files.length > 1) setProgress(`${n + 1}/${files.length}`);
        const { base64, mediaType } = await downscale(file);
        const r = await fetch("/api/ai/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: base64, mediaType, mode }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        if (j.store) onStore(j.store);
        total += j.items.length;
        onAdd(j.items.map((it: any) => draft({
          name: it.name, category: it.category, quantity: it.quantity, unit: normalizeUnit(it.unit), location: it.location, expiry_type: it.expiry_type,
          expiry_date: it.suggested_shelf_days != null ? addDays(today(), it.suggested_shelf_days) : "", confidence: it.confidence,
        })));
      }
      if (!total) toast("Niets herkend – probeer een scherpere foto", "error");
    } catch (e: any) {
      toast(e.message || "Scannen mislukt", "error");
    } finally {
      setBusy(null);
      setProgress("");
    }
  }

  // Photos shared into the app from the gallery / WhatsApp: treat as a grocery list by default.
  const sharedDone = useRef(false);
  const [shared, setShared] = useState<File[] | null>(initialFiles?.length ? initialFiles : null);

  const cards: [ScanMode, string, string, string][] = [
    ["list", "📝", "Boodschappenlijst", "Handgeschreven, getypt of screenshot"],
    ["receipt", "🧾", "Kasticket", "Herkent ook de winkel"],
    ["photo", "🛍️", "Boodschappen", "Foto van de producten zelf"],
  ];
  return (
    <div className="space-y-3">
      {shared && !sharedDone.current && (
        <div className="rounded-2xl bg-brand-50 p-3 text-sm">
          <div className="font-medium text-brand-900">{shared.length} gedeelde foto{shared.length > 1 ? "'s" : ""} – wat is het?</div>
          <div className="mt-2 flex gap-2">
            {cards.map(([m, icon, label]) => (
              <button key={m} className="btn-ghost flex-1 bg-white" disabled={!!busy} onClick={() => { sharedDone.current = true; handle(shared, m).then(() => setShared(null)); }}>{icon} {label}</button>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {cards.map(([m, icon, label, hint]) => (
          <label key={m} className={`card flex cursor-pointer flex-col items-center gap-1 p-3 text-center hover:bg-stone-50 ${m === "list" ? "ring-brand-500" : ""}`}>
            <span className="text-3xl">{icon}</span>
            <span className="text-sm font-medium">{busy === m ? `Lezen… ${progress}` : label}</span>
            <span className="text-[11px] leading-tight text-stone-500">{hint}</span>
            <input type="file" accept="image/*" multiple className="hidden" disabled={!!busy} onChange={(e) => e.target.files?.length && handle([...e.target.files], m)} />
          </label>
        ))}
      </div>
      <p className="text-xs text-stone-500">Je kan meerdere foto's tegelijk kiezen. De AI stelt voor, jij bevestigt voor er iets wordt toegevoegd. Vervaldata zijn schattingen – controleer de datum op de verpakking.</p>
    </div>
  );
}

/** Resize photos client-side to keep uploads (and Claude image tokens) small. */
async function downscale(file: File): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1568 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.85);
  return { base64: url.split(",")[1], mediaType: "image/jpeg" };
}

function BarcodeAdd({ onAdd }: { onAdd: (d: Draft[]) => void }) {
  const { toast } = useHousehold();
  const video = useRef<HTMLVideoElement>(null);
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const supported = typeof window !== "undefined" && "BarcodeDetector" in window;

  async function lookup(c: string) {
    const r = await fetch(`/api/barcode/${c}`);
    const j = await r.json();
    if (!r.ok || !j.found) return toast("Product niet gevonden – voeg het manueel toe", "error");
    onAdd([draft({ name: j.name, category: j.category, quantity: j.quantity, unit: normalizeUnit(j.unit), barcode: c })]);
    setCode("");
  }

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const det = new (window as any).BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        while (!stop) {
          const found = await det.detect(video.current).catch(() => []);
          if (found[0]) { setScanning(false); lookup(found[0].rawValue); break; }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        toast("Camera niet beschikbaar", "error");
        setScanning(false);
      }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  return (
    <div className="space-y-3">
      {supported && (scanning
        ? <video ref={video} className="aspect-video w-full rounded-2xl bg-black object-cover" playsInline muted />
        : <button className="btn-primary w-full py-3" onClick={() => setScanning(true)}>📷 Barcode scannen met camera</button>)}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); lookup(code); }}>
        <input className="input" inputMode="numeric" placeholder="of typ het barcodenummer" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        <button className="btn-ghost shrink-0" disabled={code.length < 6}>Zoeken</button>
      </form>
    </div>
  );
}
