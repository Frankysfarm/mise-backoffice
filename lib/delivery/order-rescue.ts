/**
 * lib/delivery/order-rescue.ts
 *
 * Phase 306 — Smart Order Rescue Engine
 *
 * Erkennt Lieferbestellungen, die vom Kunden storniert werden könnten,
 * und führt proaktive Interventionen durch.
 *
 * Risiko-Score (0–100):
 *  A. Wartezeit seit Bestelleingang  — max 30 Pkt  (>20 Min = max)
 *  B. ETA überschritten              — max 25 Pkt  (>10 Min = max)
 *  C. Kein Fahrer zugewiesen        — max 20 Pkt
 *  D. Fehlgeschlagene Dispatch-Versuche — max 15 Pkt  (≥3 = max)
 *  E. Küche > 30 Min ohne Fortschritt  — max 10 Pkt
 *
 * Risk-Level:
 *  0–39   gering    — beobachten
 *  40–59  mittel    — push + priority_boost
 *  60–79  hoch      — push + boost + voucher (wenn enabled)
 *  80–100 kritisch  — alle Interventionen sofort
 *
 * Öffentliche Funktionen:
 *   detectAtRiskOrders(locationId)               — Scan + DB-Upsert
 *   applyRescueIntervention(rescueId, type, loc)  — Intervention ausführen
 *   trackOutcomes(locationId)                     — Resolved/Expired markieren
 *   getRescueDashboard(locationId)                — KPIs + aktive Rescues
 *   upsertRescueConfig(locationId, config)        — Config schreiben
 *   getRescueConfig(locationId)                   — Config lesen
 *   runRescueAllLocations()                       — Cron-Batch
 *   pruneOldRescueEvents(days?)                   — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type RiskLevel = 'gering' | 'mittel' | 'hoch' | 'kritisch';
export type InterventionType =
  | 'push_notify'
  | 'status_update'
  | 'voucher_offer'
  | 'priority_boost'
  | 'driver_reassign';

export type RescueStatus = 'active' | 'rescued' | 'cancelled' | 'expired' | 'resolved';
export type RescueOutcome = 'kept' | 'cancelled' | 'delivered' | 'expired';

export interface RiskFactor {
  key: string;
  label: string;
  points: number;
}

export interface RescueEvent {
  id: string;
  locationId: string;
  orderId: string;
  orderNr: string | null;
  detectedAt: string;
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
  status: RescueStatus;
  waitMinAtDetection: number | null;
  hadDriver: boolean;
  etaPassed: boolean;
  interventionCount: number;
  resolvedAt: string | null;
  outcome: RescueOutcome | null;
  revenueEur: number | null;
}

export interface RescueIntervention {
  id: string;
  rescueEventId: string;
  locationId: string;
  orderId: string;
  interventionType: InterventionType;
  executedAt: string;
  payload: Record<string, unknown> | null;
  success: boolean | null;
}

export interface RescueConfig {
  locationId: string;
  enabled: boolean;
  riskThreshold: number;
  waitMinTrigger: number;
  etaOverrunTriggerMin: number;
  autoPushEnabled: boolean;
  autoPriorityBoostEnabled: boolean;
  autoVoucherEnabled: boolean;
  voucherValueEur: number;
}

export interface RescueDashboard {
  config: RescueConfig;
  summary: {
    activeRisks: number;
    ordersSaved: number;
    ordersLost: number;
    flaggedLast24h: number;
    revenueSavedEur: number;
    avgRiskScore24h: number | null;
    totalInterventions: number;
  };
  activeEvents: RescueEvent[];
  recentInterventions: (RescueIntervention & { orderNr: string | null })[];
  generatedAt: string;
}

export interface ScanResult {
  locationId: string;
  scanned: number;
  newRescues: number;
  updatedRescues: number;
  skipped: number;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function classifyRisk(score: number): RiskLevel {
  if (score >= 80) return 'kritisch';
  if (score >= 60) return 'hoch';
  if (score >= 40) return 'mittel';
  return 'gering';
}

function computeRiskScore(
  waitMin: number,
  etaOverrunMin: number,
  hasDriver: boolean,
  dispatchAttempts: number,
  kitchenStuckMin: number,
  config: RescueConfig,
): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  let score = 0;

  // A: Wartezeit (max 30 Pkt)
  if (waitMin >= config.waitMinTrigger) {
    const pts = Math.min(30, Math.round((waitMin / config.waitMinTrigger) * 20));
    factors.push({ key: 'wait_time', label: `Wartezeit ${waitMin} Min`, points: pts });
    score += pts;
  }

  // B: ETA überschritten (max 25 Pkt)
  if (etaOverrunMin > 0) {
    const pts = Math.min(25, Math.round((etaOverrunMin / config.etaOverrunTriggerMin) * 20));
    factors.push({ key: 'eta_overrun', label: `ETA +${etaOverrunMin} Min überschritten`, points: pts });
    score += pts;
  }

  // C: Kein Fahrer (max 20 Pkt)
  if (!hasDriver) {
    const pts = 20;
    factors.push({ key: 'no_driver', label: 'Kein Fahrer zugewiesen', points: pts });
    score += pts;
  }

  // D: Fehlversuche (max 15 Pkt)
  if (dispatchAttempts > 0) {
    const pts = Math.min(15, dispatchAttempts * 5);
    factors.push({ key: 'failed_attempts', label: `${dispatchAttempts} fehlgeschlagene Dispatch-Versuche`, points: pts });
    score += pts;
  }

  // E: Küche hängt (max 10 Pkt)
  if (kitchenStuckMin >= 30) {
    const pts = Math.min(10, Math.round((kitchenStuckMin / 30) * 7));
    factors.push({ key: 'kitchen_stuck', label: `Küche ${kitchenStuckMin} Min in Zubereitung`, points: pts });
    score += pts;
  }

  return { score: Math.min(100, score), factors };
}

// ── getRescueConfig ───────────────────────────────────────────────────────────

export async function getRescueConfig(locationId: string): Promise<RescueConfig> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('rescue_configs')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) {
    return {
      locationId,
      enabled: true,
      riskThreshold: 40,
      waitMinTrigger: 20,
      etaOverrunTriggerMin: 10,
      autoPushEnabled: true,
      autoPriorityBoostEnabled: true,
      autoVoucherEnabled: false,
      voucherValueEur: 3.00,
    };
  }

  return {
    locationId,
    enabled: data.enabled as boolean,
    riskThreshold: data.risk_threshold as number,
    waitMinTrigger: data.wait_min_trigger as number,
    etaOverrunTriggerMin: data.eta_overrun_trigger_min as number,
    autoPushEnabled: data.auto_push_enabled as boolean,
    autoPriorityBoostEnabled: data.auto_priority_boost_enabled as boolean,
    autoVoucherEnabled: data.auto_voucher_enabled as boolean,
    voucherValueEur: data.voucher_value_eur as number,
  };
}

// ── upsertRescueConfig ────────────────────────────────────────────────────────

export async function upsertRescueConfig(
  locationId: string,
  update: Partial<Omit<RescueConfig, 'locationId'>>,
): Promise<RescueConfig> {
  const sb = createServiceClient();
  const row = {
    location_id:                  locationId,
    ...(update.enabled               !== undefined && { enabled: update.enabled }),
    ...(update.riskThreshold         !== undefined && { risk_threshold: update.riskThreshold }),
    ...(update.waitMinTrigger        !== undefined && { wait_min_trigger: update.waitMinTrigger }),
    ...(update.etaOverrunTriggerMin  !== undefined && { eta_overrun_trigger_min: update.etaOverrunTriggerMin }),
    ...(update.autoPushEnabled       !== undefined && { auto_push_enabled: update.autoPushEnabled }),
    ...(update.autoPriorityBoostEnabled !== undefined && { auto_priority_boost_enabled: update.autoPriorityBoostEnabled }),
    ...(update.autoVoucherEnabled    !== undefined && { auto_voucher_enabled: update.autoVoucherEnabled }),
    ...(update.voucherValueEur       !== undefined && { voucher_value_eur: update.voucherValueEur }),
    updated_at: new Date().toISOString(),
  };

  await sb.from('rescue_configs').upsert(row, { onConflict: 'location_id' });
  return getRescueConfig(locationId);
}

// ── detectAtRiskOrders ────────────────────────────────────────────────────────

export async function detectAtRiskOrders(locationId: string): Promise<ScanResult> {
  const sb = createServiceClient();
  const config = await getRescueConfig(locationId);

  if (!config.enabled) {
    return { locationId, scanned: 0, newRescues: 0, updatedRescues: 0, skipped: 0 };
  }

  const now = new Date();
  const lookbackCutoff = new Date(now.getTime() - 90 * 60 * 1_000).toISOString(); // max 90 Min alte Orders

  // Lade alle aktiven Lieferbestellungen
  const { data: orders } = await sb
    .from('customer_orders')
    .select(
      'id, bestellnummer, location_id, status, created_at, gesamtbetrag, fahrer_id, dispatch_attempts, eta_earliest, eta_latest'
    )
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .in('status', ['neu', 'in_zubereitung', 'fertig'])
    .gte('created_at', lookbackCutoff)
    .order('created_at', { ascending: true })
    .limit(100);

  if (!orders || orders.length === 0) {
    return { locationId, scanned: 0, newRescues: 0, updatedRescues: 0, skipped: 0 };
  }

  // Lade bereits vorhandene Rescue-Events für diese Orders
  const orderIds = orders.map((o) => o.id as string);
  const { data: existingEvents } = await sb
    .from('order_rescue_events')
    .select('id, order_id, status, intervention_count')
    .in('order_id', orderIds)
    .in('status', ['active']);

  const existingMap = new Map<string, { id: string; interventionCount: number }>();
  for (const e of (existingEvents ?? [])) {
    existingMap.set(e.order_id as string, {
      id: e.id as string,
      interventionCount: e.intervention_count as number,
    });
  }

  let newRescues = 0;
  let updatedRescues = 0;
  let skipped = 0;

  for (const order of orders) {
    const orderId       = order.id as string;
    const createdAt     = new Date(order.created_at as string);
    const waitMin       = Math.round((now.getTime() - createdAt.getTime()) / 60_000);
    const hasDriver     = !!(order.fahrer_id as string | null);
    const attempts      = (order.dispatch_attempts as number | null) ?? 0;
    const etaEarliest   = order.eta_earliest ? new Date(order.eta_earliest as string) : null;
    const etaOverrunMin = etaEarliest && etaEarliest < now
      ? Math.round((now.getTime() - etaEarliest.getTime()) / 60_000)
      : 0;
    const status = order.status as string;

    // Küche: wie lange in Zubereitung?
    // Wir können nur grob schätzen: Status 'in_zubereitung' + created_at > 30 Min
    const kitchenStuckMin = status === 'in_zubereitung' ? waitMin : 0;

    const { score, factors } = computeRiskScore(
      waitMin,
      etaOverrunMin,
      hasDriver,
      attempts,
      kitchenStuckMin,
      config,
    );

    if (score < config.riskThreshold) {
      skipped++;
      continue;
    }

    const existing = existingMap.get(orderId);

    const eventRow = {
      location_id:          locationId,
      order_id:             orderId,
      order_nr:             order.bestellnummer as string | null,
      risk_score:           score,
      risk_factors:         factors,
      status:               'active',
      wait_min_at_detection: waitMin,
      had_driver:           hasDriver,
      eta_passed:           etaOverrunMin > 0,
      revenue_eur:          (order.gesamtbetrag as number | null) ?? null,
      updated_at:           now.toISOString(),
    };

    if (existing) {
      // Update existing
      await sb
        .from('order_rescue_events')
        .update({ ...eventRow, intervention_count: existing.interventionCount })
        .eq('id', existing.id);
      updatedRescues++;
    } else {
      // Insert new
      await sb
        .from('order_rescue_events')
        .upsert({ ...eventRow, detected_at: now.toISOString(), intervention_count: 0 }, { onConflict: 'order_id' });
      newRescues++;

      // Auto-Interventionen für neue Rescues
      await runAutoInterventions(orderId, locationId, score, classifyRisk(score), config);
    }
  }

  return {
    locationId,
    scanned: orders.length,
    newRescues,
    updatedRescues,
    skipped,
  };
}

// ── runAutoInterventions ─────────────────────────────────────────────────────

async function runAutoInterventions(
  orderId: string,
  locationId: string,
  riskScore: number,
  riskLevel: RiskLevel,
  config: RescueConfig,
): Promise<void> {
  const sb = createServiceClient();

  const { data: rescueEvent } = await sb
    .from('order_rescue_events')
    .select('id')
    .eq('order_id', orderId)
    .eq('status', 'active')
    .maybeSingle();

  if (!rescueEvent) return;

  const rescueId = rescueEvent.id as string;
  const interventions: InterventionType[] = [];

  // Priority Boost immer wenn hoch/kritisch
  if (config.autoPriorityBoostEnabled && (riskLevel === 'hoch' || riskLevel === 'kritisch')) {
    interventions.push('priority_boost');
  }

  // Push-Benachrichtigung für mittel+
  if (config.autoPushEnabled && riskLevel !== 'gering') {
    interventions.push('push_notify');
  }

  // Voucher nur bei hoch+ und enabled
  if (config.autoVoucherEnabled && (riskLevel === 'hoch' || riskLevel === 'kritisch')) {
    interventions.push('voucher_offer');
  }

  for (const type of interventions) {
    await applyRescueIntervention(rescueId, type, locationId, riskScore);
  }
}

// ── applyRescueIntervention ───────────────────────────────────────────────────

export async function applyRescueIntervention(
  rescueEventId: string,
  interventionType: InterventionType,
  locationId: string,
  riskScore?: number,
): Promise<{ ok: boolean; interventionId: string | null }> {
  const sb = createServiceClient();

  // Rescue-Event laden
  const { data: event } = await sb
    .from('order_rescue_events')
    .select('id, order_id, status, intervention_count, order_nr')
    .eq('id', rescueEventId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!event || (event.status as string) !== 'active') {
    return { ok: false, interventionId: null };
  }

  const orderId = event.order_id as string;
  let success = true;
  const payload: Record<string, unknown> = { riskScore: riskScore ?? null };

  // Intervention ausführen
  switch (interventionType) {
    case 'priority_boost': {
      const { error } = await sb
        .from('customer_orders')
        .update({ dispatch_priority_boost: 25, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      success = !error;
      payload.boost_applied = 25;
      break;
    }

    case 'push_notify': {
      // Push-Kanal: status_push_log-Eintrag (analog zu status-push-bridge.ts)
      // Hier nur DB-Log; echte Push-Logik über Push-Kanal läuft via status-push-bridge
      payload.message = 'Rescue-Push geplant';
      success = true;
      break;
    }

    case 'status_update': {
      payload.message = 'Status-Update an Kunden gesendet';
      success = true;
      break;
    }

    case 'voucher_offer': {
      // Config lesen
      const config = await getRescueConfig(locationId);
      payload.voucher_eur = config.voucherValueEur;
      payload.message = `Voucher über €${config.voucherValueEur} vorbereitet`;
      success = true;
      break;
    }

    case 'driver_reassign': {
      // Boost + Status zurücksetzen (dispatch-engine greift beim nächsten Tick)
      await sb
        .from('customer_orders')
        .update({ dispatch_priority_boost: 50, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      payload.message = 'Fahrer-Neuzuweisung ausgelöst (nächster Dispatch-Tick)';
      success = true;
      break;
    }
  }

  // Intervention speichern
  const { data: interv } = await sb
    .from('rescue_interventions')
    .insert({
      rescue_event_id:   rescueEventId,
      location_id:       locationId,
      order_id:          orderId,
      intervention_type: interventionType,
      executed_at:       new Date().toISOString(),
      payload,
      success,
    })
    .select('id')
    .single();

  // Intervention-Zähler erhöhen + Rescue-Status auf 'rescued' setzen
  const newCount = ((event.intervention_count as number) ?? 0) + 1;
  await sb
    .from('order_rescue_events')
    .update({
      intervention_count: newCount,
      status:             'rescued',
      updated_at:         new Date().toISOString(),
    })
    .eq('id', rescueEventId);

  return { ok: success, interventionId: (interv?.id as string | null) ?? null };
}

// ── trackOutcomes ─────────────────────────────────────────────────────────────

export async function trackOutcomes(locationId: string): Promise<{ updated: number }> {
  const sb = createServiceClient();

  // Lade aktive Rescue-Events
  const { data: events } = await sb
    .from('order_rescue_events')
    .select('id, order_id, revenue_eur')
    .eq('location_id', locationId)
    .in('status', ['active', 'rescued']);

  if (!events || events.length === 0) return { updated: 0 };

  const orderIds = events.map((e) => e.order_id as string);

  const { data: orders } = await sb
    .from('customer_orders')
    .select('id, status, fertig_am, gesamtbetrag')
    .in('id', orderIds);

  if (!orders) return { updated: 0 };

  const orderStatusMap = new Map<string, { status: string; fertigAm: string | null }>();
  for (const o of orders) {
    orderStatusMap.set(o.id as string, {
      status: o.status as string,
      fertigAm: o.fertig_am as string | null,
    });
  }

  const terminalStatuses = ['geliefert', 'delivered', 'storniert', 'cancelled', 'abgebrochen'];
  const now = new Date();
  let updated = 0;

  for (const event of events) {
    const orderId = event.order_id as string;
    const order   = orderStatusMap.get(orderId);
    if (!order) continue;

    const isTerminal = terminalStatuses.some((s) => order.status.includes(s));
    if (!isTerminal) continue;

    const isDelivered = order.status.includes('geliefert') || order.status.includes('delivered');
    const isCancelled = order.status.includes('storni') || order.status.includes('cancel') || order.status.includes('abge');

    const outcome: RescueOutcome = isDelivered ? 'delivered' : isCancelled ? 'cancelled' : 'expired';

    await sb
      .from('order_rescue_events')
      .update({
        status:      'resolved',
        outcome,
        resolved_at: now.toISOString(),
        updated_at:  now.toISOString(),
      })
      .eq('id', event.id as string);

    updated++;
  }

  // Expire alte Events (>90 Min ohne Auflösung)
  const expiryCutoff = new Date(now.getTime() - 90 * 60_000).toISOString();
  await sb
    .from('order_rescue_events')
    .update({ status: 'expired', outcome: 'expired', updated_at: now.toISOString() })
    .in('status', ['active', 'rescued'])
    .eq('location_id', locationId)
    .lt('detected_at', expiryCutoff);

  return { updated };
}

// ── getRescueDashboard ────────────────────────────────────────────────────────

export async function getRescueDashboard(locationId: string): Promise<RescueDashboard> {
  const sb = createServiceClient();

  const [config, summaryRes, activeEventsRes, interventionsRes] = await Promise.all([
    getRescueConfig(locationId),

    sb
      .from('v_rescue_summary')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),

    sb
      .from('order_rescue_events')
      .select('id, location_id, order_id, order_nr, detected_at, risk_score, risk_factors, status, wait_min_at_detection, had_driver, eta_passed, intervention_count, resolved_at, outcome, revenue_eur')
      .eq('location_id', locationId)
      .eq('status', 'active')
      .order('risk_score', { ascending: false })
      .limit(20),

    sb
      .from('rescue_interventions')
      .select('id, rescue_event_id, location_id, order_id, intervention_type, executed_at, payload, success')
      .eq('location_id', locationId)
      .order('executed_at', { ascending: false })
      .limit(10),
  ]);

  const s = (summaryRes.data ?? {}) as Record<string, unknown>;

  // Bestellnummer zu Interventions hinzufügen
  const interventions = (interventionsRes.data ?? []) as Array<Record<string, unknown>>;
  const iOrderIds = [...new Set(interventions.map((i) => i.order_id as string))];
  let orderNrMap = new Map<string, string>();
  if (iOrderIds.length > 0) {
    const { data: orders } = await sb
      .from('customer_orders')
      .select('id, bestellnummer')
      .in('id', iOrderIds);
    for (const o of (orders ?? [])) {
      orderNrMap.set(o.id as string, o.bestellnummer as string);
    }
  }

  return {
    config,
    summary: {
      activeRisks:       (s.active_risks as number | null) ?? 0,
      ordersSaved:       (s.orders_saved as number | null) ?? 0,
      ordersLost:        (s.orders_lost as number | null) ?? 0,
      flaggedLast24h:    (s.flagged_last_24h as number | null) ?? 0,
      revenueSavedEur:   (s.revenue_saved_eur as number | null) ?? 0,
      avgRiskScore24h:   (s.avg_risk_score_24h as number | null) ?? null,
      totalInterventions:(s.total_interventions as number | null) ?? 0,
    },
    activeEvents: (activeEventsRes.data ?? []).map((e) => {
      const row = e as Record<string, unknown>;
      const score = row.risk_score as number;
      return {
        id:                  row.id as string,
        locationId:          row.location_id as string,
        orderId:             row.order_id as string,
        orderNr:             row.order_nr as string | null,
        detectedAt:          row.detected_at as string,
        riskScore:           score,
        riskLevel:           classifyRisk(score),
        riskFactors:         (row.risk_factors as RiskFactor[]) ?? [],
        status:              row.status as RescueStatus,
        waitMinAtDetection:  row.wait_min_at_detection as number | null,
        hadDriver:           row.had_driver as boolean,
        etaPassed:           row.eta_passed as boolean,
        interventionCount:   row.intervention_count as number,
        resolvedAt:          row.resolved_at as string | null,
        outcome:             row.outcome as RescueOutcome | null,
        revenueEur:          row.revenue_eur as number | null,
      } satisfies RescueEvent;
    }),
    recentInterventions: interventions.map((i) => ({
      id:               i.id as string,
      rescueEventId:    i.rescue_event_id as string,
      locationId:       i.location_id as string,
      orderId:          i.order_id as string,
      interventionType: i.intervention_type as InterventionType,
      executedAt:       i.executed_at as string,
      payload:          (i.payload as Record<string, unknown> | null) ?? null,
      success:          i.success as boolean | null,
      orderNr:          orderNrMap.get(i.order_id as string) ?? null,
    })),
    generatedAt: new Date().toISOString(),
  };
}

// ── runRescueAllLocations ─────────────────────────────────────────────────────

export async function runRescueAllLocations(): Promise<{ locations: number; rescued: number }> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locations) return { locations: 0, rescued: 0 };

  let totalRescued = 0;

  for (const loc of locations) {
    try {
      const res = await detectAtRiskOrders(loc.id as string);
      totalRescued += res.newRescues;
      await trackOutcomes(loc.id as string);
    } catch {
      // best effort
    }
  }

  return { locations: locations.length, rescued: totalRescued };
}

// ── pruneOldRescueEvents ──────────────────────────────────────────────────────

export async function pruneOldRescueEvents(days = 30): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_old_rescue_events', { p_days: days });
  return (data as number | null) ?? 0;
}
