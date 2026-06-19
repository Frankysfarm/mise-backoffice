/**
 * lib/delivery/notification-center.ts
 *
 * Delivery Admin Notification Center — Phase 254
 *
 * Scannt kritische Delivery-Events und erzeugt Admin-Notifications:
 *  - driver_delay              → Fahrerverzögerung >10 Min
 *  - order_cancelled           → Stornierungsrate >20% in letzter Stunde
 *  - eta_confidence_low        → ETA-Konfidenz <40% bei aktiven Touren
 *  - batch_stuck               → Batch seit >15 Min ohne Fahrerübernahme
 *  - no_driver_available       → Offene Bestellungen >10 Min ohne Zuweisung
 *  - high_cancellation_rate    → Stornierungsrate-Spitze
 *  - driver_offline_mid_tour   → Fahrer offline während aktiver Tour
 *  - sla_breach_imminent       → ETA überschritten, SLA-Verletzung droht
 *  - surge_active              → Surge-Zone aktiv (Info)
 *  - kitchen_backlog           → >5 fertige Bestellungen warten auf Dispatch
 *
 * Integration:
 *  - Cron: scanNotificationsAllLocations() jeden Tick
 *  - REST: GET+POST /api/delivery/admin/notifications
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'driver_delay'
  | 'order_cancelled'
  | 'eta_confidence_low'
  | 'batch_stuck'
  | 'no_driver_available'
  | 'high_cancellation_rate'
  | 'driver_offline_mid_tour'
  | 'sla_breach_imminent'
  | 'surge_active'
  | 'kitchen_backlog';

export type NotificationSeverity = 'info' | 'warning' | 'critical';

export interface AdminNotification {
  id: string;
  locationId: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  orderId: string | null;
  driverId: string | null;
  batchId: string | null;
  isRead: boolean;
  isDismissed: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  dedupKey: string | null;
  expiresAt: string | null;
  ageMinutes: number;
  createdAt: string;
}

export interface NotificationSummary {
  locationId: string;
  totalActive: number;
  totalUnread: number;
  criticalCount: number;
  warningCount: number;
  latestNotificationAt: string | null;
}

export interface ScanResult {
  locationId: string;
  created: number;
  skipped: number;
  errors: number;
}

export interface ScanAllResult {
  locations: number;
  totalCreated: number;
  totalSkipped: number;
  errors: number;
}

// ── Hilfsfunktion: Notification anlegen (idempotent via dedup_key) ────────────

async function upsertNotification(params: {
  locationId: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  orderId?: string;
  driverId?: string;
  batchId?: string;
  dedupKey: string;
  expiresInMin?: number;
}): Promise<'created' | 'skipped'> {
  const sb = createServiceClient();
  const expiresAt = params.expiresInMin
    ? new Date(Date.now() + params.expiresInMin * 60_000).toISOString()
    : null;

  const { error } = await sb.from('delivery_admin_notifications').upsert(
    {
      location_id: params.locationId,
      type: params.type,
      severity: params.severity,
      title: params.title,
      body: params.body,
      metadata: params.metadata ?? null,
      order_id: params.orderId ?? null,
      driver_id: params.driverId ?? null,
      batch_id: params.batchId ?? null,
      dedup_key: params.dedupKey,
      expires_at: expiresAt,
    },
    { onConflict: 'dedup_key', ignoreDuplicates: true },
  );

  return error ? 'skipped' : 'created';
}

// ── Scanner: Fahrerverzögerung >10 Min ────────────────────────────────────────

async function scanDriverDelays(locationId: string): Promise<{ created: number; skipped: number }> {
  const sb = createServiceClient();
  let created = 0;
  let skipped = 0;

  // Bestellungen mit eta_latest überschritten, Fahrer zugewiesen, noch nicht geliefert
  const { data: delayed } = await sb
    .from('customer_orders')
    .select('id, bestellnummer, mise_driver_id, eta_latest, mise_batch_id')
    .eq('typ', 'lieferung')
    .eq('tenant_id', locationId)
    .not('mise_driver_id', 'is', null)
    .not('eta_latest', 'is', null)
    .lt('eta_latest', new Date().toISOString())
    .in('status', ['in_delivery', 'assigned'])
    .limit(20);

  for (const order of delayed ?? []) {
    const delayMin = Math.round(
      (Date.now() - new Date(order.eta_latest as string).getTime()) / 60_000,
    );
    if (delayMin < 10) continue;

    const severity: NotificationSeverity = delayMin >= 20 ? 'critical' : 'warning';
    const dedupKey = `driver_delay:${order.id}:${Math.floor(delayMin / 10) * 10}`;

    const result = await upsertNotification({
      locationId,
      type: 'driver_delay',
      severity,
      title: `Fahrer ${delayMin} Min verspätet — #${order.bestellnummer}`,
      body: `Bestellung #${order.bestellnummer} ist seit ${delayMin} Minuten überfällig. Fahrer-ID: ${order.mise_driver_id}.`,
      metadata: { delay_min: delayMin, bestellnummer: order.bestellnummer },
      orderId: order.id as string,
      driverId: order.mise_driver_id as string,
      batchId: order.mise_batch_id as string | undefined,
      dedupKey,
      expiresInMin: 120,
    });

    result === 'created' ? created++ : skipped++;
  }

  return { created, skipped };
}

// ── Scanner: Batch stuck >15 Min ohne Fahrer ─────────────────────────────────

async function scanStuckBatches(locationId: string): Promise<{ created: number; skipped: number }> {
  const sb = createServiceClient();
  let created = 0;
  let skipped = 0;

  const cutoff = new Date(Date.now() - 15 * 60_000).toISOString();

  const { data: stuck } = await sb
    .from('mise_delivery_batches')
    .select('id, created_at, order_count')
    .eq('location_id', locationId)
    .eq('status', 'pending')
    .is('driver_id', null)
    .lt('created_at', cutoff)
    .limit(10);

  for (const batch of stuck ?? []) {
    const ageMin = Math.round(
      (Date.now() - new Date(batch.created_at as string).getTime()) / 60_000,
    );
    const dedupKey = `batch_stuck:${batch.id}:${Math.floor(ageMin / 15) * 15}`;

    const result = await upsertNotification({
      locationId,
      type: 'batch_stuck',
      severity: ageMin >= 30 ? 'critical' : 'warning',
      title: `Batch wartet ${ageMin} Min auf Fahrer (${batch.order_count} Bestellungen)`,
      body: `Dispatch-Batch seit ${ageMin} Minuten ohne Fahrer. Manuelle Zuweisung erforderlich.`,
      metadata: { age_min: ageMin, order_count: batch.order_count },
      batchId: batch.id as string,
      dedupKey,
      expiresInMin: 60,
    });

    result === 'created' ? created++ : skipped++;
  }

  return { created, skipped };
}

// ── Scanner: Offene Bestellungen >10 Min ohne Zuweisung ──────────────────────

async function scanNoDriverAvailable(locationId: string): Promise<{ created: number; skipped: number }> {
  const sb = createServiceClient();

  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();

  const { count } = await sb
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('typ', 'lieferung')
    .eq('tenant_id', locationId)
    .is('mise_driver_id', null)
    .is('mise_batch_id', null)
    .in('status', ['fertig', 'pending'])
    .lt('created_at', cutoff);

  if (!count || count < 2) return { created: 0, skipped: 0 };

  const dedupKey = `no_driver:${locationId}:${new Date().toISOString().slice(0, 13)}`;

  const result = await upsertNotification({
    locationId,
    type: 'no_driver_available',
    severity: count >= 5 ? 'critical' : 'warning',
    title: `${count} Bestellungen seit >10 Min ohne Fahrer`,
    body: `${count} Lieferbestellungen warten auf Zuweisung. Kein verfügbarer Fahrer oder Dispatch blockiert.`,
    metadata: { unassigned_count: count },
    dedupKey,
    expiresInMin: 30,
  });

  return { created: result === 'created' ? 1 : 0, skipped: result === 'skipped' ? 1 : 0 };
}

// ── Scanner: ETA-Konfidenz niedrig ───────────────────────────────────────────

async function scanEtaConfidenceLow(locationId: string): Promise<{ created: number; skipped: number }> {
  const sb = createServiceClient();
  let created = 0;
  let skipped = 0;

  const { data: lowConf } = await sb
    .from('eta_calibration_factors')
    .select('location_id, accuracy_score, total_predictions')
    .eq('location_id', locationId)
    .lt('accuracy_score', 0.4)
    .gte('total_predictions', 5)
    .limit(1);

  if (!lowConf?.length) return { created: 0, skipped: 0 };

  const factor = lowConf[0];
  const pct = Math.round((factor.accuracy_score as number) * 100);
  const dedupKey = `eta_conf_low:${locationId}:${new Date().toISOString().slice(0, 10)}`;

  const result = await upsertNotification({
    locationId,
    type: 'eta_confidence_low',
    severity: pct < 25 ? 'critical' : 'warning',
    title: `ETA-Konfidenz niedrig: ${pct}% Genauigkeit`,
    body: `ETA-Vorhersagen sind nur zu ${pct}% genau (Ziel: ≥70%). Kunden erhalten unzuverlässige Lieferzeiten.`,
    metadata: { accuracy_pct: pct, total_predictions: factor.total_predictions },
    dedupKey,
    expiresInMin: 240,
  });

  return { created: result === 'created' ? 1 : 0, skipped: result === 'skipped' ? 1 : 0 };
}

// ── Scanner: Hohe Stornierungsrate (letzte Stunde) ───────────────────────────

async function scanHighCancellationRate(locationId: string): Promise<{ created: number; skipped: number }> {
  const sb = createServiceClient();

  const since = new Date(Date.now() - 60 * 60_000).toISOString();

  const { count: totalCount } = await sb
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('typ', 'lieferung')
    .eq('tenant_id', locationId)
    .gte('created_at', since);

  const { count: cancelCount } = await sb
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('typ', 'lieferung')
    .eq('tenant_id', locationId)
    .eq('status', 'storniert')
    .gte('created_at', since);

  if (!totalCount || totalCount < 5 || !cancelCount) return { created: 0, skipped: 0 };

  const ratePct = Math.round((cancelCount / totalCount) * 100);
  if (ratePct < 20) return { created: 0, skipped: 0 };

  const dedupKey = `cancel_rate:${locationId}:${new Date().toISOString().slice(0, 13)}`;

  const result = await upsertNotification({
    locationId,
    type: 'high_cancellation_rate',
    severity: ratePct >= 35 ? 'critical' : 'warning',
    title: `Stornierungsrate ${ratePct}% in letzter Stunde`,
    body: `${cancelCount} von ${totalCount} Bestellungen storniert. Mögliche Ursachen: Überlastung, fehlendes Angebot oder Zahlungsprobleme.`,
    metadata: { cancel_count: cancelCount, total_count: totalCount, rate_pct: ratePct },
    dedupKey,
    expiresInMin: 90,
  });

  return { created: result === 'created' ? 1 : 0, skipped: result === 'skipped' ? 1 : 0 };
}

// ── Scanner: Fahrer offline während aktiver Tour ──────────────────────────────

async function scanDriverOfflineMidTour(locationId: string): Promise<{ created: number; skipped: number }> {
  const sb = createServiceClient();
  let created = 0;
  let skipped = 0;

  // Batches in Lieferung aber Fahrer offline
  const { data: atRisk } = await sb
    .from('mise_delivery_batches')
    .select('id, driver_id, status, created_at')
    .eq('location_id', locationId)
    .eq('status', 'in_delivery')
    .not('driver_id', 'is', null)
    .limit(20);

  if (!atRisk?.length) return { created: 0, skipped: 0 };

  const driverIds = [...new Set(atRisk.map((b) => b.driver_id as string))];

  const { data: offlineDrivers } = await sb
    .from('mise_drivers')
    .select('id, name')
    .in('id', driverIds)
    .eq('active', false);

  for (const driver of offlineDrivers ?? []) {
    const affectedBatch = atRisk.find((b) => b.driver_id === driver.id);
    if (!affectedBatch) continue;

    const dedupKey = `offline_mid_tour:${driver.id}:${affectedBatch.id}`;

    const result = await upsertNotification({
      locationId,
      type: 'driver_offline_mid_tour',
      severity: 'critical',
      title: `Fahrer ${driver.name} offline während aktiver Tour`,
      body: `Fahrer ${driver.name} ist nicht mehr online, hat aber noch eine aktive Liefertour. Manuelle Intervention erforderlich.`,
      metadata: { driver_name: driver.name, batch_id: affectedBatch.id },
      driverId: driver.id as string,
      batchId: affectedBatch.id as string,
      dedupKey,
      expiresInMin: 60,
    });

    result === 'created' ? created++ : skipped++;
  }

  return { created, skipped };
}

// ── Scanner: SLA-Verletzung droht (ETA - now < 5 Min, noch nicht geliefert) ──

async function scanSlaBreach(locationId: string): Promise<{ created: number; skipped: number }> {
  const sb = createServiceClient();
  let created = 0;
  let skipped = 0;

  const fiveMinFromNow = new Date(Date.now() + 5 * 60_000).toISOString();
  const now = new Date().toISOString();

  const { data: atRisk } = await sb
    .from('customer_orders')
    .select('id, bestellnummer, eta_latest, mise_driver_id')
    .eq('typ', 'lieferung')
    .eq('tenant_id', locationId)
    .not('eta_latest', 'is', null)
    .gt('eta_latest', now)
    .lt('eta_latest', fiveMinFromNow)
    .in('status', ['in_delivery', 'assigned'])
    .limit(10);

  for (const order of atRisk ?? []) {
    const remainMin = Math.round(
      (new Date(order.eta_latest as string).getTime() - Date.now()) / 60_000,
    );
    const dedupKey = `sla_breach:${order.id}`;

    const result = await upsertNotification({
      locationId,
      type: 'sla_breach_imminent',
      severity: 'critical',
      title: `SLA-Frist läuft in ${remainMin} Min ab — #${order.bestellnummer}`,
      body: `Bestellung #${order.bestellnummer} erreicht in ${remainMin} Minuten das ETA-Limit. Fahrer-ID: ${order.mise_driver_id ?? 'kein Fahrer'}.`,
      metadata: { remaining_min: remainMin, bestellnummer: order.bestellnummer },
      orderId: order.id as string,
      driverId: order.mise_driver_id as string | undefined,
      dedupKey,
      expiresInMin: 30,
    });

    result === 'created' ? created++ : skipped++;
  }

  return { created, skipped };
}

// ── Scanner: Küchen-Rückstau >5 fertige Bestellungen ─────────────────────────

async function scanKitchenBacklog(locationId: string): Promise<{ created: number; skipped: number }> {
  const sb = createServiceClient();

  const { count } = await sb
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('typ', 'lieferung')
    .eq('tenant_id', locationId)
    .eq('status', 'fertig')
    .is('mise_batch_id', null)
    .is('mise_driver_id', null);

  if (!count || count < 5) return { created: 0, skipped: 0 };

  const dedupKey = `kitchen_backlog:${locationId}:${new Date().toISOString().slice(0, 13)}`;

  const result = await upsertNotification({
    locationId,
    type: 'kitchen_backlog',
    severity: count >= 10 ? 'critical' : 'warning',
    title: `Küchen-Rückstau: ${count} Bestellungen warten auf Dispatch`,
    body: `${count} fertige Lieferbestellungen warten auf Fahrerzuweisung. Dispatch-Engine prüfen oder manuell zuweisen.`,
    metadata: { backlog_count: count },
    dedupKey,
    expiresInMin: 45,
  });

  return { created: result === 'created' ? 1 : 0, skipped: result === 'skipped' ? 1 : 0 };
}

// ── Haupt-Scanner für eine Location ──────────────────────────────────────────

export async function scanNotificationsForLocation(locationId: string): Promise<ScanResult> {
  let created = 0;
  let skipped = 0;
  let errors = 0;

  const scanners = [
    () => scanDriverDelays(locationId),
    () => scanStuckBatches(locationId),
    () => scanNoDriverAvailable(locationId),
    () => scanEtaConfidenceLow(locationId),
    () => scanHighCancellationRate(locationId),
    () => scanDriverOfflineMidTour(locationId),
    () => scanSlaBreach(locationId),
    () => scanKitchenBacklog(locationId),
  ];

  for (const scanner of scanners) {
    try {
      const r = await scanner();
      created += r.created;
      skipped += r.skipped;
    } catch {
      errors++;
    }
  }

  return { locationId, created, skipped, errors };
}

// ── Cron-Batch: alle Locations ────────────────────────────────────────────────

export async function scanNotificationsAllLocations(): Promise<ScanAllResult> {
  const sb = createServiceClient();

  const { data: locations } = await sb
    .from('mise_delivery_zones')
    .select('location_id')
    .eq('is_active', true)
    .limit(50);

  const locationIds = [...new Set((locations ?? []).map((z) => z.location_id as string))];

  let totalCreated = 0;
  let totalSkipped = 0;
  let errors = 0;

  for (const locationId of locationIds) {
    try {
      const r = await scanNotificationsForLocation(locationId);
      totalCreated += r.created;
      totalSkipped += r.skipped;
      errors += r.errors;
    } catch {
      errors++;
    }
  }

  return { locations: locationIds.length, totalCreated, totalSkipped, errors };
}

// ── Lesen: Aktive Notifications ───────────────────────────────────────────────

export async function getActiveNotifications(locationId: string): Promise<AdminNotification[]> {
  const sb = createServiceClient();

  const { data } = await sb
    .from('v_admin_notifications_active')
    .select('*')
    .eq('location_id', locationId)
    .limit(100);

  return (data ?? []).map(mapRow);
}

// ── Lesen: Summary ────────────────────────────────────────────────────────────

export async function getNotificationSummary(locationId: string): Promise<NotificationSummary | null> {
  const sb = createServiceClient();

  const { data } = await sb
    .from('v_admin_notification_summary')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) return null;

  return {
    locationId: data.location_id as string,
    totalActive: (data.total_active as number) ?? 0,
    totalUnread: (data.total_unread as number) ?? 0,
    criticalCount: (data.critical_count as number) ?? 0,
    warningCount: (data.warning_count as number) ?? 0,
    latestNotificationAt: (data.latest_notification_at as string) ?? null,
  };
}

// ── Schreiben: Als gelesen markieren ─────────────────────────────────────────

export async function markNotificationRead(id: string): Promise<void> {
  const sb = createServiceClient();
  await sb.from('delivery_admin_notifications').update({ is_read: true }).eq('id', id);
}

// ── Schreiben: Verwerfen (dismiss) ────────────────────────────────────────────

export async function dismissNotification(id: string, userId: string): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('delivery_admin_notifications')
    .update({ is_dismissed: true, acknowledged_by: userId, acknowledged_at: new Date().toISOString() })
    .eq('id', id);
}

// ── Schreiben: Alle verwerfen ─────────────────────────────────────────────────

export async function dismissAllNotifications(locationId: string, userId: string): Promise<{ dismissed: number }> {
  const sb = createServiceClient();

  const { data } = await sb.rpc('dismiss_all_notifications', {
    p_location_id: locationId,
    p_user_id: userId,
  });

  return { dismissed: (data as { dismissed?: number } | null)?.dismissed ?? 0 };
}

// ── Schreiben: Prune alte Notifications ──────────────────────────────────────

export async function pruneOldNotifications(daysToKeep = 30): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_old_admin_notifications', { days_to_keep: daysToKeep });
  return { pruned: (data as { pruned?: number } | null)?.pruned ?? 0 };
}

// ── Row-Mapper ────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): AdminNotification {
  return {
    id: row.id as string,
    locationId: row.location_id as string,
    type: row.type as NotificationType,
    severity: row.severity as NotificationSeverity,
    title: row.title as string,
    body: row.body as string,
    metadata: (row.metadata as Record<string, unknown>) ?? null,
    orderId: (row.order_id as string) ?? null,
    driverId: (row.driver_id as string) ?? null,
    batchId: (row.batch_id as string) ?? null,
    isRead: Boolean(row.is_read),
    isDismissed: Boolean(row.is_dismissed),
    acknowledgedBy: (row.acknowledged_by as string) ?? null,
    acknowledgedAt: (row.acknowledged_at as string) ?? null,
    dedupKey: (row.dedup_key as string) ?? null,
    expiresAt: (row.expires_at as string) ?? null,
    ageMinutes: Math.round((row.age_minutes as number) ?? 0),
    createdAt: row.created_at as string,
  };
}
