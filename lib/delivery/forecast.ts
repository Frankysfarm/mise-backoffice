/**
 * lib/delivery/forecast.ts
 *
 * Demand Forecasting Engine — Phase 19
 *
 * Lernt aus historischen Bestellmustern (letzte 8 Wochen) und
 * sagt den Lieferbedarf für die nächsten N Stunden vorher.
 * Die Empfehlungen werden zurück in coverage_requirements geschrieben
 * und verbessern so die Schichtplanung (Phase 17) kontinuierlich.
 *
 * Funktionen:
 *  - snapshotDemand()           — Stunden-Snapshot schreiben (Cron)
 *  - getForecast()              — Stundengenaue Vorhersage (next N h)
 *  - getRecommendedCoverage()   — Fahrer-Empfehlung aus Forecast
 *  - updateCoverageFromForecast() — Auto-Update coverage_requirements
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================
// Typen
// ============================================================

export interface DemandSnapshot {
  locationId: string;
  snapshotHour: string;   // ISO — UTC-Stunden-Bucket
  ordersCount: number;
  deliveredCount: number;
  avgDeliveryMin: number | null;
  peakZone: string | null;
}

export interface ForecastSlot {
  hourUtc: string;           // ISO — Stunden-Bucket der Vorhersage
  hourLocal: string;         // HH:MM in Europe/Berlin
  weekday: number;           // 0=So … 6=Sa
  hourOfDay: number;         // 0–23 (Berliner Zeit)
  expectedOrders: number;    // gerundete Erwartung
  confidenceOrders: number;  // erwartete ± Standardabweichung (1σ)
  peakOrders: number;        // historisches Maximum der Stunde
  dataPoints: number;        // Anzahl historischer Snapshots
  recommendedMinDrivers: number;
  recommendedTargetDrivers: number;
}

export interface ForecastResult {
  locationId: string;
  generatedAt: string;
  hoursAhead: number;
  slots: ForecastSlot[];
  summary: {
    totalExpectedOrders: number;
    peakSlot: string;         // ISO-Stunde mit höchster Erwartung
    peakExpectedOrders: number;
    recommendedMaxDrivers: number;
  };
}

export interface CoverageUpdateResult {
  locationId: string;
  slotsUpdated: number;
  slotsSkipped: number;
}

// ============================================================
// snapshotDemand
// ============================================================

/**
 * Schreibt einen Stunden-Snapshot für eine Location.
 * Zählt Bestellungen und gelieferte Orders der aktuellen UTC-Stunde.
 * Idempotent via UPSERT — kann beliebig oft aufgerufen werden.
 */
export async function snapshotDemand(locationId: string): Promise<DemandSnapshot> {
  const sb = createServiceClient();
  const now = new Date();
  // Runde auf volle UTC-Stunde
  const snapshotHour = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()),
  ).toISOString();

  const hourStart = snapshotHour;
  const hourEnd = new Date(new Date(snapshotHour).getTime() + 3_600_000).toISOString();

  // Bestellungen dieser Stunde
  const { data: orders } = await sb
    .from('customer_orders')
    .select('id, status, delivery_zone')
    .eq('location_id', locationId)
    .gte('created_at', hourStart)
    .lt('created_at', hourEnd);

  const ordersCount = orders?.length ?? 0;
  const deliveredCount = orders?.filter((o) => o.status === 'geliefert').length ?? 0;

  // Häufigste Zone
  const zoneCounts: Record<string, number> = {};
  for (const o of orders ?? []) {
    if (o.delivery_zone) zoneCounts[o.delivery_zone] = (zoneCounts[o.delivery_zone] ?? 0) + 1;
  }
  const peakZone = Object.keys(zoneCounts).sort((a, b) => zoneCounts[b] - zoneCounts[a])[0] ?? null;

  // Ø-Lieferzeit aus delivery_performance (letzte 7 Tage)
  const { data: perf } = await sb
    .from('delivery_performance')
    .select('delivery_min')
    .eq('location_id', locationId)
    .gte('recorded_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
    .not('delivery_min', 'is', null)
    .limit(200);

  const avgDeliveryMin =
    perf && perf.length > 0
      ? perf.reduce((s, r) => s + (r.delivery_min as number), 0) / perf.length
      : null;

  const snapshot: DemandSnapshot = {
    locationId,
    snapshotHour,
    ordersCount,
    deliveredCount,
    avgDeliveryMin: avgDeliveryMin !== null ? Math.round(avgDeliveryMin * 10) / 10 : null,
    peakZone,
  };

  await sb.from('delivery_demand_snapshots').upsert(
    {
      location_id:      locationId,
      snapshot_hour:    snapshotHour,
      orders_count:     ordersCount,
      delivered_count:  deliveredCount,
      avg_delivery_min: avgDeliveryMin,
      peak_zone:        peakZone,
      updated_at:       new Date().toISOString(),
    },
    { onConflict: 'location_id,snapshot_hour' },
  );

  return snapshot;
}

