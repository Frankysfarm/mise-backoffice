/**
 * lib/delivery/sla-compensation.ts — Phase 157
 *
 * SLA Auto-Kompensation Engine
 *
 * Wenn eine Lieferung die zugesagte ETA um mehr als den konfigurierten
 * Schwellenwert (Standard 15 Min) überschreitet, wird automatisch
 * ein Guthaben an den Kunden ausgestellt (via delivery_credits).
 *
 * Ablauf (Cron alle 30 Min):
 *  1. Kürzlich abgeschlossene Lieferungen prüfen (letzten 2h, noch nicht kompensiert)
 *  2. Verzögerung gegenüber ETA berechnen
 *  3. Bei Überschreitung: Guthaben ausstellen via credits.ts
 *  4. Ergebnis in sla_compensation_events loggen
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface SlaCompConfig {
  locationId: string;
  enabled: boolean;
  thresholdMin: number;
  amountEur: number;
  maxPerCustomerMonth: number;
}

export interface SlaCompEvent {
  id: string;
  locationId: string;
  orderId: string;
  customerEmail: string | null;
  customerName: string | null;
  etaPromisedAt: string | null;
  deliveredAt: string | null;
  delayMin: number;
  thresholdMin: number;
  compensationEur: number;
  creditId: string | null;
  status: 'issued' | 'failed' | 'skipped';
  skipReason: string | null;
  processedAt: string;
  createdAt: string;
}

export interface ProcessResult {
  locationId: string;
  ordersChecked: number;
  compensated: number;
  skipped: number;
  failed: number;
  totalEurIssued: number;
}

// ── Konfig ────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Omit<SlaCompConfig, 'locationId'> = {
  enabled:             true,
  thresholdMin:        15,
  amountEur:           2.00,
  maxPerCustomerMonth: 3,
};

async function getConfig(locationId: string): Promise<SlaCompConfig> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('sla_compensation_config')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) return { locationId, ...DEFAULT_CONFIG };
  return {
    locationId,
    enabled:             Boolean(data.enabled),
    thresholdMin:        (data.threshold_min as number) ?? DEFAULT_CONFIG.thresholdMin,
    amountEur:           Number(data.amount_eur ?? DEFAULT_CONFIG.amountEur),
    maxPerCustomerMonth: (data.max_per_customer_month as number) ?? DEFAULT_CONFIG.maxPerCustomerMonth,
  };
}

// ── Verarbeitungs-Kern ────────────────────────────────────────────────────────

/**
 * Prüft kürzlich abgeschlossene Bestellungen auf SLA-Verletzungen
 * und stellt Gutschriften aus. Läuft alle 30 Minuten via Cron.
 */
