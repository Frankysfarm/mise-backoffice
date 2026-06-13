/**
 * lib/delivery/peak-intelligence.ts
 *
 * Phase 120: Smart Peak Day Intelligence & Event Preparation Engine
 *
 * Analysiert historische Bestell-Muster pro Wochentag und kombiniert sie
 * mit einem manuellen Event-Kalender, um Spitzentage bis zu 14 Tage im
 * Voraus zu erkennen. Operatoren erhalten konkrete Empfehlungen:
 * extra Fahrer, frühere Küchenöffnung, Vorbereitungs-Checklisten.
 *
 * Peak-Score-Berechnung (0–100):
 *  A. Wochentag-Baseline-Drift  — wie oft war dieser Wochentag ein Spitzentag? (0–40 Pkt)
 *  B. Saisonalität              — Monat/Quartal-Faktor (0–20 Pkt)
 *  C. Verlinktes Event          — expected_demand_mult aus delivery_events (0–30 Pkt)
 *  D. Letzte-3-Wochen-Trend     — steigender Trend verstärkt Score (0–10 Pkt)
 *
 * Risiko-Level:
 *  0–29  normal   — kein Alert
 *  30–59 elevated — Alert erzeugen (+1–2 Fahrer empfohlen)
 *  60–79 high     — Alert erzeugen (+3–4 Fahrer + Küche früher)
 *  80–100 extreme — Alert erzeugen (maximale Vorbereitung)
 *
 * Public API:
 *  snapshotDayPattern(locationId, date?)    — Tages-Abschluss snapshot
 *  snapshotPatternsAllLocations()           — Cron-Batch (täglich 02:30 UTC)
 *  detectUpcomingPeaks(locationId, days?)   — Peak-Prognose nächste N Tage
 *  analyzePeakAllLocations()               — Cron-Batch detect für alle Locs
 *  createDeliveryEvent(input)              — Event im Kalender anlegen
 *  updateDeliveryEvent(id, input)          — Event aktualisieren
 *  deleteDeliveryEvent(id, locationId)     — Event löschen
 *  getUpcomingEvents(locationId, days?)    — Events nächste N Tage
 *  getPeakDashboard(locationId)            — kombinierter Response für UI
 *  dismissPeakAlert(alertId, locationId, dismissedBy) — Alert bestätigen
 *  pruneOldAlerts()                        — Cleanup veralteter Alerts
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type DeliveryEventType =
  | 'public_holiday'
  | 'school_holiday'
  | 'sports_game'
  | 'concert_festival'
  | 'local_market'
  | 'weather_event'
  | 'promotion'
  | 'other';

export type PeakRiskLevel = 'elevated' | 'high' | 'extreme';

export interface PeakDayPattern {
  id: string;
  locationId: string;
  patternDate: string;
  weekday: number;
  month: number;
  actualOrders: number;
  actualRevenueEur: number;
  actualDriversPeak: number;
  actualAvgEtaMin: number | null;
  actualLateRate: number;
  baselineOrders: number | null;
  baselineRevenue: number | null;
  ordersVsBaseline: number | null;
  peakScore: number;
  wasPeakDay: boolean;
  note: string | null;
  hasLinkedEvent: boolean;
}

export interface WeekdayPatternSummary {
  weekday: number;
  sampleDays: number;
  avgOrders: number;
  avgRevenueEur: number;
  avgPeakDrivers: number;
  avgEtaMin: number | null;
  avgLateRate: number;
  peakDayCount: number;
  peakDayPct: number;
  avgPeakScore: number;
  maxPeakScore: number;
  recordOrders: number;
  recordRevenue: number;
}

export interface DeliveryEvent {
  id: string;
  locationId: string;
  eventDate: string;
  eventType: DeliveryEventType;
  title: string;
  description: string | null;
  expectedDemandMult: number;
  extraDriversNeeded: number;
  kitchenOpenEarlierMin: number;
  notesForTeam: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CreateEventInput {
  locationId: string;
  eventDate: string;
  eventType: DeliveryEventType;
  title: string;
  description?: string | null;
  expectedDemandMult?: number;
  extraDriversNeeded?: number;
  kitchenOpenEarlierMin?: number;
  notesForTeam?: string | null;
  createdBy?: string | null;
}

export interface PeakAlert {
  id: string;
  locationId: string;
  alertDate: string;
  peakScore: number;
  riskLevel: PeakRiskLevel;
  predictedOrders: number | null;
  predictedRevenue: number | null;
  extraDriversRec: number;
  kitchenEarlierMin: number;
  triggerReasons: string[];
  linkedEventId: string | null;
  isActive: boolean;
  weekday: number;
  weekdayName: string;
  daysUntil: number;
  eventTitle: string | null;
  eventType: DeliveryEventType | null;
  eventExtraDrivers: number | null;
  eventKitchenMin: number | null;
}

export interface PeakDashboard {
  locationId: string;
  generatedAt: string;
  summary: {
    openAlerts: number;
    nextPeakDate: string | null;
    nextPeakScore: number | null;
    nextPeakDaysUntil: number | null;
    peakDaysPast30: number;
    eventsNext14Days: number;
    topPeakWeekday: number | null;
    topPeakWeekdayName: string | null;
  };
  upcomingAlerts: PeakAlert[];
  weekdayPatterns: WeekdayPatternSummary[];
  upcomingEvents: DeliveryEvent[];
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

const WEEKDAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;

function weekdayName(wd: number): string {
  return WEEKDAY_NAMES[wd] ?? '?';
}

/** Berechnet Berlin-Offset (UTC+1 Winter, UTC+2 Sommer) */
function berlinOffsetMin(d: Date): number {
  const jan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const jul = new Date(Date.UTC(d.getUTCFullYear(), 6, 1));
  const std = Math.max(-jan.getTimezoneOffset(), -jul.getTimezoneOffset());
  return std > 60 ? 120 : 60;
}

