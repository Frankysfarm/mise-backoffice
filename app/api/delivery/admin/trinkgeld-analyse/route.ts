/**
 * GET /api/delivery/admin/trinkgeld-analyse?location_id=<uuid>&tage=30
 *
 * Phase 706 — Kunden-Trinkgeld-Analyse-API
 * Aggregiert Trinkgeld-Einnahmen pro Fahrer und pro Zone für die letzten N Tage.
 *
 * Response: { fahrer: FahrerTrinkgeld[], zonen: ZoneTrinkgeld[] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FahrerTrinkgeld {
  driver_id: string;
  name: string;
  trinkgeld_total: number;
  trinkgeld_avg: number;
  touren_count: number;
  trinkgeld_rate_pct: number;
}

interface ZoneTrinkgeld {
  zone: string;
  trinkgeld_total: number;
  trinkgeld_avg: number;
  bestellungen_count: number;
}

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

  const url = new URL(req.url);
  const tage = Math.min(90, Math.max(1, parseInt(url.searchParams.get('tage') ?? '30', 10)));

  const sb = await createClient();

  const since = new Date(Date.now() - tage * 86_400_000).toISOString();

  // Fetch tips
  const { data: tips } = await sb
    .from('driver_tips')
    .select('driver_id, amount, zone, created_at')
    .eq('location_id', locationId)
    .gte('created_at', since);

  // Fetch batches (for touren_count per driver)
  const { data: batches } = await sb
    .from('delivery_batches')
    .select('driver_id')
    .eq('location_id', locationId)
    .eq('status', 'completed')
    .gte('created_at', since)
    .not('driver_id', 'is', null);

  const allTips = tips ?? [];
  const allBatches = batches ?? [];

  // Aggregate per driver
  const driverMap: Record<string, { total: number; count: number }> = {};
  for (const tip of allTips) {
    if (!tip.driver_id) continue;
    if (!driverMap[tip.driver_id]) driverMap[tip.driver_id] = { total: 0, count: 0 };
    driverMap[tip.driver_id].total += tip.amount ?? 0;
    driverMap[tip.driver_id].count += 1;
  }

  // Count completed tours per driver
  const tourMap: Record<string, number> = {};
  for (const b of allBatches) {
    if (!b.driver_id) continue;
    tourMap[b.driver_id] = (tourMap[b.driver_id] ?? 0) + 1;
  }

  const driverIds = Object.keys(driverMap);
  const { data: driverRows } = driverIds.length > 0
    ? await sb.from('drivers').select('id, name').in('id', driverIds)
    : { data: [] };

  const nameMap: Record<string, string> = {};
  (driverRows ?? []).forEach((d) => { nameMap[d.id] = d.name ?? d.id.slice(0, 8); });

  const fahrer: FahrerTrinkgeld[] = Object.entries(driverMap).map(([id, { total, count }]) => {
    const touren = tourMap[id] ?? 1;
    return {
      driver_id: id,
      name: nameMap[id] ?? id.slice(0, 8),
      trinkgeld_total: Math.round(total * 100) / 100,
      trinkgeld_avg: Math.round((total / count) * 100) / 100,
      touren_count: touren,
      trinkgeld_rate_pct: Math.round((count / touren) * 100),
    };
  });
  fahrer.sort((a, b) => b.trinkgeld_total - a.trinkgeld_total);

  // Aggregate per zone
  const zoneMap: Record<string, { total: number; count: number }> = {};
  for (const tip of allTips) {
    const z = tip.zone ?? 'Unbekannt';
    if (!zoneMap[z]) zoneMap[z] = { total: 0, count: 0 };
    zoneMap[z].total += tip.amount ?? 0;
    zoneMap[z].count += 1;
  }

  const zonen: ZoneTrinkgeld[] = Object.entries(zoneMap).map(([zone, { total, count }]) => ({
    zone,
    trinkgeld_total: Math.round(total * 100) / 100,
    trinkgeld_avg: Math.round((total / count) * 100) / 100,
    bestellungen_count: count,
  }));
  zonen.sort((a, b) => b.trinkgeld_total - a.trinkgeld_total);

  return NextResponse.json({ fahrer, zonen, tage });
}
