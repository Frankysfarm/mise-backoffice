/**
 * GET /api/delivery/admin/fahrer-ueberstunden?location_id=<uuid>[&driver_id=<uuid>]
 *
 * Phase 2445 — Fahrer-Überstunden-API
 * Schichtdauer je Fahrer heute in Stunden.
 * Ampel grün(<8h)/gelb(8–10h)/rot(>10h); Alert >10h; Trend vs. Vorwoche; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';
export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerUeberstunden {
  fahrer_id: string;
  fahrer_name: string;
  schicht_stunden: number;
  ampel: Ampel;
  trend: Trend;
  trend_delta: number;
  vw_stunden: number;
  rang: number;
}

export interface UeberstundenAntwort {
  location_id: string;
  fahrer: FahrerUeberstunden[];
  team_durchschnitt: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(h: number): Ampel {
  if (h < 8) return 'gruen';
  if (h <= 10) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, vorwoche: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - vorwoche) * 10) / 10;
  if (delta > 0.5) return { trend: 'steigend', delta };
  if (delta < -0.5) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER = [
  { fahrer_id: 'mock-f1', fahrer_name: 'Max Müller', stunden: 6.5, vw_stunden: 7.0 },
  { fahrer_id: 'mock-f2', fahrer_name: 'Sara Koch', stunden: 8.2, vw_stunden: 7.8 },
  { fahrer_id: 'mock-f3', fahrer_name: 'Tim Weber', stunden: 9.5, vw_stunden: 8.5 },
  { fahrer_id: 'mock-f4', fahrer_name: 'Anna Bauer', stunden: 11.3, vw_stunden: 9.0 },
];

function buildMock(locationId: string): UeberstundenAntwort {
  const unsorted = MOCK_FAHRER.map(f => {
    const { trend, delta } = trendVon(f.stunden, f.vw_stunden);
    return {
      fahrer_id: f.fahrer_id,
      fahrer_name: f.fahrer_name,
      schicht_stunden: f.stunden,
      ampel: ampelVon(f.stunden),
      trend,
      trend_delta: delta,
      vw_stunden: f.vw_stunden,
    };
  });
  const sorted = [...unsorted].sort((a, b) => b.schicht_stunden - a.schicht_stunden);
  const fahrer: FahrerUeberstunden[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
  const team_durchschnitt =
    Math.round((fahrer.reduce((s, f) => s + f.schicht_stunden, 0) / fahrer.length) * 10) / 10;
  return {
    location_id: locationId,
    fahrer,
    team_durchschnitt,
    alert_count: fahrer.filter(f => f.schicht_stunden > 10).length,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const jetzt = new Date();
    const heuteStart = new Date(jetzt);
    heuteStart.setHours(0, 0, 0, 0);
    const vwStart = new Date(heuteStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const vwEnd = new Date(heuteStart.getTime() - 6 * 24 * 60 * 60 * 1000);

    const { data: drivers, error: dErr } = await sb
      .from('drivers')
      .select('id, full_name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers || drivers.length === 0) return NextResponse.json(buildMock(locationId));

    type Driver = { id: string; full_name: string | null };

    const unsorted = await Promise.all(
      (drivers as Driver[]).map(async (d) => {
        const { data: shiftsHeute } = await sb
          .from('driver_shifts')
          .select('started_at, ended_at')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('started_at', heuteStart.toISOString());

        type ShiftRow = { started_at: string | null; ended_at: string | null };
        const rowsHeute = (shiftsHeute as ShiftRow[] | null) ?? [];
        const stunden_heute = rowsHeute.reduce((sum, s) => {
          if (!s.started_at) return sum;
          const start = new Date(s.started_at).getTime();
          const end = s.ended_at ? new Date(s.ended_at).getTime() : jetzt.getTime();
          return sum + (end - start) / 3_600_000;
        }, 0);
        const stunden_gerundet = Math.round(stunden_heute * 10) / 10;

        const { data: shiftsVW } = await sb
          .from('driver_shifts')
          .select('started_at, ended_at')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('started_at', vwStart.toISOString())
          .lt('started_at', vwEnd.toISOString());

        const rowsVW = (shiftsVW as ShiftRow[] | null) ?? [];
        const stunden_vw = rowsVW.reduce((sum, s) => {
          if (!s.started_at || !s.ended_at) return sum;
          return sum + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 3_600_000;
        }, 0);
        const vw_gerundet = rowsVW.length > 0 ? Math.round(stunden_vw * 10) / 10 : stunden_gerundet;

        const { trend, delta } = trendVon(stunden_gerundet, vw_gerundet);

        return {
          fahrer_id: d.id,
          fahrer_name: d.full_name ?? 'Fahrer',
          schicht_stunden: stunden_gerundet,
          ampel: ampelVon(stunden_gerundet),
          trend,
          trend_delta: delta,
          vw_stunden: vw_gerundet,
        };
      })
    );

    const sorted = [...unsorted].sort((a, b) => b.schicht_stunden - a.schicht_stunden);
    const fahrer: FahrerUeberstunden[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    const team_durchschnitt =
      fahrer.length > 0
        ? Math.round((fahrer.reduce((s, f) => s + f.schicht_stunden, 0) / fahrer.length) * 10) / 10
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_durchschnitt,
      alert_count: fahrer.filter(f => f.schicht_stunden > 10).length,
      generiert_am: jetzt.toISOString(),
    } satisfies UeberstundenAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
