/**
 * lib/delivery/fahrer-verfuegbarkeit.ts — Phase 434
 *
 * Fahrer-Verfügbarkeits-Kalender: Wochenübersicht geplanter Fahrerschichten
 * mit Überstunden-Flag und Mindestbesetzungs-Alarm.
 *
 * Liest live aus driver_shifts (planned_start, planned_end) + employees.
 *
 * Flags:
 *   ueberstunden       — Schicht > 8h
 *   mindestbesetzungOk — ≥ MIN_DRIVER_COUNT Fahrer auf dem Tag
 *
 * Public API:
 *   getVerfuegbarkeitsKalender(locationId, days?) — 7-Tage-Übersicht
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

const MIN_DRIVER_COUNT = 2;

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface FahrerSchicht {
  shiftId:      string;
  driverId:     string;
  driverName:   string | null;
  vehicle:      string | null;
  plannedStart: string;
  plannedEnd:   string | null;
  durationH:    number | null;
  ueberstunden: boolean;
  status:       string;
}

export interface TagesUebersicht {
  datum:             string;          // YYYY-MM-DD
  wochentag:         string;          // Mo, Di, Mi …
  schichten:         FahrerSchicht[];
  fahrerAnzahl:      number;
  mindestbesetzungOk: boolean;
  alarm:             boolean;         // kritisch: < MIN_DRIVER_COUNT
}

export interface VerfuegbarkeitsKalender {
  locationId: string;
  tage:       TagesUebersicht[];
  generatedAt: string;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function utcDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function durationHours(start: string, end: string | null): number | null {
  if (!end) return null;
  return (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
}

// ── Haupt-Funktion ─────────────────────────────────────────────────────────────

export async function getVerfuegbarkeitsKalender(
  locationId: string,
  days = 7,
): Promise<VerfuegbarkeitsKalender> {
  const sb  = createServiceClient();
  const now = new Date();
  // Start today (midnight UTC)
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endDate      = new Date(startOfToday.getTime() + days * 86_400_000);

  const { data: shifts } = await sb
    .from('driver_shifts')
    .select(`
      id, driver_id, planned_start, planned_end, status,
      employees!driver_id (name, vehicle)
    `)
    .eq('location_id', locationId)
    .gte('planned_start', startOfToday.toISOString())
    .lt('planned_start', endDate.toISOString())
    .order('planned_start', { ascending: true });

  // Build date range
  const dateMap = new Map<string, FahrerSchicht[]>();
  for (let i = 0; i < days; i++) {
    const d = new Date(startOfToday.getTime() + i * 86_400_000);
    dateMap.set(utcDateStr(d), []);
  }

  for (const s of (shifts ?? [])) {
    const datum = (s.planned_start as string).slice(0, 10);
    if (!dateMap.has(datum)) dateMap.set(datum, []);
    const emp     = s.employees as { name?: string; vehicle?: string } | null;
    const durH    = durationHours(s.planned_start as string, s.planned_end as string | null);
    const schicht: FahrerSchicht = {
      shiftId:      s.id,
      driverId:     s.driver_id,
      driverName:   emp?.name ?? null,
      vehicle:      emp?.vehicle ?? null,
      plannedStart: s.planned_start as string,
      plannedEnd:   s.planned_end as string | null,
      durationH:    durH !== null ? Math.round(durH * 10) / 10 : null,
      ueberstunden: durH !== null && durH > 8,
      status:       s.status ?? 'planned',
    };
    dateMap.get(datum)!.push(schicht);
  }

  const tage: TagesUebersicht[] = Array.from(dateMap.entries()).map(([datum, schichten]) => {
    const unique     = new Set(schichten.map((s) => s.driverId)).size;
    const alarm      = unique < MIN_DRIVER_COUNT;
    const date       = new Date(datum + 'T12:00:00Z');
    return {
      datum,
      wochentag:          WOCHENTAG[date.getUTCDay()],
      schichten,
      fahrerAnzahl:       unique,
      mindestbesetzungOk: !alarm,
      alarm,
    };
  });

  return { locationId, tage, generatedAt: new Date().toISOString() };
}
