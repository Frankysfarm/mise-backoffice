/**
 * GET /api/delivery/admin/fahrer-monats-statistik?location_id=<uuid>&driver_id=<uuid>
 *
 * Phase 679 (Backend) — Fahrer-Monats-Statistik-API
 * Aggregiert Touren, km, Trinkgeld und Ø Bewertung über 30 Tage je Fahrer.
 *
 * Response: { ok, fahrer: FahrerMonatsStatistik[], generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface BatchRow {
  driver_id: string | null;
  distance_km: number | null;
  total_tip_eur: number | null;
  revenue_eur: number | null;
  stop_count: number | null;
  delivered_at: string | null;
}

interface OrderRow {
  driver_id: string | null;
  rating: number | null;
}

interface DriverRow {
  id: string;
  vorname: string | null;
  nachname: string | null;
}

interface ShiftRow {
  driver_id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverIdParam = searchParams.get('driver_id');

  if (!locationId) {
    return NextResponse.json({ ok: false, error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);
    const sinceIso = since.toISOString();

    // Schichten der letzten 30 Tage → aktive Fahrer ermitteln
    let shiftQuery = supabase
      .from('driver_shifts')
      .select('driver_id, started_at, ended_at, status')
      .eq('location_id', locationId)
      .gte('started_at', sinceIso);

    if (driverIdParam) shiftQuery = shiftQuery.eq('driver_id', driverIdParam);

    const { data: shifts } = await shiftQuery;
    if (!shifts || shifts.length === 0) {
      return NextResponse.json({ ok: true, fahrer: [], generatedAt: new Date().toISOString() });
    }

    const driverIds = [...new Set((shifts as ShiftRow[]).map((s) => s.driver_id).filter(Boolean))] as string[];

    // Touren der letzten 30 Tage
    const { data: batches } = await supabase
      .from('mise_delivery_batches')
      .select('driver_id, distance_km, total_tip_eur, revenue_eur, stop_count, delivered_at')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .eq('status', 'delivered')
      .gte('delivered_at', sinceIso);

    // Bewertungen der letzten 30 Tage
    const { data: orders } = await supabase
      .from('orders')
      .select('driver_id, rating')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .not('rating', 'is', null)
      .gte('created_at', sinceIso);

    // Fahrer-Namen
    const { data: drivers } = await supabase
      .from('mise_drivers')
      .select('id, vorname, nachname')
      .in('id', driverIds);

    const driverMap = new Map<string, DriverRow>(
      (drivers ?? []).map((d) => [d.id, d as DriverRow]),
    );

    const result = driverIds.map((dId) => {
      const d = driverMap.get(dId);
      const name = d ? `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || 'Fahrer' : 'Fahrer';

      const dBatches = ((batches ?? []) as BatchRow[]).filter((b) => b.driver_id === dId);
      const touren = dBatches.length;
      const gesamtKm = dBatches.reduce((s, b) => s + ((b.distance_km as number | null) ?? 0), 0);
      const trinkgeld = dBatches.reduce((s, b) => s + ((b.total_tip_eur as number | null) ?? 0), 0);
      const einnahmen = dBatches.reduce((s, b) => s + ((b.revenue_eur as number | null) ?? 0), 0);
      const gesamtStopps = dBatches.reduce((s, b) => s + ((b.stop_count as number | null) ?? 1), 0);

      const dRatings = ((orders ?? []) as OrderRow[])
        .filter((o) => o.driver_id === dId && typeof o.rating === 'number' && o.rating > 0)
        .map((o) => o.rating as number);
      const avgRating = dRatings.length > 0 ? dRatings.reduce((a, b) => a + b, 0) / dRatings.length : null;

      // Aktive Tage
      const dShifts = (shifts as ShiftRow[]).filter((s) => s.driver_id === dId);
      const aktiveTage = new Set(dShifts.map((s) => s.started_at.slice(0, 10))).size;

      const touren30 = touren;
      const km30 = Math.round(gesamtKm * 10) / 10;
      const trinkgeld30 = Math.round(trinkgeld * 100) / 100;
      const einnahmen30 = Math.round(einnahmen * 100) / 100;
      const avgRating30 = avgRating !== null ? Math.round(avgRating * 10) / 10 : null;

      const tourenProTag = aktiveTage > 0 ? Math.round((touren / aktiveTage) * 10) / 10 : 0;
      const kmProTour = touren > 0 ? Math.round((gesamtKm / touren) * 10) / 10 : 0;
      const lieferungenGesamt = gesamtStopps;

      return {
        driverId: dId,
        name,
        aktiveTage,
        touren30,
        lieferungenGesamt,
        km30,
        trinkgeld30,
        einnahmen30,
        avgRating30,
        ratingAnzahl: dRatings.length,
        tourenProTag,
        kmProTour,
      };
    });

    result.sort((a, b) => b.touren30 - a.touren30);

    return NextResponse.json({ ok: true, fahrer: result, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('fahrer-monats-statistik error:', err);
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 });
  }
}
