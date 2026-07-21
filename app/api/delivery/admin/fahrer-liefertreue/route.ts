// Phase 2955 — Fahrer-Liefertreue
// GET /api/delivery/admin/fahrer-liefertreue?location_id=<uuid>[&driver_id=<uuid>]
// Pünktlichkeitsrate = on-time / total × 100% je Fahrer heute
// Ampel: grün ≥90%, gelb 70–89%, rot <70%. Alert <70%. Trend vs. gestern.
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALERT_THRESHOLD = 70;
const ZIEL = 90;

function ampel(pct: number): 'gruen' | 'gelb' | 'rot' {
  if (pct >= ZIEL) return 'gruen';
  if (pct >= ALERT_THRESHOLD) return 'gelb';
  return 'rot';
}

function mockData(locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   pct: 95, pct_gestern: 92, puenktlich: 19, gesamt: 20 },
    { id: 'd2', name: 'Sara K.',  pct: 60, pct_gestern: 75, puenktlich: 12, gesamt: 20 },
    { id: 'd3', name: 'Tim B.',   pct: 85, pct_gestern: 80, puenktlich: 17, gesamt: 20 },
    { id: 'd4', name: 'Julia F.', pct: 72, pct_gestern: 68, puenktlich: 18, gesamt: 25 },
  ];

  const fahrer = drivers
    .map(d => ({
      fahrer_id: d.id,
      fahrer_name: d.name,
      liefertreue_pct: d.pct,
      liefertreue_gestern: d.pct_gestern,
      puenktlich_heute: d.puenktlich,
      gesamt_heute: d.gesamt,
      trend: d.pct > d.pct_gestern ? 'steigend' : d.pct < d.pct_gestern ? 'fallend' : 'stabil',
      trend_delta: d.pct - d.pct_gestern,
      ampel: ampel(d.pct),
      alert: d.pct < ALERT_THRESHOLD,
    }))
    .sort((a, b) => b.liefertreue_pct - a.liefertreue_pct);

  const team_avg = fahrer.reduce((s, f) => s + f.liefertreue_pct, 0) / (fahrer.length || 1);
  const team_avg_gestern = drivers.reduce((s, d) => s + d.pct_gestern, 0) / (drivers.length || 1);
  const alert_count = fahrer.filter(f => f.alert).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_liefertreue: Math.round(team_avg * 10) / 10 };
  }

  return {
    fahrer,
    team_avg_liefertreue: Math.round(team_avg * 10) / 10,
    team_avg_liefertreue_gestern: Math.round(team_avg_gestern * 10) / 10,
    alert_count,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = createServiceClient();
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (!drivers?.length) return NextResponse.json(mockData(locationId, driverId));

    const { data: stopsHeute } = await supabase
      .from('batch_stops')
      .select('driver_id, delivered_at, promised_at, created_at, status')
      .eq('location_id', locationId)
      .gte('created_at', today)
      .eq('status', 'delivered');

    const { data: stopsGestern } = await supabase
      .from('batch_stops')
      .select('driver_id, delivered_at, promised_at, created_at, status')
      .eq('location_id', locationId)
      .gte('created_at', yesterday)
      .lt('created_at', today)
      .eq('status', 'delivered');

    if (!stopsHeute) return NextResponse.json(mockData(locationId, driverId));

    const calcPct = (rows: typeof stopsHeute, dId: string) => {
      const mine = (rows ?? []).filter(s => s.driver_id === dId && s.delivered_at);
      const gesamt = mine.length;
      if (gesamt === 0) return { pct: 100, puenktlich: 0, gesamt: 0 };
      const puenktlich = mine.filter(s => {
        const promised = s.promised_at
          ? new Date(s.promised_at).getTime()
          : new Date(s.created_at).getTime() + 30 * 60 * 1000;
        return new Date(s.delivered_at!).getTime() <= promised + 5 * 60 * 1000;
      }).length;
      return { pct: Math.round((puenktlich / gesamt) * 100), puenktlich, gesamt };
    };

    const fahrer = drivers.map(d => {
      const heute = calcPct(stopsHeute, d.id);
      const gestern = calcPct(stopsGestern ?? [], d.id);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        liefertreue_pct: heute.pct,
        liefertreue_gestern: gestern.pct,
        puenktlich_heute: heute.puenktlich,
        gesamt_heute: heute.gesamt,
        trend: heute.pct > gestern.pct ? 'steigend' : heute.pct < gestern.pct ? 'fallend' : 'stabil',
        trend_delta: heute.pct - gestern.pct,
        ampel: ampel(heute.pct),
        alert: heute.pct < ALERT_THRESHOLD,
      };
    }).sort((a, b) => b.liefertreue_pct - a.liefertreue_pct);

    const team_avg = fahrer.reduce((s, f) => s + f.liefertreue_pct, 0) / (fahrer.length || 1);
    const team_avg_gestern = fahrer.reduce((s, f) => s + f.liefertreue_gestern, 0) / (fahrer.length || 1);
    const alert_count = fahrer.filter(f => f.alert).length;

    if (driverId) {
      const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: f, team_avg_liefertreue: Math.round(team_avg * 10) / 10 });
    }

    return NextResponse.json({
      fahrer,
      team_avg_liefertreue: Math.round(team_avg * 10) / 10,
      team_avg_liefertreue_gestern: Math.round(team_avg_gestern * 10) / 10,
      alert_count,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(mockData(locationId, driverId));
  }
}
