/**
 * GET /api/delivery/admin/schicht-abschluss-zusammenfassung?location_id=<uuid>&driver_id=<uuid>
 *
 * Phase 674 (Backend) — Schicht-Abschluss-Zusammenfassung-API
 * Liefert automatische Schicht-Bilanz bei Schichtende:
 * Touren, km, Einnahmen, Score, Trinkgeld, Ø Bewertung.
 *
 * Response: { ok, zusammenfassung: Zusammenfassung | null, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');

  if (!locationId) {
    return NextResponse.json({ ok: false, error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Aktive oder heute beendete Schicht
    let shiftQuery = supabase
      .from('driver_shifts')
      .select('id, driver_id, started_at, ended_at, status')
      .eq('location_id', locationId)
      .gte('started_at', todayStart.toISOString())
      .order('started_at', { ascending: false });

    if (driverId) {
      shiftQuery = shiftQuery.eq('driver_id', driverId);
    }

    const { data: shifts } = await shiftQuery.limit(driverId ? 1 : 20);
    if (!shifts || shifts.length === 0) {
      return NextResponse.json({ ok: true, zusammenfassung: null, generatedAt: new Date().toISOString() });
    }

    // Fahrer-Info holen
    const driverIds = [...new Set(shifts.map(s => s.driver_id).filter(Boolean))] as string[];
    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, vorname, nachname, employee_id')
      .in('id', driverIds);

    const driverMap = new Map((drivers ?? []).map(d => [d.id, d]));

    // Touren heute
    const { data: batches } = await supabase
      .from('delivery_batches')
      .select('id, driver_id, started_at, delivered_at, distance_km, status, stop_count')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .in('status', ['geliefert', 'delivered', 'abgeschlossen']);

    // Orders für Trinkgeld + Bewertung
    const { data: orders } = await supabase
      .from('orders')
      .select('id, driver_id, tip_amount, rating, status')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .eq('status', 'delivered');

    const now = new Date();

    const buildZusammenfassung = (dId: string, shift: typeof shifts[0]) => {
      const driver = driverMap.get(dId);
      const name = driver ? `${driver.vorname ?? ''} ${driver.nachname ?? ''}`.trim() : 'Fahrer';

      const myBatches = (batches ?? []).filter(b => b.driver_id === dId);
      const myOrders  = (orders ?? []).filter(o => o.driver_id === dId);

      const touren    = myBatches.length;
      const lieferungen = myOrders.length;
      const kmHeute   = myBatches.reduce((s, b) => s + (b.distance_km ?? 0), 0);
      const trinkgeld = myOrders.reduce((s, o) => s + (o.tip_amount ?? 0), 0);
      const ratings   = myOrders.map(o => o.rating).filter((r): r is number => typeof r === 'number' && r > 0);
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

      const shiftStartMs = new Date(shift.started_at).getTime();
      const shiftEndMs   = shift.ended_at ? new Date(shift.ended_at).getTime() : now.getTime();
      const schichtDauerMin = Math.round((shiftEndMs - shiftStartMs) / 60_000);

      // Score 0–100: Touren/h * 60/8 (max 50) + Rating (max 30) + km-Effizienz (max 20)
      const stunden = Math.max(0.25, schichtDauerMin / 60);
      const tourRate = lieferungen / stunden; // Lieferungen/h
      const tourScore = Math.min(50, Math.round((tourRate / 8) * 50));
      const ratingScore = avgRating !== null ? Math.round(((avgRating - 1) / 4) * 30) : 15;
      const kmPerTour = touren > 0 ? kmHeute / touren : 0;
      const kmScore = Math.min(20, Math.round((1 - Math.max(0, (kmPerTour - 10) / 20)) * 20));
      const gesamtScore = Math.max(0, Math.min(100, tourScore + ratingScore + kmScore));

      const stufe = gesamtScore >= 80 ? 'top' : gesamtScore >= 60 ? 'gut' : gesamtScore >= 40 ? 'mittel' : 'niedrig';

      return {
        driverId: dId,
        name,
        schichtDauerMin,
        touren,
        lieferungen,
        kmHeute: Math.round(kmHeute * 10) / 10,
        trinkgeld: Math.round(trinkgeld * 100) / 100,
        avgRating: avgRating !== null ? Math.round(avgRating * 10) / 10 : null,
        ratingAnzahl: ratings.length,
        gesamtScore,
        stufe,
        shiftStatus: shift.status,
      };
    };

    if (driverId) {
      const shift = shifts[0];
      const zusammenfassung = buildZusammenfassung(driverId, shift);
      return NextResponse.json({ ok: true, zusammenfassung, generatedAt: new Date().toISOString() });
    }

    // Alle Fahrer dieser Location
    const allZusammenfassungen = shifts.map(s => buildZusammenfassung(s.driver_id!, s)).filter(Boolean);
    return NextResponse.json({ ok: true, zusammenfassungen: allZusammenfassungen, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('schicht-abschluss-zusammenfassung error:', err);
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 });
  }
}
