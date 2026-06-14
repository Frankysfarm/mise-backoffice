/**
 * lib/delivery/vouchers.ts
 *
 * Voucher / Promo-Code Engine — Phase 179
 *
 * Gutscheine mit RFM-Segmentierung, Bulk-Generierung und atomarer Einlösung.
 *
 * Typen:
 *  flat_eur       — Festbetrag-Rabatt (z. B. 3 € ab 15 €)
 *  percent        — Prozentualer Rabatt (z. B. 10%, max 5 €)
 *  free_delivery  — Liefergebühr komplett erlassen
 *
 * Sicherheit:
 *  - Atomic Redeem via DB-RPC (Lock + Increment in einer Transaktion)
 *  - Max-Uses-per-Customer-Check vor Einlösung
 *  - RFM-Segment-Validierung (Gutschein nur für Zielgruppe)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ──────────────────────────────────────────────────────────────────────────────
// Typen
// ──────────────────────────────────────────────────────────────────────────────

export type VoucherType = 'flat_eur' | 'percent' | 'free_delivery';
export type VoucherStatus = 'active' | 'inactive' | 'expired' | 'exhausted';
export type RfmSegment =
  | 'champion' | 'loyal' | 'potential_loyalist' | 'new_customer' | 'promising'
  | 'needs_attention' | 'at_risk' | 'cant_lose' | 'hibernating' | 'lost';

export interface Voucher {
  id: string;
  location_id: string;
  code: string;
  voucher_type: VoucherType;
  discount_value: number;
  min_order_eur: number;
  max_discount_eur: number | null;
  max_uses: number | null;
  uses_count: number;
  max_uses_per_customer: number;
  valid_from: string;
  valid_until: string | null;
  target_segment: RfmSegment | null;
  campaign_name: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VoucherStats extends Voucher {
  redemption_count: number;
  total_discount_eur: number;
  total_order_volume: number;
  unique_customers: number;
  status: VoucherStatus;
}

export interface VoucherValidation {
  valid: boolean;
  voucher_id?: string;
  code?: string;
  voucher_type?: VoucherType;
  discount_eur: number;
  min_order_eur?: number;
  description?: string;
  error?: string;
}

export interface CreateVoucherParams {
  code?: string;
  voucher_type: VoucherType;
  discount_value: number;
  min_order_eur?: number;
  max_discount_eur?: number;
  max_uses?: number;
  max_uses_per_customer?: number;
  valid_from?: string;
  valid_until?: string;
  target_segment?: RfmSegment;
  campaign_name?: string;
  description?: string;
}

export interface VoucherDashboard {
  summary: {
    total_vouchers: number;
    active_vouchers: number;
    total_redemptions: number;
    expired_vouchers: number;
    total_discount_eur: number;
    avg_discount_eur: number;
    unique_customers: number;
  };
  vouchers: VoucherStats[];
  top_performers: VoucherStats[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ──────────────────────────────────────────────────────────────────────────────

/** Generiert einen zufälligen alphanumerischen Code. */
function generateCode(prefix = '', length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = prefix ? prefix.toUpperCase() + '-' : '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Berechnet den tatsächlichen Rabattbetrag in EUR für eine Bestellung.
 * Berücksichtigt: flat_eur-Cap, percent+max_discount, free_delivery (liefert 0 als Signal).
 */
export function computeDiscount(
  voucher: Pick<Voucher, 'voucher_type' | 'discount_value' | 'max_discount_eur'>,
  orderTotalEur: number,
  deliveryFeeEur: number,
): number {
  switch (voucher.voucher_type) {
    case 'flat_eur':
      return Math.min(voucher.discount_value, orderTotalEur);
    case 'percent': {
      const raw = orderTotalEur * (voucher.discount_value / 100);
      return voucher.max_discount_eur != null
        ? Math.min(raw, voucher.max_discount_eur)
        : raw;
    }
    case 'free_delivery':
      return deliveryFeeEur;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Kern-Funktionen
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Validiert einen Gutschein-Code für eine Bestellung.
 * Prüft: Existenz, Aktivität, Gültigkeit, Mindestbestellwert, Segment, Per-Kunden-Limit.
 */
export async function validateVoucher(
  code: string,
  locationId: string,
  customerPhone: string,
  orderTotalEur: number,
  deliveryFeeEur = 0,
  customerSegment?: string,
): Promise<VoucherValidation> {
  const sb = createServiceClient();

  const { data: voucher, error } = await sb
    .from('delivery_vouchers')
    .select('id, location_id, code, voucher_type, discount_value, min_order_eur, max_discount_eur, max_uses, uses_count, max_uses_per_customer, valid_from, valid_until, target_segment, campaign_name, description, is_active')
    .eq('location_id', locationId)
    .eq('code', code.toUpperCase().trim())
    .single();

  if (error || !voucher) {
    return { valid: false, discount_eur: 0, error: 'Gutschein nicht gefunden.' };
  }

  if (!voucher.is_active) {
    return { valid: false, discount_eur: 0, error: 'Gutschein ist nicht aktiv.' };
  }

  const now = new Date();
  if (new Date(voucher.valid_from) > now) {
    return { valid: false, discount_eur: 0, error: 'Gutschein ist noch nicht gültig.' };
  }
  if (voucher.valid_until && new Date(voucher.valid_until) < now) {
    return { valid: false, discount_eur: 0, error: 'Gutschein ist abgelaufen.' };
  }

  if (voucher.max_uses != null && voucher.uses_count >= voucher.max_uses) {
    return { valid: false, discount_eur: 0, error: 'Gutschein ist vollständig eingelöst.' };
  }

  if (orderTotalEur < voucher.min_order_eur) {
    return {
      valid: false,
      discount_eur: 0,
      error: `Mindestbestellwert ${voucher.min_order_eur.toFixed(2)} € nicht erreicht.`,
    };
  }

  if (voucher.target_segment && customerSegment && voucher.target_segment !== customerSegment) {
    return { valid: false, discount_eur: 0, error: 'Gutschein nicht für dein Kundenprofil.' };
  }

  // Per-Kunden-Limit
  if (voucher.max_uses_per_customer > 0) {
    const { count } = await sb
      .from('delivery_voucher_redemptions')
      .select('*', { count: 'exact', head: true })
      .eq('voucher_id', voucher.id)
      .eq('customer_phone', customerPhone);

    if ((count ?? 0) >= voucher.max_uses_per_customer) {
      return { valid: false, discount_eur: 0, error: 'Du hast diesen Gutschein bereits verwendet.' };
    }
  }

  const discount_eur = computeDiscount(voucher, orderTotalEur, deliveryFeeEur);

  return {
    valid: true,
    voucher_id: voucher.id,
    code: voucher.code,
    voucher_type: voucher.voucher_type as VoucherType,
    discount_eur: Math.round(discount_eur * 100) / 100,
    min_order_eur: voucher.min_order_eur,
    description: voucher.description ?? voucher.campaign_name ?? undefined,
  };
}

/**
 * Löst einen Gutschein atomar ein (Lock + Increment in DB-Transaktion).
 * Muss nach validateVoucher() aufgerufen werden.
 */
export async function redeemVoucher(
  voucherId: string,
  locationId: string,
  customerPhone: string,
  orderId: string,
  orderTotalEur: number,
  discountEur: number,
): Promise<{ success: boolean; error?: string }> {
  const sb = createServiceClient();

  const { data, error } = await sb.rpc('redeem_voucher', {
    p_voucher_id: voucherId,
    p_location_id: locationId,
    p_customer_phone: customerPhone,
    p_order_id: orderId,
    p_order_total_eur: orderTotalEur,
    p_discount_eur: discountEur,
  });

  if (error) return { success: false, error: error.message };
  if (data === 'exhausted') return { success: false, error: 'Gutschein erschöpft.' };
  if (data === 'not_found') return { success: false, error: 'Gutschein nicht gefunden.' };

  return { success: true };
}

/**
 * Erstellt einen neuen Gutschein.
 */
export async function createVoucher(
  locationId: string,
  params: CreateVoucherParams,
): Promise<Voucher | null> {
  const sb = createServiceClient();

  const code = (params.code ?? generateCode()).toUpperCase().trim();

  const { data, error } = await sb
    .from('delivery_vouchers')
    .insert({
      location_id: locationId,
      code,
      voucher_type: params.voucher_type,
      discount_value: params.discount_value,
      min_order_eur: params.min_order_eur ?? 0,
      max_discount_eur: params.max_discount_eur ?? null,
      max_uses: params.max_uses ?? null,
      max_uses_per_customer: params.max_uses_per_customer ?? 1,
      valid_from: params.valid_from ?? new Date().toISOString(),
      valid_until: params.valid_until ?? null,
      target_segment: params.target_segment ?? null,
      campaign_name: params.campaign_name ?? null,
      description: params.description ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('[vouchers] createVoucher error:', error.message);
    return null;
  }
  return data as Voucher;
}

/**
 * Generiert mehrere Gutschein-Codes für eine Kampagne (z. B. RFM-Segment-Mailing).
 */
export async function generateBulkVouchers(
  locationId: string,
  count: number,
  params: Omit<CreateVoucherParams, 'code'>,
  prefix = '',
): Promise<{ codes: string[]; created: number }> {
  const sb = createServiceClient();
  const rows: Record<string, unknown>[] = [];
  const codes: string[] = [];

  for (let i = 0; i < Math.min(count, 500); i++) {
    const code = generateCode(prefix, 8);
    codes.push(code);
    rows.push({
      location_id: locationId,
      code,
      voucher_type: params.voucher_type,
      discount_value: params.discount_value,
      min_order_eur: params.min_order_eur ?? 0,
      max_discount_eur: params.max_discount_eur ?? null,
      max_uses: params.max_uses ?? 1,
      max_uses_per_customer: params.max_uses_per_customer ?? 1,
      valid_from: params.valid_from ?? new Date().toISOString(),
      valid_until: params.valid_until ?? null,
      target_segment: params.target_segment ?? null,
      campaign_name: params.campaign_name ?? null,
      description: params.description ?? null,
    });
  }

  const { data, error } = await sb.from('delivery_vouchers').insert(rows).select('code');
  if (error) {
    console.error('[vouchers] generateBulkVouchers error:', error.message);
    return { codes: [], created: 0 };
  }
  return { codes: (data ?? []).map((r: { code: string }) => r.code), created: data?.length ?? 0 };
}

/**
 * Deaktiviert einen Gutschein (soft-delete).
 */
export async function deactivateVoucher(
  id: string,
  locationId: string,
): Promise<boolean> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('delivery_vouchers')
    .update({ is_active: false })
    .eq('id', id)
    .eq('location_id', locationId);
  return !error;
}

/**
 * Lädt alle Gutscheine mit Statistiken für eine Location.
 */
export async function getVoucherStats(locationId: string): Promise<VoucherStats[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('v_voucher_stats')
    .select('id, location_id, code, voucher_type, discount_value, min_order_eur, max_discount_eur, max_uses, uses_count, max_uses_per_customer, valid_from, valid_until, target_segment, campaign_name, description, is_active, created_at, updated_at, redemption_count, total_discount_eur, total_order_volume, unique_customers, status')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[vouchers] getVoucherStats error:', error.message);
    return [];
  }
  return (data ?? []) as VoucherStats[];
}

/**
 * Vollständiges Dashboard mit KPIs und Voucher-Liste.
 */
export async function getVoucherDashboard(locationId: string): Promise<VoucherDashboard> {
  const stats = await getVoucherStats(locationId);

  const activeVouchers = stats.filter((v) => v.status === 'active').length;
  const totalDiscount = stats.reduce((s, v) => s + v.total_discount_eur, 0);
  const totalRedemptions = stats.reduce((s, v) => s + v.redemption_count, 0);
  const allCustomers = new Set(stats.flatMap(() => [])); // unique count from DB
  const uniqueCustomers = stats.reduce((s, v) => s + v.unique_customers, 0);

  const topPerformers = [...stats]
    .sort((a, b) => b.redemption_count - a.redemption_count)
    .slice(0, 5);

  return {
    summary: {
      total_vouchers: stats.length,
      active_vouchers: activeVouchers,
      total_redemptions: totalRedemptions,
      expired_vouchers: stats.filter((v) => v.status === 'expired').length,
      total_discount_eur: Math.round(totalDiscount * 100) / 100,
      avg_discount_eur:
        totalRedemptions > 0
          ? Math.round((totalDiscount / totalRedemptions) * 100) / 100
          : 0,
      unique_customers: uniqueCustomers,
    },
    vouchers: stats,
    top_performers: topPerformers,
  };
}

/**
 * Bereinigt abgelaufene Vouchers: Deaktiviert alle expired, die älter als 90 Tage sind.
 */
export async function pruneExpiredVouchers(locationId?: string): Promise<number> {
  const sb = createServiceClient();
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  let q = sb
    .from('delivery_vouchers')
    .update({ is_active: false })
    .lt('valid_until', cutoff)
    .eq('is_active', true)
    .select('id');

  if (locationId) q = q.eq('location_id', locationId);

  const { data } = await q;
  return data?.length ?? 0;
}

/**
 * Gibt Gutscheine zurück, die auf ein bestimmtes RFM-Segment abzielen.
 */
export async function getVouchersBySegment(
  locationId: string,
  segment: RfmSegment,
): Promise<Voucher[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('delivery_vouchers')
    .select('id, location_id, code, voucher_type, discount_value, min_order_eur, max_discount_eur, max_uses, uses_count, max_uses_per_customer, valid_from, valid_until, target_segment, campaign_name, description, is_active, created_at, updated_at')
    .eq('location_id', locationId)
    .eq('target_segment', segment)
    .eq('is_active', true);

  if (error) return [];
  return (data ?? []) as Voucher[];
}
