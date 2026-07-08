/**
 * GET  /api/delivery/admin/fahrer-bonus-trigger?location_id=<uuid>
 * POST /api/delivery/admin/fahrer-bonus-trigger
 *      body: { driver_id, bonus_eur, reason }
 *      → Zahlt manuellen Bonus an Fahrer aus
 *
 * Phase 716 — Fahrer-Bonus-Trigger-API
 * GET: Prüft welche Fahrer das Tagesziel (8 Touren) erreicht haben und noch keinen Bonus haben.
 * POST: Fügt einen Bonus-Eintrag in driver_tips mit type='bonus' ein.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAGESZIEL_TOUREN = 8;
const BONUS_EUR = 5.0;

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
  const since = todayStart.toISOString();

  // Count completed tours per driver today
  const { data: batches } = await sb
    .from('delivery_batches')
    .select('driver_id')
    .eq('location_id', locationId)
    .eq('status', 'completed')
    .gte('created_at', since)
    .not('driver_id', 'is', null);

  const tourMap: Record<string, number> = {};
  for (const b of batches ?? []) {
    if (!b.driver_id) continue;
    tourMap[b.driver_id] = (tourMap[b.driver_id] ?? 0) + 1;
  }

  // Find drivers who already received a bonus today
  const driverIds = Object.keys(tourMap);
  const bonusMap: Record<string, boolean> = {};
  if (driverIds.length > 0) {
    const { data: bonuses } = await sb
      .from('driver_tips')
      .select('driver_id')
      .eq('location_id', locationId)
      .eq('type', 'bonus')
      .gte('created_at', since)
      .in('driver_id', driverIds);

    (bonuses ?? []).forEach((b) => { bonusMap[b.driver_id] = true; });
  }

  // Fetch driver names
  const { data: driverRows } = driverIds.length > 0
    ? await sb.from('drivers').select('id, name').in('id', driverIds)
    : { data: [] };
  const nameMap: Record<string, string> = {};
  (driverRows ?? []).forEach((d) => { nameMap[d.id] = d.name ?? d.id.slice(0, 8); });

  const eligible = driverIds
    .filter((id) => tourMap[id] >= TAGESZIEL_TOUREN && !bonusMap[id])
    .map((id) => ({
      driver_id: id,
      name: nameMap[id] ?? id.slice(0, 8),
      touren_heute: tourMap[id],
      bonus_eur: BONUS_EUR,
    }));

  return NextResponse.json({ eligible, tagesziel: TAGESZIEL_TOUREN, bonus_eur: BONUS_EUR });
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { driver_id: string; bonus_eur?: number; reason?: string };
  const { driver_id, bonus_eur = BONUS_EUR, reason = 'Tagesziel erreicht' } = body;

  if (!driver_id) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const sb = await createClient();

  const { error } = await sb.from('driver_tips').insert({
    driver_id,
    location_id: locationId,
    amount: bonus_eur,
    type: 'bonus',
    note: reason,
    created_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, driver_id, bonus_eur });
}
