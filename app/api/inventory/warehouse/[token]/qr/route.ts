import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getCurrentEmployee } from "@/lib/auth/getCurrentEmployee";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const actor = await getCurrentEmployee();
  if (!actor?.tenant_id)
    return new NextResponse("Anmeldung erforderlich", { status: 401 });
  const { token } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(token))
    return new NextResponse("Ungültiger Lagerplatz", { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_shelves")
    .select("id,area:inventory_areas!inner(location:locations!inner(tenant_id))")
    .eq("qr_token", token)
    .eq("area.location.tenant_id", actor.tenant_id)
    .maybeSingle();
  if (!data)
    return new NextResponse("Lagerplatz nicht gefunden", { status: 404 });
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    new URL(req.url).origin;
  const url = `${origin}/neo/app/lager/platz/${token}`;
  const svg = await QRCode.toString(url, {
    type: "svg",
    width: 480,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#0f2922", light: "#ffffff" },
  });
  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "private, max-age=300",
    },
  });
}