function toLocalDate(utc: Date): Date {
  return new Date(utc.getTime() + berlinOffsetMin(utc) * 60_000);
}

function dateStringLocal(d: Date): string {
  const local = toLocalDate(d);
  return local.toISOString().slice(0, 10);
}

// ─── Peak-Score-Berechnung ───────────────────────────────────────────────────

interface PeakScoreInput {
  weekday: number;
  month: number;
  /** Anteil Tage in den letzten 8 Wochen, an denen dieser Wochentag ein Spitzentag war */
  peakDayPct: number;
  /** Durchschnittlicher Peak-Score des Wochentags in den letzten 8 Wochen */
  avgWeekdayScore: number;
  /** Optional: Demand-Multiplikator aus verknüpftem Event (1.0 = kein Boost) */
  eventDemandMult: number;
  /** Trend: Orders letzte 3 Wochen gleicher Wochentag (steigend = positiv) */
  recentTrend: number; // Prozentualer Anstieg, z.B. 0.15 = +15%
}

function computePeakScore(input: PeakScoreInput): number {
  const { weekday, month, peakDayPct, avgWeekdayScore, eventDemandMult, recentTrend } = input;

  // A: Wochentag-Baseline (0–40 Pkt)
  // Kombination aus historischer Peak-Rate und durchschnittlichem Score
  const weekdayBase = Math.round(
    peakDayPct * 0.4 * 40 + (avgWeekdayScore / 100) * 0.6 * 40,
  );

  // B: Saisonalität (0–20 Pkt)
  // Sommer (Jun-Aug) und Vorweihnacht (Nov-Dez) sind saisonal stärker
  const seasonBonus: Record<number, number> = {
    1: 4, 2: 3, 3: 5, 4: 7, 5: 10,
    6: 14, 7: 16, 8: 15, 9: 9, 10: 8,
    11: 12, 12: 18,
  };
  const seasonal = seasonBonus[month] ?? 8;
  // Wochenend-Bonus für Freitag (5), Samstag (6), Sonntag (0)
  const weekendBonus = [0, 5, 6].includes(weekday) ? 6 : 0;
  const seasonScore = Math.min(20, seasonal + weekendBonus - 8);

  // C: Event-Boost (0–30 Pkt)
  // eventDemandMult 1.0 → 0 Pkt; 2.0 → 30 Pkt; linear
  const eventScore = Math.min(30, Math.max(0, Math.round((eventDemandMult - 1.0) * 30)));

  // D: Trend-Boost (0–10 Pkt)
  const trendScore = Math.min(10, Math.max(0, Math.round(recentTrend * 30)));

  return Math.min(100, Math.max(0, weekdayBase + seasonScore + eventScore + trendScore));
}

