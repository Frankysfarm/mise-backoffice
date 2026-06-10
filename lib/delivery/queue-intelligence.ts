/**
 * lib/delivery/queue-intelligence.ts
 *
 * Smart Dispatch Queue Intelligence — Phase 55
 *
 * Löst das FIFO-Problem: bisher wurden Bestellungen rein nach Erstellungszeit
 * dispatcht. Jetzt berechnet ein Komposit-Score (0–100) die echte Dringlichkeit:
 *
 *   Bestell-Priorität  (0–40): express > vip > rush > normal
 *   Küchen-Status      (0–25): fertig > in_zubereitung > neu
 *   Zone-Dringlichkeit (0–12): D > C > B > A
 *   Wartezeit          (0–15): +1 je 2 Minuten, max 15
 *   Eskalation         (0–20): +20 wenn ≥3 Fehlversuche
 *   Admin-Boost        (0–50): manueller Override
 *
 * Public API:
 *   computeOrderPriority(order)       — Score-Berechnung (TypeScript, ohne DB)
 *   getDispatchQueue(locationId)      — Prioritäts-Queue aus v_dispatch_priority_queue
 *   boostOrderPriority(orderId, n)    — Admin: manuellen Boost setzen
 *   resetOrderBoost(orderId)          — Admin: Boost zurücksetzen
 *   getQueueHealth(locationId)        — Aggregat-Metriken (Tiefe, Wartezeit, Staus)
 *   sortByPriority(orders)            — Utility: Array in-place nach Score sortieren
 */
import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

// ─── Supabase-Client ──────────────────────────────────────────────────────────

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (_sb) return _sb;
  _sb = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return _sb;
}

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface QueueOrder {
  id: string;
  location_id: string;
  bestellnummer: string;
  status: string;
  priority: string | null;
  delivery_zone: string | null;
  gesamtbetrag: number | null;
  kunde_name: string | null;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_stadt: string | null;
  created_at: string;
  dispatch_attempts: number;
  dispatch_escalated_at: string | null;
  dispatch_priority_boost: number;
  eta_earliest: string | null;
  eta_latest: string | null;
  // Berechnet vom View oder von computeOrderPriority()
  queue_score: number;
  wait_minutes: number;
  // Score-Breakdown Labels (optional, aus dem View)
  priority_label?: string | null;
  status_label?: string | null;
  escalation_label?: string | null;
  // Breakdown-Detail (TypeScript-seitig)
  score_breakdown?: ScoreBreakdown;
}

export interface ScoreBreakdown {
  priority_pts: number;
  status_pts: number;
  zone_pts: number;
  wait_pts: number;
  escalation_pts: number;
  boost_pts: number;
  total: number;
}

export interface QueueHealthMetrics {
  location_id: string;
  total_waiting: number;
  /** Durchschnittliche Wartezeit aller wartenden Orders in Minuten */
  avg_wait_minutes: number;
  /** Älteste wartende Bestellung in Minuten */
  max_wait_minutes: number;
  /** Orders mit score >= 50 (hohes Dringlichkeitsniveau) */
  high_priority_count: number;
  /** Eskalierte Orders (≥3 Fehlversuche) */
  escalated_count: number;
  /** Orders je Status */
  by_status: Record<string, number>;
  /** Orders je Zone */
  by_zone: Record<string, number>;
  /** Orders je Priorität */
  by_priority: Record<string, number>;
  /** Score-Verteilung: low (<25), medium (25-49), high (50-74), critical (≥75) */
  score_buckets: { low: number; medium: number; high: number; critical: number };
}

/** Minimal-Shape einer Bestellung für computeOrderPriority() */
export interface PrioritizableOrder {
  id: string;
  priority?: string | null;
  status?: string | null;
  delivery_zone?: string | null;
  created_at: string;
  dispatch_attempts?: number;
  dispatch_escalated_at?: string | null;
  dispatch_priority_boost?: number;
}

// ─── Score-Gewichte (spiegeln Migration 045) ──────────────────────────────────

const PRIORITY_PTS: Record<string, number> = {
  express: 40,
  vip:     35,
  rush:    20,
};
const STATUS_PTS: Record<string, number> = {
  fertig:         25,
  in_zubereitung: 10,
};
const ZONE_PTS: Record<string, number> = {
  D: 12,
  C:  8,
  B:  4,
};
const WAIT_PTS_PER_2MIN = 1;
const WAIT_PTS_MAX       = 15;
const ESCALATION_PTS     = 20;

