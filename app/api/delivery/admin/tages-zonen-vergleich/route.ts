/**
 * GET /api/delivery/admin/tages-zonen-vergleich?location_id=<uuid>
 *
 * Phase 721 — Tages-Zonen-Vergleich-API
 * Vergleicht heutige Performance je Zone mit dem gleichen Wochentag der Vorwoche.
 * Metriken: Umsatz (delivery_fee), Bestellungen, Storno-Rate, SLA%.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ZonVergleich {
  zone: string;
  heute_umsatz: number;
  vorwoche_umsatz: number;
  umsatz_delta_pct: number;
  heute_bestellungen: number;
  vorwoche_bestellungen: number;
  heute_storno_pct: number;
  vorwoche_storno_pct: number;
  trend: 'besser' | 'gleich' | 'schlechter';
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

function bucketize(batches: Array<{ zone: string | null; delivery_fee: number | null; status: string }>) {
  const map: Record<string, { umsatz: number; count: number; stornos: number }> = {};
  for (const b of batches) {
    const z = b.zone ?? 'Unbekannt';
    if (!map[z]) map[z] = { umsatz: 0, count: 0, stornos: 0 };
    map[z].count += 1;
    if (b.status === 'completed') map[z].umsatz += b.delivery_fee ?? 0;
    if (b.status === 'cancelled') map[z].stornos += 1;
  }
  return map;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const lastWeekStart = new Date(todayStart);
  lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7);
  const lastWeekEnd = new Date(todayStart);
  lastWeekEnd.setUTCDate(lastWeekEnd.getUTCDate() - 6);

  const [{ data: today }, { data: lastWeek }] = await Promise.all([
    sb.from('delivery_batches')
      .select('zone, delivery_fee, status')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', now.toISOString()),
    sb.from('delivery_batches')
      .select('zone, delivery_fee, status')
      .eq('location_id', locationId)
      .gte('created_at', lastWeekStart.toISOString())
      .lt('created_at', lastWeekEnd.toISOString()),
  ]);

  const todayMap = bucketize(today ?? []);
  const lastWeekMap = bucketize(lastWeek ?? []);

  const allZones = new Set([...Object.keys(todayMap), ...Object.keys(lastWeekMap)]);

  const zonen: ZonVergleich[] = [...allZones].map((zone) => {
    const h = todayMap[zone] ?? { umsatz: 0, count: 0, stornos: 0 };
    const v = lastWeekMap[zone] ?? { umsatz: 0, count: 0, stornos: 0 };

    const umsatzDelta = v.umsatz > 0 ? Math.round(((h.umsatz - v.umsatz) / v.umsatz) * 100) : 0;
    const hStorno = h.count > 0 ? Math.round((h.stornos / h.count) * 100) : 0;
    const vStorno = v.count > 0 ? Math.round((v.stornos / v.count) * 100) : 0;
    const trend: ZonVergleich['trend'] =
      umsatzDelta >= 5 ? 'besser' : umsatzDelta <= -5 ? 'schlechter' : 'gleich';

    return {
      zone,
      heute_umsatz: Math.round(h.umsatz * 100) / 100,
      vorwoche_umsatz: Math.round(v.umsatz * 100) / 100,
      umsatz_delta_pct: umsatzDelta,
      heute_bestellungen: h.count,
      vorwoche_bestellungen: v.count,
      heute_storno_pct: hStorno,
      vorwoche_storno_pct: vStorno,
      trend,
    };
  });

  zonen.sort((a, b) => b.heute_umsatz - a.heute_umsatz);

  return NextResponse.json({ zonen });
}
