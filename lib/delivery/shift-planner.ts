/**
 * lib/delivery/shift-planner.ts
 *
 * Besetzungs-Cockpit — Phase 88
 *
 * Kombiniert Nachfrage-Prognose mit geplanten Fahrer-Schichten und
 * berechnet stundengenaue Besetzungsstatus für die nächsten N Tage.
 *
 * Funktionen:
 *  - getStaffingPlan()   — 7-Tage-Plan (Forecast ↔ Schichten ↔ Anforderungen)
 *  - getStaffingDay()    — Einzeltag-Detailansicht
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { getForecast } from './forecast';

// ============================================================
// Typen
// ============================================================

export type CoverageStatus = 'ok' | 'low' | 'gap' | 'over' | 'off';

export interface StaffingSlot {
  hourUtc: string;
  hourLocal: string;       // "HH:MM"
  dayLabel: string;        // "Mo 12.06."
  weekday: number;         // 0=So … 6=Sa
  hourOfDay: number;       // 0–23 (Berliner Zeit)
  expectedOrders: number;
  recommendedMin: number;
  recommendedTarget: number;
  scheduledDrivers: number;
  status: CoverageStatus;
}

export interface StaffingDay {
  date: string;            // "YYYY-MM-DD" (Berliner Datum)
  dayLabel: string;        // "Mo 12.06."
  slots: StaffingSlot[];
  gapCount: number;
  lowCount: number;
  okCount: number;
  coveragePct: number;     // 0–100, Anteil ok+over Stunden
}

export interface StaffingPlan {
  locationId: string;
  generatedAt: string;
  days: StaffingDay[];
  summary: {
    totalGaps: number;
    totalLow: number;
    totalOk: number;
    totalOver: number;
    peakDriverNeed: number;
    avgCoveragePct: number;
  };
}

// ============================================================
// Hilfsfunktionen
// ============================================================

const WEEKDAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;

function berlinOffset(d: Date): number {
  const jan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const jul = new Date(Date.UTC(d.getUTCFullYear(), 6, 1));
  const stdOffset = Math.max(
    -jan.getTimezoneOffset(),
    -jul.getTimezoneOffset(),
  );
  return stdOffset > 60 ? 120 : 60;
}

function toLocalDate(utc: Date): Date {
  return new Date(utc.getTime() + berlinOffset(utc) * 60_000);
}

function coverageStatus(
  scheduled: number,
  min: number,
  target: number,
  expectedOrders: number,
): CoverageStatus {
  if (expectedOrders === 0 && min === 0) return 'off';
  if (scheduled === 0 && min === 0) return 'off';
  if (scheduled >= target + 2) return 'over';
  if (scheduled >= target) return 'ok';
  if (scheduled >= min) return 'low';
  return 'gap';
}

// ============================================================
// getStaffingPlan
// ============================================================

/**
 * Erstellt einen stundengenauen Besetzungsplan für die nächsten `daysAhead` Tage.
 * Kombiniert Nachfrage-Forecast, geplante Schichten und Coverage-Anforderungen.
 */