function scoreToRisk(score: number): PeakRiskLevel | null {
  if (score >= 80) return 'extreme';
  if (score >= 60) return 'high';
  if (score >= 30) return 'elevated';
  return null;
}

function extraDriversFromScore(score: number): number {
  if (score >= 80) return 5;
  if (score >= 70) return 4;
  if (score >= 60) return 3;
  if (score >= 45) return 2;
  if (score >= 30) return 1;
  return 0;
}

function kitchenEarlierFromScore(score: number): number {
  if (score >= 80) return 30;
  if (score >= 60) return 20;
  if (score >= 30) return 10;
  return 0;
}

// ─── snapshotDayPattern ───────────────────────────────────────────────────────

interface DaySnapshotResult {
  locationId: string;
  date: string;
  actualOrders: number;
  peakScore: number;
  wasPeakDay: boolean;
  skipped: boolean;
  reason?: string;
}

/**
 * Berechnet und speichert den Tages-Snapshot für einen abgeschlossenen Tag.
 * Standard: gestern (heute 02:30 UTC Cron-Aufruf).
 */
export async function snapshotDayPattern(
  locationId: string,
  targetDate?: string,
): Promise<DaySnapshotResult> {
  const sb = createServiceClient();

  const yesterday = targetDate ?? dateStringLocal(
    new Date(Date.now() - 24 * 60 * 60 * 1000),
  );
  const dateObj = new Date(`${yesterday}T12:00:00Z`);
  const weekday = dateObj.getUTCDay();
  const month = dateObj.getUTCMonth() + 1;

  // Tages-Metriken aus customer_orders
  const { data: dayMetrics } = await sb
    .from('customer_orders')
    .select('id, gesamtbetrag, status, lieferziel, eta_latest, geliefert_am')
    .eq('location_id', locationId)
    .gte('created_at', `${yesterday}T00:00:00+01:00`)
    .lt('created_at', `${yesterday}T23:59:59+01:00`)
    .not('status', 'in', '("storniert","abgebrochen")');

  const orders = dayMetrics ?? [];
  const actualOrders = orders.length;

  if (actualOrders === 0) {
    return { locationId, date: yesterday, actualOrders: 0, peakScore: 0, wasPeakDay: false, skipped: true, reason: 'no_orders' };
  }

  const actualRevenueEur = orders.reduce(
    (sum, o) => sum + ((o.gesamtbetrag as number | null) ?? 0), 0,
  );

  // Verspätungsrate
  const deliveredOrders = orders.filter((o) => o.geliefert_am && o.eta_latest);
  const lateCount = deliveredOrders.filter((o) => {
    const etaLatest = new Date(o.eta_latest as string);
    const geliefertAm = new Date(o.geliefert_am as string);
    return geliefertAm > etaLatest;
  }).length;
  const actualLateRate = deliveredOrders.length > 0
    ? lateCount / deliveredOrders.length : 0;

  // Max gleichzeitig aktive Fahrer (approximiert via mise_drivers peak)
  const { data: driverPeak } = await sb
    .from('driver_performance_snapshots')
    .select('active_drivers_count')
    .eq('location_id', locationId)
    .gte('snapshot_at', `${yesterday}T00:00:00Z`)
    .lt('snapshot_at', `${yesterday}T23:59:59Z`)
    .order('active_drivers_count', { ascending: false })
    .limit(1)
    .maybeSingle();

  const actualDriversPeak = (driverPeak?.active_drivers_count as number | null) ?? 0;

  // 8-Wochen-Baseline: gleicher Wochentag der letzten 8 Wochen
  const { data: baselineRows } = await sb
    .from('peak_day_patterns')
    .select('actual_orders, actual_revenue_eur')
    .eq('location_id', locationId)
    .eq('weekday', weekday)
    .gte('pattern_date', dateStringLocal(new Date(Date.now() - 56 * 24 * 60 * 60 * 1000)))
    .lt('pattern_date', yesterday);

  const baselineSamples = baselineRows ?? [];
  const baselineOrders = baselineSamples.length > 0
    ? baselineSamples.reduce((s, r) => s + ((r.actual_orders as number) ?? 0), 0) / baselineSamples.length
    : null;
  const baselineRevenue = baselineSamples.length > 0
    ? baselineSamples.reduce((s, r) => s + ((r.actual_revenue_eur as number) ?? 0), 0) / baselineSamples.length
    : null;

  const ordersVsBaseline = baselineOrders && baselineOrders > 0
    ? actualOrders / baselineOrders : null;

  // Wochentag-Muster aus den letzten 8 Wochen
  const { data: wdSummary } = await sb
    .from('v_weekday_pattern_summary')
    .select('peak_day_pct, avg_peak_score')
    .eq('location_id', locationId)
    .eq('weekday', weekday)
    .maybeSingle();

  const peakDayPct = ((wdSummary?.peak_day_pct as number | null) ?? 0) / 100;
  const avgWeekdayScore = (wdSummary?.avg_peak_score as number | null) ?? 0;

  // Verlinktes Event?
  const { data: linkedEvent } = await sb
    .from('delivery_events')
    .select('expected_demand_mult')
    .eq('location_id', locationId)
    .eq('event_date', yesterday)
    .limit(1)
    .maybeSingle();

  const eventDemandMult = (linkedEvent?.expected_demand_mult as number | null) ?? 1.0;

  // Trend: Letzte 3 Wochen gleicher Wochentag
  const recentBaselineOrders = baselineSamples
    .slice(-3)
    .map((r) => (r.actual_orders as number) ?? 0);
  let recentTrend = 0;
  if (recentBaselineOrders.length >= 2) {
    const oldest = recentBaselineOrders[0];
    const newest = recentBaselineOrders[recentBaselineOrders.length - 1];
    recentTrend = oldest > 0 ? (newest - oldest) / oldest : 0;
  }

  const peakScore = computePeakScore({
    weekday, month, peakDayPct, avgWeekdayScore, eventDemandMult, recentTrend,
  });
  const wasPeakDay = peakScore >= 60;
  const hasLinkedEvent = !!linkedEvent;

  // Upsert
  await sb.from('peak_day_patterns').upsert({
    location_id: locationId,
    pattern_date: yesterday,
    weekday,
    month,
    actual_orders: actualOrders,
    actual_revenue_eur: actualRevenueEur,
    actual_drivers_peak: actualDriversPeak,
    actual_late_rate: actualLateRate,
    baseline_orders: baselineOrders,
    baseline_revenue: baselineRevenue,
    orders_vs_baseline: ordersVsBaseline,
    peak_score: peakScore,
    was_peak_day: wasPeakDay,
    has_linked_event: hasLinkedEvent,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'location_id,pattern_date', ignoreDuplicates: false });

  return { locationId, date: yesterday, actualOrders, peakScore, wasPeakDay, skipped: false };
}

