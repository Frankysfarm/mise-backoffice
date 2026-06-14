/**
 * lib/delivery/subscriptions.ts
 *
 * Smart Delivery Subscription + Flatrate Engine — Phase 168
 *
 * Ermöglicht Kunden, Liefer-Flatrates zu buchen (wöchentlich / monatlich / jährlich).
 * Vorteile: kostenlose Lieferungen pro Zeitraum ODER prozentualer Rabatt.
 *
 * Funktionen:
 *  getSubscriptionPlans(locationId)              — verfügbare Pläne
 *  createSubscriptionPlan(locationId, input)     — neuen Plan anlegen
 *  updateSubscriptionPlan(planId, locationId, u) — Plan bearbeiten
 *  togglePlanActive(planId, locationId)          — Plan aktivieren/deaktivieren
 *
 *  createSubscription(locationId, input)         — Kunde abonniert
 *  cancelSubscription(subId, locationId, reason) — Abo kündigen
 *  getCustomerSubscription(locationId, email)    — aktives Abo eines Kunden
 *  checkAndApplyBenefit(locationId, email, fee, orderId) — Vorteil berechnen + loggen
 *
 *  renewExpiredSubscriptions()                   — Cron: Perioden verlängern
 *  renewExpiredForLocation(locationId)           — Renewal für eine Location
 *
 *  getSubscriptionDashboard(locationId)          — Admin-Dashboard
 *  getSubscriptionList(locationId, opts)         — Abo-Liste mit Filter
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface SubscriptionPlan {
  id: string;
  locationId: string;
  name: string;
  description: string | null;
  planType: 'weekly' | 'monthly' | 'annual';
  priceEur: number;
  freeDeliveriesPerPeriod: number | null;
  discountPct: number;
  minOrderValueEur: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface Subscription {
  id: string;
  locationId: string;
  planId: string;
  planName: string;
  planType: 'weekly' | 'monthly' | 'annual';
  priceEur: number;
  customerEmail: string;
  customerPhone: string | null;
  customerName: string | null;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  startsAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  deliveriesUsedThisPeriod: number;
  totalDeliveriesAllTime: number;
  totalPaidEur: number;
  totalSavingsEur: number;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
}

export interface BenefitCheckResult {
  hasSubscription: boolean;
  eligible: boolean;
  feeAfterDiscountEur: number;
  savingsEur: number;
  subscriptionId: string | null;
  deliveriesRemaining: number | null;
}

export interface SubscriptionOverview {
  activeCount: number;
  cancelledCount: number;
  pausedCount: number;
  expiredCount: number;
  mrrEur: number;
  totalRevenueEur: number;
  totalSavingsEur: number;
  totalDeliveries: number;
  planCount: number;
}

export interface SubscriptionDashboard {
  overview: SubscriptionOverview;
  plans: SubscriptionPlan[];
  recentSubscriptions: Subscription[];
  expiringSoon: Subscription[];
}

export interface RenewalResult {
  locationId: string;
  renewed: number;
  errors: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcPeriodEnd(planType: 'weekly' | 'monthly' | 'annual', from?: Date): string {
  const d = from ? new Date(from) : new Date();
  if (planType === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else if (planType === 'monthly') {
    d.setMonth(d.getMonth() + 1);
  } else {
    d.setFullYear(d.getFullYear() + 1);
  }
  return d.toISOString();
}

function mapPlan(row: Record<string, unknown>): SubscriptionPlan {
  return {
    id: row.id as string,
    locationId: row.location_id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    planType: row.plan_type as 'weekly' | 'monthly' | 'annual',
    priceEur: Number(row.price_eur),
    freeDeliveriesPerPeriod: row.free_deliveries_per_period != null
      ? Number(row.free_deliveries_per_period) : null,
    discountPct: Number(row.discount_pct ?? 0),
    minOrderValueEur: row.min_order_value_eur != null
      ? Number(row.min_order_value_eur) : null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
  };
}

function mapSub(row: Record<string, unknown>): Subscription {
  const planData = row.delivery_subscription_plans as Record<string, unknown> | null;
  return {
    id: row.id as string,
    locationId: row.location_id as string,
    planId: row.plan_id as string,
    planName: (planData?.name ?? row.plan_name ?? '') as string,
    planType: (planData?.plan_type ?? row.plan_type ?? 'monthly') as 'weekly' | 'monthly' | 'annual',
    priceEur: Number(planData?.price_eur ?? row.price_eur ?? 0),
    customerEmail: row.customer_email as string,
    customerPhone: (row.customer_phone as string | null) ?? null,
    customerName: (row.customer_name as string | null) ?? null,
    status: row.status as 'active' | 'paused' | 'cancelled' | 'expired',
    startsAt: row.starts_at as string,
    currentPeriodStart: row.current_period_start as string,
    currentPeriodEnd: row.current_period_end as string,
    deliveriesUsedThisPeriod: Number(row.deliveries_used_this_period ?? 0),
    totalDeliveriesAllTime: Number(row.total_deliveries_all_time ?? 0),
    totalPaidEur: Number(row.total_paid_eur ?? 0),
    totalSavingsEur: Number(row.total_savings_eur ?? 0),
    cancelledAt: (row.cancelled_at as string | null) ?? null,
    cancelReason: (row.cancel_reason as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

// ── Plan-Management ───────────────────────────────────────────────────────────

export async function getSubscriptionPlans(locationId: string): Promise<SubscriptionPlan[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_subscription_plans')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false });
  return (data ?? []).map((r) => mapPlan(r as Record<string, unknown>));
}

export async function createSubscriptionPlan(
  locationId: string,
  input: {
    name: string;
    description?: string | null;
    planType: 'weekly' | 'monthly' | 'annual';
    priceEur: number;
    freeDeliveriesPerPeriod?: number | null;
    discountPct?: number;
    minOrderValueEur?: number | null;
  }
): Promise<SubscriptionPlan> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('delivery_subscription_plans')
    .insert({
      location_id: locationId,
      name: input.name,
      description: input.description ?? null,
      plan_type: input.planType,
      price_eur: input.priceEur,
      free_deliveries_per_period: input.freeDeliveriesPerPeriod ?? null,
      discount_pct: input.discountPct ?? 0,
      min_order_value_eur: input.minOrderValueEur ?? null,
      is_active: true,
    })
    .select('*')
    .single();
  if (error) throw new Error(`createSubscriptionPlan: ${error.message}`);
  return mapPlan(data as Record<string, unknown>);
}

export async function updateSubscriptionPlan(
  planId: string,
  locationId: string,
  updates: Partial<{
    name: string;
    description: string | null;
    priceEur: number;
    freeDeliveriesPerPeriod: number | null;
    discountPct: number;
    minOrderValueEur: number | null;
  }>
): Promise<void> {
  const sb = createServiceClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.priceEur !== undefined) patch.price_eur = updates.priceEur;
  if (updates.freeDeliveriesPerPeriod !== undefined)
    patch.free_deliveries_per_period = updates.freeDeliveriesPerPeriod;
  if (updates.discountPct !== undefined) patch.discount_pct = updates.discountPct;
  if (updates.minOrderValueEur !== undefined) patch.min_order_value_eur = updates.minOrderValueEur;

  const { error } = await sb
    .from('delivery_subscription_plans')
    .update(patch)
    .eq('id', planId)
    .eq('location_id', locationId);
  if (error) throw new Error(`updateSubscriptionPlan: ${error.message}`);
}

export async function togglePlanActive(planId: string, locationId: string): Promise<boolean> {
  const sb = createServiceClient();
  const { data: current } = await sb
    .from('delivery_subscription_plans')
    .select('is_active')
    .eq('id', planId)
    .eq('location_id', locationId)
    .single();
  if (!current) throw new Error('Plan nicht gefunden');

  const newActive = !(current as Record<string, unknown>).is_active;
  const { error } = await sb
    .from('delivery_subscription_plans')
    .update({ is_active: newActive, updated_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('location_id', locationId);
  if (error) throw new Error(`togglePlanActive: ${error.message}`);
  return newActive;
}

// ── Abonnement-Verwaltung ─────────────────────────────────────────────────────

export async function createSubscription(
  locationId: string,
  input: {
    planId: string;
    customerEmail: string;
    customerPhone?: string | null;
    customerName?: string | null;
  }
): Promise<Subscription> {
  const sb = createServiceClient();

  const { data: plan } = await sb
    .from('delivery_subscription_plans')
    .select('id, plan_type, price_eur, is_active')
    .eq('id', input.planId)
    .eq('location_id', locationId)
    .single();
  if (!plan) throw new Error('Plan nicht gefunden');
  const p = plan as Record<string, unknown>;
  if (!p.is_active) throw new Error('Plan ist inaktiv');

  const planType = p.plan_type as 'weekly' | 'monthly' | 'annual';
  const now = new Date();
  const periodEnd = calcPeriodEnd(planType, now);

  const { data, error } = await sb
    .from('delivery_subscriptions')
    .upsert(
      {
        location_id: locationId,
        plan_id: input.planId,
        customer_email: input.customerEmail.toLowerCase().trim(),
        customer_phone: input.customerPhone ?? null,
        customer_name: input.customerName ?? null,
        status: 'active',
        starts_at: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: periodEnd,
        deliveries_used_this_period: 0,
        total_deliveries_all_time: 0,
        total_paid_eur: Number(p.price_eur),
        total_savings_eur: 0,
        updated_at: now.toISOString(),
      },
      { onConflict: 'location_id,customer_email' }
    )
    .select('*, delivery_subscription_plans(name, plan_type, price_eur)')
    .single();

  if (error) throw new Error(`createSubscription: ${error.message}`);
  return mapSub(data as Record<string, unknown>);
}

export async function cancelSubscription(
  subId: string,
  locationId: string,
  reason?: string
): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('delivery_subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subId)
    .eq('location_id', locationId);
  if (error) throw new Error(`cancelSubscription: ${error.message}`);
}

export async function getCustomerSubscription(
  locationId: string,
  email: string
): Promise<Subscription | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_subscriptions')
    .select('*, delivery_subscription_plans(name, plan_type, price_eur, free_deliveries_per_period, discount_pct, min_order_value_eur)')
    .eq('location_id', locationId)
    .eq('customer_email', email.toLowerCase().trim())
    .eq('status', 'active')
    .maybeSingle();
  if (!data) return null;
  return mapSub(data as Record<string, unknown>);
}

export async function checkAndApplyBenefit(
  locationId: string,
  email: string,
  originalFeeEur: number,
  orderId: string
): Promise<BenefitCheckResult> {
  const sb = createServiceClient();

  const { data: subRow } = await sb
    .from('delivery_subscriptions')
    .select('id, deliveries_used_this_period, total_deliveries_all_time, total_savings_eur, delivery_subscription_plans(free_deliveries_per_period, discount_pct, min_order_value_eur)')
    .eq('location_id', locationId)
    .eq('customer_email', email.toLowerCase().trim())
    .eq('status', 'active')
    .maybeSingle();

  if (!subRow) {
    return {
      hasSubscription: false, eligible: false,
      feeAfterDiscountEur: originalFeeEur, savingsEur: 0,
      subscriptionId: null, deliveriesRemaining: null,
    };
  }

  const row = subRow as Record<string, unknown>;
  const planData = row.delivery_subscription_plans as Record<string, unknown> | null;
  const freePer = planData?.free_deliveries_per_period != null
    ? Number(planData.free_deliveries_per_period) : null;
  const discPct = Number(planData?.discount_pct ?? 0);
  const minOrderEur = planData?.min_order_value_eur != null
    ? Number(planData.min_order_value_eur) : null;
  const usedThisPeriod = Number(row.deliveries_used_this_period ?? 0);
  const subId = row.id as string;

  // Mindestbestellwert prüfen
  if (minOrderEur !== null && originalFeeEur < minOrderEur) {
    return {
      hasSubscription: true, eligible: false,
      feeAfterDiscountEur: originalFeeEur, savingsEur: 0,
      subscriptionId: subId, deliveriesRemaining: freePer != null ? Math.max(0, freePer - usedThisPeriod) : null,
    };
  }

  // Freikontingent erschöpft?
  if (freePer !== null && usedThisPeriod >= freePer) {
    return {
      hasSubscription: true, eligible: false,
      feeAfterDiscountEur: originalFeeEur, savingsEur: 0,
      subscriptionId: subId, deliveriesRemaining: 0,
    };
  }

  // Vorteil berechnen
  let feeAfterDiscountEur: number;
  let savingsEur: number;

  if (freePer !== null || discPct === 0) {
    // Gratis-Lieferung (innerhalb Freikontingent oder unbegrenzt-freie Pläne)
    feeAfterDiscountEur = 0;
    savingsEur = originalFeeEur;
  } else {
    // Prozentualer Rabatt
    feeAfterDiscountEur = Math.max(0, originalFeeEur * (1 - discPct / 100));
    savingsEur = originalFeeEur - feeAfterDiscountEur;
  }

  // Nutzung loggen
  await sb.from('subscription_usage_log').insert({
    subscription_id: subId,
    location_id: locationId,
    order_id: orderId,
    fee_original_eur: originalFeeEur,
    fee_charged_eur: feeAfterDiscountEur,
    savings_eur: savingsEur,
  });

  // Zähler aktualisieren
  const newUsed = usedThisPeriod + 1;
  const prevTotal = Number(row.total_deliveries_all_time ?? 0);
  const prevSavings = Number(row.total_savings_eur ?? 0);
  await sb.from('delivery_subscriptions').update({
    deliveries_used_this_period: newUsed,
    total_deliveries_all_time: prevTotal + 1,
    total_savings_eur: Math.round((prevSavings + savingsEur) * 100) / 100,
    updated_at: new Date().toISOString(),
  }).eq('id', subId);

  const deliveriesRemaining = freePer !== null ? freePer - newUsed : null;

  return {
    hasSubscription: true, eligible: true,
    feeAfterDiscountEur, savingsEur,
    subscriptionId: subId,
    deliveriesRemaining,
  };
}

// ── Renewal-Cron ──────────────────────────────────────────────────────────────

export async function renewExpiredForLocation(locationId: string): Promise<RenewalResult> {
  const sb = createServiceClient();
  const result: RenewalResult = { locationId, renewed: 0, errors: 0 };

  const { data: expired } = await sb
    .from('delivery_subscriptions')
    .select('id, plan_id, current_period_end, total_paid_eur, delivery_subscription_plans(plan_type, price_eur)')
    .eq('location_id', locationId)
    .eq('status', 'active')
    .lt('current_period_end', new Date().toISOString());

  for (const row of expired ?? []) {
    const r = row as Record<string, unknown>;
    const planData = r.delivery_subscription_plans as Record<string, unknown> | null;
    if (!planData) { result.errors++; continue; }

    const planType = planData.plan_type as 'weekly' | 'monthly' | 'annual';
    const priceEur = Number(planData.price_eur ?? 0);
    const oldPeriodEnd = new Date(r.current_period_end as string);
    const newPeriodEnd = calcPeriodEnd(planType, oldPeriodEnd);

    const { error } = await sb
      .from('delivery_subscriptions')
      .update({
        current_period_start: oldPeriodEnd.toISOString(),
        current_period_end: newPeriodEnd,
        deliveries_used_this_period: 0,
        total_paid_eur: Number(r.total_paid_eur ?? 0) + priceEur,
        updated_at: new Date().toISOString(),
      })
      .eq('id', r.id as string);

    if (error) { result.errors++; } else { result.renewed++; }
  }

  return result;
}

export async function renewExpiredSubscriptions(): Promise<{
  locations: number; renewed: number; errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('delivery_subscriptions')
    .select('location_id')
    .eq('status', 'active')
    .lt('current_period_end', new Date().toISOString());

  const locationIds = [...new Set((locs ?? []).map((r) => (r as Record<string, unknown>).location_id as string))];

  const results = await Promise.all(locationIds.map((id) => renewExpiredForLocation(id)));
  return {
    locations: results.length,
    renewed: results.reduce((s, r) => s + r.renewed, 0),
    errors: results.reduce((s, r) => s + r.errors, 0),
  };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getSubscriptionDashboard(locationId: string): Promise<SubscriptionDashboard> {
  const sb = createServiceClient();

  const [overviewRes, plansRes, recentRes, expiringRes] = await Promise.all([
    sb
      .from('v_subscription_overview')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),
    sb
      .from('delivery_subscription_plans')
      .select('*')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false }),
    sb
      .from('delivery_subscriptions')
      .select('*, delivery_subscription_plans(name, plan_type, price_eur)')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(20),
    sb
      .from('v_subscriptions_expiring_soon')
      .select('*')
      .eq('location_id', locationId)
      .order('current_period_end', { ascending: true }),
  ]);

  const ov = (overviewRes.data ?? {}) as Record<string, unknown>;
  const overview: SubscriptionOverview = {
    activeCount: Number(ov.active_count ?? 0),
    cancelledCount: Number(ov.cancelled_count ?? 0),
    pausedCount: Number(ov.paused_count ?? 0),
    expiredCount: Number(ov.expired_count ?? 0),
    mrrEur: Number(ov.mrr_eur ?? 0),
    totalRevenueEur: Number(ov.total_revenue_eur ?? 0),
    totalSavingsEur: Number(ov.total_savings_eur ?? 0),
    totalDeliveries: Number(ov.total_deliveries ?? 0),
    planCount: Number(ov.plan_count ?? 0),
  };

  return {
    overview,
    plans: (plansRes.data ?? []).map((r) => mapPlan(r as Record<string, unknown>)),
    recentSubscriptions: (recentRes.data ?? []).map((r) => mapSub(r as Record<string, unknown>)),
    expiringSoon: (expiringRes.data ?? []).map((r) => mapSub(r as Record<string, unknown>)),
  };
}

export async function getSubscriptionList(
  locationId: string,
  opts: { status?: 'active' | 'cancelled' | 'paused' | 'expired' | 'all'; limit?: number } = {}
): Promise<Subscription[]> {
  const sb = createServiceClient();
  let q = sb
    .from('delivery_subscriptions')
    .select('*, delivery_subscription_plans(name, plan_type, price_eur)')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 50);

  if (opts.status && opts.status !== 'all') {
    q = q.eq('status', opts.status);
  }

  const { data } = await q;
  return (data ?? []).map((r) => mapSub(r as Record<string, unknown>));
}
