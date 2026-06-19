/**
 * lib/delivery/tour-completion-analysis.ts
 *
 * Phase 259 — Tour-Abschluss-Analyse
 *
 * Detaillierte Auswertung abgeschlossener Touren:
 *  - Stop-Level ETA-Abweichungen (geplant vs. tatsächlich)
 *  - Km-Statistik + Pünktlichkeitsrate
 *  - Fahrer-Zusammenfassung (Score, Trinkgeld, Bonus-Vorschau)
 *  - Admin-Liste abgeschlossener Touren mit Quick-Stats
 *
 * Öffentliche API:
 *  getTourCompletionReport(batchId, locationId)     — Vollständige Tour-Analyse
 *  getDriverTourSummary(batchId, driverId)          — Fahrer-facing Zusammenfassung
 *  listCompletedTours(locationId, opts)             — Admin-Liste abgeschlossener Touren
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { haversineKm } from '@/lib/google-maps';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface StopDeviationRecord {
  stopId: string;
  orderId: string;
  sequence: number;
  stopType: 'pickup' | 'dropoff';
  address: string | null;
  lat: number | null;
  lng: number | null;
  etaLatest: string | null;
  completedAt: string | null;
  deviationMin: number | null;    // positiv = zu spät, negativ = zu früh
  onTime: boolean | null;
  customerName: string | null;
  bestellnummer: string | null;
  zone: string | null;
}

export interface TourCompletionReport {
  batchId: string;
  locationId: string;
  driverId: string | null;
  driverName: string | null;
  state: string;
  vehicleType: string;
  createdAt: string;
  firstPickupAt: string | null;
  lastDeliveryAt: string | null;
  totalDurationMin: number | null;
  totalRouteKm: number;
  plannedStops: number;
  completedStops: number;
  onTimeStops: number;
  lateStops: number;
  onTimePct: number | null;
  avgDeviationMin: number | null;
  maxLateMin: number | null;
  bundleEfficiencyScore: number | null;
  stops: StopDeviationRecord[];
  snapshotExists: boolean;
  computedAt: string;
}

export interface DriverTourSummary {
  batchId: string;
  driverId: string;
  driverName: string | null;
  completedStops: number;
  totalRouteKm: number;
  totalDurationMin: number | null;
  onTimePct: number | null;
  totalTipEur: number;
  compositeScore: number | null;
  scoreGrade: string | null;
  bonusPreviewEur: number | null;
  bundleEfficiencyScore: number | null;
  vehicleType: string;
  completedAt: string | null;
}

export interface CompletedTourListItem {
  batchId: string;
  driverId: string | null;
  driverName: string | null;
  vehicleType: string;
  completedStops: number;
  plannedStops: number;
  onTimePct: number | null;
  totalRouteKm: number | null;
  totalDurationMin: number | null;
  bundleEfficiencyScore: number | null;
  completedAt: string;
  zone: string | null;
}

export interface ListCompletedToursOpts {
  days?: number;
  limit?: number;
  driverId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeRouteKm(
  stops: Array<{ lat: number | null; lng: number | null; completed_at: string | null; arrived_at?: string | null }>,
): number {
  const ordered = [...stops]
    .filter((s) => s.lat != null && s.lng != null)
    .sort((a, b) => {
      const ta = a.arrived_at ?? a.completed_at ?? '';
      const tb = b.arrived_at ?? b.completed_at ?? '';
      return ta.localeCompare(tb);
    });

  let km = 0;
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const curr = ordered[i];
    if (prev.lat != null && prev.lng != null && curr.lat != null && curr.lng != null) {
      km += haversineKm(
        { lat: prev.lat, lng: prev.lng },
        { lat: curr.lat, lng: curr.lng },
      );
    }
  }
  return Math.round(km * 100) / 100;
}

// ── getTourCompletionReport ───────────────────────────────────────────────────

export async function getTourCompletionReport(
  batchId: string,
  locationId: string,
): Promise<TourCompletionReport | null> {
  const sb = createServiceClient();

  const { data: batchRaw } = await sb
    .from('mise_delivery_batches')
    .select(`
      id, location_id, driver_id, state, zone, created_at,
      delivery_drivers ( name, vehicle )
    `)
    .eq('id', batchId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!batchRaw) return null;

  const batch = batchRaw as unknown as {
    id: string;
    location_id: string;
    driver_id: string | null;
    state: string;
    zone: string | null;
    created_at: string;
    delivery_drivers: { name: string | null; vehicle: string | null } | null;
  };

  const { data: stopsRaw } = await sb
    .from('mise_delivery_batch_stops')
    .select(`
      id, order_id, type, sequence, lat, lng, address, arrived_at, completed_at,
      customer_orders (
        id, bestellnummer, kunde_name, delivery_zone, eta_latest, tip_eur
      )
    `)
    .eq('batch_id', batchId)
    .order('sequence', { ascending: true });

  type RawStop = {
    id: string;
    order_id: string;
    type: string;
    sequence: number;
    lat: number | null;
    lng: number | null;
    address: string | null;
    arrived_at: string | null;
    completed_at: string | null;
    customer_orders: {
      id: string;
      bestellnummer: string | null;
      kunde_name: string | null;
      delivery_zone: string | null;
      eta_latest: string | null;
      tip_eur: number | null;
    } | null;
  };

  const stops: RawStop[] = (stopsRaw ?? []) as unknown as RawStop[];

  // Snapshot aus tour_performance_snapshots
  const { data: snap } = await sb
    .from('tour_performance_snapshots')
    .select('bundle_efficiency_score, on_time_stops, late_stops, total_route_km, actual_delivery_min, first_pickup_at, last_delivery_at')
    .eq('batch_id', batchId)
    .maybeSingle();

  const snapshotExists = snap != null;
  const dropoffs = stops.filter((s) => s.type === 'dropoff');
  const pickups = stops.filter((s) => s.type === 'pickup');

  // Timestamps
  const pickupTimes = pickups
    .map((s) => s.arrived_at ?? s.completed_at)
    .filter(Boolean)
    .map((t) => new Date(t!).getTime());
  const firstPickupAt =
    pickupTimes.length > 0 ? new Date(Math.min(...pickupTimes)).toISOString() : null;

  const deliveryTimes = dropoffs
    .filter((s) => s.completed_at)
    .map((s) => new Date(s.completed_at!).getTime());
  const lastDeliveryAt =
    deliveryTimes.length > 0 ? new Date(Math.max(...deliveryTimes)).toISOString() : null;

  const totalDurationMin =
    firstPickupAt && lastDeliveryAt
      ? Math.round(
          (new Date(lastDeliveryAt).getTime() - new Date(firstPickupAt).getTime()) / 60_000,
        )
      : null;

  // Stop-level Abweichungen
  const stopRecords: StopDeviationRecord[] = stops.map((s) => {
    const etaLatest = s.customer_orders?.eta_latest ?? null;
    const completedAt = s.completed_at ?? null;
    let deviationMin: number | null = null;
    let onTime: boolean | null = null;

    if (etaLatest && completedAt && s.type === 'dropoff') {
      deviationMin = Math.round(
        (new Date(completedAt).getTime() - new Date(etaLatest).getTime()) / 60_000,
      );
      onTime = deviationMin <= 0;
    }

    return {
      stopId: s.id,
      orderId: s.order_id,
      sequence: s.sequence,
      stopType: s.type as 'pickup' | 'dropoff',
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      etaLatest,
      completedAt,
      deviationMin,
      onTime,
      customerName: s.customer_orders?.kunde_name ?? null,
      bestellnummer: s.customer_orders?.bestellnummer ?? null,
      zone: s.customer_orders?.delivery_zone ?? null,
    };
  });

  const dropoffRecords = stopRecords.filter((s) => s.stopType === 'dropoff');
  const completedDropoffs = dropoffRecords.filter((s) => s.completedAt != null);
  const onTimeStops = completedDropoffs.filter((s) => s.onTime === true).length;
  const lateStops = completedDropoffs.filter((s) => s.onTime === false).length;
  const onTimePct =
    completedDropoffs.length > 0
      ? Math.round((onTimeStops / completedDropoffs.length) * 100)
      : null;

  const deviations = completedDropoffs
    .map((s) => s.deviationMin)
    .filter((d): d is number => d != null);
  const avgDeviationMin =
    deviations.length > 0
      ? Math.round(deviations.reduce((a, b) => a + b, 0) / deviations.length)
      : null;
  const maxLateMin =
    deviations.length > 0 ? Math.max(...deviations) : null;

  const totalRouteKm = snap?.total_route_km != null
    ? Number(snap.total_route_km)
    : computeRouteKm(stops.map((s) => ({ lat: s.lat, lng: s.lng, arrived_at: s.arrived_at, completed_at: s.completed_at })));

  const driverRaw = batch.delivery_drivers as { name: string | null; vehicle: string | null } | null;

  return {
    batchId,
    locationId,
    driverId: batch.driver_id,
    driverName: driverRaw?.name ?? null,
    state: batch.state,
    vehicleType: driverRaw?.vehicle ?? 'car',
    createdAt: batch.created_at,
    firstPickupAt: snap?.first_pickup_at ?? firstPickupAt,
    lastDeliveryAt: snap?.last_delivery_at ?? lastDeliveryAt,
    totalDurationMin: snap?.actual_delivery_min != null
      ? Math.round(Number(snap.actual_delivery_min))
      : totalDurationMin,
    totalRouteKm,
    plannedStops: dropoffs.length,
    completedStops: completedDropoffs.length,
    onTimeStops,
    lateStops,
    onTimePct,
    avgDeviationMin,
    maxLateMin: maxLateMin != null && maxLateMin > 0 ? maxLateMin : null,
    bundleEfficiencyScore: snap?.bundle_efficiency_score != null
      ? Number(snap.bundle_efficiency_score)
      : null,
    stops: stopRecords,
    snapshotExists,
    computedAt: new Date().toISOString(),
  };
}

// ── getDriverTourSummary ──────────────────────────────────────────────────────

export async function getDriverTourSummary(
  batchId: string,
  driverId: string,
): Promise<DriverTourSummary | null> {
  const sb = createServiceClient();

  // Batch validieren und Fahrerzugehörigkeit prüfen
  const { data: batchRaw } = await sb
    .from('mise_delivery_batches')
    .select(`
      id, location_id, driver_id, state, zone, created_at,
      delivery_drivers ( name, vehicle )
    `)
    .eq('id', batchId)
    .eq('driver_id', driverId)
    .maybeSingle();

  if (!batchRaw) return null;

  const batch = batchRaw as unknown as {
    id: string;
    location_id: string;
    driver_id: string | null;
    state: string;
    created_at: string;
    delivery_drivers: { name: string | null; vehicle: string | null } | null;
  };

  const [stopsRes, snapRes, scoreRes, bonusRes] = await Promise.all([
    // Stops mit Trinkgeld
    sb
      .from('mise_delivery_batch_stops')
      .select(`
        id, type, sequence, arrived_at, completed_at, lat, lng,
        customer_orders ( tip_eur, eta_latest, delivery_zone )
      `)
      .eq('batch_id', batchId),

    // Performance-Snapshot
    sb
      .from('tour_performance_snapshots')
      .select('bundle_efficiency_score, on_time_stops, late_stops, total_route_km, actual_delivery_min, last_delivery_at')
      .eq('batch_id', batchId)
      .maybeSingle(),

    // Composite Score (aktuelle Woche)
    sb
      .from('driver_composite_scores')
      .select('composite_score, grade')
      .eq('driver_id', driverId)
      .eq('location_id', batch.location_id)
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Aktive Score-Bonus-Trigger für Bonus-Vorschau
    sb
      .from('driver_score_bonus_triggers')
      .select('score_threshold, bonus_type, bonus_value')
      .eq('location_id', batch.location_id)
      .eq('enabled', true)
      .order('score_threshold', { ascending: false }),
  ]);

  type RawStop = {
    id: string;
    type: string;
    sequence: number;
    arrived_at: string | null;
    completed_at: string | null;
    lat: number | null;
    lng: number | null;
    customer_orders: {
      tip_eur: number | null;
      eta_latest: string | null;
      delivery_zone: string | null;
    } | null;
  };

  const stops: RawStop[] = (stopsRes.data ?? []) as unknown as RawStop[];
  const snap = snapRes.data as {
    bundle_efficiency_score: number | null;
    on_time_stops: number | null;
    late_stops: number | null;
    total_route_km: number | null;
    actual_delivery_min: number | null;
    last_delivery_at: string | null;
  } | null;
  const score = scoreRes.data as { composite_score: number; grade: string } | null;
  const triggers = (bonusRes.data ?? []) as Array<{
    score_threshold: number;
    bonus_type: string;
    bonus_value: number;
  }>;

  const dropoffs = stops.filter((s) => s.type === 'dropoff');
  const completedDropoffs = dropoffs.filter((s) => s.completed_at != null);

  // Trinkgeld summieren
  const totalTipEur = completedDropoffs.reduce(
    (sum, s) => sum + (Number(s.customer_orders?.tip_eur ?? 0)),
    0,
  );

  // Pünktlichkeit
  let onTimeCount = 0;
  for (const s of completedDropoffs) {
    const etaLatest = s.customer_orders?.eta_latest;
    if (etaLatest && s.completed_at && new Date(s.completed_at) <= new Date(etaLatest)) {
      onTimeCount++;
    }
  }
  const onTimePct =
    completedDropoffs.length > 0
      ? Math.round((onTimeCount / completedDropoffs.length) * 100)
      : null;

  const totalRouteKm = snap?.total_route_km != null
    ? Number(snap.total_route_km)
    : computeRouteKm(stops.map((s) => ({ lat: s.lat, lng: s.lng, arrived_at: s.arrived_at, completed_at: s.completed_at })));

  const totalDurationMin = snap?.actual_delivery_min != null
    ? Math.round(Number(snap.actual_delivery_min))
    : null;

  // Bonus-Vorschau: nächster erreichbarer Trigger über aktuellem Score
  let bonusPreviewEur: number | null = null;
  if (score != null && triggers.length > 0) {
    const compositeScore = score.composite_score;
    const nextTrigger = triggers.find((t) => t.score_threshold <= compositeScore);
    if (nextTrigger && nextTrigger.bonus_type === 'flat_eur') {
      bonusPreviewEur = Number(nextTrigger.bonus_value);
    }
  }

  const driverRaw = batch.delivery_drivers as { name: string | null; vehicle: string | null } | null;

  return {
    batchId,
    driverId,
    driverName: driverRaw?.name ?? null,
    completedStops: completedDropoffs.length,
    totalRouteKm,
    totalDurationMin,
    onTimePct,
    totalTipEur: Math.round(totalTipEur * 100) / 100,
    compositeScore: score?.composite_score ?? null,
    scoreGrade: score?.grade ?? null,
    bonusPreviewEur,
    bundleEfficiencyScore: snap?.bundle_efficiency_score != null
      ? Number(snap.bundle_efficiency_score)
      : null,
    vehicleType: driverRaw?.vehicle ?? 'car',
    completedAt: snap?.last_delivery_at ?? null,
  };
}

// ── listCompletedTours ────────────────────────────────────────────────────────

export async function listCompletedTours(
  locationId: string,
  opts: ListCompletedToursOpts = {},
): Promise<CompletedTourListItem[]> {
  const { days = 7, limit = 30, driverId } = opts;
  const sb = createServiceClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let query = sb
    .from('tour_performance_snapshots')
    .select(`
      batch_id, driver_id, vehicle_type, planned_stops, actual_stops,
      on_time_stops, late_stops, total_route_km, actual_delivery_min,
      bundle_efficiency_score, last_delivery_at, completed_at
    `)
    .eq('location_id', locationId)
    .gte('completed_at', since)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (driverId) {
    query = query.eq('driver_id', driverId);
  }

  const { data: snapshots } = await query;

  if (!snapshots || snapshots.length === 0) return [];

  type SnapRow = {
    batch_id: string;
    driver_id: string | null;
    vehicle_type: string | null;
    planned_stops: number | null;
    actual_stops: number | null;
    on_time_stops: number | null;
    late_stops: number | null;
    total_route_km: number | null;
    actual_delivery_min: number | null;
    bundle_efficiency_score: number | null;
    last_delivery_at: string | null;
    completed_at: string;
  };

  const rows = snapshots as SnapRow[];

  // Fahrernamen batch-laden
  const driverIds = [...new Set(rows.map((r) => r.driver_id).filter(Boolean))] as string[];
  const driverMap = new Map<string, string>();
  if (driverIds.length > 0) {
    const { data: drivers } = await sb
      .from('mise_drivers')
      .select('id, name')
      .in('id', driverIds);
    for (const d of drivers ?? []) {
      driverMap.set(d.id as string, d.name as string);
    }
  }

  // Zone pro Batch nachladen
  const batchIds = rows.map((r) => r.batch_id);
  const { data: batches } = await sb
    .from('mise_delivery_batches')
    .select('id, zone')
    .in('id', batchIds);
  const zoneMap = new Map<string, string | null>();
  for (const b of batches ?? []) {
    zoneMap.set(b.id as string, (b.zone as string) ?? null);
  }

  return rows.map((r) => {
    const actualStops = Number(r.actual_stops ?? 0);
    const onTimeStops = Number(r.on_time_stops ?? 0);
    const onTimePct =
      actualStops > 0 ? Math.round((onTimeStops / actualStops) * 100) : null;

    return {
      batchId: r.batch_id,
      driverId: r.driver_id,
      driverName: r.driver_id ? (driverMap.get(r.driver_id) ?? null) : null,
      vehicleType: r.vehicle_type ?? 'car',
      completedStops: actualStops,
      plannedStops: Number(r.planned_stops ?? 0),
      onTimePct,
      totalRouteKm: r.total_route_km != null ? Number(r.total_route_km) : null,
      totalDurationMin: r.actual_delivery_min != null ? Math.round(Number(r.actual_delivery_min)) : null,
      bundleEfficiencyScore: r.bundle_efficiency_score != null ? Number(r.bundle_efficiency_score) : null,
      completedAt: r.last_delivery_at ?? r.completed_at,
      zone: zoneMap.get(r.batch_id) ?? null,
    };
  });
}
