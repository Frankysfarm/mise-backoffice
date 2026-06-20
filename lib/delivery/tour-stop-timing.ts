/**
 * lib/delivery/tour-stop-timing.ts
 *
 * Tour-Stopp Smart-Timing & Ankunfts-Prognose Engine — Phase 315.
 *
 * Berechnet für jeden offenen Tour-Stopp eine Echtzeit-ETA,
 * Pünktlichkeits-Score und Risiko-Klassifizierung.
 *
 * Kernfunktionen:
 *  - getStopTimingMatrix()     — Matrix aller aktiven Stopps mit ETA + Status
 *  - getDriverNextStopEta()    — ETA für den nächsten Stopp eines Fahrers
 *  - getStopTimingStats()      — Aggregierte Stopp-Timing-Statistiken für die Schicht
 *  - recordStopArrival()       — Ankunft erfassen für Lernmodell
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StopStatus = 'pending' | 'next' | 'en_route' | 'arrived' | 'delivered' | 'late' | 'at_risk';

export interface StopTimingEntry {
  stopId: string;
  batchId: string;
  orderId: string;
  reihenfolge: number;
  driverId: string | null;
  driverName: string;
  kundeAdresse: string | null;
  kundeName: string | null;
  etaEarliest: Date | null;
  etaLatest: Date | null;
  predictedArrivalAt: Date | null;
  remainingMinutes: number | null;
  stopStatus: StopStatus;
  delayMinutes: number | null;
  onTimeProb: number;
  isNext: boolean;
  completedAt: Date | null;
}

export interface StopTimingMatrix {
  activeTours: number;
  totalPendingStops: number;
  lateStops: number;
  atRiskStops: number;
  onTimeStops: number;
  entries: StopTimingEntry[];
  generatedAt: Date;
}

export interface DriverNextStopEta {
  driverId: string;
  driverName: string;
  nextStop: StopTimingEntry | null;
  stopsRemaining: number;
  tourEtaMin: number | null;
  tourHealth: 'on_time' | 'at_risk' | 'late' | 'unknown';
}

export interface StopTimingStats {
  avgStopDurationMin: number;
  avgDeliveryTimeMin: number;
  onTimePct: number;
  latePct: number;
  totalStopsCompleted: number;
  avgDelayMinutes: number;
  bestDriverId: string | null;
  bestDriverName: string | null;
  bestDriverOnTimePct: number;
  perHour: Array<{ hour: number; label: string; completed: number; onTime: number; avgDelayMin: number }>;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function minutesUntil(date: Date): number {
  return Math.round((date.getTime() - Date.now()) / 60_000);
}

function classifyStopStatus(
  eta: Date | null,
  completedAt: Date | null,
  isNext: boolean,
  remainMin: number | null,
): StopStatus {
  if (completedAt) return 'delivered';
  if (!eta) return isNext ? 'next' : 'pending';
  const diffMin = minutesUntil(eta);
  if (diffMin < -5) return 'late';
  if (diffMin < 3) return 'at_risk';
  if (isNext) return 'en_route';
  return 'pending';
}

function onTimeProb(remainMin: number | null, bufferMin: number): number {
  if (remainMin === null) return 0.7;
  if (remainMin > bufferMin + 10) return 0.95;
  if (remainMin > bufferMin + 3) return 0.80;
  if (remainMin > 0) return 0.55;
  return 0.15;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Liefert die vollständige Stopp-Timing-Matrix für alle aktiven Touren
 * einer Filiale (oder systemweit wenn locationId null).
 */
