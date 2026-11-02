import { NextResponse } from "next/server";

// Tells the app whether the AI chef is configured. Without a key the app runs in free mode.
export async function GET() {
  return NextResponse.json({ enabled: Boolean(process.env.ANTHROPIC_API_KEY) });
}
