"use client";
import { useEffect, useRef, useState } from "react";
import { useHousehold, today } from "@/lib/store";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CATEGORIES, LOCATIONS, type ExpiryType, type Location } from "@/lib/domain/types";
import { UNIT_OPTIONS, normalizeUnit } from "@/lib/domain/units";
import { parseQuickAdd } from "@/lib/domain/parse";
import { addDays } from "@/lib/domain/expiry";
import { guessCategory } from "@/lib/domain/shopping";
import { Sheet } from "./ui";

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

export function AddSheet({ open, onClose, initialLocation }: { open: boolean; onClose: () => void; initialLocation?: Location }) {
  const { household, toast, upsertLocal } = useHousehold();
  const [mode, setMode] = useState<Mode>("quick");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!open) setDrafts([]); }, [open]);
  const addDrafts = (ds: Draft[]) => setDrafts((p) => [...p, ...ds.map((d) => (initialLocation && !d.confidence ? { ...d, location: initialLocation } : d))]);

  async function saveAll() {
    const valid = drafts.filter((d) => d.name.trim() && d.quantity > 0);
    if (!valid.length) return;
    setSaving(true);
    const rows = valid.map((d) => ({
      household_id: household!.id, name: d.name.trim(), category: d.category, quantity: d.quantity, unit: normalizeUnit(d.unit),
      location: d.location, expiry_date: d.expiry_date || null, expiry_type: d.expiry_type, purchase_date: today(), barcode: d.barcode ?? null,
    }));
    const { data, error } = await supabaseBrowser().from("inventory_items").insert(rows).select();
    setSaving(false);
    if (error) return toast(error.message, "error");
    data!.forEach((r: any) => upsertLocal("inventory", r));
    toast(`Added ${data!.length} product${data!.length > 1 ? "s" : ""}`);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add products">
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 text-sm">
        {([["quick", "✍️ Type / speak"], ["scan", "📷 Photo / receipt"], ["barcode", "▦ Barcode"]] as [Mode, string][]).map(([m, l]) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded-lg py-1.5 ${mode === m ? "bg-white font-medium shadow-sm" : "text-stone-500"}`}>{l}</button>
        ))}
      </div>
      {mode === "quick" && <QuickAdd onAdd={addDrafts} />}
      {mode === "scan" && <ScanAdd onAdd={addDrafts} />}
      {mode === "barcode" && <BarcodeAdd onAdd={addDrafts} />}

      {drafts.length > 0 && (
        <div className="mt-5 space-y-3">
          <div className="label">Review before saving ({drafts.length})</div>
          {drafts.map((d) => (
            <DraftRow key={d.key} d={d} onChange={(nd) => setDrafts((p) => p.map((x) => (x.key === d.key ? nd : x)))} onRemove={() => setDrafts((p) => p.filter((x) => x.key !== d.key))} />
          ))}
          <button className="btn-primary w-full py-3" disabled={saving} onClick={saveAll}>{saving ? "Saving…" : `Add ${drafts.length} to inventory`}</button>
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
        <button className="btn-ghost shrink-0" onClick={onRemove} aria-label="Remove">✕</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input className="input" inputMode="decimal" value={d.quantity} onChange={(e) => set({ quantity: Number(e.target.value) })} />
        <select className="input" value={d.unit} onChange={(e) => set({ unit: e.target.value })}>{[...new Set([d.unit, ...UNIT_OPTIONS])].map((u) => <option key={u}>{u}</option>)}</select>
        <select className="input" value={d.location} onChange={(e) => set({ location: e.target.value as Location })}>{LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.icon} {l.label}</option>)}</select>
        <select className="input" value={d.category} onChange={(e) => set({ category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <input className="input" type="date" value={d.expiry_date} onChange={(e) => set({ expiry_date: e.target.value })} aria-label="Expiry date" />
        <select className="input" value={d.expiry_type} onChange={(e) => set({ expiry_type: e.target.value as ExpiryType })}>
          <option value="use_by">Use-by</option><option value="best_before">Best-before</option><option value="none">No date</option>
        </select>
      </div>
      {d.confidence === "low" && <p className="text-xs text-amber-700">AI wasn&apos;t sure about this one – please check.</p>}
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
    rec.lang = navigator.language || "en-US";
    rec.interimResults = false;
    rec.onresult = (e: any) => setText((t) => (t ? t + ", " : "") + e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <div className="space-y-2">
      <textarea className="input min-h-24" placeholder={"2 l milk, 6 eggs, 500 g chicken breast\n1 kg potatoes"} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex gap-2">
        {SR && <button className={`btn ${listening ? "bg-red-600 text-white" : "btn-ghost"}`} onClick={voice}>{listening ? "■ Stop" : "🎙️ Speak"}</button>}
        <button className="btn-primary flex-1" disabled={!text.trim()} onClick={() => { onAdd(parseQuickAdd(text).map((p) => draft(p))); setText(""); }}>Add to review list</button>
      </div>
    </div>
  );
}

function ScanAdd({ onAdd }: { onAdd: (d: Draft[]) => void }) {
  const { toast } = useHousehold();
  const [busy, setBusy] = useState<null | "photo" | "receipt">(null);

  async function handle(file: File, mode: "photo" | "receipt") {
    setBusy(mode);
    try {
      const { base64, mediaType } = await downscale(file);
      const r = await fetch("/api/ai/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: base64, mediaType, mode }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (!j.items.length) toast("No groceries recognised", "error");
      onAdd(j.items.map((it: any) => draft({
        name: it.name, category: it.category, quantity: it.quantity, unit: normalizeUnit(it.unit), location: it.location, expiry_type: it.expiry_type,
        expiry_date: it.suggested_shelf_days != null ? addDays(today(), it.suggested_shelf_days) : "", confidence: it.confidence,
      })));
    } catch (e: any) {
      toast(e.message || "Scan failed", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {(["photo", "receipt"] as const).map((m) => (
        <label key={m} className="card flex cursor-pointer flex-col items-center gap-1 p-5 text-center hover:bg-stone-50">
          <span className="text-3xl">{m === "photo" ? "🛍️" : "🧾"}</span>
          <span className="text-sm font-medium">{busy === m ? "Reading…" : m === "photo" ? "Photo of groceries" : "Scan receipt"}</span>
          <span className="text-xs text-stone-500">AI suggests, you confirm</span>
          <input type="file" accept="image/*" capture="environment" className="hidden" disabled={!!busy} onChange={(e) => e.target.files?.[0] && handle(e.target.files[0], m)} />
        </label>
      ))}
      <p className="col-span-2 text-xs text-stone-500">Expiry dates from scans are estimates – check the packaging for use-by dates.</p>
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
    if (!r.ok || !j.found) return toast("Product not found – add it manually", "error");
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
        toast("Camera not available", "error");
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
        : <button className="btn-primary w-full py-3" onClick={() => setScanning(true)}>📷 Scan barcode with camera</button>)}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); lookup(code); }}>
        <input className="input" inputMode="numeric" placeholder="or type the barcode number" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        <button className="btn-ghost shrink-0" disabled={code.length < 6}>Look up</button>
      </form>
    </div>
  );
}
