/**
 * lib/delivery/digest-mailer.ts
 *
 * Automatischer Tagesbericht per E-Mail an Manager — Phase 163
 *
 * Lädt den gespeicherten Daily-Digest, findet alle Manager/Admins
 * mit E-Mail-Adresse und versendet einen formatierten HTML-Bericht.
 *
 * Cron: täglich um 07:00 UTC (4h nach Digest-Generierung um 03:00)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { getDailyDigest } from './daily-digest';
import { sendEmail } from '@/lib/email';
import type { DailyDigest, DigestAnomaly, DailyMetrics } from './daily-digest';

// ─────────────────────────────────────────────────────────────────────────────
// Typen
// ─────────────────────────────────────────────────────────────────────────────

export interface DigestEmailConfig {
  id: string;
  locationId: string;
  enabled: boolean;
  sendHourUtc: number;
  includeAiSummary: boolean;
  extraRecipients: string[];
  updatedAt: string;
}

export interface DigestEmailSendResult {
  locationId: string;
  status: 'sent' | 'failed' | 'skipped';
  recipientsCount: number;
  error?: string;
}

export interface DigestMailerBatchResult {
  locations: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Konfig-CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function getDigestEmailConfig(
  locationId: string,
): Promise<DigestEmailConfig | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('digest_email_config')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id as string,
    locationId: data.location_id as string,
    enabled: data.enabled as boolean,
    sendHourUtc: data.send_hour_utc as number,
    includeAiSummary: data.include_ai_summary as boolean,
    extraRecipients: (data.extra_recipients as string[] | null) ?? [],
    updatedAt: data.updated_at as string,
  };
}

export async function upsertDigestEmailConfig(
  locationId: string,
  patch: Partial<Omit<DigestEmailConfig, 'id' | 'locationId' | 'updatedAt'>>,
): Promise<DigestEmailConfig> {
  const sb = createServiceClient();

  const upsertRow = {
    location_id: locationId,
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.sendHourUtc !== undefined ? { send_hour_utc: patch.sendHourUtc } : {}),
    ...(patch.includeAiSummary !== undefined ? { include_ai_summary: patch.includeAiSummary } : {}),
    ...(patch.extraRecipients !== undefined ? { extra_recipients: patch.extraRecipients } : {}),
  };

  const { data, error } = await sb
    .from('digest_email_config')
    .upsert(upsertRow, { onConflict: 'location_id' })
    .select()
    .maybeSingle();

  if (error || !data) throw new Error(error?.message ?? 'upsert failed');

  return {
    id: data.id as string,
    locationId: data.location_id as string,
    enabled: data.enabled as boolean,
    sendHourUtc: data.send_hour_utc as number,
    includeAiSummary: data.include_ai_summary as boolean,
    extraRecipients: (data.extra_recipients as string[] | null) ?? [],
    updatedAt: data.updated_at as string,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// E-Mail-HTML-Renderer
// ─────────────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtNum(n: number | null | undefined, unit = '', fallback = '–'): string {
  if (n == null) return fallback;
  return `${n}${unit}`;
}

function fmtEur(n: number | null | undefined): string {
  if (n == null) return '–';
  return `€${n.toFixed(2)}`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function anomalyColor(a: DigestAnomaly): string {
  return a.severity === 'critical' ? '#dc2626' : '#d97706';
}

function anomalyBg(a: DigestAnomaly): string {
  return a.severity === 'critical' ? '#fef2f2' : '#fffbeb';
}

function anomalyArrow(a: DigestAnomaly): string {
  return a.direction === 'up' ? '↑' : '↓';
}

function renderMetricsTable(m: DailyMetrics): string {
  const rows: [string, string][] = [
    ['Bestellungen gesamt',    fmtNum(m.orders.total)],
    ['davon Lieferung',        fmtNum(m.orders.delivery)],
    ['davon Abholung',         fmtNum(m.orders.pickup)],
    ['Stornierungsrate',       fmtNum(m.orders.cancellationRatePct, '%')],
    ['Umsatz gesamt',          fmtEur(m.revenue.totalEur)],
    ['Ø Bestellwert',         fmtEur(m.orders.avgValueEur)],
    ['Ø Lieferzeit',          fmtNum(m.performance.avgDeliveryMin, ' Min')],
    ['On-Time-Rate',           fmtNum(m.performance.onTimeRatePct, '%')],
    ['Ø ETA-Abweichung',      fmtNum(m.performance.avgEtaDeviationMin, ' Min')],
    ['Aktive Fahrer',          fmtNum(m.drivers.uniqueActive)],
    ['Ø Lieferungen/Fahrer',  fmtNum(m.drivers.avgDeliveriesPerDriver)],
    ['Kundenzufriedenheit',    fmtNum(m.experience.avgSatisfactionRating, ' ★')],
    ['CDES-Score',             fmtNum(m.experience.avgCdesScore)],
    ['Verspätungen',           fmtNum(m.experience.delayCount)],
    ['Ausgestellte Voucher',   fmtNum(m.experience.delayVouchersIssued)],
  ];

  const rowsHtml = rows
    .map(
      ([label, val]) => `
      <tr>
        <td style="padding:6px 12px;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6">${esc(label)}</td>
        <td style="padding:6px 12px;font-weight:600;font-size:13px;text-align:right;border-bottom:1px solid #f3f4f6">${esc(val)}</td>
      </tr>`,
    )
    .join('');

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;margin-bottom:24px">
    <tbody>${rowsHtml}</tbody>
  </table>`;
}

function renderAnomalies(anomalies: DigestAnomaly[]): string {
  if (anomalies.length === 0) {
    return `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px 16px;margin-bottom:24px;color:#15803d;font-size:13px;font-weight:600">
      ✅ Keine signifikanten Abweichungen zum Vortag erkannt.
    </div>`;
  }

  const items = anomalies
    .map(
      (a) => `<tr>
        <td style="padding:6px 12px;font-size:13px;border-bottom:1px solid #f3f4f6">${esc(a.label)}</td>
        <td style="padding:6px 12px;font-size:13px;text-align:right;border-bottom:1px solid #f3f4f6">
          <span style="color:${anomalyColor(a)};font-weight:700">${anomalyArrow(a)} ${Math.abs(a.deltaPct)}%</span>
        </td>
        <td style="padding:6px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #f3f4f6;white-space:nowrap">
          ${esc(String(a.current))} vs. ${esc(String(a.previous))}
        </td>
        <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6">
          <span style="background:${anomalyBg(a)};color:${anomalyColor(a)};border-radius:99px;padding:2px 8px;font-size:11px;font-weight:700">
            ${a.severity === 'critical' ? 'Kritisch' : 'Warnung'}
          </span>
        </td>
      </tr>`,
    )
    .join('');

  return `
  <h3 style="font-size:14px;font-weight:700;margin:0 0 10px 0;color:#374151">⚠️ Abweichungen zum Vortag</h3>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;margin-bottom:24px">
    <thead>
      <tr style="background:#f9fafb">
        <th style="padding:8px 12px;font-size:12px;text-align:left;color:#6b7280;font-weight:600">Kennzahl</th>
        <th style="padding:8px 12px;font-size:12px;text-align:right;color:#6b7280;font-weight:600">Abw.</th>
        <th style="padding:8px 12px;font-size:12px;text-align:left;color:#6b7280;font-weight:600">Werte</th>
        <th style="padding:8px 12px;font-size:12px;text-align:left;color:#6b7280;font-weight:600">Status</th>
      </tr>
    </thead>
    <tbody>${items}</tbody>
  </table>`;
}

export function renderDigestEmailHtml(
  digest: DailyDigest,
  locationName: string,
  includeAiSummary: boolean,
): string {
  const dateLabel = fmtDate(digest.metrics.date);
  const aiBlock =
    includeAiSummary && digest.aiSummary
      ? `<div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 8px 8px 0;padding:16px;margin-bottom:24px">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#15803d;margin-bottom:8px">✨ KI-Zusammenfassung</div>
          <div style="font-size:13px;line-height:1.6;color:#1f2937;white-space:pre-wrap">${esc(digest.aiSummary)}</div>
        </div>`
      : '';

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Tagesbericht ${dateLabel} — ${esc(locationName)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#111827">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a3a2a 0%,#2d6b45 100%);border-radius:16px 16px 0 0;padding:28px 28px 20px;text-align:center">
      <div style="font-size:36px;margin-bottom:8px">📊</div>
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800">Tagesbericht</h1>
      <div style="color:rgba(255,255,255,0.75);font-size:14px;margin-top:4px">${esc(locationName)} · ${dateLabel}</div>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:28px;border-radius:0 0 16px 16px;border:1px solid #e5e7eb;border-top:0">

      <!-- Schnellübersicht -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;text-align:center">
        <div style="background:#f9fafb;border-radius:10px;padding:14px 8px">
          <div style="font-size:24px;font-weight:800;color:#1a3a2a">${digest.metrics.orders.completed}</div>
          <div style="font-size:11px;color:#6b7280;font-weight:600;margin-top:2px">Lieferungen</div>
        </div>
        <div style="background:#f9fafb;border-radius:10px;padding:14px 8px">
          <div style="font-size:24px;font-weight:800;color:#1a3a2a">${fmtEur(digest.metrics.revenue.totalEur)}</div>
          <div style="font-size:11px;color:#6b7280;font-weight:600;margin-top:2px">Umsatz</div>
        </div>
        <div style="background:#f9fafb;border-radius:10px;padding:14px 8px">
          <div style="font-size:24px;font-weight:800;color:#1a3a2a">${fmtNum(digest.metrics.performance.onTimeRatePct, '%')}</div>
          <div style="font-size:11px;color:#6b7280;font-weight:600;margin-top:2px">On-Time</div>
        </div>
      </div>

      ${aiBlock}

      <!-- Anomalien -->
      ${renderAnomalies(digest.anomalies)}

      <!-- Metriken-Tabelle -->
      <h3 style="font-size:14px;font-weight:700;margin:0 0 10px 0;color:#374151">📋 Alle Kennzahlen</h3>
      ${renderMetricsTable(digest.metrics)}

      <!-- Footer -->
      <div style="border-top:1px solid #f3f4f6;padding-top:16px;text-align:center;color:#9ca3af;font-size:11px">
        Automatisch generiert von Mise Smart Delivery · ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} Uhr
        <br>E-Mail-Versand konfigurierbar unter Lieferdienst → Tages-Digest
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Versand-Log
// ─────────────────────────────────────────────────────────────────────────────

async function logEmailSend(
  locationId: string,
  digestDate: string,
  status: 'sent' | 'failed' | 'skipped',
  recipientsCount: number,
  error?: string,
): Promise<void> {
  const sb = createServiceClient();
  try {
    await sb.from('digest_email_log').upsert(
      {
        location_id: locationId,
        digest_date: digestDate,
        sent_at: new Date().toISOString(),
        recipients_count: recipientsCount,
        status,
        error: error ?? null,
      },
      { onConflict: 'location_id,digest_date' },
    );
  } catch {}
}

export async function getEmailLog(
  locationId: string,
  limit = 30,
): Promise<Array<{
  id: string;
  digestDate: string;
  sentAt: string;
  recipientsCount: number;
  status: 'sent' | 'failed' | 'skipped';
  error: string | null;
}>> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('digest_email_log')
    .select('*')
    .eq('location_id', locationId)
    .order('sent_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    digestDate: r.digest_date as string,
    sentAt: r.sent_at as string,
    recipientsCount: r.recipients_count as number,
    status: r.status as 'sent' | 'failed' | 'skipped',
    error: r.error as string | null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Kernfunktion: Tagesbericht an alle Manager einer Location senden
// ─────────────────────────────────────────────────────────────────────────────

export async function sendDailyDigestEmail(
  locationId: string,
  date?: string,
): Promise<DigestEmailSendResult> {
  const sb = createServiceClient();
  const digestDate = date ?? yesterdayUtc();

  // 1) Konfiguration laden — wenn nicht aktiv, überspringen
  const cfg = await getDigestEmailConfig(locationId);
  if (!cfg?.enabled) {
    return { locationId, status: 'skipped', recipientsCount: 0 };
  }

  // 2) Digest laden — muss bereits generiert sein (Cron 03:00 UTC)
  const digest = await getDailyDigest(locationId, digestDate);
  if (!digest) {
    await logEmailSend(locationId, digestDate, 'skipped', 0, 'Kein Digest vorhanden');
    return { locationId, status: 'skipped', recipientsCount: 0 };
  }

  // 3) Empfänger: alle Manager/Owner + extra_recipients
  const { data: managers } = await sb
    .from('employees')
    .select('email')
    .eq('tenant_id', locationId)
    .in('role', ['owner', 'manager', 'admin'])
    .eq('active', true)
    .not('email', 'is', null);

  const managerEmails = (managers ?? [])
    .map((e) => e.email as string)
    .filter((e) => e && e.includes('@'));

  const allRecipients = Array.from(
    new Set([...managerEmails, ...cfg.extraRecipients]),
  );

  if (allRecipients.length === 0) {
    await logEmailSend(locationId, digestDate, 'skipped', 0, 'Keine Empfänger');
    return { locationId, status: 'skipped', recipientsCount: 0 };
  }

  // 4) Location-Name laden
  const { data: loc } = await sb
    .from('locations')
    .select('name')
    .eq('id', locationId)
    .maybeSingle();
  const locationName = (loc?.name as string | null) ?? 'Standort';

  // 5) HTML rendern
  const html = renderDigestEmailHtml(digest, locationName, cfg.includeAiSummary);
  const dateLabel = fmtDate(digestDate);
  const subject = `📊 Tagesbericht ${dateLabel} — ${locationName}`;

  // 6) E-Mails versenden (eine pro Empfänger, fire-and-forget Fehler)
  let sentCount = 0;
  let lastError: string | undefined;

  for (const to of allRecipients) {
    const result = await sendEmail({ to, subject, html });
    if (result.sent) {
      sentCount++;
    } else {
      lastError = result.error ?? result.skipped;
    }
  }

  const status = sentCount > 0 ? 'sent' : 'failed';
  await logEmailSend(locationId, digestDate, status, sentCount, lastError);

  return {
    locationId,
    status,
    recipientsCount: sentCount,
    error: lastError,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cron-Batch: alle aktiven Locations
// ─────────────────────────────────────────────────────────────────────────────

export async function sendDailyDigestAllLocations(
  date?: string,
): Promise<DigestMailerBatchResult> {
  const sb = createServiceClient();
  const digestDate = date ?? yesterdayUtc();

  // Nur Locations mit aktivierter E-Mail-Konfiguration
  const { data: configs } = await sb
    .from('digest_email_config')
    .select('location_id')
    .eq('enabled', true);

  if (!configs || configs.length === 0) {
    return { locations: 0, sent: 0, skipped: 0, failed: 0, errors: 0 };
  }

  const results = await Promise.allSettled(
    configs.map((c) => sendDailyDigestEmail(c.location_id as string, digestDate)),
  );

  let sent = 0, skipped = 0, failed = 0, errors = 0;
  for (const r of results) {
    if (r.status === 'rejected') { errors++; continue; }
    if (r.value.status === 'sent') sent++;
    else if (r.value.status === 'skipped') skipped++;
    else failed++;
  }

  return { locations: configs.length, sent, skipped, failed, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hilfe
// ─────────────────────────────────────────────────────────────────────────────

function yesterdayUtc(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
