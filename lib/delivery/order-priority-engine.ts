/**
 * lib/delivery/order-priority-engine.ts
 *
 * KI-Auftrags-Priorisierungs-Engine — Phase 362.
 *
 * Persistiert Prioritäts-Scores in order_priority_scores (Migration 176).
 * Löst Client-Side-Berechnung ab: jetzt Backend-seitig, historisierbar,
 * für Analytics und Dispatch-Learning verwendbar.
 *
 * API:
 *   scoreAndPersistOrder(input)          — Score berechnen + speichern
 *   scoreAndPersistPendingOrders(locId)  — Batch: alle wartenden Bestellungen
 *   getOrderPriorityDashboard(locId)     — Dashboard: aktuelle + historische Scores
 *   getOrderScoreHistory(locId, hours)   — Score-Verlauf letzte N Stunden
 *   recordDispatchOutcome(orderId, outcome) — Outcome nach Dispatch markieren
 *   pruneOrderPriorityScores(daysOld)    — via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface PriorityScoreInput {
  orderId:           string;
  locationId:        string;
  orderStatus:       string;
  orderPriority:     string | null;
  deliveryZone:      string | null;
  createdAt:         string;
  dispatchAttempts:  number;
  escalatedAt:       string | null;
  priorityBoost:     number;
}

export interface PriorityScoreResult {
  orderId:          string;
  priorityScore:    number;
  ptsPriority:      number;
  ptsStatus:        number;
  ptsZone:          number;
  ptsWait:          number;
  ptsEscalation:    number;
  ptsBoost:         number;
  waitMinutes:      number;
  wasEscalated:     boolean;
  label:            'KRITISCH' | 'HOCH' | 'MITTEL' | 'NIEDRIG';
}

export interface OrderPriorityRow {
  id:             string;
  orderId:        string;
  locationId:     string;
  scoredAt:       string;
  priorityScore:  number;
  ptsPriority:    number;
  ptsStatus:      number;
  ptsZone:        number;
  ptsWait:        number;
  ptsEscalation:  number;
  ptsBoost:       number;
  orderStatus:    string | null;
  orderPriority:  string | null;
  deliveryZone:   string | null;
  waitMinutes:    number | null;
  dispatchAttempts: number | null;
  wasEscalated:   boolean;
  dispatchOutcome: string | null;
  label:          string;
}

export interface PriorityDashboard {
  activeOrders: OrderPriorityRow[];
  criticalCount: number;
  highCount: number;
  avgScore: number | null;
  maxWaitMin: number | null;
  lastUpdated: string;
}

// ─── Score-Berechnung ─────────────────────────────────────────────────────────

function computePriorityScore(input: PriorityScoreInput): PriorityScoreResult {
  const now = Date.now();
  const createdMs = new Date(input.createdAt).getTime();
  const waitMinutes = Math.max(0, (now - createdMs) / 60_000);

  // Priorität (0–40)
  const pMap: Record<string, number> = {
    express: 40,
    vip:     30,
    rush:    20,
    normal:  5,
  };
  const ptsPriority = pMap[input.orderPriority ?? 'normal'] ?? 5;

  // Küchenstatus (0–25)
  const sMap: Record<string, number> = {
    fertig:          25,
    in_zubereitung:  15,
    bestätigt:       8,
    neu:             3,
  };
  const ptsStatus = sMap[input.orderStatus] ?? 3;

  // Zone-Dringlichkeit (0–12): D=12 C=8 B=4 A=0
  const zMap: Record<string, number> = { D: 12, C: 8, B: 4, A: 0 };
  const ptsZone = zMap[input.deliveryZone ?? ''] ?? 4;

  // Wartezeit (0–15): +1 je 2 Minuten, max 15
  const ptsWait = Math.min(15, Math.floor(waitMinutes / 2));

  // Eskalation (0–20)
  const wasEscalated = input.dispatchAttempts >= 3 || input.escalatedAt !== null;
  const ptsEscalation = wasEscalated ? 20 : 0;

  // Admin-Boost (0–50)
  const ptsBoost = Math.min(50, Math.max(0, input.priorityBoost));

  const priorityScore = Math.min(
    100,
    ptsPriority + ptsStatus + ptsZone + ptsWait + ptsEscalation + ptsBoost,
  );

  const label: PriorityScoreResult['label'] =
    priorityScore >= 75 ? 'KRITISCH'
    : priorityScore >= 50 ? 'HOCH'
    : priorityScore >= 25 ? 'MITTEL'
    : 'NIEDRIG';

  return {
    orderId: input.orderId,
    priorityScore: Math.round(priorityScore * 100) / 100,
    ptsPriority,
    ptsStatus,
    ptsZone,
    ptsWait,
    ptsEscalation,
    ptsBoost,
    waitMinutes: Math.round(waitMinutes * 10) / 10,
    wasEscalated,
    label,
  };
}

// ─── Persistierung ────────────────────────────────────────────────────────────

export async function scoreAndPersistOrder(
  input: PriorityScoreInput,
): Promise<PriorityScoreResult> {
  const result = computePriorityScore(input);
  const sb = createServiceClient();

  await sb.from('order_priority_scores').insert({
    location_id:       input.locationId,
    order_id:          input.orderId,
    priority_score:    result.priorityScore,
    pts_priority:      result.ptsPriority,
    pts_status:        result.ptsStatus,
    pts_zone:          result.ptsZone,
    pts_wait:          result.ptsWait,
    pts_escalation:    result.ptsEscalation,
    pts_boost:         result.ptsBoost,
    order_status:      input.orderStatus,
    order_priority:    input.orderPriority,
    delivery_zone:     input.deliveryZone,
    wait_minutes:      result.waitMinutes,
    dispatch_attempts: input.dispatchAttempts,
    was_escalated:     result.wasEscalated,
  });

  return result;
}

export async function scoreAndPersistPendingOrders(
  locationId: string,
): Promise<{ scored: number; errors: number }> {
  const sb = createServiceClient();

  const { data: orders } = await sb
    .from('customer_orders')
    .select('id, status, priority, delivery_zone, created_at, dispatch_attempts, dispatch_escalated_at, dispatch_priority_boost')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig'])
    .order('created_at', { ascending: true });

  let scored = 0;
  let errors = 0;

  for (const order of orders ?? []) {
    try {
      await scoreAndPersistOrder({
        orderId:          order.id as string,
        locationId,
        orderStatus:      order.status as string,
        orderPriority:    (order.priority as string | null),
        deliveryZone:     (order.delivery_zone as string | null),
        createdAt:        order.created_at as string,
        dispatchAttempts: (order.dispatch_attempts as number) ?? 0,
        escalatedAt:      (order.dispatch_escalated_at as string | null),
        priorityBoost:    (order.dispatch_priority_boost as number) ?? 0,
      });
      scored++;
    } catch {
      errors++;
    }
  }

  return { scored, errors };
}

export async function scoreAndPersistAllLocations(): Promise<{
  locations: number;
  scored: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  let totalScored = 0;
  let totalErrors = 0;

  await Promise.allSettled(
    (locs ?? []).map(async (loc) => {
      const r = await scoreAndPersistPendingOrders(loc.id as string);
      totalScored += r.scored;
      totalErrors += r.errors;
    }),
  );

  return { locations: (locs ?? []).length, scored: totalScored, errors: totalErrors };
}

export async function recordDispatchOutcome(
  orderId: string,
  outcome: 'dispatched' | 'held' | 'escalated' | 'cancelled',
): Promise<void> {
  const sb = createServiceClient();
  // Letzten Score-Eintrag für diese Order updaten
  await sb
    .from('order_priority_scores')
    .update({ dispatch_outcome: outcome, outcome_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .is('dispatch_outcome', null)
    .order('scored_at', { ascending: false })
    .limit(1);
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function toLabel(score: number): string {
  if (score >= 75) return 'KRITISCH';
  if (score >= 50) return 'HOCH';
  if (score >= 25) return 'MITTEL';
  return 'NIEDRIG';
}

function mapRow(r: Record<string, unknown>): OrderPriorityRow {
  const score = Number(r.priority_score);
  return {
    id:              r.id as string,
    orderId:         r.order_id as string,
    locationId:      r.location_id as string,
    scoredAt:        r.scored_at as string,
    priorityScore:   score,
    ptsPriority:     Number(r.pts_priority),
    ptsStatus:       Number(r.pts_status),
    ptsZone:         Number(r.pts_zone),
    ptsWait:         Number(r.pts_wait),
    ptsEscalation:   Number(r.pts_escalation),
    ptsBoost:        Number(r.pts_boost),
    orderStatus:     (r.order_status as string | null),
    orderPriority:   (r.order_priority as string | null),
    deliveryZone:    (r.delivery_zone as string | null),
    waitMinutes:     r.wait_minutes != null ? Number(r.wait_minutes) : null,
    dispatchAttempts:(r.dispatch_attempts as number | null),
    wasEscalated:    Boolean(r.was_escalated),
    dispatchOutcome: (r.dispatch_outcome as string | null),
    label:           toLabel(score),
  };
}

export async function getOrderPriorityDashboard(
  locationId: string,
): Promise<PriorityDashboard> {
  const sb = createServiceClient();

  // Letzten Score je Order aus den letzten 4h
  const since = new Date(Date.now() - 4 * 60 * 60_000).toISOString();
  const { data: rows } = await sb
    .from('order_priority_scores')
    .select('*')
    .eq('location_id', locationId)
    .gte('scored_at', since)
    .is('dispatch_outcome', null)
    .order('priority_score', { ascending: false });

  // Deduplizieren: neuesten Score je order_id
  const byOrder = new Map<string, Record<string, unknown>>();
  for (const r of rows ?? []) {
    if (!byOrder.has(r.order_id as string)) {
      byOrder.set(r.order_id as string, r as Record<string, unknown>);
    }
  }

  const active = [...byOrder.values()].map(mapRow);
  const criticalCount = active.filter((r) => r.priorityScore >= 75).length;
  const highCount     = active.filter((r) => r.priorityScore >= 50 && r.priorityScore < 75).length;
  const avgScore      = active.length > 0
    ? Math.round(active.reduce((s, r) => s + r.priorityScore, 0) / active.length * 10) / 10
    : null;
  const maxWaitMin    = active.length > 0
    ? Math.max(...active.map((r) => r.waitMinutes ?? 0))
    : null;

  return {
    activeOrders: active,
    criticalCount,
    highCount,
    avgScore,
    maxWaitMin,
    lastUpdated: new Date().toISOString(),
  };
}

export async function getOrderScoreHistory(
  locationId: string,
  hours = 24,
): Promise<Array<{ hour: string; avgScore: number; count: number; criticalCount: number }>> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - hours * 60 * 60_000).toISOString();

  const { data: rows } = await sb
    .from('order_priority_scores')
    .select('scored_at, priority_score')
    .eq('location_id', locationId)
    .gte('scored_at', since)
    .order('scored_at', { ascending: true });

  // Stündliche Aggregation
  const buckets = new Map<string, { sum: number; count: number; critical: number }>();
  for (const r of rows ?? []) {
    const d = new Date(r.scored_at as string);
    const h = `${d.toISOString().slice(0, 13)}:00`;
    const bucket = buckets.get(h) ?? { sum: 0, count: 0, critical: 0 };
    bucket.sum   += Number(r.priority_score);
    bucket.count += 1;
    if (Number(r.priority_score) >= 75) bucket.critical += 1;
    buckets.set(h, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, { sum, count, critical }]) => ({
      hour,
      avgScore:      Math.round((sum / count) * 10) / 10,
      count,
      criticalCount: critical,
    }));
}

export async function pruneOrderPriorityScores(daysOld = 90): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_order_priority_scores', { days_old: daysOld });
  return { pruned: (data as number) ?? 0 };
}