// ─── computeOrderPriority ─────────────────────────────────────────────────────

/**
 * Berechnet den Dispatch-Priority-Score (0–100) ohne DB-Zugriff.
 * Spiegelt exakt die SQL-Funktion compute_dispatch_priority().
 */
export function computeOrderPriority(order: PrioritizableOrder): number {
  const priority_pts    = PRIORITY_PTS[order.priority ?? ''] ?? 0;
  const status_pts      = STATUS_PTS[order.status ?? ''] ?? 0;
  const zone_pts        = ZONE_PTS[order.delivery_zone ?? ''] ?? 0;
  const waitMin         = (Date.now() - new Date(order.created_at).getTime()) / 60_000;
  const wait_pts        = Math.min(WAIT_PTS_MAX, Math.floor(waitMin / 2) * WAIT_PTS_PER_2MIN);
  const escalation_pts  = order.dispatch_escalated_at ? ESCALATION_PTS : 0;
  const boost_pts       = order.dispatch_priority_boost ?? 0;

  const total = Math.min(100, priority_pts + status_pts + zone_pts + wait_pts + escalation_pts + boost_pts);
  return total;
}

/**
 * Gibt den vollständigen Score-Breakdown zurück (für Debug/Dashboard).
 */
export function computeOrderPriorityBreakdown(order: PrioritizableOrder): ScoreBreakdown {
  const priority_pts   = PRIORITY_PTS[order.priority ?? ''] ?? 0;
  const status_pts     = STATUS_PTS[order.status ?? ''] ?? 0;
  const zone_pts       = ZONE_PTS[order.delivery_zone ?? ''] ?? 0;
  const waitMin        = (Date.now() - new Date(order.created_at).getTime()) / 60_000;
  const wait_pts       = Math.min(WAIT_PTS_MAX, Math.floor(waitMin / 2) * WAIT_PTS_PER_2MIN);
  const escalation_pts = order.dispatch_escalated_at ? ESCALATION_PTS : 0;
  const boost_pts      = order.dispatch_priority_boost ?? 0;
  const total          = Math.min(100, priority_pts + status_pts + zone_pts + wait_pts + escalation_pts + boost_pts);

  return { priority_pts, status_pts, zone_pts, wait_pts, escalation_pts, boost_pts, total };
}

// ─── sortByPriority ───────────────────────────────────────────────────────────

/**
 * Sortiert ein Order-Array in-place nach Dispatch-Priority (höchster Score zuerst).
 * Gleicher Score → ältere Order zuerst (FIFO als Tiebreaker).
 * Nutzt computeOrderPriority() ohne DB-Zugriff — O(n log n).
 */
