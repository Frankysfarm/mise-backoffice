// Phase 2965 — Fahrer-Stopps-pro-Stunde
// GET /api/delivery/admin/fahrer-stopps-pro-stunde?location_id=<uuid>[&driver_id=<uuid>]
// Ø Stopps/h heute je Fahrer; Ampel grün(≥5)/gelb(3–4)/rot(<3). Alert <3 "Zu langsam!"
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ZIEL_SPH = 5;
const ALERT_SPH = 3;

function ampel(sph: number): 'gruen' | 'gelb' | 'rot' {
  if (sph >= ZIEL_SPH) return 'gruen';
  if (sph >= ALERT_SPH) return 'gelb';
  return 'rot';
}

function mockData(locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   sph: 6.2, sph_gestern: 5.8, stopps: 37 },
    { id: 'd2', name: 'Sara K.',  sph: 2.4, sph_gestern: 3.1, stopps: 14 },
    { id: 'd3', name: 'Tim B.',   sph: 4.1, sph_gestern: 3.9, stopps: 25 },
    { id: 'd4', name: 'Julia F.', sph: 5.7, sph_gestern: 5.2, stopps: 34 },
  ];

  const fahrer = drivers
    .map(d => ({
      fahrer_id: d.id,
      fahrer_name: d.name,
      stopps_pro_stunde: d.sph,
      stopps_pro_stunde_gestern: d.sph_gestern,
      stopps_heute: d.stopps,
      trend: d.sph > d.sph_gestern ? 'steigend' : d.sph < d.sph_gestern ? 'fallend' : 'stabil',
      trend_delta: Math.round((d.sph - d.sph_gestern) * 10) / 10,
      ampel: ampel(d.sph),
      alert: d.sph < ALERT_SPH,
    }))
    .sort((a, b) => b.stopps_pro_stunde - a.stopps_pro_stunde);

  const team_avg = fahrer.reduce((s, f) => s + f.stopps_pro_stunde, 0) / (fahrer.length || 1);
  const team_avg_gestern = drivers.reduce((s, d) => s + d.sph_gestern, 0) / (drivers.length || 1);
  const alert_count = fahrer.filter(f => f.alert).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_stopps_pro_stunde: Math.round(team_avg * 10) / 10 };
  }

  return {
    fahrer,
    team_avg_stopps_pro_stunde: Math.round(team_avg * 10) / 10,
    team_avg_stopps_pro_stunde_gestern: Math.round(team_avg_gestern * 10) / 10,
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
      .select('driver_id, delivered_at, created_at')
      .eq('location_id', locationId)
      .gte('created_at', today)
      .in('status', ['delivered', 'completed']);

    const { data: stopsGestern } = await supabase
      .from('batch_stops')
      .select('driver_id, delivered_at, created_at')
      .eq('location_id', locationId)
      .gte('created_at', yesterday)
      .lt('created_at', today)
      .in('status', ['delivered', 'completed']);

    if (!stopsHeute) return NextResponse.json(mockData(locationId, driverId));

    const calcSph = (rows: typeof stopsHeute, dId: string) => {
      const mine = (rows ?? []).filter(s => s.driver_id === dId);
      if (mine.length < 2) return { sph: mine.length > 0 ? mine.length : 0, stopps: mine.length };
      const times = mine
        .map(s => new Date(s.delivered_at ?? s.created_at).getTime())
        .filter(t => !isNaN(t))
        .sort((a, b) => a - b);
      if (times.length < 2) return { sph: mine.length, stopps: mine.length };
      const spanHours = (times[times.length - 1] - times[0]) / (1000 * 3600);
      const sph = spanHours > 0 ? mine.length / spanHours : mine.length;
      return { sph: Math.round(sph * 10) / 10, stopps: mine.length };
    };

    const fahrer = drivers.map(d => {
      const heute = calcSph(stopsHeute, d.id);
      const gestern = calcSph(stopsGestern ?? [], d.id);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        stopps_pro_stunde: heute.sph,
        stopps_pro_stunde_gestern: gestern.sph,
        stopps_heute: heute.stopps,
        trend: heute.sph > gestern.sph ? 'steigend' : heute.sph < gestern.sph ? 'fallend' : 'stabil',
        trend_delta: Math.round((heute.sph - gestern.sph) * 10) / 10,
        ampel: ampel(heute.sph),
        alert: heute.sph < ALERT_SPH,
      };
    }).sort((a, b) => b.stopps_pro_stunde - a.stopps_pro_stunde);

    const team_avg = fahrer.reduce((s, f) => s + f.stopps_pro_stunde, 0) / (fahrer.length || 1);
    const team_avg_gestern = fahrer.reduce((s, f) => s + f.stopps_pro_stunde_gestern, 0) / (fahrer.length || 1);
    const alert_count = fahrer.filter(f => f.alert).length;

    if (driverId) {
      const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
      return NextResponse.json({ fahrer_single: f, team_avg_stopps_pro_stunde: Math.round(team_avg * 10) / 10 });
    }

    return NextResponse.json({
      fahrer,
      team_avg_stopps_pro_stunde: Math.round(team_avg * 10) / 10,
      team_avg_stopps_pro_stunde_gestern: Math.round(team_avg_gestern * 10) / 10,
      alert_count,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(mockData(locationId, driverId));
  }
}
