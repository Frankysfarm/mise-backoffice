/**
 * lib/delivery/cancellation-guard.ts
 *
 * Phase 344 — Smart Cancellation Guard
 *
 * Erkennt und verhindert missbräuchliche Stornierungen:
 *  1. checkCancellationRisk(locationId, customerId, orderId) — Risiko analysieren
 *  2. recordCancellationEvent(...) — Ereignis loggen
 *  3. offerVoucherIntervention(...) — Voucher anbieten + loggen
 *  4. getDashboard(locationId) — KPIs + Ereignis-Log
 *  5. getConfig / upsertConfig — Admin-Konfiguration
 *  6. pruneOldEvents(daysToKeep) — Cleanup via RPC
 *  7. runGuardAllLocations() — Cron-Batch
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

export interface CancellationGuardConfig {
  isEnabled: boolean;
  maxCancellationsPerHour: number;
  voucherEnabled: boolean;
  voucherAmountEur: number;
  blockAfterNCancellations: number;
  blockWindowHours: number;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'blocked';
export type EventType =
  | 'attempt'
  | 'blocked'
  | 'voucher_offered'
  | 'voucher_used'
  | 'cancelled_allowed';

export interface CancellationGuardEvent {
  id: string;
  location_id: string;
  order_id: string | null;
  customer_id: string | null;
  event_type: EventType;
  risk_level: RiskLevel;
  cancellation_count_24h: number;
  voucher_code: string | null;
  reason: string | null;
  created_at: string;
}

export interface CancellationRiskResult {
  riskLevel: RiskLevel;
  cancellationCount24h: number;
  cancellationCountHour: number;
  shouldBlock: boolean;
  shouldOfferVoucher: boolean;
  message: string;
}

export interface CancellationGuardDashboard {
  config: CancellationGuardConfig;
  todayAttempts: number;
  todayBlocked: number;
  todayVouchersOffered: number;
  todayCancelledAllowed: number;
  blockRate: number;
  recentEvents: CancellationGuardEvent[];
  topCancellers: Array<{ customerId: string; count: number }>;
}

const DEFAULTS: CancellationGuardConfig = {
  isEnabled: true,
  maxCancellationsPerHour: 2,
  voucherEnabled: true,
  voucherAmountEur: 3.0,
  blockAfterNCancellations: 3,
  blockWindowHours: 24,
};

function mapConfig(row: Record<string, unknown>): CancellationGuardConfig {
  return {
    isEnabled: Boolean(row.is_enabled ?? DEFAULTS.isEnabled),
    maxCancellationsPerHour: Number(row.max_cancellations_per_hour ?? DEFAULTS.maxCancellationsPerHour),
    voucherEnabled: Boolean(row.voucher_enabled ?? DEFAULTS.voucherEnabled),
    voucherAmountEur: Number(row.voucher_amount_eur ?? DEFAULTS.voucherAmountEur),
    blockAfterNCancellations: Number(row.block_after_n_cancellations ?? DEFAULTS.blockAfterNCancellations),
    blockWindowHours: Number(row.block_window_hours ?? DEFAULTS.blockWindowHours),
  };
}

export async function getConfig(locationId: string): Promise<CancellationGuardConfig> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('cancellation_guard_config')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle()
    .catch(() => ({ data: null }));

  if (!data) return DEFAULTS;
  return mapConfig(data as Record<string, unknown>);
}

export async function upsertConfig(
  locationId: string,
  update: Partial<CancellationGuardConfig>,
): Promise<CancellationGuardConfig> {
  const sb = createServiceClient();
  const existing = await getConfig(locationId);
  const merged = { ...existing, ...update };

  await sb
    .from('cancellation_guard_config')
    .upsert({
      location_id: locationId,
      is_enabled: merged.isEnabled,
      max_cancellations_per_hour: merged.maxCancellationsPerHour,
      voucher_enabled: merged.voucherEnabled,
      voucher_amount_eur: merged.voucherAmountEur,
      block_after_n_cancellations: merged.blockAfterNCancellations,
      block_window_hours: merged.blockWindowHours,
    }, { onConflict: 'location_id' })
    .catch(() => {});

  return merged;
}

/** Analysiert das Stornierungsrisiko für einen Kunden */
export async function checkCancellationRisk(
  locationId: string,
  customerId: string,
  _orderId?: string,
): Promise<CancellationRiskResult> {
  const sb = createServiceClient();
  const config = await getConfig(locationId);

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const sinceBlock = new Date(Date.now() - config.blockWindowHours * 60 * 60 * 1000).toISOString();

  // Stornierungen in letzten 24h (alle Event-Typen die Stornierungsversuche sind)
  const { data: events24h } = await sb
    .from('cancellation_guard_events')
    .select('event_type, created_at')
    .eq('customer_id', customerId)
    .eq('location_id', locationId)
    .in('event_type', ['attempt', 'cancelled_allowed', 'blocked'])
    .gte('created_at', since24h)
    .catch(() => ({ data: [] as unknown[] }));

  const count24h = (events24h ?? []).length;

  // Stornierungen letzte Stunde
  const count1h = (events24h ?? []).filter(
    (e) => (e as { created_at: string }).created_at >= since1h,
  ).length;

  // Gesperrte Events im Block-Window
  const { data: blockedEvents } = await sb
    .from('cancellation_guard_events')
    .select('id')
    .eq('customer_id', customerId)
    .eq('location_id', locationId)
    .eq('event_type', 'blocked')
    .gte('created_at', sinceBlock)
    .catch(() => ({ data: [] as unknown[] }));

  const blockedCount = (blockedEvents ?? []).length;

  let riskLevel: RiskLevel = 'low';
  let shouldBlock = false;
  let shouldOfferVoucher = false;
  let message = 'Keine auffälligen Stornierungen.';

  if (!config.isEnabled) {
    return { riskLevel: 'low', cancellationCount24h: count24h, cancellationCountHour: count1h, shouldBlock: false, shouldOfferVoucher: false, message: 'Guard deaktiviert.' };
  }

  if (count24h >= config.blockAfterNCancellations || blockedCount >= 1) {
    riskLevel = 'blocked';
    shouldBlock = true;
    message = `Stornierungssperre: ${count24h} Stornierungen in 24h (Limit: ${config.blockAfterNCancellations}).`;
  } else if (count1h >= config.maxCancellationsPerHour) {
    riskLevel = 'high';
    shouldOfferVoucher = config.voucherEnabled;
    message = `Hohes Stornierungsrisiko: ${count1h} Stornierungen in 1h (Limit: ${config.maxCancellationsPerHour}).`;
  } else if (count24h >= Math.ceil(config.blockAfterNCancellations / 2)) {
    riskLevel = 'medium';
    shouldOfferVoucher = config.voucherEnabled;
    message = `Mittleres Stornierungsrisiko: ${count24h} Stornierungen in 24h.`;
  }

  return {
    riskLevel,
    cancellationCount24h: count24h,
    cancellationCountHour: count1h,
    shouldBlock,
    shouldOfferVoucher,
    message,
  };
}

