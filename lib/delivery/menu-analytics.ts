/**
 * lib/delivery/menu-analytics.ts
 *
 * Phase 121 — Smart Menu Item Sales Analytics
 *
 * Aggregiert täglich die Verkaufsleistung jedes Menü-Artikels
 * aus abgeschlossenen Liefer-Bestellungen.
 *
 * Funktionen:
 *  - snapshotMenuAnalytics()   — täglicher Snapshot für eine Location
 *  - snapshotAllLocations()    — Cron-Batch alle Locations
 *  - getItemPerformance()      — Detailierte Artikel-Auswertung
 *  - getHeroItems()            — Top-Performer
 *  - getSlowMovers()           — Underperformer mit Handlungsbedarf
 *  - getItemTrend()            — 14-Tage-Trend eines Artikels
 *  - getDailyTrend()           — 14-Tage-Tagessummen
 *  - getDashboard()            — Kombinierter Dashboard-Response
 *  - pruneOldSnapshots()       — Cleanup alter Snapshots
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface MenuItemSnapshot {
  item_name: string;
  order_count: number;
  quantity_sold: number;
  revenue_eur: number;
}

export interface MenuItemPerformance {
  item_name: string;
  total_orders: number;
  total_quantity: number;
  total_revenue: number;
  avg_price: number;
  days_with_sales: number;
  last_sale_date: string;
  avg_orders_per_day: number;
  revenue_rank?: number;
}

export interface MenuDailyTrend {
  snapshot_date: string;
  daily_orders: number;
  daily_quantity: number;
  daily_revenue: number;
  distinct_items_sold: number;
}

export interface MenuItemDayPoint {
  snapshot_date: string;
  order_count: number;
  quantity_sold: number;
  revenue_eur: number;
}

export interface MenuDashboard {
  summary: {
    total_items_tracked: number;
    total_orders_30d: number;
    total_revenue_30d: number;
    hero_item_name: string | null;
    hero_item_orders: number;
    slow_mover_count: number;
  };
  hero_items: MenuItemPerformance[];
  slow_movers: MenuItemPerformance[];
  daily_trend: MenuDailyTrend[];
  snapshot_date: string;
}

export interface SnapshotResult {
  location_id: string;
  date: string;
  items_upserted: number;
  orders_analyzed: number;
}

// ─────────────────────────────────────────────
// snapshotMenuAnalytics
// ─────────────────────────────────────────────

export async function snapshotMenuAnalytics(
  locationId: string,
  date?: string,
): Promise<SnapshotResult> {
  const svc = createServiceClient();
  const targetDate = date ?? new Date().toISOString().slice(0, 10);

  // Lade alle abgeschlossenen Liefer-Bestellungen für diese Location und diesen Tag
  const { data: orders, error: ordErr } = await svc
    .from('customer_orders')
    .select('id, status')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .in('status', ['geliefert', 'abgeschlossen'])
    .gte('created_at', `${targetDate}T00:00:00.000Z`)
    .lt('created_at', `${targetDate}T23:59:59.999Z`);

  if (ordErr) throw new Error(`Menu-Snapshot: Bestellungen laden — ${ordErr.message}`);
  if (!orders || orders.length === 0) {
    return { location_id: locationId, date: targetDate, items_upserted: 0, orders_analyzed: 0 };
  }

  const orderIds = orders.map((o) => o.id);

  // Lade alle Artikel aus diesen Bestellungen
  const { data: items, error: itemErr } = await svc
    .from('order_items')
    .select('order_id, name, menge, einzelpreis')
    .in('order_id', orderIds);

  if (itemErr) throw new Error(`Menu-Snapshot: Artikel laden — ${itemErr.message}`);
  if (!items || items.length === 0) {
    return { location_id: locationId, date: targetDate, items_upserted: 0, orders_analyzed: orders.length };
  }

  // Aggregiere nach Artikelname
  const aggregated = new Map<string, { order_ids: Set<string>; quantity: number; revenue: number }>();
  for (const item of items) {
    const name = (item.name as string | null)?.trim() ?? '(unbekannt)';
    const menge = Number(item.menge) || 1;
    const preis = Number(item.einzelpreis) || 0;

    if (!aggregated.has(name)) {
      aggregated.set(name, { order_ids: new Set(), quantity: 0, revenue: 0 });
    }
    const entry = aggregated.get(name)!;
    entry.order_ids.add(item.order_id as string);
    entry.quantity += menge;
    entry.revenue += menge * preis;
  }

  // Upsert Snapshots
  const rows = Array.from(aggregated.entries()).map(([item_name, { order_ids, quantity, revenue }]) => ({
    location_id: locationId,
    snapshot_date: targetDate,
    item_name,
    order_count: order_ids.size,
    quantity_sold: quantity,
    revenue_eur: Math.round(revenue * 100) / 100,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertErr } = await svc
    .from('delivery_menu_snapshots')
    .upsert(rows, { onConflict: 'location_id,snapshot_date,item_name' });

  if (upsertErr) throw new Error(`Menu-Snapshot: Upsert — ${upsertErr.message}`);

  return {
    location_id: locationId,
    date: targetDate,
    items_upserted: rows.length,
    orders_analyzed: orders.length,
  };
}

// ─────────────────────────────────────────────
// snapshotAllLocations — Cron-Batch
// ─────────────────────────────────────────────

export async function snapshotMenuAllLocations(date?: string): Promise<{
  locations: number;
  items_upserted: number;
  orders_analyzed: number;
  errors: number;
}> {
  const svc = createServiceClient();

  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('aktiv', true);

  if (!locs || locs.length === 0) return { locations: 0, items_upserted: 0, orders_analyzed: 0, errors: 0 };

  const results = await Promise.allSettled(
    locs.map((l: { id: string }) => snapshotMenuAnalytics(l.id, date)),
  );

  let items_upserted = 0;
  let orders_analyzed = 0;
  let errors = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      items_upserted += r.value.items_upserted;
      orders_analyzed += r.value.orders_analyzed;
    } else {
      errors++;
    }
  }

  return { locations: locs.length, items_upserted, orders_analyzed, errors };
}

// ─────────────────────────────────────────────
// getItemPerformance — Detailierte Artikel-Auswertung
// ─────────────────────────────────────────────

export async function getItemPerformance(
  locationId: string,
  days = 30,
): Promise<MenuItemPerformance[]> {
  const svc = createServiceClient();
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const { data, error } = await svc
    .from('delivery_menu_snapshots')
    .select('item_name, order_count, quantity_sold, revenue_eur, snapshot_date')
    .eq('location_id', locationId)
    .gte('snapshot_date', since)
    .order('item_name');

  if (error || !data) return [];

  // Aggregiere in TypeScript (kein DB-View nötig)
  const map = new Map<string, { orders: number; quantity: number; revenue: number; dates: Set<string>; last_date: string }>();
  for (const row of data) {
    const name = row.item_name as string;
    if (!map.has(name)) map.set(name, { orders: 0, quantity: 0, revenue: 0, dates: new Set(), last_date: '' });
    const e = map.get(name)!;
    e.orders += Number(row.order_count);
    e.quantity += Number(row.quantity_sold);
    e.revenue += Number(row.revenue_eur);
    e.dates.add(row.snapshot_date as string);
    if (!e.last_date || (row.snapshot_date as string) > e.last_date) e.last_date = row.snapshot_date as string;
  }

  const result: MenuItemPerformance[] = Array.from(map.entries()).map(([item_name, e]) => ({
    item_name,
    total_orders: e.orders,
    total_quantity: e.quantity,
    total_revenue: Math.round(e.revenue * 100) / 100,
    avg_price: e.quantity > 0 ? Math.round((e.revenue / e.quantity) * 100) / 100 : 0,
    days_with_sales: e.dates.size,
    last_sale_date: e.last_date,
    avg_orders_per_day: e.dates.size > 0 ? Math.round((e.orders / e.dates.size) * 10) / 10 : 0,
  }));

  // Sortiere nach Umsatz
  result.sort((a, b) => b.total_revenue - a.total_revenue);
  result.forEach((r, i) => { r.revenue_rank = i + 1; });

  return result;
}

// ─────────────────────────────────────────────
// getHeroItems — Top-Performer (nach Umsatz)
// ─────────────────────────────────────────────

export async function getHeroItems(
  locationId: string,
  limit = 10,
): Promise<MenuItemPerformance[]> {
  const all = await getItemPerformance(locationId, 30);
  return all.slice(0, limit);
}

// ─────────────────────────────────────────────
// getSlowMovers — Underperformer
// ─────────────────────────────────────────────

export async function getSlowMovers(
  locationId: string,
  maxOrders = 5,
  days = 30,
): Promise<MenuItemPerformance[]> {
  const all = await getItemPerformance(locationId, days);
  return all.filter((i) => i.total_orders <= maxOrders).sort((a, b) => a.total_orders - b.total_orders);
}

// ─────────────────────────────────────────────
// getItemTrend — 14-Tage-Verlauf eines Artikels
// ─────────────────────────────────────────────

export async function getItemTrend(
  locationId: string,
  itemName: string,
  days = 14,
): Promise<MenuItemDayPoint[]> {
  const svc = createServiceClient();
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const { data, error } = await svc
    .from('delivery_menu_snapshots')
    .select('snapshot_date, order_count, quantity_sold, revenue_eur')
    .eq('location_id', locationId)
    .eq('item_name', itemName)
    .gte('snapshot_date', since)
    .order('snapshot_date');

  if (error || !data) return [];

  return data.map((r) => ({
    snapshot_date: r.snapshot_date as string,
    order_count: Number(r.order_count),
    quantity_sold: Number(r.quantity_sold),
    revenue_eur: Number(r.revenue_eur),
  }));
}

// ─────────────────────────────────────────────
// getDailyTrend — 14-Tage Tagessummen
// ─────────────────────────────────────────────

export async function getDailyTrend(
  locationId: string,
  days = 14,
): Promise<MenuDailyTrend[]> {
  const svc = createServiceClient();
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const { data, error } = await svc
    .from('delivery_menu_snapshots')
    .select('snapshot_date, order_count, quantity_sold, revenue_eur, item_name')
    .eq('location_id', locationId)
    .gte('snapshot_date', since)
    .order('snapshot_date');

  if (error || !data) return [];

  // Aggregiere pro Tag
  const dayMap = new Map<string, { orders: number; quantity: number; revenue: number; items: Set<string> }>();
  for (const row of data) {
    const d = row.snapshot_date as string;
    if (!dayMap.has(d)) dayMap.set(d, { orders: 0, quantity: 0, revenue: 0, items: new Set() });
    const e = dayMap.get(d)!;
    e.orders += Number(row.order_count);
    e.quantity += Number(row.quantity_sold);
    e.revenue += Number(row.revenue_eur);
    e.items.add(row.item_name as string);
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([snapshot_date, e]) => ({
      snapshot_date,
      daily_orders: e.orders,
      daily_quantity: e.quantity,
      daily_revenue: Math.round(e.revenue * 100) / 100,
      distinct_items_sold: e.items.size,
    }));
}

// ─────────────────────────────────────────────
// getDashboard — Kombinierter Response
// ─────────────────────────────────────────────

export async function getMenuDashboard(locationId: string): Promise<MenuDashboard> {
  const [allItems, dailyTrend] = await Promise.all([
    getItemPerformance(locationId, 30),
    getDailyTrend(locationId, 14),
  ]);

  const heroItems = allItems.slice(0, 10);
  const slowMovers = allItems.filter((i) => i.total_orders <= 5).sort((a, b) => a.total_orders - b.total_orders);

  const total_orders_30d = allItems.reduce((s, i) => s + i.total_orders, 0);
  const total_revenue_30d = allItems.reduce((s, i) => s + i.total_revenue, 0);

  return {
    summary: {
      total_items_tracked: allItems.length,
      total_orders_30d,
      total_revenue_30d: Math.round(total_revenue_30d * 100) / 100,
      hero_item_name: heroItems[0]?.item_name ?? null,
      hero_item_orders: heroItems[0]?.total_orders ?? 0,
      slow_mover_count: slowMovers.length,
    },
    hero_items: heroItems,
    slow_movers: slowMovers,
    daily_trend: dailyTrend,
    snapshot_date: new Date().toISOString().slice(0, 10),
  };
}

// ─────────────────────────────────────────────
// pruneOldSnapshots — Cleanup
// ─────────────────────────────────────────────

export async function pruneMenuSnapshots(daysToKeep = 90): Promise<number> {
  const svc = createServiceClient();
  const { data, error } = await svc.rpc('prune_old_menu_snapshots', { days_to_keep: daysToKeep });
  if (error) {
    console.error('[menu-analytics] prune error:', error.message);
    return 0;
  }
  return (data as number) ?? 0;
}
