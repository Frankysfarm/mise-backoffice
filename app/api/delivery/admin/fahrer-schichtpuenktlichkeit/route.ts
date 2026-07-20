/**
 * GET /api/delivery/admin/fahrer-schichtpuenktlichkeit?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2646 — Fahrer-Schichtpünktlichkeit
 * Ø Verspätung am Schichtbeginn je Fahrer heute in Min.
 * Ampel grün(≤2)/gelb(3–10)/rot(>10); Alert >10 Min; Trend vs. gestern; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerSchichtPuenktlichkeit {
  fahrer_id: string;
  fahrer_name: string;
  verspaetung_min: number;
  schichten_heute: number;
  ampel: Ampel;
  trend: Trend;
  trend_delta: number;
  rang: number;
}

export interface SchichtPuenktlichkeitAntwort {
  location_id: string;
  fahrer: FahrerSchichtPuenktlichkeit[];
  team_durchschnitt: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(min: number): Ampel {
  if (min <= 2) return 'gruen';
  if (min <= 10) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, gestern: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - gestern) * 10) / 10;
  if (delta > 0.5)  return { trend: 'steigend', delta };
  if (delta < -0.5) return { trend: 'fallend',  delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller',  verspaetung_min: 1.5, schichten_heute: 1, gestern_min: 2.0 },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sara Koch',   verspaetung_min: 5.0, schichten_heute: 1, gestern_min: 3.5 },
  { fahrer_id: 'mock-f3', fahrer_name: 'Tim Weber',   verspaetung_min: 14.0, schichten_heute: 1, gestern_min: 8.0 },
  { fahrer_id: 'mock-f4', fahrer_name: 'Anna Bauer',  verspaetung_min: 3.0, schichten_heute: 1, gestern_min: 4.0 },
];

function buildMock(locationId: string) {
  const fahrer: FahrerSchichtPuenktlichkeit[] = [...MOCK_FAHRER]
    .sort((a, b) => a.verspaetung_min - b.verspaetung_min)
    .map((f, i) => {
      const { trend, delta } = trendVon(f.verspaetung_min, f.gestern_min);
      return {
        fahrer_id: f.fahrer_id,
        fahrer_name: f.fahrer_name,
        verspaetung_min: f.verspaetung_min,
        schichten_heute: f.schichten_heute,
        ampel: ampelVon(f.verspaetung_min),
        trend,
        trend_delta: delta,
        rang: i + 1,
      };
    });
  const team_durchschnitt =
    Math.round((fahrer.reduce((s, f) => s + f.verspaetung_min, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.verspaetung_min > 10).length;
  return {
    location_id: locationId,
    fahrer,
    team_durchschnitt,
    alert_count,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const driverId = searchParams.get('driver_id');

  try {
    const sb = await createClient();
    const jetzt = new Date();
    const heuteStart = new Date(jetzt);
    heuteStart.setHours(0, 0, 0, 0);
    const gesternStart = new Date(heuteStart.getTime() - 24 * 60 * 60 * 1000);
    const gesternEnd   = new Date(heuteStart.getTime());

    const { data: drivers, error: dErr } = await sb
      .from('drivers')
      .select('id, full_name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers || drivers.length === 0) {
      const mock = buildMock(locationId);
      if (driverId) {
        const me = mock.fahrer.find(f => f.fahrer_id === driverId);
        return NextResponse.json({ ...mock, fahrer: me ? [me] : mock.fahrer });
      }
      return NextResponse.json(mock);
    }

    type Driver = { id: string; full_name: string | null };
    type ShiftRow = { planned_start: string | null; actual_start: string | null };

    const unsorted: Omit<FahrerSchichtPuenktlichkeit, 'rang'>[] = await Promise.all(
      (drivers as Driver[]).map(async (d) => {
        const { data: shiftsHeute } = await sb
          .from('driver_shifts')
          .select('planned_start, actual_start')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('planned_start', heuteStart.toISOString())
          .not('actual_start', 'is', null);

        const validHeute = ((shiftsHeute as ShiftRow[] | null) ?? []).filter(
          s => s.planned_start && s.actual_start,
        );
        const avgHeute =
          validHeute.length > 0
            ? validHeute.reduce((sum, s) => {
                const diff =
                  (new Date(s.actual_start!).getTime() - new Date(s.planned_start!).getTime()) /
                  60000;
                return sum + Math.max(0, diff);
              }, 0) / validHeute.length
            : 2.0;

        const { data: shiftsGestern } = await sb
          .from('driver_shifts')
          .select('planned_start, actual_start')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('planned_start', gesternStart.toISOString())
          .lt('planned_start',  gesternEnd.toISOString())
          .not('actual_start', 'is', null);

        const validGestern = ((shiftsGestern as ShiftRow[] | null) ?? []).filter(
          s => s.planned_start && s.actual_start,
        );
        const avgGestern =
          validGestern.length > 0
            ? validGestern.reduce((sum, s) => {
                const diff =
                  (new Date(s.actual_start!).getTime() - new Date(s.planned_start!).getTime()) /
                  60000;
                return sum + Math.max(0, diff);
              }, 0) / validGestern.length
            : avgHeute;

        const verspaetung_min = Math.round(avgHeute * 10) / 10;
        const { trend, delta } = trendVon(verspaetung_min, Math.round(avgGestern * 10) / 10);

        return {
          fahrer_id: d.id,
          fahrer_name: d.full_name ?? 'Fahrer',
          verspaetung_min,
          schichten_heute: validHeute.length,
          ampel: ampelVon(verspaetung_min),
          trend,
          trend_delta: delta,
        };
      })
    );

    const sorted = [...unsorted].sort((a, b) => a.verspaetung_min - b.verspaetung_min);
    const fahrer: FahrerSchichtPuenktlichkeit[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    const team_durchschnitt =
      fahrer.length > 0
        ? Math.round((fahrer.reduce((s, f) => s + f.verspaetung_min, 0) / fahrer.length) * 10) / 10
        : 0;
    const alert_count = fahrer.filter(f => f.verspaetung_min > 10).length;

    const result = { location_id: locationId, fahrer, team_durchschnitt, alert_count, generiert_am: jetzt.toISOString() };

    if (driverId) {
      const me = fahrer.find(f => f.fahrer_id === driverId);
      return NextResponse.json({ ...result, fahrer: me ? [me] : fahrer });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
