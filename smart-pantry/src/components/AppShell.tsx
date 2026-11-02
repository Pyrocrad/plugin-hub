"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHousehold } from "@/lib/store";

const NAV = [
  { href: "/", label: "Dashboard", icon: "🏠", mobile: true },
  { href: "/inventory", label: "Inventory", icon: "🧊", mobile: true },
  { href: "/recipes", label: "Chef", icon: "👩‍🍳", mobile: true },
  { href: "/history", label: "History", icon: "📖", mobile: false },
  { href: "/shopping", label: "Shopping", icon: "🛒", mobile: true },
  { href: "/stores", label: "Store layout", icon: "🧭", mobile: false },
  { href: "/preferences", label: "Preferences", icon: "❤️", mobile: false },
  { href: "/settings", label: "Settings", icon: "⚙️", mobile: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { ready, user, household, online, toasts, shopping } = useHousehold();
  const bare = path.startsWith("/login") || path.startsWith("/onboarding");

  useEffect(() => {
    if (!ready || bare) return;
    if (!user) router.replace("/login");
    else if (!household) router.replace("/onboarding");
  }, [ready, user, household, bare, router]);

  const openShopping = shopping.filter((s) => s.status === "open").length;
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));

  return (
    <>
      {bare ? children : (
        <div className="md:flex">
          <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-stone-200 bg-white p-4 md:flex">
            <div className="mb-6 flex items-center gap-2 px-2 text-lg font-semibold">🥕 Smart Pantry</div>
            <nav className="space-y-1">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${active(n.href) ? "bg-brand-50 font-medium text-brand-700" : "text-stone-600 hover:bg-stone-100"}`}>
                  <span>{n.icon}</span>{n.label}
                  {n.href === "/shopping" && openShopping > 0 && <span className="chip ml-auto bg-brand-600 text-white">{openShopping}</span>}
                </Link>
              ))}
            </nav>
            <div className="mt-auto px-2 text-xs text-stone-400">
              {household?.name} · <span className={online ? "text-emerald-600" : "text-amber-600"}>{online ? "● live" : "● reconnecting"}</span>
            </div>
          </aside>
          <main className="pb-safe mx-auto w-full max-w-5xl px-4 pt-5 md:px-8 md:pb-10">
            {!ready || !household ? <div className="py-20 text-center text-stone-400">Loading your kitchen…</div> : children}
          </main>
          <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
            {NAV.filter((n) => n.mobile).map((n) => (
              <Link key={n.href} href={n.href} className={`relative flex flex-col items-center py-2 text-[11px] ${active(n.href) ? "text-brand-700" : "text-stone-500"}`}>
                <span className="text-xl leading-6">{n.icon}</span>{n.label === "Settings" ? "More" : n.label}
                {n.href === "/shopping" && openShopping > 0 && <span className="absolute right-4 top-1 h-4 min-w-4 rounded-full bg-brand-600 px-1 text-[10px] text-white">{openShopping}</span>}
              </Link>
            ))}
          </nav>
        </div>
      )}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto rounded-xl px-4 py-2.5 text-sm shadow-lg ${t.kind === "error" ? "bg-red-600 text-white" : "bg-stone-900 text-white"}`}>{t.msg}</div>
        ))}
      </div>
    </>
  );
}
