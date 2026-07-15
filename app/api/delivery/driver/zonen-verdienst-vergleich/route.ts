/**
 * GET /api/delivery/driver/zonen-verdienst-vergleich?driver_id=<uuid>
 *
 * Phase 1769 — Zonen-Verdienst-Vergleich-API (Driver)
 * Ø Verdienst je Zone für diesen Fahrer letzte 7 Tage; beste Zone; Multi-Tenant; Supabase + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ZonenVerdienst {
  zone: 'A' | 'B' | 'C' | 'D';
  touren: number;
  gesamt_verdienst_eur: number;
  avg_verdienst_eur: number;
  avg_dauer_min: number;
  verdienst_pro_stunde: number;
}

export interface ZonenVerdienstAntwort {
  fahrer_id: string;
  zonen: ZonenVerdienst[];
  beste_zone: 'A' | 'B' | 'C' | 'D' | null;
  generiert_am: string;
}

function buildMock(driverId: string): ZonenVerdienstAntwort {
  const zonen: ZonenVerdienst[] = [
    { zone: 'A', touren: 22, gesamt_verdienst_eur: 198, avg_verdienst_eur: 9.0,  avg_dauer_min: 18, verdienst_pro_stunde: 30.0 },
    { zone: 'B', touren: 15, gesamt_verdienst_eur: 165, avg_verdienst_eur: 11.0, avg_dauer_min: 28, verdienst_pro_stunde: 23.6 },
    { zone: 'C', touren:  8, gesamt_verdienst_eur: 112, avg_verdienst_eur: 14.0, avg_dauer_min: 42, verdienst_pro_stunde: 20.0 },
    { zone: 'D', touren:  4, gesamt_verdienst_eur:  72, avg_verdienst_eur: 18.0, avg_dauer_min: 62, verdienst_pro_stunde: 17.4 },
  ];
  const beste_zone = zonen.reduce((best, z) => z.verdienst_pro_stunde > (best?.verdienst_pro_stunde ?? 0) ? z : best).zone;
  return { fahrer_id: driverId, zonen, beste_zone, generiert_am: new Date().toISOString() };
}

const ZONE_RADII_KM: Record<string, [number, number]> = { A: [0, 2], B: [2, 4], C: [4, 7], D: [7, 999] };

function classifyZone(distKm: number): 'A' | 'B' | 'C' | 'D' {
  for (const [zone, [min, max]] of Object.entries(ZONE_RADII_KM)) {
    if (distKm >= min && distKm < max) return zone as 'A' | 'B' | 'C' | 'D';
  }
  return 'D';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const driverId = req.nextUrl.searchParams.get('driver_id') ?? '';

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const { data: touren } = await supabase
      .from('delivery_batches')
      .select('id, fahrer_verdienst, startzeit, endzeit, delivery_distance_km')
      .eq('fahrer_id', driverId)
      .gte('startzeit', since)
      .eq('status', 'abgeschlossen');

    if (!touren || touren.length === 0) {
      return NextResponse.json(buildMock(driverId));
    }

    const acc: Record<string, { gesamt: number; dauer: number; count: number }> = { A: { gesamt: 0, dauer: 0, count: 0 }, B: { gesamt: 0, dauer: 0, count: 0 }, C: { gesamt: 0, dauer: 0, count: 0 }, D: { gesamt: 0, dauer: 0, count: 0 } };

    for (const t of touren) {
      const distKm = (t.delivery_distance_km as number) ?? 3;
      const zone = classifyZone(distKm);
      const verdienst = (t.fahrer_verdienst as number) ?? 0;
      const start = t.startzeit ? new Date(t.startzeit as string).getTime() : 0;
      const end = t.endzeit ? new Date(t.endzeit as string).getTime() : 0;
      const dauerMin = start && end ? Math.round((end - start) / 60_000) : 30;
      acc[zone].gesamt += verdienst;
      acc[zone].dauer += dauerMin;
      acc[zone].count++;
    }

    const zonen: ZonenVerdienst[] = (['A', 'B', 'C', 'D'] as const).map(zone => {
      const { gesamt, dauer, count } = acc[zone];
      const avg_dauer_min = count > 0 ? Math.round(dauer / count) : 0;
      const avg_verdienst_eur = count > 0 ? Math.round(gesamt / count * 100) / 100 : 0;
      const verdienst_pro_stunde = avg_dauer_min > 0 ? Math.round((avg_verdienst_eur / avg_dauer_min) * 60 * 100) / 100 : 0;
      return { zone, touren: count, gesamt_verdienst_eur: Math.round(gesamt * 100) / 100, avg_verdienst_eur, avg_dauer_min, verdienst_pro_stunde };
    });

    const aktiveZonen = zonen.filter(z => z.touren > 0);
    const beste_zone = aktiveZonen.length > 0
      ? aktiveZonen.reduce((best, z) => z.verdienst_pro_stunde > best.verdienst_pro_stunde ? z : best).zone
      : null;

    return NextResponse.json({ fahrer_id: driverId, zonen, beste_zone, generiert_am: new Date().toISOString() } as ZonenVerdienstAntwort);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
