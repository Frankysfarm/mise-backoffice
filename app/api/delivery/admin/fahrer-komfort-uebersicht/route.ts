/**
 * GET /api/delivery/admin/fahrer-komfort-uebersicht?location_id=<uuid>
 *
 * Phase 1653 — Fahrer-Komfort-Score-Übersicht (Admin)
 * Aggregiert Komfort-Score (Pausen/km/Touren/Empfehlung) für alle aktiven
 * Fahrer einer Location. Supabase + Mock-Fallback. Multi-Tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FahrerKomfort {
  fahrer_id: string;
  fahrer_name: string;
  pausen_minuten: number;
  km_gesamt: number;
  tour_anzahl: number;
  komfort_score: number;
  empfehlung: 'pause' | 'weiter' | 'schicht_ende';
}

interface Response {
  fahrer: FahrerKomfort[];
  location_id: string;
  generiert_am: string;
}

function calcScore(pausen: number, km: number, touren: number): number {
  const pausenScore = Math.min(100, pausen * 2);
  const kmPenalty   = Math.min(60, km * 0.4);
  const tourPenalty = Math.min(30, touren * 3);
  return Math.max(0, Math.round(pausenScore - kmPenalty - tourPenalty));
}

function empfehlung(score: number, km: number): FahrerKomfort['empfehlung'] {
  if (score < 30 || km > 200) return 'schicht_ende';
  if (score < 55) return 'pause';
  return 'weiter';
}

function buildMock(locationId: string): Response {
  const mockDrivers = [
    { fahrer_id: 'mock-1', fahrer_name: 'Max M.',  pausen_minuten: 30, km_gesamt: 55, tour_anzahl: 6 },
    { fahrer_id: 'mock-2', fahrer_name: 'Jana K.',  pausen_minuten: 10, km_gesamt: 120, tour_anzahl: 11 },
    { fahrer_id: 'mock-3', fahrer_name: 'Tom F.',  pausen_minuten: 45, km_gesamt: 40, tour_anzahl: 4 },
  ].map((d) => {
    const komfort_score = calcScore(d.pausen_minuten, d.km_gesamt, d.tour_anzahl);
    return { ...d, komfort_score, empfehlung: empfehlung(komfort_score, d.km_gesamt) };
  });
  return { fahrer: mockDrivers, location_id: locationId, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Aktive Fahrer der Location
    const { data: drivers, error: dErr } = await (sb as any)
      .from('mise_drivers')
      .select('id, name, ist_online')
      .eq('location_id', locationId)
      .eq('ist_online', true);

    if (dErr || !drivers || drivers.length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    const fahrer: FahrerKomfort[] = await Promise.all(
      drivers.map(async (d: { id: string; name: string }) => {
        const { data: batches } = await (sb as any)
          .from('delivery_batches')
          .select('gestartet_am, abgeschlossen_am, route_km')
          .eq('driver_id', d.id)
          .not('abgeschlossen_am', 'is', null)
          .gte('gestartet_am', todayStart.toISOString());

        const batchList = batches ?? [];
        const tour_anzahl = batchList.length;
        const km_gesamt = Math.round(
          batchList.reduce((acc: number, b: { route_km?: number | null }) => acc + (b.route_km ?? 0), 0)
        );

        const sorted = [...batchList].sort((a: any, b: any) =>
          new Date(a.gestartet_am).getTime() - new Date(b.gestartet_am).getTime()
        );
        let pausen_minuten = 0;
        for (let i = 1; i < sorted.length; i++) {
          const gap = (new Date(sorted[i].gestartet_am).getTime() - new Date(sorted[i - 1].abgeschlossen_am).getTime()) / 60_000;
          if (gap >= 5 && gap <= 90) pausen_minuten += Math.round(gap);
        }

        const komfort_score = calcScore(pausen_minuten, km_gesamt, tour_anzahl);
        return {
          fahrer_id: d.id,
          fahrer_name: d.name,
          pausen_minuten,
          km_gesamt,
          tour_anzahl,
          komfort_score,
          empfehlung: empfehlung(komfort_score, km_gesamt),
        };
      })
    );

    return NextResponse.json({ fahrer, location_id: locationId, generiert_am: new Date().toISOString() } satisfies Response);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
