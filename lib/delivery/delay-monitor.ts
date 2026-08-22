/**
 * lib/delivery/delay-monitor.ts
 *
 * Proactive Delay Alert System — Phase 23
 *
 * Überwacht Lieferbestellungen die ihre ETA (eta_latest) überschreiten
 * und protokolliert eskalierte Benachrichtigungsstufen:
 *
 *  first_notice    → ab 15 Min Verspätung  — Admin-Alert + Event-Log
 *  critical_notice → ab 30 Min Verspätung  — erneuter Admin-Alert
 *  compensation    → ab 30 Min Verspätung  — Gutscheincode für Kunden generiert
 *
 * Integration:
 *  - Cron: runDelayMonitorAllLocations() in smart-dispatch/route.ts
 *  - Manual: POST /api/delivery/admin/delay-monitor
 *  - Admin-View: GET /api/delivery/admin/delay-monitor
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { logDeliveryEvent } from './events';

// ─── Typen ───────────────────────────────────────────────────────────────────

export type DelayAlertType = 'first_notice' | 'critical_notice' | 'compensation';

export interface DelayedOrder {
  id: string;
  bestellnummer: string;
  locationId: string;
  status: string;
  etaLatest: string;
  batchId: string | null;
  driverId: string | null;
  delayMinutes: number;
  firstNoticeSent: boolean;
  criticalNoticeSent: boolean;
  compensationFlagged: boolean;
  voucherCreated: boolean;
}

export interface CompensationVoucher {
  id: string;
  orderId: string;
  locationId: string;
  voucherCode: string;
  discountAmount: number;
  delayMinutes: number;
  createdAt: string;
  expiresAt: string;
  redeemedAt: string | null;
  bestellnummer: string;
  orderStatus: string;
}

export interface DelayMonitorResult {
  locationId: string;
  scanned: number;
  firstNoticesSent: number;
  criticalNoticesSent: number;
  vouchersCreated: number;
  errors: number;
}

export interface DelayMonitorAllResult {
  locations: number;
  totalScanned: number;
  totalFirstNotices: number;
  totalCriticalNotices: number;
  totalVouchers: number;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Generiert einen menschenlesbaren Gutscheincode, z.B. SORRY-A3B7C */
function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SORRY-';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Berechnet Gutscheinbetrag in Abhängigkeit der Verspätung */
function computeDiscountAmount(delayMinutes: number): number {
  if (delayMinutes >= 60) return 10.00;
  if (delayMinutes >= 45) return 7.50;
  return 5.00; // ab 30 Min
}

// ─── Kern-Funktionen ──────────────────────────────────────────────────────────

/**
 * Findet alle verspäteten Lieferbestellungen für eine Location.
 * Liest aus v_delayed_orders (eta_latest < NOW, Status != geliefert/abgeschlossen).
 * Graceful: gibt [] zurück wenn der View noch nicht existiert.
 */
export async function scanDelayedOrders(locationId: string): Promise<DelayedOrder[]> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('v_delayed_orders')
    .select('id, bestellnummer, location_id, status, eta_latest, mise_batch_id, mise_driver_id, delay_minutes, first_notice_sent, critical_notice_sent, compensation_flagged, voucher_created')
    .eq('location_id', locationId)
    .order('delay_minutes', { ascending: false });

  if (error) {
    // Graceful-Fallback wenn Migration 023 noch nicht ausgeführt
    if (error.code === '42P01') return [];
    console.warn('[delay-monitor] scanDelayedOrders error:', error.message);
    return [];
  }

  return (data ?? []).map(r => ({
    id:                  r.id as string,
    bestellnummer:       r.bestellnummer as string,
    locationId:          r.location_id as string,
    status:              r.status as string,
    etaLatest:           r.eta_latest as string,
    batchId:             (r.mise_batch_id as string | null),
    driverId:            (r.mise_driver_id as string | null),
    delayMinutes:        Number(r.delay_minutes),
    firstNoticeSent:     Boolean(r.first_notice_sent),
    criticalNoticeSent:  Boolean(r.critical_notice_sent),
    compensationFlagged: Boolean(r.compensation_flagged),
    voucherCreated:      Boolean(r.voucher_created),
  }));
}

