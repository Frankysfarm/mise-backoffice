/**
 * lib/delivery/shift-booking.ts
 *
 * Driver Self-Service Shift Booking — Phase 41
 *
 * Fahrer sehen offene Deckungslücken (Coverage Gaps) und können sich
 * für Schichten anmelden. Admin genehmigt → automatisches driver_shifts INSERT.
 *
 * Graceful Fallback: wenn Migration 035 fehlt (42P01), kein Fatal-Crash.
 *
 * Funktionen:
 *   getBookableSlots()     — Slots wo mehr Fahrer gesucht werden (nächste N Tage)
 *   claimShift()           — Fahrer meldet sich für einen Slot an
 *   cancelShiftClaim()     — Fahrer zieht pendende Anmeldung zurück
 *   approveShiftClaim()    — Admin genehmigt → driver_shifts INSERT
 *   rejectShiftClaim()     — Admin lehnt ab (optionaler Grund)
 *   getDriverClaims()      — Fahrer sieht eigene Anmeldungen
 *   getPendingClaims()     — Admin sieht offene Anmeldungen (mit Fahrerdaten)
 *   getClaimStats()        — Übersicht nach Status (letzte 30 Tage)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================
// Typen
// ============================================================

export type ShiftClaimStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ShiftClaim {
  id: string;
  locationId: string;
  driverId: string;
  plannedStart: string;
  plannedEnd: string;
  status: ShiftClaimStatus;
  notes: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ShiftClaimWithDriver extends ShiftClaim {
  driverName: string | null;
  driverVehicle: string | null;
}

export interface BookableSlot {
  slotStart: string;
  slotEnd: string;
  dayLabel: string;
  timeLabel: string;
  driverNeeded: number;
  driverTarget: number;
  alreadyClaimed: boolean;
}

export interface ClaimStats {
  locationId: string;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  total: number;
}

// ============================================================
// Interne Hilfsmittel
// ============================================================

function isMissingTable(err: { code?: string } | null): boolean {
  return err?.code === '42P01';
}

function mapClaim(row: Record<string, unknown>): ShiftClaim {
  return {
    id:              String(row.id),
    locationId:      String(row.location_id),
    driverId:        String(row.driver_id),
    plannedStart:    String(row.planned_start),
    plannedEnd:      String(row.planned_end),
    status:          row.status as ShiftClaimStatus,
    notes:           (row.notes as string | null) ?? null,
    rejectionReason: (row.rejection_reason as string | null) ?? null,
    reviewedAt:      (row.reviewed_at as string | null) ?? null,
    createdAt:       String(row.created_at),
  };
}

// ============================================================
// getBookableSlots
// ============================================================

/**
 * Gibt Schicht-Slots zurück, bei denen die Location noch Fahrer benötigt.
 *
 * Algorithmus:
 *  1. Lädt coverage_requirements (Ziel-Fahrerzahl je Wochentag/Stunde)
 *  2. Generiert für die nächsten daysAhead Tage Stunden-Slots aus den Anforderungen
 *  3. Gruppiert aufeinanderfolgende Stunden zu Schichtblöcken (Gap ≥2h = neuer Block)
 *  4. Vergleicht mit vorhandenen driver_shifts → gibt Blöcke mit Lücke zurück
 *  5. Markiert Slots, für die der Fahrer bereits eine Anmeldung hat
 */
