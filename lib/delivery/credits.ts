/**
 * lib/delivery/credits.ts
 *
 * Delivery Credit & Late-Compensation Engine — Phase 45
 *
 * Stellt automatisch Gutschriften aus wenn Lieferungen zu spät kommen oder
 * fehlschlagen. Konfigurierbare Regeln pro Location.
 * Admin kann Credits auch manuell ausstellen und stornieren.
 *
 * Graceful Fallback: alle Funktionen fangen Migration-fehlt-Fehler ab
 * (Postgres-Code 42P01) und geben leere / Fallback-Daten zurück.
 *
 * Funktionen:
 *  getCreditRules(locationId)
 *  upsertCreditRule(locationId, rule)
 *  evaluateAndIssueLateCredit(orderId, locationId, deliveredAt)
 *  issueFailedDeliveryCredit(orderId, locationId)
 *  issueManualCredit(input)
 *  getCredits(locationId, options)
 *  getCreditSummary(locationId)
 *  cancelCredit(creditId, locationId)
 *  expireStaleCredits()    — Cron-Helfer
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─────────────────────────────────────────────────────────────────────────────
// Typen
// ─────────────────────────────────────────────────────────────────────────────

export type CreditReason = 'late_delivery' | 'failed_delivery' | 'manual' | 'quality';
export type CreditStatus = 'issued' | 'redeemed' | 'expired' | 'cancelled';
export type CreditTrigger = 'late_delivery' | 'failed_delivery' | 'manual';

export interface CreditRule {
  id: string;
  locationId: string;
  triggerType: CreditTrigger;
  thresholdMin: number | null;
  creditEur: number;
  creditPct: number | null;
  maxCreditEur: number;
  expiresInDays: number;
  active: boolean;
}

export interface DeliveryCredit {
  id: string;
  locationId: string;
  orderId: string | null;
  redeemedOrderId: string | null;
  amountEur: number;
  reason: CreditReason;
  reasonDetail: string | null;
  status: CreditStatus;
  token: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  lateMinutes: number | null;
  issuedAt: string;
  expiresAt: string | null;
  redeemedAt: string | null;
  notes: string | null;
  bestellnummer?: string | null;
  orderTotalEur?: number | null;
  zone?: string | null;
}

export interface CreditSummary {
  locationId: string;
  locationName: string;
  issuedCount: number;
  issuedTotalEur: number;
  redeemedCount: number;
  redeemedTotalEur: number;
  expiredCount: number;
  expiredTotalEur: number;
  cancelledCount: number;
  lateDeliveryCount: number;
  failedDeliveryCount: number;
  manualCount: number;
  redemptionRatePct: number;
}

export interface ManualCreditInput {
  locationId: string;
  orderId?: string | null;
  amountEur: number;
  reason: CreditReason;
  reasonDetail?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  expiresInDays?: number;
  createdBy?: string | null;
}

export interface IssueResult {
  issued: boolean;
  creditId: string | null;
  amountEur: number | null;
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ─────────────────────────────────────────────────────────────────────────────

function isMigrationMissing(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '42P01'
  );
}

function rowToRule(r: Record<string, unknown>): CreditRule {
  return {
    id:            r.id as string,
    locationId:    r.location_id as string,
    triggerType:   r.trigger_type as CreditTrigger,
    thresholdMin:  r.threshold_min != null ? Number(r.threshold_min) : null,
    creditEur:     Number(r.credit_eur),
    creditPct:     r.credit_pct != null ? Number(r.credit_pct) : null,
    maxCreditEur:  Number(r.max_credit_eur),
    expiresInDays: Number(r.expires_in_days),
    active:        Boolean(r.active),
  };
}

function rowToCredit(r: Record<string, unknown>): DeliveryCredit {
  return {
    id:               r.id as string,
    locationId:       r.location_id as string,
    orderId:          (r.order_id as string | null) ?? null,
    redeemedOrderId:  (r.redeemed_order_id as string | null) ?? null,
    amountEur:        Number(r.amount_eur),
    reason:           r.reason as CreditReason,
    reasonDetail:     (r.reason_detail as string | null) ?? null,
    status:           r.status as CreditStatus,
    token:            r.token as string,
    customerName:     (r.customer_name as string | null) ?? null,
    customerEmail:    (r.customer_email as string | null) ?? null,
    customerPhone:    (r.customer_phone as string | null) ?? null,
    lateMinutes:      r.late_minutes != null ? Number(r.late_minutes) : null,
    issuedAt:         r.issued_at as string,
    expiresAt:        (r.expires_at as string | null) ?? null,
    redeemedAt:       (r.redeemed_at as string | null) ?? null,
    notes:            (r.notes as string | null) ?? null,
    bestellnummer:    (r.bestellnummer as string | null) ?? null,
    orderTotalEur:    r.order_total_eur != null ? Number(r.order_total_eur) : null,
    zone:             (r.zone as string | null) ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Öffentliche API
// ─────────────────────────────────────────────────────────────────────────────

/** Lädt aktive Kreditregeln für eine Location. */
export async function getCreditRules(locationId: string): Promise<CreditRule[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('delivery_credit_rules')
    .select('id, location_id, trigger_type, threshold_min, credit_eur, credit_pct, max_credit_eur, expires_in_days, active')
    .eq('location_id', locationId)
    .order('trigger_type', { ascending: true });

  if (error) {
    if (isMigrationMissing(error)) return [];
    throw error;
  }
  return (data ?? []).map((r) => rowToRule(r as Record<string, unknown>));
}