// ─── snapshotPatternsAllLocations ────────────────────────────────────────────

export interface PatternSnapshotBatchResult {
  locations: number;
  snapshots: number;
  peak_days: number;
  errors: number;
}

export async function snapshotPatternsAllLocations(): Promise<PatternSnapshotBatchResult> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('is_active', true);

  if (!locations || locations.length === 0) {
    return { locations: 0, snapshots: 0, peak_days: 0, errors: 0 };
  }

  const results = await Promise.all(
    locations.map((loc) =>
      snapshotDayPattern(loc.id as string).catch(() => null),
    ),
  );

  let snapshots = 0;
  let peak_days = 0;
  let errors = 0;
  for (const r of results) {
    if (r === null) { errors++; continue; }
    if (!r.skipped) { snapshots++; }
    if (r.wasPeakDay) { peak_days++; }
  }

  return { locations: locations.length, snapshots, peak_days, errors };
}

// ─── detectUpcomingPeaks ─────────────────────────────────────────────────────

interface UpcomingPeakPrediction {
  date: string;
  weekday: number;
  month: number;
  peakScore: number;
  riskLevel: PeakRiskLevel | null;
  extraDriversRec: number;
  kitchenEarlierMin: number;
  triggerReasons: string[];
  linkedEvent: {
    id: string;
    title: string;
    eventType: DeliveryEventType;
    expectedDemandMult: number;
    extraDriversNeeded: number;
    kitchenOpenEarlierMin: number;
  } | null;
  predictedOrders: number | null;
  predictedRevenue: number | null;
}

