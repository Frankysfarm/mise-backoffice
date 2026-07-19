/**
 * GET /api/delivery/admin/fahrer-km-bilanz-heute?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2599 — Fahrer-km-Bilanz
 * Gefahrene km je Fahrer heute; Ampel grün(≥80 km)/gelb(50–79 km)/rot(<50 km);
 * Alert <50 km; Trend vs. gestern; driver_id-Modus; Multi-Tenant;
 * Supabase(delivery_tours.distance_km)+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ZIEL_KM  = 80;
const ALERT_KM = 50;
const GRUEN_KM = 80;
const GELB_KM  = 50;

export type AmpelKM = 'gruen' | 'gelb' | 'rot';
export type TrendKM = 'besser' | 'schlechter' | 'stabil';

export interface FahrerKmBilanzEntry {
  fahrer_id: string;
  fahrer_name: string;
  km_heute: number;
  km_gestern: number | null;
  trend: TrendKM;
  trend_delta: number;
  ampel: AmpelKM;
  alert: boolean;
}

export interface FahrerKmBilanzAntwort {
  location_id: string;
  fahrer: FahrerKmBilanzEntry[];
  fahrer_single?: FahrerKmBilanzEntry;
  team_avg_heute: number;
  team_avg_gestern: number | null;
  ziel: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(km: number): AmpelKM {
  if (km >= GRUEN_KM) return 'gruen';
  if (km >= GELB_KM)  return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number | null): { trend: TrendKM; delta: number } {
  if (gestern === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta >= 5)  return { trend: 'besser',     delta };
  if (delta <= -5) return { trend: 'schlechter', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: FahrerKmBilanzEntry[] = [
  {
    fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',
    km_heute: 97.4, km_gestern: 88.1,
    trend: 'besser', trend_delta: 9.3, ampel: 'gruen', alert: false,
  },
  {
    fahrer_id: 'mock-f2', fahrer_name: 'Sarah König',
    km_heute: 42.1, km_gestern: 61.5,
    trend: 'schlechter', trend_delta: -19.4, ampel: 'rot', alert: true,
  },
  {
    fahrer_id: 'mock-f3', fahrer_name: 'Lena Schneider',
    km_heute: 63.8, km_gestern: 65.2,
    trend: 'stabil', trend_delta: -1.4, ampel: 'gelb', alert: false,
  },
  {
    fahrer_id: 'mock-f4', fahrer_name: 'Tom Becker',
    km_heute: 84.5, km_gestern: 79.3,
    trend: 'besser', trend_delta: 5.2, ampel: 'gruen', alert: false,
  },
  {
    fahrer_id: 'mock-f5', fahrer_name: 'Jana Fischer',
    km_heute: 38.7, km_gestern: 52.0,
    trend: 'schlechter', trend_delta: -13.3, ampel: 'rot', alert: true,
  },
];

function mockAntwort(locationId: string, driverId?: string | null): FahrerKmBilanzAntwort {
  const alertCount  = MOCK_FAHRER.filter(f => f.alert).length;
  const teamAvg     = Math.round(MOCK_FAHRER.reduce((s, f) => s + f.km_heute, 0) / MOCK_FAHRER.length * 10) / 10;
  const teamGestern = Math.round(MOCK_FAHRER.reduce((s, f) => s + (f.km_gestern ?? 0), 0) / MOCK_FAHRER.length * 10) / 10;
  const base: FahrerKmBilanzAntwort = {
    location_id: locationId,
    fahrer: MOCK_FAHRER,
    team_avg_heute: teamAvg,
    team_avg_gestern: teamGestern,
    ziel: ZIEL_KM,
    alert_count: alertCount,
    generiert_am: new Date().toISOString(),
  };
  if (driverId) {
    base.fahrer_single = MOCK_FAHRER.find(f => f.fahrer_id === driverId) ?? { ...MOCK_FAHRER[0], fahrer_id: driverId };
  }
  return base;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();

    const now       = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const yestStart  = new Date(now); yestStart.setDate(now.getDate() - 1); yestStart.setHours(0, 0, 0, 0);
    const yestEnd    = new Date(now); yestEnd.setDate(now.getDate() - 1);   yestEnd.setHours(23, 59, 59, 999);

    const { data: employeesRaw } = await supabase
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', locationId)
      .eq('role', 'fahrer');

    const employees = (employeesRaw ?? []) as { id: string; vorname: string; nachname: string }[];
    if (!employees.length) return NextResponse.json(mockAntwort(locationId, driverId));

    const ids = employees.map(e => e.id);

    type TourRow = { driver_id: string; distance_km: number | null; started_at: string | null };

    const { data: toursRaw } = await supabase
      .from('delivery_tours')
      .select('driver_id, distance_km, started_at')
      .in('driver_id', ids)
      .eq('location_id', locationId)
      .gte('started_at', yestStart.toISOString())
      .lte('started_at', todayEnd.toISOString());

    const tours = (toursRaw ?? []) as TourRow[];

    const sumKm = (mine: TourRow[], rangeStart: Date, rangeEnd: Date): number =>
      mine
        .filter(t => {
          if (!t.started_at) return false;
          const s = new Date(t.started_at);
          return s >= rangeStart && s <= rangeEnd;
        })
        .reduce((sum, t) => sum + (t.distance_km ?? 0), 0);

    const fahrer: FahrerKmBilanzEntry[] = employees.map(emp => {
      const mine    = tours.filter(t => t.driver_id === emp.id);
      const kmToday = Math.round(sumKm(mine, todayStart, todayEnd) * 10) / 10;
      const kmYest  = Math.round(sumKm(mine, yestStart,  yestEnd)  * 10) / 10;
      const kmGestern = kmYest > 0 ? kmYest : null;

      const { trend, delta } = trendVon(kmToday, kmGestern);
      const ampel = ampelVon(kmToday);

      return {
        fahrer_id:   emp.id,
        fahrer_name: `${emp.vorname} ${emp.nachname}`,
        km_heute:    kmToday,
        km_gestern:  kmGestern,
        trend,
        trend_delta: delta,
        ampel,
        alert: kmToday < ALERT_KM,
      };
    });

    const alertCount  = fahrer.filter(f => f.alert).length;
    const teamAvg     = fahrer.length > 0
      ? Math.round(fahrer.reduce((s, f) => s + f.km_heute, 0) / fahrer.length * 10) / 10
      : 0;
    const teamGestern = fahrer.some(f => f.km_gestern !== null)
      ? Math.round(fahrer.reduce((s, f) => s + (f.km_gestern ?? 0), 0) / fahrer.length * 10) / 10
      : null;

    const antwort: FahrerKmBilanzAntwort = {
      location_id: locationId,
      fahrer,
      team_avg_heute: teamAvg,
      team_avg_gestern: teamGestern,
      ziel: ZIEL_KM,
      alert_count: alertCount,
      generiert_am: new Date().toISOString(),
    };
    if (driverId) {
      antwort.fahrer_single = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
    }

    return NextResponse.json(antwort);
  } catch {
    return NextResponse.json(mockAntwort(locationId, driverId));
  }
}
