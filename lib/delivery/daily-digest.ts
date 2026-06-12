/**
 * lib/delivery/daily-digest.ts
 *
 * AI-gestützte Tagesend-Zusammenfassung — Phase 96
 *
 * Aggregiert alle KPIs eines Betriebstages und generiert via Claude
 * eine kompakte Management-Zusammenfassung mit Anomalie-Erkennung.
 *
 * Funktionen:
 *   gatherDailyMetrics(locationId, date?)     — alle Tages-KPIs aus DB sammeln
 *   detectAnomalies(cur, prev)                — signifikante Abweichungen finden
 *   streamDailyDigest(locationId, date?)      — Claude-SSE-Stream
 *   saveDailyDigest(locationId, date?)        — Snapshot in DB cachen
 *   getDailyDigest(locationId, date?)         — gespeicherten Digest laden
 *   getDigestHistory(locationId, days?)       — letzte N Tage als Liste
 *   generateDigestAllLocations(date?)         — Cron-Helfer für alle Locations
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';

// ─────────────────────────────────────────────────────────────────────────────
// Typen
// ─────────────────────────────────────────────────────────────────────────────

export interface DailyMetrics {
  date: string;                     // YYYY-MM-DD (UTC)
  locationName: string;

  orders: {
    total: number;
    delivery: number;
    pickup: number;
    completed: number;
    cancelled: number;
    cancellationRatePct: number | null;
    avgValueEur: number | null;
  };

  revenue: {
    totalEur: number | null;
    deliveryEur: number | null;
  };

  performance: {
    avgDeliveryMin: number | null;
    onTimeRatePct: number | null;
    avgEtaDeviationMin: number | null;
    totalDelivered: number;
  };

  drivers: {
    uniqueActive: number;
    totalShifts: number;
    avgDeliveriesPerDriver: number | null;
  };

  experience: {
    avgCdesScore: number | null;
    cdesCriticalCount: number;
    avgSatisfactionRating: number | null;
    satisfactionCount: number;
    delayCount: number;
    delayVouchersIssued: number;
  };
}

export interface DigestAnomaly {
  field: string;
  label: string;
  current: number;
  previous: number;
  deltaPct: number;
  severity: 'warning' | 'critical';
  direction: 'up' | 'down';
}

export interface DailyDigest {
  id: string;
  locationId: string;
  digestDate: string;
  metrics: DailyMetrics;
  anomalies: DigestAnomaly[];
  aiSummary: string | null;
  generatedAt: string;
}

export interface DigestHistoryEntry {
  id: string;
  digestDate: string;
  metrics: DailyMetrics;
  anomalies: DigestAnomaly[];
  aiSummary: string | null;
  generatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

function dateToUtcRange(dateStr: string): { from: string; to: string } {
  // dateStr = YYYY-MM-DD
  const [y, m, d] = dateStr.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).toISOString();
  const to   = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)).toISOString();
  return { from, to };
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function prevDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// gatherDailyMetrics
// ─────────────────────────────────────────────────────────────────────────────

export async function gatherDailyMetrics(
  locationId: string,
  date: string = todayUtc(),
): Promise<DailyMetrics> {
  const sb = createServiceClient();
  const { from, to } = dateToUtcRange(date);

  const [
    locationRes,
    ordersRes,
    revenueRes,
    perfRes,
    driversRes,
    shiftsRes,
    cdesRes,
    satRes,
    delayRes,
    voucherRes,
  ] = await Promise.allSettled([
    // 0) Location-Name
    sb.from('locations').select('name').eq('id', locationId).maybeSingle(),

    // 1) Bestellungen nach Status
    sb
      .from('customer_orders')
      .select('id, status, typ, gesamtbetrag')
      .eq('location_id', locationId)
      .gte('created_at', from)
      .lte('created_at', to),

    // 2) Umsatz (abgeschlossene Bestellungen)
    sb
      .from('customer_orders')
      .select('gesamtbetrag, typ')
      .eq('location_id', locationId)
      .eq('status', 'abgeschlossen')
      .gte('created_at', from)
      .lte('created_at', to),

    // 3) Liefer-Performance
    sb
      .from('delivery_performance')
      .select('delivery_min, eta_deviation_min, on_time')
      .eq('location_id', locationId)
      .gte('recorded_at', from)
      .lte('recorded_at', to),

    // 4) Aktive Fahrer (unique)
    sb
      .from('mise_delivery_batches')
      .select('driver_id')
      .eq('location_id', locationId)
      .not('driver_id', 'is', null)
      .gte('created_at', from)
      .lte('created_at', to),

    // 5) Schichten
    sb
      .from('driver_shifts')
      .select('id')
      .eq('location_id', locationId)
      .gte('started_at', from)
      .lte('started_at', to),

    // 6) CDES-Scores
    sb
      .from('customer_experience_scores')
      .select('total_score')
      .eq('location_id', locationId)
      .gte('created_at', from)
      .lte('created_at', to),

    // 7) Zufriedenheitsbewertungen
    sb
      .from('customer_ratings')
      .select('rating')
      .eq('location_id', locationId)
      .gte('created_at', from)
      .lte('created_at', to),

    // 8) Verspätungen
    sb
      .from('delay_notices')
      .select('id')
      .eq('location_id', locationId)
      .gte('created_at', from)
      .lte('created_at', to),

    // 9) Verspätungs-Gutscheine
    sb
      .from('delay_vouchers')
      .select('id')
      .eq('location_id', locationId)
      .gte('created_at', from)
      .lte('created_at', to),
  ]);

  // ── Location-Name ──────────────────────────────────────────────────────────

  const locationName =
    locationRes.status === 'fulfilled'
      ? (locationRes.value.data?.name ?? locationId)
      : locationId;

  // ── Bestellungen ──────────────────────────────────────────────────────────

  const allOrders =
    ordersRes.status === 'fulfilled' ? (ordersRes.value.data ?? []) : [];
  const deliveryOrders = allOrders.filter((o) => o.typ === 'lieferung');
  const pickupOrders   = allOrders.filter((o) => o.typ === 'abholung');
  const completed      = allOrders.filter((o) => o.status === 'abgeschlossen');
  const cancelled      = allOrders.filter((o) => o.status === 'storniert');
  const cancellationRatePct =
    allOrders.length > 0
      ? Math.round((cancelled.length / allOrders.length) * 1000) / 10
      : null;

  // ── Umsatz ────────────────────────────────────────────────────────────────

  const revOrders =
    revenueRes.status === 'fulfilled' ? (revenueRes.value.data ?? []) : [];
  const totalEur =
    revOrders.length > 0
      ? Math.round(
          revOrders.reduce((s, o) => s + ((o.gesamtbetrag as number) ?? 0), 0) * 100,
        ) / 100
      : null;
  const deliveryEur =
    revOrders.filter((o) => o.typ === 'lieferung').length > 0
      ? Math.round(
          revOrders
            .filter((o) => o.typ === 'lieferung')
            .reduce((s, o) => s + ((o.gesamtbetrag as number) ?? 0), 0) * 100,
        ) / 100
      : null;
  const avgValueEur =
    completed.length > 0
      ? Math.round(
          (completed.reduce((s, o) => s + ((o.gesamtbetrag as number) ?? 0), 0) / completed.length) * 100,
        ) / 100
      : null;

  // ── Performance ───────────────────────────────────────────────────────────

  const perfRows =
    perfRes.status === 'fulfilled' ? (perfRes.value.data ?? []) : [];
  const avgDeliveryMin =
    perfRows.filter((r) => r.delivery_min != null).length > 0
      ? Math.round(
          perfRows
            .filter((r) => r.delivery_min != null)
            .reduce((s, r) => s + (r.delivery_min as number), 0) /
            perfRows.filter((r) => r.delivery_min != null).length *
            10,
        ) / 10
      : null;
  const onTimeRows = perfRows.filter((r) => r.on_time != null);
  const onTimeRatePct =
    onTimeRows.length > 0
      ? Math.round(
          (onTimeRows.filter((r) => r.on_time).length / onTimeRows.length) * 1000,
        ) / 10
      : null;
  const etaDevRows = perfRows.filter((r) => r.eta_deviation_min != null);
  const avgEtaDeviationMin =
    etaDevRows.length > 0
      ? Math.round(
          etaDevRows.reduce((s, r) => s + (r.eta_deviation_min as number), 0) /
            etaDevRows.length * 10,
        ) / 10
      : null;

  // ── Fahrer ────────────────────────────────────────────────────────────────

  const driverRows =
    driversRes.status === 'fulfilled' ? (driversRes.value.data ?? []) : [];
  const uniqueDriverIds = new Set(driverRows.map((r) => r.driver_id as string));
  const uniqueActive = uniqueDriverIds.size;
  const totalShifts =
    shiftsRes.status === 'fulfilled' ? (shiftsRes.value.data?.length ?? 0) : 0;
  const avgDeliveriesPerDriver =
    uniqueActive > 0
      ? Math.round((perfRows.length / uniqueActive) * 10) / 10
      : null;

  // ── Erfahrungs-Scores (CDES) ───────────────────────────────────────────────

  const cdesRows =
    cdesRes.status === 'fulfilled' ? (cdesRes.value.data ?? []) : [];
  const avgCdesScore =
    cdesRows.length > 0
      ? Math.round(
          (cdesRows.reduce((s, r) => s + (r.total_score as number), 0) / cdesRows.length) * 10,
        ) / 10
      : null;
  const cdesCriticalCount = cdesRows.filter((r) => (r.total_score as number) < 40).length;

  // ── Kundenzufriedenheit ────────────────────────────────────────────────────

  const satRows =
    satRes.status === 'fulfilled' ? (satRes.value.data ?? []) : [];
  const avgSatisfactionRating =
    satRows.length > 0
      ? Math.round(
          (satRows.reduce((s, r) => s + (r.rating as number), 0) / satRows.length) * 100,
        ) / 100
      : null;

  // ── Verspätungen ──────────────────────────────────────────────────────────

  const delayCount =
    delayRes.status === 'fulfilled' ? (delayRes.value.data?.length ?? 0) : 0;
  const delayVouchersIssued =
    voucherRes.status === 'fulfilled' ? (voucherRes.value.data?.length ?? 0) : 0;

  return {
    date,
    locationName,
    orders: {
      total: allOrders.length,
      delivery: deliveryOrders.length,
      pickup: pickupOrders.length,
      completed: completed.length,
      cancelled: cancelled.length,
      cancellationRatePct,
      avgValueEur,
    },
    revenue: {
      totalEur,
      deliveryEur,
    },
    performance: {
      avgDeliveryMin,
      onTimeRatePct,
      avgEtaDeviationMin,
      totalDelivered: perfRows.length,
    },
    drivers: {
      uniqueActive,
      totalShifts,
      avgDeliveriesPerDriver,
    },
    experience: {
      avgCdesScore,
      cdesCriticalCount,
      avgSatisfactionRating,
      satisfactionCount: satRows.length,
      delayCount,
      delayVouchersIssued,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// detectAnomalies
// ─────────────────────────────────────────────────────────────────────────────

export function detectAnomalies(
  cur: DailyMetrics,
  prev: DailyMetrics,
): DigestAnomaly[] {
  const anomalies: DigestAnomaly[] = [];

  function check(
    label: string,
    field: string,
    curVal: number | null,
    prevVal: number | null,
    warningThreshold: number,
    criticalThreshold: number,
    higherIsBetter = true,
  ) {
    if (curVal == null || prevVal == null || prevVal === 0) return;
    const deltaPct = ((curVal - prevVal) / Math.abs(prevVal)) * 100;
    const absDelta = Math.abs(deltaPct);
    if (absDelta < warningThreshold) return;

    const severity: 'warning' | 'critical' = absDelta >= criticalThreshold ? 'critical' : 'warning';
    const direction: 'up' | 'down' = curVal > prevVal ? 'up' : 'down';

    const isBad =
      (higherIsBetter && direction === 'down') ||
      (!higherIsBetter && direction === 'up');

    if (isBad) {
      anomalies.push({
        field,
        label,
        current: Math.round(curVal * 10) / 10,
        previous: Math.round(prevVal * 10) / 10,
        deltaPct: Math.round(deltaPct * 10) / 10,
        severity,
        direction,
      });
    }
  }

  check('Bestellungen gesamt', 'orders.total', cur.orders.total, prev.orders.total, 25, 50, true);
  check('Stornierungsrate', 'orders.cancellationRatePct', cur.orders.cancellationRatePct, prev.orders.cancellationRatePct, 30, 60, false);
  check('Umsatz', 'revenue.totalEur', cur.revenue.totalEur, prev.revenue.totalEur, 25, 50, true);
  check('Ø Lieferzeit', 'performance.avgDeliveryMin', cur.performance.avgDeliveryMin, prev.performance.avgDeliveryMin, 20, 40, false);
  check('On-Time-Rate', 'performance.onTimeRatePct', cur.performance.onTimeRatePct, prev.performance.onTimeRatePct, 10, 20, true);
  check('Ø ETA-Abweichung', 'performance.avgEtaDeviationMin', cur.performance.avgEtaDeviationMin, prev.performance.avgEtaDeviationMin, 30, 50, false);
  check('CDES-Score', 'experience.avgCdesScore', cur.experience.avgCdesScore, prev.experience.avgCdesScore, 10, 20, true);
  check('Kundenzufriedenheit', 'experience.avgSatisfactionRating', cur.experience.avgSatisfactionRating, prev.experience.avgSatisfactionRating, 15, 30, true);
  check('Verspätungsquote', 'experience.delayCount', cur.experience.delayCount, prev.experience.delayCount, 50, 100, false);
  check('Aktive Fahrer', 'drivers.uniqueActive', cur.drivers.uniqueActive, prev.drivers.uniqueActive, 25, 50, true);

  // Sort: critical first, then by abs delta
  anomalies.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    return Math.abs(b.deltaPct) - Math.abs(a.deltaPct);
  });

  return anomalies.slice(0, 8);
}

// ─────────────────────────────────────────────────────────────────────────────
// buildDigestPrompt
// ─────────────────────────────────────────────────────────────────────────────

function buildDigestPrompt(cur: DailyMetrics, prev: DailyMetrics, anomalies: DigestAnomaly[]): string {
  const fmtNum = (n: number | null, unit = '') =>
    n != null ? `${n}${unit}` : 'k.A.';
  const fmtPct = (n: number | null) => fmtNum(n, '%');
  const fmtEur = (n: number | null) => (n != null ? `€${n.toFixed(2)}` : 'k.A.');
  const delta = (c: number | null, p: number | null) => {
    if (c == null || p == null || p === 0) return '';
    const d = ((c - p) / Math.abs(p)) * 100;
    const sign = d >= 0 ? '+' : '';
    return ` (${sign}${Math.round(d)}% vs. Vortag)`;
  };

  const anomalyLines =
    anomalies.length > 0
      ? anomalies
          .map(
            (a) =>
              `  ⚠ ${a.severity === 'critical' ? '🔴' : '🟡'} ${a.label}: ${a.current} (war ${a.previous}, ${a.deltaPct > 0 ? '+' : ''}${a.deltaPct}%)`,
          )
          .join('\n')
      : '  Keine signifikanten Anomalien';

  return `Du bist ein erfahrener Lieferdienst-Betriebsleiter. Erstelle eine prägnante deutsche Tagesend-Zusammenfassung.

STANDORT: ${cur.locationName}
DATUM: ${cur.date}

=== HEUTIGER BETRIEB ===
Bestellungen: ${cur.orders.total} gesamt${delta(cur.orders.total, prev.orders.total)} | Lieferungen: ${cur.orders.delivery} | Abholungen: ${cur.orders.pickup}
Abgeschlossen: ${cur.orders.completed} | Storniert: ${cur.orders.cancelled} (${fmtPct(cur.orders.cancellationRatePct)}${delta(cur.orders.cancellationRatePct, prev.orders.cancellationRatePct)})
Umsatz: ${fmtEur(cur.revenue.totalEur)}${delta(cur.revenue.totalEur, prev.revenue.totalEur)} | Lieferumsatz: ${fmtEur(cur.revenue.deliveryEur)}
Ø Bestellwert: ${fmtEur(cur.orders.avgValueEur)}

Ø Lieferzeit: ${fmtNum(cur.performance.avgDeliveryMin, ' Min')}${delta(cur.performance.avgDeliveryMin, prev.performance.avgDeliveryMin)} | On-Time: ${fmtPct(cur.performance.onTimeRatePct)}${delta(cur.performance.onTimeRatePct, prev.performance.onTimeRatePct)}
Ø ETA-Abweichung: ${fmtNum(cur.performance.avgEtaDeviationMin, ' Min')} | Ausgeliefert: ${cur.performance.totalDelivered}

Aktive Fahrer: ${cur.drivers.uniqueActive}${delta(cur.drivers.uniqueActive, prev.drivers.uniqueActive)} | Schichten: ${cur.drivers.totalShifts} | Ø Lieferungen/Fahrer: ${fmtNum(cur.drivers.avgDeliveriesPerDriver)}
CDES-Score: ${fmtNum(cur.experience.avgCdesScore, '/100')}${delta(cur.experience.avgCdesScore, prev.experience.avgCdesScore)} | Kritische CDES: ${cur.experience.cdesCriticalCount}
Kundenzufriedenheit: ${fmtNum(cur.experience.avgSatisfactionRating, '/5')} (${cur.experience.satisfactionCount} Bewertungen)
Verspätungen: ${cur.experience.delayCount} | Gutscheine: ${cur.experience.delayVouchersIssued}

=== ANOMALIEN vs. VORTAG ===
${anomalyLines}

Erstelle eine strukturierte Management-Zusammenfassung auf Deutsch mit genau diesen 4 Abschnitten:

1. **Tagesbilanz** — Ein-Satz-Zusammenfassung: Wie war der Tag? Besser oder schlechter als gestern?
2. **Highlights** — Was lief besonders gut? (2–3 Punkte)
3. **Handlungsbedarf** — Was muss morgen verbessert werden? (2–3 konkrete Punkte)
4. **Empfehlung für morgen** — 1–2 Sätze: die wichtigste operative Maßnahme.

Bleibe prägnant, handlungsorientiert und konkret. Kein Fachjargon.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// streamDailyDigest
// ─────────────────────────────────────────────────────────────────────────────

export async function streamDailyDigest(
  locationId: string,
  date: string = todayUtc(),
): Promise<ReadableStream<string>> {
  const [curMetrics, prevMetrics] = await Promise.all([
    gatherDailyMetrics(locationId, date),
    gatherDailyMetrics(locationId, prevDay(date)),
  ]);

  const anomalies = detectAnomalies(curMetrics, prevMetrics);
  const prompt = buildDigestPrompt(curMetrics, prevMetrics, anomalies);

  const client = new Anthropic();
  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  return new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(event.delta.text);
          }
        }
      } finally {
        controller.close();
      }
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// saveDailyDigest
// ─────────────────────────────────────────────────────────────────────────────

export async function saveDailyDigest(
  locationId: string,
  date: string = todayUtc(),
): Promise<DailyDigest | null> {
  const sb = createServiceClient();

  const [curMetrics, prevMetrics] = await Promise.all([
    gatherDailyMetrics(locationId, date),
    gatherDailyMetrics(locationId, prevDay(date)),
  ]);

  const anomalies = detectAnomalies(curMetrics, prevMetrics);

  // AI-Zusammenfassung generieren (kein Streaming — kompletter Text)
  let aiSummary: string | null = null;
  try {
    const client = new Anthropic();
    const prompt = buildDigestPrompt(curMetrics, prevMetrics, anomalies);
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content[0];
    if (block.type === 'text') aiSummary = block.text;
  } catch {
    // AI-Zusammenfassung optional — kein Fatal
  }

  const { data, error } = await sb
    .from('delivery_daily_digests')
    .upsert(
      {
        location_id:  locationId,
        digest_date:  date,
        metrics:      curMetrics as unknown as Record<string, unknown>,
        anomalies:    anomalies as unknown as Record<string, unknown>[],
        ai_summary:   aiSummary,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'location_id,digest_date' },
    )
    .select()
    .maybeSingle();

  if (error) {
    // Graceful: Migration 057 noch nicht eingespielt
    if (error.code === '42P01') return null;
    throw error;
  }
  if (!data) return null;

  return mapRow(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// getDailyDigest
// ─────────────────────────────────────────────────────────────────────────────

export async function getDailyDigest(
  locationId: string,
  date: string = todayUtc(),
): Promise<DailyDigest | null> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('delivery_daily_digests')
    .select('id, location_id, digest_date, metrics, anomalies, ai_summary, generated_at')
    .eq('location_id', locationId)
    .eq('digest_date', date)
    .maybeSingle();

  if (error) {
    if (error.code === '42P01') return null;
    throw error;
  }
  if (!data) return null;

  return mapRow(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// getDigestHistory
// ─────────────────────────────────────────────────────────────────────────────

export async function getDigestHistory(
  locationId: string,
  days = 30,
): Promise<DigestHistoryEntry[]> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('delivery_daily_digests')
    .select('id, digest_date, metrics, anomalies, ai_summary, generated_at')
    .eq('location_id', locationId)
    .order('digest_date', { ascending: false })
    .limit(Math.min(days, 90));

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    digestDate: row.digest_date as string,
    metrics: row.metrics as unknown as DailyMetrics,
    anomalies: (row.anomalies ?? []) as unknown as DigestAnomaly[],
    aiSummary: row.ai_summary as string | null,
    generatedAt: row.generated_at as string,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// generateDigestAllLocations (Cron-Helfer)
// ─────────────────────────────────────────────────────────────────────────────

export async function generateDigestAllLocations(
  date: string = prevDay(todayUtc()),
): Promise<{ locations: number; generated: number; errors: number }> {
  const sb = createServiceClient();

  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('is_active', true);

  if (!locs || locs.length === 0) return { locations: 0, generated: 0, errors: 0 };

  let generated = 0;
  let errors = 0;

  await Promise.all(
    locs.map(async (loc) => {
      try {
        const result = await saveDailyDigest(loc.id as string, date);
        if (result) generated++;
      } catch {
        errors++;
      }
    }),
  );

  return { locations: locs.length, generated, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktion: DB-Row → DailyDigest
// ─────────────────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): DailyDigest {
  return {
    id:          row.id as string,
    locationId:  row.location_id as string,
    digestDate:  row.digest_date as string,
    metrics:     row.metrics as unknown as DailyMetrics,
    anomalies:   (row.anomalies ?? []) as unknown as DigestAnomaly[],
    aiSummary:   row.ai_summary as string | null,
    generatedAt: row.generated_at as string,
  };
}
