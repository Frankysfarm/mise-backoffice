/**
 * GET /api/delivery/admin/fahrer-touren-auslastung?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2589 — Fahrer-Touren-Auslastung
 * % der verfügbaren Schichtzeit mit aktiven Touren je Fahrer heute;
 * Ampel grün(≥70%)/gelb(50–69%)/rot(<50%); Alert <50%; Trend vs. gestern;
 * driver_id-Modus; Multi-Tenant; Supabase(delivery_tours)+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ZIEL_PCT    = 70;
const ALERT_PCT   = 50;
const GRUEN_PCT   = 70;
const GELB_PCT    = 50;
const SCHICHT_MIN = 480; // 8h Standardschicht in Minuten

export type AmpelTA = 'gruen' | 'gelb' | 'rot';
export type TrendTA = 'besser' | 'schlechter' | 'stabil';

export interface FahrerTourenAuslastungEntry {
  fahrer_id: string;
  fahrer_name: string;
  auslastung_pct: number;
  auslastung_pct_gestern: number | null;
  aktive_minuten_heute: number;
  trend: TrendTA;
  trend_delta: number;
  ampel: AmpelTA;
  alert: boolean;
}

export interface FahrerTourenAuslastungAntwort {
  location_id: string;
  fahrer: FahrerTourenAuslastungEntry[];
  fahrer_single?: FahrerTourenAuslastungEntry;
  team_avg_heute: number;
  team_avg_gestern: number | null;
  ziel: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(pct: number): AmpelTA {
  if (pct >= GRUEN_PCT) return 'gruen';
  if (pct >= GELB_PCT)  return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number | null): { trend: TrendTA; delta: number } {
  if (gestern === null) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta >= 5)  return { trend: 'besser',      delta };
  if (delta <= -5) return { trend: 'schlechter',  delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: FahrerTourenAuslastungEntry[] = [
  {
    fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',
    auslastung_pct: 82, auslastung_pct_gestern: 75, aktive_minuten_heute: 394,
    trend: 'besser', trend_delta: 7, ampel: 'gruen', alert: false,
  },
  {
    fahrer_id: 'mock-f2', fahrer_name: 'Sarah König',
    auslastung_pct: 38, auslastung_pct_gestern: 55, aktive_minuten_heute: 182,
    trend: 'schlechter', trend_delta: -17, ampel: 'rot', alert: true,
  },
  {
    fahrer_id: 'mock-f3', fahrer_name: 'Lena Schneider',
    auslastung_pct: 61, auslastung_pct_gestern: 58, aktive_minuten_heute: 293,
    trend: 'stabil', trend_delta: 3, ampel: 'gelb', alert: false,
  },
  {
    fahrer_id: 'mock-f4', fahrer_name: 'Tom Becker',
    auslastung_pct: 74, auslastung_pct_gestern: 72, aktive_minuten_heute: 355,
    trend: 'stabil', trend_delta: 2, ampel: 'gruen', alert: false,
  },
  {
    fahrer_id: 'mock-f5', fahrer_name: 'Jana Fischer',
    auslastung_pct: 45, auslastung_pct_gestern: 60, aktive_minuten_heute: 216,
    trend: 'schlechter', trend_delta: -15, ampel: 'rot', alert: true,
  },
];

function mockAntwort(locationId: string, driverId?: string | null): FahrerTourenAuslastungAntwort {
  const alertCount  = MOCK_FAHRER.filter(f => f.alert).length;
  const teamAvg     = Math.round(MOCK_FAHRER.reduce((s, f) => s + f.auslastung_pct, 0) / MOCK_FAHRER.length * 10) / 10;
  const teamGestern = Math.round(MOCK_FAHRER.reduce((s, f) => s + (f.auslastung_pct_gestern ?? 0), 0) / MOCK_FAHRER.length * 10) / 10;
  const base: FahrerTourenAuslastungAntwort = {
    location_id: locationId,
    fahrer: MOCK_FAHRER,
    team_avg_heute: teamAvg,
    team_avg_gestern: teamGestern,
    ziel: ZIEL_PCT,
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

    const now      = new Date();
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

    type TourRow = {
      driver_id: string;
      started_at: string | null;
      completed_at: string | null;
      delivered_at: string | null;
    };

    const { data: toursRaw } = await supabase
      .from('delivery_tours')
      .select('driver_id, started_at, completed_at, delivered_at')
      .in('driver_id', ids)
      .eq('location_id', locationId)
      .gte('started_at', yestStart.toISOString())
      .lte('started_at', todayEnd.toISOString());

    const tours = (toursRaw ?? []) as TourRow[];

    function aktivMinuten(
      mine: TourRow[],
      rangeStart: Date,
      rangeEnd: Date,
    ): number {
      return mine.reduce((sum, t) => {
        if (!t.started_at) return sum;
        const s  = new Date(t.started_at);
        if (s < rangeStart || s > rangeEnd) return sum;
        const e  = t.completed_at
          ? new Date(t.completed_at)
          : t.delivered_at
            ? new Date(t.delivered_at)
            : rangeEnd;
        const ms = Math.max(0, e.getTime() - s.getTime());
        return sum + Math.round(ms / 60000);
      }, 0);
    }

    const fahrer: FahrerTourenAuslastungEntry[] = employees.map(emp => {
      const mine = tours.filter(t => t.driver_id === emp.id);

      const minToday = aktivMinuten(mine, todayStart, todayEnd);
      const minYest  = aktivMinuten(mine, yestStart,  yestEnd);

      const pctToday = Math.min(100, Math.round((minToday / SCHICHT_MIN) * 100));
      const pctYest  = minYest > 0 ? Math.min(100, Math.round((minYest / SCHICHT_MIN) * 100)) : null;

      const { trend, delta } = trendVon(pctToday, pctYest);
      const ampel = ampelVon(pctToday);

      return {
        fahrer_id: emp.id,
        fahrer_name: `${emp.vorname} ${emp.nachname}`,
        auslastung_pct: pctToday,
        auslastung_pct_gestern: pctYest,
        aktive_minuten_heute: minToday,
        trend,
        trend_delta: delta,
        ampel,
        alert: pctToday < ALERT_PCT,
      };
    });

    const alertCount  = fahrer.filter(f => f.alert).length;
    const teamAvg     = fahrer.length > 0
      ? Math.round(fahrer.reduce((s, f) => s + f.auslastung_pct, 0) / fahrer.length * 10) / 10
      : 0;
    const teamGestern = fahrer.length > 0 && fahrer.some(f => f.auslastung_pct_gestern !== null)
      ? Math.round(fahrer.reduce((s, f) => s + (f.auslastung_pct_gestern ?? 0), 0) / fahrer.length * 10) / 10
      : null;

    const antwort: FahrerTourenAuslastungAntwort = {
      location_id: locationId,
      fahrer,
      team_avg_heute: teamAvg,
      team_avg_gestern: teamGestern,
      ziel: ZIEL_PCT,
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
