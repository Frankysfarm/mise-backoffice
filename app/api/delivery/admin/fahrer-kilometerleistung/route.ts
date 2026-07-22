/**
 * Phase 3280 — Fahrer-Kilometerleistungs-Ranking-API
 *
 * GET /api/delivery/admin/fahrer-kilometerleistung?location_id=<uuid>[&driver_id=<uuid>]
 * Gesamt-km je Fahrer heute (aus delivery_batch_stops.distance_km)
 * Rang 1 = höchste km = bester
 * Ampel: gruen (Top-25%) | gelb (Mitte-50%) | rot (Bottom-25%)
 * rank_delta positiv = verbessert; Supabase + Mock-Fallback; Multi-Tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Ampel = 'gruen' | 'gelb' | 'rot';

export interface FahrerKilometerleistung {
  fahrer_id: string;
  name: string;
  km_heute: number;
  km_gestern: number;
  rank_delta: number;
  ampel: Ampel;
  rang: number;
}

export interface FahrerKilometerleistungAntwort {
  location_id: string;
  fahrer: FahrerKilometerleistung[];
  team_durchschnitt_km: number;
  generiert_am: string;
}

function ampelVon(rang: number, total: number): Ampel {
  const pct = rang / total;
  if (pct <= 0.25) return 'gruen';
  if (pct <= 0.75) return 'gelb';
  return 'rot';
}

const MOCK_FAHRER: Omit<FahrerKilometerleistung, 'rang' | 'ampel'>[] = [
  { fahrer_id: 'mock-f1', name: 'Max Müller',   km_heute: 48.3, km_gestern: 44.1, rank_delta:  1 },
  { fahrer_id: 'mock-f2', name: 'Lena Schmidt',  km_heute: 41.7, km_gestern: 43.2, rank_delta: -1 },
  { fahrer_id: 'mock-f3', name: 'Tom Becker',    km_heute: 35.5, km_gestern: 36.0, rank_delta:  0 },
  { fahrer_id: 'mock-f4', name: 'Jana Wolf',     km_heute: 22.1, km_gestern: 28.4, rank_delta: -1 },
];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const { data: drivers, error } = await sb
      .from('profiles')
      .select('id, full_name')
      .eq('location_id', locationId)
      .eq('role', 'driver');

    if (error || !drivers || drivers.length === 0) throw new Error('no_drivers');

    const heute     = new Date();
    const heuteBeg  = new Date(heute); heuteBeg.setHours(0, 0, 0, 0);
    const gestBeg   = new Date(heuteBeg.getTime() - 24 * 60 * 60 * 1000);
    const gestEnde  = new Date(heuteBeg.getTime() - 1);

    const unsorted: Omit<FahrerKilometerleistung, 'rang' | 'ampel'>[] = await Promise.all(
      drivers.map(async (d: { id: string; full_name: string | null }) => {
        const { data: heuteStopps } = await sb
          .from('delivery_batch_stops')
          .select('distance_km')
          .eq('driver_id', d.id)
          .gte('created_at', heuteBeg.toISOString())
          .lte('created_at', heute.toISOString());

        const { data: gestStopps } = await sb
          .from('delivery_batch_stops')
          .select('distance_km')
          .eq('driver_id', d.id)
          .gte('created_at', gestBeg.toISOString())
          .lte('created_at', gestEnde.toISOString());

        const kmHeute = Math.round(
          ((heuteStopps ?? []).reduce((s: number, r: { distance_km: number | null }) => s + (r.distance_km ?? 0), 0)) * 10
        ) / 10;

        const kmGestern = Math.round(
          ((gestStopps ?? []).reduce((s: number, r: { distance_km: number | null }) => s + (r.distance_km ?? 0), 0)) * 10
        ) / 10;

        return {
          fahrer_id:   d.id,
          name:        d.full_name ?? 'Unbekannt',
          km_heute:    kmHeute,
          km_gestern:  kmGestern,
          rank_delta:  0,
        };
      })
    );

    const sorted = [...unsorted].sort((a, b) => b.km_heute - a.km_heute);
    const total  = sorted.length;

    const fahrerListe: FahrerKilometerleistung[] = sorted.map((f, i) => ({
      ...f,
      rang:        i + 1,
      ampel:       ampelVon(i + 1, total),
      rank_delta:  f.km_heute >= f.km_gestern ? 1 : -1,
    }));

    const filtered = driverId
      ? fahrerListe.filter(f => f.fahrer_id === driverId)
      : fahrerListe;

    const team_durchschnitt_km =
      fahrerListe.length > 0
        ? Math.round((fahrerListe.reduce((s, f) => s + f.km_heute, 0) / fahrerListe.length) * 10) / 10
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer:      filtered,
      team_durchschnitt_km,
      generiert_am: heute.toISOString(),
    } satisfies FahrerKilometerleistungAntwort);
  } catch {
    const total  = MOCK_FAHRER.length;
    const sorted = [...MOCK_FAHRER].sort((a, b) => b.km_heute - a.km_heute);
    const fahrerListe: FahrerKilometerleistung[] = sorted.map((f, i) => ({
      ...f,
      rang:  i + 1,
      ampel: ampelVon(i + 1, total),
    }));
    return NextResponse.json({
      location_id:          locationId,
      fahrer:               driverId ? fahrerListe.filter(f => f.fahrer_id === driverId) : fahrerListe,
      team_durchschnitt_km: Math.round((fahrerListe.reduce((s, f) => s + f.km_heute, 0) / fahrerListe.length) * 10) / 10,
      generiert_am:         new Date().toISOString(),
    } satisfies FahrerKilometerleistungAntwort);
  }
}
