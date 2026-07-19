/**
 * GET /api/delivery/admin/fahrer-liefervolumen-trend?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2584 — Fahrer-Liefervolumen-Trend
 * Abgeschlossene Lieferungen heute + 7-Tage-Sparkline je Fahrer;
 * Ampel grün(≥15)/gelb(10–14)/rot(<10); Alert <10; Trend vs. gestern;
 * driver_id-Modus; Multi-Tenant; Supabase(delivery_tours)+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TARGET    = 15;
const ALERT_CNT = 10;
const GRUEN_CNT = 15;

export type AmpelLV = 'gruen' | 'gelb' | 'rot';
export type TrendLV = 'steigend' | 'fallend' | 'stabil';

export interface SparkDayLV {
  datum: string;
  lieferungen: number;
}

export interface FahrerLiefervolumenEntry {
  fahrer_id: string;
  fahrer_name: string;
  lieferungen_heute: number;
  lieferungen_gestern: number | null;
  lieferungen_vw: number | null;
  sparkline: SparkDayLV[];
  trend: TrendLV;
  trend_delta: number;
  ampel: AmpelLV;
  alert: boolean;
}

export interface FahrerLiefervolumenAntwort {
  location_id: string;
  fahrer: FahrerLiefervolumenEntry[];
  fahrer_single?: FahrerLiefervolumenEntry;
  team_avg_heute: number;
  team_avg_gestern: number | null;
  ziel: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(n: number): AmpelLV {
  if (n >= GRUEN_CNT) return 'gruen';
  if (n >= ALERT_CNT) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number | null): { trend: TrendLV; delta: number } {
  if (gestern === null) return { trend: 'stabil', delta: 0 };
  const delta = heute - gestern;
  if (delta >= 2)  return { trend: 'steigend', delta };
  if (delta <= -2) return { trend: 'fallend',  delta };
  return { trend: 'stabil', delta };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const MOCK_FAHRER: FahrerLiefervolumenEntry[] = [
  {
    fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',
    lieferungen_heute: 18, lieferungen_gestern: 16, lieferungen_vw: 15,
    sparkline: [14,15,16,17,15,16,18].map((v, i) => ({ datum: `07-${13 + i}`, lieferungen: v })),
    trend: 'steigend', trend_delta: 2, ampel: 'gruen', alert: false,
  },
  {
    fahrer_id: 'mock-f2', fahrer_name: 'Sarah König',
    lieferungen_heute: 7, lieferungen_gestern: 9, lieferungen_vw: 11,
    sparkline: [12,11,10,9,8,9,7].map((v, i) => ({ datum: `07-${13 + i}`, lieferungen: v })),
    trend: 'fallend', trend_delta: -2, ampel: 'rot', alert: true,
  },
  {
    fahrer_id: 'mock-f3', fahrer_name: 'Lena Schneider',
    lieferungen_heute: 12, lieferungen_gestern: 13, lieferungen_vw: 12,
    sparkline: [11,12,13,12,14,13,12].map((v, i) => ({ datum: `07-${13 + i}`, lieferungen: v })),
    trend: 'stabil', trend_delta: -1, ampel: 'gelb', alert: false,
  },
  {
    fahrer_id: 'mock-f4', fahrer_name: 'Tom Becker',
    lieferungen_heute: 20, lieferungen_gestern: 18, lieferungen_vw: 17,
    sparkline: [15,16,18,17,19,18,20].map((v, i) => ({ datum: `07-${13 + i}`, lieferungen: v })),
    trend: 'steigend', trend_delta: 2, ampel: 'gruen', alert: false,
  },
  {
    fahrer_id: 'mock-f5', fahrer_name: 'Jana Fischer',
    lieferungen_heute: 8, lieferungen_gestern: 10, lieferungen_vw: 13,
    sparkline: [14,13,12,10,9,10,8].map((v, i) => ({ datum: `07-${13 + i}`, lieferungen: v })),
    trend: 'fallend', trend_delta: -2, ampel: 'rot', alert: true,
  },
];

function mockAntwort(locationId: string, driverId?: string | null): FahrerLiefervolumenAntwort {
  const alertCount = MOCK_FAHRER.filter(f => f.alert).length;
  const teamAvg    = Math.round(MOCK_FAHRER.reduce((s, f) => s + f.lieferungen_heute, 0) / MOCK_FAHRER.length * 10) / 10;
  const teamGestern = Math.round(MOCK_FAHRER.reduce((s, f) => s + (f.lieferungen_gestern ?? 0), 0) / MOCK_FAHRER.length * 10) / 10;
  const base: FahrerLiefervolumenAntwort = {
    location_id: locationId,
    fahrer: MOCK_FAHRER,
    team_avg_heute: teamAvg,
    team_avg_gestern: teamGestern,
    ziel: TARGET,
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

    const now = new Date();
    const days: { label: string; start: Date; end: Date }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end   = new Date(d); end.setHours(23, 59, 59, 999);
      days.push({ label: formatDate(start), start, end });
    }

    const { data: employeesRaw } = await supabase
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', locationId)
      .eq('role', 'fahrer');

    const employees = (employeesRaw ?? []) as { id: string; vorname: string; nachname: string }[];
    if (!employees.length) return NextResponse.json(mockAntwort(locationId, driverId));

    const ids = employees.map(e => e.id);

    const { data: toursRaw } = await supabase
      .from('delivery_tours')
      .select('driver_id, status, delivered_at')
      .in('driver_id', ids)
      .eq('location_id', locationId)
      .eq('status', 'delivered')
      .gte('delivered_at', days[0].start.toISOString())
      .lte('delivered_at', days[6].end.toISOString());

    type TourRow = { driver_id: string; status: string; delivered_at: string };
    const tours = (toursRaw ?? []) as TourRow[];

    const fahrer: FahrerLiefervolumenEntry[] = employees.map(emp => {
      const mine = tours.filter(t => t.driver_id === emp.id);

      const sparkline: SparkDayLV[] = days.map(day => {
        const count = mine.filter(t => {
          const d = new Date(t.delivered_at);
          return d >= day.start && d <= day.end;
        }).length;
        return { datum: day.label, lieferungen: count };
      });

      const heute   = sparkline[6].lieferungen;
      const gestern = sparkline[5].lieferungen;
      const { trend, delta } = trendVon(heute, gestern);
      const ampel   = ampelVon(heute);

      return {
        fahrer_id: emp.id,
        fahrer_name: `${emp.vorname} ${emp.nachname}`,
        lieferungen_heute: heute,
        lieferungen_gestern: gestern,
        lieferungen_vw: sparkline[0].lieferungen,
        sparkline,
        trend,
        trend_delta: delta,
        ampel,
        alert: ampel === 'rot',
      };
    });

    const alertCount  = fahrer.filter(f => f.alert).length;
    const teamAvg     = fahrer.length > 0
      ? Math.round(fahrer.reduce((s, f) => s + f.lieferungen_heute, 0) / fahrer.length * 10) / 10
      : 0;
    const teamGestern = fahrer.length > 0
      ? Math.round(fahrer.reduce((s, f) => s + (f.lieferungen_gestern ?? 0), 0) / fahrer.length * 10) / 10
      : null;

    const antwort: FahrerLiefervolumenAntwort = {
      location_id: locationId,
      fahrer,
      team_avg_heute: teamAvg,
      team_avg_gestern: teamGestern,
      ziel: TARGET,
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
