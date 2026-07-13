import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1390 — Fahrer-Effizienz-Matrix-API (Admin)
// GET: Kreuztabelle Fahrer × Wochentag
// Metriken je Zelle: km/Stopp-Ratio, Pünktlichkeit %, Trinkgeld Ø
// Supabase + Mock-Fallback

const DOW_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export interface FahrerEffizienzZelle {
  fahrer_id: string;
  wochentag: number; // 0=So
  wochentag_label: string;
  km_pro_stopp: number | null;
  puenktlichkeit_pct: number | null; // % Lieferungen pünktlich (≤ eta_latest)
  trinkgeld_avg: number | null;       // Ø Trinkgeld in €
  anzahl_touren: number;
}

export interface FahrerInfo {
  id: string;
  name: string;
}

export interface FahrerEffizienzMatrixResponse {
  fahrer: FahrerInfo[];
  zellen: FahrerEffizienzZelle[];
  wochentage: { index: number; label: string }[];
  location_id: string;
  generiert_am: string;
}

function mockData(locationId: string): FahrerEffizienzMatrixResponse {
  const FAHRER: FahrerInfo[] = [
    { id: 'f1', name: 'Ahmad K.' },
    { id: 'f2', name: 'Berna S.' },
    { id: 'f3', name: 'Cédric M.' },
  ];
  const zellen: FahrerEffizienzZelle[] = [];
  const BASE_KM = [1.8, 2.2, 1.5];
  const BASE_PUENKT = [92, 85, 96];
  const BASE_TIP = [0.45, 0.62, 0.38];
  for (let dow = 0; dow < 7; dow++) {
    for (let fi = 0; fi < FAHRER.length; fi++) {
      const f = FAHRER[fi];
      // Weekend-Effekt: mehr Touren, etwas schlechtere Pünktlichkeit
      const weFaktor = dow === 0 || dow === 6 ? 1.1 : 1.0;
      const puenktlichkeit = Math.min(100, Math.round((BASE_PUENKT[fi] ?? 90) / weFaktor));
      zellen.push({
        fahrer_id: f.id,
        wochentag: dow,
        wochentag_label: DOW_LABELS[dow] ?? String(dow),
        km_pro_stopp: parseFloat(((BASE_KM[fi] ?? 2.0) * weFaktor).toFixed(2)),
        puenktlichkeit_pct: puenktlichkeit,
        trinkgeld_avg: parseFloat(((BASE_TIP[fi] ?? 0.5) * (dow === 5 || dow === 6 ? 1.2 : 1.0)).toFixed(2)),
        anzahl_touren: dow === 0 || dow === 6 ? 4 : 3,
      });
    }
  }
  return {
    fahrer: FAHRER,
    zellen,
    wochentage: DOW_LABELS.map((l, i) => ({ index: i, label: l })),
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id') ?? 'default';

  try {
    const supabase = await createClient();

    // Letzte 28 Tage
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 28);
    since.setUTCHours(0, 0, 0, 0);

    // Aktive Fahrer laden
    let driverQ = supabase
      .from('driver_profiles')
      .select('id, employee:employees(id, vorname, nachname)');
    if (locationId !== 'default') driverQ = driverQ.eq('location_id', locationId);
    const { data: drivers } = await driverQ;
    if (!drivers || drivers.length === 0) throw new Error('no drivers');

    // Touren (batches) laden
    let batchQ = supabase
      .from('delivery_batches')
      .select('id, fahrer_id, started_at, total_distance_km, stops:batch_stops(id, geliefert_am, order:customer_orders(eta_latest, trinkgeld))')
      .gte('started_at', since.toISOString())
      .not('started_at', 'is', null);
    if (locationId !== 'default') batchQ = batchQ.eq('location_id', locationId);
    const { data: batches } = await batchQ;
    if (!batches || batches.length === 0) throw new Error('no batches');

    // Aggregieren: Fahrer × Wochentag
    const buckets: Record<string, {
      km: number[]; puenktlich: boolean[]; trinkgeld: number[]; touren: Set<string>;
    }> = {};

    for (const batch of batches) {
      if (!batch.fahrer_id || !batch.started_at) continue;
      const dow = new Date(batch.started_at).getUTCDay();
      const key = `${batch.fahrer_id}_${dow}`;
      if (!buckets[key]) buckets[key] = { km: [], puenktlich: [], trinkgeld: [], touren: new Set() };
      buckets[key].touren.add(batch.id);

      const stops = (batch.stops ?? []) as Array<{
        id: string;
        geliefert_am: string | null;
        order: { eta_latest: string | null; trinkgeld: number | null } | null;
      }>;
      const stopCount = stops.length;
      if (stopCount > 0 && batch.total_distance_km != null) {
        buckets[key].km.push(batch.total_distance_km / stopCount);
      }
      for (const stop of stops) {
        if (stop.geliefert_am && stop.order?.eta_latest) {
          const onTime = new Date(stop.geliefert_am) <= new Date(stop.order.eta_latest);
          buckets[key].puenktlich.push(onTime);
        }
        if (stop.order?.trinkgeld != null) {
          buckets[key].trinkgeld.push(stop.order.trinkgeld);
        }
      }
    }

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const pct = (bools: boolean[]) => bools.length > 0 ? Math.round((bools.filter(Boolean).length / bools.length) * 100) : null;

    const fahrerList: FahrerInfo[] = (drivers as Array<{
      id: string;
      employee: { vorname: string; nachname: string } | null | Array<{ vorname: string; nachname: string }>;
    }>).map((d) => {
      const emp = Array.isArray(d.employee) ? d.employee[0] : d.employee;
      return { id: d.id, name: emp ? `${emp.vorname} ${emp.nachname}` : d.id };
    });

    const zellen: FahrerEffizienzZelle[] = [];
    for (const f of fahrerList) {
      for (let dow = 0; dow < 7; dow++) {
        const key = `${f.id}_${dow}`;
        const b = buckets[key];
        zellen.push({
          fahrer_id: f.id,
          wochentag: dow,
          wochentag_label: DOW_LABELS[dow] ?? String(dow),
          km_pro_stopp: b ? parseFloat((avg(b.km) ?? 0).toFixed(2)) : null,
          puenktlichkeit_pct: b ? pct(b.puenktlich) : null,
          trinkgeld_avg: b ? parseFloat(((avg(b.trinkgeld) ?? 0)).toFixed(2)) : null,
          anzahl_touren: b ? b.touren.size : 0,
        });
      }
    }

    return NextResponse.json({
      fahrer: fahrerList,
      zellen,
      wochentage: DOW_LABELS.map((l, i) => ({ index: i, label: l })),
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerEffizienzMatrixResponse);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