export async function detectUpcomingPeaks(
  locationId: string,
  daysAhead = 14,
): Promise<UpcomingPeakPrediction[]> {
  const sb = createServiceClient();

  // Lade Wochentag-Muster
  const { data: wdSummaries } = await sb
    .from('v_weekday_pattern_summary')
    .select('weekday, avg_orders, avg_revenue_eur, peak_day_pct, avg_peak_score')
    .eq('location_id', locationId);

  const wdMap = new Map<number, {
    avgOrders: number;
    avgRevenue: number;
    peakDayPct: number;
    avgPeakScore: number;
  }>();
  for (const s of wdSummaries ?? []) {
    wdMap.set(s.weekday as number, {
      avgOrders: (s.avg_orders as number) ?? 0,
      avgRevenue: (s.avg_revenue_eur as number) ?? 0,
      peakDayPct: ((s.peak_day_pct as number) ?? 0) / 100,
      avgPeakScore: (s.avg_peak_score as number) ?? 0,
    });
  }

  // Lade Events für den Zeitraum
  const endDate = dateStringLocal(new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000));
  const todayStr = dateStringLocal(new Date());
  interface RawEventRow {
    id: string;
    event_date: string;
    event_type: DeliveryEventType;
    title: string;
    expected_demand_mult: number;
    extra_drivers_needed: number;
    kitchen_open_earlier_min: number;
  }

  const { data: events } = await sb
    .from('delivery_events')
    .select('id, event_date, event_type, title, expected_demand_mult, extra_drivers_needed, kitchen_open_earlier_min')
    .eq('location_id', locationId)
    .gte('event_date', todayStr)
    .lte('event_date', endDate);

  const eventMap = new Map<string, RawEventRow>();
  for (const ev of (events ?? []) as unknown as RawEventRow[]) {
    eventMap.set(ev.event_date, ev);
  }

  // Letzte 3 Wochen-Trends berechnen
  const { data: recentRows } = await sb
    .from('peak_day_patterns')
    .select('weekday, actual_orders, pattern_date')
    .eq('location_id', locationId)
    .gte('pattern_date', dateStringLocal(new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)))
    .lt('pattern_date', todayStr)
    .order('pattern_date', { ascending: true });

  // Trend pro Wochentag (letzte 3 Vorkommen)
  const wdRecent = new Map<number, number[]>();
  for (const r of recentRows ?? []) {
    const wd = r.weekday as number;
    const list = wdRecent.get(wd) ?? [];
    list.push(r.actual_orders as number);
    wdRecent.set(wd, list);
  }
  const trendMap = new Map<number, number>();
  for (const [wd, vals] of wdRecent.entries()) {
    if (vals.length >= 2) {
      const oldest = vals[0];
      const newest = vals[vals.length - 1];
      trendMap.set(wd, oldest > 0 ? (newest - oldest) / oldest : 0);
    }
  }

  const predictions: UpcomingPeakPrediction[] = [];

  for (let i = 0; i < daysAhead; i++) {
    const future = new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000);
    const dateStr = dateStringLocal(future);
    const weekday = future.getUTCDay();
    const month = future.getUTCMonth() + 1;

    const wdData = wdMap.get(weekday);
    const linkedEvent = eventMap.get(dateStr) ?? null;
    const eventDemandMult = linkedEvent?.expected_demand_mult ?? 1.0;
    const recentTrend = trendMap.get(weekday) ?? 0;

    const score = computePeakScore({
      weekday,
      month,
      peakDayPct: wdData?.peakDayPct ?? 0,
      avgWeekdayScore: wdData?.avgPeakScore ?? 0,
      eventDemandMult,
      recentTrend,
    });

    const riskLevel = scoreToRisk(score);
    const triggerReasons: string[] = [];

    if (wdData && wdData.peakDayPct > 0.4) triggerReasons.push('frequent_peak_weekday');
    if ([0, 5, 6].includes(weekday)) triggerReasons.push('weekend');
    if ([6, 7, 8, 11, 12].includes(month)) triggerReasons.push('peak_season');
    if (eventDemandMult > 1.2) triggerReasons.push('linked_event');
    if (recentTrend > 0.1) triggerReasons.push('rising_trend');

    // Prognose: Baseline × eventMult
    const baseOrders = wdData?.avgOrders ?? null;
    const predictedOrders = baseOrders !== null
      ? Math.round(baseOrders * eventDemandMult * (1 + recentTrend))
      : null;
    const predictedRevenue = wdData?.avgRevenue
      ? Math.round(wdData.avgRevenue * eventDemandMult * (1 + recentTrend) * 100) / 100
      : null;

    // Fahrer-Empfehlung: max aus Score-Empfehlung und Event-Vorgabe
    const scoreDrivers = extraDriversFromScore(score);
    const eventDrivers = linkedEvent?.extra_drivers_needed ?? 0;
    const extraDriversRec = Math.max(scoreDrivers, eventDrivers);

    const scoreKitchen = kitchenEarlierFromScore(score);
    const eventKitchen = linkedEvent?.kitchen_open_earlier_min ?? 0;
    const kitchenEarlierMin = Math.max(scoreKitchen, eventKitchen);

    predictions.push({
      date: dateStr,
      weekday,
      month,
      peakScore: score,
      riskLevel,
      extraDriversRec,
      kitchenEarlierMin,
      triggerReasons,
      linkedEvent: linkedEvent ? {
        id: linkedEvent.id,
        title: linkedEvent.title,
        eventType: linkedEvent.event_type,
        expectedDemandMult: linkedEvent.expected_demand_mult,
        extraDriversNeeded: linkedEvent.extra_drivers_needed,
        kitchenOpenEarlierMin: linkedEvent.kitchen_open_earlier_min,
      } : null,
      predictedOrders,
      predictedRevenue,
    });
  }

  return predictions;
}

