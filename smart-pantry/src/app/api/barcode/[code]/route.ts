import { NextResponse } from "next/server";
import { requireHousehold } from "@/lib/supabase/server";
import { guessCategory } from "@/lib/domain/shopping";
import { errorResponse } from "@/lib/http";

// Barcode lookup via Open Food Facts (free, no key). No AI call needed.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    await requireHousehold();
    const { code } = await params;
    if (!/^\d{6,14}$/.test(code)) return NextResponse.json({ error: "Invalid barcode" }, { status: 400 });
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,generic_name,quantity,categories_tags`, {
      headers: { "User-Agent": "SmartPantry/0.1" },
      signal: AbortSignal.timeout(6000),
    });
    const j = await r.json().catch(() => null);
    if (!j || j.status !== 1) return NextResponse.json({ found: false });
    const name: string = j.product.product_name || j.product.generic_name || "";
    const m = /([\d.,]+)\s*(kg|g|ml|cl|l)\b/i.exec(j.product.quantity ?? "");
    return NextResponse.json({
      found: Boolean(name),
      name,
      category: guessCategory(name),
      quantity: m ? Number(m[1].replace(",", ".")) : 1,
      unit: m ? m[2].toLowerCase() : "pcs",
    });
  } catch (e) {
    return errorResponse(e);
  }
}
