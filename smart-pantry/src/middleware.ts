import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_DEMO === "1") return NextResponse.next();
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await sb.auth.getUser();
  const p = req.nextUrl.pathname;
  if (!user && !p.startsWith("/login") && !p.startsWith("/auth") && !p.startsWith("/api")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", p + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|sw.js|offline.html|share-target|api/ai/status).*)"] };