/** Erstellt oder aktualisiert eine Kreditregel (UPSERT). */
export async function upsertCreditRule(
  locationId: string,
  input: Omit<CreditRule, 'id' | 'locationId'>,
): Promise<CreditRule> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('delivery_credit_rules')
    .upsert(
      {
        location_id:    locationId,
        trigger_type:   input.triggerType,
        threshold_min:  input.thresholdMin,
        credit_eur:     input.creditEur,
        credit_pct:     input.creditPct,
        max_credit_eur: input.maxCreditEur,
        expires_in_days: input.expiresInDays,
        active:         input.active,
      },
      { onConflict: 'location_id,trigger_type' },
    )
    .select('id, location_id, trigger_type, threshold_min, credit_eur, credit_pct, max_credit_eur, expires_in_days, active')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Kreditregel konnte nicht gespeichert werden');
  return rowToRule(data as Record<string, unknown>);
}

/**
 * Prüft nach Lieferung ob die Tour verspätet war und stellt ggf. einen Credit aus.
 * Wird fire-and-forget aus tours/[id]/status PATCH aufgerufen.
 */
export async function evaluateAndIssueLateCredit(
  orderId: string,
  locationId: string,
  deliveredAt: Date,
): Promise<IssueResult> {
  const sb = createServiceClient();

  // Aktive late_delivery Regel laden
  const { data: ruleRow, error: ruleErr } = await sb
    .from('delivery_credit_rules')
    .select('id, threshold_min, credit_eur, credit_pct, max_credit_eur, expires_in_days')
    .eq('location_id', locationId)
    .eq('trigger_type', 'late_delivery')
    .eq('active', true)
    .maybeSingle();

  if (ruleErr) {
    if (isMigrationMissing(ruleErr)) return { issued: false, creditId: null, amountEur: null, reason: 'migration_pending' };
    return { issued: false, creditId: null, amountEur: null, reason: 'rule_load_error' };
  }

  if (!ruleRow) {
    return { issued: false, creditId: null, amountEur: null, reason: 'no_rule_configured' };
  }

  const rule = ruleRow as {
    threshold_min: number | null;
    credit_eur: number;
    credit_pct: number | null;
    max_credit_eur: number;
    expires_in_days: number;
  };

  // Bestellung laden um eta_latest + Kundendaten zu bekommen
  const { data: order, error: orderErr } = await sb
    .from('customer_orders')
    .select('id, bestellnummer, eta_latest, eta_earliest, gesamtbetrag, name, telefon, delivery_zone')
    .eq('id', orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return { issued: false, creditId: null, amountEur: null, reason: 'order_not_found' };
  }

  // Verspätung berechnen — gegen eta_latest (späteste Zusage)
  const promisedAt = order.eta_latest
    ? new Date(order.eta_latest as string)
    : null;

  if (!promisedAt) {
    return { issued: false, creditId: null, amountEur: null, reason: 'no_eta_promised' };
  }

  const lateMs = deliveredAt.getTime() - promisedAt.getTime();
  const lateMin = Math.round(lateMs / 60_000);

  const thresholdMin = rule.threshold_min ?? 10;

  if (lateMin < thresholdMin) {
    return { issued: false, creditId: null, amountEur: null, reason: `on_time (${lateMin}m < ${thresholdMin}m threshold)` };
  }

  // Bereits ein Credit für diese Bestellung?
  const { data: existing } = await sb
    .from('delivery_credits')
    .select('id')
    .eq('order_id', orderId)
    .eq('reason', 'late_delivery')
    .maybeSingle();

  if (existing) {
    return { issued: false, creditId: existing.id as string, amountEur: null, reason: 'already_issued' };
  }

  // Betrag berechnen
  let amount = Number(rule.credit_eur);
  if (rule.credit_pct && order.gesamtbetrag) {
    const pctAmount = (Number(order.gesamtbetrag) * Number(rule.credit_pct)) / 100;
    amount = Math.min(amount + pctAmount, Number(rule.max_credit_eur));
  }
  amount = Math.round(amount * 100) / 100;

  // Ablaufdatum
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + Number(rule.expires_in_days));

  const { data: credit, error: insertErr } = await sb
    .from('delivery_credits')
    .insert({
      location_id:   locationId,
      order_id:      orderId,
      amount_eur:    amount,
      reason:        'late_delivery',
      reason_detail: `${lateMin} Min. nach ETA-Versprechen geliefert`,
      customer_name:  (order.name as string | null) ?? null,
      customer_phone: (order.telefon as string | null) ?? null,
      late_minutes:   lateMin,
      expires_at:    expiresAt.toISOString(),
    })
    .select('id')
    .maybeSingle();

  if (insertErr) {
    if (isMigrationMissing(insertErr)) return { issued: false, creditId: null, amountEur: null, reason: 'migration_pending' };
    return { issued: false, creditId: null, amountEur: null, reason: insertErr.message };
  }

  return {
    issued:   true,
    creditId: credit?.id as string ?? null,
    amountEur: amount,
    reason:   `late_${lateMin}min`,
  };
}

