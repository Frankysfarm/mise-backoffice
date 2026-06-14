/**
 * lib/delivery/shift-suggestions.ts — Phase 156
 *
 * Auto-Shift Vorschläge Engine
 *
 * Analysiert Nachfrage-Prognosen + bestehende Fahrer-Schichten und generiert
 * automatisch Besetzungs-Vorschläge für Stunden mit Unterdeckung.
 *
 * Logik:
 *   1. Demand-Forecast für die nächsten 7 Tage holen (forecast.ts)
 *   2. Bestehende Schichten für denselben Zeitraum laden
 *   3. Stunden mit coverage_gap > 0 (benötigt > geplant) → Suggestion
 *   4. Bereits offene Suggestions nicht duplizieren (UPSERT)
 *   5. Confidence: 70% wenn Prognose-Basis ≥5 Wochen, sonst 40%
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface ShiftSuggestion {
  id: string;
  locationId: string;
  suggestionDate: string;       // YYYY-MM-DD
  startHour: number;            // 0–23
  endHour: number;              // 1–24
  driversNeeded: number;
  driversScheduled: number;
  coverageGap: number;
  expectedOrders: number;
  confidence: number;           // 0–100
  status: 'pending' | 'accepted' | 'ignored' | 'applied';
  generatedBy: string;
  acceptedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateSuggestionsResult {
  locationId: string;
  daysAnalyzed: number;
  suggestionsCreated: number;
  suggestionsUpdated: number;
  errors: number;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function ordersToDriversNeeded(expectedOrders: number): number {
  // Faustregel: 1 Fahrer je 3 erwartete Bestellungen pro Stunde (min 1)
  return Math.max(1, Math.ceil(expectedOrders / 3));
}

// Berliner Ortszeit (UTC+1/+2) aus UTC-Stunde ableiten
function utcHourToBerlinHour(utcHour: number, date: string): number {
  const d = new Date(`${date}T${String(utcHour).padStart(2, '0')}:00:00Z`);
  return d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false }) === '24'
    ? 0
    : Number(d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric', hour12: false }));
}

// Datum + n Tage voraus (YYYY-MM-DD)
function addDays(date: string, n: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Kern-Funktion ─────────────────────────────────────────────────────────────

/**
 * Generiert Schicht-Vorschläge für eine Location basierend auf Demand-Forecast.
 * Analysiert die nächsten 7 Tage und schlägt Lückenstunden vor.
 */
export async function generateShiftSuggestions(
  locationId: string,
  daysAhead = 7,
): Promise<GenerateSuggestionsResult> {
  const sb = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const horizon = addDays(today, daysAhead);

  let suggestionsCreated = 0;
  let suggestionsUpdated = 0;
  let errors = 0;

  // 1. Demand-Prognose holen (historische Hourly-Aggregaten)
  //    Wir nutzen customer_orders aus den letzten 4 Wochen als Basis (kein externer Forecast nötig)
  const fourWeeksAgo = addDays(today, -28);

  const { data: historicData } = await sb
    .from('customer_orders')
    .select('created_at')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .in('status', ['geliefert', 'abgeschlossen'])
    .gte('created_at', `${fourWeeksAgo}T00:00:00Z`)
    .lt('created_at', `${today}T00:00:00Z`)
    .limit(5000);

  if (!historicData) {
    return { locationId, daysAnalyzed: 0, suggestionsCreated: 0, suggestionsUpdated: 0, errors: 1 };
  }

  // Stunden-Aggregation: durchschnittliche Bestellungen je Wochentag+Stunde
  const heatmap = new Map<string, number[]>(); // key: `weekday:hour` → list of order counts

  for (const row of historicData) {
    const d = new Date(row.created_at as string);
    const weekday = d.getUTCDay();  // 0=So
    const hour    = d.getUTCHours();
    const key = `${weekday}:${hour}`;
    const bucket = heatmap.get(key) ?? [];
    bucket.push(1);
    heatmap.set(key, bucket);
  }

  // Mittelwert pro Wochentag+Stunde berechnen (über 4 Wochen = ~4 Datenpunkte/Slot)
  const avgBySlot = new Map<string, number>();
  const weeksInHistory = 4;
  for (const [key, counts] of heatmap) {
    avgBySlot.set(key, counts.length / weeksInHistory);
  }

  // 2. Bestehende Schichten für den Analyse-Zeitraum laden
  const { data: existingShifts } = await sb
    .from('driver_shifts')
    .select('scheduled_date, start_time, end_time, driver_id')
    .eq('location_id', locationId)
    .gte('scheduled_date', today)
    .lte('scheduled_date', horizon)
    .in('status', ['scheduled', 'active']);

  // Schichten pro Datum+Stunde zählen
  const scheduledBySlot = new Map<string, number>(); // `date:hour` → driver count
  for (const s of existingShifts ?? []) {
    const date  = s.scheduled_date as string;
    const startH = parseInt((s.start_time as string).slice(0, 2), 10);
    const endH   = parseInt((s.end_time as string).slice(0, 2), 10);
    for (let h = startH; h < endH; h++) {
      const key = `${date}:${h}`;
      scheduledBySlot.set(key, (scheduledBySlot.get(key) ?? 0) + 1);
    }
  }

  // 3. Jeden zukünftigen Tag analysieren
  let daysAnalyzed = 0;

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const targetDate = addDays(today, dayOffset + 1);
    const weekday    = new Date(targetDate).getUTCDay();
    daysAnalyzed++;

    // Gruppen aufeinanderfolgender Lücken-Stunden zu Blöcken zusammenfassen
    let blockStart: number | null = null;
    let blockGap   = 0;
    let blockOrders = 0;
    let blockScheduled = 0;
    let blockNeeded = 0;

    async function flushBlock(startH: number, endH: number): Promise<void> {
      if (blockGap <= 0) return;
      const confidence = historicData!.length >= 20 ? 70 : 40;
      const upsertRow = {
        location_id:       locationId,
        suggestion_date:   targetDate,
        start_hour:        startH,
        end_hour:          endH,
        drivers_needed:    blockNeeded,
        drivers_scheduled: blockScheduled,
        coverage_gap:      blockGap,
        expected_orders:   blockOrders,
        confidence,
        status:            'pending',
        generated_by:      'auto',
      };

      const { error } = await sb
        .from('delivery_shift_suggestions')
        .upsert(upsertRow, {
          onConflict:       'location_id,suggestion_date,start_hour',
          ignoreDuplicates: false,
        });

      if (error) {
        errors++;
      } else {
        suggestionsCreated++;
      }
    }

    for (let hourUtc = 8; hourUtc <= 23; hourUtc++) {
      const key          = `${weekday}:${hourUtc}`;
      const dateHourKey  = `${targetDate}:${hourUtc}`;
      const avgOrders    = avgBySlot.get(key) ?? 0;
      const scheduled    = scheduledBySlot.get(dateHourKey) ?? 0;
      const needed       = ordersToDriversNeeded(avgOrders);
      const gap          = Math.max(0, needed - scheduled);

      if (gap > 0 && avgOrders >= 0.5) {
        // Stunde hat Lücke — zu aktuellem Block hinzufügen oder neuen starten
        if (blockStart === null) {
          blockStart     = hourUtc;
          blockGap       = gap;
          blockOrders    = Math.round(avgOrders);
          blockScheduled = scheduled;
          blockNeeded    = needed;
        } else {
          blockGap       = Math.max(blockGap, gap);
          blockOrders   += Math.round(avgOrders);
          blockScheduled = Math.min(blockScheduled, scheduled);
          blockNeeded    = Math.max(blockNeeded, needed);
        }
      } else if (blockStart !== null) {
        // Block abschließen
        await flushBlock(blockStart, hourUtc);
        blockStart     = null;
        blockGap       = 0;
        blockOrders    = 0;
        blockScheduled = 0;
        blockNeeded    = 0;
      }
    }

    // Letzter Block des Tages
    if (blockStart !== null) {
      await flushBlock(blockStart, 23);
    }
  }

  return { locationId, daysAnalyzed, suggestionsCreated, suggestionsUpdated, errors };
}

