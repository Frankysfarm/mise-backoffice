/**
 * lib/delivery/item-demand-prediction.ts — Phase 270
 *
 * Smart Item Demand Prediction Engine
 * Prognostiziert Nachfrage pro Menü-Artikel aus delivery_menu_snapshots,
 * vergleicht mit aktuellem Lagerbestand und löst Alarmierung aus.
 *
 * Öffentliche API:
 *   computeItemDemandProfile(locationId, itemName, days?)   — Nachfrage-Analyse
 *   checkAllItemStocks(locationId)                          — Alarme prüfen/erzeugen
 *   checkAllLocations()                                     — Cron-Batch
 *   getItemDemandDashboard(locationId)                      — Admin-Dashboard
 *   upsertItemStock(locationId, item)                       — Lagerstand anlegen/updaten
 *   markAlertOrdered(locationId, itemName)                  — Bestellung erfasst
 *   pruneOldAlerts(daysToKeep?)                             — Cleanup
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type AlertLevel = 'warning' | 'critical';
export type AlertStatus = 'open' | 'ordered' | 'resolved';

export interface ItemDemandProfile {
  itemName: string;
  locationId: string;
  avgDailyDemand: number;
  avgWeeklyDemand: number;
  peakDayOfWeek: number;       // 0=Mo … 6=So
  seasonalityFactors: number[]; // [Mo,Di,Mi,Do,Fr,Sa,So] — Multiplikatoren gg. Durchschnitt
  daysWithData: number;
  lastSaleDate: string | null;
}

export interface ItemStock {
  id: string;
  locationId: string;
  itemName: string;
  currentStock: number;
  unit: string;
  minStockLevel: number;
  reorderPoint: number;
  reorderQty: number;
  leadTimeDays: number;
  costPerUnit: number;
  supplierName: string | null;
  lastCheckedAt: string;
  updatedAt: string;
}

export interface ItemStockUpsert {
  itemName: string;
  currentStock: number;
  unit?: string;
  minStockLevel?: number;
  reorderQty?: number;
  leadTimeDays?: number;
  costPerUnit?: number;
  supplierName?: string | null;
}

export interface DemandAlert {
  id: string;
  locationId: string;
  itemName: string;
  alertLevel: AlertLevel;
  currentStock: number;
  reorderPoint: number;
  avgDailyDemand: number;
  daysUntilDepletion: number | null;
  suggestedOrderQty: number | null;
  status: AlertStatus;
  createdAt: string;
  resolvedAt: string | null;
  unit?: string;
  supplierName?: string | null;
  leadTimeDays?: number;
  costPerUnit?: number;
}

export interface StockCheckResult {
  locationId: string;
  itemsChecked: number;
  alertsCreated: number;
  alertsResolved: number;
  errors: number;
}

export interface ItemDemandDashboard {
  locationId: string;
  totalTrackedItems: number;
  itemsOk: number;
  itemsWarning: number;
  itemsCritical: number;
  openAlerts: DemandAlert[];
  stockList: ItemStock[];
  topDemandItems: { itemName: string; avgDailyDemand: number; unit: string }[];
  lastCheckedAt: string | null;
}

// ── Interne DB-Typen ──────────────────────────────────────────────────────────

interface DbMenuSnapshot {
  snapshot_date: string;
  quantity_sold: number;
}

interface DbStockRow {
  id: string;
  location_id: string;
  item_name: string;
  current_stock: number;
  unit: string;
  min_stock_level: number;
  reorder_point: number;
  reorder_qty: number;
  lead_time_days: number;
  cost_per_unit: number;
  supplier_name: string | null;
  last_checked_at: string;
  updated_at: string;
}

interface DbAlertRow {
  id: string;
  location_id: string;
  item_name: string;
  alert_level: string;
  current_stock: number;
  reorder_point: number;
  avg_daily_demand: number;
  days_until_depletion: number | null;
  suggested_order_qty: number | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  unit?: string;
  supplier_name?: string | null;
  lead_time_days?: number;
  cost_per_unit?: number;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function mapStock(r: DbStockRow): ItemStock {
  return {
    id: r.id,
    locationId: r.location_id,
    itemName: r.item_name,
    currentStock: r.current_stock,
    unit: r.unit,
    minStockLevel: r.min_stock_level,
    reorderPoint: r.reorder_point,
    reorderQty: r.reorder_qty,
    leadTimeDays: r.lead_time_days,
    costPerUnit: r.cost_per_unit,
    supplierName: r.supplier_name,
    lastCheckedAt: r.last_checked_at,
    updatedAt: r.updated_at,
  };
}

function mapAlert(r: DbAlertRow): DemandAlert {
  return {
    id: r.id,
    locationId: r.location_id,
    itemName: r.item_name,
    alertLevel: r.alert_level as AlertLevel,
    currentStock: r.current_stock,
    reorderPoint: r.reorder_point,
    avgDailyDemand: r.avg_daily_demand,
    daysUntilDepletion: r.days_until_depletion,
    suggestedOrderQty: r.suggested_order_qty,
    status: r.status as AlertStatus,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    unit: r.unit,
    supplierName: r.supplier_name,
    leadTimeDays: r.lead_time_days,
    costPerUnit: r.cost_per_unit,
  };
}

// Reorder-Punkt: Verbrauch während Lieferzeit + Sicherheitsbestand (50% Extra)
function calcReorderPoint(avgDailyDemand: number, leadTimeDays: number): number {
  const safetyFactor = 1.5;
  return Math.ceil(avgDailyDemand * leadTimeDays * safetyFactor);
}

// Tage bis zur Erschöpfung
function calcDaysUntilDepletion(currentStock: number, avgDailyDemand: number): number | null {
  if (avgDailyDemand <= 0) return null;
  return Math.floor(currentStock / avgDailyDemand);
}

// ── Kern-Analyse ──────────────────────────────────────────────────────────────

export async function computeItemDemandProfile(
  locationId: string,
  itemName: string,
  days = 28,
): Promise<ItemDemandProfile | null> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const { data: rows } = await sb
    .from('delivery_menu_snapshots')
    .select('snapshot_date, quantity_sold')
    .eq('location_id', locationId)
    .eq('item_name', itemName)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true })
    .returns<DbMenuSnapshot[]>();

  if (!rows || rows.length === 0) return null;

  // Tag-der-Woche-Saisonalität (0=Mo … 6=So gemäß JS Date.getDay()-1 wrap)
  const dowTotals = new Array<number>(7).fill(0);
  const dowCounts = new Array<number>(7).fill(0);
  let totalQty = 0;

  for (const r of rows) {
    const dow = (new Date(r.snapshot_date).getDay() + 6) % 7; // 0=Mo
    dowTotals[dow] += r.quantity_sold;
    dowCounts[dow]++;
    totalQty += r.quantity_sold;
  }

  const avgDailyDemand = totalQty / days;

  // Saisonalitätsfaktoren je DoW (Faktor vs. Tages-Durchschnitt)
  const seasonalityFactors = dowTotals.map((total, i) => {
    if (dowCounts[i] === 0 || avgDailyDemand === 0) return 1;
    return (total / dowCounts[i]) / avgDailyDemand;
  });

  const peakDayOfWeek = dowTotals.indexOf(Math.max(...dowTotals));
  const lastSaleDate = rows[rows.length - 1]?.snapshot_date ?? null;

  return {
    itemName,
    locationId,
    avgDailyDemand,
    avgWeeklyDemand: avgDailyDemand * 7,
    peakDayOfWeek,
    seasonalityFactors,
    daysWithData: rows.length,
    lastSaleDate,
  };
}

// ── Lagerstand anlegen / updaten ──────────────────────────────────────────────

export async function upsertItemStock(
  locationId: string,
  item: ItemStockUpsert,
): Promise<ItemStock> {
  const sb = createServiceClient();

  const payload: Record<string, unknown> = {
    location_id: locationId,
    item_name: item.itemName,
    current_stock: item.currentStock,
    last_checked_at: new Date().toISOString(),
  };
  if (item.unit !== undefined)         payload.unit = item.unit;
  if (item.minStockLevel !== undefined) payload.min_stock_level = item.minStockLevel;
  if (item.reorderQty !== undefined)   payload.reorder_qty = item.reorderQty;
  if (item.leadTimeDays !== undefined) payload.lead_time_days = item.leadTimeDays;
  if (item.costPerUnit !== undefined)  payload.cost_per_unit = item.costPerUnit;
  if (item.supplierName !== undefined) payload.supplier_name = item.supplierName;

  // Reorder-Punkt aus Nachfrage-Profil ableiten wenn nicht explizit vorgegeben
  if (item.reorderQty !== undefined && item.leadTimeDays !== undefined) {
    const profile = await computeItemDemandProfile(locationId, item.itemName, 28);
    if (profile) {
      payload.reorder_point = calcReorderPoint(profile.avgDailyDemand, item.leadTimeDays);
    }
  }

  const { data, error } = await sb
    .from('menu_item_stock')
    .upsert(payload, { onConflict: 'location_id,item_name' })
    .select()
    .single<DbStockRow>();

  if (error) throw new Error(`upsertItemStock: ${error.message}`);
  return mapStock(data);
}

// ── Alarmprüfung für eine Location ───────────────────────────────────────────

export async function checkAllItemStocks(locationId: string): Promise<StockCheckResult> {
  const sb = createServiceClient();
  let alertsCreated = 0;
  let alertsResolved = 0;
  let errors = 0;

  const { data: stocks } = await sb
    .from('menu_item_stock')
    .select('*')
    .eq('location_id', locationId)
    .returns<DbStockRow[]>();

  if (!stocks || stocks.length === 0) {
    return { locationId, itemsChecked: 0, alertsCreated: 0, alertsResolved: 0, errors: 0 };
  }

  for (const stock of stocks) {
    try {
      const profile = await computeItemDemandProfile(locationId, stock.item_name, 28);
      const avgDaily = profile?.avgDailyDemand ?? 0;

      // Reorder-Punkt aktuell halten
      const reorderPoint = calcReorderPoint(avgDaily, stock.lead_time_days);
      await sb
        .from('menu_item_stock')
        .update({ reorder_point: reorderPoint, last_checked_at: new Date().toISOString() })
        .eq('id', stock.id);

      const daysLeft = calcDaysUntilDepletion(stock.current_stock, avgDaily);

      if (stock.current_stock <= reorderPoint) {
        const level: AlertLevel =
          stock.current_stock <= stock.min_stock_level ? 'critical' : 'warning';
        const suggestedQty = Math.max(stock.reorder_qty, Math.ceil(avgDaily * stock.lead_time_days * 2));

        // Vorhandenen offenen Alert updaten oder neu erstellen
        const { data: existing } = await sb
          .from('item_demand_alerts')
          .select('id')
          .eq('location_id', locationId)
          .eq('item_name', stock.item_name)
          .eq('status', 'open')
          .maybeSingle();

        if (existing) {
          await sb
            .from('item_demand_alerts')
            .update({
              alert_level: level,
              current_stock: stock.current_stock,
              reorder_point: reorderPoint,
              avg_daily_demand: avgDaily,
              days_until_depletion: daysLeft,
              suggested_order_qty: suggestedQty,
            })
            .eq('id', existing.id);
        } else {
          const { error } = await sb.from('item_demand_alerts').insert({
            location_id: locationId,
            item_name: stock.item_name,
            alert_level: level,
            current_stock: stock.current_stock,
            reorder_point: reorderPoint,
            avg_daily_demand: avgDaily,
            days_until_depletion: daysLeft,
            suggested_order_qty: suggestedQty,
            status: 'open',
          });
          if (!error) alertsCreated++;
        }
      } else {
        // Lager über Reorder-Punkt → offenen Alert auflösen
        const { data: openAlert } = await sb
          .from('item_demand_alerts')
          .select('id')
          .eq('location_id', locationId)
          .eq('item_name', stock.item_name)
          .eq('status', 'open')
          .maybeSingle();

        if (openAlert) {
          await sb
            .from('item_demand_alerts')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() })
            .eq('id', openAlert.id);
          alertsResolved++;
        }
      }
    } catch {
      errors++;
    }
  }

  return {
    locationId,
    itemsChecked: stocks.length,
    alertsCreated,
    alertsResolved,
    errors,
  };
}

// ── Cron-Batch: alle aktiven Locations ───────────────────────────────────────

export async function checkAllLocations(): Promise<{
  locations: number;
  itemsChecked: number;
  alertsCreated: number;
  alertsResolved: number;
  errors: number;
}> {
  const sb = createServiceClient();

  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('is_active', true);

  if (!locs || locs.length === 0) {
    return { locations: 0, itemsChecked: 0, alertsCreated: 0, alertsResolved: 0, errors: 0 };
  }

  const results = await Promise.all(
    locs.map((l) => checkAllItemStocks(l.id).catch((): StockCheckResult => ({
      locationId: l.id,
      itemsChecked: 0,
      alertsCreated: 0,
      alertsResolved: 0,
      errors: 1,
    }))),
  );

  return {
    locations: results.length,
    itemsChecked: results.reduce((s, r) => s + r.itemsChecked, 0),
    alertsCreated: results.reduce((s, r) => s + r.alertsCreated, 0),
    alertsResolved: results.reduce((s, r) => s + r.alertsResolved, 0),
    errors: results.reduce((s, r) => s + r.errors, 0),
  };
}

// ── Admin-Dashboard ───────────────────────────────────────────────────────────

export async function getItemDemandDashboard(locationId: string): Promise<ItemDemandDashboard> {
  const sb = createServiceClient();

  const [{ data: stocks }, { data: alerts }] = await Promise.all([
    sb
      .from('menu_item_stock')
      .select('*')
      .eq('location_id', locationId)
      .order('item_name')
      .returns<DbStockRow[]>(),
    sb
      .from('v_item_demand_alerts_open')
      .select('*')
      .eq('location_id', locationId)
      .limit(50)
      .returns<DbAlertRow[]>(),
  ]);

  const stockList = (stocks ?? []).map(mapStock);
  const openAlerts = (alerts ?? []).map(mapAlert);

  const itemsWarning = openAlerts.filter((a) => a.alertLevel === 'warning').length;
  const itemsCritical = openAlerts.filter((a) => a.alertLevel === 'critical').length;
  const itemsOk = stockList.length - itemsWarning - itemsCritical;
  const lastCheckedAt = stockList[0]?.lastCheckedAt ?? null;

  // Top-Nachfrage-Artikel: Nachfrage-Profile parallel berechnen
  const profiles = await Promise.all(
    stockList.slice(0, 10).map((s) =>
      computeItemDemandProfile(locationId, s.itemName, 14).catch(() => null),
    ),
  );

  const topDemandItems = stockList
    .slice(0, 10)
    .map((s, i) => ({
      itemName: s.itemName,
      avgDailyDemand: profiles[i]?.avgDailyDemand ?? 0,
      unit: s.unit,
    }))
    .sort((a, b) => b.avgDailyDemand - a.avgDailyDemand)
    .slice(0, 5);

  return {
    locationId,
    totalTrackedItems: stockList.length,
    itemsOk: Math.max(0, itemsOk),
    itemsWarning,
    itemsCritical,
    openAlerts,
    stockList,
    topDemandItems,
    lastCheckedAt,
  };
}

// ── Alert als bestellt markieren ─────────────────────────────────────────────

export async function markAlertOrdered(
  locationId: string,
  itemName: string,
): Promise<{ ok: boolean }> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('item_demand_alerts')
    .update({ status: 'ordered' })
    .eq('location_id', locationId)
    .eq('item_name', itemName)
    .eq('status', 'open');

  return { ok: !error };
}

// ── Cleanup alter aufgelöster Alarme ─────────────────────────────────────────

export async function pruneOldAlerts(daysToKeep = 90): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('prune_old_demand_alerts', { p_days: daysToKeep });
  if (error) throw new Error(`pruneOldAlerts: ${error.message}`);
  return { pruned: (data as { pruned: number } | null)?.pruned ?? 0 };
}
