/**
 * lib/delivery/ops-recommendations.ts
 *
 * Phase 342 — Ops Decision Support Engine
 *
 * Scannt alle laufenden Delivery-Signale und generiert priorisierte Empfehlungen
 * für Admins:
 *  1. generateRecommendations(locationId) — Evaluiert 6 Regeln, speichert neue Empfehlungen
 *  2. getRecommendationsDashboard(locationId) — Aktive + gelöste Empfehlungen + KPIs
 *  3. resolveRecommendation(id, locationId, status) — Empfehlung annehmen/ablehnen
 *  4. runRecsAllLocations() — Cron-Batch
 *  5. pruneOldRecommendations(daysOld) — Cleanup
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

export type RecoType =
  | 'pending_orders_stale'
  | 'driver_shortage'
  | 'sla_breach_risk'
  | 'revenue_below_target'
  | 'surge_pricing_activate'
  | 'driver_offline_on_tour';

export type RecoPriority = 'critical' | 'high' | 'normal' | 'low';

export interface OpsRecommendation {
  id: string;
  location_id: string;
  type: RecoType;
  priority: RecoPriority;
  title: string;
  body: string;
  action_label: string | null;
  action_type: string | null;
  action_params: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'dismissed' | 'expired' | 'auto_resolved';
  impact_estimate: string | null;
  data_snapshot: Record<string, unknown>;
  created_at: string;
  resolved_at: string | null;
  expires_at: string;
}

interface RecoInput {
  type: RecoType;
  priority: RecoPriority;
  title: string;
  body: string;
  action_label?: string;
  action_type?: string;
  action_params?: Record<string, unknown>;
  impact_estimate?: string;
  data_snapshot?: Record<string, unknown>;
}

/** Dedup-Schutz: Erstellt Empfehlung nur wenn kein gleiches type + pending in letzter Stunde */
async function insertIfNew(
  sb: ReturnType<typeof createServiceClient>,
  locationId: string,
  input: RecoInput,
): Promise<void> {
  const { data: existing } = await sb
    .from('ops_recommendations')
    .select('id')
    .eq('location_id', locationId)
    .eq('type', input.type)
    .eq('status', 'pending')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .limit(1);

  if (existing && existing.length > 0) return;

  await sb.from('ops_recommendations').insert({
    location_id: locationId,
    type: input.type,
    priority: input.priority,
    title: input.title,
    body: input.body,
    action_label: input.action_label ?? null,
    action_type: input.action_type ?? null,
    action_params: input.action_params ?? {},
    impact_estimate: input.impact_estimate ?? null,
    data_snapshot: input.data_snapshot ?? {},
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  });
}

