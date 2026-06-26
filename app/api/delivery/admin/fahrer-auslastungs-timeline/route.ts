/**
 * GET /api/delivery/admin/fahrer-auslastungs-timeline?location_id=...
 *
 * Fahrer-Auslastungs-Timeline: Zeitleiste (heute 00:00–23:59) je Fahrer mit
 * Schicht-Fenstern, aktiven Touren und freien Slots.
 *
 * Response:
 *   { ok, drivers: DriverTimeline[], hourLabels: string[], generatedAt: string }
 *
 * Multi-Tenant: alle Queries filtern location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type SlotType = 'shift' | 'tour' | 'break' | 'free';

export interface TimelineSlot {
  type: SlotType;
  startHour: number;
  endHour: number;
  label: string | null;
}

export interface DriverTimeline {
  driverId: string;
  driverName: string;
  isOnline: boolean;
  slots: TimelineSlot[];
  totalShiftHours: number;
  totalTourHours: number;
  utilizationPct: number;
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

function toDecimalHour(iso: string, refDate: Date): number {
  const t = new Date(iso);
  const midnight = new Date(refDate);
  midnight.setUTCHours(0, 0, 0, 0);
  return Math.max(0, Math.min(24, (t.getTime() - midnight.getTime()) / 3_600_000));
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCHours(23, 59, 59, 999);

  // Get all drivers for this location
  const { data: allDrivers } = await ssb
    .from('mise_drivers')
    .select('id, name, is_online')
    .eq('location_id', locationId);

  if (!allDrivers || allDrivers.length === 0) {
    const hourLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    return NextResponse.json({ ok: true, drivers: [], hourLabels, generatedAt: now.toISOString() });
  }

  type Driver = { id: string; name: string; is_online: boolean };
  const drivers = allDrivers as Driver[];
  const driverIds = drivers.map((d) => d.id);

  // Get shifts for today
  const { data: shifts } = await ssb
    .from('driver_shifts')
    .select('driver_id, started_at, ended_at')
    .eq('location_id', locationId)
    .in('driver_id', driverIds)
    .gte('started_at', todayStart.toISOString())
    .lte('started_at', todayEnd.toISOString());

  type Shift = { driver_id: string; started_at: string; ended_at: string | null };
  const shiftsTyped = (shifts ?? []) as Shift[];

  // Get tours for today
  const { data: tours } = await ssb
    .from('driver_tours')
    .select('driver_id, startzeit, created_at, status, total_eta_min')
    .eq('location_id', locationId)
    .in('driver_id', driverIds)
    .gte('created_at', todayStart.toISOString());

  type Tour = { driver_id: string | null; startzeit: string | null; created_at: string; status: string; total_eta_min: number | null };
  const toursTyped = (tours ?? []) as Tour[];

  const hourLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

  const timelines: DriverTimeline[] = drivers.map((driver) => {
    const driverShifts = shiftsTyped.filter((s) => s.driver_id === driver.id);
    const driverTours = toursTyped.filter((t) => t.driver_id === driver.id);

    const slots: TimelineSlot[] = [];

    // Add shift slots
    for (const shift of driverShifts) {
      const startH = toDecimalHour(shift.started_at, now);
      const endRaw = shift.ended_at ?? now.toISOString();
      const endH = toDecimalHour(endRaw, now);
      if (endH > startH) {
        slots.push({ type: 'shift', startHour: startH, endHour: endH, label: 'Schicht' });
      }
    }

    // Add tour slots
    for (const tour of driverTours) {
      const startStr = tour.startzeit ?? tour.created_at;
      const startH = toDecimalHour(startStr, now);
      const durationH = (tour.total_eta_min ?? 45) / 60;
      const endH = Math.min(24, startH + durationH);
      if (endH > startH) {
        slots.push({ type: 'tour', startHour: startH, endHour: endH, label: `Tour (${tour.status})` });
      }
    }

    const totalShiftHours = driverShifts.reduce((sum, s) => {
      const endRaw = s.ended_at ?? now.toISOString();
      return sum + Math.max(0, (new Date(endRaw).getTime() - new Date(s.started_at).getTime()) / 3_600_000);
    }, 0);

    const totalTourHours = driverTours.reduce((sum, t) => sum + (t.total_eta_min ?? 45) / 60, 0);
    const utilizationPct = totalShiftHours > 0 ? Math.min(100, Math.round((totalTourHours / totalShiftHours) * 100)) : 0;

    return {
      driverId: driver.id,
      driverName: driver.name,
      isOnline: driver.is_online,
      slots: slots.sort((a, b) => a.startHour - b.startHour),
      totalShiftHours: Math.round(totalShiftHours * 10) / 10,
      totalTourHours: Math.round(totalTourHours * 10) / 10,
      utilizationPct,
    };
  }).filter((d) => d.slots.length > 0 || d.isOnline);

  timelines.sort((a, b) => b.utilizationPct - a.utilizationPct);

  return NextResponse.json({ ok: true, drivers: timelines, hourLabels, generatedAt: now.toISOString() });
}