export async function getBookableSlots(
  locationId: string,
  driverId: string,
  daysAhead = 7,
): Promise<BookableSlot[]> {
  const sb = createServiceClient();

  const { data: reqs, error: reqErr } = await sb
    .from('coverage_requirements')
    .select('day_of_week, hour_of_day, target_drivers')
    .eq('location_id', locationId)
    .gt('target_drivers', 0)
    .order('day_of_week')
    .order('hour_of_day');

  if (reqErr || !reqs?.length) return [];

  // Fenster: ab nächster vollen Stunde bis daysAhead Tage
  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() + 1, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + daysAhead);

  // Vorhandene Schichten im Fenster
  const { data: existingShifts } = await sb
    .from('driver_shifts')
    .select('planned_start, planned_end')
    .eq('location_id', locationId)
    .in('status', ['scheduled', 'active'])
    .gte('planned_start', windowStart.toISOString())
    .lt('planned_start', windowEnd.toISOString());

  // Eigene Anmeldungen des Fahrers
  const { data: myClaims, error: claimErr } = await sb
    .from('shift_claims')
    .select('planned_start, planned_end, status')
    .eq('driver_id', driverId)
    .in('status', ['pending', 'approved'])
    .gte('planned_start', windowStart.toISOString())
    .lt('planned_start', windowEnd.toISOString());

  if (claimErr && !isMissingTable(claimErr)) return [];

  // Lookup-Map: `${dow}:${hour}` → maxTarget
  const reqMap = new Map<string, number>();
  for (const r of reqs) {
    const key = `${r.day_of_week}:${r.hour_of_day}`;
    const prev = reqMap.get(key) ?? 0;
    if ((r.target_drivers as number) > prev) reqMap.set(key, r.target_drivers as number);
  }

  const nowMs = windowStart.getTime();
  const slots: BookableSlot[] = [];

  for (let d = 0; d < daysAhead; d++) {
    const baseDate = new Date(windowStart);
    baseDate.setDate(baseDate.getDate() + d);
    baseDate.setHours(0, 0, 0, 0);

    const dow = baseDate.getDay(); // 0=Sunday … 6=Saturday (JS, UTC-aligned)

    // Stunden des Tages mit Anforderungen
    const peakHours: number[] = [];
    for (let h = 0; h < 24; h++) {
      if ((reqMap.get(`${dow}:${h}`) ?? 0) > 0) peakHours.push(h);
    }
    if (!peakHours.length) continue;

    // Aufeinanderfolgende Stunden zu Blöcken zusammenfassen (Gap ≥ 2h = neuer Block)
    type Block = { start: number; end: number; target: number };
    const blocks: Block[] = [];
    let bs = peakHours[0];
    let be = peakHours[0] + 1;
    let bt = reqMap.get(`${dow}:${peakHours[0]}`) ?? 1;

    for (let i = 1; i < peakHours.length; i++) {
      const h = peakHours[i];
      if (h <= be + 1) {
        be = h + 1;
        const t = reqMap.get(`${dow}:${h}`) ?? 1;
        if (t > bt) bt = t;
      } else {
        blocks.push({ start: bs, end: be, target: bt });
        bs = h; be = h + 1;
        bt = reqMap.get(`${dow}:${h}`) ?? 1;
      }
    }
    blocks.push({ start: bs, end: be, target: bt });

    for (const block of blocks) {
      const slotStart = new Date(baseDate);
      slotStart.setHours(block.start, 0, 0, 0);
      const slotEnd = new Date(baseDate);
      slotEnd.setHours(block.end, 0, 0, 0);

      if (slotStart.getTime() <= nowMs) continue;

      const ssMs = slotStart.getTime();
      const seMs = slotEnd.getTime();

      const driverCount = (existingShifts ?? []).filter(s => {
        const sS = new Date(s.planned_start).getTime();
        const sE = new Date(s.planned_end).getTime();
        return sS < seMs && sE > ssMs;
      }).length;

      const driverNeeded = Math.max(0, block.target - driverCount);
      if (driverNeeded === 0) continue;

      const alreadyClaimed = (myClaims ?? []).some(c => {
        const cS = new Date(c.planned_start).getTime();
        const cE = new Date(c.planned_end).getTime();
        return cS < seMs && cE > ssMs;
      });

      const sh = block.start.toString().padStart(2, '0');
      const eh = block.end.toString().padStart(2, '0');

      slots.push({
        slotStart: slotStart.toISOString(),
        slotEnd:   slotEnd.toISOString(),
        dayLabel:  slotStart.toLocaleDateString('de-DE', {
          weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
        }),
        timeLabel: `${sh}:00 – ${eh}:00 Uhr`,
        driverNeeded,
        driverTarget: block.target,
        alreadyClaimed,
      });
    }
  }

  return slots;
}

// ============================================================
// claimShift
// ============================================================

export async function claimShift(
  driverId: string,
  locationId: string,
  plannedStart: string,
  plannedEnd: string,
  notes?: string,
): Promise<ShiftClaim | null> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('shift_claims')
    .insert({
      driver_id:     driverId,
      location_id:   locationId,
      planned_start: plannedStart,
      planned_end:   plannedEnd,
      notes:         notes ?? null,
    })
    .select()
    .single();

  if (error) {
    if (isMissingTable(error)) return null;
    throw new Error(error.message);
  }

  return mapClaim(data as Record<string, unknown>);
}

// ============================================================
// cancelShiftClaim
// ============================================================

export async function cancelShiftClaim(
  claimId: string,
  driverId: string,
): Promise<void> {
  const sb = createServiceClient();

  const { error } = await sb
    .from('shift_claims')
    .update({ status: 'cancelled' })
    .eq('id', claimId)
    .eq('driver_id', driverId)
    .eq('status', 'pending');

  if (error && !isMissingTable(error)) {
    throw new Error(error.message);
  }
}