// ─── generatePeakAlerts ──────────────────────────────────────────────────────

export interface GenerateAlertsResult {
  locationId: string;
  created: number;
  updated: number;
  dismissed: number;
}

export async function generatePeakAlerts(
  locationId: string,
): Promise<GenerateAlertsResult> {
  const sb = createServiceClient();
  const predictions = await detectUpcomingPeaks(locationId, 14);

  let created = 0;
  let updated = 0;

  for (const pred of predictions) {
    if (!pred.riskLevel) continue; // score < 30 → kein Alert

    const alertPayload = {
      location_id: locationId,
      alert_date: pred.date,
      peak_score: pred.peakScore,
      risk_level: pred.riskLevel,
      predicted_orders: pred.predictedOrders,
      predicted_revenue: pred.predictedRevenue,
      extra_drivers_rec: pred.extraDriversRec,
      kitchen_earlier_min: pred.kitchenEarlierMin,
      trigger_reasons: pred.triggerReasons,
      linked_event_id: pred.linkedEvent?.id ?? null,
    };

    const { data: existing } = await sb
      .from('peak_day_alerts')
      .select('id, dismissed_at')
      .eq('location_id', locationId)
      .eq('alert_date', pred.date)
      .maybeSingle();

    if (!existing) {
      await sb.from('peak_day_alerts').insert(alertPayload);
      created++;
    } else if (!existing.dismissed_at) {
      // Update nur wenn noch nicht bestätigt
      await sb.from('peak_day_alerts')
        .update({
          peak_score: pred.peakScore,
          risk_level: pred.riskLevel,
          predicted_orders: pred.predictedOrders,
          predicted_revenue: pred.predictedRevenue,
          extra_drivers_rec: pred.extraDriversRec,
          kitchen_earlier_min: pred.kitchenEarlierMin,
          trigger_reasons: pred.triggerReasons,
          linked_event_id: pred.linkedEvent?.id ?? null,
        })
        .eq('id', existing.id as string);
      updated++;
    }
  }

  return { locationId, created, updated, dismissed: 0 };
}

// ─── analyzePeakAllLocations ─────────────────────────────────────────────────

export interface PeakAnalysisBatchResult {
  locations: number;
  total_alerts_created: number;
  total_alerts_updated: number;
  errors: number;
}

