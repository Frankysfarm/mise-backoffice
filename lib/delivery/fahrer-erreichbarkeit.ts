/**
 * lib/delivery/fahrer-erreichbarkeit.ts — Phase 426
 *
 * Fahrer-Erreichbarkeits-Engine:
 * 30 Min vor Schichtbeginn werden alle eingeplanten Fahrer via Push angepingt.
 * Antworten (bestätigt/abgelehnt/keine_antwort) werden in fahrer_erreichbarkeit_log gespeichert.
 *
 * Public API:
 *   pingUpcomingShifts(locationId)                  — Pings auslösen (Cron alle 5 Min)
 *   pingUpcomingShiftsAllLocations()                — Alle Standorte (Cron-Batch)
 *   recordAnswer(logId, antwort)                    — Antwort eines Fahrers speichern
 *   getDashboard(locationId)                        — Dashboard-Daten für Dispatch
 *   getNextShiftOverview(locationId)                — Nächste Schicht: Bestätigt/Offen/Abgelehnt
 *   pruneOldLogs(daysOld?)                          — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type ErreichbarkeitAntwort = 'bestätigt' | 'abgelehnt' | 'keine_antwort';
export type PingKanal = 'push' | 'sms';

export interface ErreichbarkeitLog {
  id:            string;
  locationId:    string;
  driverId:      string;
  schichtId:     string | null;
  gepingtAm:     string;
  antwort:       ErreichbarkeitAntwort;
  kanal:         PingKanal;
  schichtStart:  string | null;
  geantwortetAm: string | null;
}

export interface FahrerErreichbarkeitStatus {
  driverId:     string;
  driverName:   string;
  schichtStart: string | null;
  antwort:      ErreichbarkeitAntwort;
  logId:        string | null;
  gepingtAm:    string | null;
}

export interface ErreichbarkeitDashboard {
  nextShiftStart:   string | null;
  totalPinged:      number;
  bestätigt:        number;
  abgelehnt:        number;
  keineAntwort:     number;
  confirmRate:      number;  // 0–1
  fahrer:           FahrerErreichbarkeitStatus[];
  lastUpdated:      string;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function normalizeLog(r: Record<string, unknown>): ErreichbarkeitLog {
  return {
    id:            r['id'] as string,
    locationId:    r['location_id'] as string,
    driverId:      r['driver_id'] as string,
    schichtId:     (r['schicht_id'] as string | null) ?? null,
    gepingtAm:     r['gepingt_am'] as string,
    antwort:       r['antwort'] as ErreichbarkeitAntwort,
    kanal:         r['kanal'] as PingKanal,
    schichtStart:  (r['schicht_start'] as string | null) ?? null,
    geantwortetAm: (r['geantwortet_am'] as string | null) ?? null,
  };
}

/** Sendet eine Push-Nachricht in mise_push_outbox (fire-and-forget). */
async function enqueuePing(driverId: string, schichtStart: string | null): Promise<void> {
  const sb = createServiceClient();

  const startLabel = schichtStart
    ? new Date(schichtStart).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Berlin',
      })
    : 'bald';

  await sb.from('mise_push_outbox').insert({
    driver_id: driverId,
    type:      'shift_ping',
    title:     `Schichtstart um ${startLabel}`,
    body:      'Kannst du heute fahren? Bitte bestätigen.',
    sound:     'default',
    data:      JSON.stringify({ type: 'shift_ping', schicht_start: schichtStart }),
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Pingt alle Fahrer, deren nächste Schicht in 25–35 Min beginnt
 * und die noch nicht angepingt wurden (heute, diese Schicht).
 *
 * Wird alle 5 Min vom Cron aufgerufen.
 */
export async function pingUpcomingShifts(locationId: string): Promise<{
  pinged:   number;
  skipped:  number;
}> {
  const sb = createServiceClient();

  const now     = new Date();
  const from    = new Date(now.getTime() + 25 * 60 * 1000).toISOString();
  const to      = new Date(now.getTime() + 35 * 60 * 1000).toISOString();
  const todayStr = now.toISOString().slice(0, 10);

  // Schichten, die in 25–35 Min beginnen
  const { data: shifts, error: shiftErr } = await sb
    .from('driver_shifts')
    .select('id, driver_id, start_time')
    .eq('location_id', locationId)
    .eq('status', 'scheduled')
    .gte('start_time', from)
    .lte('start_time', to);

  if (shiftErr || !shifts?.length) return { pinged: 0, skipped: 0 };

  let pinged  = 0;
  let skipped = 0;

  for (const shift of shifts) {
    // Bereits heute für diese Schicht angepingt?
    const { data: existing } = await sb
      .from('fahrer_erreichbarkeit_log')
      .select('id')
      .eq('driver_id', shift['driver_id'])
      .eq('schicht_id', shift['id'])
      .gte('gepingt_am', `${todayStr}T00:00:00Z`)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    // Log-Eintrag anlegen (noch keine Antwort)
    const { data: logRow, error: insertErr } = await sb
      .from('fahrer_erreichbarkeit_log')
      .insert({
        location_id:   locationId,
        driver_id:     shift['driver_id'],
        schicht_id:    shift['id'],
        schicht_start: shift['start_time'],
        antwort:       'keine_antwort',
        kanal:         'push',
      })
      .select('id')
      .single();

    if (insertErr || !logRow) {
      skipped++;
      continue;
    }

    // Push-Benachrichtigung senden (fire-and-forget)
    try {
      await enqueuePing(shift['driver_id'] as string, shift['start_time'] as string);
    } catch {
      // Push-Fehler blockieren nicht
    }

    pinged++;
  }

  return { pinged, skipped };
}

/** Alle Standorte pingen (Cron-Batch via Promise.allSettled). */
export async function pingUpcomingShiftsAllLocations(): Promise<{
  locations: number;
  pinged:    number;
}> {
  const sb = createServiceClient();

  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('is_active', true);

  if (!locs?.length) return { locations: 0, pinged: 0 };

  const results = await Promise.allSettled(
    locs.map((l) => pingUpcomingShifts(l['id'] as string)),
  );

  let totalPinged = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') totalPinged += r.value.pinged;
  }

  return { locations: locs.length, pinged: totalPinged };
}

/**
 * Speichert die Antwort eines Fahrers (bestätigt/abgelehnt).
 * Wird von der Fahrer-App aufgerufen.
 */
export async function recordAnswer(
  logId:   string,
  antwort: 'bestätigt' | 'abgelehnt',
): Promise<{ ok: boolean }> {
  const sb = createServiceClient();

  const { error } = await sb
    .from('fahrer_erreichbarkeit_log')
    .update({ antwort, geantwortet_am: new Date().toISOString() })
    .eq('id', logId);

  return { ok: !error };
}

/**
 * Gibt das Dashboard für eine Location zurück:
 * Nächste Schicht, Ping-Status aller Fahrer.
 */
export async function getDashboard(locationId: string): Promise<ErreichbarkeitDashboard> {
  const sb = createServiceClient();

  const now     = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Nächste geplante Schicht finden
  const { data: nextShiftRow } = await sb
    .from('driver_shifts')
    .select('start_time')
    .eq('location_id', locationId)
    .eq('status', 'scheduled')
    .gte('start_time', now.toISOString())
    .order('start_time', { ascending: true })
    .limit(1)
    .maybeSingle();

  const nextShiftStart = (nextShiftRow?.['start_time'] as string | null) ?? null;

  // Alle heutigen Pings für diese Location
  const { data: logs } = await sb
    .from('fahrer_erreichbarkeit_log')
    .select('id, driver_id, antwort, gepingt_am, schicht_start, geantwortet_am')
    .eq('location_id', locationId)
    .gte('gepingt_am', `${todayStr}T00:00:00Z`)
    .order('gepingt_am', { ascending: false });

  // Fahrernamen laden
  const driverIds = [...new Set((logs ?? []).map((l) => l['driver_id'] as string))];
  let driverNames: Record<string, string> = {};
  if (driverIds.length) {
    const { data: drivers } = await sb
      .from('mise_drivers')
      .select('id, name')
      .in('id', driverIds);
    for (const d of drivers ?? []) {
      driverNames[d['id'] as string] = (d['name'] as string) ?? 'Unbekannt';
    }
  }

  // Deduplizieren: je Fahrer nur den letzten Ping
  const byDriver = new Map<string, Record<string, unknown>>();
  for (const log of logs ?? []) {
    const did = log['driver_id'] as string;
    if (!byDriver.has(did)) byDriver.set(did, log as Record<string, unknown>);
  }

  const fahrer: FahrerErreichbarkeitStatus[] = [];
  for (const [driverId, log] of byDriver) {
    fahrer.push({
      driverId,
      driverName:   driverNames[driverId] ?? 'Unbekannt',
      schichtStart: (log['schicht_start'] as string | null) ?? null,
      antwort:      log['antwort'] as ErreichbarkeitAntwort,
      logId:        log['id'] as string,
      gepingtAm:    log['gepingt_am'] as string,
    });
  }

  const totalPinged  = fahrer.length;
  const bestätigt    = fahrer.filter((f) => f.antwort === 'bestätigt').length;
  const abgelehnt    = fahrer.filter((f) => f.antwort === 'abgelehnt').length;
  const keineAntwort = fahrer.filter((f) => f.antwort === 'keine_antwort').length;

  return {
    nextShiftStart,
    totalPinged,
    bestätigt,
    abgelehnt,
    keineAntwort,
    confirmRate: totalPinged > 0 ? bestätigt / totalPinged : 0,
    fahrer,
    lastUpdated: now.toISOString(),
  };
}

/**
 * Kompakt-Übersicht für nächste Schicht (für Badge/Chip in Dispatch).
 */
export async function getNextShiftOverview(locationId: string): Promise<{
  nextShiftStart: string | null;
  bestätigt:      number;
  keineAntwort:   number;
  abgelehnt:      number;
  total:          number;
}> {
  const dashboard = await getDashboard(locationId);
  return {
    nextShiftStart: dashboard.nextShiftStart,
    bestätigt:      dashboard.bestätigt,
    keineAntwort:   dashboard.keineAntwort,
    abgelehnt:      dashboard.abgelehnt,
    total:          dashboard.totalPinged,
  };
}

/** Löscht alte Logs via SQL-Funktion. */
export async function pruneOldLogs(daysOld = 30): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_fahrer_erreichbarkeit_log', { days_old: daysOld });
  return typeof data === 'number' ? data : 0;
}
