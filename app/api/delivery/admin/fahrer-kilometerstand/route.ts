/**
 * GET /api/delivery/admin/fahrer-kilometerstand?location_id=<uuid>
 *
 * Phase 2259 — Fahrer-Kilometerstand-API
 * Gesamt-km je Fahrer heute; Ø km je Tour; Trend vs. Vorwoche; Alert wenn >120 km/Tag; Multi-Tenant; Supabase+Mock.
 *
 * Response: { location_id, fahrer: FahrerKilometerstand[], team_gesamt_km, team_avg_km_tour, alert_count, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerKilometerstand {
  fahrer_id: string;
  fahrer_name: string;
  gesamt_km: number;
  touren_heute: number;
  avg_km_tour: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  kosten_schaetzung: number;
  rang: number;
}

export interface FahrerKilometerstandAntwort {
  location_id: string;
  fahrer: FahrerKilometerstand[];
  team_gesamt_km: number;
  team_avg_km_tour: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(km: number): Ampel {
  if (km < 80) return 'gruen';
  if (km < 120) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, vorwoche: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - vorwoche) * 10) / 10;
  if (delta > 5) return { trend: 'steigend', delta };
  if (delta < -5) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const KM_PREIS = 0.30;

const MOCK_FAHRER: Omit<FahrerKilometerstand, 'rang'>[] = [
  {
    fahrer_id: 'mock-f1',
    fahrer_name: 'Max Müller',
    gesamt_km: 67.4,
    touren_heute: 8,
    avg_km_tour: 8.4,
    trend: 'stabil',
    trend_delta: 1.2,
    ampel: 'gruen',
    kosten_schaetzung: 67.4 * KM_PREIS,
  },
  {
    fahrer_id: 'mock-f2',
    fahrer_name: 'Sara Koch',
    gesamt_km: 95.2,
    touren_heute: 11,
    avg_km_tour: 8.7,
    trend: 'steigend',
    trend_delta: 12.3,
    ampel: 'gelb',
    kosten_schaetzung: 95.2 * KM_PREIS,
  },
  {
    fahrer_id: 'mock-f3',
    fahrer_name: 'Tim Becker',
    gesamt_km: 134.8,
    touren_heute: 14,
    avg_km_tour: 9.6,
    trend: 'steigend',
    trend_delta: 18.5,
    ampel: 'rot',
    kosten_schaetzung: 134.8 * KM_PREIS,
  },
  {
    fahrer_id: 'mock-f4',
    fahrer_name: 'Lisa Fuchs',
    gesamt_km: 52.1,
    touren_heute: 6,
    avg_km_tour: 8.7,
    trend: 'fallend',
    trend_delta: -8.2,
    ampel: 'gruen',
    kosten_schaetzung: 52.1 * KM_PREIS,
  },
  {
    fahrer_id: 'mock-f5',
    fahrer_name: 'Jonas Weber',
    gesamt_km: 113.7,
    touren_heute: 13,
    avg_km_tour: 8.7,
    trend: 'stabil',
    trend_delta: 2.1,
    ampel: 'gelb',
    kosten_schaetzung: 113.7 * KM_PREIS,
  },
];

function mockResponse(locationId: string): FahrerKilometerstandAntwort {
  const sorted = [...MOCK_FAHRER].sort((a, b) => b.gesamt_km - a.gesamt_km);
  const fahrer: FahrerKilometerstand[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
  const team_gesamt_km = Math.round(fahrer.reduce((s, f) => s + f.gesamt_km, 0) * 10) / 10;
  const total_touren = fahrer.reduce((s, f) => s + f.touren_heute, 0);
  const team_avg_km_tour = total_touren > 0
    ? Math.round((team_gesamt_km / total_touren) * 10) / 10
    : 0;
  const alert_count = fahrer.filter(f => f.ampel === 'rot').length;
  return { location_id: locationId, fahrer, team_gesamt_km, team_avg_km_tour, alert_count, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? '';

  try {
    const sb = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekIso = lastWeek.toISOString();

    // Fetch driver GPS tracks or batch records for km data
    const { data: drivers } = await sb
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', locationId)
      .eq('kann_ausliefern', true)
      .eq('aktiv', true);

    if (!drivers || drivers.length === 0) {
      return NextResponse.json(mockResponse(locationId));
    }

    // Try to fetch km data from delivery_batches or gps_tracks
    const { data: batches } = await sb
      .from('delivery_batches')
      .select('fahrer_id, distanz_km, created_at')
      .eq('location_id', locationId)
      .gte('created_at', todayIso)
      .not('fahrer_id', 'is', null);

    if (!batches || batches.length === 0) {
      return NextResponse.json(mockResponse(locationId));
    }

    const { data: batchesVorwoche } = await sb
      .from('delivery_batches')
      .select('fahrer_id, distanz_km, created_at')
      .eq('location_id', locationId)
      .gte('created_at', lastWeekIso)
      .lt('created_at', todayIso)
      .not('fahrer_id', 'is', null);

    const todayKmMap = new Map<string, { km: number; tours: number }>();
    for (const b of batches) {
      if (!b.fahrer_id) continue;
      const entry = todayKmMap.get(b.fahrer_id) ?? { km: 0, tours: 0 };
      entry.km += b.distanz_km ?? 0;
      entry.tours += 1;
      todayKmMap.set(b.fahrer_id, entry);
    }

    const vorwocheKmMap = new Map<string, number>();
    for (const b of (batchesVorwoche ?? [])) {
      if (!b.fahrer_id) continue;
      vorwocheKmMap.set(b.fahrer_id, (vorwocheKmMap.get(b.fahrer_id) ?? 0) + (b.distanz_km ?? 0));
    }

    const driverList: Omit<FahrerKilometerstand, 'rang'>[] = drivers
      .filter(d => todayKmMap.has(d.id))
      .map(d => {
        const { km, tours } = todayKmMap.get(d.id)!;
        const kmVorwoche = vorwocheKmMap.get(d.id) ?? 0;
        const { trend, delta } = trendVon(km, kmVorwoche);
        const roundedKm = Math.round(km * 10) / 10;
        return {
          fahrer_id: d.id,
          fahrer_name: `${d.vorname} ${d.nachname[0]}.`,
          gesamt_km: roundedKm,
          touren_heute: tours,
          avg_km_tour: tours > 0 ? Math.round((km / tours) * 10) / 10 : 0,
          trend,
          trend_delta: delta,
          ampel: ampelVon(roundedKm),
          kosten_schaetzung: Math.round(roundedKm * KM_PREIS * 100) / 100,
        };
      });

    if (driverList.length === 0) {
      return NextResponse.json(mockResponse(locationId));
    }

    const sorted = driverList.sort((a, b) => b.gesamt_km - a.gesamt_km);
    const fahrer: FahrerKilometerstand[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    const team_gesamt_km = Math.round(fahrer.reduce((s, f) => s + f.gesamt_km, 0) * 10) / 10;
    const total_touren = fahrer.reduce((s, f) => s + f.touren_heute, 0);
    const team_avg_km_tour = total_touren > 0
      ? Math.round((team_gesamt_km / total_touren) * 10) / 10
      : 0;
    const alert_count = fahrer.filter(f => f.ampel === 'rot').length;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_gesamt_km,
      team_avg_km_tour,
      alert_count,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerKilometerstandAntwort);
  } catch {
    return NextResponse.json(mockResponse(locationId));
  }
}
