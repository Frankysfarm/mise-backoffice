/**
 * GET /api/delivery/admin/fahrer-schicht-kpi?location_id=<uuid>
 *
 * Phase 2296 — Fahrer-Schicht-KPI-API
 * Schichtdauer heute je Fahrer; Ø km/Schicht; Touren/Schicht;
 * Kosten-Schätzung (km × 0,30€ + Stunden × Mindestlohn 12,82€);
 * Alert wenn Schicht >10h; Multi-Tenant; Supabase+Mock.
 *
 * Response: { location_id, fahrer, team_avg_stunden, alert_count, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KM_SATZ = 0.3;
const MINDESTLOHN = 12.82;

export type AmpelSchicht = 'gruen' | 'gelb' | 'rot';
export type TrendSchicht = 'steigend' | 'fallend' | 'stabil';

export interface FahrerSchichtKpi {
  fahrer_id: string;
  fahrer_name: string;
  schicht_stunden: number;
  touren_anzahl: number;
  km_gesamt: number;
  km_pro_tour: number;
  kosten_km: number;
  kosten_stunden: number;
  kosten_gesamt: number;
  schicht_stunden_vorwoche: number | null;
  trend: TrendSchicht;
  trend_delta: number;
  ampel: AmpelSchicht;
  rang: number;
}

export interface FahrerSchichtKpiAntwort {
  location_id: string;
  fahrer: FahrerSchichtKpi[];
  team_avg_stunden: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(stunden: number): AmpelSchicht {
  if (stunden >= 10) return 'rot';
  if (stunden >= 8) return 'gelb';
  return 'gruen';
}

function trendVon(
  heute: number,
  vorwoche: number | null
): { trend: TrendSchicht; delta: number } {
  if (vorwoche === null || vorwoche === 0) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - vorwoche) * 10) / 10;
  if (delta > 0.3) return { trend: 'steigend', delta };
  if (delta < -0.3) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: Omit<FahrerSchichtKpi, 'rang'>[] = [
  {
    fahrer_id: 'mock-f1',
    fahrer_name: 'Max Müller',
    schicht_stunden: 7.5,
    touren_anzahl: 8,
    km_gesamt: 48,
    km_pro_tour: 6,
    kosten_km: 14.4,
    kosten_stunden: 96.15,
    kosten_gesamt: 110.55,
    schicht_stunden_vorwoche: 7.2,
    trend: 'steigend',
    trend_delta: 0.3,
    ampel: 'gruen',
  },
  {
    fahrer_id: 'mock-f2',
    fahrer_name: 'Sara Koch',
    schicht_stunden: 9.2,
    touren_anzahl: 10,
    km_gesamt: 65,
    km_pro_tour: 6.5,
    kosten_km: 19.5,
    kosten_stunden: 117.94,
    kosten_gesamt: 137.44,
    schicht_stunden_vorwoche: 8.8,
    trend: 'steigend',
    trend_delta: 0.4,
    ampel: 'gelb',
  },
  {
    fahrer_id: 'mock-f3',
    fahrer_name: 'Tim Becker',
    schicht_stunden: 11.5,
    touren_anzahl: 9,
    km_gesamt: 72,
    km_pro_tour: 8,
    kosten_km: 21.6,
    kosten_stunden: 147.43,
    kosten_gesamt: 169.03,
    schicht_stunden_vorwoche: 10.8,
    trend: 'steigend',
    trend_delta: 0.7,
    ampel: 'rot',
  },
  {
    fahrer_id: 'mock-f4',
    fahrer_name: 'Lisa Fuchs',
    schicht_stunden: 6.0,
    touren_anzahl: 7,
    km_gesamt: 38,
    km_pro_tour: 5.4,
    kosten_km: 11.4,
    kosten_stunden: 76.92,
    kosten_gesamt: 88.32,
    schicht_stunden_vorwoche: 6.2,
    trend: 'fallend',
    trend_delta: -0.2,
    ampel: 'gruen',
  },
];

function buildMock(locationId: string): FahrerSchichtKpiAntwort {
  const sorted = [...MOCK_FAHRER].sort((a, b) => b.schicht_stunden - a.schicht_stunden);
  const fahrerListe: FahrerSchichtKpi[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
  const team_avg_stunden =
    Math.round(
      (fahrerListe.reduce((s, f) => s + f.schicht_stunden, 0) / fahrerListe.length) * 10
    ) / 10;
  return {
    location_id: locationId,
    fahrer: fahrerListe,
    team_avg_stunden,
    alert_count: fahrerListe.filter((f) => f.ampel === 'rot').length,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const { data: drivers, error: driversErr } = await sb
      .from('mise_drivers')
      .select('id, full_name')
      .eq('location_id', locationId);

    if (driversErr || !drivers || drivers.length === 0) throw new Error('no_drivers');

    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString().slice(0, 10);
    const weekAgoEnd = new Date(Date.now() - 6 * 24 * 3600_000).toISOString().slice(0, 10);

    const [{ data: schichten }, { data: schichtenVorwoche }, { data: touren }] =
      await Promise.all([
        sb
          .from('mise_driver_shifts')
          .select('driver_id, started_at, ended_at')
          .eq('location_id', locationId)
          .gte('started_at', `${today}T00:00:00`),
        sb
          .from('mise_driver_shifts')
          .select('driver_id, started_at, ended_at')
          .eq('location_id', locationId)
          .gte('started_at', `${weekAgo}T00:00:00`)
          .lt('started_at', `${weekAgoEnd}T00:00:00`),
        sb
          .from('mise_delivery_batches')
          .select('driver_id, order_count, distance_km')
          .eq('location_id', locationId)
          .eq('status', 'completed')
          .gte('created_at', `${today}T00:00:00`),
      ]);

    const fahrerListe: Omit<FahrerSchichtKpi, 'rang'>[] = (
      drivers as { id: string; full_name: string | null }[]
    ).map((d) => {
      const shift = (schichten ?? []).find((s) => s.driver_id === d.id);
      let schicht_stunden = 0;
      if (shift) {
        const start = new Date(shift.started_at as string).getTime();
        const end = shift.ended_at
          ? new Date(shift.ended_at as string).getTime()
          : Date.now();
        schicht_stunden = Math.max(0, Math.round(((end - start) / 3_600_000) * 10) / 10);
      }

      const meineTours = (touren ?? []).filter((t) => t.driver_id === d.id);
      const touren_anzahl = meineTours.length;
      const km_gesamt = Math.round(
        meineTours.reduce(
          (s, t) => s + ((t.distance_km as number | null) ?? 5),
          0
        ) * 10
      ) / 10;
      const km_pro_tour =
        touren_anzahl > 0 ? Math.round((km_gesamt / touren_anzahl) * 10) / 10 : 0;
      const kosten_km = Math.round(km_gesamt * KM_SATZ * 100) / 100;
      const kosten_stunden = Math.round(schicht_stunden * MINDESTLOHN * 100) / 100;
      const kosten_gesamt = Math.round((kosten_km + kosten_stunden) * 100) / 100;

      const shiftVw = (schichtenVorwoche ?? []).find((s) => s.driver_id === d.id);
      let schicht_stunden_vorwoche: number | null = null;
      if (shiftVw) {
        const start = new Date(shiftVw.started_at as string).getTime();
        const end = shiftVw.ended_at
          ? new Date(shiftVw.ended_at as string).getTime()
          : start + 8 * 3_600_000;
        schicht_stunden_vorwoche =
          Math.max(0, Math.round(((end - start) / 3_600_000) * 10) / 10);
      }

      const { trend, delta } = trendVon(schicht_stunden, schicht_stunden_vorwoche);

      return {
        fahrer_id: d.id,
        fahrer_name: d.full_name ?? 'Fahrer',
        schicht_stunden,
        touren_anzahl,
        km_gesamt,
        km_pro_tour,
        kosten_km,
        kosten_stunden,
        kosten_gesamt,
        schicht_stunden_vorwoche,
        trend,
        trend_delta: delta,
        ampel: ampelVon(schicht_stunden),
      };
    });

    const aktive = fahrerListe.filter((f) => f.schicht_stunden > 0);
    const sorted = [...aktive].sort((a, b) => b.schicht_stunden - a.schicht_stunden);
    const ranked: FahrerSchichtKpi[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));

    if (ranked.length === 0) throw new Error('no_active_drivers');

    const team_avg_stunden =
      Math.round(
        (ranked.reduce((s, f) => s + f.schicht_stunden, 0) / ranked.length) * 10
      ) / 10;

    return NextResponse.json({
      location_id: locationId,
      fahrer: ranked,
      team_avg_stunden,
      alert_count: ranked.filter((f) => f.ampel === 'rot').length,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerSchichtKpiAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
