/**
 * lib/delivery/driver-digest-mailer.ts
 *
 * Fahrer Tagesabschluss-E-Mail — Phase 164
 *
 * Sendet jedem Fahrer täglich um 20:00 UTC eine persönliche
 * Leistungsübersicht: Lieferungen, Verdienst, Pünktlichkeit,
 * Rating, Wochenvergleich, Ranking und nächste Schicht.
 *
 * Cron: täglich 20:00 UTC → sendDriverDailyDigestAllLocations()
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';

// ─────────────────────────────────────────────────────────────────────────────
// Typen
// ─────────────────────────────────────────────────────────────────────────────

export interface DriverDigestConfig {
  id: string;
  locationId: string;
  enabled: boolean;
  sendHourUtc: number;
  includeRanking: boolean;
  includeNextShift: boolean;
  updatedAt: string;
}

export interface DriverDigestLogEntry {
  id: string;
  locationId: string;
  driverId: string;
  driverName: string | null;
  digestDate: string;
  sentAt: string;
  status: 'sent' | 'failed' | 'skipped';
  error: string | null;
}

export interface DriverDigestSendResult {
  locationId: string;
  date: string;
  driversSent: number;
  driversSkipped: number;
  driversFailed: number;
  totalDrivers: number;
}

export interface DriverDigestBatchResult {
  locations: number;
  driversSent: number;
  driversSkipped: number;
  driversFailed: number;
  errors: number;
}

interface DriverData {
  id: string;
  name: string;
  email: string;
  vehicle: string | null;
  locationId: string;
}

interface TodaySnapshot {
  toursCompleted: number;
  stopsCompleted: number;
  totalDistanceKm: number;
  avgDeliveryMin: number | null;
  onTimeRate: number | null;
  avgRating: number | null;
  totalRatings: number;
  totalEarningsEur: number;
  activeMinutes: number;
}

interface WeekAverage {
  toursCompleted: number;
  stopsCompleted: number;
  avgDeliveryMin: number | null;
  onTimeRate: number | null;
  avgRating: number | null;
  totalEarningsEur: number;
}

interface ActiveChallenge {
  title: string;
  progressPct: number;
  currentValue: number;
  targetValue: number;
  rewardEur: number;
  endsAt: string;
  completed: boolean;
}

interface NextShift {
  plannedStart: string;
  plannedEnd: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Konfig-CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function getDriverDigestConfig(
  locationId: string,
): Promise<DriverDigestConfig | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('driver_digest_config')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) return null;
  return mapConfig(data as Record<string, unknown>);
}

export async function upsertDriverDigestConfig(
  locationId: string,
  patch: Partial<Omit<DriverDigestConfig, 'id' | 'locationId' | 'updatedAt'>>,
): Promise<DriverDigestConfig> {
  const sb = createServiceClient();

  const row: Record<string, unknown> = { location_id: locationId };
  if (patch.enabled !== undefined)        row.enabled           = patch.enabled;
  if (patch.sendHourUtc !== undefined)    row.send_hour_utc     = patch.sendHourUtc;
  if (patch.includeRanking !== undefined) row.include_ranking   = patch.includeRanking;
  if (patch.includeNextShift !== undefined) row.include_next_shift = patch.includeNextShift;

  const { data, error } = await sb
    .from('driver_digest_config')
    .upsert(row, { onConflict: 'location_id' })
    .select()
    .single();

  if (error) throw new Error(`[driver-digest] upsert config: ${error.message}`);
  return mapConfig(data as Record<string, unknown>);
}

function mapConfig(d: Record<string, unknown>): DriverDigestConfig {
  return {
    id:               d.id as string,
    locationId:       d.location_id as string,
    enabled:          d.enabled as boolean,
    sendHourUtc:      d.send_hour_utc as number,
    includeRanking:   d.include_ranking as boolean,
    includeNextShift: d.include_next_shift as boolean,
    updatedAt:        d.updated_at as string,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Versand-Log
// ─────────────────────────────────────────────────────────────────────────────

export async function getDriverDigestLog(
  locationId: string,
  limit = 50,
): Promise<DriverDigestLogEntry[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('driver_digest_log')
    .select('*')
    .eq('location_id', locationId)
    .order('sent_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id:          r.id as string,
    locationId:  r.location_id as string,
    driverId:    r.driver_id as string,
    driverName:  (r.driver_name as string | null) ?? null,
    digestDate:  r.digest_date as string,
    sentAt:      r.sent_at as string,
    status:      r.status as 'sent' | 'failed' | 'skipped',
    error:       (r.error as string | null) ?? null,
  }));
}

async function logDriverDigest(
  locationId: string,
  driverId: string,
  driverName: string | null,
  digestDate: string,
  status: 'sent' | 'failed' | 'skipped',
  error?: string,
): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('driver_digest_log')
    .upsert({
      location_id:  locationId,
      driver_id:    driverId,
      driver_name:  driverName,
      digest_date:  digestDate,
      sent_at:      new Date().toISOString(),
      status,
      error:        error ?? null,
    }, { onConflict: 'driver_id,digest_date' })
    .catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Daten laden
// ─────────────────────────────────────────────────────────────────────────────

async function getTodaySnapshot(
  driverId: string,
  locationId: string,
  date: string,
): Promise<TodaySnapshot | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('driver_performance_snapshots')
    .select('tours_completed, stops_completed, total_distance_km, avg_delivery_min, on_time_rate, avg_rating, total_ratings, total_earnings_eur, active_minutes')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .eq('snapshot_date', date)
    .maybeSingle();

  if (!data) return null;
  return {
    toursCompleted:   Number(data.tours_completed ?? 0),
    stopsCompleted:   Number(data.stops_completed ?? 0),
    totalDistanceKm:  Math.round(Number(data.total_distance_km ?? 0) * 10) / 10,
    avgDeliveryMin:   data.avg_delivery_min != null ? Math.round(Number(data.avg_delivery_min) * 10) / 10 : null,
    onTimeRate:       data.on_time_rate != null ? Number(data.on_time_rate) : null,
    avgRating:        data.avg_rating != null ? Math.round(Number(data.avg_rating) * 10) / 10 : null,
    totalRatings:     Number(data.total_ratings ?? 0),
    totalEarningsEur: Math.round(Number(data.total_earnings_eur ?? 0) * 100) / 100,
    activeMinutes:    Number(data.active_minutes ?? 0),
  };
}

async function getWeekAverage(
  driverId: string,
  locationId: string,
  excludeDate: string,
): Promise<WeekAverage | null> {
  const sb = createServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString().slice(0, 10);

  const { data } = await sb
    .from('driver_performance_snapshots')
    .select('tours_completed, stops_completed, avg_delivery_min, on_time_rate, avg_rating, total_earnings_eur')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('snapshot_date', weekAgo)
    .neq('snapshot_date', excludeDate)
    .order('snapshot_date', { ascending: false })
    .limit(7);

  if (!data || data.length === 0) return null;

  const count = data.length;
  const avg = <K extends keyof typeof data[0]>(key: K): number | null => {
    const vals = data.map((r) => (r[key] != null ? Number(r[key]) : null)).filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };

  return {
    toursCompleted:   data.reduce((s, r) => s + Number(r.tours_completed ?? 0), 0) / count,
    stopsCompleted:   data.reduce((s, r) => s + Number(r.stops_completed ?? 0), 0) / count,
    avgDeliveryMin:   avg('avg_delivery_min'),
    onTimeRate:       avg('on_time_rate'),
    avgRating:        avg('avg_rating'),
    totalEarningsEur: data.reduce((s, r) => s + Number(r.total_earnings_eur ?? 0), 0) / count,
  };
}

async function getRankingPosition(
  driverId: string,
  locationId: string,
  date: string,
): Promise<{ rank: number; total: number } | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('driver_performance_snapshots')
    .select('driver_id, stops_completed')
    .eq('location_id', locationId)
    .eq('snapshot_date', date)
    .order('stops_completed', { ascending: false });

  if (!data || data.length === 0) return null;

  const idx = data.findIndex((r) => (r.driver_id as string) === driverId);
  if (idx === -1) return null;

  return { rank: idx + 1, total: data.length };
}

async function getActiveChallenges(
  driverId: string,
  locationId: string,
): Promise<ActiveChallenge[]> {
  const sb = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data } = await sb
    .from('v_challenge_leaderboard')
    .select('title, progress_pct, current_value, target_value, reward_eur, ends_at, completed, challenge_status')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .eq('challenge_status', 'active')
    .gte('ends_at', nowIso)
    .order('ends_at', { ascending: true })
    .limit(3);

  return (data ?? []).map((r) => ({
    title:        r.title as string,
    progressPct:  Number(r.progress_pct ?? 0),
    currentValue: Number(r.current_value ?? 0),
    targetValue:  Number(r.target_value ?? 0),
    rewardEur:    Number(r.reward_eur ?? 0),
    endsAt:       r.ends_at as string,
    completed:    r.completed as boolean,
  }));
}

async function getNextShift(
  driverId: string,
  locationId: string,
): Promise<NextShift | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('driver_shifts')
    .select('planned_start, planned_end')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .in('status', ['scheduled'])
    .gt('planned_start', new Date().toISOString())
    .order('planned_start', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    plannedStart: data.planned_start as string,
    plannedEnd:   (data.planned_end as string | null) ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML-Email-Template
// ─────────────────────────────────────────────────────────────────────────────

function trendArrow(today: number | null, avg: number | null, lowerIsBetter = false): string {
  if (today === null || avg === null || avg === 0) return '';
  const diff = today - avg;
  const pct = Math.abs(diff / avg) * 100;
  if (pct < 3) return '<span style="color:#888;">→</span>';
  const up = diff > 0;
  const good = lowerIsBetter ? !up : up;
  const arrow = up ? '↑' : '↓';
  const color = good ? '#16a34a' : '#dc2626';
  return `<span style="color:${color};font-weight:bold;">${arrow} ${Math.round(pct)}%</span>`;
}

function fmtEur(eur: number): string {
  return `€${eur.toFixed(2).replace('.', ',')}`;
}

function fmtMin(min: number | null): string {
  if (min === null) return '—';
  return `${Math.round(min)} Min`;
}

function fmtPct(rate: number | null): string {
  if (rate === null) return '—';
  return `${Math.round(rate * 100)}%`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit',
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });
}

function vehicleEmoji(vehicle: string | null): string {
  if (!vehicle) return '🚗';
  const v = vehicle.toLowerCase();
  if (v.includes('bike') || v.includes('fahrrad') || v.includes('rad')) return '🚲';
  if (v.includes('moped') || v.includes('scooter') || v.includes('roller')) return '🛵';
  if (v.includes('ebike') || v.includes('e-bike')) return '⚡';
  return '🚗';
}

function progressBar(pct: number): string {
  const filled = Math.round(pct / 5);
  const empty  = 20 - filled;
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

export function renderDriverDigestHtml(opts: {
  driver: DriverData;
  locationName: string;
  today: TodaySnapshot | null;
  weekAvg: WeekAverage | null;
  ranking: { rank: number; total: number } | null;
  challenges: ActiveChallenge[];
  nextShift: NextShift | null;
  includeRanking: boolean;
  includeNextShift: boolean;
  digestDate: string;
}): string {
  const { driver, locationName, today, weekAvg, ranking, challenges, nextShift, includeRanking, includeNextShift, digestDate } = opts;

  const noData = !today || today.toursCompleted === 0;

  const kpiRows = noData
    ? `<tr><td colspan="3" style="padding:16px;text-align:center;color:#888;">Heute keine Lieferungen erfasst.</td></tr>`
    : `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">🚚 Lieferungen</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:bold;text-align:right;">${today.stopsCompleted}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${trendArrow(today.stopsCompleted, weekAvg?.stopsCompleted ?? null)}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">💶 Verdienst</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:bold;text-align:right;">${fmtEur(today.totalEarningsEur)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${trendArrow(today.totalEarningsEur, weekAvg?.totalEarningsEur ?? null)}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">⏱ Ø Lieferzeit</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:bold;text-align:right;">${fmtMin(today.avgDeliveryMin)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${trendArrow(today.avgDeliveryMin, weekAvg?.avgDeliveryMin ?? null, true)}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">✅ Pünktlichkeit</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:bold;text-align:right;">${fmtPct(today.onTimeRate)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${trendArrow(today.onTimeRate, weekAvg?.onTimeRate ?? null)}</td>
    </tr>
    ${today.avgRating !== null ? `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">⭐ Ø Bewertung</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-weight:bold;text-align:right;">${today.avgRating.toFixed(1)} (${today.totalRatings}×)</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${trendArrow(today.avgRating, weekAvg?.avgRating ?? null)}</td>
    </tr>` : ''}
    <tr>
      <td style="padding:8px 12px;">📍 Gefahrene km</td>
      <td style="padding:8px 12px;font-weight:bold;text-align:right;">${today.totalDistanceKm} km</td>
      <td style="padding:8px 12px;"></td>
    </tr>`;

  const rankingSection = (includeRanking && ranking)
    ? `<div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:16px;margin:16px 0;">
        <div style="font-size:13px;color:#713f12;font-weight:bold;margin-bottom:4px;">🏆 Tages-Rangliste</div>
        <div style="font-size:24px;font-weight:bold;color:#92400e;">Platz ${ranking.rank} von ${ranking.total}</div>
        <div style="font-size:12px;color:#a16207;margin-top:4px;">(nach Lieferungen heute)</div>
      </div>`
    : '';

  const challengeSection = challenges.length > 0
    ? `<div style="margin:16px 0;">
        <div style="font-size:14px;font-weight:bold;color:#374151;margin-bottom:8px;">🎯 Aktive Challenges</div>
        ${challenges.map((c) => `
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span style="font-weight:bold;font-size:13px;">${c.title}</span>
              <span style="font-size:13px;color:#6b7280;">${fmtEur(c.rewardEur)} Bonus</span>
            </div>
            <div style="font-family:monospace;font-size:11px;color:#374151;">${progressBar(c.progressPct)} ${Math.round(c.progressPct)}%</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">
              ${c.currentValue} / ${c.targetValue} · endet ${fmtDate(c.endsAt)}
              ${c.completed ? ' ✅ Geschafft!' : ''}
            </div>
          </div>`).join('')}
      </div>`
    : '';

  const shiftSection = (includeNextShift && nextShift)
    ? `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px;margin:16px 0;">
        <div style="font-size:13px;color:#166534;font-weight:bold;margin-bottom:4px;">📅 Nächste Schicht</div>
        <div style="font-size:16px;font-weight:bold;color:#14532d;">
          ${fmtDate(nextShift.plannedStart)}, ${fmtTime(nextShift.plannedStart)}
          ${nextShift.plannedEnd ? ` – ${fmtTime(nextShift.plannedEnd)}` : ''}
        </div>
      </div>`
    : '';

  const motivationalMessage = noData
    ? 'Morgen ist ein neuer Tag — viel Erfolg!'
    : today.stopsCompleted >= 10
    ? 'Starke Leistung heute! Weiter so 💪'
    : today.stopsCompleted >= 5
    ? 'Guter Tag! Du bist auf Kurs. 🚀'
    : 'Jede Lieferung zählt. Morgen geht\'s weiter! 💡';

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Dein Tagesbericht – ${digestDate}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

      <!-- Header -->
      <tr><td style="background:#1a1a2e;padding:24px 32px;">
        <div style="color:#a3e635;font-size:12px;font-weight:bold;letter-spacing:.2em;text-transform:uppercase;">Mise Delivery</div>
        <div style="color:#fff;font-size:22px;font-weight:bold;margin-top:4px;">Dein Tagesbericht</div>
        <div style="color:#9ca3af;font-size:13px;margin-top:2px;">${fmtDate(digestDate)} · ${locationName}</div>
      </td></tr>

      <!-- Greeting -->
      <tr><td style="padding:24px 32px 0;">
        <div style="font-size:18px;font-weight:bold;color:#111827;">Hallo ${vehicleEmoji(driver.vehicle)} ${driver.name}!</div>
        <div style="font-size:14px;color:#6b7280;margin-top:4px;">Hier ist deine Zusammenfassung für heute.</div>
      </td></tr>

      <!-- KPI Table -->
      <tr><td style="padding:16px 32px;">
        <div style="font-size:14px;font-weight:bold;color:#374151;margin-bottom:8px;">📊 Deine Leistung heute</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:14px;">
          <thead><tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;">Kennzahl</th>
            <th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:600;">Heute</th>
            <th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:600;">vs. Ø 7 Tage</th>
          </tr></thead>
          <tbody>${kpiRows}</tbody>
        </table>
        ${weekAvg ? '<div style="font-size:11px;color:#9ca3af;margin-top:4px;">↑↓ Vergleich zum Durchschnitt der letzten 7 Arbeitstage</div>' : ''}
      </td></tr>

      <!-- Ranking -->
      <tr><td style="padding:0 32px;">${rankingSection}</td></tr>

      <!-- Challenges -->
      <tr><td style="padding:0 32px;">${challengeSection}</td></tr>

      <!-- Next Shift -->
      <tr><td style="padding:0 32px;">${shiftSection}</td></tr>

      <!-- Motivational Footer -->
      <tr><td style="padding:16px 32px 24px;">
        <div style="background:#f0f9ff;border-left:4px solid #38bdf8;padding:12px 16px;border-radius:0 6px 6px 0;">
          <div style="font-size:14px;color:#0c4a6e;">${motivationalMessage}</div>
        </div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
        <div style="font-size:11px;color:#9ca3af;text-align:center;">
          Dieser Bericht wurde automatisch von Mise Smart Delivery generiert.<br>
          Rückmeldungen an deinen Standortleiter.
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Versand-Logik
// ─────────────────────────────────────────────────────────────────────────────

export async function sendDriverDailyDigest(
  locationId: string,
  targetDate?: string,
): Promise<DriverDigestSendResult> {
  const sb = createServiceClient();
  const digestDate = targetDate ?? new Date().toISOString().slice(0, 10);

  const result: DriverDigestSendResult = {
    locationId,
    date: digestDate,
    driversSent: 0,
    driversSkipped: 0,
    driversFailed: 0,
    totalDrivers: 0,
  };

  // 1) Konfig prüfen
  const cfg = await getDriverDigestConfig(locationId);
  if (!cfg?.enabled) {
    return result;
  }

  // 2) Standort-Name
  const { data: loc } = await sb
    .from('locations')
    .select('name')
    .eq('id', locationId)
    .maybeSingle();
  const locationName = (loc?.name as string | null) ?? 'Standort';

  // 3) Alle aktiven Fahrer mit E-Mail
  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id, name, email, vehicle')
    .eq('location_id', locationId)
    .eq('active', true)
    .not('email', 'is', null);

  const activeDrivers: DriverData[] = (drivers ?? [])
    .filter((d) => {
      const email = d.email as string | null;
      return email && email.includes('@');
    })
    .map((d) => ({
      id:         d.id as string,
      name:       (d.name as string | null) ?? 'Fahrer',
      email:      d.email as string,
      vehicle:    (d.vehicle as string | null) ?? null,
      locationId,
    }));

  result.totalDrivers = activeDrivers.length;

  if (activeDrivers.length === 0) {
    return result;
  }

  // 4) Ranking für alle Fahrer heute (einmalig laden)
  const { data: rankingData } = await sb
    .from('driver_performance_snapshots')
    .select('driver_id, stops_completed')
    .eq('location_id', locationId)
    .eq('snapshot_date', digestDate)
    .order('stops_completed', { ascending: false });

  const rankingMap = new Map<string, { rank: number; total: number }>();
  const rankTotal = rankingData?.length ?? 0;
  (rankingData ?? []).forEach((r, i) => {
    rankingMap.set(r.driver_id as string, { rank: i + 1, total: rankTotal });
  });

  // 5) Pro Fahrer: Daten laden + E-Mail senden
  for (const driver of activeDrivers) {
    try {
      const [today, weekAvg, challenges, nextShift] = await Promise.all([
        getTodaySnapshot(driver.id, locationId, digestDate),
        getWeekAverage(driver.id, locationId, digestDate),
        getActiveChallenges(driver.id, locationId),
        cfg.includeNextShift ? getNextShift(driver.id, locationId) : Promise.resolve(null),
      ]);

      const ranking = cfg.includeRanking ? (rankingMap.get(driver.id) ?? null) : null;

      const html = renderDriverDigestHtml({
        driver,
        locationName,
        today,
        weekAvg,
        ranking,
        challenges,
        nextShift,
        includeRanking:   cfg.includeRanking,
        includeNextShift: cfg.includeNextShift,
        digestDate,
      });

      const stopsLabel = today?.stopsCompleted ?? 0;
      const earningsLabel = today?.totalEarningsEur
        ? ` · ${fmtEur(today.totalEarningsEur)}`
        : '';

      const sendResult = await sendEmail({
        to: driver.email,
        subject: `Dein Tagesbericht ${digestDate}: ${stopsLabel} Lieferungen${earningsLabel} — ${locationName}`,
        html,
        text: `Hallo ${driver.name}, dein Tagesbericht: ${stopsLabel} Lieferungen${earningsLabel}. Öffne die E-Mail im Browser für die vollständige Übersicht.`,
      });

      if (sendResult.sent) {
        result.driversSent++;
        await logDriverDigest(locationId, driver.id, driver.name, digestDate, 'sent');
      } else if (sendResult.skipped) {
        result.driversSkipped++;
        await logDriverDigest(locationId, driver.id, driver.name, digestDate, 'skipped', sendResult.skipped);
      } else {
        result.driversFailed++;
        await logDriverDigest(locationId, driver.id, driver.name, digestDate, 'failed', sendResult.error ?? 'Unbekannter Fehler');
      }
    } catch (err: unknown) {
      result.driversFailed++;
      const msg = err instanceof Error ? err.message : String(err);
      await logDriverDigest(locationId, driver.id, driver.name, digestDate, 'failed', msg);
    }
  }

  return result;
}

export async function sendDriverDailyDigestAllLocations(
  targetDate?: string,
): Promise<DriverDigestBatchResult> {
  const sb = createServiceClient();
  const result: DriverDigestBatchResult = {
    locations: 0,
    driversSent: 0,
    driversSkipped: 0,
    driversFailed: 0,
    errors: 0,
  };

  const { data: enabledConfigs } = await sb
    .from('driver_digest_config')
    .select('location_id')
    .eq('enabled', true);

  if (!enabledConfigs || enabledConfigs.length === 0) return result;

  const sends = await Promise.allSettled(
    enabledConfigs.map((cfg) =>
      sendDriverDailyDigest(cfg.location_id as string, targetDate),
    ),
  );

  for (const s of sends) {
    if (s.status === 'fulfilled') {
      result.locations++;
      result.driversSent    += s.value.driversSent;
      result.driversSkipped += s.value.driversSkipped;
      result.driversFailed  += s.value.driversFailed;
    } else {
      result.errors++;
    }
  }

  return result;
}
