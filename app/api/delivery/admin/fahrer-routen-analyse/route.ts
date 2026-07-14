/**
 * GET /api/delivery/admin/fahrer-routen-analyse?location_id=<uuid>
 *
 * Phase 1425 — Fahrer-Routen-Analyse (Admin)
 * Aggregierte Routen-KPIs je Fahrer der letzten 14 Tage:
 *   • Ø km/Stopp, Gesamtkm, Stopps gesamt
 *   • Häufigste Zone (A/B/C/D)
 *   • Optimierungspotenzial (hoch/mittel/niedrig)
 * Supabase mise_delivery_stops + mise_delivery_batches + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Potential = 'hoch' | 'mittel' | 'niedrig';

interface FahrerRoutenKpi {
  fahrer_id: string;
  name: string;
  km_gesamt: number;
  stopps_gesamt: number;
  km_pro_stopp: number;
  haeufigste_zone: string;
  optimierungspotenzial: Potential;
}

interface RoutenAnalyseResponse {
  fahrer: FahrerRoutenKpi[];
  gesamt_km: number;
  gesamt_stopps: number;
  ø_km_pro_stopp: number;
  generiert_am: string;
}

function buildMock(): RoutenAnalyseResponse {
  const fahrer: FahrerRoutenKpi[] = [
    { fahrer_id: 'f1', name: 'Max M.',   km_gesamt: 312, stopps_gesamt: 87,  km_pro_stopp: 3.6, haeufigste_zone: 'A', optimierungspotenzial: 'niedrig' },
    { fahrer_id: 'f2', name: 'Jana K.',  km_gesamt: 287, stopps_gesamt: 68,  km_pro_stopp: 4.2, haeufigste_zone: 'B', optimierungspotenzial: 'mittel'  },
    { fahrer_id: 'f3', name: 'Tom H.',   km_gesamt: 398, stopps_gesamt: 79,  km_pro_stopp: 5.0, haeufigste_zone: 'C', optimierungspotenzial: 'hoch'    },
    { fahrer_id: 'f4', name: 'Sara L.',  km_gesamt: 241, stopps_gesamt: 72,  km_pro_stopp: 3.3, haeufigste_zone: 'A', optimierungspotenzial: 'niedrig' },
  ];
  const gesamt_km    = fahrer.reduce((s, f) => s + f.km_gesamt, 0);
  const gesamt_stopps = fahrer.reduce((s, f) => s + f.stopps_gesamt, 0);
  return { fahrer, gesamt_km, gesamt_stopps, ø_km_pro_stopp: gesamt_stopps > 0 ? +(gesamt_km / gesamt_stopps).toFixed(2) : 0, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: batches, error } = await (sb as any)
      .from('mise_delivery_batches')
      .select('id, fahrer_id, total_distance_km, employees(vorname, nachname)')
      .eq('location_id', locationId)
      .gte('created_at', since14d)
      .eq('status', 'abgeschlossen');

    const { data: stops } = await (sb as any)
      .from('mise_delivery_stops')
      .select('batch_id, delivery_zone')
      .eq('location_id', locationId)
      .gte('created_at', since14d);

    if (error || !batches) return NextResponse.json(buildMock());

    const stopsByBatch = new Map<string, string[]>();
    for (const s of (stops ?? []) as { batch_id: string; delivery_zone: string | null }[]) {
      const arr = stopsByBatch.get(s.batch_id) ?? [];
      arr.push(s.delivery_zone ?? 'A');
      stopsByBatch.set(s.batch_id, arr);
    }

    const fahrerMap = new Map<string, { name: string; km: number; stopps: number; zones: string[] }>();
    for (const b of batches as { id: string; fahrer_id: string | null; total_distance_km: number | null; employees: { vorname: string; nachname: string } | null }[]) {
      if (!b.fahrer_id) continue;
      const name = b.employees ? `${b.employees.vorname} ${b.employees.nachname.charAt(0)}.` : b.fahrer_id.slice(0, 6);
      const km   = b.total_distance_km ?? 0;
      const bStops = stopsByBatch.get(b.id) ?? [];
      const entry = fahrerMap.get(b.fahrer_id) ?? { name, km: 0, stopps: 0, zones: [] };
      entry.km     += km;
      entry.stopps += bStops.length || 1;
      entry.zones.push(...bStops);
      fahrerMap.set(b.fahrer_id, entry);
    }

    const fahrer: FahrerRoutenKpi[] = [...fahrerMap.entries()].map(([id, v]) => {
      const kmProStopp = v.stopps > 0 ? +(v.km / v.stopps).toFixed(2) : 0;
      const zoneCount: Record<string, number> = {};
      for (const z of v.zones) zoneCount[z] = (zoneCount[z] ?? 0) + 1;
      const haeufigsteZone = Object.entries(zoneCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'A';
      const potential: Potential = kmProStopp > 4.5 ? 'hoch' : kmProStopp > 3.5 ? 'mittel' : 'niedrig';
      return { fahrer_id: id, name: v.name, km_gesamt: +v.km.toFixed(1), stopps_gesamt: v.stopps, km_pro_stopp: kmProStopp, haeufigste_zone: haeufigsteZone, optimierungspotenzial: potential };
    }).sort((a, b) => b.km_pro_stopp - a.km_pro_stopp);

    const gesamt_km     = fahrer.reduce((s, f) => s + f.km_gesamt, 0);
    const gesamt_stopps = fahrer.reduce((s, f) => s + f.stopps_gesamt, 0);

    return NextResponse.json({
      fahrer,
      gesamt_km:      +gesamt_km.toFixed(1),
      gesamt_stopps,
      ø_km_pro_stopp: gesamt_stopps > 0 ? +(gesamt_km / gesamt_stopps).toFixed(2) : 0,
      generiert_am:   new Date().toISOString(),
    } satisfies RoutenAnalyseResponse);
  } catch {
    return NextResponse.json(buildMock());
  }
}
