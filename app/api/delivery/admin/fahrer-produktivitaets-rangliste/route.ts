/**
 * GET /api/delivery/admin/fahrer-produktivitaets-rangliste?location_id=<uuid>
 *
 * Phase 936 — Fahrer-Produktivitäts-Rangliste-API
 * Ranking aller Fahrer nach Gesamtscore (Pünktlichkeit + Stopps/h + Bewertung)
 * für heute + Trend vs. gestern.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FahrerRang {
  rank: number;
  driver_id: string;
  fahrer_name: string;
  touren: number;
  stopps: number;
  stopps_pro_h: number;
  puenktlichkeit_pct: number;
  bewertung_avg: number;
  gesamtscore: number;
  trend: 'up' | 'down' | 'gleich';
  gestern_score: number | null;
}

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

function calcScore(puenktlichkeitPct: number, stoppsPh: number, bewertungAvg: number): number {
  const pScore = puenktlichkeitPct * 0.45;
  const sScore = Math.min(stoppsPh * 8, 35);
  const bScore = bewertungAvg > 0 ? (bewertungAvg / 5) * 20 : 0;
  return Math.min(100, Math.round(pScore + sScore + bScore));
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);

  const { data: schichten } = await sb
    .from('driver_shifts')
    .select('id, driver_id, started_at, employee:employees(id, first_name, last_name)')
    .eq('location_id', locationId)
    .gte('started_at', yesterdayStart.toISOString())
    .not('driver_id', 'is', null);

  if (!schichten || schichten.length === 0) {
    return NextResponse.json({ rangliste: [], generatedAt: now.toISOString() });
  }

  const todayDriverIds = [...new Set(
    schichten
      .filter((s) => new Date((s as { started_at: string }).started_at) >= todayStart)
      .map((s) => s.driver_id as string)
      .filter(Boolean)
  )];

  if (todayDriverIds.length === 0) {
    return NextResponse.json({ rangliste: [], generatedAt: now.toISOString() });
  }

  const { data: batches } = await sb
    .from('delivery_batches')
    .select('id, driver_id, started_at, completed_at, created_at')
    .eq('location_id', locationId)
    .in('driver_id', todayDriverIds)
    .gte('created_at', yesterdayStart.toISOString());

  const tourIds = (batches ?? []).map((b) => b.id);

  const { data: stopps } = tourIds.length
    ? await sb
        .from('delivery_stops')
        .select('id, batch_id, driver_id, delivered_at, eta_at, created_at')
        .in('batch_id', tourIds)
    : { data: [] };

  const { data: ratings } = await sb
    .from('driver_ratings')
    .select('driver_id, rating, created_at')
    .in('driver_id', todayDriverIds)
    .gte('created_at', yesterdayStart.toISOString());

  function buildScore(
    driverId: string,
    fromDate: Date,
    toDate: Date,
  ): { touren: number; stopps: number; stoppsPh: number; puenktlichkeitPct: number; bewertungAvg: number; score: number } {
    const fahrerBatches = (batches ?? []).filter(
      (b) => b.driver_id === driverId &&
        new Date((b as { created_at: string }).created_at) >= fromDate &&
        new Date((b as { created_at: string }).created_at) < toDate,
    );
    const batchIds = fahrerBatches.map((b) => b.id);

    const fahrerStopps = (stopps ?? []).filter(
      (s) => batchIds.includes(s.batch_id),
    );

    const puenktlich = fahrerStopps.filter((s) => {
      const del = (s as { delivered_at?: string | null }).delivered_at;
      const eta = (s as { eta_at?: string | null }).eta_at;
      if (!del || !eta) return true;
      return new Date(del) <= new Date(eta);
    }).length;

    const puenktlichkeitPct = fahrerStopps.length > 0
      ? Math.round((puenktlich / fahrerStopps.length) * 100)
      : 100;

    let gesamtDauerH = 0;
    for (const b of fahrerBatches) {
      const start = (b as { started_at?: string | null }).started_at;
      const end = (b as { completed_at?: string | null }).completed_at;
      if (start && end) {
        gesamtDauerH += (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
      }
    }
    const stoppsPh = gesamtDauerH > 0 ? Math.round((fahrerStopps.length / gesamtDauerH) * 10) / 10 : 0;

    const fahrerRatings = (ratings ?? []).filter(
      (r) => r.driver_id === driverId &&
        new Date((r as { created_at: string }).created_at) >= fromDate &&
        new Date((r as { created_at: string }).created_at) < toDate,
    );
    const bewertungAvg = fahrerRatings.length > 0
      ? Math.round((fahrerRatings.reduce((s, r) => s + (r.rating ?? 0), 0) / fahrerRatings.length) * 10) / 10
      : 0;

    const score = calcScore(puenktlichkeitPct, stoppsPh, bewertungAvg);
    return { touren: fahrerBatches.length, stopps: fahrerStopps.length, stoppsPh, puenktlichkeitPct, bewertungAvg, score };
  }

  const rangliste: FahrerRang[] = todayDriverIds.map((driverId) => {
    const schicht = schichten.find((s) => s.driver_id === driverId);
    const emp = schicht?.employee as { first_name?: string; last_name?: string } | null;
    const fahrer_name = emp
      ? `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() || 'Fahrer'
      : 'Fahrer';

    const heute = buildScore(driverId, todayStart, now);
    const gestern = buildScore(driverId, yesterdayStart, todayStart);

    const trend: 'up' | 'down' | 'gleich' =
      gestern.touren === 0 ? 'gleich' :
      heute.score > gestern.score + 3 ? 'up' :
      heute.score < gestern.score - 3 ? 'down' : 'gleich';

    return {
      rank: 0,
      driver_id: driverId,
      fahrer_name,
      touren: heute.touren,
      stopps: heute.stopps,
      stopps_pro_h: heute.stoppsPh,
      puenktlichkeit_pct: heute.puenktlichkeitPct,
      bewertung_avg: heute.bewertungAvg,
      gesamtscore: heute.score,
      trend,
      gestern_score: gestern.touren > 0 ? gestern.score : null,
    };
  });

  rangliste.sort((a, b) => b.gesamtscore - a.gesamtscore);
  rangliste.forEach((r, i) => { r.rank = i + 1; });

  return NextResponse.json({ rangliste, generatedAt: now.toISOString() });
}
