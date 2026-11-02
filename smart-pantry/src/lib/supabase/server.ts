import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server client acting AS the signed-in user – all queries stay under RLS. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* called from a Server Component – middleware refreshes the session */
        }
      },
    },
  });
}

/** Resolve the signed-in user and their household, or throw an HTTP-ish error. */
export async function requireHousehold() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new HttpError(401, "Niet aangemeld");
  const { data: m } = await sb.from("household_members").select("household_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!m) throw new HttpError(403, "Maak eerst een huishouden of sluit je aan bij een");
  return { sb, user, householdId: m.household_id as string };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