// ============================================================
// snapshotAllLocations
// ============================================================

/**
 * Snapshots für alle aktiven Locations (Cron-Helfer).
 * Fire-and-forget kompatibel.
 */
export async function snapshotAllLocations(): Promise<{ locations: number; snapshots: number }> {
  const sb = createServiceClient();
  const { data: locations } = await sb.from('locations').select('id').eq('active', true);
  if (!locations?.length) return { locations: 0, snapshots: 0 };

  const results = await Promise.allSettled(
    locations.map((loc) => snapshotDemand(loc.id)),
  );

  return {
    locations: locations.length,
    snapshots: results.filter((r) => r.status === 'fulfilled').length,
  };
}

// ============================================================
// getForecast
// ============================================================

/**
 * Gibt eine stundengenaue Nachfrage-Vorhersage für die nächsten
 * `hoursAhead` Stunden zurück, basierend auf dem Wochentag+Stunden-Muster.
 */
export async function getForecast(
  locationId: string,
  hoursAhead: number = 6,
): Promise<ForecastResult> {
  const sb = createServiceClient();
  const now = new Date();

  // Muster aus DB laden
  const { data: patterns } = await sb
    .from('v_hourly_demand_pattern')
    .select('*')
    .eq('location_id', locationId);

  // Empfehlungen
  const { data: recs } = await sb
    .from('v_forecast_coverage_recs')
    .select('*')
    .eq('location_id', locationId);

  // Index für schnellen Lookup: `${weekday}_${hourOfDay}`
  const patternMap = new Map<string, {
    avgOrders: number;
    stddevOrders: number;
    peakOrders: number;
    dataPoints: number;
  }>();
  for (const p of patterns ?? []) {
    patternMap.set(`${p.weekday}_${p.hour_of_day}`, {
      avgOrders:    Number(p.avg_orders ?? 0),
      stddevOrders: Number(p.stddev_orders ?? 0),
      peakOrders:   Number(p.peak_orders ?? 0),
      dataPoints:   Number(p.data_points ?? 0),
    });
  }

  const recMap = new Map<string, { min: number; target: number }>();
  for (const r of recs ?? []) {
    recMap.set(`${r.weekday}_${r.hour_of_day}`, {
      min:    Number(r.recommended_min_drivers ?? 1),
      target: Number(r.recommended_target_drivers ?? 1),
    });
  }

  const slots: ForecastSlot[] = [];

  for (let h = 0; h < hoursAhead; h++) {
    const slotUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + h),
    );

    // Berliner Lokalzeit (UTC+1 / UTC+2 DST — annähern via offset)
    const berlinOffset = berlinUtcOffset(slotUtc);
    const slotLocal = new Date(slotUtc.getTime() + berlinOffset * 60_000);
    const weekday = slotLocal.getDay();      // 0=So … 6=Sa
    const hourOfDay = slotLocal.getHours();

    const key = `${weekday}_${hourOfDay}`;
    const pat = patternMap.get(key);
    const rec = recMap.get(key);

    const expectedOrders = pat ? Math.round(pat.avgOrders) : 0;
    const peakOrders = pat ? pat.peakOrders : 0;
    const sigma = pat ? pat.stddevOrders : 0;

    slots.push({
      hourUtc:    slotUtc.toISOString(),
      hourLocal:  `${String(hourOfDay).padStart(2, '0')}:00`,
      weekday,
      hourOfDay,
      expectedOrders,
      confidenceOrders: Math.round(expectedOrders + sigma),
      peakOrders,
      dataPoints: pat?.dataPoints ?? 0,
      recommendedMinDrivers:    rec?.min    ?? (expectedOrders > 0 ? 1 : 0),
      recommendedTargetDrivers: rec?.target ?? Math.max(expectedOrders > 0 ? 1 : 0, Math.ceil(peakOrders / 3)),
    });
  }

  const peakSlot = slots.reduce(
    (best, s) => (s.expectedOrders > best.expectedOrders ? s : best),
    slots[0],
  );

  return {
    locationId,
    generatedAt: now.toISOString(),
    hoursAhead,
    slots,
    summary: {
      totalExpectedOrders:  slots.reduce((s, sl) => s + sl.expectedOrders, 0),
      peakSlot:             peakSlot?.hourUtc ?? '',
      peakExpectedOrders:   peakSlot?.expectedOrders ?? 0,
      recommendedMaxDrivers: Math.max(...slots.map((s) => s.recommendedTargetDrivers), 0),
    },
  };
}