/**
 * Stellt einen Credit nach fehlgeschlagener Zustellung aus (für recovery-Flow).
 */
export async function issueFailedDeliveryCredit(
  orderId: string,
  locationId: string,
): Promise<IssueResult> {
  const sb = createServiceClient();

  const { data: ruleRow, error: ruleErr } = await sb
    .from('delivery_credit_rules')
    .select('credit_eur, credit_pct, max_credit_eur, expires_in_days')
    .eq('location_id', locationId)
    .eq('trigger_type', 'failed_delivery')
    .eq('active', true)
    .maybeSingle();

  if (ruleErr) {
    if (isMigrationMissing(ruleErr)) return { issued: false, creditId: null, amountEur: null, reason: 'migration_pending' };
    return { issued: false, creditId: null, amountEur: null, reason: 'rule_load_error' };
  }

  if (!ruleRow) {
    return { issued: false, creditId: null, amountEur: null, reason: 'no_rule_configured' };
  }

  // Dedup-Guard
  const { data: existing } = await sb
    .from('delivery_credits')
    .select('id')
    .eq('order_id', orderId)
    .eq('reason', 'failed_delivery')
    .maybeSingle();

  if (existing) {
    return { issued: false, creditId: existing.id as string, amountEur: null, reason: 'already_issued' };
  }

  const { data: order } = await sb
    .from('customer_orders')
    .select('name, telefon, gesamtbetrag')
    .eq('id', orderId)
    .maybeSingle();

  const rule = ruleRow as { credit_eur: number; credit_pct: number | null; max_credit_eur: number; expires_in_days: number };
  let amount = Number(rule.credit_eur);
  if (rule.credit_pct && order?.gesamtbetrag) {
    const pctAmount = (Number(order.gesamtbetrag) * Number(rule.credit_pct)) / 100;
    amount = Math.min(amount + pctAmount, Number(rule.max_credit_eur));
  }
  amount = Math.round(amount * 100) / 100;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + Number(rule.expires_in_days));

  const { data: credit, error: insertErr } = await sb
    .from('delivery_credits')
    .insert({
      location_id:    locationId,
      order_id:       orderId,
      amount_eur:     amount,
      reason:         'failed_delivery',
      reason_detail:  'Zustellung fehlgeschlagen',
      customer_name:  (order?.name as string | null) ?? null,
      customer_phone: (order?.telefon as string | null) ?? null,
      expires_at:     expiresAt.toISOString(),
    })
    .select('id')
    .maybeSingle();

  if (insertErr) {
    if (isMigrationMissing(insertErr)) return { issued: false, creditId: null, amountEur: null, reason: 'migration_pending' };
    return { issued: false, creditId: null, amountEur: null, reason: insertErr.message };
  }

  return {
    issued:    true,
    creditId:  credit?.id as string ?? null,
    amountEur: amount,
    reason:    'failed_delivery',
  };
}

