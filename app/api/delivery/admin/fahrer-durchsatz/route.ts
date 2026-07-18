/**
 * GET /api/delivery/admin/fahrer-durchsatz?location_id=<uuid>
 *
 * Phase 2291 — Fahrer-Bestellungs-Durchsatz-API
 * Bestellungen je Stunde (B/h) je Fahrer heute; Trend vs. Vorwoche;
 * Alert wenn Team-Ø <2 B/h; Ampel; Multi-Tenant; Supabase+Mock.
 *
 * Response: { location_id, fahrer, team_avg_bph, alert_count, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type AmpelBph = 'gruen' | 'gelb' | 'rot';
export type TrendBph = 'steigend' | 'fallend' | 'stabil';

export interface FahrerDurchsatz {
  fahrer_id: string;
  fahrer_name: string;
  bph: number;
  bestellungen_heute: number;
  stunden_aktiv: number;
  bph_vorwoche: number | null;
  trend: TrendBph;
  trend_delta: number;
  ampel: AmpelBph;
  rang: number;
}

export interface FahrerDurchsatzAntwort {
  location_id: string;
  fahrer: FahrerDurchsatz[];
  team_avg_bph: number;
  alert_count: number;
  generiert_am: string;
}

function ampelVon(bph: number): AmpelBph {
  if (bph >= 4) return 'gruen';
  if (bph >= 2) return 'gelb';
  return 'rot';
}

function trendVon(heute: number, vorwoche: number | null): { trend: TrendBph; delta: number } {
  if (vorwoche === null || vorwoche === 0) return { trend: 'stabil', delta: 0 };
  const delta = Math.round((heute - vorwoche) * 10) / 10;
  if (delta > 0.3) return { trend: 'steigend', delta };
  if (delta < -0.3) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

const MOCK_FAHRER: Omit<FahrerDurchsatz, 'rang'>[] = [
  {
    fahrer_id: 'mock-f1',
    fahrer_name: 'Max Müller',
    bph: 5.2,
    bestellungen_heute: 21,
    stunden_aktiv: 4.0,
    bph_vorwoche: 4.8,
    trend: 'steigend',
    trend_delta: 0.4,
    ampel: 'gruen',
  },
  {
    fahrer_id: 'mock-f2',
    fahrer_name: 'Sara Koch',
    bph: 3.8,
    bestellungen_heute: 15,
    stunden_aktiv: 3.9,
    bph_vorwoche: 3.9,
    trend: 'stabil',
    trend_delta: -0.1,
    ampel: 'gelb',
  },
  {
    fahrer_id: 'mock-f3',
    fahrer_name: 'Tim Becker',
    bph: 1.6,
    bestellungen_heute: 6,
    stunden_aktiv: 3.8,
    bph_vorwoche: 2.4,
    trend: 'fallend',
    trend_delta: -0.8,
    ampel: 'rot',
  },
  {
    fahrer_id: 'mock-f4',
    fahrer_name: 'Lisa Fuchs',
    bph: 4.5,
    bestellungen_heute: 18,
    stunden_aktiv: 4.0,
    bph_vorwoche: 4.2,
    trend: 'steigend',
    trend_delta: 0.3,
    ampel: 'gruen',
  },
];

function buildMock(locationId: string): FahrerDurchsatzAntwort {
  const sorted = [...MOCK_FAHRER].sort((a, b) => b.bph - a.bph);
  const fahrerListe: FahrerDurchsatz[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
  const team_avg_bph =
    Math.round(
      (fahrerListe.reduce((s, f) => s + f.bph, 0) / fahrerListe.length) * 10
    ) / 10;
  return {
    location_id: locationId,
    fahrer: fahrerListe,
    team_avg_bph,
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

    const [{ data: batchesToday }, { data: batchesVorwoche }, { data: schichten }] =
      await Promise.all([
        sb
          .from('mise_delivery_batches')
          .select('driver_id, order_count, created_at')
          .eq('location_id', locationId)
          .eq('status', 'completed')
          .gte('created_at', `${today}T00:00:00`),
        sb
          .from('mise_delivery_batches')
          .select('driver_id, order_count')
          .eq('location_id', locationId)
          .eq('status', 'completed')
          .gte('created_at', `${weekAgo}T00:00:00`)
          .lt('created_at', `${weekAgoEnd}T00:00:00`),
        sb
          .from('mise_driver_shifts')
          .select('driver_id, started_at, ended_at')
          .eq('location_id', locationId)
          .gte('started_at', `${today}T00:00:00`),
      ]);

    const fahrerListe: Omit<FahrerDurchsatz, 'rang'>[] = (
      drivers as { id: string; full_name: string | null }[]
    ).map((d) => {
      const mine = (batchesToday ?? []).filter((b) => b.driver_id === d.id);
      const bestellungen_heute = mine.reduce(
        (s, b) => s + ((b.order_count as number | null) ?? 1),
        0
      );

      const shift = (schichten ?? []).find((s) => s.driver_id === d.id);
      let stunden_aktiv = 0;
      if (shift) {
        const start = new Date(shift.started_at as string).getTime();
        const end = shift.ended_at
          ? new Date(shift.ended_at as string).getTime()
          : Date.now();
        stunden_aktiv = Math.max(0, Math.round(((end - start) / 3_600_000) * 10) / 10);
      } else if (mine.length > 0) {
        stunden_aktiv = 4;
      }

      const bph =
        stunden_aktiv > 0
          ? Math.round((bestellungen_heute / stunden_aktiv) * 10) / 10
          : 0;

      const vw = (batchesVorwoche ?? []).filter((b) => b.driver_id === d.id);
      const bph_vorwoche =
        vw.length > 0
          ? Math.round(
              (vw.reduce((s, b) => s + ((b.order_count as number | null) ?? 1), 0) / 4) *
                10
            ) / 10
          : null;

      const { trend, delta } = trendVon(bph, bph_vorwoche);

      return {
        fahrer_id: d.id,
        fahrer_name: d.full_name ?? 'Fahrer',
        bph,
        bestellungen_heute,
        stunden_aktiv,
        bph_vorwoche,
        trend,
        trend_delta: delta,
        ampel: ampelVon(bph),
      };
    });

    const aktive = fahrerListe.filter((f) => f.bph > 0);
    const sorted = [...aktive].sort((a, b) => b.bph - a.bph);
    const ranked: FahrerDurchsatz[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));

    if (ranked.length === 0) throw new Error('no_active_drivers');

    const team_avg_bph =
      Math.round((ranked.reduce((s, f) => s + f.bph, 0) / ranked.length) * 10) / 10;

    return NextResponse.json({
      location_id: locationId,
      fahrer: ranked,
      team_avg_bph,
      alert_count: ranked.filter((f) => f.ampel === 'rot').length,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerDurchsatzAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
