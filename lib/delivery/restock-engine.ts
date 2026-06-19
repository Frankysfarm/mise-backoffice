/**
 * lib/delivery/restock-engine.ts
 *
 * Phase 248 — Predictive Restock Engine
 * Verfolgt Liefermaterial-Verbrauch und prognostiziert Nachbestellbedarf.
 *
 * Verbrauch wird täglich aus Bestellzahl × items_per_order abgeleitet.
 * Depletion-Datum = current_stock / avg_daily_usage (14-Tage-Fenster).
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type MaterialCategory = 'packaging' | 'accessories' | 'cleaning' | 'other';
export type StockLevel = 'ok' | 'warning' | 'critical';
export type AlertStatus = 'open' | 'ordered' | 'resolved';

export interface DeliveryMaterial {
  id: string;
  location_id: string;
  name: string;
  unit: string;
  category: MaterialCategory;
  current_stock: number;
  min_stock_level: number;
  reorder_qty: number;
  cost_per_unit: number;
  items_per_order: number;
  supplier_name: string | null;
  supplier_email: string | null;
  supplier_phone: string | null;
  last_restocked_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface MaterialBurnRate extends DeliveryMaterial {
  avg_daily_usage: number;
  snapshot_days: number;
  days_until_depletion: number | null;
  depletion_date_est: string | null;
  stock_level: StockLevel;
}

export interface RestockAlert {
  id: string;
  location_id: string;
  material_id: string;
  status: AlertStatus;
  current_stock: number;
  min_stock_level: number;
  daily_burn_rate: number | null;
  depletion_date_est: string | null;
  days_until_depletion: number | null;
  triggered_at: string;
  ordered_at: string | null;
  resolved_at: string | null;
  notes: string | null;
  material_name?: string;
}

export interface UsageSnapshot {
  material_id: string;
  date_bucket: string;
  orders_count: number;
  units_used: number;
  stock_after: number | null;
}

export interface RestockDashboard {
  materials: MaterialBurnRate[];
  alerts: RestockAlert[];
  trend14d: { date: string; total_units: number; orders: number }[];
  summary: {
    total_materials: number;
    critical_count: number;
    warning_count: number;
    ok_count: number;
    avg_daily_orders: number;
    total_stock_value_eur: number;
  };
  last_snapshot_at: string | null;
}

// ── Default-Materialkatalog ───────────────────────────────────────────────────

const DEFAULT_MATERIALS: Omit<DeliveryMaterial,
  'id' | 'location_id' | 'last_restocked_at' | 'is_active' | 'created_at'
>[] = [
  {
    name: 'Liefertaschen (isoliert)',
    unit: 'Stück', category: 'packaging',
    current_stock: 50, min_stock_level: 15, reorder_qty: 60,
    cost_per_unit: 2.50, items_per_order: 1.0,
    supplier_name: null, supplier_email: null, supplier_phone: null,
  },
  {
    name: 'Papierboxen klein',
    unit: 'Stück', category: 'packaging',
    current_stock: 200, min_stock_level: 50, reorder_qty: 500,
    cost_per_unit: 0.12, items_per_order: 1.5,
    supplier_name: null, supplier_email: null, supplier_phone: null,
  },
  {
    name: 'Papierboxen groß',
    unit: 'Stück', category: 'packaging',
    current_stock: 150, min_stock_level: 30, reorder_qty: 300,
    cost_per_unit: 0.22, items_per_order: 0.8,
    supplier_name: null, supplier_email: null, supplier_phone: null,
  },
  {
    name: 'Plastiktüten',
    unit: 'Stück', category: 'packaging',
    current_stock: 400, min_stock_level: 100, reorder_qty: 1000,
    cost_per_unit: 0.04, items_per_order: 1.0,
    supplier_name: null, supplier_email: null, supplier_phone: null,
  },
  {
    name: 'Servietten',
    unit: 'Stück', category: 'accessories',
    current_stock: 500, min_stock_level: 150, reorder_qty: 2000,
    cost_per_unit: 0.02, items_per_order: 3.0,
    supplier_name: null, supplier_email: null, supplier_phone: null,
  },
  {
    name: 'Bestecksets (Einweg)',
    unit: 'Set', category: 'accessories',
    current_stock: 200, min_stock_level: 50, reorder_qty: 500,
    cost_per_unit: 0.09, items_per_order: 0.7,
    supplier_name: null, supplier_email: null, supplier_phone: null,
  },
  {
    name: 'Saucenbecher (30ml)',
    unit: 'Stück', category: 'packaging',
    current_stock: 300, min_stock_level: 80, reorder_qty: 800,
    cost_per_unit: 0.06, items_per_order: 1.5,
    supplier_name: null, supplier_email: null, supplier_phone: null,
  },
];

// ── Seed-Funktion: Erstellt Default-Materialien wenn keine vorhanden ──────────

export async function seedMaterials(
  locationId: string,
): Promise<{ seeded: number }> {
  const sb = createServiceClient();

  const { count } = await sb
    .from('delivery_materials')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId);

  if ((count ?? 0) > 0) return { seeded: 0 };

  const rows = DEFAULT_MATERIALS.map((m) => ({
    ...m,
    location_id: locationId,
  }));

  const { data, error } = await sb
    .from('delivery_materials')
    .insert(rows)
    .select('id');

  if (error) throw new Error(`seedMaterials: ${error.message}`);
  return { seeded: data?.length ?? 0 };
}

// ── Täglicher Verbrauchs-Snapshot ─────────────────────────────────────────────

export async function recordDailyUsage(
  locationId: string,
  dateStr?: string,
): Promise<{ snapshots: number; orders_counted: number }> {
  const sb = createServiceClient();

  const targetDate = dateStr ?? new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10); // gestern

  // Gelieferte Bestellungen dieses Tages zählen
  const dayStart = `${targetDate}T00:00:00.000Z`;
  const dayEnd   = `${targetDate}T23:59:59.999Z`;

  const { count: ordersCount } = await sb
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('bestellart', 'lieferung')
    .eq('status', 'geliefert')
    .gte('bestellt_am', dayStart)
    .lte('bestellt_am', dayEnd);

  const totalOrders = ordersCount ?? 0;

  const { data: materials } = await sb
    .from('delivery_materials')
    .select('id, current_stock, items_per_order')
    .eq('location_id', locationId)
    .eq('is_active', true);

  if (!materials?.length) return { snapshots: 0, orders_counted: totalOrders };

  const snapshotRows = materials.map((m) => {
    const unitsUsed = parseFloat((totalOrders * m.items_per_order).toFixed(2));
    const stockAfter = Math.max(0, m.current_stock - Math.round(unitsUsed));
    return {
      location_id:  locationId,
      material_id:  m.id,
      date_bucket:  targetDate,
      orders_count: totalOrders,
      units_used:   unitsUsed,
      stock_after:  stockAfter,
    };
  });

  const { data: inserted } = await sb
    .from('material_usage_snapshots')
    .upsert(snapshotRows, { onConflict: 'material_id,date_bucket' })
    .select('id');

  // Lagerbestand aktualisieren
  for (const row of snapshotRows) {
    if (row.units_used > 0) {
      await sb
        .from('delivery_materials')
        .update({
          current_stock: row.stock_after,
          updated_at:    new Date().toISOString(),
        })
        .eq('id', row.material_id)
        .eq('location_id', locationId);
    }
  }

  return { snapshots: inserted?.length ?? 0, orders_counted: totalOrders };
}

// ── Threshold-Check & Alert-Erstellung ───────────────────────────────────────

export async function checkThresholds(
  locationId: string,
): Promise<{ created: number; resolved: number }> {
  const sb = createServiceClient();

  const { data: burnRates } = await sb
    .from('v_material_burn_rate')
    .select('*')
    .eq('location_id', locationId);

  if (!burnRates?.length) return { created: 0, resolved: 0 };

  let created = 0;
  let resolved = 0;

  for (const m of burnRates as MaterialBurnRate[]) {
    const needsAlert = m.stock_level === 'critical' || m.stock_level === 'warning';

    const { data: existingOpen } = await sb
      .from('restock_alerts')
      .select('id, status')
      .eq('material_id', m.id)
      .eq('status', 'open')
      .maybeSingle();

    if (needsAlert && !existingOpen) {
      await sb.from('restock_alerts').insert({
        location_id:          locationId,
        material_id:          m.id,
        status:               'open',
        current_stock:        m.current_stock,
        min_stock_level:      m.min_stock_level,
        daily_burn_rate:      m.avg_daily_usage,
        depletion_date_est:   m.depletion_date_est,
        days_until_depletion: m.days_until_depletion,
      });
      created++;
    }

    // Wenn Bestand wieder OK: offene Alerts auto-schließen
    if (!needsAlert && existingOpen) {
      await sb
        .from('restock_alerts')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', existingOpen.id);
      resolved++;
    }
  }

  return { created, resolved };
}

// ── Lagerbestand manuell aktualisieren ───────────────────────────────────────

export async function updateStock(
  locationId: string,
  materialId: string,
  newStock: number,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient();

  const { error } = await sb
    .from('delivery_materials')
    .update({
      current_stock:     newStock,
      last_restocked_at: new Date().toISOString(),
      updated_at:        new Date().toISOString(),
    })
    .eq('id', materialId)
    .eq('location_id', locationId);

  if (error) return { ok: false, error: error.message };

  // Offene Alerts für dieses Material schließen falls Bestand wieder OK
  await sb
    .from('restock_alerts')
    .update({ status: 'resolved', resolved_at: new Date().toISOString(), notes: `Nachgefüllt auf ${newStock} von ${userId}` })
    .eq('material_id', materialId)
    .eq('status', 'open');

  return { ok: true };
}

// ── Alert-Status aktualisieren ────────────────────────────────────────────────

export async function updateAlertStatus(
  alertId: string,
  locationId: string,
  status: AlertStatus,
  notes?: string,
): Promise<{ ok: boolean }> {
  const sb = createServiceClient();

  const update: Record<string, string | null> = { status, notes: notes ?? null };
  if (status === 'ordered')  update.ordered_at  = new Date().toISOString();
  if (status === 'resolved') update.resolved_at = new Date().toISOString();

  const { error } = await sb
    .from('restock_alerts')
    .update(update)
    .eq('id', alertId)
    .eq('location_id', locationId);

  return { ok: !error };
}

// ── Material erstellen ────────────────────────────────────────────────────────

export async function createMaterial(
  locationId: string,
  data: Omit<DeliveryMaterial, 'id' | 'location_id' | 'is_active' | 'created_at'>,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const sb = createServiceClient();

  const { data: result, error } = await sb
    .from('delivery_materials')
    .insert({ ...data, location_id: locationId })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: result.id };
}

// ── Material deaktivieren ─────────────────────────────────────────────────────

export async function deactivateMaterial(
  materialId: string,
  locationId: string,
): Promise<{ ok: boolean }> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('delivery_materials')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', materialId)
    .eq('location_id', locationId);
  return { ok: !error };
}

// ── 14-Tage Verbrauchs-Trend ──────────────────────────────────────────────────

async function getTrend14d(
  locationId: string,
): Promise<{ date: string; total_units: number; orders: number }[]> {
  const sb = createServiceClient();

  const { data } = await sb
    .from('material_usage_snapshots')
    .select('date_bucket, orders_count, units_used')
    .eq('location_id', locationId)
    .gte('date_bucket', new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10))
    .order('date_bucket', { ascending: true });

  if (!data?.length) return [];

  const byDate: Record<string, { total_units: number; orders: number }> = {};
  for (const row of data) {
    const d = row.date_bucket as string;
    if (!byDate[d]) byDate[d] = { total_units: 0, orders: row.orders_count as number };
    byDate[d].total_units += Number(row.units_used ?? 0);
  }

  return Object.entries(byDate).map(([date, v]) => ({ date, ...v }));
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDashboard(locationId: string): Promise<RestockDashboard> {
  const sb = createServiceClient();

  const [burnRateResult, alertsResult, trend14d] = await Promise.all([
    sb
      .from('v_material_burn_rate')
      .select('*')
      .eq('location_id', locationId)
      .order('stock_level', { ascending: true }), // critical first
    sb
      .from('restock_alerts')
      .select('*, delivery_materials(name)')
      .eq('location_id', locationId)
      .in('status', ['open', 'ordered'])
      .order('triggered_at', { ascending: false })
      .limit(50),
    getTrend14d(locationId),
  ]);

  const materials = (burnRateResult.data ?? []) as MaterialBurnRate[];
  const rawAlerts = alertsResult.data ?? [];

  const alerts: RestockAlert[] = rawAlerts.map((a) => ({
    ...(a as RestockAlert),
    material_name: (a.delivery_materials as { name: string } | null)?.name ?? undefined,
  }));

  const critical = materials.filter((m) => m.stock_level === 'critical').length;
  const warning  = materials.filter((m) => m.stock_level === 'warning').length;
  const ok       = materials.filter((m) => m.stock_level === 'ok').length;

  const avgDailyOrders = trend14d.length > 0
    ? Math.round(trend14d.reduce((s, d) => s + d.orders, 0) / trend14d.length)
    : 0;

  const stockValue = materials.reduce(
    (s, m) => s + m.current_stock * Number(m.cost_per_unit ?? 0),
    0,
  );

  const lastSnap = await sb
    .from('material_usage_snapshots')
    .select('created_at')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    materials,
    alerts,
    trend14d,
    summary: {
      total_materials:      materials.length,
      critical_count:       critical,
      warning_count:        warning,
      ok_count:             ok,
      avg_daily_orders:     avgDailyOrders,
      total_stock_value_eur: parseFloat(stockValue.toFixed(2)),
    },
    last_snapshot_at: lastSnap.data?.created_at ?? null,
  };
}

// ── Cron-Batch: alle Standorte ────────────────────────────────────────────────

export async function recordUsageAllLocations(): Promise<{
  locations: number;
  snapshots: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('delivery_materials')
    .select('location_id')
    .eq('is_active', true);

  const locationIds = [...new Set((locations ?? []).map((r) => r.location_id as string))];

  let totalSnapshots = 0;
  let errors = 0;

  for (const lid of locationIds) {
    try {
      const r = await recordDailyUsage(lid);
      totalSnapshots += r.snapshots;
    } catch {
      errors++;
    }
  }

  return { locations: locationIds.length, snapshots: totalSnapshots, errors };
}

export async function checkThresholdsAllLocations(): Promise<{
  locations: number;
  alerts_created: number;
  alerts_resolved: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('delivery_materials')
    .select('location_id')
    .eq('is_active', true);

  const locationIds = [...new Set((locations ?? []).map((r) => r.location_id as string))];

  let alertsCreated = 0;
  let alertsResolved = 0;
  let errors = 0;

  for (const lid of locationIds) {
    try {
      const r = await checkThresholds(lid);
      alertsCreated  += r.created;
      alertsResolved += r.resolved;
    } catch {
      errors++;
    }
  }

  return { locations: locationIds.length, alerts_created: alertsCreated, alerts_resolved: alertsResolved, errors };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneOldMaterialSnapshots(
  days = 90,
): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_old_material_snapshots', { days_to_keep: days });
  return { pruned: (data as number | null) ?? 0 };
}