/** Admin stellt manuellen Credit aus. */
export async function issueManualCredit(input: ManualCreditInput): Promise<DeliveryCredit> {
  const sb = createServiceClient();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (input.expiresInDays ?? 30));

  const { data, error } = await sb
    .from('delivery_credits')
    .insert({
      location_id:   input.locationId,
      order_id:      input.orderId ?? null,
      amount_eur:    input.amountEur,
      reason:        input.reason,
      reason_detail: input.reasonDetail ?? null,
      customer_name:  input.customerName ?? null,
      customer_email: input.customerEmail ?? null,
      customer_phone: input.customerPhone ?? null,
      notes:         input.notes ?? null,
      expires_at:    expiresAt.toISOString(),
      created_by:    input.createdBy ?? null,
    })
    .select('id, location_id, order_id, redeemed_order_id, amount_eur, reason, reason_detail, status, token, customer_name, customer_email, customer_phone, late_minutes, issued_at, expires_at, redeemed_at, notes')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Credit konnte nicht erstellt werden');
  return rowToCredit(data as Record<string, unknown>);
}

/** Lädt Credits für eine Location. */
export async function getCredits(
  locationId: string,
  options: {
    status?: CreditStatus;
    limit?: number;
    offset?: number;
    withOrderDetails?: boolean;
  } = {},
): Promise<DeliveryCredit[]> {
  const sb = createServiceClient();

  const BASE_COLS =
    'id, location_id, order_id, redeemed_order_id, amount_eur, reason, reason_detail, status, token, customer_name, customer_email, customer_phone, late_minutes, issued_at, expires_at, redeemed_at, notes';

  let q = sb
    .from('delivery_credits')
    .select(BASE_COLS)
    .eq('location_id', locationId)
    .order('issued_at', { ascending: false })
    .limit(options.limit ?? 50);

  if (options.status) q = q.eq('status', options.status);
  if (options.offset) q = q.range(options.offset, options.offset + (options.limit ?? 50) - 1);

  const { data, error } = await q;

  if (error) {
    if (isMigrationMissing(error)) return [];
    throw error;
  }

  const credits = (data ?? []).map((r) => rowToCredit(r as Record<string, unknown>));

  // Optionale Bestelldetails: separater Lookup auf customer_orders
  if (options.withOrderDetails && credits.length > 0) {
    const orderIds = credits
      .map((c) => c.orderId)
      .filter((id): id is string => id !== null);

    if (orderIds.length > 0) {
      const { data: orders } = await sb
        .from('customer_orders')
        .select('id, bestellnummer, gesamtbetrag, delivery_zone')
        .in('id', orderIds);

      const orderMap = new Map<string, { bestellnummer: string | null; gesamtbetrag: number | null; delivery_zone: string | null }>();
      for (const o of orders ?? []) {
        orderMap.set(o.id as string, {
          bestellnummer: (o.bestellnummer as string | null) ?? null,
          gesamtbetrag:  o.gesamtbetrag != null ? Number(o.gesamtbetrag) : null,
          delivery_zone: (o.delivery_zone as string | null) ?? null,
        });
      }

      return credits.map((c) => {
        const od = c.orderId ? (orderMap.get(c.orderId) ?? null) : null;
        return {
          ...c,
          bestellnummer: od?.bestellnummer ?? null,
          orderTotalEur: od?.gesamtbetrag ?? null,
          zone:          od?.delivery_zone ?? null,
        };
      });
    }
  }

  return credits;
}