export async function getStaffingPlan(
  locationId: string,
  daysAhead = 7,
): Promise<StaffingPlan> {
  const sb = createServiceClient();
  const now = new Date();
  const hoursAhead = daysAhead * 24;
  const windowEnd = new Date(now.getTime() + hoursAhead * 3_600_000);

  // ── 1. Forecast laden ──────────────────────────────────────
  const forecast = await getForecast(locationId, hoursAhead);

  // ── 2. Alle überlappenden Schichten laden ─────────────────
  // Schichten die in das Planfenster hineinreichen (start < windowEnd AND end > now)
  const { data: shifts } = await sb
    .from('driver_shifts')
    .select('id, driver_id, planned_start, planned_end, actual_start, actual_end, status')
    .eq('location_id', locationId)
    .in('status', ['scheduled', 'active'])
    .lt('planned_start', windowEnd.toISOString())
    .gt('planned_end', now.toISOString());

  const shiftList = (shifts ?? []) as Array<{
    id: string;
    driver_id: string;
    planned_start: string;
    planned_end: string;
    actual_start: string | null;
    actual_end: string | null;
    status: string;
  }>;

  // ── 3. Stunden-Index: UTC-Stunden-Bucket → Anzahl Fahrer ──
  const driversByHour = new Map<string, number>();

  for (const shift of shiftList) {
    const start = new Date(shift.planned_start);
    const end   = new Date(shift.planned_end);

    // Für jede Stunde im Schicht-Intervall +1
    let cursor = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), start.getUTCHours()),
    );
    while (cursor < end && cursor < windowEnd) {
      const key = cursor.toISOString();
      driversByHour.set(key, (driversByHour.get(key) ?? 0) + 1);
      cursor = new Date(cursor.getTime() + 3_600_000);
    }
  }

  // ── 4. Slots zu Tagen gruppieren ──────────────────────────
  const dayMap = new Map<string, StaffingSlot[]>();

  for (const slot of forecast.slots) {
    const utc = new Date(slot.hourUtc);
    const local = toLocalDate(utc);
    const date = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;

    const weekday = local.getUTCDay();
    const dayLabel = `${WEEKDAY_LABELS[weekday]} ${String(local.getUTCDate()).padStart(2, '0')}.${String(local.getUTCMonth() + 1).padStart(2, '0')}.`;

    const bucketKey = new Date(
      Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), utc.getUTCHours()),
    ).toISOString();

    const scheduled = driversByHour.get(bucketKey) ?? 0;
    const status = coverageStatus(
      scheduled,
      slot.recommendedMinDrivers,
      slot.recommendedTargetDrivers,
      slot.expectedOrders,
    );

    const staffingSlot: StaffingSlot = {
      hourUtc:           slot.hourUtc,
      hourLocal:         slot.hourLocal,
      dayLabel,
      weekday,
      hourOfDay:         slot.hourOfDay,
      expectedOrders:    slot.expectedOrders,
      recommendedMin:    slot.recommendedMinDrivers,
      recommendedTarget: slot.recommendedTargetDrivers,
      scheduledDrivers:  scheduled,
      status,
    };

    const existing = dayMap.get(date) ?? [];
    existing.push(staffingSlot);
    dayMap.set(date, existing);
  }

  // ── 5. StaffingDay-Objekte bauen ──────────────────────────
  const days: StaffingDay[] = [];
  let totalGaps = 0;
  let totalLow  = 0;
  let totalOk   = 0;
  let totalOver = 0;

  for (const [date, slots] of dayMap) {
    slots.sort((a, b) => a.hourOfDay - b.hourOfDay);
    const firstSlot = slots[0];
    const gapCount = slots.filter((s) => s.status === 'gap').length;
    const lowCount = slots.filter((s) => s.status === 'low').length;
    const okCount  = slots.filter((s) => s.status === 'ok' || s.status === 'over').length;
    const activeSlots = slots.filter((s) => s.status !== 'off').length;
    const coveragePct = activeSlots > 0 ? Math.round((okCount / activeSlots) * 100) : 100;

    totalGaps += gapCount;
    totalLow  += lowCount;
    totalOk   += okCount;
    totalOver += slots.filter((s) => s.status === 'over').length;

    days.push({
      date,
      dayLabel: firstSlot?.dayLabel ?? date,
      slots,
      gapCount,
      lowCount,
      okCount,
      coveragePct,
    });
  }

  days.sort((a, b) => a.date.localeCompare(b.date));

  const peakDriverNeed = forecast.summary.recommendedMaxDrivers;
  const avgCoveragePct = days.length > 0
    ? Math.round(days.reduce((s, d) => s + d.coveragePct, 0) / days.length)
    : 0;

  return {
    locationId,
    generatedAt: now.toISOString(),
    days,
    summary: {
      totalGaps,
      totalLow,
      totalOk,
      totalOver,
      peakDriverNeed,
      avgCoveragePct,
    },
  };
}
