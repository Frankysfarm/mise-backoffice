/**
 * GET /api/delivery/admin/schicht-effizienz?location_id=<uuid>
 *
 * Phase 824 — Schicht-Effizienz-API
 * Umsatz/Stunde je Fahrer-Schicht heute + Benchmark Vortag.
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

function shiftStart(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offsetDays);
  d.setUTCHours(5, 0, 0, 0);
  if (d > new Date()) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString();
}

function shiftEnd(offsetDays = 0): string {
  const d = new Date(shiftStart(offsetDays));
  d.setUTCHours(d.getUTCHours() + 16);
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = await createClient();
  const heute = shiftStart(0);
  const heuteEnd = new Date().toISOString();
  const gesternStart = shiftStart(1);
  const gesternEnd = shiftEnd(1);

  // Fetch today's completed batches with driver + fee
  const { data: heuteBatches } = await sb
    .from('delivery_batches')
    .select('driver_id, delivery_fee, created_at, completed_at, status')
    .eq('location_id', locationId)
    .gte('created_at', heute)
    .lte('created_at', heuteEnd);

  // Fetch yesterday's completed batches
  const { data: gesternBatches } = await sb
    .from('delivery_batches')
    .select('driver_id, delivery_fee, created_at, completed_at, status')
    .eq('location_id', locationId)
    .gte('created_at', gesternStart)
    .lte('created_at', gesternEnd);

  // Fetch driver names
  const driverIds = [...new Set((heuteBatches ?? []).map((b) => b.driver_id).filter(Boolean))];
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id, first_name, last_name')
    .in('id', driverIds.length > 0 ? driverIds : ['none']);

  const driverMap = new Map((drivers ?? []).map((d) => [d.id, `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim()]));

  // Group today's batches by driver
  const byDriver = new Map<string, { fee: number; batches: number; ersteZeit: string; letzteZeit: string }>();
  for (const b of heuteBatches ?? []) {
    if (!b.driver_id || !['completed', 'in_progress', 'assigned'].includes(b.status ?? '')) continue;
    const cur = byDriver.get(b.driver_id) ?? { fee: 0, batches: 0, ersteZeit: b.created_at, letzteZeit: b.created_at };
    cur.fee += b.delivery_fee ?? 0;
    cur.batches += 1;
    if (b.created_at < cur.ersteZeit) cur.ersteZeit = b.created_at;
    if (b.created_at > cur.letzteZeit) cur.letzteZeit = b.created_at;
    byDriver.set(b.driver_id, cur);
  }

  const nowMs = Date.now();
  const schichtMs = nowMs - new Date(heute).getTime();
  const schichtStunden = Math.max(0.1, schichtMs / 3_600_000);

  const fahrer = Array.from(byDriver.entries()).map(([id, d]) => {
    const aktivMs = new Date(d.letzteZeit).getTime() - new Date(d.ersteZeit).getTime();
    const aktivStunden = Math.max(0.1, aktivMs / 3_600_000);
    const umsatzProStunde = d.fee / aktivStunden;
    return {
      driver_id: id,
      name: driverMap.get(id) ?? id.slice(0, 8),
      umsatz_heute: Math.round(d.fee * 100) / 100,
      batches: d.batches,
      aktiv_stunden: Math.round(aktivStunden * 10) / 10,
      umsatz_pro_stunde: Math.round(umsatzProStunde * 100) / 100,
    };
  }).sort((a, b) => b.umsatz_pro_stunde - a.umsatz_pro_stunde);

  // Yesterday's benchmark: avg Umsatz/Stunde across all drivers
  const gesternByDriver = new Map<string, { fee: number; ersteZeit: string; letzteZeit: string }>();
  for (const b of gesternBatches ?? []) {
    if (!b.driver_id || !['completed', 'in_progress', 'assigned'].includes(b.status ?? '')) continue;
    const cur = gesternByDriver.get(b.driver_id) ?? { fee: 0, ersteZeit: b.created_at, letzteZeit: b.created_at };
    cur.fee += b.delivery_fee ?? 0;
    if (b.created_at < cur.ersteZeit) cur.ersteZeit = b.created_at;
    if (b.created_at > cur.letzteZeit) cur.letzteZeit = b.created_at;
    gesternByDriver.set(b.driver_id, cur);
  }

  const gesternRates = Array.from(gesternByDriver.values()).map((d) => {
    const aktivMs = new Date(d.letzteZeit).getTime() - new Date(d.ersteZeit).getTime();
    return d.fee / Math.max(0.1, aktivMs / 3_600_000);
  });

  const gesternAvg = gesternRates.length
    ? gesternRates.reduce((s, r) => s + r, 0) / gesternRates.length
    : 0;

  const heuteAvg = fahrer.length
    ? fahrer.reduce((s, f) => s + f.umsatz_pro_stunde, 0) / fahrer.length
    : 0;

  return NextResponse.json({
    fahrer,
    benchmark: {
      heute_avg: Math.round(heuteAvg * 100) / 100,
      gestern_avg: Math.round(gesternAvg * 100) / 100,
      trend_pct: gesternAvg > 0 ? Math.round(((heuteAvg - gesternAvg) / gesternAvg) * 100) : null,
    },
    schicht_stunden: Math.round(schichtStunden * 10) / 10,
    aktualisiert: new Date().toISOString(),
  });
}
