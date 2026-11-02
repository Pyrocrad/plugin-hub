import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError } from "@/lib/supabase/server";

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const msg = e instanceof Error ? e.message : "Unexpected error";
  console.error(e);
  const status = /rate|overloaded|529|429/i.test(msg) ? 503 : 500;
  return NextResponse.json({ error: status === 503 ? "The AI chef is busy – try again in a moment." : msg }, { status });
}
