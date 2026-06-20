/**
 * lib/delivery/smart-reorder-notify.ts — Phase 336
 *
 * Smart Reorder Notifications
 *
 * Scannt offene item_demand_alerts und sendet Push-Benachrichtigungen
 * an Admin-Nutzer wenn häufig bestellte Artikel bald ausverkauft sind.
 *
 * Deduplizierung via reorder_push_log (UNIQUE location_id + item_name + alert_level).
 * Wird alle 15 Minuten aus dem Cron-Tick aufgerufen.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface ReorderNotifyResult {
  locationId: string;
  scanned: number;
  pushed: number;
  deduped: number;
  errors: number;
}

export interface ReorderPushLogEntry {
  id: string;
  locationId: string;
  itemName: string;
  alertLevel: string;
  pushedAt: string;
}

export interface ReorderNotifyDashboard {
  openAlerts: Array<{
    itemName: string;
    alertLevel: string;
    currentStock: number;
    reorderPoint: number;
    avgDailyDemand: number;
    daysUntilDepletion: number | null;
    pushedAt: string | null;
  }>;
  recentPushes: ReorderPushLogEntry[];
  totalOpenCritical: number;
  totalOpenWarning: number;
  lastScanAt: string | null;
}

// ── Kern-Scanner ───────────────────────────────────────────────────────────────

export async function scanItemAlertsAndNotify(
  locationId: string,
): Promise<ReorderNotifyResult> {
  const svc = createServiceClient();
  let pushed = 0;
  let deduped = 0;
  let errors = 0;

  // Offene Alerts laden (critical first)
  const { data: alerts } = await svc
    .from('item_demand_alerts')
    .select('item_name, alert_level, current_stock, reorder_point, avg_daily_demand, days_until_depletion')
    .eq('location_id', locationId)
    .eq('status', 'open')
    .order('alert_level', { ascending: true }); // critical kommt alphabetisch vor warning

  if (!alerts?.length) return { locationId, scanned: 0, pushed: 0, deduped: 0, errors: 0 };

  for (const alert of alerts) {
    const itemName = alert.item_name as string;
    const alertLevel = alert.alert_level as string;

    // Deduplizierung: wurde für dieses Item+Level schon gesendet?
    const { data: existing } = await svc
      .from('reorder_push_log')
      .select('id')
      .eq('location_id', locationId)
      .eq('item_name', itemName)
      .eq('alert_level', alertLevel)
      .maybeSingle();

    if (existing) {
      deduped++;
      continue;
    }

    // Push an alle Manager-Mitarbeiter des Standorts senden
    const pushSent = await notifyAdminsForReorder(svc, locationId, itemName, alertLevel, {
      currentStock: alert.current_stock as number,
      daysUntilDepletion: (alert.days_until_depletion as number | null) ?? null,
      avgDailyDemand: alert.avg_daily_demand as number,
    });

    if (pushSent) {
      // Dedup-Eintrag schreiben
      await svc.from('reorder_push_log').insert({
        location_id: locationId,
        item_name: itemName,
        alert_level: alertLevel,
      });
      pushed++;
    } else {
      errors++;
    }
  }

  return { locationId, scanned: alerts.length, pushed, deduped, errors };
}

async function notifyAdminsForReorder(
  svc: ReturnType<typeof createServiceClient>,
  locationId: string,
  itemName: string,
  alertLevel: string,
  details: { currentStock: number; daysUntilDepletion: number | null; avgDailyDemand: number },
): Promise<boolean> {
  try {
    const isCritical = alertLevel === 'critical';
    const emoji = isCritical ? '🚨' : '⚠️';
    const dayInfo = details.daysUntilDepletion != null
      ? ` (noch ~${details.daysUntilDepletion}d)`
      : '';
    const title = `${emoji} Reorder: ${itemName}`;
    const body = `Bestand: ${details.currentStock} Einh.${dayInfo} · Ø ${details.avgDailyDemand.toFixed(1)}/Tag`;

    // Push-Subscriptions aller Manager für diesen Standort laden
    const { data: subs } = await svc
      .from('employee_push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('location_id', locationId);

    if (!subs?.length) return true; // Kein Push-Abo → als OK werten

    // Web-Push senden (fire-and-forget pro Subscription)
    const webpush = await import('web-push').catch(() => null);
    if (!webpush) return true; // Library nicht installiert → graceful

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL ?? 'mailto:admin@mise.dev';

    if (!vapidPublicKey || !vapidPrivateKey) return true;

    webpush.default.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

    await Promise.allSettled(
      subs.map((sub) =>
        webpush.default.sendNotification(
          {
            endpoint: sub.endpoint as string,
            keys: { p256dh: sub.p256dh as string, auth: sub.auth as string },
          },
          JSON.stringify({ title, body, icon: '/icon-192.png', tag: `reorder-${itemName}` }),
        ),
      ),
    );

    return true;
  } catch {
    return false;
  }
}

// ── Cron: alle Standorte ──────────────────────────────────────────────────────

export async function scanAllLocations(): Promise<{
  locations: number;
  totalPushed: number;
}> {
  const svc = createServiceClient();

  // Alle Standorte mit offenen Alerts
  const { data: locationRows } = await svc
    .from('item_demand_alerts')
    .select('location_id')
    .eq('status', 'open');

  const uniqueLocations = [...new Set((locationRows ?? []).map((r) => r.location_id as string))];
  if (!uniqueLocations.length) return { locations: 0, totalPushed: 0 };

  let totalPushed = 0;
  await Promise.all(
    uniqueLocations.map(async (locId) => {
      const res = await scanItemAlertsAndNotify(locId);
      totalPushed += res.pushed;
    }),
  );

  return { locations: uniqueLocations.length, totalPushed };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getReorderNotifyDashboard(
  locationId: string,
): Promise<ReorderNotifyDashboard> {
  const svc = createServiceClient();

  const [{ data: alerts }, { data: pushLog }] = await Promise.all([
    svc
      .from('item_demand_alerts')
      .select(
        'item_name, alert_level, current_stock, reorder_point, avg_daily_demand, days_until_depletion, status',
      )
      .eq('location_id', locationId)
      .eq('status', 'open')
      .order('alert_level'),
    svc
      .from('reorder_push_log')
      .select('id, location_id, item_name, alert_level, pushed_at')
      .eq('location_id', locationId)
      .order('pushed_at', { ascending: false })
      .limit(50),
  ]);

  const pushMap = new Map<string, string>(
    (pushLog ?? []).map((p) => [`${p.item_name}:${p.alert_level}`, p.pushed_at as string]),
  );

  const openAlerts = (alerts ?? []).map((a) => ({
    itemName: a.item_name as string,
    alertLevel: a.alert_level as string,
    currentStock: a.current_stock as number,
    reorderPoint: a.reorder_point as number,
    avgDailyDemand: Number(a.avg_daily_demand),
    daysUntilDepletion: (a.days_until_depletion as number | null) ?? null,
    pushedAt: pushMap.get(`${a.item_name}:${a.alert_level}`) ?? null,
  }));

  const recentPushes: ReorderPushLogEntry[] = (pushLog ?? []).slice(0, 20).map((p) => ({
    id: p.id as string,
    locationId: p.location_id as string,
    itemName: p.item_name as string,
    alertLevel: p.alert_level as string,
    pushedAt: p.pushed_at as string,
  }));

  const lastScanAt =
    (pushLog ?? []).length > 0 ? (pushLog![0].pushed_at as string) : null;

  return {
    openAlerts,
    recentPushes,
    totalOpenCritical: openAlerts.filter((a) => a.alertLevel === 'critical').length,
    totalOpenWarning: openAlerts.filter((a) => a.alertLevel === 'warning').length,
    lastScanAt,
  };
}

// ── Dedup zurücksetzen (wenn Alert gelöst und wieder auftreten soll) ───────────

export async function resetPushDedup(locationId: string, itemName: string): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from('reorder_push_log')
    .delete()
    .eq('location_id', locationId)
    .eq('item_name', itemName);
}