export async function processAutoCompensations(locationId: string): Promise<ProcessResult> {
  const sb     = createServiceClient();
  const config = await getConfig(locationId);

  const result: ProcessResult = {
    locationId,
    ordersChecked:  0,
    compensated:    0,
    skipped:        0,
    failed:         0,
    totalEurIssued: 0,
  };

  if (!config.enabled) {
    return result;
  }

  // Bestellungen der letzten 2 Stunden die geliefert wurden und noch nicht kompensiert
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: orders } = await sb
    .from('customer_orders')
    .select('id, location_id, kunde_email, kunde_name, geliefert_am, eta_latest_at, bestellnummer')
    .eq('location_id', locationId)
    .in('status', ['geliefert', 'abgeschlossen'])
    .eq('typ', 'lieferung')
    .gte('geliefert_am', twoHoursAgo)
    .not('geliefert_am', 'is', null)
    .not('eta_latest_at', 'is', null)
    .limit(100);

  if (!orders || orders.length === 0) return result;

  // IDs der schon kompensierten Bestellungen laden
  const orderIds = orders.map((o) => o.id as string);
  const { data: alreadyComp } = await sb
    .from('sla_compensation_events')
    .select('order_id')
    .in('order_id', orderIds);

  const compensatedSet = new Set((alreadyComp ?? []).map((r) => String(r.order_id)));

  for (const order of orders) {
    result.ordersChecked++;
    const orderId = order.id as string;

    if (compensatedSet.has(orderId)) {
      result.skipped++;
      continue;
    }

    const deliveredAt   = new Date(order.geliefert_am as string).getTime();
    const etaPromisedAt = new Date(order.eta_latest_at as string).getTime();
    const delayMin      = Math.round((deliveredAt - etaPromisedAt) / 60_000);

    // Keine Kompensation wenn on-time oder nur leicht verspätet
    if (delayMin < config.thresholdMin) {
      await _logSkip(sb, locationId, order, delayMin, config.thresholdMin, 'delay_below_threshold');
      result.skipped++;
      continue;
    }

    // Monatliches Limit pro Kunde prüfen
    const customerEmail = (order.kunde_email as string | null) ?? null;
    if (customerEmail && config.maxPerCustomerMonth > 0) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { count: monthlyCount } = await sb
        .from('sla_compensation_events')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .eq('customer_email', customerEmail)
        .eq('status', 'issued')
        .gte('created_at', monthStart.toISOString());

      if ((monthlyCount ?? 0) >= config.maxPerCustomerMonth) {
        await _logSkip(sb, locationId, order, delayMin, config.thresholdMin, 'monthly_limit_reached');
        result.skipped++;
        continue;
      }
    }

    // Guthaben ausstellen
    let creditId: string | null = null;
    let status: 'issued' | 'failed' = 'issued';
    let errorDetail: string | null  = null;

    try {
      const amountCents = Math.round(config.amountEur * 100);
      const { data: credit, error: creditErr } = await sb
        .from('delivery_credits')
        .insert({
          location_id:    locationId,
          order_id:       orderId,
          customer_email: customerEmail,
          customer_name:  (order.kunde_name as string | null) ?? null,
          amount_cents:   amountCents,
          reason:         `SLA-Kompensation: Lieferung ${delayMin} Min verspätet (Schwelle: ${config.thresholdMin} Min)`,
          source:         'sla_auto_compensation',
          status:         'active',
          expires_at:     new Date(Date.now() + 90 * 86_400_000).toISOString(), // 90 Tage
        })
        .select('id')
        .single();

      if (creditErr) throw new Error(creditErr.message);
      creditId = credit?.id as string | null;
    } catch (e) {
      status      = 'failed';
      errorDetail = String(e);
      result.failed++;
    }

    // Kompensations-Event loggen
    await sb.from('sla_compensation_events').insert({
      location_id:      locationId,
      order_id:         orderId,
      customer_email:   customerEmail,
      customer_name:    (order.kunde_name as string | null) ?? null,
      eta_promised_at:  order.eta_latest_at as string,
      delivered_at:     order.geliefert_am as string,
      delay_min:        delayMin,
      threshold_min:    config.thresholdMin,
      compensation_eur: config.amountEur,
      credit_id:        creditId,
      status,
      error_detail:     errorDetail,
    }).then(() => {}, () => {});

    if (status === 'issued') {
      result.compensated++;
      result.totalEurIssued += config.amountEur;
    }
  }

  return result;
}

/** Cron-Batch: alle aktiven Locations prüfen. */
export async function processAutoCompensationsAllLocations(): Promise<{
  locations: number;
  compensated: number;
  totalEurIssued: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(50);

  if (!locs || locs.length === 0) {
    return { locations: 0, compensated: 0, totalEurIssued: 0, errors: 0 };
  }

  let compensated    = 0;
  let totalEurIssued = 0;
  let errors         = 0;

  const results = await Promise.allSettled(
    locs.map((l) => processAutoCompensations(l.id as string)),
  );

  for (const r of results) {
    if (r.status === 'fulfilled') {
      compensated    += r.value.compensated;
      totalEurIssued += r.value.totalEurIssued;
      errors         += r.value.failed;
    } else {
      errors++;
    }
  }

  return { locations: locs.length, compensated, totalEurIssued, errors };
}

