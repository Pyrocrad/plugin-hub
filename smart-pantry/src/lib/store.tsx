"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "./supabase/client";
import type { Cooking, InventoryEvent, InventoryItem, PreferenceOverride, Profile, Rating, Recipe, ShoppingItem } from "./domain/types";

interface Household { id: string; name: string; currency: string; expiry_alert_days: number }

interface State {
  ready: boolean;
  user: User | null;
  household: Household | null;
  members: Profile[];
  inventory: InventoryItem[];
  events: InventoryEvent[];
  shopping: ShoppingItem[];
  recipes: Recipe[];
  cookings: Cooking[];
  ratings: Rating[];
  overrides: PreferenceOverride[];
  online: boolean;
}

interface Ctx extends State {
  reload: () => Promise<void>;
  rpc: <T = unknown>(fn: string, args: Record<string, unknown>) => Promise<T | null>;
  upsertLocal: (table: TableKey, row: any) => void;
  memberName: (id: string | null | undefined) => string;
  toast: (msg: string, kind?: "ok" | "error") => void;
  toasts: { id: number; msg: string; kind: "ok" | "error" }[];
}

type TableKey = "inventory" | "shopping" | "recipes" | "cookings" | "ratings" | "overrides";
const TABLES: Record<TableKey, string> = {
  inventory: "inventory_items", shopping: "shopping_items", recipes: "recipes",
  cookings: "cookings", ratings: "ratings", overrides: "preference_overrides",
};

const HouseholdCtx = createContext<Ctx | null>(null);

const ERRORS: Record<string, string> = {
  version_conflict: "Someone else just changed this item. It has been refreshed – please try again.",
  insufficient_quantity: "That's more than is left in stock.",
  invalid_or_expired_invite: "That invite code is invalid or has expired.",
  forbidden: "You don't have access to that household.",
};

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const sb = supabaseBrowser();
  const [s, setS] = useState<State>({
    ready: false, user: null, household: null, members: [], inventory: [], events: [], shopping: [],
    recipes: [], cookings: [], ratings: [], overrides: [], online: true,
  });
  const [toasts, setToasts] = useState<Ctx["toasts"]>([]);
  const hid = s.household?.id;
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string, kind: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const reload = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return setS((p) => ({ ...p, ready: true, user: null }));
    const { data: mem } = await sb.from("household_members").select("household_id, households(*)").eq("user_id", user.id).limit(1).maybeSingle();
    if (!mem) return setS((p) => ({ ...p, ready: true, user, household: null }));
    const id = mem.household_id as string;
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [members, inv, ev, shop, rec, cook, rat, ov] = await Promise.all([
      sb.from("household_members").select("profiles:user_id(*)").eq("household_id", id),
      // Active stock + recently finished items (for "recently consumed" & waste stats).
      sb.from("inventory_items").select("*").eq("household_id", id).or(`status.eq.active,updated_at.gte.${since}`).order("name"),
      sb.from("inventory_events").select("*").eq("household_id", id).order("created_at", { ascending: false }).limit(200),
      sb.from("shopping_items").select("*").eq("household_id", id).or(`status.eq.open,purchased_at.gte.${since}`).order("created_at"),
      sb.from("recipes").select("*").eq("household_id", id).order("created_at", { ascending: false }).limit(300),
      sb.from("cookings").select("*").eq("household_id", id).order("cooked_at", { ascending: false }).limit(300),
      sb.from("ratings").select("*").eq("household_id", id),
      sb.from("preference_overrides").select("*").eq("household_id", id),
    ]);
    setS((p) => ({
      ...p,
      ready: true,
      user,
      household: mem.households as unknown as Household,
      members: (members.data ?? []).map((m: any) => m.profiles).filter(Boolean),
      inventory: num(inv.data ?? []),
      events: ev.data ?? [],
      shopping: num(shop.data ?? []),
      recipes: rec.data ?? [],
      cookings: cook.data ?? [],
      ratings: rat.data ?? [],
      overrides: ov.data ?? [],
    }));
  }, [sb]);

  useEffect(() => {
    reload();
    const { data } = sb.auth.onAuthStateChange((e: string) => {
      if (e === "SIGNED_IN" || e === "SIGNED_OUT") reload();
    });
    return () => data.subscription.unsubscribe();
  }, [sb, reload]);

  const upsertLocal = useCallback((table: TableKey, row: any) => {
    setS((p) => {
      const list = p[table] as any[];
      const fixed = table === "inventory" || table === "shopping" ? num([row])[0] : row;
      const i = list.findIndex((x) => x.id === row.id);
      // Ignore stale echoes: never replace a newer version with an older one.
      if (i >= 0 && table === "inventory" && list[i].version > fixed.version) return p;
      const next = i >= 0 ? list.map((x, j) => (j === i ? fixed : x)) : [fixed, ...list];
      return { ...p, [table]: next };
    });
  }, []);

  // Realtime sync: every change by any household member lands here within ~100 ms.
  useEffect(() => {
    if (!hid) return;
    const filter = `household_id=eq.${hid}`;
    let ch = sb.channel(`household:${hid}`);
    (Object.keys(TABLES) as TableKey[]).forEach((k) => {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table: TABLES[k], filter }, (payload: any) => {
        if (payload.eventType === "DELETE") {
          setS((p) => ({ ...p, [k]: (p[k] as any[]).filter((x) => x.id !== payload.old.id) }));
        } else upsertLocal(k, payload.new);
      });
    });
    ch = ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "inventory_events", filter }, (payload: any) =>
      setS((p) => (p.events.some((e) => e.id === payload.new.id) ? p : { ...p, events: [payload.new, ...p.events].slice(0, 300) })),
    );
    ch.subscribe((status: string) => {
      setS((p) => ({ ...p, online: status === "SUBSCRIBED" }));
      // After a reconnect we may have missed events: resync once.
      if (status === "SUBSCRIBED") {
        if (reloadTimer.current) clearTimeout(reloadTimer.current);
        reloadTimer.current = setTimeout(reload, 300);
      }
    });
    const onFocus = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      sb.removeChannel(ch);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [sb, hid, reload, upsertLocal]);

  const rpc = useCallback(async <T,>(fn: string, args: Record<string, unknown>): Promise<T | null> => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) {
      const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
      toast(key ? ERRORS[key] : error.message, "error");
      if (key === "version_conflict") reload();
      return null;
    }
    return data as T;
  }, [sb, toast, reload]);

  const memberName = useCallback((id: string | null | undefined) => {
    if (!id) return "—";
    if (id === s.user?.id) return "You";
    return s.members.find((m) => m.id === id)?.display_name ?? "Housemate";
  }, [s.members, s.user]);

  const value = useMemo(() => ({ ...s, reload, rpc, upsertLocal, memberName, toast, toasts }), [s, reload, rpc, upsertLocal, memberName, toast, toasts]);
  return <HouseholdCtx.Provider value={value}>{children}</HouseholdCtx.Provider>;
}

export function useHousehold() {
  const c = useContext(HouseholdCtx);
  if (!c) throw new Error("useHousehold outside provider");
  return c;
}

/** Postgres numeric arrives as string – convert so arithmetic is safe. */
function num<T extends { quantity: any; low_stock_threshold?: any }>(rows: T[]): T[] {
  return rows.map((r) => ({
    ...r,
    quantity: r.quantity == null ? r.quantity : Number(r.quantity),
    ...(r.low_stock_threshold !== undefined ? { low_stock_threshold: r.low_stock_threshold == null ? null : Number(r.low_stock_threshold) } : {}),
  }));
}

export function today() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
