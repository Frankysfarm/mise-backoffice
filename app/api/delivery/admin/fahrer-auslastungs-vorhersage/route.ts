/**
 * GET /api/delivery/admin/fahrer-auslastungs-vorhersage?location_id=<uuid>
 *
 * Phase 879 — Fahrer-Auslastungs-Vorhersage-API
 * Prognose freier/besetzter Fahrer je Stunde basierend auf historischen Schichtdaten.
 * Analysiert Schicht-Starts und -Enden der letzten 4 Wochen pro Wochentag.
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
  const now = new Date();
  const weekday = now.getUTCDay(); // 0=Sun … 6=Sat
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // Look back 4 weeks, same weekday
  const cutoff = new Date(todayStart.getTime() - 28 * 24 * 3_600_000);

  const { data: shifts } = await sb
    .from('driver_shifts')
    .select('started_at, ended_at, status')
    .eq('location_id', locationId)
    .gte('started_at', cutoff.toISOString())
    .in('status', ['active', 'completed']);

  // Count drivers present per hour (historical same weekday)
  const historicalByHour: Record<number, { freie: number[]; besetzte: number[] }> = {};
  for (let h = 0; h < 24; h++) {
    historicalByHour[h] = { freie: [], besetzte: [] };
  }

  type ShiftRow = { started_at: string; ended_at: string | null; status: string };
  const sameWeekdayShifts = ((shifts as ShiftRow[] | null) ?? []).filter(s => {
    const d = new Date(s.started_at);
    return d.getUTCDay() === weekday && new Date(s.started_at) < todayStart;
  });

  // Group by week and compute per-hour occupancy
  const weekBuckets = new Map<string, ShiftRow[]>();
  for (const s of sameWeekdayShifts) {
    const d = new Date(s.started_at);
    const weekKey = `${d.getUTCFullYear()}-W${Math.floor(d.getUTCDate() / 7)}`;
    if (!weekBuckets.has(weekKey)) weekBuckets.set(weekKey, []);
    weekBuckets.get(weekKey)!.push(s);
  }

  // Total distinct drivers per hour per historical day
  const dayRecords: Record<number, { besetzte: number; freie: number }>[] = [];
  for (const weekShifts of weekBuckets.values()) {
    const rec: Record<number, { besetzte: number; freie: number }> = {};
    for (let h = 0; h < 24; h++) {
      let besetzte = 0;
      for (const s of weekShifts) {
        const start = new Date(s.started_at);
        const end = s.ended_at ? new Date(s.ended_at) : new Date(start.getTime() + 8 * 3_600_000);
        const startH = start.getUTCHours();
        const endH = end.getUTCHours();
        if (startH <= h && endH > h) besetzte++;
      }
      rec[h] = { besetzte, freie: Math.max(0, weekShifts.length - besetzte) };
    }
    dayRecords.push(rec);
  }

  // Average across historical days
  const avgByHour: { hour: number; prognose_besetzt: number; prognose_frei: number }[] = [];
  for (let h = 0; h < 24; h++) {
    if (dayRecords.length === 0) {
      avgByHour.push({ hour: h, prognose_besetzt: 0, prognose_frei: 0 });
      continue;
    }
    const sumB = dayRecords.reduce((acc, r) => acc + (r[h]?.besetzte ?? 0), 0);
    const sumF = dayRecords.reduce((acc, r) => acc + (r[h]?.freie ?? 0), 0);
    avgByHour.push({
      hour: h,
      prognose_besetzt: Math.round(sumB / dayRecords.length),
      prognose_frei: Math.round(sumF / dayRecords.length),
    });
  }

  // Today: live actuals
  const { data: todayShifts } = await sb
    .from('driver_shifts')
    .select('started_at, ended_at, status')
    .eq('location_id', locationId)
    .gte('started_at', todayStart.toISOString())
    .in('status', ['active', 'completed']);

  const currentHour = now.getUTCHours();
  const liveByHour: Record<number, { besetzte: number; freie: number }> = {};
  for (let h = 0; h <= currentHour; h++) {
    let besetzte = 0;
    for (const s of (todayShifts as ShiftRow[] | null) ?? []) {
      const start = new Date(s.started_at);
      const end = s.ended_at ? new Date(s.ended_at) : now;
      const startH = start.getUTCHours();
      const endH = end.getUTCHours();
      if (startH <= h && (endH > h || s.status === 'active')) besetzte++;
    }
    const total = (todayShifts as ShiftRow[] | null)?.length ?? 0;
    liveByHour[h] = { besetzte, freie: Math.max(0, total - besetzte) };
  }

  // Merge: for past hours use live data, for future use prognosis
  const stunden = avgByHour.map(h => ({
    hour: h.hour,
    prognose_besetzt: h.prognose_besetzt,
    prognose_frei: h.prognose_frei,
    live_besetzt: liveByHour[h.hour]?.besetzte ?? null,
    live_frei: liveByHour[h.hour]?.freie ?? null,
    ist_vergangenheit: h.hour <= currentHour,
  }));

  const peakHour = stunden.reduce(
    (best, s) => (s.prognose_besetzt > best.prognose_besetzt ? s : best),
    stunden[0],
  );

  const avgBesetzt =
    dayRecords.length > 0
      ? Math.round(
          stunden.filter(s => s.prognose_besetzt > 0).reduce((a, s) => a + s.prognose_besetzt, 0) /
          Math.max(1, stunden.filter(s => s.prognose_besetzt > 0).length),
        )
      : 0;

  return NextResponse.json({
    stunden,
    peak_hour: peakHour.hour,
    avg_besetzt: avgBesetzt,
    historische_tage: dayRecords.length,
    generatedAt: now.toISOString(),
  });
}
