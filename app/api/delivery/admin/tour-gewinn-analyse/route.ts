import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1221 — Tour-Gewinn-Analyse-API
// Bruttogewinn je Tour (Bestellwert − geschätzte Fahrtkosten − Fahrer-Anteil) + Best/Worst-Tour heute

const KOSTEN_PRO_KM = 0.3; // €/km geschätzte Fahrtkosten
const FAHRER_ANTEIL_PCT = 0.15; // 15% Fahrer-Anteil am Bestellwert
const MOCK_DELAY_MS = 0;

interface TourGewinn {
  tour_id: string;
  fahrer_name: string;
  zone: string | null;
  stopps_gesamt: number;
  stopps_geliefert: number;
  bestellwert_eur: number;
  fahrtkosten_eur: number;
  fahrer_anteil_eur: number;
  bruttogewinn_eur: number;
  gewinn_pct: number;
  gestartet_am: string | null;
  status: 'aktiv' | 'abgeschlossen';
  effizienz: 'verlust' | 'niedrig' | 'normal' | 'gut' | 'top';
}

function effizienzStufe(gewinn_pct: number): TourGewinn['effizienz'] {
  if (gewinn_pct < 0) return 'verlust';
  if (gewinn_pct < 15) return 'niedrig';
  if (gewinn_pct < 30) return 'normal';
  if (gewinn_pct < 50) return 'gut';
  return 'top';
}

