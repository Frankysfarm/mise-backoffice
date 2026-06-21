/**
 * lib/delivery/kitchen-sync.ts
 *
 * Küchen-Timing Synchronisation.
 * Berechnet wann die Küche mit dem Kochen anfangen soll,
 * damit das Essen genau dann fertig ist wenn der Fahrer ankommt.
 *
 * Strategie: cook_start = tour_pickup_at - prep_min - buffer_min
 * Wenn cook_start in der Vergangenheit liegt → sofort (notified_at = now)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

export interface KitchenTimingInput {
  locationId: string;
  orderId: string;
  batchId: string | null;
  tourPickupAt: Date;         // Wann Fahrer am Restaurant abholt
  estimatedPrepMin: number;   // Geschätzte Zubereitungszeit
  bufferMin?: number;         // Puffer (default: 3 min)
}

export interface KitchenTiming {
  id: string;
  orderId: string;
  batchId: string | null;
  tourPickupAt: Date;
  cookStartAt: Date;
  readyTarget: Date;
  prepMin: number;
  bufferMin: number;
  status: 'scheduled' | 'cooking' | 'ready' | 'picked_up';
  notifiedAt: Date | null;
}

/** Erstellt oder aktualisiert ein Küchen-Timing für eine Bestellung. */
export async function upsertKitchenTiming(input: KitchenTimingInput): Promise<KitchenTiming> {
  const sb = createServiceClient();
  const buffer = input.bufferMin ?? 3;
  const cookStartAt = new Date(
    input.tourPickupAt.getTime() - (input.estimatedPrepMin + buffer) * 60_000,
  );
  const readyTarget = new Date(
    input.tourPickupAt.getTime() - buffer * 60_000,
  );

  const now = new Date();
  const shouldNotifyNow = cookStartAt <= now;

  const row = {
    location_id:     input.locationId,
    order_id:        input.orderId,
    batch_id:        input.batchId,
    tour_pickup_at:  input.tourPickupAt.toISOString(),
    cook_start_at:   cookStartAt.toISOString(),
    ready_target:    readyTarget.toISOString(),
    prep_min:        input.estimatedPrepMin,
    buffer_min:      buffer,
    status:          shouldNotifyNow ? 'cooking' : 'scheduled',
    notified_at:     shouldNotifyNow ? now.toISOString() : null,
    updated_at:      now.toISOString(),
  };

  const { data, error } = await sb
    .from('kitchen_timings')
    .upsert(row, { onConflict: 'order_id' })
    .select()
    .single();

  if (error) throw new Error(`kitchen_timings upsert failed: ${error.message}`);

  return parseRow(data);
}

/** Markiert eine Bestellung als in Zubereitung (Küche hat gestartet). */
export async function markCooking(orderId: string): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('kitchen_timings')
    .update({ status: 'cooking', notified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('status', 'scheduled');
}

/** Markiert eine Bestellung als fertig (bereit zur Abholung). */
export async function markReady(orderId: string, locationId?: string): Promise<void> {
  const sb = createServiceClient();
  const now = new Date().toISOString();
  await sb
    .from('kitchen_timings')
    .update({ status: 'ready', ready_at: now, updated_at: now })
    .eq('order_id', orderId);

  // Prep-Zeit-Beobachtung asynchron aufzeichnen (fire-and-forget)
  if (locationId) {
    import('@/lib/delivery/kitchen-prep-learning')
      .then(({ recordPrepObservation }) => recordPrepObservation(orderId, locationId))
      .catch(() => {});
  }
}

/** Markiert eine Bestellung als abgeholt. */
export async function markPickedUp(orderId: string): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('kitchen_timings')
    .update({ status: 'picked_up', updated_at: new Date().toISOString() })
    .eq('order_id', orderId);
}

/** Lädt alle aktiven Küchen-Timings für eine Location (für Küchen-Dashboard). */
export async function getKitchenQueue(locationId: string): Promise<KitchenTiming[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('kitchen_timings')
    .select('*')
    .eq('location_id', locationId)
    .in('status', ['scheduled', 'cooking', 'ready'])
    .order('cook_start_at', { ascending: true });

  return (data ?? []).map(parseRow);
}

