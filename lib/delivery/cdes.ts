/**
 * lib/delivery/cdes.ts
 *
 * Customer Delivery Experience Score (CDES) — Phase 95
 *
 * Berechnet pro abgeschlossener Lieferbestellung einen Score (0–100) aus:
 *   eta_accuracy_score   (0–30): Pünktlichkeit vs. versprochene ETA
 *   notification_score   (0–20): Kunden-Benachrichtigungen korrekt abgesetzt
 *   driver_quality_score (0–25): Fahrer-Zuverlässigkeits-Tier
 *   attempt_score        (0–25): Erste Zustellung erfolgreich
 *
 * Score-Schwellen:
 *   80–100 = Excellent (grün)
 *   60–79  = Good (blau)
 *   40–59  = Fair (amber)
 *   0–39   = Poor (rot) → Recovery (Gutschrift + optionales Incident)
 *
 * Funktionen:
 *  computeExperienceScore(orderId, locationId) — Score berechnen + speichern
 *  processUnscored(locationId, limit?)         — Batch: alle ungescore-ten delivered Orders
 *  processUnscoredAllLocations()               — Cron-Wrapper
 *  getStats(locationId, days?)                 — Dashboard-Statistiken
 *  getDailyTrend(locationId, days?)            — Tages-Trend (Chart-Daten)
 *  getLowScoreOrders(locationId, limit?)       — Orders mit Score < 40
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { issueManualCredit } from '@/lib/delivery/credits';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type CdesTier = 'excellent' | 'good' | 'fair' | 'poor';

export interface ExperienceScore {
  id: string;
  orderId: string;
  locationId: string;
  score: number;
  tier: CdesTier;
  etaAccuracyScore: number;
  notificationScore: number;
  driverQualityScore: number;
  attemptScore: number;
  actualDeliveryMin: number | null;
  estimatedDeliveryMin: number | null;
  notificationCount: number;
  hadFailedAttempt: boolean;
  driverReliabilityTier: string | null;
  recoveryTriggered: boolean;
  recoveryCreditId: string | null;
  recoveryIncidentId: string | null;
  computedAt: string;
}

export interface CdesStats {
  locationId: string;
  totalScored: number;
  avgScore: number;
  avgEtaScore: number;
  avgNotificationScore: number;
  avgDriverScore: number;
  avgAttemptScore: number;
  excellentCount: number;
  goodCount: number;
  fairCount: number;
  poorCount: number;
  recoveriesTriggered: number;
  failedAttemptsTotal: number;
  lastComputedAt: string | null;
}

export interface CdesDayTrend {
  date: string;
  scoredCount: number;
  avgScore: number;
  excellentCount: number;
  poorCount: number;
  recoveriesCount: number;
}

export interface LowScoreOrder {
  orderId: string;
  score: number;
  etaAccuracyScore: number;
  notificationScore: number;
  driverQualityScore: number;
  attemptScore: number;
  actualDeliveryMin: number | null;
  estimatedDeliveryMin: number | null;
  hadFailedAttempt: boolean;
  driverReliabilityTier: string | null;
  recoveryTriggered: boolean;
  recoveryCreditId: string | null;
  computedAt: string;
}

export interface ProcessResult {
  locationId: string;
  processed: number;
  errors: number;
  recoveriesTriggered: number;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function toTier(score: number): CdesTier {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

function isMigrationMissing(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '42P01'
  );
}

// ─── Score-Algorithmus ────────────────────────────────────────────────────────

interface RawOrderData {
  id: string;
  location_id: string;
  bestellart: string;
  status: string;
  bestellt_am: string | null;
  geliefert_am: string | null;
  created_at: string;
  // Aus Join: ETA-Angabe im Storefront (geschätzte Lieferzeit in Min)
  lieferzeit_min: number | null;
  // Aus Join: Fahrer-Info
  driver_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
}

/**
 * Berechnet den ETA-Accuracy-Score (0–30).
 * Vergleicht tatsächliche Lieferzeit mit der versprochenen ETA.
 */
