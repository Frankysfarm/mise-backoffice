/**
 * GET /api/delivery/admin/fahrer-touren-effizienz?location_id=<uuid>
 *
 * Phase 669 (Backend) — Fahrer-Touren-Effizienz-Vergleichs-API
 * Vergleich aller aktiven Fahrer nach Lieferungen/h und km/Tour heute.
 *
 * Response: { ok, fahrer: FahrerEffizienz[], generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface BatchRow {
  id: string;
  driver_id: string | null;
  started_at: string | null;
  delivered_at: string | null;
  distance_km: number | null;
  stop_count: number | null;
  status: string;
}

interface DriverRow {
  id: string;
  vorname: string | null;
  nachname: string | null;
}

interface ShiftRow {
  driver_id: string;
  started_at: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ ok: false, error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Aktive Schichten heute
    const { data: shifts } = await supabase
      .from('driver_shifts')
      .select('driver_id, started_at')
      .eq('location_id', locationId)
      .in('status', ['active', 'on_break'])
      .gte('started_at', todayStart.toISOString());

    if (!shifts || shifts.length === 0) {
      return NextResponse.json({ ok: true, fahrer: [], generatedAt: new Date().toISOString() });
    }

    const activeDriverIds = (shifts as ShiftRow[]).map((s) => s.driver_id);

    // Heutige abgeschlossene Touren dieser Fahrer
    const { data: batches } = await supabase
      .from('mise_delivery_batches')
      .select('id, driver_id, started_at, delivered_at, distance_km, stop_count, status')
      .eq('location_id', locationId)
      .in('driver_id', activeDriverIds)
      .eq('status', 'delivered')
      .gte('delivered_at', todayStart.toISOString());

    const { data: drivers } = await supabase
      .from('mise_drivers')
      .select('id, vorname, nachname')
      .in('id', activeDriverIds);

    const driverMap = new Map<string, DriverRow>();
    for (const d of drivers ?? []) {
      driverMap.set(d.id, d as DriverRow);
    }

    const shiftMap = new Map<string, ShiftRow>();
    for (const s of shifts as ShiftRow[]) {
      shiftMap.set(s.driver_id, s);
    }

    const now = Date.now();

    const result = activeDriverIds.map((driverId) => {
      const d = driverMap.get(driverId);
      const name = d ? `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || 'Fahrer' : 'Fahrer';

      const shift = shiftMap.get(driverId);
      const schichtDauerH = shift
        ? Math.max(0.1, (now - new Date(shift.started_at).getTime()) / 3_600_000)
        : 1;

      const driverBatches = ((batches ?? []) as BatchRow[]).filter((b) => b.driver_id === driverId);
      const tourenAnzahl = driverBatches.length;
      const gesamtKm = driverBatches.reduce((s, b) => s + ((b.distance_km as number | null) ?? 0), 0);
      const gesamtStopps = driverBatches.reduce((s, b) => s + ((b.stop_count as number | null) ?? 1), 0);

      const lieferungenProH = Math.round((gesamtStopps / schichtDauerH) * 10) / 10;
      const kmProTour = tourenAnzahl > 0 ? Math.round((gesamtKm / tourenAnzahl) * 10) / 10 : 0;

      // Effizienz-Score: gewichtet aus Lieferungen/h (60%) und km-Effizienz (40%)
      // Benchmark: 8 Lieferungen/h = sehr gut, 15 km/Tour = sehr gut
      const deliveryScore = Math.min(100, (lieferungenProH / 8) * 60);
      const kmScore = kmProTour > 0 ? Math.min(40, (15 / kmProTour) * 40) : 0;
      const effizienzScore = Math.round(deliveryScore + kmScore);

      const stufe: 'top' | 'gut' | 'mittel' | 'niedrig' =
        effizienzScore >= 80 ? 'top' :
        effizienzScore >= 60 ? 'gut' :
        effizienzScore >= 40 ? 'mittel' :
        'niedrig';

      return {
        driver_id: driverId,
        fahrer_name: name,
        touren_anzahl: tourenAnzahl,
        gesamt_stopps: gesamtStopps,
        gesamt_km: Math.round(gesamtKm * 10) / 10,
        lieferungen_pro_h: lieferungenProH,
        km_pro_tour: kmProTour,
        schicht_dauer_h: Math.round(schichtDauerH * 10) / 10,
        effizienz_score: effizienzScore,
        stufe,
      };
    });

    result.sort((a, b) => b.effizienz_score - a.effizienz_score);

    return NextResponse.json({
      ok: true,
      fahrer: result,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('fahrer-touren-effizienz error:', err);
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 });
  }
}
