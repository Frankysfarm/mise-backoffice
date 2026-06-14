/**
 * lib/delivery/shift-calendar.ts
 *
 * Schicht-Wochenkalender — Phase 161
 *
 * Lädt Schichtdaten + Coverage-Anforderungen für eine 7-Tage-Woche
 * und strukturiert sie als Kalender-Grid (Tag × Stunde).
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type ShiftStatus = 'scheduled' | 'active' | 'completed' | 'missed' | 'cancelled';

export interface CalendarShift {
  id: string;
  driverId: string;
  driverName: string;
  driverVehicle: string;
  plannedStart: string;   // ISO
  plannedEnd: string;     // ISO
  actualStart: string | null;
  actualEnd: string | null;
  status: ShiftStatus;
  notes: string | null;
  startHour: number;      // 0–23 local
  endHour: number;        // 0–23 local (exclusive, can be 24)
  durationH: number;
}

export interface CalendarHour {
  hour: number;           // 0–23
  scheduledCount: number;
  minRequired: number;
  targetRequired: number;
  coverage: 'ok' | 'low' | 'gap' | 'over' | 'off';
}

export interface CalendarDay {
  date: string;           // YYYY-MM-DD
  dayLabel: string;       // "Mo", "Di", …
  dateLabel: string;      // "14.06."
  shifts: CalendarShift[];
  hours: CalendarHour[];
  totalShifts: number;
  gapCount: number;
  peakDriverNeed: number;
}

export interface WeekCalendar {
  locationId: string;
  weekStart: string;      // YYYY-MM-DD (Monday)
  weekEnd: string;        // YYYY-MM-DD (Sunday)
  generatedAt: string;
  days: CalendarDay[];
  summary: {
    totalShifts: number;
    totalGaps: number;
    uniqueDrivers: number;
    peakDriverNeed: number;
    avgCoveragePct: number;
  };
  drivers: { id: string; name: string; vehicle: string }[];
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

const DAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function isoToLocalHour(isoStr: string): number {
  const d = new Date(isoStr);
  return d.getHours();
}

function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${d}.${m}.`;
}

function determineCoverage(
  scheduled: number,
  min: number,
  target: number,
  isOperatingHour: boolean,
): CalendarHour['coverage'] {
  if (!isOperatingHour) return 'off';
  if (scheduled === 0 && min === 0) return 'off';
  if (scheduled === 0 && min > 0) return 'gap';
  if (scheduled < min) return 'gap';
  if (scheduled < target) return 'low';
  if (scheduled > target + 1) return 'over';
  return 'ok';
}

// ─── Haupt-Funktion ───────────────────────────────────────────────────────────

/**
 * Lädt den Schicht-Kalender für eine Woche (weekStart = Montag).
 * Wenn weekStart nicht angegeben, wird die aktuelle Woche verwendet.
 */