function computeEtaScore(actualMin: number | null, estimatedMin: number | null): number {
  if (actualMin === null || estimatedMin === null || estimatedMin <= 0) return 15; // Neutral bei fehlenden Daten
  const delta = actualMin - estimatedMin; // positiv = zu spät
  if (delta <= 0)  return 30;    // pünktlich oder früher
  if (delta <= 5)  return 25;    // ≤5 Min zu spät
  if (delta <= 10) return 18;    // ≤10 Min zu spät
  if (delta <= 20) return 10;    // ≤20 Min zu spät
  if (delta <= 30) return 5;     // ≤30 Min zu spät
  return 0;                       // >30 Min zu spät
}

/**
 * Berechnet den Notification-Score (0–20).
 * Prüft ob wichtige Kunden-Events gesendet wurden.
 */
function computeNotificationScore(
  notificationCount: number,
  hasOrderConfirmed: boolean,
  hasAlmostThere: boolean,
): number {
  let score = 0;
  if (hasOrderConfirmed) score += 8;        // Bestellbestätigung gesendet
  if (hasAlmostThere)   score += 7;        // "Fahrer fast da"-Push
  if (notificationCount >= 3) score += 5;  // Mindestens 3 Events = volle Kommunikation
  else if (notificationCount >= 1) score += 2;
  return Math.min(20, score);
}

/**
 * Berechnet den Driver-Quality-Score (0–25) aus Reliability-Tier.
 */
function computeDriverScore(tier: string | null): number {
  switch (tier) {
    case 'excellent': return 25;
    case 'good':      return 20;
    case 'medium':    return 12;
    case 'critical':  return 5;
    default:          return 15; // Unbekannter Fahrer → neutral
  }
}

/**
 * Berechnet den Attempt-Score (0–25).
 */
function computeAttemptScore(hadFailedAttempt: boolean): number {
  return hadFailedAttempt ? 0 : 25;
}

// ─── Haupt-Funktion ───────────────────────────────────────────────────────────

/**
 * Berechnet und speichert den CDES für eine Bestellung.
 * Löst automatisch Recovery aus wenn Score < 40.
 */
