/**
 * GET /api/delivery/admin/zone-saturation?location_id=...
 *
 * Phase 525 — Liefergebiet-Sättigung
 * Vergleicht heutige Bestellungen je Zone mit dem historischen Ø (gleicher Wochentag, 4 Wochen).
 * Zeigt welche Zonen unter-/überausgelastet sind.
 *
 * Response: { ok, zones: ZoneSaturation[], summary: SaturationSummary, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type SaturationLevel = 'low' | 'medium' | 'high' | 'saturated';

export interface ZoneSaturation {
  zone: string;
  ordersToday: number;
  historicalAvg: number;
  saturationPct: number;
  saturationLevel: SaturationLevel;
}

export interface SaturationSummary {
  totalOrdersToday: number;
  avgSaturationPct: number;
  highestZone: string | null;
  lowestZone: string | null;
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

function saturationLevel(pct: number): SaturationLevel {
  if (pct >= 120) return 'saturated';
  if (pct >= 80)  return 'high';
  if (pct >= 40)  return 'medium';
  return 'low';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();
  const now = new Date();

  // Heute (UTC): von Mitternacht bis jetzt
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // Gleicher Wochentag (0=So,1=Mo,...) der letzten 4 Wochen
  const weekday = now.getUTCDay();
  const historicStarts: Date[] = [];
  for (let w = 1; w <= 4; w++) {
    const d = new Date(todayStart.getTime() - w * 7 * 86_400_000);
    historicStarts.push(d);
  }

  // Heutige Bestellungen mit Zone
  const { data: todayRows } = await ssb
    .from('customer_orders')
    .select('delivery_zone')
    .eq('location_id', locationId)
    .not('status', 'in', '("storniert","cancelled")')
    .gte('bestellt_am', todayStart.toISOString())
    .lt('bestellt_am', now.toISOString());

  const todayOrders = (todayRows ?? []) as { delivery_zone: string | null }[];

  // Historische Bestellungen (4 Wochen, gleicher Wochentag)
  type HistRow = { delivery_zone: string | null; bestellt_am: string };
  const historicPromises = historicStarts.map((d) => {
    const end = new Date(d.getTime() + 86_400_000);
    return ssb
      .from('customer_orders')
      .select('delivery_zone, bestellt_am')
      .eq('location_id', locationId)
      .not('status', 'in', '("storniert","cancelled")')
      .gte('bestellt_am', d.toISOString())
      .lt('bestellt_am', end.toISOString())
      .then(({ data }) => (data ?? []) as HistRow[]);
  });

  const historicResults = await Promise.all(historicPromises);
  const historicOrders = historicResults.flat();

  // Alle Zonen sammeln
  const zoneSet = new Set<string>();
  todayOrders.forEach((o) => { if (o.delivery_zone) zoneSet.add(o.delivery_zone); });
  historicOrders.forEach((o) => { if (o.delivery_zone) zoneSet.add(o.delivery_zone); });
  if (zoneSet.size === 0) {
    return NextResponse.json({
      ok: true,
      zones: [],
      summary: { totalOrdersToday: 0, avgSaturationPct: 0, highestZone: null, lowestZone: null },
      generatedAt: now.toISOString(),
    });
  }

  const zones: ZoneSaturation[] = Array.from(zoneSet).sort().map((zone) => {
    const ordersToday = todayOrders.filter((o) => o.delivery_zone === zone).length;

    // Historischer Ø: Summe aller historischen Tage ÷ 4
    const historicTotal = historicOrders.filter((o) => o.delivery_zone === zone).length;
    const historicalAvg = Math.round((historicTotal / 4) * 10) / 10;

    const saturationPct = historicalAvg > 0
      ? Math.round((ordersToday / historicalAvg) * 100)
      : ordersToday > 0 ? 150 : 0;

    return {
      zone,
      ordersToday,
      historicalAvg,
      saturationPct,
      saturationLevel: saturationLevel(saturationPct),
    };
  });

  const totalOrdersToday = todayOrders.length;
  const avgSaturationPct = zones.length > 0
    ? Math.round(zones.reduce((s, z) => s + z.saturationPct, 0) / zones.length)
    : 0;

  const sorted = [...zones].sort((a, b) => b.saturationPct - a.saturationPct);
  const highestZone = sorted[0]?.zone ?? null;
  const lowestZone  = sorted[sorted.length - 1]?.zone ?? null;

  const summary: SaturationSummary = {
    totalOrdersToday,
    avgSaturationPct,
    highestZone,
    lowestZone,
  };

  return NextResponse.json({ ok: true, zones, summary, generatedAt: now.toISOString() });
}