/** Cron-Batch: Vorschläge für alle aktiven Locations generieren. */
export async function generateShiftSuggestionsAllLocations(): Promise<{
  locations: number;
  suggestionsCreated: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(50);

  if (!locations || locations.length === 0) return { locations: 0, suggestionsCreated: 0, errors: 0 };

  let suggestionsCreated = 0;
  let errors = 0;

  const results = await Promise.allSettled(
    locations.map((l) => generateShiftSuggestions(l.id as string)),
  );

  for (const r of results) {
    if (r.status === 'fulfilled') {
      suggestionsCreated += r.value.suggestionsCreated;
      errors             += r.value.errors;
    } else {
      errors++;
    }
  }

  return { locations: locations.length, suggestionsCreated, errors };
}

/** Offene Vorschläge für eine Location holen. */
export async function getShiftSuggestions(
  locationId: string,
  opts: { status?: string; fromDate?: string; limit?: number } = {},
): Promise<ShiftSuggestion[]> {
  const sb = createServiceClient();
  const { status = 'pending', fromDate, limit = 50 } = opts;

  let q = sb
    .from('delivery_shift_suggestions')
    .select('*')
    .eq('location_id', locationId)
    .order('suggestion_date', { ascending: true })
    .order('start_hour', { ascending: true })
    .limit(limit);

  if (status !== 'all') q = q.eq('status', status);
  if (fromDate)         q = q.gte('suggestion_date', fromDate);

  const { data } = await q;
  return (data ?? []).map(_mapRow);
}

/** Vorschlag annehmen oder ignorieren. */
export async function updateSuggestionStatus(
  suggestionId: string,
  locationId: string,
  newStatus: 'accepted' | 'ignored',
  userId: string,
): Promise<ShiftSuggestion | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_shift_suggestions')
    .update({
      status:      newStatus,
      accepted_at: newStatus === 'accepted' ? new Date().toISOString() : null,
      accepted_by: newStatus === 'accepted' ? userId : null,
    })
    .eq('id', suggestionId)
    .eq('location_id', locationId)
    .select()
    .maybeSingle();

  return data ? _mapRow(data) : null;
}

/** Veraltete pending-Vorschläge (vergangene Daten) bereinigen. */
export async function pruneStaleSuggestions(): Promise<number> {
  const sb = createServiceClient();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const { count } = await sb
    .from('delivery_shift_suggestions')
    .delete({ count: 'exact' })
    .eq('status', 'pending')
    .lt('suggestion_date', yesterday);
  return count ?? 0;
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function _mapRow(row: Record<string, unknown>): ShiftSuggestion {
  return {
    id:               row.id as string,
    locationId:       row.location_id as string,
    suggestionDate:   row.suggestion_date as string,
    startHour:        row.start_hour as number,
    endHour:          row.end_hour as number,
    driversNeeded:    row.drivers_needed as number,
    driversScheduled: row.drivers_scheduled as number,
    coverageGap:      row.coverage_gap as number,
    expectedOrders:   row.expected_orders as number,
    confidence:       Number(row.confidence),
    status:           row.status as ShiftSuggestion['status'],
    generatedBy:      row.generated_by as string,
    acceptedAt:       (row.accepted_at as string | null) ?? null,
    notes:            (row.notes as string | null) ?? null,
    createdAt:        row.created_at as string,
    updatedAt:        row.updated_at as string,
  };
}