export async function generateRecommendations(locationId: string): Promise<void> {
  const sb = createServiceClient();
  const now = new Date().toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Abgelaufene pending-Empfehlungen markieren
  await sb
    .from('ops_recommendations')
    .update({ status: 'expired', resolved_at: now })
    .eq('location_id', locationId)
    .eq('status', 'pending')
    .lt('expires_at', now);

  // ── Regel 1: Veraltete unzugewiesene Bestellungen (>25 Min) ──────────────
  const { data: staleOrders } = await sb
    .from('customer_orders')
    .select('id')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .in('status', ['neu', 'bestellt'])
    .lt('created_at', new Date(Date.now() - 25 * 60 * 1000).toISOString());

  if (staleOrders && staleOrders.length >= 2) {
    await insertIfNew(sb, locationId, {
      type: 'pending_orders_stale',
      priority: 'critical',
      title: `${staleOrders.length} Bestellungen seit >25 Min ohne Fahrer`,
      body: `${staleOrders.length} Lieferbestellungen warten mehr als 25 Minuten auf Zuweisung. SLA-Breach droht.`,
      action_label: 'Dispatch öffnen',
      action_type: 'navigate',
      action_params: { path: '/dispatch' },
      impact_estimate: 'SLA-Breach-Risiko kritisch',
      data_snapshot: { stale_count: staleOrders.length },
    });
  }

  // ── Regel 2: Fahrermangel ─────────────────────────────────────────────────
  const [{ data: idleDrivers }, { data: waitingOrders }] = await Promise.all([
    sb
      .from('driver_status')
      .select('driver_id')
      .eq('location_id', locationId)
      .eq('status', 'idle'),
    sb
      .from('customer_orders')
      .select('id')
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .in('status', ['neu', 'bestellt', 'in_zubereitung']),
  ]);

  const idleCount = idleDrivers?.length ?? 0;
  const pendingCount = waitingOrders?.length ?? 0;

  if (pendingCount > 0 && idleCount === 0) {
    await insertIfNew(sb, locationId, {
      type: 'driver_shortage',
      priority: 'critical',
      title: 'Kein freier Fahrer verfügbar',
      body: `${pendingCount} Bestellung(en) warten, aber kein Fahrer ist frei. Backup-Fahrer sofort benachrichtigen.`,
      action_label: 'Fahrer-Übersicht',
      action_type: 'navigate',
      action_params: { path: '/lieferdienst' },
      impact_estimate: 'Alle Lieferungen blockiert',
      data_snapshot: { idle_drivers: 0, pending_orders: pendingCount },
    });
  } else if (pendingCount > idleCount * 3 && idleCount < 3) {
    await insertIfNew(sb, locationId, {
      type: 'driver_shortage',
      priority: 'high',
      title: `Fahrermangel: ${pendingCount} Bestellungen, nur ${idleCount} freie Fahrer`,
      body: `Verhältnis Bestellungen/Fahrer kritisch (${pendingCount}:${idleCount}). Zusätzliche Fahrer aktivieren.`,
      action_label: 'Fahrer-Übersicht',
      action_type: 'navigate',
      action_params: { path: '/lieferdienst' },
      impact_estimate: `~${Math.max(0, pendingCount - idleCount * 2)} Bestellungen ohne Abdeckung`,
      data_snapshot: { idle_drivers: idleCount, pending_orders: pendingCount },
    });
  }

  // ── Regel 3: SLA-Verstoßrate letzte Stunde ───────────────────────────────
  const { data: recentDeliveries } = await sb
    .from('customer_orders')
    .select('eta_latest, geliefert_am')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .eq('status', 'geliefert')
    .gte('geliefert_am', oneHourAgo)
    .not('eta_latest', 'is', null)
    .not('geliefert_am', 'is', null);

  if (recentDeliveries && recentDeliveries.length >= 5) {
    const breaches = recentDeliveries.filter(
      (o) => o.geliefert_am > o.eta_latest,
    );
    const breachRate = breaches.length / recentDeliveries.length;

    if (breachRate > 0.3) {
      await insertIfNew(sb, locationId, {
        type: 'sla_breach_risk',
        priority: 'high',
        title: `${Math.round(breachRate * 100)}% SLA-Verstoßrate in letzter Stunde`,
        body: `${breaches.length} von ${recentDeliveries.length} Lieferungen haben die ETA überschritten. Küchen- oder Routing-Problem prüfen.`,
        impact_estimate: `${Math.round(breachRate * 100)}% Verstoßrate`,
        data_snapshot: {
          breach_rate: breachRate,
          total: recentDeliveries.length,
          breaches: breaches.length,
        },
      });
    }
  }

  // ── Regel 4: Umsatz unter Schicht-Pace ───────────────────────────────────
  const { data: shiftGoal } = await sb
    .from('shift_goals')
    .select('target_revenue_eur, shift_hours_total, shift_start_hour')
    .eq('location_id', locationId)
    .maybeSingle();

  if (shiftGoal) {
    const shiftStart = new Date();
    shiftStart.setUTCHours(shiftGoal.shift_start_hour as number, 0, 0, 0);
    const elapsedH = Math.max(0, (Date.now() - shiftStart.getTime()) / 3_600_000);
    const pace = Math.min(elapsedH / (shiftGoal.shift_hours_total as number), 1);

    if (pace > 0.2) {
      const { data: revData } = await sb
        .from('customer_orders')
        .select('total_price')
        .eq('location_id', locationId)
        .in('status', ['geliefert', 'abgeschlossen'])
        .gte('created_at', shiftStart.toISOString());

      const actual = (revData ?? []).reduce(
        (s, r) => s + (Number(r.total_price) || 0),
        0,
      );
      const expected = (shiftGoal.target_revenue_eur as number) * pace;

      if (actual < expected * 0.7) {
        await insertIfNew(sb, locationId, {
          type: 'revenue_below_target',
          priority: 'high',
          title: `Umsatz ${Math.round((actual / expected) * 100)}% unter Schicht-Pace`,
          body: `Aktuell €${actual.toFixed(0)} bei erwartetem Pace von €${expected.toFixed(0)}. Marketing- oder Pricing-Maßnahme empfohlen.`,
          action_label: 'Dynamic Pricing prüfen',
          action_type: 'navigate',
          action_params: { path: '/delivery/dynamic-pricing' },
          impact_estimate: `€${(expected - actual).toFixed(0)} Umsatz-Gap`,
          data_snapshot: { actual_eur: actual, expected_eur: expected, pace },
        });
      }
    }
  }

  // ── Regel 5: Aktiver Surge ohne Dynamic Pricing ───────────────────────────
  const [{ data: surgeAlerts }, { data: pricingCfg }] = await Promise.all([
    sb
      .from('demand_surge_v2_alerts')
      .select('id, severity')
      .eq('location_id', locationId)
      .eq('status', 'active')
      .in('severity', ['elevated', 'high', 'extreme'])
      .limit(1),
    sb
      .from('dynamic_pricing_configs')
      .select('is_enabled')
      .eq('location_id', locationId)
      .maybeSingle(),
  ]);

  if (surgeAlerts && surgeAlerts.length > 0 && !(pricingCfg?.is_enabled)) {
    const severity = surgeAlerts[0].severity as string;
    await insertIfNew(sb, locationId, {
      type: 'surge_pricing_activate',
      priority: 'high',
      title: 'Surge-Alert aktiv — Dynamic Pricing ist deaktiviert',
      body: `Surge-Alarm (${severity}) erkannt, aber Dynamic Pricing ist aus. Jetzt aktivieren für höhere Einnahmen.`,
      action_label: 'Dynamic Pricing aktivieren',
      action_type: 'navigate',
      action_params: { path: '/delivery/dynamic-pricing' },
      impact_estimate: 'Potenzielle Mehrumsatz durch Surge-Multiplikator',
      data_snapshot: { surge_severity: severity },
    });
  }

  // ── Regel 6: Fahrer offline während aktiver Tour ──────────────────────────
  const { data: activeBatches } = await sb
    .from('mise_delivery_batches')
    .select('id, driver_id')
    .eq('location_id', locationId)
    .in('state', ['assigned', 'at_restaurant', 'delivering']);

  if (activeBatches && activeBatches.length > 0) {
    const driverIds = [
      ...new Set(
        activeBatches.map((b) => b.driver_id as string).filter(Boolean),
      ),
    ];

    if (driverIds.length > 0) {
      const { data: offlineDrivers } = await sb
        .from('driver_status')
        .select('driver_id, last_seen')
        .in('driver_id', driverIds)
        .lt(
          'last_seen',
          new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        );

      if (offlineDrivers && offlineDrivers.length > 0) {
        await insertIfNew(sb, locationId, {
          type: 'driver_offline_on_tour',
          priority: 'critical',
          title: `${offlineDrivers.length} Fahrer seit >10 Min offline mit aktiver Tour`,
          body: `${offlineDrivers.length} Fahrer haben aktive Touren, aber kein GPS-Signal mehr gesendet. Sofort kontaktieren.`,
          action_label: 'Dispatch öffnen',
          action_type: 'navigate',
          action_params: { path: '/dispatch' },
          impact_estimate: 'Lieferungen blockiert, Kunden ohne ETA-Update',
          data_snapshot: { offline_count: offlineDrivers.length },
        });
      }
    }
  }
}