export async function getStopTimingMatrix(locationId?: string | null): Promise<StopTimingMatrix> {
  const supabase = createServiceClient();
  const now = new Date();

  // Aktive Batches laden
  let batchQuery = supabase
    .from('delivery_batches')
    .select(`
      id, driver_id, abfahrt_um, eta_minuten, zone,
      driver:employees!delivery_batches_driver_id_fkey(vorname, nachname),
      stops:delivery_stops(
        id, order_id, reihenfolge, angekommen_am, geliefert_am,
        order:customer_orders!delivery_stops_order_id_fkey(
          id, bestellnummer, kunde_name, kunde_adresse,
          eta_earliest, eta_latest, status
        )
      )
    `)
    .in('status', ['unterwegs', 'zusammengestellt'])
    .order('abfahrt_um', { ascending: true });

  if (locationId) {
    batchQuery = batchQuery.eq('location_id', locationId);
  }

  const { data: batches, error } = await batchQuery;
  if (error || !batches) {
    return {
      activeTours: 0, totalPendingStops: 0, lateStops: 0,
      atRiskStops: 0, onTimeStops: 0, entries: [], generatedAt: now,
    };
  }

  const entries: StopTimingEntry[] = [];

  for (const batch of batches) {
    const driver = Array.isArray(batch.driver) ? batch.driver[0] : batch.driver;
    const driverName = driver
      ? `${driver.vorname ?? ''} ${driver.nachname ?? ''}`.trim() || 'Fahrer'
      : 'Unbekannt';

    const stops = (batch.stops ?? []).sort(
      (a: { reihenfolge: number }, b: { reihenfolge: number }) => a.reihenfolge - b.reihenfolge,
    );

    // Erster offener Stopp ist "next"
    let nextFound = false;
    const departedAt = batch.abfahrt_um ? new Date(batch.abfahrt_um) : null;
    const etaMin = batch.eta_minuten ?? 30;

    for (const stop of stops) {
      const order = Array.isArray(stop.order) ? stop.order[0] : stop.order;
      const completedAt = stop.geliefert_am ? new Date(stop.geliefert_am) : null;

      const isNext = !completedAt && !nextFound;
      if (isNext) nextFound = true;

      // ETA berechnen: Verwende Order-ETA falls vorhanden, sonst schätze basierend auf Abfahrt + Position
      let etaEarliest: Date | null = null;
      let etaLatest: Date | null = null;

      if (order?.eta_earliest) {
        etaEarliest = new Date(order.eta_earliest);
      } else if (departedAt) {
        const offsetMin = stop.reihenfolge * (etaMin / Math.max(stops.length, 1));
        etaEarliest = new Date(departedAt.getTime() + offsetMin * 60_000);
      }

      if (order?.eta_latest) {
        etaLatest = new Date(order.eta_latest);
      } else if (etaEarliest) {
        etaLatest = new Date(etaEarliest.getTime() + 10 * 60_000);
      }

      // Voraussichtliche Ankunft: Mittelpunkt des ETA-Fensters
      const predictedArrivalAt = etaEarliest && etaLatest
        ? new Date((etaEarliest.getTime() + etaLatest.getTime()) / 2)
        : etaEarliest;

      const remainingMinutes = predictedArrivalAt ? minutesUntil(predictedArrivalAt) : null;
      const delayMin = completedAt === null && etaLatest && now > etaLatest
        ? Math.round((now.getTime() - etaLatest.getTime()) / 60_000)
        : null;

      const stopStatus = classifyStopStatus(etaLatest, completedAt, isNext, remainingMinutes);
      const prob = onTimeProb(remainingMinutes, 5);

      entries.push({
        stopId: stop.id,
        batchId: batch.id,
        orderId: stop.order_id,
        reihenfolge: stop.reihenfolge,
        driverId: batch.driver_id ?? null,
        driverName,
        kundeAdresse: order?.kunde_adresse ?? null,
        kundeName: order?.kunde_name ?? null,
        etaEarliest,
        etaLatest,
        predictedArrivalAt,
        remainingMinutes,
        stopStatus,
        delayMinutes: delayMin,
        onTimeProb: prob,
        isNext,
        completedAt,
      });
    }
  }

  const pendingEntries = entries.filter(e => !e.completedAt);
  const lateEntries = entries.filter(e => e.stopStatus === 'late');
  const atRiskEntries = entries.filter(e => e.stopStatus === 'at_risk');
  const onTimeEntries = entries.filter(e =>
    e.stopStatus === 'en_route' || e.stopStatus === 'next' || e.stopStatus === 'pending',
  );

  return {
    activeTours: batches.length,
    totalPendingStops: pendingEntries.length,
    lateStops: lateEntries.length,
    atRiskStops: atRiskEntries.length,
    onTimeStops: onTimeEntries.length,
    entries,
    generatedAt: now,
  };
}