/**
 * Prüft alle geplanten Timings und triggert Benachrichtigungen für fällige Bestellungen.
 * Wird vom Cron alle 30 Sekunden aufgerufen.
 */
export async function syncKitchenNotifications(): Promise<{
  notified: number;
  locations: string[];
}> {
  const sb = createServiceClient();
  const now = new Date();

  const { data: due } = await sb
    .from('kitchen_timings')
    .select('id, order_id, location_id, batch_id')
    .eq('status', 'scheduled')
    .lte('cook_start_at', now.toISOString())
    .is('notified_at', null)
    .limit(100);

  if (!due || due.length === 0) return { notified: 0, locations: [] };

  const ids = due.map((r) => r.id as string);
  await sb
    .from('kitchen_timings')
    .update({ status: 'cooking', notified_at: now.toISOString(), updated_at: now.toISOString() })
    .in('id', ids);

  const locations = [...new Set(due.map((r) => r.location_id as string))];
  return { notified: ids.length, locations };
}

function parseRow(r: Record<string, unknown>): KitchenTiming {
  return {
    id:           r.id as string,
    orderId:      r.order_id as string,
    batchId:      (r.batch_id as string | null) ?? null,
    tourPickupAt: new Date(r.tour_pickup_at as string),
    cookStartAt:  new Date(r.cook_start_at as string),
    readyTarget:  new Date(r.ready_target as string),
    prepMin:      r.prep_min as number,
    bufferMin:    r.buffer_min as number,
    status:       r.status as KitchenTiming['status'],
    notifiedAt:   r.notified_at ? new Date(r.notified_at as string) : null,
  };
}

// ---------------------------------------------------------------------------
// Handoff-Rate Tages-Snapshots (Phase 375)
// Aggregiert täglich: fertig_am → abgeholt_am Wartezeiten je Standort
// ---------------------------------------------------------------------------

export interface HandoffRateDailyRow {
  id: string;
  locationId: string;
  snapshotDate: string;
  totalOrders: number;
  quickPickups: number;
  okPickups: number;
  latePickups: number;
  avgWaitMin: number | null;
  p50WaitMin: number | null;
  p75WaitMin: number | null;
  p95WaitMin: number | null;
  maxWaitMin: number | null;
  quickRatePct: number | null;
  okRatePct: number | null;
  lateRatePct: number | null;
  peakWaitHour: number | null;
  createdAt: string;
}

function calcPercentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, idx)] * 100) / 100;
}