export async function getRecommendationsDashboard(locationId: string) {
  const sb = createServiceClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: active }, { data: resolved }] = await Promise.all([
    sb
      .from('ops_recommendations')
      .select('*')
      .eq('location_id', locationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(30),
    sb
      .from('ops_recommendations')
      .select('*')
      .eq('location_id', locationId)
      .neq('status', 'pending')
      .gte('created_at', since24h)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  const priorityRank: Record<string, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };
  const sorted = (active ?? []).sort(
    (a, b) =>
      (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9),
  );

  return {
    active: sorted as OpsRecommendation[],
    recentResolved: (resolved ?? []) as OpsRecommendation[],
    stats: {
      totalActive: (active ?? []).length,
      criticalCount: (active ?? []).filter((r) => r.priority === 'critical')
        .length,
      highCount: (active ?? []).filter((r) => r.priority === 'high').length,
      resolvedToday: (resolved ?? []).filter((r) => r.status === 'accepted')
        .length,
    },
  };
}

export async function resolveRecommendation(
  id: string,
  locationId: string,
  status: 'accepted' | 'dismissed',
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('ops_recommendations')
    .update({ status, resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('location_id', locationId);
}

export async function runRecsAllLocations(): Promise<{
  locations: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('is_active', true);

  if (!locations) return { locations: 0, errors: 0 };

  const results = await Promise.allSettled(
    locations.map((l) => generateRecommendations(l.id as string)),
  );

  return {
    locations: locations.length,
    errors: results.filter((r) => r.status === 'rejected').length,
  };
}

export async function pruneOldRecommendations(daysOld = 7): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_ops_recommendations', {
    days_old: daysOld,
  });
  return (data as number) ?? 0;
}
