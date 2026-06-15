/**
 * lib/delivery/tips.ts
 *
 * Smart Driver Tip Engine — Phase 198
 *
 * Fahrer-Trinkgeld-System: Kunden können beim Checkout Trinkgeld hinterlassen.
 * Das Trinkgeld wird in customer_orders.tip_eur gespeichert und täglich
 * in Snapshots aggregiert.
 *
 * Public API:
 *   getTipConfig(locationId)             — Konfiguration laden
 *   upsertTipConfig(locationId, cfg)     — Konfiguration speichern
 *   recordTip(orderId, tipEur)           — Trinkgeld für Bestellung setzen
 *   getDriverTipStats(driverId, days)    — Fahrer-Statistiken
 *   getTipLeaderboard(locationId, limit) — Top-Fahrer nach Trinkgeld
 *   getTipDashboard(locationId)          — Admin-Übersicht
 *   snapshotDriverTips(locationId, date) — Tages-Snapshot berechnen
 *   snapshotAllLocations()               — Cron-Batch (täglich 01:30 UTC)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TipConfig {
  id?: string;
  locationId: string;
  isEnabled: boolean;
  suggestionsPct: number[];
  customAllowed: boolean;
  minTipEur: number;
  maxTipEur: number;
}

export interface TipLeaderboardEntry {
  driverId: string;
  driverName: string | null;
  totalTips: number;
  totalTipEur: number;
  avgTipEur: number;
  bestSingleTip: number;
  daysWithTips: number;
  rank: number;
}

export interface TipSnapshot {
  driverId: string;
  locationId: string;
  snapshotDate: string;
  tipCount: number;
  totalTipEur: number;
  avgTipEur: number;
  maxTipEur: number;
}

export interface TipDashboard {
  config: TipConfig;
  summary: {
    totalTips30d: number;
    totalTipEur30d: number;
    avgTipEur30d: number;
    maxSingleTip30d: number;
    driversWithTips: number;
    tipsToday: number;
    tipEurToday: number;
  };
  leaderboard: TipLeaderboardEntry[];
  todayByDriver: Array<{
    driverId: string;
    driverName: string | null;
    tipCount: number;
    totalTipEur: number;
    avgTipEur: number;
  }>;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Omit<TipConfig, 'locationId' | 'id'> = {
  isEnabled: true,
  suggestionsPct: [5, 10, 15],
  customAllowed: true,
  minTipEur: 0.50,
  maxTipEur: 20.00,
};

// ─── Config ───────────────────────────────────────────────────────────────────

export async function getTipConfig(locationId: string): Promise<TipConfig> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('tip_config')
    .select('id, location_id, is_enabled, suggestions_pct, custom_allowed, min_tip_eur, max_tip_eur')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) return { ...DEFAULT_CONFIG, locationId };

  return {
    id: data.id,
    locationId: data.location_id,
    isEnabled: data.is_enabled,
    suggestionsPct: (data.suggestions_pct as number[]) ?? DEFAULT_CONFIG.suggestionsPct,
    customAllowed: data.custom_allowed,
    minTipEur: Number(data.min_tip_eur),
    maxTipEur: Number(data.max_tip_eur),
  };
}

export async function upsertTipConfig(
  locationId: string,
  cfg: Partial<Omit<TipConfig, 'locationId' | 'id'>>,
): Promise<TipConfig> {
  const sb = createServiceClient();
  await sb
    .from('tip_config')
    .upsert(
      {
        location_id: locationId,
        is_enabled: cfg.isEnabled ?? DEFAULT_CONFIG.isEnabled,
        suggestions_pct: cfg.suggestionsPct ?? DEFAULT_CONFIG.suggestionsPct,
        custom_allowed: cfg.customAllowed ?? DEFAULT_CONFIG.customAllowed,
        min_tip_eur: cfg.minTipEur ?? DEFAULT_CONFIG.minTipEur,
        max_tip_eur: cfg.maxTipEur ?? DEFAULT_CONFIG.maxTipEur,
      },
      { onConflict: 'location_id' },
    );
  return getTipConfig(locationId);
}

// ─── Record Tip ───────────────────────────────────────────────────────────────

export async function recordTip(
  orderId: string,
  tipEur: number,
): Promise<{ success: boolean; tipEur: number }> {
  const rounded = Math.round(Math.max(0, tipEur) * 100) / 100;
  const sb = createServiceClient();

  const { error } = await sb
    .from('customer_orders')
    .update({ tip_eur: rounded })
    .eq('id', orderId);

  return { success: !error, tipEur: rounded };
}

// ─── Driver Tip Stats ─────────────────────────────────────────────────────────

export async function getDriverTipStats(
  driverId: string,
  days: number = 30,
): Promise<{
  totalTips: number;
  totalTipEur: number;
  avgTipEur: number;
  maxTipEur: number;
  trend: Array<{ date: string; totalTipEur: number; tipCount: number }>;
}> {
  const sb = createServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: snapshots } = await sb
    .from('driver_tip_snapshots')
    .select('snapshot_date, tip_count, total_tip_eur, avg_tip_eur, max_tip_eur')
    .eq('driver_id', driverId)
    .gte('snapshot_date', sinceStr)
    .order('snapshot_date', { ascending: false });

  const rows = snapshots ?? [];
  const totalTips = rows.reduce((s, r) => s + (r.tip_count as number), 0);
  const totalTipEur = rows.reduce((s, r) => s + Number(r.total_tip_eur), 0);
  const maxTipEur = rows.reduce((m, r) => Math.max(m, Number(r.max_tip_eur)), 0);
  const avgTipEur = totalTips > 0 ? totalTipEur / totalTips : 0;

  return {
    totalTips,
    totalTipEur: Math.round(totalTipEur * 100) / 100,
    avgTipEur: Math.round(avgTipEur * 100) / 100,
    maxTipEur,
    trend: rows.map((r) => ({
      date: r.snapshot_date as string,
      totalTipEur: Number(r.total_tip_eur),
      tipCount: r.tip_count as number,
    })),
  };
}

// ─── Driver Name Helper ───────────────────────────────────────────────────────

async function enrichDriverNames(
  driverIds: string[],
): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  if (driverIds.length === 0) return nameMap;

  const sb = createServiceClient();
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id, auth_user_id, name')
    .in('id', driverIds);

  if (!drivers) return nameMap;

  const authIds = drivers.map((d) => d.auth_user_id).filter(Boolean) as string[];
  const empMap = new Map<string, string>();

  if (authIds.length > 0) {
    const { data: emps } = await sb
      .from('employees')
      .select('auth_user_id, vorname, nachname')
      .in('auth_user_id', authIds);
    emps?.forEach((e) => {
      const fullName = `${e.vorname ?? ''} ${e.nachname ?? ''}`.trim();
      if (fullName) empMap.set(e.auth_user_id, fullName);
    });
  }

  drivers.forEach((d) => {
    const name = empMap.get(d.auth_user_id ?? '') ?? (d.name as string | null) ?? null;
    if (name) nameMap.set(d.id, name);
  });

  return nameMap;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function getTipLeaderboard(
  locationId: string,
  limit: number = 10,
): Promise<TipLeaderboardEntry[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_driver_tip_leaderboard')
    .select('driver_id, total_tips, total_tip_eur, avg_tip_eur, best_single_tip, days_with_tips, rank')
    .eq('location_id', locationId)
    .order('rank', { ascending: true })
    .limit(limit);

  if (!data || data.length === 0) return [];

  const nameMap = await enrichDriverNames(data.map((d) => d.driver_id as string));

  return data.map((d) => ({
    driverId: d.driver_id as string,
    driverName: nameMap.get(d.driver_id as string) ?? null,
    totalTips: d.total_tips as number,
    totalTipEur: Number(d.total_tip_eur),
    avgTipEur: Number(d.avg_tip_eur),
    bestSingleTip: Number(d.best_single_tip),
    daysWithTips: d.days_with_tips as number,
    rank: d.rank as number,
  }));
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getTipDashboard(locationId: string): Promise<TipDashboard> {
  const sb = createServiceClient();

  const [config, summaryRes, leaderboard, todayRes] = await Promise.all([
    getTipConfig(locationId),
    sb
      .from('v_location_tip_summary')
      .select('total_tips_30d, total_tip_eur_30d, avg_tip_eur_30d, max_single_tip_30d, drivers_with_tips')
      .eq('location_id', locationId)
      .maybeSingle(),
    getTipLeaderboard(locationId, 10),
    sb
      .from('v_driver_tip_today')
      .select('driver_id, tip_count, total_tip_eur, avg_tip_eur')
      .eq('location_id', locationId)
      .order('total_tip_eur', { ascending: false }),
  ]);

  const summary = summaryRes.data;
  const todayRows = todayRes.data ?? [];
  const tipsToday = todayRows.reduce((s, r) => s + (r.tip_count as number), 0);
  const tipEurToday = todayRows.reduce((s, r) => s + Number(r.total_tip_eur), 0);

  const nameMap = await enrichDriverNames(todayRows.map((r) => r.driver_id as string));

  return {
    config,
    summary: {
      totalTips30d: Number(summary?.total_tips_30d ?? 0),
      totalTipEur30d: Number(summary?.total_tip_eur_30d ?? 0),
      avgTipEur30d: Number(summary?.avg_tip_eur_30d ?? 0),
      maxSingleTip30d: Number(summary?.max_single_tip_30d ?? 0),
      driversWithTips: Number(summary?.drivers_with_tips ?? 0),
      tipsToday,
      tipEurToday: Math.round(tipEurToday * 100) / 100,
    },
    leaderboard,
    todayByDriver: todayRows.map((r) => ({
      driverId: r.driver_id as string,
      driverName: nameMap.get(r.driver_id as string) ?? null,
      tipCount: r.tip_count as number,
      totalTipEur: Number(r.total_tip_eur),
      avgTipEur: Number(r.avg_tip_eur),
    })),
  };
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

export async function snapshotDriverTips(
  locationId: string,
  date?: string,
): Promise<{ driverCount: number; tipsTotal: number; eurTotal: number }> {
  const sb = createServiceClient();
  const targetDate = date ?? new Date().toISOString().slice(0, 10);

  const { data: orders } = await sb
    .from('customer_orders')
    .select('mise_driver_id, tip_eur')
    .eq('location_id', locationId)
    .gt('tip_eur', 0)
    .not('mise_driver_id', 'is', null)
    .gte('created_at', `${targetDate}T00:00:00Z`)
    .lte('created_at', `${targetDate}T23:59:59Z`);

  if (!orders || orders.length === 0) {
    return { driverCount: 0, tipsTotal: 0, eurTotal: 0 };
  }

  const byDriver = new Map<string, number[]>();
  for (const o of orders) {
    const driverId = o.mise_driver_id as string;
    const tip = Number(o.tip_eur);
    if (!byDriver.has(driverId)) byDriver.set(driverId, []);
    byDriver.get(driverId)!.push(tip);
  }

  const rows = Array.from(byDriver.entries()).map(([driverId, tips]) => {
    const total = tips.reduce((s, t) => s + t, 0);
    return {
      driver_id: driverId,
      location_id: locationId,
      snapshot_date: targetDate,
      tip_count: tips.length,
      total_tip_eur: Math.round(total * 100) / 100,
      avg_tip_eur: Math.round((total / tips.length) * 100) / 100,
      max_tip_eur: Math.max(...tips),
    };
  });

  await sb
    .from('driver_tip_snapshots')
    .upsert(rows, { onConflict: 'driver_id,snapshot_date' });

  return {
    driverCount: rows.length,
    tipsTotal: rows.reduce((s, r) => s + r.tip_count, 0),
    eurTotal: Math.round(rows.reduce((s, r) => s + r.total_tip_eur, 0) * 100) / 100,
  };
}

export async function snapshotAllLocations(): Promise<{
  locations: number;
  errors: number;
  tipsTotal: number;
  eurTotal: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locs?.length) return { locations: 0, errors: 0, tipsTotal: 0, eurTotal: 0 };

  let errors = 0;
  let tipsTotal = 0;
  let eurTotal = 0;

  await Promise.all(
    locs.map(async (loc) => {
      try {
        const r = await snapshotDriverTips(loc.id);
        tipsTotal += r.tipsTotal;
        eurTotal += r.eurTotal;
      } catch {
        errors++;
      }
    }),
  );

  return {
    locations: locs.length,
    errors,
    tipsTotal,
    eurTotal: Math.round(eurTotal * 100) / 100,
  };
}
