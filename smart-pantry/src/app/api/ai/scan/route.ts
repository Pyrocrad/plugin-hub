import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHousehold } from "@/lib/supabase/server";
import { scanImage } from "@/lib/ai/claude";
import { errorResponse } from "@/lib/http";

export const maxDuration = 90;

const Body = z.object({
  image: z.string().max(7_000_000), // base64, ~5 MB
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  mode: z.enum(["photo", "receipt", "list"]),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    await requireHousehold(); // only household members may spend API credits
    const { items, store } = await scanImage(body.image, body.mediaType, body.mode);
    return NextResponse.json({ items, store });
  } catch (e) {
    return errorResponse(e);
  }
}