export async function analyzePeakAllLocations(): Promise<PeakAnalysisBatchResult> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('is_active', true);

  if (!locations || locations.length === 0) {
    return { locations: 0, total_alerts_created: 0, total_alerts_updated: 0, errors: 0 };
  }

  const results = await Promise.all(
    locations.map((loc) =>
      generatePeakAlerts(loc.id as string).catch(() => null),
    ),
  );

  let total_alerts_created = 0;
  let total_alerts_updated = 0;
  let errors = 0;
  for (const r of results) {
    if (r === null) { errors++; continue; }
    total_alerts_created += r.created;
    total_alerts_updated += r.updated;
  }

  return { locations: locations.length, total_alerts_created, total_alerts_updated, errors };
}

// ─── Event-CRUD ──────────────────────────────────────────────────────────────

export async function createDeliveryEvent(
  input: CreateEventInput,
): Promise<DeliveryEvent> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('delivery_events')
    .insert({
      location_id: input.locationId,
      event_date: input.eventDate,
      event_type: input.eventType,
      title: input.title,
      description: input.description ?? null,
      expected_demand_mult: input.expectedDemandMult ?? 1.0,
      extra_drivers_needed: input.extraDriversNeeded ?? 0,
      kitchen_open_earlier_min: input.kitchenOpenEarlierMin ?? 0,
      notes_for_team: input.notesForTeam ?? null,
      created_by: input.createdBy ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return mapEvent(data);
}

export async function updateDeliveryEvent(
  id: string,
  locationId: string,
  input: Partial<Omit<CreateEventInput, 'locationId'>>,
): Promise<DeliveryEvent> {
  const sb = createServiceClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.eventDate !== undefined) updates.event_date = input.eventDate;
  if (input.eventType !== undefined) updates.event_type = input.eventType;
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.expectedDemandMult !== undefined) updates.expected_demand_mult = input.expectedDemandMult;
  if (input.extraDriversNeeded !== undefined) updates.extra_drivers_needed = input.extraDriversNeeded;
  if (input.kitchenOpenEarlierMin !== undefined) updates.kitchen_open_earlier_min = input.kitchenOpenEarlierMin;
  if (input.notesForTeam !== undefined) updates.notes_for_team = input.notesForTeam;

  const { data, error } = await sb
    .from('delivery_events')
    .update(updates)
    .eq('id', id)
    .eq('location_id', locationId)
    .select()
    .single();

  if (error) throw error;
  return mapEvent(data);
}

export async function deleteDeliveryEvent(
  id: string,
  locationId: string,
): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('delivery_events')
    .delete()
    .eq('id', id)
    .eq('location_id', locationId);
  if (error) throw error;
}

export async function getUpcomingEvents(
  locationId: string,
  daysAhead = 30,
): Promise<DeliveryEvent[]> {
  const sb = createServiceClient();
  const endDate = dateStringLocal(new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000));
  const todayStr = dateStringLocal(new Date());

  const { data } = await sb
    .from('delivery_events')
    .select('*')
    .eq('location_id', locationId)
    .gte('event_date', todayStr)
    .lte('event_date', endDate)
    .order('event_date', { ascending: true });

  return (data ?? []).map(mapEvent);
}

// ─── dismissPeakAlert ────────────────────────────────────────────────────────

export async function dismissPeakAlert(
  alertId: string,
  locationId: string,
  dismissedBy: string,
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('peak_day_alerts')
    .update({
      dismissed_at: new Date().toISOString(),
      dismissed_by: dismissedBy,
    })
    .eq('id', alertId)
    .eq('location_id', locationId);
}

// ─── getPeakDashboard ────────────────────────────────────────────────────────

