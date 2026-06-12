/**
 * GET /api/delivery/admin/ops-snapshot?location_id=...
 *
 * Echtzeit-Betriebscockpit — liefert alle Live-KPIs in einem Aufruf.
 * Gebaut für 30-Sekunden-Polling im Ops-Center-Dashboard.
 *
 * Response enthält:
 *   queue      — Bestellungen nach Status (neu/zubereitung/bereit/unterwegs)
 *   drivers    — Fahrer-Aufschlüsselung (online/idle/active/offline)
 *   alerts     — Aktive Alarme nach Schweregrad
 *   signal     — Aktuelle Queue-Signal-Type + ETA-Verlängerung
 *   revenue    — Umsatz heute vs. gestern (selbes Zeitfenster)
 *   sla        — On-Time-Rate letzter 20 Lieferungen
 *   throughput — Abgeschlossene Lieferungen letzte 30 Min (Bestellungen/Std)
 *   delays     — Anzahl aktiver Verspätungen
 *   atRisk     — Top-3 wartende Bestellungen (längste Wartezeit)
 *   generatedAt — ISO-Timestamp
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getActiveAlerts } from '@/lib/delivery/alerts';
import { getCurrentQueueSignal } from '@/lib/delivery/capacity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Alle Bestellstatus die als "aktiv" gelten
const QUEUE_STATUSES = ['neu', 'in_zubereitung', 'bereit_zur_lieferung', 'unterwegs'] as const;

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const svc = createServiceClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60_000);
  const windowElapsed = now.getTime() - todayStart.getTime(); // ms seit Mitternacht heute

  const [
    queueRes,
    driversRes,
    driverStatusRes,
    alertsRes,
    signalRes,
    revTodayRes,
    revYestRes,
    slaRes,
    throughputRes,
    delaysRes,
    atRiskRes,
  ] = await Promise.allSettled([
    // 1) Queue-Aufschlüsselung nach Status
    svc
      .from('customer_orders')
      .select('status')
      .eq('location_id', locationId)
      .eq('bestellart', 'lieferung')
      .in('status', QUEUE_STATUSES as unknown as string[])
      .gte('bestellt_am', todayStart.toISOString()),

    // 2) Fahrer aus mise_drivers
    svc
      .from('mise_drivers')
      .select('id, state, active, employee_id')
      .eq('active', true),

    // 3) Online-Status aus driver_status
    svc
      .from('driver_status')
      .select('driver_id, online'),

    // 4) Aktive Alarme
    getActiveAlerts(locationId),

    // 5) Queue-Signal
    getCurrentQueueSignal(locationId),

    // 6) Umsatz heute (Lieferung)
    svc
      .from('customer_orders')
      .select('gesamtbetrag')
      .eq('location_id', locationId)
      .eq('bestellart', 'lieferung')
      .in('status', ['abgeschlossen', 'geliefert'])
      .gte('bestellt_am', todayStart.toISOString()),

    // 7) Umsatz gestern (selbes Zeitfenster)
    svc
      .from('customer_orders')
      .select('gesamtbetrag')
      .eq('location_id', locationId)
      .eq('bestellart', 'lieferung')
      .in('status', ['abgeschlossen', 'geliefert'])
      .gte('bestellt_am', yesterdayStart.toISOString())
      .lt('bestellt_am', new Date(yesterdayStart.getTime() + windowElapsed).toISOString()),

    // 8) SLA — letzte 20 abgeschlossene Lieferungen
    svc
      .from('delivery_performance')
      .select('on_time, eta_deviation_min')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(20),

    // 9) Durchsatz letzte 30 Min
    svc
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('bestellart', 'lieferung')
      .in('status', ['abgeschlossen', 'geliefert'])
      .gte('geliefert_am', thirtyMinAgo.toISOString()),

    // 10) Aktive Verspätungen — Bestellungen mit eta_latest < now und noch nicht abgeschlossen
    svc
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('bestellart', 'lieferung')
      .not('eta_latest', 'is', null)
      .lt('eta_latest', now.toISOString())
      .not('status', 'in', '(abgeschlossen,geliefert,storniert)'),

    // 11) At-Risk-Bestellungen — älteste wartende
    svc
      .from('customer_orders')
      .select('id, bestellnummer, status, bestellt_am, kunde_name, delivery_zone, dispatch_attempts')
      .eq('location_id', locationId)
      .eq('bestellart', 'lieferung')
      .in('status', ['neu', 'bereit_zur_lieferung'])
      .order('bestellt_am', { ascending: true })
      .limit(3),
  ]);

  // ── Queue-Breakdown ──────────────────────────────────────────────────────
  const queueRows = queueRes.status === 'fulfilled' ? (queueRes.value.data ?? []) : [];
  const queue = {
    neu:        queueRows.filter((r) => r.status === 'neu').length,
    zubereitung: queueRows.filter((r) => r.status === 'in_zubereitung').length,
    bereit:      queueRows.filter((r) => r.status === 'bereit_zur_lieferung').length,
    unterwegs:   queueRows.filter((r) => r.status === 'unterwegs').length,
    total:       queueRows.length,
  };

  // ── Driver-Breakdown ─────────────────────────────────────────────────────
  const miseDrivers = driversRes.status === 'fulfilled' ? (driversRes.value.data ?? []) : [];
  const onlineSet = new Set(
    (driverStatusRes.status === 'fulfilled' ? (driverStatusRes.value.data ?? []) : [])
      .filter((d) => d.online)
      .map((d) => d.driver_id),
  );
  const drivers = {
    online:   miseDrivers.filter((d) => onlineSet.has(d.id)).length,
    idle:     miseDrivers.filter((d) => onlineSet.has(d.id) && d.state === 'idle').length,
    active:   miseDrivers.filter((d) => ['assigned', 'at_restaurant', 'en_route', 'returning'].includes(d.state)).length,
    offline:  miseDrivers.filter((d) => !onlineSet.has(d.id)).length,
    total:    miseDrivers.length,
  };

  // ── Alerts ───────────────────────────────────────────────────────────────
  const activeAlerts = alertsRes.status === 'fulfilled' ? alertsRes.value : [];
  const alerts = {
    critical: activeAlerts.filter((a) => a.severity === 'critical').length,
    warning:  activeAlerts.filter((a) => a.severity === 'warning').length,
    info:     activeAlerts.filter((a) => a.severity === 'info').length,
    total:    activeAlerts.length,
    latest:   activeAlerts.slice(0, 3).map((a) => ({
      type:    a.alert_type,
      severity: a.severity,
      message: a.message,
      createdAt: a.created_at,
    })),
  };

  // ── Queue Signal ─────────────────────────────────────────────────────────
  const signal = signalRes.status === 'fulfilled'
    ? { type: signalRes.value.signalType, etaExtensionMin: signalRes.value.etaExtensionMin, messageDe: signalRes.value.messageDe }
    : { type: 'normal' as const, etaExtensionMin: 0, messageDe: null };

  // ── Revenue ──────────────────────────────────────────────────────────────
  const sumRevenue = (rows: { gesamtbetrag: number | null }[]) =>
    rows.reduce((s, r) => s + Number(r.gesamtbetrag ?? 0), 0);

  const revToday = revTodayRes.status === 'fulfilled' ? sumRevenue(revTodayRes.value.data ?? []) : 0;
  const revYest  = revYestRes.status === 'fulfilled'  ? sumRevenue(revYestRes.value.data ?? [])  : 0;
  const revenue = {
    today:     revToday,
    yesterday: revYest,
    deltaPct:  revYest > 0 ? Math.round(((revToday - revYest) / revYest) * 100) : null,
  };

  // ── SLA ──────────────────────────────────────────────────────────────────
  const slaRows = slaRes.status === 'fulfilled' ? (slaRes.value.data ?? []) : [];
  const sla = slaRows.length > 0
    ? {
        onTimePct: Math.round(slaRows.filter((r) => r.on_time).length / slaRows.length * 100),
        avgDeviationMin: Math.round(
          slaRows.reduce((s, r) => s + Number(r.eta_deviation_min ?? 0), 0) / slaRows.length,
        ),
        sampleSize: slaRows.length,
      }
    : { onTimePct: null, avgDeviationMin: null, sampleSize: 0 };

  // ── Throughput ───────────────────────────────────────────────────────────
  const throughputCount = throughputRes.status === 'fulfilled' ? (throughputRes.value.count ?? 0) : 0;
  const throughput = {
    deliveriesLast30min: throughputCount,
    perHourRate: Math.round(throughputCount * 2), // extrapoliert auf /Std
  };

  // ── Delays ───────────────────────────────────────────────────────────────
  const delays = {
    active: delaysRes.status === 'fulfilled' ? (delaysRes.value.count ?? 0) : 0,
  };

  // ── At-Risk Orders ───────────────────────────────────────────────────────
  const atRiskRows = atRiskRes.status === 'fulfilled' ? (atRiskRes.value.data ?? []) : [];
  const atRisk = atRiskRows.map((r) => ({
    id:               r.id,
    bestellnummer:    r.bestellnummer,
    status:           r.status,
    waitMinutes:      Math.floor((now.getTime() - new Date(r.bestellt_am).getTime()) / 60_000),
    kundeName:        r.kunde_name,
    zone:             r.delivery_zone,
    dispatchAttempts: r.dispatch_attempts ?? 0,
  }));

  return NextResponse.json({
    queue,
    drivers,
    alerts,
    signal,
    revenue,
    sla,
    throughput,
    delays,
    atRisk,
    generatedAt: now.toISOString(),
  });
}
