import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FahrerStatus = 'online' | 'tour' | 'pause' | 'offline';

type FahrerEintrag = {
  id: string;
  name: string;
  status: FahrerStatus;
  aktuelle_tour: string | null;
  stopps_verbleibend: number | null;
  eta_min: number | null;
  zone: string | null;
  letztes_update: string;
};

function mockData() {
  const now = new Date().toISOString();
  const fahrer: FahrerEintrag[] = [
    { id: 'f1', name: 'Max Müller', status: 'tour', aktuelle_tour: 'T-2847', stopps_verbleibend: 2, eta_min: 14, zone: 'Nord', letztes_update: now },
    { id: 'f2', name: 'Lisa Berg', status: 'online', aktuelle_tour: null, stopps_verbleibend: null, eta_min: null, zone: 'Mitte', letztes_update: now },
    { id: 'f3', name: 'Tom Klein', status: 'tour', aktuelle_tour: 'T-2849', stopps_verbleibend: 1, eta_min: 7, zone: 'Süd', letztes_update: now },
    { id: 'f4', name: 'Jan Schulz', status: 'pause', aktuelle_tour: null, stopps_verbleibend: null, eta_min: null, zone: 'West', letztes_update: now },
    { id: 'f5', name: 'Anna Koch', status: 'offline', aktuelle_tour: null, stopps_verbleibend: null, eta_min: null, zone: null, letztes_update: new Date(Date.now() - 1800_000).toISOString() },
  ];
  const online = fahrer.filter(f => f.status === 'online').length;
  const tour = fahrer.filter(f => f.status === 'tour').length;
  const pause = fahrer.filter(f => f.status === 'pause').length;
  const offline = fahrer.filter(f => f.status === 'offline').length;
  const verfuegbar = online + tour;
  const score = fahrer.length > 0 ? Math.round((verfuegbar / fahrer.length) * 100) : 0;
  return { fahrer, verfuegbarkeits_score: score, online_count: online, tour_count: tour, pause_count: pause, offline_count: offline };
}

function mapDriverStatus(s: string): FahrerStatus {
  if (['delivering', 'busy'].includes(s)) return 'tour';
  if (s === 'online') return 'online';
  if (s === 'break') return 'pause';
  return 'offline';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();

    const q = supabase
      .from('mise_drivers')
      .select('id, full_name, status, location_id, delivery_zone, updated_at');
    if (locationId) q.eq('location_id', locationId);
    const { data: drivers, error } = await q;
    if (error || !drivers) throw new Error();

    const today = new Date().toISOString().slice(0, 10);
    const { data: activeBatches } = await supabase
      .from('mise_delivery_batches')
      .select('driver_id, id, stops_total, stops_completed, status')
      .in('status', ['in_progress', 'assigned', 'pickup'])
      .gte('created_at', `${today}T00:00:00`);

    const batchByDriver = new Map((activeBatches ?? []).map(b => [b.driver_id, b]));

    const fahrer: FahrerEintrag[] = drivers.map((d) => {
      const status = mapDriverStatus(d.status ?? 'offline');
      const batch = batchByDriver.get(d.id);
      return {
        id: d.id,
        name: d.full_name ?? 'Fahrer',
        status,
        aktuelle_tour: batch ? `T-${batch.id.slice(-4)}` : null,
        stopps_verbleibend: batch ? Math.max(0, (batch.stops_total ?? 0) - (batch.stops_completed ?? 0)) : null,
        eta_min: null,
        zone: d.delivery_zone ?? null,
        letztes_update: d.updated_at ?? new Date().toISOString(),
      };
    });

    const online = fahrer.filter(f => f.status === 'online').length;
    const tour = fahrer.filter(f => f.status === 'tour').length;
    const pause = fahrer.filter(f => f.status === 'pause').length;
    const offline = fahrer.filter(f => f.status === 'offline').length;
    const verfuegbar = online + tour;
    const score = fahrer.length > 0 ? Math.round((verfuegbar / fahrer.length) * 100) : 0;

    return NextResponse.json({ fahrer, verfuegbarkeits_score: score, online_count: online, tour_count: tour, pause_count: pause, offline_count: offline });
  } catch {
    return NextResponse.json(mockData());
  }
}