export async function getPeakDashboard(locationId: string): Promise<PeakDashboard> {
  const sb = createServiceClient();

  const [alertsRes, wdRes, eventsRes, past30Res] = await Promise.all([
    sb
      .from('v_upcoming_peak_days')
      .select('*')
      .eq('location_id', locationId)
      .eq('is_active', true)
      .order('alert_date', { ascending: true }),
    sb
      .from('v_weekday_pattern_summary')
      .select('*')
      .eq('location_id', locationId)
      .order('weekday', { ascending: true }),
    getUpcomingEvents(locationId, 30),
    sb
      .from('peak_day_patterns')
      .select('weekday, was_peak_day, avg_peak_score:peak_score')
      .eq('location_id', locationId)
      .eq('was_peak_day', true)
      .gte('pattern_date', dateStringLocal(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))),
  ]);

  const activeAlerts: PeakAlert[] = (alertsRes.data ?? []).map(mapAlert);
  const weekdayPatterns: WeekdayPatternSummary[] = (wdRes.data ?? []).map(mapWdSummary);
  const upcomingEvents = eventsRes;

  const peakDaysPast30 = (past30Res.data ?? []).length;

  // Top Peak-Wochentag: wdPattern mit höchstem avg_peak_score
  const topWd = weekdayPatterns.length > 0
    ? weekdayPatterns.reduce((a, b) => a.avgPeakScore > b.avgPeakScore ? a : b)
    : null;

  // Nächster Peak aus Alerts
  const nextPeak = activeAlerts.length > 0 ? activeAlerts[0] : null;

  return {
    locationId,
    generatedAt: new Date().toISOString(),
    summary: {
      openAlerts: activeAlerts.length,
      nextPeakDate: nextPeak?.alertDate ?? null,
      nextPeakScore: nextPeak?.peakScore ?? null,
      nextPeakDaysUntil: nextPeak?.daysUntil ?? null,
      peakDaysPast30,
      eventsNext14Days: upcomingEvents.filter((e) => {
        const diff = (new Date(e.eventDate).getTime() - Date.now()) / 86_400_000;
        return diff >= 0 && diff <= 14;
      }).length,
      topPeakWeekday: topWd?.weekday ?? null,
      topPeakWeekdayName: topWd ? weekdayName(topWd.weekday) : null,
    },
    upcomingAlerts: activeAlerts,
    weekdayPatterns,
    upcomingEvents,
  };
}

// ─── pruneOldAlerts ──────────────────────────────────────────────────────────

export async function pruneOldAlerts(): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_old_peak_alerts', { days_back: 30 });
  return (data as number | null) ?? 0;
}

// ─── Row-Mapper ───────────────────────────────────────────────────────────────

function mapEvent(r: Record<string, unknown>): DeliveryEvent {
  return {
    id: r.id as string,
    locationId: r.location_id as string,
    eventDate: r.event_date as string,
    eventType: r.event_type as DeliveryEventType,
    title: r.title as string,
    description: r.description as string | null,
    expectedDemandMult: r.expected_demand_mult as number,
    extraDriversNeeded: r.extra_drivers_needed as number,
    kitchenOpenEarlierMin: r.kitchen_open_earlier_min as number,
    notesForTeam: r.notes_for_team as string | null,
    createdBy: r.created_by as string | null,
    createdAt: r.created_at as string,
  };
}

function mapAlert(r: Record<string, unknown>): PeakAlert {
  return {
    id: r.id as string,
    locationId: r.location_id as string,
    alertDate: r.alert_date as string,
    peakScore: r.peak_score as number,
    riskLevel: r.risk_level as PeakRiskLevel,
    predictedOrders: r.predicted_orders as number | null,
    predictedRevenue: r.predicted_revenue as number | null,
    extraDriversRec: r.extra_drivers_rec as number,
    kitchenEarlierMin: r.kitchen_earlier_min as number,
    triggerReasons: (r.trigger_reasons as string[] | null) ?? [],
    linkedEventId: r.event_id as string | null,
    isActive: r.is_active as boolean,
    weekday: r.weekday as number,
    weekdayName: r.weekday_name as string,
    daysUntil: r.days_until as number,
    eventTitle: r.event_title as string | null,
    eventType: r.event_type as DeliveryEventType | null,
    eventExtraDrivers: r.event_extra_drivers as number | null,
    eventKitchenMin: r.event_kitchen_min as number | null,
  };
}

function mapWdSummary(r: Record<string, unknown>): WeekdayPatternSummary {
  return {
    weekday: r.weekday as number,
    sampleDays: r.sample_days as number,
    avgOrders: r.avg_orders as number,
    avgRevenueEur: r.avg_revenue_eur as number,
    avgPeakDrivers: r.avg_peak_drivers as number,
    avgEtaMin: r.avg_eta_min as number | null,
    avgLateRate: r.avg_late_rate as number,
    peakDayCount: r.peak_day_count as number,
    peakDayPct: r.peak_day_pct as number,
    avgPeakScore: r.avg_peak_score as number,
    maxPeakScore: r.max_peak_score as number,
    recordOrders: r.record_orders as number,
    recordRevenue: r.record_revenue as number,
  };
}
