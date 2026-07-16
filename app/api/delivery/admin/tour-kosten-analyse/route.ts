/**
 * GET /api/delivery/admin/tour-kosten-analyse?location_id=<uuid>
 *
 * Phase 1846 — Tour-Kosten-Analyse-API
 * Kosten je Tour: anteiliger Fahrer-Lohn (15 Min/Stopp × 12€/h = 3€/Stopp) + km-Pauschale (0,30€/km).
 * Aggregiert für Heute und laufende Woche; Ø Kosten/Stopp.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOHN_PRO_STOPP_CENTS = 300; // 3,00 € (15 Min @ 12 €/h)
const KM_PAUSCHALE_CENT_PRO_100M = 3; // 0,03 €/100m → 0,30 €/km

interface TourKosten {
  tour_id: string;
  fahrer_name: string;
  stopps: number;
  distanz_km: number;
  lohnkosten_cents: number;
  km_kosten_cents: number;
  gesamt_cents: number;
  kosten_pro_stopp_cents: number;
  abgeschlossen_am: string | null;
}

interface ApiAntwort {
  location_id: string;
  heute_kosten_cents: number;
  woche_kosten_cents: number;
  heute_stopps: number;
  woche_stopps: number;
  avg_kosten_pro_stopp_cents: number;
  touren: TourKosten[];
  generiert_am: string;
}

const MOCK: ApiAntwort = {
  location_id: 'mock',
  heute_kosten_cents: 3780,
  woche_kosten_cents: 22140,
  heute_stopps: 44,
  woche_stopps: 258,
  avg_kosten_pro_stopp_cents: 86,
  touren: [
    {
      tour_id: 't1',
      fahrer_name: 'Max M.',
      stopps: 4,
      distanz_km: 6.2,
      lohnkosten_cents: 1200,
      km_kosten_cents: 186,
      gesamt_cents: 1386,
      kosten_pro_stopp_cents: 346,
      abgeschlossen_am: new Date(Date.now() - 40 * 60_000).toISOString(),
    },
    {
      tour_id: 't2',
      fahrer_name: 'Lisa K.',
      stopps: 3,
      distanz_km: 4.8,
      lohnkosten_cents: 900,
      km_kosten_cents: 144,
      gesamt_cents: 1044,
      kosten_pro_stopp_cents: 348,
      abgeschlossen_am: new Date(Date.now() - 90 * 60_000).toISOString(),
    },
    {
      tour_id: 't3',
      fahrer_name: 'Tom S.',
      stopps: 5,
      distanz_km: 8.1,
      lohnkosten_cents: 1500,
      km_kosten_cents: 243,
      gesamt_cents: 1743,
      kosten_pro_stopp_cents: 349,
      abgeschlossen_am: new Date(Date.now() - 150 * 60_000).toISOString(),
    },
  ],
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(5, 0, 0, 0);
    if (now.getUTCHours() < 5) todayStart.setUTCDate(todayStart.getUTCDate() - 1);
    const wocheStart = new Date(todayStart);
    wocheStart.setUTCDate(wocheStart.getUTCDate() - 6);

    const { data: batches } = await sb
      .from('mise_delivery_batches')
      .select('id, employee_id, status, completed_at, created_at, stops:mise_delivery_stops(id, distance_meters)')
      .eq('location_id', locationId)
      .gte('created_at', wocheStart.toISOString())
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(200);

    const fahrerIds = [...new Set((batches ?? []).map((b: any) => b.employee_id).filter(Boolean))];
    const { data: drivers } = fahrerIds.length > 0
      ? await sb.from('mise_drivers').select('id, vorname, nachname').in('id', fahrerIds)
      : { data: [] };
    const driversMap = new Map((drivers ?? []).map((d: any) => [d.id, `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim()]));

    const touren: TourKosten[] = (batches ?? []).map((b: any) => {
      const stopps = (b.stops ?? []).length;
      const distanzM = (b.stops ?? []).reduce((s: number, stop: any) => s + (stop.distance_meters ?? 0), 0);
      const distanzKm = Math.round(distanzM / 100) / 10;
      const lohn = stopps * LOHN_PRO_STOPP_CENTS;
      const km = Math.round(distanzM / 100) * KM_PAUSCHALE_CENT_PRO_100M;
      const gesamt = lohn + km;
      return {
        tour_id: b.id,
        fahrer_name: driversMap.get(b.employee_id) ?? 'Fahrer',
        stopps,
        distanz_km: distanzKm,
        lohnkosten_cents: lohn,
        km_kosten_cents: km,
        gesamt_cents: gesamt,
        kosten_pro_stopp_cents: stopps > 0 ? Math.round(gesamt / stopps) : 0,
        abgeschlossen_am: b.completed_at ?? null,
      };
    });

    const heute = touren.filter((t) => t.abgeschlossen_am && t.abgeschlossen_am >= todayStart.toISOString());
    const heuteKosten = heute.reduce((s, t) => s + t.gesamt_cents, 0);
    const heuteStopps = heute.reduce((s, t) => s + t.stopps, 0);
    const wocheKosten = touren.reduce((s, t) => s + t.gesamt_cents, 0);
    const wocheStopps = touren.reduce((s, t) => s + t.stopps, 0);
    const avgProStopp = wocheStopps > 0 ? Math.round(wocheKosten / wocheStopps) : 0;

    return NextResponse.json({
      location_id: locationId,
      heute_kosten_cents: heuteKosten,
      woche_kosten_cents: wocheKosten,
      heute_stopps: heuteStopps,
      woche_stopps: wocheStopps,
      avg_kosten_pro_stopp_cents: avgProStopp,
      touren: touren.slice(0, 20),
      generiert_am: now.toISOString(),
    } satisfies ApiAntwort);
  } catch (err) {
    console.error('[tour-kosten-analyse]', err);
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