export async function computeExperienceScore(
  orderId: string,
  locationId: string,
): Promise<ExperienceScore | null> {
  const sb = createServiceClient();

  // 1. Bestelldaten laden
  const { data: orderRaw, error: orderErr } = await sb
    .from('customer_orders')
    .select('id, location_id, bestellart, status, bestellt_am, geliefert_am, lieferzeit_min, customer_email, name, telefon, mise_delivery_batches(driver_id)')
    .eq('id', orderId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (orderErr || !orderRaw) return null;

  const order = orderRaw as Record<string, unknown>;
  if (order['status'] !== 'geliefert') return null; // Nur gelieferte Orders

  const bestelltAm = order['bestellt_am'] as string | null;
  const geliefertAm = order['geliefert_am'] as string | null;
  const estimatedMin = (order['lieferzeit_min'] as number | null) ?? null;

  let actualMin: number | null = null;
  if (bestelltAm && geliefertAm) {
    const diffMs = new Date(geliefertAm).getTime() - new Date(bestelltAm).getTime();
    actualMin = Math.round(diffMs / 60000);
  }

  // 2. Fahrer-ID aus Batch
  const batchArr = order['mise_delivery_batches'] as Array<{ driver_id: string | null }> | null;
  const driverId: string | null = Array.isArray(batchArr) && batchArr.length > 0
    ? (batchArr[0]?.driver_id ?? null)
    : null;

  // 3. Fahrer-Reliability-Tier laden
  let driverTier: string | null = null;
  if (driverId) {
    const { data: reliability } = await sb
      .from('driver_reliability_scores')
      .select('tier')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .maybeSingle();
    driverTier = (reliability as { tier?: string } | null)?.tier ?? null;
  }

  // 4. Kunden-Events laden (Benachrichtigungen)
  const { data: events } = await sb
    .from('customer_delivery_events')
    .select('event_type')
    .eq('order_id', orderId);

  const eventList = (events as Array<{ event_type: string }> | null) ?? [];
  const notificationCount = eventList.length;
  const hasOrderConfirmed = eventList.some((e) => e.event_type === 'order_confirmed');
  const hasAlmostThere   = eventList.some((e) => e.event_type === 'driver_almost_there');

  // 5. Fehlversuche prüfen
  const { count: failedCount } = await sb
    .from('delivery_failed_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId);
  const hadFailedAttempt = (failedCount ?? 0) > 0;

  // 6. Komponenten-Scores
  const etaScore          = computeEtaScore(actualMin, estimatedMin);
  const notificationScore = computeNotificationScore(notificationCount, hasOrderConfirmed, hasAlmostThere);
  const driverScore       = computeDriverScore(driverTier);
  const attemptScore      = computeAttemptScore(hadFailedAttempt);

  const totalScore = etaScore + notificationScore + driverScore + attemptScore;

  // 7. In DB speichern (UPSERT — idempotent)
  const { data: inserted, error: insertErr } = await sb
    .from('customer_experience_scores')
    .upsert({
      order_id:               orderId,
      location_id:            locationId,
      score:                  totalScore,
      eta_accuracy_score:     etaScore,
      notification_score:     notificationScore,
      driver_quality_score:   driverScore,
      attempt_score:          attemptScore,
      actual_delivery_min:    actualMin,
      estimated_delivery_min: estimatedMin,
      notification_count:     notificationCount,
      had_failed_attempt:     hadFailedAttempt,
      driver_reliability_tier: driverTier,
      computed_at:            new Date().toISOString(),
    }, { onConflict: 'order_id' })
    .select('id, score, eta_accuracy_score, notification_score, driver_quality_score, attempt_score, recovery_triggered, recovery_credit_id, recovery_incident_id, computed_at')
    .maybeSingle();

  if (insertErr || !inserted) {
    if (isMigrationMissing(insertErr)) return null;
    return null;
  }

  const row = inserted as Record<string, unknown>;

  // 8. Recovery bei Score < 40 (fire-and-forget)
  if (totalScore < 40 && !(row['recovery_triggered'] as boolean)) {
    triggerRecovery(orderId, locationId, totalScore, order).catch(() => null);
  }

  return {
    id:                     row['id'] as string,
    orderId,
    locationId,
    score:                  totalScore,
    tier:                   toTier(totalScore),
    etaAccuracyScore:       etaScore,
    notificationScore,
    driverQualityScore:     driverScore,
    attemptScore,
    actualDeliveryMin:      actualMin,
    estimatedDeliveryMin:   estimatedMin,
    notificationCount,
    hadFailedAttempt,
    driverReliabilityTier:  driverTier,
    recoveryTriggered:      row['recovery_triggered'] as boolean,
    recoveryCreditId:       row['recovery_credit_id'] as string | null,
    recoveryIncidentId:     row['recovery_incident_id'] as string | null,
    computedAt:             row['computed_at'] as string,
  };
}

// ─── Recovery ────────────────────────────────────────────────────────────────

async function triggerRecovery(
  orderId: string,
  locationId: string,
  score: number,
  order: Record<string, unknown>,
): Promise<void> {
  const sb = createServiceClient();

  // Gutschrift: €2 bei Score 30–39, €4 bei Score <30
  const amountEur = score < 30 ? 4 : 2;

  let creditId: string | null = null;
  try {
    const credit = await issueManualCredit({
      locationId,
      orderId,
      amountEur,
      reason:       'quality',
      reasonDetail: `Automatische Qualitäts-Gutschrift (CDES ${score}/100)`,
      customerName:  (order['name'] as string | null) ?? undefined,
      customerEmail: (order['customer_email'] as string | null) ?? undefined,
      customerPhone: (order['telefon'] as string | null) ?? undefined,
      notes:         `Score-Breakdown: ETA/Notification/Driver/Attempt. Threshold: 40.`,
      expiresInDays: 60,
    });
    creditId = credit.id;
  } catch {
    // Credit-Tabelle fehlt oder Fehler → Recovery trotzdem als triggered markieren
  }

  // Score-Row auf recovery_triggered setzen
  await sb
    .from('customer_experience_scores')
    .update({
      recovery_triggered:  true,
      recovery_credit_id:  creditId,
    })
    .eq('order_id', orderId)
    .eq('location_id', locationId);
}

// ─── Batch-Verarbeitung ───────────────────────────────────────────────────────

/**
 * Berechnet CDES für alle noch nicht berechneten gelieferten Orders einer Location.
 */
export async function processUnscored(
  locationId: string,
  limit = 50,
): Promise<ProcessResult> {
  const sb = createServiceClient();

  // Gelieferte Orders der letzten 7 Tage, die noch keinen Score haben
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: unscored } = await sb
    .from('customer_orders')
    .select('id')
    .eq('location_id', locationId)
    .eq('status', 'geliefert')
    .eq('bestellart', 'lieferung')
    .gte('geliefert_am', since)
    .not('id', 'in',
      `(SELECT order_id FROM customer_experience_scores WHERE location_id = '${locationId}')`
    )
    .order('geliefert_am', { ascending: false })
    .limit(limit);

  const orderIds = (unscored as Array<{ id: string }> | null)?.map((r) => r.id) ?? [];

  let processed = 0;
  let errors = 0;
  let recoveriesTriggered = 0;

  for (const orderId of orderIds) {
    try {
      const result = await computeExperienceScore(orderId, locationId);
      if (result) {
        processed++;
        if (result.recoveryTriggered) recoveriesTriggered++;
      }
    } catch {
      errors++;
    }
  }

  return { locationId, processed, errors, recoveriesTriggered };
}

/**
 * Cron-Wrapper: verarbeitet alle aktiven Locations.
 */
export async function processUnscoredAllLocations(): Promise<{
  locations: number;
  totalProcessed: number;
  totalRecoveries: number;
  errors: number;
}> {
  const sb = createServiceClient();

  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('aktiv', true);

  const locationIds = (locations as Array<{ id: string }> | null)?.map((l) => l.id) ?? [];

  let totalProcessed = 0;
  let totalRecoveries = 0;
  let errors = 0;

  for (const locationId of locationIds) {
    try {
      const r = await processUnscored(locationId, 30);
      totalProcessed  += r.processed;
      totalRecoveries += r.recoveriesTriggered;
      errors          += r.errors;
    } catch {
      errors++;
    }
  }

  return { locations: locationIds.length, totalProcessed, totalRecoveries, errors };
}

// ─── Dashboard-Abfragen ───────────────────────────────────────────────────────

/**
 * Gibt Zusammenfassungs-Statistiken für das Admin-Dashboard zurück.
 */
export async function getStats(
  locationId: string,
  days = 30,
): Promise<CdesStats | null> {
  const sb = createServiceClient();

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from('customer_experience_scores')
    .select(
      'score, eta_accuracy_score, notification_score, driver_quality_score, attempt_score, recovery_triggered, had_failed_attempt, computed_at',
    )
    .eq('location_id', locationId)
    .gte('computed_at', since)
    .order('computed_at', { ascending: false });

  if (error) {
    if (isMigrationMissing(error)) return null;
    return null;
  }

  const rows = (data as Array<{
    score: number;
    eta_accuracy_score: number;
    notification_score: number;
    driver_quality_score: number;
    attempt_score: number;
    recovery_triggered: boolean;
    had_failed_attempt: boolean;
    computed_at: string;
  }> | null) ?? [];

  if (rows.length === 0) {
    return {
      locationId,
      totalScored: 0,
      avgScore: 0,
      avgEtaScore: 0,
      avgNotificationScore: 0,
      avgDriverScore: 0,
      avgAttemptScore: 0,
      excellentCount: 0,
      goodCount: 0,
      fairCount: 0,
      poorCount: 0,
      recoveriesTriggered: 0,
      failedAttemptsTotal: 0,
      lastComputedAt: null,
    };
  }

  const avg = (arr: number[]) =>
    arr.length === 0 ? 0 : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

  return {
    locationId,
    totalScored:             rows.length,
    avgScore:                avg(rows.map((r) => r.score)),
    avgEtaScore:             avg(rows.map((r) => r.eta_accuracy_score)),
    avgNotificationScore:    avg(rows.map((r) => r.notification_score)),
    avgDriverScore:          avg(rows.map((r) => r.driver_quality_score)),
    avgAttemptScore:         avg(rows.map((r) => r.attempt_score)),
    excellentCount:          rows.filter((r) => r.score >= 80).length,
    goodCount:               rows.filter((r) => r.score >= 60 && r.score < 80).length,
    fairCount:               rows.filter((r) => r.score >= 40 && r.score < 60).length,
    poorCount:               rows.filter((r) => r.score < 40).length,
    recoveriesTriggered:     rows.filter((r) => r.recovery_triggered).length,
    failedAttemptsTotal:     rows.filter((r) => r.had_failed_attempt).length,
    lastComputedAt:          rows[0]?.computed_at ?? null,
  };
}

/**
 * Gibt den Tages-Trend der letzten N Tage zurück (für Chart).
 */
export async function getDailyTrend(
  locationId: string,
  days = 14,
): Promise<CdesDayTrend[]> {
  const sb = createServiceClient();

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from('customer_experience_scores')
    .select('score, recovery_triggered, computed_at')
    .eq('location_id', locationId)
    .gte('computed_at', since)
    .order('computed_at', { ascending: true });

  if (error || !data) return [];

  const rows = data as Array<{
    score: number;
    recovery_triggered: boolean;
    computed_at: string;
  }>;

  // Nach Datum gruppieren (Berlin-Zeitzone approximiert via +1/+2h)
  const byDate = new Map<string, typeof rows>();
  for (const row of rows) {
    const d = new Date(row.computed_at);
    // Offset +2h für CEST-Näherung
    d.setHours(d.getHours() + 2);
    const dateStr = d.toISOString().slice(0, 10);
    if (!byDate.has(dateStr)) byDate.set(dateStr, []);
    byDate.get(dateStr)!.push(row);
  }

  const trend: CdesDayTrend[] = [];
  for (const [date, dayRows] of byDate) {
    trend.push({
      date,
      scoredCount:    dayRows.length,
      avgScore:       Math.round(dayRows.reduce((s, r) => s + r.score, 0) / dayRows.length),
      excellentCount: dayRows.filter((r) => r.score >= 80).length,
      poorCount:      dayRows.filter((r) => r.score < 40).length,
      recoveriesCount: dayRows.filter((r) => r.recovery_triggered).length,
    });
  }

  return trend.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Gibt Orders mit niedrigem Score zurück (für Attention-Queue im Dashboard).
 */
export async function getLowScoreOrders(
  locationId: string,
  limit = 20,
): Promise<LowScoreOrder[]> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('customer_experience_scores')
    .select(
      'order_id, score, eta_accuracy_score, notification_score, driver_quality_score, attempt_score, actual_delivery_min, estimated_delivery_min, had_failed_attempt, driver_reliability_tier, recovery_triggered, recovery_credit_id, computed_at',
    )
    .eq('location_id', locationId)
    .lt('score', 60)
    .order('score', { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  return (data as Array<Record<string, unknown>>).map((r) => ({
    orderId:              r['order_id'] as string,
    score:                r['score'] as number,
    etaAccuracyScore:     r['eta_accuracy_score'] as number,
    notificationScore:    r['notification_score'] as number,
    driverQualityScore:   r['driver_quality_score'] as number,
    attemptScore:         r['attempt_score'] as number,
    actualDeliveryMin:    r['actual_delivery_min'] as number | null,
    estimatedDeliveryMin: r['estimated_delivery_min'] as number | null,
    hadFailedAttempt:     r['had_failed_attempt'] as boolean,
    driverReliabilityTier: r['driver_reliability_tier'] as string | null,
    recoveryTriggered:    r['recovery_triggered'] as boolean,
    recoveryCreditId:     r['recovery_credit_id'] as string | null,
    computedAt:           r['computed_at'] as string,
  }));
}
