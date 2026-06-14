/**
 * lib/delivery/reorder-engine.ts
 *
 * Smart Re-Order Engine — Phase 166
 *
 * Analysiert Bestellhistorie je Kunde (identifiziert via kunde_telefon)
 * und erstellt personalisierte Wiederbestellungs-Profile.
 *
 * Funktionen:
 *  buildProfileForCustomer(locationId, phone)    — Profil für einen Kunden aufbauen
 *  buildProfilesForLocation(locationId)          — Alle Profile einer Location aktualisieren
 *  buildProfilesAllLocations()                   — Cron-Batch
 *  getReorderSuggestions(locationId, phone, n?)  — Top-N Artikel für Kunden
 *  getReorderSuggestionsByToken(ratingToken)     — Öffentlich via Rating-Token
 *  getReorderDashboard(locationId)               — Admin-Dashboard
 *  getTopReorderCustomers(locationId, limit?)    — Treueste Kunden
 *  getTopReorderItems(locationId, limit?)        — Meist wiederbestellte Artikel
 *  pruneStaleProfiles(days?)                     — Cleanup inaktiver Profile
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReorderItem {
  name: string;
  count: number;
  revenue_eur: number;
}

export interface ReorderProfile {
  id: string;
  locationId: string;
  customerPhone: string;
  customerName: string | null;
  totalOrders: number;
  totalSpentEur: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  avgDaysBetweenOrders: number | null;
  preferredHour: number | null;
  topItems: ReorderItem[];
  computedAt: string;
}

export interface ReorderSuggestion {
  itemName: string;
  orderCount: number;
  revenueEur: number;
  lastOrderedAt: string | null;
}

export interface ReorderCustomerRow {
  customerId: string;
  customerPhone: string;
  customerName: string | null;
  totalOrders: number;
  totalSpentEur: number;
  lastOrderAt: string | null;
  avgDaysBetweenOrders: number | null;
  preferredHour: number | null;
  topItems: ReorderItem[];
}

export interface ReorderTopItem {
  itemName: string;
  totalReorderCount: number;
  totalReorderRevenue: number;
  distinctCustomers: number;
}

export interface ReorderLocationStats {
  totalProfiledCustomers: number;
  repeatCustomers: number;
  repeatRatePct: number;
  avgOrdersPerRepeat: number;
  totalRevenueTracked: number;
  avgLifetimeValue: number;
  lastComputedAt: string | null;
}

export interface ReorderDashboard {
  stats: ReorderLocationStats;
  topItems: ReorderTopItem[];
  loyalCustomers: ReorderCustomerRow[];
  locationId: string;
}

export interface BuildResult {
  locationId: string;
  profilesUpserted: number;
  customersAnalyzed: number;
  errors: number;
}

// ── Interne Hilfsfunktionen ───────────────────────────────────────────────────

function avgDaysBetween(dates: string[]): number | null {
  if (dates.length < 2) return null;
  const sorted = [...dates].sort();
  let totalMs = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalMs += new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime();
  }
  return Math.round((totalMs / (sorted.length - 1) / 86_400_000) * 10) / 10;
}

function preferredHourFrom(dates: string[]): number | null {
  if (dates.length === 0) return null;
  const counts: Record<number, number> = {};
  for (const d of dates) {
    const h = new Date(d).getUTCHours();
    counts[h] = (counts[h] ?? 0) + 1;
  }
  let best = 0;
  let bestCount = 0;
  for (const [h, c] of Object.entries(counts)) {
    if (c > bestCount) { bestCount = c; best = Number(h); }
  }
  return best;
}

// ── buildProfileForCustomer ───────────────────────────────────────────────────

export async function buildProfileForCustomer(
  locationId: string,
  phone: string,
): Promise<ReorderProfile | null> {
  const svc = createServiceClient();

  const { data: orders, error } = await svc
    .from('customer_orders')
    .select('id, kunde_name, gesamtbetrag, created_at, status, typ')
    .eq('location_id', locationId)
    .eq('kunde_telefon', phone)
    .eq('typ', 'lieferung')
    .in('status', ['geliefert', 'abgeschlossen'])
    .order('created_at', { ascending: true });

  if (error || !orders || orders.length === 0) return null;

  const orderIds = orders.map((o) => o.id as string);
  const dates    = orders.map((o) => o.created_at as string);
  const totalSpent = orders.reduce((s, o) => s + (Number(o.gesamtbetrag) || 0), 0);
  const customerName = (orders.find((o) => o.kunde_name)?.kunde_name as string | null) ?? null;

  // Artikel laden
  const { data: items } = await svc
    .from('order_items')
    .select('order_id, name, menge, einzelpreis')
    .in('order_id', orderIds);

  // Top-Artikel aggregieren
  const itemMap = new Map<string, { count: number; revenue: number }>();
  for (const item of items ?? []) {
    const name    = ((item.name as string | null)?.trim()) ?? '(unbekannt)';
    const menge   = Number(item.menge) || 1;
    const preis   = Number(item.einzelpreis) || 0;
    const entry   = itemMap.get(name) ?? { count: 0, revenue: 0 };
    entry.count   += menge;
    entry.revenue += menge * preis;
    itemMap.set(name, entry);
  }

  const topItems: ReorderItem[] = Array.from(itemMap.entries())
    .map(([name, { count, revenue }]) => ({
      name,
      count,
      revenue_eur: Math.round(revenue * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const profile = {
    location_id:              locationId,
    customer_phone:           phone,
    customer_name:            customerName,
    total_orders:             orders.length,
    total_spent_eur:          Math.round(totalSpent * 100) / 100,
    first_order_at:           dates[0] ?? null,
    last_order_at:            dates[dates.length - 1] ?? null,
    avg_days_between_orders:  avgDaysBetween(dates),
    preferred_hour:           preferredHourFrom(dates),
    top_items:                topItems,
    computed_at:              new Date().toISOString(),
  };

  const { data: upserted, error: upsertErr } = await svc
    .from('customer_reorder_profiles')
    .upsert(profile, { onConflict: 'location_id,customer_phone' })
    .select('id, location_id, customer_phone, customer_name, total_orders, total_spent_eur, first_order_at, last_order_at, avg_days_between_orders, preferred_hour, top_items, computed_at')
    .maybeSingle();

  if (upsertErr || !upserted) return null;

  return {
    id:                    upserted.id as string,
    locationId:            upserted.location_id as string,
    customerPhone:         upserted.customer_phone as string,
    customerName:          upserted.customer_name as string | null,
    totalOrders:           upserted.total_orders as number,
    totalSpentEur:         Number(upserted.total_spent_eur),
    firstOrderAt:          upserted.first_order_at as string | null,
    lastOrderAt:           upserted.last_order_at as string | null,
    avgDaysBetweenOrders:  upserted.avg_days_between_orders != null ? Number(upserted.avg_days_between_orders) : null,
    preferredHour:         upserted.preferred_hour as number | null,
    topItems:              (upserted.top_items as ReorderItem[]) ?? [],
    computedAt:            upserted.computed_at as string,
  };
}

// ── buildProfilesForLocation ──────────────────────────────────────────────────

export async function buildProfilesForLocation(locationId: string): Promise<BuildResult> {
  const svc = createServiceClient();

  // Alle einzigartigen Kunden-Telefonnummern dieser Location
  const { data: customers, error } = await svc
    .from('customer_orders')
    .select('kunde_telefon')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .in('status', ['geliefert', 'abgeschlossen'])
    .not('kunde_telefon', 'is', null);

  if (error || !customers || customers.length === 0) {
    return { locationId, profilesUpserted: 0, customersAnalyzed: 0, errors: 0 };
  }

  const phones = [...new Set(customers.map((c) => c.kunde_telefon as string).filter(Boolean))];

  let profilesUpserted = 0;
  let errors = 0;

  for (const phone of phones) {
    try {
      const result = await buildProfileForCustomer(locationId, phone);
      if (result) profilesUpserted++;
    } catch {
      errors++;
    }
  }

  return { locationId, profilesUpserted, customersAnalyzed: phones.length, errors };
}

// ── buildProfilesAllLocations ─────────────────────────────────────────────────

export async function buildProfilesAllLocations(): Promise<{
  locations: number;
  profilesUpserted: number;
  errors: number;
}> {
  const svc = createServiceClient();

  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locs || locs.length === 0) return { locations: 0, profilesUpserted: 0, errors: 0 };

  const results = await Promise.all(
    locs.map((l) => buildProfilesForLocation(l.id as string).catch(() => null)),
  );

  return {
    locations:       locs.length,
    profilesUpserted: results.reduce((s, r) => s + (r?.profilesUpserted ?? 0), 0),
    errors:           results.reduce((s, r) => s + (r?.errors ?? 0), 0),
  };
}

// ── getReorderSuggestions ─────────────────────────────────────────────────────

export async function getReorderSuggestions(
  locationId: string,
  phone: string,
  limit = 5,
): Promise<ReorderSuggestion[]> {
  const svc = createServiceClient();

  const { data } = await svc
    .from('customer_reorder_profiles')
    .select('top_items, last_order_at')
    .eq('location_id', locationId)
    .eq('customer_phone', phone)
    .maybeSingle();

  if (!data) return [];

  const items = (data.top_items as ReorderItem[]) ?? [];
  return items.slice(0, limit).map((item) => ({
    itemName:      item.name,
    orderCount:    item.count,
    revenueEur:    item.revenue_eur,
    lastOrderedAt: data.last_order_at as string | null,
  }));
}

// ── getReorderSuggestionsByToken ──────────────────────────────────────────────

export async function getReorderSuggestionsByToken(
  ratingToken: string,
  limit = 5,
): Promise<{ suggestions: ReorderSuggestion[]; locationId: string; phone: string } | null> {
  const svc = createServiceClient();

  const { data: order } = await svc
    .from('customer_orders')
    .select('location_id, kunde_telefon')
    .eq('rating_token', ratingToken)
    .maybeSingle();

  if (!order?.location_id || !order?.kunde_telefon) return null;

  const locationId = order.location_id as string;
  const phone      = order.kunde_telefon as string;

  const suggestions = await getReorderSuggestions(locationId, phone, limit);
  return { suggestions, locationId, phone };
}

// ── getReorderDashboard ───────────────────────────────────────────────────────

export async function getReorderDashboard(locationId: string): Promise<ReorderDashboard> {
  const svc = createServiceClient();

  const [statsRes, topItemsRes, loyalRes] = await Promise.all([
    svc
      .from('v_reorder_location_stats')
      .select('total_profiled_customers, repeat_customers, repeat_rate_pct, avg_orders_per_repeat, total_revenue_tracked, avg_lifetime_value, last_computed_at')
      .eq('location_id', locationId)
      .maybeSingle(),

    svc
      .from('v_reorder_top_items')
      .select('item_name, total_reorder_count, total_reorder_revenue, distinct_customers')
      .eq('location_id', locationId)
      .order('total_reorder_count', { ascending: false })
      .limit(10),

    svc
      .from('v_reorder_loyal_customers')
      .select('id, customer_phone, customer_name, total_orders, total_spent_eur, last_order_at, avg_days_between_orders, preferred_hour, top_items')
      .eq('location_id', locationId)
      .limit(20),
  ]);

  const s = statsRes.data;
  const stats: ReorderLocationStats = {
    totalProfiledCustomers: Number(s?.total_profiled_customers ?? 0),
    repeatCustomers:        Number(s?.repeat_customers ?? 0),
    repeatRatePct:          Number(s?.repeat_rate_pct ?? 0),
    avgOrdersPerRepeat:     Number(s?.avg_orders_per_repeat ?? 0),
    totalRevenueTracked:    Number(s?.total_revenue_tracked ?? 0),
    avgLifetimeValue:       Number(s?.avg_lifetime_value ?? 0),
    lastComputedAt:         (s?.last_computed_at as string | null) ?? null,
  };

  const topItems: ReorderTopItem[] = (topItemsRes.data ?? []).map((r) => ({
    itemName:             r.item_name as string,
    totalReorderCount:    Number(r.total_reorder_count),
    totalReorderRevenue:  Number(r.total_reorder_revenue),
    distinctCustomers:    Number(r.distinct_customers),
  }));

  const loyalCustomers: ReorderCustomerRow[] = (loyalRes.data ?? []).map((r) => ({
    customerId:              r.id as string,
    customerPhone:           r.customer_phone as string,
    customerName:            r.customer_name as string | null,
    totalOrders:             Number(r.total_orders),
    totalSpentEur:           Number(r.total_spent_eur),
    lastOrderAt:             r.last_order_at as string | null,
    avgDaysBetweenOrders:    r.avg_days_between_orders != null ? Number(r.avg_days_between_orders) : null,
    preferredHour:           r.preferred_hour as number | null,
    topItems:                (r.top_items as ReorderItem[]) ?? [],
  }));

  return { stats, topItems, loyalCustomers, locationId };
}

// ── getTopReorderCustomers ────────────────────────────────────────────────────

export async function getTopReorderCustomers(
  locationId: string,
  limit = 20,
): Promise<ReorderCustomerRow[]> {
  const svc = createServiceClient();

  const { data } = await svc
    .from('customer_reorder_profiles')
    .select('id, customer_phone, customer_name, total_orders, total_spent_eur, last_order_at, avg_days_between_orders, preferred_hour, top_items')
    .eq('location_id', locationId)
    .gte('total_orders', 2)
    .order('total_orders', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    customerId:           r.id as string,
    customerPhone:        r.customer_phone as string,
    customerName:         r.customer_name as string | null,
    totalOrders:          Number(r.total_orders),
    totalSpentEur:        Number(r.total_spent_eur),
    lastOrderAt:          r.last_order_at as string | null,
    avgDaysBetweenOrders: r.avg_days_between_orders != null ? Number(r.avg_days_between_orders) : null,
    preferredHour:        r.preferred_hour as number | null,
    topItems:             (r.top_items as ReorderItem[]) ?? [],
  }));
}

// ── getTopReorderItems ────────────────────────────────────────────────────────

export async function getTopReorderItems(
  locationId: string,
  limit = 10,
): Promise<ReorderTopItem[]> {
  const svc = createServiceClient();

  const { data } = await svc
    .from('v_reorder_top_items')
    .select('item_name, total_reorder_count, total_reorder_revenue, distinct_customers')
    .eq('location_id', locationId)
    .order('total_reorder_count', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    itemName:            r.item_name as string,
    totalReorderCount:   Number(r.total_reorder_count),
    totalReorderRevenue: Number(r.total_reorder_revenue),
    distinctCustomers:   Number(r.distinct_customers),
  }));
}

// ── pruneStaleProfiles ────────────────────────────────────────────────────────

export async function pruneStaleProfiles(days = 180): Promise<number> {
  const svc = createServiceClient();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data } = await svc
    .from('customer_reorder_profiles')
    .delete()
    .lt('last_order_at', cutoff)
    .select('id');

  return (data ?? []).length;
}