/**
 * ETA-Daten für den nächsten Stopp eines spezifischen Fahrers.
 */
export async function getDriverNextStopEta(driverId: string): Promise<DriverNextStopEta | null> {
  const matrix = await getStopTimingMatrix();
  const driverEntries = matrix.entries.filter(e => e.driverId === driverId && !e.completedAt);
  const driverName = driverEntries[0]?.driverName ?? 'Fahrer';
  const nextStop = driverEntries.find(e => e.isNext) ?? null;
  const stopsRemaining = driverEntries.length;

  // Tour-Gesundheit aus dem schlechtesten Stopp ableiten
  const hasLate = driverEntries.some(e => e.stopStatus === 'late');
  const hasRisk = driverEntries.some(e => e.stopStatus === 'at_risk');
  const tourHealth = hasLate ? 'late' : hasRisk ? 'at_risk' : stopsRemaining > 0 ? 'on_time' : 'unknown';

  // Gesamte verbleibende Minuten = ETA des letzten Stopps
  const lastStop = driverEntries[driverEntries.length - 1];
  const tourEtaMin = lastStop?.remainingMinutes ?? null;

  return { driverId, driverName, nextStop, stopsRemaining, tourEtaMin, tourHealth };
}

/**
 * Aggregierte Stopp-Timing-Statistiken für die aktuelle Schicht.
 */