// ============================================================
// approveShiftClaim
// ============================================================

/**
 * Admin genehmigt eine Schicht-Anmeldung.
 * Setzt status='approved' und legt automatisch einen driver_shifts-Eintrag an.
 */
export async function approveShiftClaim(
  claimId: string,
  locationId: string,
  reviewedBy: string,
): Promise<ShiftClaim | null> {
  const sb = createServiceClient();

  const { data: claim, error: getErr } = await sb
    .from('shift_claims')
    .select('*')
    .eq('id', claimId)
    .eq('location_id', locationId)
    .eq('status', 'pending')
    .single();

  if (getErr) {
    if (isMissingTable(getErr)) return null;
    throw new Error(getErr.message);
  }

  const c = claim as Record<string, unknown>;

  const { data: updated, error: updateErr } = await sb
    .from('shift_claims')
    .update({
      status:      'approved',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', claimId)
    .select()
    .single();

  if (updateErr) throw new Error(updateErr.message);

  // Schicht automatisch anlegen (fire-and-forget)
  sb.from('driver_shifts')
    .insert({
      driver_id:     String(c.driver_id),
      location_id:   locationId,
      planned_start: String(c.planned_start),
      planned_end:   String(c.planned_end),
      status:        'scheduled',
      notes:         c.notes
        ? `Selbst-Anmeldung genehmigt. ${String(c.notes)}`
        : 'Selbst-Anmeldung genehmigt.',
      created_by:    reviewedBy,
    })
    .then(() => {});

  return mapClaim(updated as Record<string, unknown>);
}

// ============================================================
// rejectShiftClaim
// ============================================================

export async function rejectShiftClaim(
  claimId: string,
  locationId: string,
  reviewedBy: string,
  reason?: string,
): Promise<void> {
  const sb = createServiceClient();

  const { error } = await sb
    .from('shift_claims')
    .update({
      status:           'rejected',
      rejection_reason: reason ?? null,
      reviewed_by:      reviewedBy,
      reviewed_at:      new Date().toISOString(),
    })
    .eq('id', claimId)
    .eq('location_id', locationId)
    .eq('status', 'pending');

  if (error && !isMissingTable(error)) {
    throw new Error(error.message);
  }
}

// ============================================================
// getDriverClaims
// ============================================================

export async function getDriverClaims(
  driverId: string,
  daysAhead = 14,
): Promise<ShiftClaim[]> {
  const sb = createServiceClient();

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + daysAhead);

  const { data, error } = await sb
    .from('shift_claims')
    .select('*')
    .eq('driver_id', driverId)
    .gte('planned_start', new Date().toISOString())
    .lt('planned_start', horizon.toISOString())
    .order('planned_start');

  if (error) {
    if (isMissingTable(error)) return [];
    console.warn('[shift-booking] getDriverClaims:', error.message);
    return [];
  }

  return (data ?? []).map(r => mapClaim(r as Record<string, unknown>));
}

// ============================================================
// getPendingClaims
// ============================================================

export async function getPendingClaims(
  locationId: string,
): Promise<ShiftClaimWithDriver[]> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('shift_claims')
    .select(`
      *,
      driver:mise_drivers ( id, name, vehicle )
    `)
    .eq('location_id', locationId)
    .eq('status', 'pending')
    .order('planned_start');

  if (error) {
    if (isMissingTable(error)) return [];
    console.warn('[shift-booking] getPendingClaims:', error.message);
    return [];
  }

  return (data ?? []).map(r => {
    const row = r as Record<string, unknown>;
    const d = row.driver as Record<string, unknown> | null;
    return {
      ...mapClaim(row),
      driverName:    (d?.name as string | null) ?? null,
      driverVehicle: (d?.vehicle as string | null) ?? null,
    };
  });
}

// ============================================================
// getClaimStats
// ============================================================

export async function getClaimStats(locationId: string): Promise<ClaimStats> {
  const sb = createServiceClient();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await sb
    .from('shift_claims')
    .select('status')
    .eq('location_id', locationId)
    .gte('planned_start', since.toISOString());

  if (error) {
    return { locationId, pending: 0, approved: 0, rejected: 0, cancelled: 0, total: 0 };
  }

  const counts = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
  for (const r of data ?? []) {
    const s = (r as { status: string }).status;
    if (s in counts) counts[s as keyof typeof counts]++;
  }

  return { locationId, ...counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
}
