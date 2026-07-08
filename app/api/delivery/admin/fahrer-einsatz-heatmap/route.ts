/**
 * GET /api/delivery/admin/fahrer-einsatz-heatmap?location_id=<uuid>
 *
 * Phase 848 — Fahrer-Einsatz-Heatmap-API
 * 24h-Heatmap: welche Stunden welche Fahrer am aktivsten waren (letzte 7 Tage).
 * Basis für optimale Schichtplanung.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
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
  const seit7d = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();

  const { data: drivers } = await sb
    .from('drivers')
    .select('id, name')
    .eq('location_id', locationId);

  if (!drivers || drivers.length === 0) {
    return NextResponse.json({ drivers: [], matrix: {}, generatedAt: new Date().toISOString() });
  }

  const { data: batches } = await sb
    .from('delivery_batches')
    .select('driver_id, created_at')
    .eq('location_id', locationId)
    .gte('created_at', seit7d)
    .not('driver_id', 'is', null);

  // Baue Matrix: driver_id → [h0..h23]
  const matrix: Record<string, number[]> = {};
  for (const d of drivers) {
    matrix[d.id] = Array(24).fill(0);
  }

  for (const b of batches ?? []) {
    if (!b.driver_id || !matrix[b.driver_id]) continue;
    const h = new Date(b.created_at as string).getUTCHours();
    matrix[b.driver_id][h]++;
  }

  // Nur Fahrer mit mindestens einem Einsatz zurückgeben
  const activeDrivers = drivers.filter(d => matrix[d.id].some(v => v > 0));

  return NextResponse.json({
    drivers: activeDrivers,
    matrix: Object.fromEntries(activeDrivers.map(d => [d.id, matrix[d.id]])),
    generatedAt: new Date().toISOString(),
  });
}
