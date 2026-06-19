/**
 * lib/delivery/driver-score-trigger.ts
 *
 * Phase 258 — Fahrer-Bonus-Trigger Engine
 *
 * Löst automatisch Boni aus wenn ein Fahrer-Composite-Score (Phase 205)
 * eine konfigurierte Schwelle überschreitet.
 *
 * Bonus-Typen:
 *  flat_eur       — fester Euro-Betrag (z.B. +10 € wenn Score ≥ 80)
 *  provision_pct  — Prozent-Aufschlag auf Wochen-Umsatz (z.B. +5% wenn Score ≥ 90)
 *
 * Öffentliche API:
 *  evaluateScoreTriggersForLocation(locationId)  — Scan + Grant-Erstellung
 *  evaluateScoreTriggersAllLocations()           — Cron-Batch
 *  getScoreTriggerDashboard(locationId)          — Dashboard-Daten
 *  getTriggers(locationId)                       — Trigger-Configs laden
 *  createTrigger(input)                          — Neuen Trigger anlegen
 *  updateTrigger(triggerId, locationId, patch)   — Trigger bearbeiten
 *  deleteTrigger(triggerId, locationId)          — Trigger löschen
 *  updateGrantStatus(grantIds, status, locationId, resolvedEur?) — Approve/Pay/Cancel
 *  pruneOldGrants(days?)                         — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type BonusTriggerType = 'flat_eur' | 'provision_pct';
export type TriggerPeriod = 'week' | 'month';
export type GrantStatus = 'pending' | 'approved' | 'paid' | 'cancelled';

export interface ScoreBonusTrigger {
  id: string;
  locationId: string;
  label: string;
  scoreThreshold: number;
  bonusType: BonusTriggerType;
  bonusValue: number;
  period: TriggerPeriod;
  scorePeriod: TriggerPeriod;
  enabled: boolean;
  createdAt: string;
}

export interface ScoreBonusGrant {
  id: string;
  locationId: string;
  driverId: string;
  driverName: string | null;
  triggerId: string;
  triggerLabel: string | null;
  scoreThreshold: number | null;
  periodStart: string;
  compositeScore: number;
  bonusType: BonusTriggerType;
  bonusValue: number;
  resolvedEur: number | null;
  status: GrantStatus;
  autoTriggered: boolean;
  notes: string | null;
  evaluatedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
}

export interface EvaluateTriggersResult {
  locationId: string;
  driversScanned: number;
  triggersChecked: number;
  grantsCreated: number;
  grantsSkipped: number;
  errors: number;
}

export interface ScoreTriggerDashboard {
  triggers: ScoreBonusTrigger[];
  grants: ScoreBonusGrant[];
  kpis: {
    totalPending: number;
    totalApproved: number;
    totalPaid: number;
    pendingEur: number;
    approvedEur: number;
    paidEur: number;
    triggersActive: number;
  };
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function periodStart(period: TriggerPeriod): string {
  const now = new Date();
  if (period === 'week') {
    // ISO Wochenbeginn: Montag
    const day = now.getUTCDay(); // 0=So, 1=Mo, …
    const diff = (day + 6) % 7;  // Tage seit Montag
    const mon = new Date(now);
    mon.setUTCDate(now.getUTCDate() - diff);
    return mon.toISOString().slice(0, 10);
  }
  // month
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function resolvedEurFromGrant(bonusType: BonusTriggerType, bonusValue: number): number | null {
  // Für flat_eur kann der EUR-Betrag direkt gesetzt werden
  return bonusType === 'flat_eur' ? bonusValue : null;
}

// ── Trigger-Konfiguration ─────────────────────────────────────────────────────

export async function getTriggers(locationId: string): Promise<ScoreBonusTrigger[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('driver_score_bonus_triggers')
    .select('id, location_id, label, score_threshold, bonus_type, bonus_value, period, score_period, enabled, created_at')
    .eq('location_id', locationId)
    .order('score_threshold');
  if (error) throw error;
  return (data ?? []).map(mapTrigger);
}

export async function createTrigger(input: Omit<ScoreBonusTrigger, 'id' | 'createdAt'>): Promise<ScoreBonusTrigger> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('driver_score_bonus_triggers')
    .insert({
      location_id:     input.locationId,
      label:           input.label,
      score_threshold: input.scoreThreshold,
      bonus_type:      input.bonusType,
      bonus_value:     input.bonusValue,
      period:          input.period,
      score_period:    input.scorePeriod,
      enabled:         input.enabled,
    })
    .select('id, location_id, label, score_threshold, bonus_type, bonus_value, period, score_period, enabled, created_at')
    .single();
  if (error) throw error;
  return mapTrigger(data!);
}

export async function updateTrigger(
  triggerId: string,
  locationId: string,
  patch: Partial<Pick<ScoreBonusTrigger, 'label' | 'scoreThreshold' | 'bonusValue' | 'enabled'>>,
): Promise<ScoreBonusTrigger> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('driver_score_bonus_triggers')
    .update({
      ...(patch.label           !== undefined ? { label:           patch.label }           : {}),
      ...(patch.scoreThreshold  !== undefined ? { score_threshold: patch.scoreThreshold }  : {}),
      ...(patch.bonusValue      !== undefined ? { bonus_value:     patch.bonusValue }      : {}),
      ...(patch.enabled         !== undefined ? { enabled:         patch.enabled }         : {}),
    })
    .eq('id', triggerId)
    .eq('location_id', locationId)
    .select('id, location_id, label, score_threshold, bonus_type, bonus_value, period, score_period, enabled, created_at')
    .single();
  if (error) throw error;
  return mapTrigger(data!);
}

export async function deleteTrigger(triggerId: string, locationId: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('driver_score_bonus_triggers')
    .delete()
    .eq('id', triggerId)
    .eq('location_id', locationId);
  if (error) throw error;
}

// ── Evaluation ─────────────────────────────────────────────────────────────────

export async function evaluateScoreTriggersForLocation(
  locationId: string,
): Promise<EvaluateTriggersResult> {
  const sb = createServiceClient();
  const result: EvaluateTriggersResult = {
    locationId,
    driversScanned: 0,
    triggersChecked: 0,
    grantsCreated: 0,
    grantsSkipped: 0,
    errors: 0,
  };

  // Aktive Trigger laden
  const { data: triggers, error: trigErr } = await sb
    .from('driver_score_bonus_triggers')
    .select('id, score_threshold, bonus_type, bonus_value, period, score_period, label')
    .eq('location_id', locationId)
    .eq('enabled', true);
  if (trigErr || !triggers?.length) return result;

  // Für jeden Trigger: aktuelle Scores laden
  for (const trigger of triggers) {
    result.triggersChecked++;
    const pStart = periodStart(trigger.score_period as TriggerPeriod);

    // Fahrer laden die den Score-Schwellenwert erreicht oder überschritten haben
    const { data: scores, error: scoreErr } = await sb
      .from('driver_composite_scores')
      .select('driver_id, composite_score, period_start')
      .eq('location_id', locationId)
      .eq('period', trigger.score_period)
      .eq('period_start', pStart)
      .gte('composite_score', trigger.score_threshold);

    if (scoreErr) {
      result.errors++;
      continue;
    }

    if (!scores?.length) continue;

    // Fahrer-Namen aus mise_drivers nachladen (batch)
    const driverIds = scores.map((s) => s.driver_id as string);
    const { data: driverRows } = await sb
      .from('mise_drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .in('id', driverIds);
    const nameMap = new Map((driverRows ?? []).map((d) => [d.id as string, d.name as string | null]));

    for (const score of scores) {
      result.driversScanned++;
      const grantPStart = periodStart(trigger.period as TriggerPeriod);

      const { error: upsertErr } = await sb
        .from('driver_score_bonus_grants')
        .upsert({
          location_id:    locationId,
          driver_id:      score.driver_id,
          driver_name:    nameMap.get(score.driver_id as string) ?? null,
          trigger_id:     trigger.id,
          period_start:   grantPStart,
          composite_score: score.composite_score,
          bonus_type:     trigger.bonus_type,
          bonus_value:    trigger.bonus_value,
          resolved_eur:   resolvedEurFromGrant(trigger.bonus_type as BonusTriggerType, Number(trigger.bonus_value)),
          status:         'pending',
          auto_triggered: true,
        }, { onConflict: 'driver_id,trigger_id,period_start', ignoreDuplicates: true });

      if (upsertErr) {
        result.errors++;
      } else {
        result.grantsCreated++;
      }
    }
  }

  return result;
}

export async function evaluateScoreTriggersAllLocations(): Promise<{
  locations: number;
  grantsCreated: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('active', true).limit(20);
  let totalGrants = 0;
  let totalErrors = 0;

  for (const loc of locs ?? []) {
    const r = await evaluateScoreTriggersForLocation(loc.id as string).catch(() => null);
    if (r) {
      totalGrants += r.grantsCreated;
      totalErrors += r.errors;
    }
  }

  return {
    locations:    (locs ?? []).length,
    grantsCreated: totalGrants,
    errors:       totalErrors,
  };
}

// ── Grants abrufen ────────────────────────────────────────────────────────────

export async function getGrants(
  locationId: string,
  options?: { status?: GrantStatus; days?: number; limit?: number },
): Promise<ScoreBonusGrant[]> {
  const sb    = createServiceClient();
  const days  = options?.days ?? 60;
  const limit = options?.limit ?? 200;
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  let q = sb
    .from('v_score_bonus_grants')
    .select('id, location_id, driver_id, driver_name, trigger_id, trigger_label, score_threshold, period_start, composite_score, bonus_type, bonus_value, resolved_eur, status, auto_triggered, notes, evaluated_at, approved_at, paid_at')
    .eq('location_id', locationId)
    .gte('period_start', since)
    .order('evaluated_at', { ascending: false })
    .limit(limit);

  if (options?.status) q = q.eq('status', options.status);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapGrant);
}

export async function getScoreTriggerDashboard(locationId: string): Promise<ScoreTriggerDashboard> {
  const [triggers, grants] = await Promise.all([
    getTriggers(locationId),
    getGrants(locationId, { days: 60 }),
  ]);

  const flatEurGrant = (g: ScoreBonusGrant) => g.bonusType === 'flat_eur' ? g.bonusValue : (g.resolvedEur ?? 0);

  const kpis = {
    triggersActive: triggers.filter((t) => t.enabled).length,
    totalPending:   grants.filter((g) => g.status === 'pending').length,
    totalApproved:  grants.filter((g) => g.status === 'approved').length,
    totalPaid:      grants.filter((g) => g.status === 'paid').length,
    pendingEur:     grants.filter((g) => g.status === 'pending').reduce((s, g) => s + flatEurGrant(g), 0),
    approvedEur:    grants.filter((g) => g.status === 'approved').reduce((s, g) => s + flatEurGrant(g), 0),
    paidEur:        grants.filter((g) => g.status === 'paid').reduce((s, g) => s + flatEurGrant(g), 0),
  };

  return { triggers, grants, kpis };
}

// ── Grant-Status-Updates ──────────────────────────────────────────────────────

export async function updateGrantStatus(
  grantIds: string[],
  status: 'approved' | 'paid' | 'cancelled',
  locationId: string,
  resolvedEur?: number,
): Promise<{ updated: number }> {
  if (!grantIds.length) return { updated: 0 };
  const sb = createServiceClient();
  const patch: Record<string, unknown> = { status };
  if (status === 'approved') patch.approved_at = new Date().toISOString();
  if (status === 'paid')     patch.paid_at     = new Date().toISOString();
  if (resolvedEur !== undefined) patch.resolved_eur = resolvedEur;

  const { data, error } = await sb
    .from('driver_score_bonus_grants')
    .update(patch)
    .in('id', grantIds)
    .eq('location_id', locationId)
    .select('id');
  if (error) throw error;
  return { updated: (data ?? []).length };
}

export async function pruneOldGrants(days = 90): Promise<{ deleted: number }> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('prune_old_score_grants', { p_days: days });
  if (error) throw error;
  return { deleted: Number(data ?? 0) };
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapTrigger(r: Record<string, unknown>): ScoreBonusTrigger {
  return {
    id:             r.id as string,
    locationId:     r.location_id as string,
    label:          r.label as string,
    scoreThreshold: Number(r.score_threshold),
    bonusType:      r.bonus_type as BonusTriggerType,
    bonusValue:     Number(r.bonus_value),
    period:         (r.period as TriggerPeriod) ?? 'week',
    scorePeriod:    (r.score_period as TriggerPeriod) ?? 'week',
    enabled:        Boolean(r.enabled),
    createdAt:      r.created_at as string,
  };
}

function mapGrant(r: Record<string, unknown>): ScoreBonusGrant {
  return {
    id:             r.id as string,
    locationId:     r.location_id as string,
    driverId:       r.driver_id as string,
    driverName:     r.driver_name as string | null,
    triggerId:      r.trigger_id as string,
    triggerLabel:   r.trigger_label as string | null,
    scoreThreshold: r.score_threshold !== null && r.score_threshold !== undefined ? Number(r.score_threshold) : null,
    periodStart:    r.period_start as string,
    compositeScore: Number(r.composite_score),
    bonusType:      r.bonus_type as BonusTriggerType,
    bonusValue:     Number(r.bonus_value),
    resolvedEur:    r.resolved_eur !== null && r.resolved_eur !== undefined ? Number(r.resolved_eur) : null,
    status:         r.status as GrantStatus,
    autoTriggered:  Boolean(r.auto_triggered),
    notes:          r.notes as string | null,
    evaluatedAt:    r.evaluated_at as string,
    approvedAt:     r.approved_at as string | null,
    paidAt:         r.paid_at as string | null,
  };
}