// ============================================================
// updateCoverageFromForecast
// ============================================================

/**
 * Schreibt aus dem Forecast-Muster Empfehlungen in coverage_requirements.
 * Überschreibt nur Zeilen wo data_points >= 4 (Mindest-Zuverlässigkeit).
 * So lernt das System wöchentlich aus den echten Daten.
 */
export async function updateCoverageFromForecast(locationId: string): Promise<CoverageUpdateResult> {
  const sb = createServiceClient();

  const { data: recs } = await sb
    .from('v_forecast_coverage_recs')
    .select('*')
    .eq('location_id', locationId)
    .gte('data_points', 4);

  if (!recs?.length) return { locationId, slotsUpdated: 0, slotsSkipped: 0 };

  let slotsUpdated = 0;
  let slotsSkipped = 0;

  // Batch-UPSERT in Blöcken von 20
  const batchSize = 20;
  for (let i = 0; i < recs.length; i += batchSize) {
    const chunk = recs.slice(i, i + batchSize);
    const rows = chunk.map((r) => ({
      location_id:      locationId,
      day_of_week:      Number(r.weekday),
      hour_of_day:      Number(r.hour_of_day),
      min_drivers:      Number(r.recommended_min_drivers),
      target_drivers:   Number(r.recommended_target_drivers),
    }));

    const { error } = await sb
      .from('coverage_requirements')
      .upsert(rows, { onConflict: 'location_id,day_of_week,hour_of_day' });

    if (error) {
      slotsSkipped += chunk.length;
    } else {
      slotsUpdated += chunk.length;
    }
  }

  return { locationId, slotsUpdated, slotsSkipped };
}

// ============================================================
// Hilfsfunktionen
// ============================================================

/**
 * Näherungsweise UTC-Offset für Berlin in Minuten.
 * Frühlingszeitumstellung: letzter Sonntag im März, Herbst: letzter Sonntag im Oktober.
 * Genug für Stunden-Buckets; exakte Bibliothek (date-fns-tz) wird bewusst vermieden.
 */
function berlinUtcOffset(utcDate: Date): number {
  const y = utcDate.getUTCFullYear();
  const lastSunMarch = lastSunday(y, 2);   // März = Monat 2
  const lastSunOct   = lastSunday(y, 9);   // Oktober = Monat 9
  const inSummerTime = utcDate >= lastSunMarch && utcDate < lastSunOct;
  return inSummerTime ? 120 : 60;           // CEST = UTC+2, CET = UTC+1
}

function lastSunday(year: number, month: number): Date {
  // Letzter Sonntag = letzter Tag des Monats, rückwärts bis Sonntag
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 1, 0, 0));
  lastDay.setUTCDate(lastDay.getUTCDate() - lastDay.getUTCDay());
  return lastDay;
}
