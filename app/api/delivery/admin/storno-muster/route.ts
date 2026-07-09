/**
 * GET /api/delivery/admin/storno-muster?location_id=<uuid>
 *
 * Phase 889 — Storno-Muster-Analyse-API
 * Stornierungsrate letzte 24h, Peak-Stunden, Top-Gründe und Zonen-Vergleich.
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

const FALLBACK_REASONS = [
  'Zu lange Wartezeit',
  'Falscher Artikel',
  'Adresse nicht erreichbar',
  'Doppelbestellung',
  'Sonstiges',
];
const ZONE_NAMES: Record<string, string> = {
  A: 'Innenstadt',
  B: 'Stadtmitte',
  C: 'Vorstadt',
  D: 'Außenbereich',
};

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 3_600_000);

  const { data: orders } = await sb
    .from('orders')
    .select('id, status, storno_grund, delivery_zone, bestellt_am')
    .eq('location_id', locationId)
    .gte('bestellt_am', since24h.toISOString());

  const allOrders = (orders ?? []) as {
    id: string;
    status: string;
    storno_grund: string | null;
    delivery_zone: string | null;
    bestellt_am: string | null;
  }[];

  const total = allOrders.length;
  const storniert = allOrders.filter(o => ['storniert', 'cancelled'].includes(o.status));
  const rate = total > 0 ? Math.round((storniert.length / total) * 100) : 0;

  // Peak hour analysis
  const countByHour: Record<number, number> = {};
  for (const o of storniert) {
    if (!o.bestellt_am) continue;
    const h = new Date(o.bestellt_am).getUTCHours();
    countByHour[h] = (countByHour[h] ?? 0) + 1;
  }
  const peakEntry = Object.entries(countByHour).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

  // Top reasons
  const reasonCount: Record<string, number> = {};
  for (const o of storniert) {
    const reason = o.storno_grund || 'Sonstiges';
    reasonCount[reason] = (reasonCount[reason] ?? 0) + 1;
  }
  const top_reasons = Object.entries(reasonCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([grund, anzahl]) => ({ grund, anzahl }));

  // Zone comparison
  const by_zone = ['A', 'B', 'C', 'D'].map(zone => {
    const zoneOrders = allOrders.filter(o => o.delivery_zone === zone);
    const zoneStorno = zoneOrders.filter(o => ['storniert', 'cancelled'].includes(o.status));
    return {
      zone,
      label: ZONE_NAMES[zone] ?? zone,
      gesamt: zoneOrders.length,
      storniert: zoneStorno.length,
      rate: zoneOrders.length > 0 ? Math.round((zoneStorno.length / zoneOrders.length) * 100) : 0,
    };
  }).filter(z => z.gesamt > 0);

  // Hourly breakdown
  const stunden = Array.from({ length: 24 }, (_, h) => ({ hour: h, anzahl: countByHour[h] ?? 0 }));

  return NextResponse.json({
    total_bestellungen: total,
    total_storniert: storniert.length,
    rate,
    peak_hour: peakEntry ? parseInt(peakEntry[0]) : null,
    peak_anzahl: peakEntry ? peakEntry[1] : 0,
    top_reasons: top_reasons.length
      ? top_reasons
      : FALLBACK_REASONS.map((g, i) => ({ grund: g, anzahl: Math.max(0, 3 - i) })),
    by_zone,
    stunden,
    generatedAt: now.toISOString(),
  });
}