/**
 * Schreibt einen Delay-Alert-Datensatz in delivery_delay_alerts.
 * UNIQUE (order_id, alert_type) garantiert Idempotenz.
 * Gibt true zurück wenn der Alert neu geschrieben wurde.
 */
async function recordDelayAlert(
  orderId: string,
  locationId: string,
  alertType: DelayAlertType,
  delayMinutes: number,
  batchId: string | null,
  driverId: string | null,
): Promise<boolean> {
  const sb = createServiceClient();

  const { error } = await sb.from('delivery_delay_alerts').insert({
    order_id:      orderId,
    location_id:   locationId,
    alert_type:    alertType,
    delay_minutes: Math.round(delayMinutes),
    batch_id:      batchId,
    driver_id:     driverId,
  });

  if (error) {
    if (error.code === '23505') return false; // bereits gesendet
    if (error.code === '42P01') return false; // Migration fehlt
    console.warn('[delay-monitor] recordDelayAlert failed:', error.message);
    return false;
  }

  return true;
}

/**
 * Erstellt einen Kompensations-Gutschein für eine verspätete Bestellung.
 * UNIQUE (order_id) — max. 1 Gutschein pro Bestellung.
 * Gibt den Gutscheincode zurück, oder null wenn bereits vorhanden.
 */
export async function createCompensationVoucher(
  orderId: string,
  locationId: string,
  delayMinutes: number,
): Promise<string | null> {
  const sb = createServiceClient();

  // Duplikat-Prüfung
  const { data: existing } = await sb
    .from('delay_compensation_vouchers')
    .select('voucher_code')
    .eq('order_id', orderId)
    .maybeSingle();

  if (existing) return existing.voucher_code as string;

  const discountAmount = computeDiscountAmount(delayMinutes);

  // Bis zu 3 Versuche bei Code-Kollisionen
  for (let attempt = 0; attempt < 3; attempt++) {
    const voucherCode = generateVoucherCode();
    const { error } = await sb.from('delay_compensation_vouchers').insert({
      order_id:        orderId,
      location_id:     locationId,
      voucher_code:    voucherCode,
      discount_amount: discountAmount,
      delay_minutes:   Math.round(delayMinutes),
    });

    if (!error) return voucherCode;
    if (error.code === '23505' && error.message.includes('order_id')) return null; // Race condition
    if (error.code === '23505') continue; // Code-Kollision, nächster Versuch
    if (error.code === '42P01') return null; // Migration fehlt
    console.warn('[delay-monitor] createVoucher attempt', attempt, error.message);
  }

  return null;
}

/**
 * Verarbeitet eine verspätete Bestellung: sendet Alerts + erstellt Gutschein.
 * Gibt zurück wie viele neue Aktionen ausgeführt wurden.
 */
async function processDelayedOrder(order: DelayedOrder): Promise<{
  firstNotice: boolean;
  criticalNotice: boolean;
  voucherCreated: boolean;
}> {
  const result = { firstNotice: false, criticalNotice: false, voucherCreated: false };
  const { id, locationId, bestellnummer, delayMinutes, batchId, driverId } = order;

  // first_notice ab 15 Min
  if (delayMinutes >= 15 && !order.firstNoticeSent) {
    const sent = await recordDelayAlert(id, locationId, 'first_notice', delayMinutes, batchId, driverId);
    if (sent) {
      result.firstNotice = true;
      logDeliveryEvent({
        location_id: locationId,
        event_type:  'delay_first_notice',
        batch_id:    batchId ?? undefined,
        payload: { order_id: id, bestellnummer, delay_minutes: Math.round(delayMinutes) },
      }).catch(() => {});
    }
  }

  // critical_notice + compensation ab 30 Min
  if (delayMinutes >= 30) {
    if (!order.criticalNoticeSent) {
      const sent = await recordDelayAlert(id, locationId, 'critical_notice', delayMinutes, batchId, driverId);
      if (sent) {
        result.criticalNotice = true;
        logDeliveryEvent({
          location_id: locationId,
          event_type:  'delay_critical_notice',
          batch_id:    batchId ?? undefined,
          payload: { order_id: id, bestellnummer, delay_minutes: Math.round(delayMinutes) },
        }).catch(() => {});
      }
    }

    if (!order.voucherCreated) {
      const code = await createCompensationVoucher(id, locationId, delayMinutes);
      if (code) {
        result.voucherCreated = true;
        await recordDelayAlert(id, locationId, 'compensation', delayMinutes, batchId, driverId).catch(() => {});
        logDeliveryEvent({
          location_id: locationId,
          event_type:  'delay_compensation_created',
          batch_id:    batchId ?? undefined,
          payload: { order_id: id, bestellnummer, delay_minutes: Math.round(delayMinutes), voucher_code: code },
        }).catch(() => {});
      }
    }
  }

  return result;
}

