import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcAmpel(index: number): Ampel {
  if (index >= 80) return 'gruen';
  if (index >= 60) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta > 1) return { trend: 'steigend', delta };
  if (delta < -1) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

export interface FahrerLieferQualitaet {
  fahrer_id: string;
  fahrer_name: string;
  qualitaets_index: number;
  sub_bewertung: number;
  sub_puenktlichkeit: number;
  sub_abschlussrate: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
  rang?: number;
}

export interface FahrerLieferQualitaetResponse {
  fahrer: FahrerLieferQualitaet[];
  team_avg: number;
  alert_count: number;
  generiert_am: string;
}

function computeIndex(bewertung: number, puenktlichkeit: number, abschlussrate: number): number {
  return Math.round(bewertung * 0.4 + puenktlichkeit * 0.3 + abschlussrate * 0.3);
}

function buildMock(_locationId: string, driverId?: string): FahrerLieferQualitaetResponse & { fahrer_single?: FahrerLieferQualitaet; team_avg_single?: number } {
  const rawDrivers = [
    { id: 'd1', name: 'Max M.',    bew: 95, pue: 88, abs: 97 },
    { id: 'd2', name: 'Sara K.',   bew: 75, pue: 70, abs: 82 },
    { id: 'd3', name: 'Tim B.',    bew: 50, pue: 55, abs: 60 },
    { id: 'd4', name: 'Julia F.',  bew: 90, pue: 92, abs: 95 },
  ];

  const fahrer: FahrerLieferQualitaet[] = rawDrivers.map((d, i) => {
    const idx = computeIndex(d.bew, d.pue, d.abs);
    const prevIdx = Math.max(0, idx + (i % 2 === 0 ? -3 : 2));
    const { trend, delta } = calcTrend(idx, prevIdx);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      qualitaets_index: idx,
      sub_bewertung: d.bew,
      sub_puenktlichkeit: d.pue,
      sub_abschlussrate: d.abs,
      trend,
      trend_delta: delta,
      ampel: calcAmpel(idx),
      alert_niedrig: idx < 60,
    };
  }).sort((a, b) => b.qualitaets_index - a.qualitaets_index);

  const ranked = fahrer.map((f, i) => ({ ...f, rang: i + 1 }));
  const team_avg = Math.round(ranked.reduce((s, f) => s + f.qualitaets_index, 0) / ranked.length);
  const alert_count = ranked.filter(f => f.alert_niedrig).length;

  if (driverId) {
    const me = ranked.find(f => f.fahrer_id === driverId) ?? ranked[0];
    return { fahrer: ranked, fahrer_single: me, team_avg_single: team_avg, team_avg, alert_count, generiert_am: new Date().toISOString() };
  }

  return { fahrer: ranked, team_avg, alert_count, generiert_am: new Date().toISOString() };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = createServiceClient();

    const { data: drivers } = await supabase
      .from('employees')
      .select('id, vorname, nachname')
      .eq('location_id', locationId)
      .eq('role', 'driver');

    if (!drivers || drivers.length === 0) return NextResponse.json(buildMock(locationId, driverId));

    const today = new Date().toISOString().slice(0, 10);

    const fahrer: FahrerLieferQualitaet[] = await Promise.all(
      drivers.map(async (d) => {
        const name = `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || `Fahrer ${d.id.slice(0, 4)}`;

        // Bewertung: avg rating from driver_ratings (0–5 → 0–100)
        const { data: ratings } = await supabase
          .from('driver_ratings')
          .select('rating')
          .eq('driver_id', d.id)
          .gte('created_at', `${today}T00:00:00Z`);
        const bewertungRaw = ratings && ratings.length > 0
          ? ratings.reduce((s, r) => s + (r.rating ?? 0), 0) / ratings.length
          : 0;
        const sub_bewertung = Math.round(Math.min(bewertungRaw / 5, 1) * 100);

        // Pünktlichkeit: deliveries within ETA window
        const { data: deliveries } = await supabase
          .from('delivery_tours')
          .select('id, actual_delivery_at, estimated_delivery_at')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('created_at', `${today}T00:00:00Z`)
          .not('actual_delivery_at', 'is', null);
        const total = deliveries?.length ?? 0;
        const onTime = deliveries?.filter(t => {
          if (!t.estimated_delivery_at || !t.actual_delivery_at) return false;
          return new Date(t.actual_delivery_at) <= new Date(new Date(t.estimated_delivery_at).getTime() + 5 * 60 * 1000);
        }).length ?? 0;
        const sub_puenktlichkeit = total > 0 ? Math.round((onTime / total) * 100) : 0;

        // Abschlussrate: completed tours vs. total assigned
        const { data: batches } = await supabase
          .from('mise_delivery_batches')
          .select('id, status')
          .eq('driver_id', d.id)
          .eq('location_id', locationId)
          .gte('created_at', `${today}T00:00:00Z`);
        const batchTotal     = batches?.length ?? 0;
        const batchCompleted = batches?.filter(b => b.status === 'completed').length ?? 0;
        const sub_abschlussrate = batchTotal > 0 ? Math.round((batchCompleted / batchTotal) * 100) : 0;

        const qualitaets_index = computeIndex(sub_bewertung, sub_puenktlichkeit, sub_abschlussrate);

        // Yesterday's index for trend
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        const { data: prevRatings } = await supabase
          .from('driver_ratings')
          .select('rating')
          .eq('driver_id', d.id)
          .gte('created_at', `${yesterday}T00:00:00Z`)
          .lt('created_at', `${today}T00:00:00Z`);
        const prevBewRaw = prevRatings && prevRatings.length > 0
          ? prevRatings.reduce((s, r) => s + (r.rating ?? 0), 0) / prevRatings.length : bewertungRaw;
        const prevIdx = computeIndex(Math.round(Math.min(prevBewRaw / 5, 1) * 100), sub_puenktlichkeit, sub_abschlussrate);
        const { trend, delta } = calcTrend(qualitaets_index, prevIdx);

        return {
          fahrer_id: d.id,
          fahrer_name: name,
          qualitaets_index,
          sub_bewertung,
          sub_puenktlichkeit,
          sub_abschlussrate,
          trend,
          trend_delta: delta,
          ampel: calcAmpel(qualitaets_index),
          alert_niedrig: qualitaets_index < 60,
        };
      })
    );

    const sorted = [...fahrer].sort((a, b) => b.qualitaets_index - a.qualitaets_index);
    const ranked = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    const filtered = driverId ? ranked.filter(f => f.fahrer_id === driverId) : ranked;
    const team_avg = Math.round(ranked.reduce((s, f) => s + f.qualitaets_index, 0) / ranked.length);
    const alert_count = ranked.filter(f => f.alert_niedrig).length;

    if (driverId) {
      const me = ranked.find(f => f.fahrer_id === driverId) ?? ranked[0];
      return NextResponse.json({ fahrer: filtered, fahrer_single: me, team_avg, alert_count, generiert_am: new Date().toISOString() });
    }

    return NextResponse.json({ fahrer: ranked, team_avg, alert_count, generiert_am: new Date().toISOString() });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
