/**
 * GET /api/delivery/admin/schicht-snapshot
 *   ?location_id=<uuid>
 *
 * Phase 1257 — Schicht-Snapshot-API (Admin)
 * Gesamtbestellungen heute, Gesamtumsatz, Ø-Lieferzeit, Fahrer-Ø-Stimmung,
 * Top-Zone, Top-Fahrer, aktive Fahrer; Mock-Fallback.
 *
 * Multi-Tenant: location_id on every Supabase query.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SchichtSnapshot {
  gesamt_bestellungen: number;
  gesamt_umsatz_eur: number;
  schnitt_lieferzeit_min: number | null;
  fahrer_schnitt_stimmung: number | null;
  top_zone: string | null;
  top_fahrer: string | null;
  aktive_fahrer: number;
  location_id: string;
  generiert_am: string;
}

function buildMock(locationId: string): SchichtSnapshot {
  return {
    gesamt_bestellungen: 47,
    gesamt_umsatz_eur: 1284.50,
    schnitt_lieferzeit_min: 28,
    fahrer_schnitt_stimmung: 3.8,
    top_zone: 'Mitte',
    top_fahrer: 'M. Schmidt',
    aktive_fahrer: 6,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id') ?? '';

  try {
    const supabase = await createClient();

    const heute = new Date();
    const heuteStart = `${heute.toISOString().slice(0, 10)}T00:00:00`;

    // Gesamtbestellungen + Umsatz heute
    const { data: ordersRaw } = await supabase
      .from('customer_orders')
      .select('id, total_amount')
      .eq('location_id', locationId)
      .gte('created_at', heuteStart);

    const orders = ordersRaw ?? [];
    const gesamt_bestellungen = orders.length;
    const gesamt_umsatz_eur = Math.round(
      orders.reduce((s, o) => s + (Number((o as { total_amount?: number }).total_amount) || 0), 0) * 100
    ) / 100;

    // Ø-Lieferzeit aus mise_delivery_stops (delivered_at - created_at) in Minuten
    const { data: stopsRaw } = await supabase
      .from('mise_delivery_stops')
      .select('id, delivered_at, created_at, delivery_zone, driver_id')
      .eq('location_id', locationId)
      .gte('created_at', heuteStart)
      .not('delivered_at', 'is', null);

    const stops = (stopsRaw ?? []) as Array<{
      id: string;
      delivered_at: string | null;
      created_at: string | null;
      delivery_zone: string | null;
      driver_id: string | null;
    }>;

    let schnitt_lieferzeit_min: number | null = null;
    if (stops.length > 0) {
      const deltas = stops
        .map(s => {
          const start = new Date(s.created_at ?? '').getTime();
          const end = new Date(s.delivered_at ?? '').getTime();
          return (end - start) / 60_000;
        })
        .filter(d => d > 0 && d < 180);
      if (deltas.length > 0) {
        schnitt_lieferzeit_min = Math.round(
          deltas.reduce((a, b) => a + b, 0) / deltas.length
        );
      }
    }

    // Top-Zone: meiste Lieferungen heute
    const zoneCount: Record<string, number> = {};
    for (const s of stops) {
      const zone = s.delivery_zone ?? 'Unbekannt';
      zoneCount[zone] = (zoneCount[zone] ?? 0) + 1;
    }
    const top_zone = Object.entries(zoneCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Top-Fahrer: meiste gelieferte Stopps heute
    const fahrerCount: Record<string, number> = {};
    for (const s of stops) {
      const d = s.driver_id ?? '';
      if (d) fahrerCount[d] = (fahrerCount[d] ?? 0) + 1;
    }
    const topFahrerId = Object.entries(fahrerCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    let top_fahrer: string | null = null;
    if (topFahrerId) {
      const { data: drvRaw } = await supabase
        .from('mise_drivers')
        .select('name')
        .eq('id', topFahrerId)
        .eq('location_id', locationId)
        .maybeSingle();
      top_fahrer = (drvRaw as { name?: string } | null)?.name ?? null;
    }

    // Aktive Fahrer
    const { count: aktive_fahrer } = await supabase
      .from('mise_drivers')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('online', true);

    // Fahrer-Ø-Stimmung (letzte 8h)
    const vor8h = new Date(heute.getTime() - 8 * 60 * 60 * 1_000).toISOString();
    const { data: moodRaw } = await supabase
      .from('driver_mood_logs')
      .select('mood_score, mise_drivers!inner(location_id)')
      .eq('mise_drivers.location_id', locationId)
      .gte('created_at', vor8h);

    let fahrer_schnitt_stimmung: number | null = null;
    if (moodRaw && moodRaw.length > 0) {
      const scores = (moodRaw as Array<{ mood_score: number }>).map(m => Number(m.mood_score));
      fahrer_schnitt_stimmung =
        Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
    }

    if (gesamt_bestellungen === 0 && stops.length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    const result: SchichtSnapshot = {
      gesamt_bestellungen,
      gesamt_umsatz_eur,
      schnitt_lieferzeit_min,
      fahrer_schnitt_stimmung,
      top_zone,
      top_fahrer,
      aktive_fahrer: aktive_fahrer ?? 0,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