/**
 * Haupt-Funktion: Scannt + verarbeitet alle verspäteten Bestellungen einer Location.
 */
export async function runDelayMonitor(locationId: string): Promise<DelayMonitorResult> {
  const result: DelayMonitorResult = {
    locationId,
    scanned: 0,
    firstNoticesSent: 0,
    criticalNoticesSent: 0,
    vouchersCreated: 0,
    errors: 0,
  };

  let delayed: DelayedOrder[];
  try {
    delayed = await scanDelayedOrders(locationId);
  } catch {
    return result;
  }

  result.scanned = delayed.length;

  for (const order of delayed) {
    try {
      const r = await processDelayedOrder(order);
      if (r.firstNotice)    result.firstNoticesSent++;
      if (r.criticalNotice) result.criticalNoticesSent++;
      if (r.voucherCreated) result.vouchersCreated++;
    } catch {
      result.errors++;
    }
  }

  return result;
}

/**
 * Cron-Helfer: Führt runDelayMonitor für alle aktiven Locations durch.
 */
export async function runDelayMonitorAllLocations(): Promise<DelayMonitorAllResult> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('active', true).limit(20);

  const aggregate: DelayMonitorAllResult = {
    locations: 0,
    totalScanned: 0,
    totalFirstNotices: 0,
    totalCriticalNotices: 0,
    totalVouchers: 0,
  };

  if (!locs?.length) return aggregate;
  aggregate.locations = locs.length;

  const results = await Promise.all(locs.map(loc => runDelayMonitor(loc.id as string).catch(() => null)));

  for (const r of results) {
    if (!r) continue;
    aggregate.totalScanned         += r.scanned;
    aggregate.totalFirstNotices    += r.firstNoticesSent;
    aggregate.totalCriticalNotices += r.criticalNoticesSent;
    aggregate.totalVouchers        += r.vouchersCreated;
  }

  return aggregate;
}

/**
 * Gibt Kompensations-Gutscheine einer Location zurück (für Admin-UI).
 * Graceful: gibt [] zurück wenn Migration fehlt.
 */
export async function getCompensationVouchers(
  locationId: string,
  limit: number = 50,
): Promise<CompensationVoucher[]> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('v_compensation_vouchers')
    .select('id, order_id, location_id, voucher_code, discount_amount, delay_minutes, created_at, expires_at, redeemed_at, redeemed_by_order_id, bestellnummer, order_status')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === '42P01') return [];
    console.warn('[delay-monitor] getCompensationVouchers error:', error.message);
    return [];
  }

  return (data ?? []).map(r => ({
    id:                   r.id as string,
    orderId:              r.order_id as string,
    locationId:           r.location_id as string,
    voucherCode:          r.voucher_code as string,
    discountAmount:       Number(r.discount_amount),
    delayMinutes:         Number(r.delay_minutes),
    createdAt:            r.created_at as string,
    expiresAt:            r.expires_at as string,
    redeemedAt:           (r.redeemed_at as string | null),
    bestellnummer:        r.bestellnummer as string,
    orderStatus:          r.order_status as string,
  }));
}
