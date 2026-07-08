/**
 * GET /api/delivery/admin/fahrer-auslastungs-score?location_id=<uuid>
 *
 * Fahrer-Auslastungs-Score 0-100% für alle aktiven Fahrer der heutigen Schicht.
 * Score = min(100, (touren_heute / 8) × 100)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('location_id');
  if (fromQuery) return fromQuery;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();

  const todayStart = new Date();
  todayStart.setUTCHours(5, 0, 0, 0);
  if (todayStart > new Date()) todayStart.setUTCDate(todayStart.getUTCDate() - 1);

  // Fetch today's batches with driver info
  const { data: batches } = await sb
    .from('delivery_batches')
    .select('driver_id, status, distance_km, created_at')
    .eq('location_id', locationId)
    .gte('created_at', todayStart.toISOString())
    .not('driver_id', 'is', null);

  if (!batches || batches.length === 0) {
    return NextResponse.json({ fahrer: [] });
  }

  // Get unique driver IDs
  const driverIds = [...new Set(batches.map((b) => b.driver_id as string))];

  // Fetch driver names
  const { data: driverRows } = await sb
    .from('drivers')
    .select('id, name')
    .in('id', driverIds);

  const nameMap: Record<string, string> = {};
  (driverRows ?? []).forEach((d) => { nameMap[d.id] = d.name ?? d.id.slice(0, 8); });

  const fahrer = driverIds.map((driverId) => {
    const driverBatches = batches.filter((b) => b.driver_id === driverId);
    const tourenHeute = driverBatches.length;
    const tourenAktiv = driverBatches.filter((b) =>
      ['assigned', 'in_progress'].includes(b.status ?? ''),
    ).length;
    const kmHeute = driverBatches.reduce((s, b) => s + (b.distance_km ?? 0), 0);
    const score = Math.min(100, Math.round((tourenHeute / 8) * 100));

    return {
      driver_id: driverId,
      name: nameMap[driverId] ?? driverId.slice(0, 8),
      score,
      touren_heute: tourenHeute,
      touren_aktiv: tourenAktiv,
      km_heute: Math.round(kmHeute * 10) / 10,
    };
  });

  // Sort by score descending
  fahrer.sort((a, b) => b.score - a.score);

  return NextResponse.json({ fahrer });
}