export function sortByPriority<T extends PrioritizableOrder>(orders: T[]): T[] {
  return orders.sort((a, b) => {
    const scoreA = computeOrderPriority(a);
    const scoreB = computeOrderPriority(b);
    if (scoreB !== scoreA) return scoreB - scoreA;
    // FIFO als Tiebreaker
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

// ─── getDispatchQueue ─────────────────────────────────────────────────────────

/**
 * Lädt die aktuelle Priority-Queue einer Location aus v_dispatch_priority_queue.
 * Enthält score_breakdown für jede Order.
 */
export async function getDispatchQueue(locationId: string, limit = 50): Promise<QueueOrder[]> {
  const { data, error } = await sb()
    .from('v_dispatch_priority_queue')
    .select('id, location_id, bestellnummer, status, priority, delivery_zone, gesamtbetrag, kunde_name, kunde_adresse, kunde_plz, kunde_stadt, created_at, dispatch_attempts, dispatch_escalated_at, dispatch_priority_boost, eta_earliest, eta_latest, queue_score, wait_minutes, priority_label, status_label, escalation_label')
    .eq('location_id', locationId)
    .limit(limit);

  if (error) throw new Error(`getDispatchQueue: ${error.message}`);

  return (data ?? []).map(row => ({
    ...row,
    queue_score:             row.queue_score as number,
    wait_minutes:            row.wait_minutes as number,
    dispatch_priority_boost: row.dispatch_priority_boost as number,
    score_breakdown: computeOrderPriorityBreakdown({
      priority:               row.priority as string | null,
      status:                 row.status as string | null,
      delivery_zone:          row.delivery_zone as string | null,
      created_at:             row.created_at as string,
      dispatch_escalated_at:  row.dispatch_escalated_at as string | null,
      dispatch_priority_boost: row.dispatch_priority_boost as number,
      id:                     row.id as string,
    }),
  })) as QueueOrder[];
}

// ─── boostOrderPriority ───────────────────────────────────────────────────────

/**
 * Setzt den manuellen Admin-Boost einer Bestellung (überschreibt vorherigen Wert).
 * boost darf 0–50 sein; wird serverseitig auf diesen Bereich geclippt.
 * Multi-Tenant: location_id wird als Guard übergeben.
 */
export async function boostOrderPriority(
  orderId: string,
  locationId: string,
  boost: number,
): Promise<void> {
  const clamped = Math.max(0, Math.min(50, Math.round(boost)));
  const { error } = await sb()
    .from('customer_orders')
    .update({ dispatch_priority_boost: clamped })
    .eq('id', orderId)
    .eq('location_id', locationId)
    .eq('typ', 'lieferung');

  if (error) throw new Error(`boostOrderPriority: ${error.message}`);
}

/**
 * Setzt den Boost einer Bestellung auf 0 zurück.
 */
export async function resetOrderBoost(orderId: string, locationId: string): Promise<void> {
  await boostOrderPriority(orderId, locationId, 0);
}

// ─── getQueueHealth ───────────────────────────────────────────────────────────

/**
 * Liefert aggregierte Queue-Health-Metriken für eine Location.
 * Schnelle Übersicht ohne alle Einzel-Orders laden zu müssen.
 */
export async function getQueueHealth(locationId: string): Promise<QueueHealthMetrics> {
  const { data, error } = await sb()
    .from('v_dispatch_priority_queue')
    .select('id, status, priority, delivery_zone, queue_score, wait_minutes, dispatch_escalated_at')
    .eq('location_id', locationId);

  if (error) throw new Error(`getQueueHealth: ${error.message}`);

  const rows = (data ?? []) as Array<{
    id: string;
    status: string;
    priority: string | null;
    delivery_zone: string | null;
    queue_score: number;
    wait_minutes: number;
    dispatch_escalated_at: string | null;
  }>;

  const total = rows.length;
  if (total === 0) {
    return {
      location_id: locationId,
      total_waiting: 0,
      avg_wait_minutes: 0,
      max_wait_minutes: 0,
      high_priority_count: 0,
      escalated_count: 0,
      by_status: {},
      by_zone: {},
      by_priority: {},
      score_buckets: { low: 0, medium: 0, high: 0, critical: 0 },
    };
  }

  const waitTimes      = rows.map(r => Number(r.wait_minutes));
  const avg_wait       = waitTimes.reduce((s, v) => s + v, 0) / total;
  const max_wait       = Math.max(...waitTimes);

  const by_status: Record<string, number>   = {};
  const by_zone: Record<string, number>     = {};
  const by_priority: Record<string, number> = {};
  const score_buckets = { low: 0, medium: 0, high: 0, critical: 0 };
  let high_priority_count = 0;
  let escalated_count     = 0;

  for (const r of rows) {
    const status   = r.status ?? 'unknown';
    const zone     = r.delivery_zone ?? 'unknown';
    const prio     = r.priority ?? 'normal';
    const score    = Number(r.queue_score);

    by_status[status]     = (by_status[status] ?? 0) + 1;
    by_zone[zone]         = (by_zone[zone] ?? 0) + 1;
    by_priority[prio]     = (by_priority[prio] ?? 0) + 1;

    if (score >= 50) high_priority_count++;
    if (r.dispatch_escalated_at) escalated_count++;

    if (score < 25)       score_buckets.low++;
    else if (score < 50)  score_buckets.medium++;
    else if (score < 75)  score_buckets.high++;
    else                  score_buckets.critical++;
  }

  return {
    location_id:         locationId,
    total_waiting:       total,
    avg_wait_minutes:    Math.round(avg_wait * 10) / 10,
    max_wait_minutes:    Math.round(max_wait * 10) / 10,
    high_priority_count,
    escalated_count,
    by_status,
    by_zone,
    by_priority,
    score_buckets,
  };
}
