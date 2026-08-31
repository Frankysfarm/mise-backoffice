import QRCode from "qrcode";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireManagerPlus } from "@/lib/auth/requireRole";
import { PrintButton } from "@/app/(admin)/pos/tables/print/print-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LabelPlace = {
  id: string;
  name: string;
  qr_token: string;
  area: {
    id: string;
    name: string;
    location_id: string;
    location: { name: string; tenant_id: string };
  };
};

export default async function WarehouseLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; place?: string }>;
}) {
  const actor = await requireManagerPlus();
  if (!actor.tenant_id) notFound();
  const filters = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("inventory_shelves")
    .select(
      "id,name,qr_token,area:inventory_areas!inner(id,name,location_id,location:locations!inner(name,tenant_id))",
    )
    .eq("place_kind", "place")
    .eq("area.location.tenant_id", actor.tenant_id)
    .order("name");
  if (filters.area) query = query.eq("area_id", filters.area);
  if (filters.place) query = query.eq("id", filters.place);
  if (actor.location_id)
    query = query.eq("area.location_id", actor.location_id);
  const { data } = await query;
  const places = (data ?? []) as unknown as LabelPlace[];
  const h = await headers();
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const origin =
    configuredOrigin ??
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "mise-gastro.de"}`;
  const labels = await Promise.all(
    places.map(async (place) => ({
      place,
      qr: await QRCode.toDataURL(
        `${origin}/neo/app/lager/platz/${place.qr_token}`,
        { margin: 1, width: 600, errorCorrectionLevel: "H" },
      ),
    })),
  );
  return (
    <main>
      <style>{`@page{size:A4 portrait;margin:10mm}@media print{.no-print{display:none!important}.label{break-inside:avoid}}body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#f5f5f0;color:#0f2922}.toolbar{max-width:1000px;margin:0 auto 20px;display:flex;justify-content:space-between;align-items:center}.grid{max-width:1000px;margin:auto;display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.label{background:white;border:2px solid #0f2922;border-radius:16px;padding:18px;text-align:center}.label img{width:180px;height:180px}.place{font-size:22px;font-weight:800}.context{font-size:13px;color:#555;margin-top:4px}`}</style>
      <div className="toolbar no-print">
        <div>
          <h1>QR-Etiketten Lager</h1>
          <p>{labels.length} druckbare Etiketten</p>
        </div>
        <PrintButton color="#0f2922" />
      </div>
      {labels.length === 0 ? (
        <p>Keine Lagerplätze für diese Auswahl gefunden.</p>
      ) : (
        <div className="grid">
          {labels.map(({ place, qr }) => (
            <article className="label" key={place.id}>
              <div className="place">{place.name}</div>
              <div className="context">
                {place.area.name} · {place.area.location.name}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={`QR-Code für ${place.name}`} />
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