/** Berechnet und persistiert den Handoff-Rate-Snapshot für einen Tag. */
export async function snapshotHandoffRateDaily(
  locationId: string,
  date?: string,
): Promise<{ snapshotDate: string; totalOrders: number; saved: boolean }> {
  const sb = createServiceClient();
  const snapshotDate = date ?? new Date().toISOString().slice(0, 10);

  // Berliner Tagesgrenzen (UTC+2 Sommer / UTC+1 Winter — konservativ UTC+1)
  const dayStart = new Date(`${snapshotDate}T00:00:00+01:00`).toISOString();
  const dayEnd   = new Date(`${snapshotDate}T23:59:59+01:00`).toISOString();

  const { data: orders } = await sb
    .from('customer_orders')
    .select('fertig_am, abgeholt_am')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .not('fertig_am', 'is', null)
    .not('abgeholt_am', 'is', null)
    .gte('fertig_am', dayStart)
    .lte('fertig_am', dayEnd)
    .limit(2000);

  if (!orders || orders.length === 0) {
    return { snapshotDate, totalOrders: 0, saved: false };
  }

  const waits = orders
    .map((o) => Math.max(
      0,
      (new Date(o.abgeholt_am as string).getTime() - new Date(o.fertig_am as string).getTime()) / 60_000,
    ))
    .sort((a, b) => a - b);

  const total  = waits.length;
  const quick  = waits.filter((w) => w < 3).length;
  const ok     = waits.filter((w) => w >= 3 && w <= 5).length;
  const late   = waits.filter((w) => w > 5).length;
  const avg    = waits.reduce((s, w) => s + w, 0) / total;

  // Stunde mit den meisten verspäteten Abholungen (Berlin-Stunde)
  const lateHourCounts: Record<number, number> = {};
  for (const o of orders) {
    const waitMin = (new Date(o.abgeholt_am as string).getTime() - new Date(o.fertig_am as string).getTime()) / 60_000;
    if (waitMin > 5) {
      // Berliner Stunde (UTC+1 als Näherung)
      const hour = (new Date(o.fertig_am as string).getUTCHours() + 1) % 24;
      lateHourCounts[hour] = (lateHourCounts[hour] ?? 0) + 1;
    }
  }
  const peakWaitHour = Object.keys(lateHourCounts).length > 0
    ? Number(Object.entries(lateHourCounts).sort((a, b) => b[1] - a[1])[0][0])
    : null;

  const round2 = (n: number) => Math.round(n * 100) / 100;

  const row = {
    location_id:    locationId,
    snapshot_date:  snapshotDate,
    total_orders:   total,
    quick_pickups:  quick,
    ok_pickups:     ok,
    late_pickups:   late,
    avg_wait_min:   round2(avg),
    p50_wait_min:   calcPercentile(waits, 50),
    p75_wait_min:   calcPercentile(waits, 75),
    p95_wait_min:   calcPercentile(waits, 95),
    max_wait_min:   round2(waits[waits.length - 1]),
    quick_rate_pct: round2((quick / total) * 100),
    ok_rate_pct:    round2((ok    / total) * 100),
    late_rate_pct:  round2((late  / total) * 100),
    peak_wait_hour: peakWaitHour,
    updated_at:     new Date().toISOString(),
  };

  const { error } = await sb
    .from('handoff_rate_daily')
    .upsert(row, { onConflict: 'location_id,snapshot_date' });

  if (error) throw new Error(`handoff_rate_daily upsert failed: ${error.message}`);

  return { snapshotDate, totalOrders: total, saved: true };
}

/** Cron-Batch: Snapshot für alle aktiven Standorte. */
export async function snapshotHandoffRateDailyAllLocations(
  date?: string,
): Promise<{ locations: number; saved: number; errors: number }> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('is_active', true);
  if (!locs || locs.length === 0) return { locations: 0, saved: 0, errors: 0 };

  const results = await Promise.allSettled(
    locs.map((l) => snapshotHandoffRateDaily(l.id as string, date)),
  );
  const saved  = results.filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ saved: boolean }>).value.saved).length;
  const errors = results.filter((r) => r.status === 'rejected').length;
  return { locations: locs.length, saved, errors };
}

/** Liest historische Handoff-Rate-Snapshots für Trend-Chart. */
export async function getHandoffRateDailyHistory(
  locationId: string,
  days: number = 30,
): Promise<HandoffRateDailyRow[]> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data } = await sb
    .from('handoff_rate_daily')
    .select('*')
    .eq('location_id', locationId)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true });
  return (data ?? []).map(parseHandoffRow);
}

/** Bereinigt alte Snapshots (via DB-Funktion). */
export async function pruneHandoffRateDaily(daysToKeep: number = 180): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_handoff_rate_daily', { days_to_keep: daysToKeep });
  return { pruned: (data as number) ?? 0 };
}

function parseHandoffRow(r: Record<string, unknown>): HandoffRateDailyRow {
  return {
    id:           r.id as string,
    locationId:   r.location_id as string,
    snapshotDate: r.snapshot_date as string,
    totalOrders:  r.total_orders as number,
    quickPickups: r.quick_pickups as number,
    okPickups:    r.ok_pickups as number,
    latePickups:  r.late_pickups as number,
    avgWaitMin:   r.avg_wait_min as number | null,
    p50WaitMin:   r.p50_wait_min as number | null,
    p75WaitMin:   r.p75_wait_min as number | null,
    p95WaitMin:   r.p95_wait_min as number | null,
    maxWaitMin:   r.max_wait_min as number | null,
    quickRatePct: r.quick_rate_pct as number | null,
    okRatePct:    r.ok_rate_pct as number | null,
    lateRatePct:  r.late_rate_pct as number | null,
    peakWaitHour: r.peak_wait_hour as number | null,
    createdAt:    r.created_at as string,
  };
}