/** Kompensations-Events für eine Location laden. */
export async function getCompensationEvents(
  locationId: string,
  opts: { limit?: number; since?: string } = {},
): Promise<SlaCompEvent[]> {
  const sb = createServiceClient();
  const { limit = 50, since } = opts;

  let q = sb
    .from('sla_compensation_events')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (since) q = q.gte('created_at', since);

  const { data } = await q;
  return (data ?? []).map(_mapEvent);
}

/** Aktuelle Konfiguration lesen und ggf. updaten. */
export async function upsertCompConfig(locationId: string, input: Partial<SlaCompConfig>): Promise<SlaCompConfig> {
  const sb = createServiceClient();
  const current = await getConfig(locationId);
  const merged  = { ...current, ...input };

  await sb
    .from('sla_compensation_config')
    .upsert({
      location_id:           locationId,
      enabled:               merged.enabled,
      threshold_min:         merged.thresholdMin,
      amount_eur:            merged.amountEur,
      max_per_customer_month: merged.maxPerCustomerMonth,
      updated_at:            new Date().toISOString(),
    }, { onConflict: 'location_id' });

  return merged;
}

/** Zusammenfassung: letzte 30 Tage. */
export async function getCompensationSummary(locationId: string): Promise<{
  totalIssued: number;
  totalEurIssued: number;
  avgDelayMin: number | null;
  config: SlaCompConfig;
}> {
  const sb   = createServiceClient();
  const [eventsRes, config] = await Promise.all([
    sb
      .from('sla_compensation_events')
      .select('compensation_eur, delay_min, status')
      .eq('location_id', locationId)
      .eq('status', 'issued')
      .gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
    getConfig(locationId),
  ]);

  const issued = (eventsRes.data ?? []).filter((e) => e.status === 'issued');
  const totalEur = issued.reduce((s, e) => s + Number(e.compensation_eur), 0);
  const avgDelay = issued.length
    ? issued.reduce((s, e) => s + (e.delay_min as number), 0) / issued.length
    : null;

  return {
    totalIssued:    issued.length,
    totalEurIssued: Math.round(totalEur * 100) / 100,
    avgDelayMin:    avgDelay !== null ? Math.round(avgDelay) : null,
    config,
  };
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

async function _logSkip(
  sb: ReturnType<typeof createServiceClient>,
  locationId: string,
  order: Record<string, unknown>,
  delayMin: number,
  thresholdMin: number,
  reason: string,
): Promise<void> {
  await sb.from('sla_compensation_events').upsert({
    location_id:      locationId,
    order_id:         order.id as string,
    customer_email:   (order.kunde_email as string | null) ?? null,
    customer_name:    (order.kunde_name as string | null) ?? null,
    eta_promised_at:  order.eta_latest_at as string | null,
    delivered_at:     order.geliefert_am as string | null,
    delay_min:        delayMin,
    threshold_min:    thresholdMin,
    compensation_eur: 0,
    status:           'skipped',
    skip_reason:      reason,
  }, { onConflict: 'order_id', ignoreDuplicates: true }).then(() => {}, () => {});
}

function _mapEvent(row: Record<string, unknown>): SlaCompEvent {
  return {
    id:              row.id as string,
    locationId:      row.location_id as string,
    orderId:         row.order_id as string,
    customerEmail:   (row.customer_email as string | null) ?? null,
    customerName:    (row.customer_name as string | null) ?? null,
    etaPromisedAt:   (row.eta_promised_at as string | null) ?? null,
    deliveredAt:     (row.delivered_at as string | null) ?? null,
    delayMin:        row.delay_min as number,
    thresholdMin:    row.threshold_min as number,
    compensationEur: Number(row.compensation_eur),
    creditId:        (row.credit_id as string | null) ?? null,
    status:          row.status as SlaCompEvent['status'],
    skipReason:      (row.skip_reason as string | null) ?? null,
    processedAt:     row.processed_at as string,
    createdAt:       row.created_at as string,
  };
}
