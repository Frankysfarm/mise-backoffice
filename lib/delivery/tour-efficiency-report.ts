/**
 * lib/delivery/tour-efficiency-report.ts
 *
 * Tour-Effizienz-Reporting — Phase 362.
 *
 * Aggregiert täglich EUR/Stopp, Fahrer-Benchmarks und P75-Werte.
 * Persistiert in tour_efficiency_daily + tour_efficiency_driver_daily (Migration 177).
 *
 * API:
 *   aggregateTourEfficiencyForDay(locationId, dayBerlin)
 *   aggregateTourEfficiencyAllLocations(dayBerlin?)
 *   getTourEfficiencyDashboard(locationId, days)
 *   getDriverEfficiencyBenchmark(locationId, days)
 *   pruneTourEfficiency(daysOld)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface DailyEfficiencyRow {
  dayBerlin:          string;
  totalTours:         number;
  totalStops:         number;
  totalRevenueEur:    number;
  revenuePerStopEur:  number | null;
  p25RevPerStop:      number | null;
  p50RevPerStop:      number | null;
  p75RevPerStop:      number | null;
  p90RevPerStop:      number | null;
  driverCount:        number;
  avgStopsPerDriver:  number | null;
  avgDeliveryMin:     number | null;
  avgBundleSize:      number | null;
  onTimePct:          number | null;
}

export interface DriverBenchmarkRow {
  driverId:          string;
  driverName:        string;
  toursCompleted:    number;
  stopsCompleted:    number;
  revenueEur:        number;
  revPerStopEur:     number | null;
  avgDeliveryMin:    number | null;
  onTimePct:         number | null;
  benchmarkGrade:    'A+' | 'A' | 'B' | 'C' | 'D';
}

export interface EfficiencyDashboard {
  trend:            DailyEfficiencyRow[];
  todaySnapshot:    DailyEfficiencyRow | null;
  driverBenchmarks: DriverBenchmarkRow[];
  p75Benchmark:     number | null;
  topDriverName:    string | null;
  lastUpdated:      string;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function berlinDate(d: Date = new Date()): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

export async function aggregateTourEfficiencyForDay(
  locationId: string,
  dayBerlin?: string,
): Promise<{ saved: boolean; day: string }> {
  const sb  = createServiceClient();
  const day = dayBerlin ?? berlinDate(new Date(Date.now() - 60_000)); // gestern-sicher

  // Alle completed Batches dieses Tages
  const { data: batches } = await sb
    .from('mise_delivery_batches')
    .select(`
      id, driver_id, state,
      mise_delivery_batch_stops(
        id, type, completed_at, sequence,
        customer_orders(gesamtbetrag, eta_earliest, eta_latest, status)
      )
    `)
    .eq('location_id', locationId)
    .eq('state', 'delivered')
    .gte('created_at', `${day}T00:00:00+01:00`)
    .lt('created_at', `${day}T23:59:59+01:00`);

  if (!batches || batches.length === 0) return { saved: false, day };

  // Fahrer-Aggregation
  const driverMap = new Map<
    string,
    { tours: number; stops: number; revenue: number; deliveryMins: number[]; onTimeCt: number; stopCt: number }
  >();

  let totalRevenue = 0;
  let totalStops   = 0;
  const allRevPerStop: number[] = [];

  for (const batch of batches) {
    const driverId = batch.driver_id as string | null;
    if (!driverId) continue;

    const stops = (batch.mise_delivery_batch_stops ?? []) as Array<{
      type: string;
      completed_at: string | null;
      customer_orders: { gesamtbetrag: number | null; eta_latest: string | null; status: string } | null;
    }>;

    const dropoffs = stops.filter((s) => s.type === 'dropoff' && s.completed_at);
    if (dropoffs.length === 0) continue;

    let batchRevenue = 0;
    let onTimeCt = 0;
    const delivMins: number[] = [];

    for (const s of dropoffs) {
      const amt = s.customer_orders?.gesamtbetrag ?? 0;
      batchRevenue += amt;
      totalRevenue += amt;
      totalStops++;

      // On-time: completed_at ≤ eta_latest
      if (s.completed_at && s.customer_orders?.eta_latest) {
        const complMs = new Date(s.completed_at).getTime();
        const etaMs   = new Date(s.customer_orders.eta_latest).getTime();
        if (complMs <= etaMs + 2 * 60_000) onTimeCt++; // 2 Min Toleranz
      }
    }

    if (dropoffs.length > 0 && batchRevenue > 0) {
      allRevPerStop.push(batchRevenue / dropoffs.length);
    }

    const entry = driverMap.get(driverId) ?? { tours: 0, stops: 0, revenue: 0, deliveryMins: [], onTimeCt: 0, stopCt: 0 };
    entry.tours++;
    entry.stops   += dropoffs.length;
    entry.revenue += batchRevenue;
    entry.onTimeCt += onTimeCt;
    entry.stopCt  += dropoffs.length;
    driverMap.set(driverId, entry);
  }

  const sortedRps = [...allRevPerStop].sort((a, b) => a - b);
  const revenuePerStop = totalStops > 0 ? totalRevenue / totalStops : null;

  // Fahrer-Detail speichern
  const driverIds = [...driverMap.keys()];
  let bestDriverId: string | null = null;
  let bestRevPerStop = 0;

  for (const [driverId, d] of driverMap) {
    const rps = d.stops > 0 ? d.revenue / d.stops : null;
    if (rps && rps > bestRevPerStop) {
      bestRevPerStop = rps;
      bestDriverId   = driverId;
    }
    await sb.from('tour_efficiency_driver_daily').upsert({
      location_id:      locationId,
      day_berlin:       day,
      driver_id:        driverId,
      tours_completed:  d.tours,
      stops_completed:  d.stops,
      revenue_eur:      d.revenue,
      rev_per_stop_eur: rps,
      avg_delivery_min: null,
      on_time_pct:      d.stopCt > 0 ? Math.round((d.onTimeCt / d.stopCt) * 1000) / 10 : null,
    }, { onConflict: 'location_id,day_berlin,driver_id' });
  }

  // Tages-Summary speichern
  await sb.from('tour_efficiency_daily').upsert({
    location_id:          locationId,
    day_berlin:           day,
    total_tours:          batches.length,
    total_stops:          totalStops,
    total_revenue_eur:    totalRevenue,
    revenue_per_stop_eur: revenuePerStop,
    p25_rev_per_stop:     percentile(sortedRps, 25),
    p50_rev_per_stop:     percentile(sortedRps, 50),
    p75_rev_per_stop:     percentile(sortedRps, 75),
    p90_rev_per_stop:     percentile(sortedRps, 90),
    driver_count:         driverIds.length,
    avg_stops_per_driver: driverIds.length > 0 ? totalStops / driverIds.length : null,
    best_driver_id:       bestDriverId,
    best_driver_rev_per_stop: bestRevPerStop > 0 ? bestRevPerStop : null,
    avg_delivery_min:     null,
    avg_bundle_size:      batches.length > 0 ? totalStops / batches.length : null,
    on_time_pct:          null,
  }, { onConflict: 'location_id,day_berlin' });

  return { saved: true, day };
}

export async function aggregateTourEfficiencyAllLocations(
  dayBerlin?: string,
): Promise<{ locations: number; saved: number; errors: number }> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('active', true);

  let saved  = 0;
  let errors = 0;

  await Promise.allSettled(
    (locs ?? []).map(async (loc) => {
      try {
        const r = await aggregateTourEfficiencyForDay(loc.id as string, dayBerlin);
        if (r.saved) saved++;
      } catch {
        errors++;
      }
    }),
  );

  return { locations: (locs ?? []).length, saved, errors };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getTourEfficiencyDashboard(
  locationId: string,
  days = 14,
): Promise<EfficiencyDashboard> {
  const sb   = createServiceClient();
  const from = berlinDate(new Date(Date.now() - days * 86_400_000));

  const [{ data: trendRows }, { data: driverRows }] = await Promise.all([
    sb
      .from('tour_efficiency_daily')
      .select('*')
      .eq('location_id', locationId)
      .gte('day_berlin', from)
      .order('day_berlin', { ascending: true }),
    sb
      .from('tour_efficiency_driver_daily')
      .select('*, employees(vorname, nachname)')
      .eq('location_id', locationId)
      .gte('day_berlin', from)
      .order('rev_per_stop_eur', { ascending: false }),
  ]);

  const trend: DailyEfficiencyRow[] = (trendRows ?? []).map((r) => ({
    dayBerlin:         r.day_berlin as string,
    totalTours:        Number(r.total_tours),
    totalStops:        Number(r.total_stops),
    totalRevenueEur:   Number(r.total_revenue_eur),
    revenuePerStopEur: r.revenue_per_stop_eur != null ? Number(r.revenue_per_stop_eur) : null,
    p25RevPerStop:     r.p25_rev_per_stop != null ? Number(r.p25_rev_per_stop) : null,
    p50RevPerStop:     r.p50_rev_per_stop != null ? Number(r.p50_rev_per_stop) : null,
    p75RevPerStop:     r.p75_rev_per_stop != null ? Number(r.p75_rev_per_stop) : null,
    p90RevPerStop:     r.p90_rev_per_stop != null ? Number(r.p90_rev_per_stop) : null,
    driverCount:       Number(r.driver_count),
    avgStopsPerDriver: r.avg_stops_per_driver != null ? Number(r.avg_stops_per_driver) : null,
    avgDeliveryMin:    r.avg_delivery_min != null ? Number(r.avg_delivery_min) : null,
    avgBundleSize:     r.avg_bundle_size != null ? Number(r.avg_bundle_size) : null,
    onTimePct:         r.on_time_pct != null ? Number(r.on_time_pct) : null,
  }));

  const todaySnapshot = trend.length > 0 ? trend[trend.length - 1] : null;

  // Benchmark-Aggregat über alle Fahrer der Periode (letzte Woche → Ø revPerStop)
  const driverAgg = new Map<string, { name: string; rev: number; stops: number }>();
  for (const r of driverRows ?? []) {
    const emp = r.employees as { vorname: string; nachname: string } | null;
    const name = emp ? `${emp.vorname} ${emp.nachname}` : r.driver_id as string;
    const entry = driverAgg.get(r.driver_id as string) ?? { name, rev: 0, stops: 0 };
    entry.rev   += Number(r.revenue_eur);
    entry.stops += Number(r.stops_completed);
    driverAgg.set(r.driver_id as string, entry);
  }

  const rpsValues = [...driverAgg.values()]
    .map((d) => (d.stops > 0 ? d.rev / d.stops : 0))
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const p75Benchmark = percentile(rpsValues, 75);

  const benchmarks: DriverBenchmarkRow[] = [...driverAgg.entries()]
    .map(([driverId, d]) => {
      const rps = d.stops > 0 ? Math.round((d.rev / d.stops) * 100) / 100 : null;
      const grade: DriverBenchmarkRow['benchmarkGrade'] =
        rps == null        ? 'D'
        : !p75Benchmark    ? 'B'
        : rps >= p75Benchmark * 1.1 ? 'A+'
        : rps >= p75Benchmark       ? 'A'
        : rps >= p75Benchmark * 0.8 ? 'B'
        : rps >= p75Benchmark * 0.6 ? 'C'
        : 'D';
      return {
        driverId,
        driverName:      d.name,
        toursCompleted:  0,
        stopsCompleted:  d.stops,
        revenueEur:      d.rev,
        revPerStopEur:   rps,
        avgDeliveryMin:  null,
        onTimePct:       null,
        benchmarkGrade:  grade,
      };
    })
    .sort((a, b) => (b.revPerStopEur ?? 0) - (a.revPerStopEur ?? 0));

  const topDriverName = benchmarks[0]?.driverName ?? null;

  return {
    trend,
    todaySnapshot,
    driverBenchmarks: benchmarks,
    p75Benchmark,
    topDriverName,
    lastUpdated: new Date().toISOString(),
  };
}

export async function pruneTourEfficiency(daysOld = 365): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_tour_efficiency_daily', { days_old: daysOld });
  return { pruned: (data as number) ?? 0 };
}
