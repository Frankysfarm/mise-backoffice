/**
 * lib/delivery/driver-score-weekly-benchmarks.ts — Phase 387
 *
 * Wöchentliche Standort-Benchmarks: aggregiert alle Fahrer-Scores einer Location
 * pro Woche und persistiert die Standort-Durchschnitte für Benchmark-Vergleiche.
 *
 * Public API:
 *   snapshotWeeklyBenchmark(locationId, weekStart?)    — Snapshot für eine Woche
 *   snapshotWeeklyBenchmarkAllLocations(weekStart?)    — Cron-Batch
 *   getWeeklyBenchmarks(locationId, weeks)             — Trend-Daten lesen
 *   getLatestBenchmark(locationId)                     — Aktuellsten Benchmark lesen
 *   pruneOldBenchmarks(daysToKeep)                     — Cleanup
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

export interface WeeklyBenchmark {
  id: string;
  locationId: string;
  weekStart: string;
  driverCount: number;
  avgComposite: number;
  avgPunctuality: number;
  avgRating: number;
  avgEfficiency: number;
  avgReliability: number;
  avgActivity: number;
  avgVolume: number;
  avgFeedback: number;
  topScore: number;
  bottomScore: number;
  gradeDist: Record<string, number>;
  createdAt: string;
}

function avg(vals: number[]): number {
  if (vals.length === 0) return 0;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
}

function isoWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function snapshotWeeklyBenchmark(
  locationId: string,
  weekStart?: string,
): Promise<{ ok: boolean; driverCount: number }> {
  const sb = createServiceClient();
  const ws = weekStart ?? isoWeekStart();
  const wsDate = new Date(ws + 'T00:00:00Z');
  const weDate = new Date(wsDate.getTime() + 7 * 86_400_000);

  const { data: rows } = await sb
    .from('driver_score_history')
    .select('composite_score,f_punctuality,f_rating,f_efficiency,f_reliability,f_activity,f_volume,f_feedback,grade')
    .eq('location_id', locationId)
    .eq('period', 'week')
    .gte('period_start', ws)
    .lt('period_start', weDate.toISOString().slice(0, 10));

  if (!rows || rows.length === 0) return { ok: true, driverCount: 0 };

  type Row = {
    composite_score: number; f_punctuality: number; f_rating: number;
    f_efficiency: number; f_reliability: number; f_activity: number;
    f_volume: number; f_feedback: number; grade: string;
  };
  const r = rows as Row[];

  const scores = r.map((x) => Number(x.composite_score ?? 0));
  const gradeDist: Record<string, number> = {};
  for (const row of r) {
    const g = row.grade ?? 'D';
    gradeDist[g] = (gradeDist[g] ?? 0) + 1;
  }

  const { error } = await sb.from('driver_score_weekly_benchmarks').upsert({
    location_id:      locationId,
    week_start:       ws,
    driver_count:     r.length,
    avg_composite:    avg(scores),
    avg_punctuality:  avg(r.map((x) => Number(x.f_punctuality ?? 0))),
    avg_rating:       avg(r.map((x) => Number(x.f_rating ?? 0))),
    avg_efficiency:   avg(r.map((x) => Number(x.f_efficiency ?? 0))),
    avg_reliability:  avg(r.map((x) => Number(x.f_reliability ?? 0))),
    avg_activity:     avg(r.map((x) => Number(x.f_activity ?? 0))),
    avg_volume:       avg(r.map((x) => Number(x.f_volume ?? 0))),
    avg_feedback:     avg(r.map((x) => Number(x.f_feedback ?? 0))),
    top_score:        Math.max(...scores),
    bottom_score:     Math.min(...scores),
    grade_dist:       gradeDist,
  }, { onConflict: 'location_id,week_start' });

  return { ok: !error, driverCount: r.length };
}

export async function snapshotWeeklyBenchmarkAllLocations(
  weekStart?: string,
): Promise<{ locations: number; errors: number }> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('active', true).limit(50);
  if (!locs || locs.length === 0) return { locations: 0, errors: 0 };

  let errors = 0;
  await Promise.allSettled(
    locs.map(async (loc: { id: string }) => {
      try {
        await snapshotWeeklyBenchmark(loc.id as string, weekStart);
      } catch {
        errors++;
      }
    }),
  );
  return { locations: locs.length, errors };
}

export async function getWeeklyBenchmarks(
  locationId: string,
  weeks = 12,
): Promise<WeeklyBenchmark[]> {
  const sb = createServiceClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - weeks * 7);

  try {
    const { data, error } = await sb
      .from('driver_score_weekly_benchmarks')
      .select('*')
      .eq('location_id', locationId)
      .gte('week_start', since.toISOString().slice(0, 10))
      .order('week_start', { ascending: true })
      .limit(52);

    if (error) return [];

    return (data ?? []).map((r: Record<string, unknown>) => ({
      id:             r.id as string,
      locationId:     r.location_id as string,
      weekStart:      r.week_start as string,
      driverCount:    Number(r.driver_count ?? 0),
      avgComposite:   Number(r.avg_composite ?? 0),
      avgPunctuality: Number(r.avg_punctuality ?? 0),
      avgRating:      Number(r.avg_rating ?? 0),
      avgEfficiency:  Number(r.avg_efficiency ?? 0),
      avgReliability: Number(r.avg_reliability ?? 0),
      avgActivity:    Number(r.avg_activity ?? 0),
      avgVolume:      Number(r.avg_volume ?? 0),
      avgFeedback:    Number(r.avg_feedback ?? 0),
      topScore:       Number(r.top_score ?? 0),
      bottomScore:    Number(r.bottom_score ?? 0),
      gradeDist:      (r.grade_dist as Record<string, number>) ?? {},
      createdAt:      r.created_at as string,
    }));
  } catch {
    return [];
  }
}

export async function getLatestBenchmark(locationId: string): Promise<WeeklyBenchmark | null> {
  const rows = await getWeeklyBenchmarks(locationId, 1);
  return rows.at(-1) ?? null;
}

export async function pruneOldBenchmarks(daysToKeep = 365): Promise<number> {
  try {
    const { data } = await createServiceClient().rpc(
      'prune_driver_score_weekly_benchmarks',
      { days_to_keep: daysToKeep },
    );
    return (data as number | null) ?? 0;
  } catch {
    return 0;
  }
}
