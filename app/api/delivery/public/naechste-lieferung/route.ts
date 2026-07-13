/**
 * GET /api/delivery/public/naechste-lieferung?location_id=<uuid>
 *
 * Phase 1424 (Support-API) — Nächste-Lieferung-ETA (Public)
 * Schätzt wann der nächste Fahrer zurück und für neue Touren verfügbar ist.
 * Supabase mise_drivers + mise_delivery_batches + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NaechsteLieferungResponse {
  naechste_lieferung_eta_min: number | null;
  fahrer_online: number;
  aktiv: boolean;
}

function buildMock(): NaechsteLieferungResponse {
  return { naechste_lieferung_eta_min: 12, fahrer_online: 1, aktiv: true };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const { data: drivers, error } = await (sb as any)
      .from('mise_drivers')
      .select('id, driver_status(ist_online, aktueller_batch_id)')
      .eq('location_id', locationId)
      .eq('aktiv', true);

    if (error || !drivers) return NextResponse.json(buildMock());

    type DriverRow = { id: string; driver_status: { ist_online: boolean; aktueller_batch_id: string | null }[] };

    const online = (drivers as DriverRow[]).filter((d) => d.driver_status?.[0]?.ist_online);
    const onlineCount = online.length;

    if (onlineCount === 0) return NextResponse.json({ naechste_lieferung_eta_min: null, fahrer_online: 0, aktiv: false });

    const freeDrivers = online.filter((d) => !d.driver_status?.[0]?.aktueller_batch_id);
    if (freeDrivers.length > 0) {
      return NextResponse.json({ naechste_lieferung_eta_min: 3, fahrer_online: onlineCount, aktiv: true });
    }

    const busyIds = online.map((d) => d.driver_status?.[0]?.aktueller_batch_id).filter(Boolean);
    const { data: batches } = await (sb as any)
      .from('mise_delivery_batches')
      .select('id, total_eta_min, startzeit')
      .in('id', busyIds);

    let minRemain = 999;
    const now = Date.now();
    for (const b of (batches ?? []) as { total_eta_min: number | null; startzeit: string | null }[]) {
      if (!b.startzeit || !b.total_eta_min) continue;
      const elapsedMin = (now - new Date(b.startzeit).getTime()) / 60_000;
      const remain = Math.max(0, b.total_eta_min - elapsedMin);
      if (remain < minRemain) minRemain = remain;
    }

    const eta = minRemain < 999 ? Math.round(minRemain) : null;

    return NextResponse.json({
      naechste_lieferung_eta_min: eta,
      fahrer_online: onlineCount,
      aktiv: eta !== null && eta < 20,
    } satisfies NaechsteLieferungResponse);
  } catch {
    return NextResponse.json(buildMock());
  }
}