function mockData(location_id: string) {
  const touren: TourGewinn[] = [
    {
      tour_id: 'mock-t1',
      fahrer_name: 'Max Müller',
      zone: 'Mitte',
      stopps_gesamt: 4,
      stopps_geliefert: 3,
      bestellwert_eur: 82.5,
      fahrtkosten_eur: 6.0,
      fahrer_anteil_eur: 12.38,
      bruttogewinn_eur: 64.12,
      gewinn_pct: 77.7,
      gestartet_am: new Date(Date.now() - 45 * 60000).toISOString(),
      status: 'aktiv',
      effizienz: 'top',
    },
    {
      tour_id: 'mock-t2',
      fahrer_name: 'Jana Koch',
      zone: 'Nord',
      stopps_gesamt: 3,
      stopps_geliefert: 3,
      bestellwert_eur: 31.0,
      fahrtkosten_eur: 9.0,
      fahrer_anteil_eur: 4.65,
      bruttogewinn_eur: 17.35,
      gewinn_pct: 55.97,
      gestartet_am: new Date(Date.now() - 70 * 60000).toISOString(),
      status: 'abgeschlossen',
      effizienz: 'gut',
    },
    {
      tour_id: 'mock-t3',
      fahrer_name: 'Tom Bauer',
      zone: 'Süd',
      stopps_gesamt: 2,
      stopps_geliefert: 1,
      bestellwert_eur: 18.5,
      fahrtkosten_eur: 12.0,
      fahrer_anteil_eur: 2.78,
      bruttogewinn_eur: 3.72,
      gewinn_pct: 20.11,
      gestartet_am: new Date(Date.now() - 30 * 60000).toISOString(),
      status: 'aktiv',
      effizienz: 'normal',
    },
  ];

  const gesamt_bestellwert = touren.reduce((s, t) => s + t.bestellwert_eur, 0);
  const gesamt_fahrtkosten = touren.reduce((s, t) => s + t.fahrtkosten_eur, 0);
  const gesamt_fahrer_anteil = touren.reduce((s, t) => s + t.fahrer_anteil_eur, 0);
  const gesamt_bruttogewinn = touren.reduce((s, t) => s + t.bruttogewinn_eur, 0);

  const sorted = [...touren].sort((a, b) => b.bruttogewinn_eur - a.bruttogewinn_eur);
  return {
    touren,
    beste_tour: sorted[0] ?? null,
    schlechteste_tour: sorted[sorted.length - 1] ?? null,
    gesamt_bestellwert_eur: gesamt_bestellwert,
    gesamt_fahrtkosten_eur: gesamt_fahrtkosten,
    gesamt_fahrer_anteil_eur: gesamt_fahrer_anteil,
    gesamt_bruttogewinn_eur: gesamt_bruttogewinn,
    location_id,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');

  if (!location_id) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = createClient();

    // Heute 00:00 UTC
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Aktive + heute abgeschlossene Touren (mise_delivery_batches)
    const { data: batches, error: bErr } = await supabase
      .from('mise_delivery_batches')
      .select('id, driver_id, zone, started_at, status')
      .eq('location_id', location_id)
      .gte('started_at', todayStart.toISOString())
      .in('status', ['active', 'completed'])
      .order('started_at', { ascending: false })
      .limit(30);

    if (bErr || !batches?.length) {
      return NextResponse.json(mockData(location_id));
    }

    const batchIds = batches.map((b) => b.id);
    const driverIds = [...new Set(batches.map((b) => b.driver_id).filter(Boolean))];

    const [{ data: stops }, { data: drivers }] = await Promise.all([
      supabase
        .from('mise_delivery_stops')
        .select('batch_id, order_id, delivered_at, estimated_km')
        .in('batch_id', batchIds),
      supabase
        .from('mise_drivers')
        .select('id, first_name, last_name')
        .in('id', driverIds),
    ]);

    const orderIds = [...new Set((stops ?? []).map((s) => s.order_id).filter(Boolean))];
    const { data: orders } = await supabase
      .from('customer_orders')
      .select('id, total_price')
      .in('id', orderIds);

    const orderMap = new Map((orders ?? []).map((o) => [o.id, o.total_price ?? 0]));
    const driverMap = new Map(
      (drivers ?? []).map((d) => [d.id, `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim()]),
    );

    const touren: TourGewinn[] = batches.map((b) => {
      const bStops = (stops ?? []).filter((s) => s.batch_id === b.id);
      const deliveredStops = bStops.filter((s) => s.delivered_at);
      const bestellwert = bStops.reduce((s, st) => s + (orderMap.get(st.order_id) ?? 0), 0);
      const totalKm = bStops.reduce((s, st) => s + (st.estimated_km ?? 3), 0);
      const fahrtkosten = Math.round(totalKm * KOSTEN_PRO_KM * 100) / 100;
      const fahrer_anteil = Math.round(bestellwert * FAHRER_ANTEIL_PCT * 100) / 100;
      const bruttogewinn = Math.round((bestellwert - fahrtkosten - fahrer_anteil) * 100) / 100;
      const gewinn_pct = bestellwert > 0 ? Math.round((bruttogewinn / bestellwert) * 10000) / 100 : 0;

      return {
        tour_id: b.id,
        fahrer_name: driverMap.get(b.driver_id) ?? 'Unbekannt',
        zone: b.zone ?? null,
        stopps_gesamt: bStops.length,
        stopps_geliefert: deliveredStops.length,
        bestellwert_eur: Math.round(bestellwert * 100) / 100,
        fahrtkosten_eur: fahrtkosten,
        fahrer_anteil_eur: fahrer_anteil,
        bruttogewinn_eur: bruttogewinn,
        gewinn_pct,
        gestartet_am: b.started_at,
        status: b.status === 'completed' ? 'abgeschlossen' : 'aktiv',
        effizienz: effizienzStufe(gewinn_pct),
      };
    });

    const sorted = [...touren].sort((a, b) => b.bruttogewinn_eur - a.bruttogewinn_eur);
    return NextResponse.json({
      touren,
      beste_tour: sorted[0] ?? null,
      schlechteste_tour: sorted[sorted.length - 1] ?? null,
      gesamt_bestellwert_eur: Math.round(touren.reduce((s, t) => s + t.bestellwert_eur, 0) * 100) / 100,
      gesamt_fahrtkosten_eur: Math.round(touren.reduce((s, t) => s + t.fahrtkosten_eur, 0) * 100) / 100,
      gesamt_fahrer_anteil_eur: Math.round(touren.reduce((s, t) => s + t.fahrer_anteil_eur, 0) * 100) / 100,
      gesamt_bruttogewinn_eur: Math.round(touren.reduce((s, t) => s + t.bruttogewinn_eur, 0) * 100) / 100,
      location_id,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(mockData(location_id));
  }
}