export async function getWeekCalendar(
  locationId: string,
  weekStartDate?: Date,
): Promise<WeekCalendar> {
  const sb = createServiceClient();

  // Wochenanfang bestimmen (Montag)
  let weekStart: Date;
  if (weekStartDate) {
    weekStart = new Date(weekStartDate);
  } else {
    weekStart = new Date();
    const dow = weekStart.getDay(); // 0=So
    const diffToMonday = (dow === 0 ? -6 : 1 - dow);
    weekStart.setDate(weekStart.getDate() + diffToMonday);
  }
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weekStartISO = weekStart.toISOString();
  const weekEndISO   = weekEnd.toISOString();
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr   = weekEnd.toISOString().slice(0, 10);

  // Daten parallel laden
  const [shiftsRes, requirementsRes, driversRes] = await Promise.all([
    sb
      .from('driver_shifts')
      .select('id, driver_id, location_id, planned_start, planned_end, actual_start, actual_end, status, notes, mise_drivers!driver_id(id, name, vehicle)')
      .eq('location_id', locationId)
      .gte('planned_start', weekStartISO)
      .lte('planned_start', weekEndISO)
      .order('planned_start', { ascending: true }),
    sb
      .from('coverage_requirements')
      .select('day_of_week, hour_of_day, min_drivers, target_drivers')
      .eq('location_id', locationId),
    sb
      .from('mise_drivers')
      .select('id, name, vehicle')
      .order('name', { ascending: true }),
  ]);

  const rawShifts = shiftsRes.data ?? [];
  const requirements = requirementsRes.data ?? [];
  const allDrivers = driversRes.data ?? [];

  // Coverage-Anforderungen als Map: `${dow}:${hour}` → {min, target}
  const reqMap = new Map<string, { min: number; target: number }>();
  for (const r of requirements) {
    reqMap.set(`${r.day_of_week}:${r.hour_of_day}`, {
      min: r.min_drivers,
      target: r.target_drivers,
    });
  }

  // Fahrer-Lookup aus Shifts
  const driverMap = new Map<string, { id: string; name: string; vehicle: string }>();
  for (const s of rawShifts) {
    const d = Array.isArray(s.mise_drivers) ? s.mise_drivers[0] : s.mise_drivers;
    if (d && !driverMap.has(s.driver_id)) {
      driverMap.set(s.driver_id, {
        id: d.id as string,
        name: d.name as string ?? 'Unbekannt',
        vehicle: d.vehicle as string ?? 'PKW',
      });
    }
  }

  // 7 Tage aufbauen
  const days: CalendarDay[] = [];
  let totalGaps = 0;
  const uniqueDriverIds = new Set<string>();
  let peakDriverNeed = 0;
  let coverageSum = 0;
  let coverageSlots = 0;

  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);

    const dateStr = day.toISOString().slice(0, 10);
    const dow     = day.getDay(); // 0=So … 6=Sa
    const dayLabel = DAY_LABELS[dow];
    const dateLabel = formatDateLabel(dateStr);

    // Schichten dieses Tages
    const dayShifts: CalendarShift[] = [];
    for (const s of rawShifts) {
      if (!s.planned_start.startsWith(dateStr)) continue;

      const driver = driverMap.get(s.driver_id) ?? { id: s.driver_id, name: 'Unbekannt', vehicle: 'PKW' };
      uniqueDriverIds.add(s.driver_id);

      const startH = isoToLocalHour(s.planned_start);
      const endH   = isoToLocalHour(s.planned_end);

      dayShifts.push({
        id: s.id,
        driverId: s.driver_id,
        driverName: driver.name,
        driverVehicle: driver.vehicle,
        plannedStart: s.planned_start,
        plannedEnd: s.planned_end,
        actualStart: s.actual_start,
        actualEnd: s.actual_end,
        status: s.status as ShiftStatus,
        notes: s.notes,
        startHour: startH,
        endHour: endH || 23,
        durationH: Math.max(1, (endH || 24) - startH),
      });
    }

    // Stundengrid (8–23 Uhr = typische Betriebszeit)
    const hours: CalendarHour[] = [];
    let dayGaps = 0;
    let dayPeak = 0;

    for (let h = 0; h < 24; h++) {
      const req = reqMap.get(`${dow}:${h}`);
      const minReq    = req?.min ?? 0;
      const targetReq = req?.target ?? 0;

      // Fahrer, deren Schicht diese Stunde abdeckt
      const scheduled = dayShifts.filter(
        (sh) => sh.startHour <= h && sh.endHour > h && sh.status !== 'cancelled' && sh.status !== 'missed',
      ).length;

      const isOperatingHour = h >= 8 && h <= 22;
      const coverage = determineCoverage(scheduled, minReq, targetReq, isOperatingHour);

      if (coverage === 'gap') dayGaps++;
      if (targetReq > dayPeak) dayPeak = targetReq;
      if (peakDriverNeed < dayPeak) peakDriverNeed = dayPeak;

      if (isOperatingHour && (minReq > 0 || scheduled > 0)) {
        coverageSlots++;
        if (coverage === 'ok' || coverage === 'over') coverageSum++;
      }

      hours.push({ hour: h, scheduledCount: scheduled, minRequired: minReq, targetRequired: targetReq, coverage });
    }

    totalGaps += dayGaps;

    days.push({
      date: dateStr,
      dayLabel,
      dateLabel,
      shifts: dayShifts,
      hours,
      totalShifts: dayShifts.length,
      gapCount: dayGaps,
      peakDriverNeed: dayPeak,
    });
  }

  const avgCoveragePct = coverageSlots > 0 ? Math.round((coverageSum / coverageSlots) * 100) : 100;

  const driversList = Array.from(driverMap.values());

  return {
    locationId,
    weekStart: weekStartStr,
    weekEnd: weekEndStr,
    generatedAt: new Date().toISOString(),
    days,
    summary: {
      totalShifts: rawShifts.length,
      totalGaps,
      uniqueDrivers: uniqueDriverIds.size,
      peakDriverNeed,
      avgCoveragePct,
    },
    drivers: allDrivers.map((d) => ({ id: d.id, name: d.name ?? 'Unbekannt', vehicle: d.vehicle ?? 'PKW' })),
  };
}