/** Loggt ein Stornierungsereignis */
export async function recordCancellationEvent(
  locationId: string,
  orderId: string | null,
  customerId: string | null,
  eventType: EventType,
  riskLevel: RiskLevel,
  opts: { cancellationCount24h?: number; voucherCode?: string; reason?: string } = {},
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('cancellation_guard_events')
    .insert({
      location_id: locationId,
      order_id: orderId,
      customer_id: customerId,
      event_type: eventType,
      risk_level: riskLevel,
      cancellation_count_24h: opts.cancellationCount24h ?? 0,
      voucher_code: opts.voucherCode ?? null,
      reason: opts.reason ?? null,
    })
    .catch(() => {});
}

/** Generiert einen Voucher-Code und loggt die Intervention */
export async function offerVoucherIntervention(
  locationId: string,
  customerId: string,
  orderId: string | null,
  amountEur: number,
): Promise<string | null> {
  const sb = createServiceClient();
  const code = `CGV-${Date.now().toString(36).toUpperCase().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  // Voucher in vouchers-Tabelle speichern (best effort)
  await sb
    .from('vouchers')
    .insert({
      location_id: locationId,
      code,
      discount_type: 'fixed',
      discount_value: amountEur,
      max_uses: 1,
      used_count: 0,
      is_active: true,
      min_order_value: 0,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      description: `Stornierungsintervention für Kunde`,
    })
    .catch(() => {});

  const risk = await checkCancellationRisk(locationId, customerId, orderId ?? undefined);
  await recordCancellationEvent(locationId, orderId, customerId, 'voucher_offered', risk.riskLevel, {
    cancellationCount24h: risk.cancellationCount24h,
    voucherCode: code,
    reason: 'Automatische Intervention bei hohem Stornierungsrisiko',
  });

  return code;
}

export async function getDashboard(locationId: string): Promise<CancellationGuardDashboard> {
  const sb = createServiceClient();
  const [config, eventsResult] = await Promise.all([
    getConfig(locationId),
    sb
      .from('cancellation_guard_events')
      .select('*')
      .eq('location_id', locationId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100)
      .catch(() => ({ data: [] as unknown[] })),
  ]);

  const events = (eventsResult.data ?? []) as CancellationGuardEvent[];
  const today = events.filter(
    (e) => e.created_at >= new Date(new Date().toISOString().slice(0, 10)).toISOString(),
  );

  const todayAttempts = today.filter((e) => e.event_type === 'attempt' || e.event_type === 'cancelled_allowed' || e.event_type === 'blocked').length;
  const todayBlocked = today.filter((e) => e.event_type === 'blocked').length;
  const todayVouchersOffered = today.filter((e) => e.event_type === 'voucher_offered').length;
  const todayCancelledAllowed = today.filter((e) => e.event_type === 'cancelled_allowed').length;
  const blockRate = todayAttempts > 0 ? Math.round((todayBlocked / todayAttempts) * 100) : 0;

  // Top Cancellers (letzte 24h)
  const customerCounts = new Map<string, number>();
  for (const e of events) {
    if (e.customer_id && ['attempt', 'cancelled_allowed', 'blocked'].includes(e.event_type)) {
      customerCounts.set(e.customer_id, (customerCounts.get(e.customer_id) ?? 0) + 1);
    }
  }
  const topCancellers = Array.from(customerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([customerId, count]) => ({ customerId, count }));

  return {
    config,
    todayAttempts,
    todayBlocked,
    todayVouchersOffered,
    todayCancelledAllowed,
    blockRate,
    recentEvents: events.slice(0, 30),
    topCancellers,
  };
}

export async function pruneOldEvents(daysToKeep = 30): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .rpc('prune_cancellation_guard_events', { days_old: daysToKeep })
    .catch(() => ({ data: 0, error: null }));

  if (error) return { pruned: 0 };
  return { pruned: Number(data ?? 0) };
}

export async function runGuardAllLocations(): Promise<{ locations: number; scanned: number; errors: number }> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('is_active', true)
    .catch(() => ({ data: [] as { id: string }[] }));

  let scanned = 0;
  let errors = 0;

  const results = await Promise.allSettled(
    (locations ?? []).map(async (loc) => {
      const config = await getConfig(loc.id);
      if (!config.isEnabled) return;

      // Scanne hochriskante Kunden mit vielen Stornierungen heute
      const { data: highRiskEvents } = await sb
        .from('cancellation_guard_events')
        .select('customer_id')
        .eq('location_id', loc.id)
        .in('event_type', ['attempt', 'cancelled_allowed'])
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .catch(() => ({ data: [] as { customer_id: string }[] }));

      const customerIds = [...new Set((highRiskEvents ?? []).map((e) => e.customer_id).filter(Boolean))];
      scanned += customerIds.length;
    }),
  );

  errors = results.filter((r) => r.status === 'rejected').length;

  return {
    locations: (locations ?? []).length,
    scanned,
    errors,
  };
}