export async function getStopTimingStats(locationId?: string | null): Promise<StopTimingStats> {
  const supabase = createServiceClient();

  const shiftStart = new Date();
  shiftStart.setHours(shiftStart.getHours() - 8, 0, 0, 0);

  let q = supabase
    .from('delivery_stops')
    .select(`
      id, angekommen_am, geliefert_am, reihenfolge,
      batch:delivery_batches!delivery_stops_batch_id_fkey(
        driver_id, abfahrt_um, location_id,
        driver:employees!delivery_batches_driver_id_fkey(id, vorname, nachname)
      ),
      order:customer_orders!delivery_stops_order_id_fkey(
        eta_latest, eta_earliest
      )
    `)
    .gte('geliefert_am', shiftStart.toISOString())
    .not('geliefert_am', 'is', null);

  const { data: stops, error } = await q;

  if (error || !stops || stops.length === 0) {
    return {
      avgStopDurationMin: 0, avgDeliveryTimeMin: 0, onTimePct: 0, latePct: 0,
      totalStopsCompleted: 0, avgDelayMinutes: 0,
      bestDriverId: null, bestDriverName: null, bestDriverOnTimePct: 0, perHour: [],
    };
  }

  interface StopRow {
    id: string;
    angekommen_am: string | null;
    geliefert_am: string | null;
    reihenfolge: number;
    batch: Array<{
      driver_id: string | null;
      abfahrt_um: string | null;
      location_id: string | null;
      driver: Array<{ id: string; vorname: string; nachname: string }> | { id: string; vorname: string; nachname: string } | null;
    }> | {
      driver_id: string | null;
      abfahrt_um: string | null;
      location_id: string | null;
      driver: Array<{ id: string; vorname: string; nachname: string }> | { id: string; vorname: string; nachname: string } | null;
    } | null;
    order: Array<{
      eta_latest: string | null;
      eta_earliest: string | null;
    }> | {
      eta_latest: string | null;
      eta_earliest: string | null;
    } | null;
  }

  const filteredStops = (stops as unknown as StopRow[]).filter(s => {
    if (!locationId) return true;
    const b = Array.isArray(s.batch) ? s.batch[0] : s.batch;
    return b?.location_id === locationId;
  });

  let totalDuration = 0;
  let onTimeCount = 0;
  let lateCount = 0;
  let totalDelay = 0;
  const driverMap = new Map<string, { name: string; onTime: number; total: number }>();
  const hourMap = new Map<number, { completed: number; onTime: number; totalDelay: number }>();

  for (const stop of filteredStops) {
    const deliveredAt = stop.geliefert_am ? new Date(stop.geliefert_am) : null;
    if (!deliveredAt) continue;

    const batch = Array.isArray(stop.batch) ? stop.batch[0] : stop.batch;
    const order = Array.isArray(stop.order) ? stop.order[0] : stop.order;
    const driver = Array.isArray(batch?.driver) ? batch?.driver[0] : batch?.driver;

    const departAt = batch?.abfahrt_um ? new Date(batch.abfahrt_um) : null;
    if (departAt) {
      totalDuration += (deliveredAt.getTime() - departAt.getTime()) / 60_000;
    }

    const etaLatest = order?.eta_latest ? new Date(order.eta_latest) : null;
    let isOnTime = true;
    let delayMin = 0;

    if (etaLatest) {
      delayMin = Math.max(0, (deliveredAt.getTime() - etaLatest.getTime()) / 60_000);
      isOnTime = delayMin <= 2;
      if (!isOnTime) { lateCount++; totalDelay += delayMin; }
    }

    if (isOnTime) onTimeCount++;

    const hour = deliveredAt.getHours();
    const hEntry = hourMap.get(hour) ?? { completed: 0, onTime: 0, totalDelay: 0 };
    hEntry.completed++;
    if (isOnTime) hEntry.onTime++;
    hEntry.totalDelay += delayMin;
    hourMap.set(hour, hEntry);

    if (driver?.id) {
      const dEntry = driverMap.get(driver.id) ?? {
        name: `${driver.vorname ?? ''} ${driver.nachname ?? ''}`.trim(),
        onTime: 0, total: 0,
      };
      dEntry.total++;
      if (isOnTime) dEntry.onTime++;
      driverMap.set(driver.id, dEntry);
    }
  }

  const total = filteredStops.length;
  const onTimePct = total > 0 ? Math.round((onTimeCount / total) * 100) : 0;
  const latePct = total > 0 ? Math.round((lateCount / total) * 100) : 0;
  const avgDelayMin = lateCount > 0 ? Math.round(totalDelay / lateCount) : 0;
  const avgDeliveryTimeMin = total > 0 ? Math.round(totalDuration / total) : 0;

  // Bester Fahrer
  let bestDriverId: string | null = null;
  let bestDriverName: string | null = null;
  let bestPct = 0;
  for (const [id, d] of driverMap.entries()) {
    if (d.total >= 3) {
      const pct = Math.round((d.onTime / d.total) * 100);
      if (pct > bestPct) { bestPct = pct; bestDriverId = id; bestDriverName = d.name; }
    }
  }

  const perHour = Array.from(hourMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, h]) => ({
      hour,
      label: `${hour.toString().padStart(2, '0')}:00`,
      completed: h.completed,
      onTime: h.onTime,
      avgDelayMin: h.completed > 0 ? Math.round(h.totalDelay / h.completed) : 0,
    }));

  return {
    avgStopDurationMin: 0,
    avgDeliveryTimeMin,
    onTimePct,
    latePct,
    totalStopsCompleted: total,
    avgDelayMinutes: avgDelayMin,
    bestDriverId,
    bestDriverName,
    bestDriverOnTimePct: bestPct,
    perHour,
  };
}