/** Aggregierte Statistik für Admin-Dashboard. */
export async function getCreditSummary(locationId: string): Promise<CreditSummary | null> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('v_credit_summary')
    .select('location_id, location_name, issued_count, issued_total_eur, redeemed_count, redeemed_total_eur, expired_count, expired_total_eur, cancelled_count, late_delivery_count, failed_delivery_count, manual_count, redemption_rate_pct')
    .eq('location_id', locationId)
    .maybeSingle();

  if (error) {
    if (isMigrationMissing(error)) return null;
    throw error;
  }
  if (!data) return null;

  const r = data as Record<string, unknown>;
  return {
    locationId:          r.location_id as string,
    locationName:        r.location_name as string,
    issuedCount:         Number(r.issued_count ?? 0),
    issuedTotalEur:      Number(r.issued_total_eur ?? 0),
    redeemedCount:       Number(r.redeemed_count ?? 0),
    redeemedTotalEur:    Number(r.redeemed_total_eur ?? 0),
    expiredCount:        Number(r.expired_count ?? 0),
    expiredTotalEur:     Number(r.expired_total_eur ?? 0),
    cancelledCount:      Number(r.cancelled_count ?? 0),
    lateDeliveryCount:   Number(r.late_delivery_count ?? 0),
    failedDeliveryCount: Number(r.failed_delivery_count ?? 0),
    manualCount:         Number(r.manual_count ?? 0),
    redemptionRatePct:   Number(r.redemption_rate_pct ?? 0),
  };
}

/** Storniert einen Credit (nur wenn noch nicht eingelöst). */
export async function cancelCredit(
  creditId: string,
  locationId: string,
): Promise<{ ok: boolean; reason: string }> {
  const sb = createServiceClient();

  const { data: existing } = await sb
    .from('delivery_credits')
    .select('id, status')
    .eq('id', creditId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!existing) return { ok: false, reason: 'not_found' };
  if ((existing as { status: string }).status === 'redeemed') {
    return { ok: false, reason: 'already_redeemed' };
  }
  if ((existing as { status: string }).status === 'cancelled') {
    return { ok: false, reason: 'already_cancelled' };
  }

  const { error } = await sb
    .from('delivery_credits')
    .update({ status: 'cancelled' })
    .eq('id', creditId)
    .eq('location_id', locationId);

  if (error) return { ok: false, reason: error.message };
  return { ok: true, reason: 'cancelled' };
}

/**
 * Markiert alle abgelaufenen 'issued'-Credits als 'expired'.
 * Cron-Helfer — einmal pro Stunde ausreichend.
 */
export async function expireStaleCredits(): Promise<{ expired: number }> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('delivery_credits')
    .update({ status: 'expired' })
    .eq('status', 'issued')
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    if (isMigrationMissing(error)) return { expired: 0 };
    return { expired: 0 };
  }

  return { expired: (data ?? []).length };
}
