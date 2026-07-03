/**
 * GET /api/delivery/admin/fahrer-verfuegbarkeits-prognose
 *   ?location_id=<uuid>
 *
 * Vorhersage: Wie viele Fahrer sind die nächsten 4h verfügbar?
 * Basis: geplante Schichten + aktuell online (GPS letzte 5 Min)
 *
 * Phase 545
 *
 * Response: { ok, slots: AvailabilitySlot[], summary: AvailabilitySummary, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface AvailabilitySlot {
  hourLabel: string; // e.g. "14:00"
  utcHour: number;
  driversPlanned: number;
  driversOnline: number;
  driversAvailable: number; // max(planned, online)
  level: 'kritisch' | 'niedrig' | 'ausreichend' | 'gut';
}

export interface AvailabilitySummary {
  currentOnline: number;
  plannedNext4h: number;
  avgAvailable: number;
  minAvailable: number;
  peakHour: string;
  alertLevel: 'kritisch' | 'niedrig' | 'ok';
}

export interface FahrerVerfuegbarkeitResponse {
  ok: boolean;
  slots: AvailabilitySlot[];
  summary: AvailabilitySummary;
  generatedAt: string;
}

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const param = new URL(req.url).searchParams.get('location_id');
  if (param) return param;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (emp as { location_id: string } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const locationId = await resolveLocationId(req);
    if (!locationId) {
      return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
    }

    const svc = createServiceClient();
    const now = new Date();
    const nowMs = now.getTime();

    // 1. Online-Fahrer: GPS-Events letzte 5 Min
    const fiveMinsAgo = new Date(nowMs - 5 * 60_000).toISOString();
    const { data: gpsRows } = await svc
      .from('driver_gps_events')
      .select('driver_id')
      .eq('location_id', locationId)
      .gte('recorded_at', fiveMinsAgo);

    const onlineDriverIds = new Set((gpsRows ?? []).map((r: { driver_id: string }) => r.driver_id));
    const currentOnline = onlineDriverIds.size;

    // 2. Geplante Schichten für die nächsten 4h
    const in4h = new Date(nowMs + 4 * 60 * 60_000).toISOString();
    const { data: shifts } = await svc
      .from('schichten')
      .select('start_zeit, end_zeit, mitarbeiter_id')
      .eq('location_id', locationId)
      .gte('end_zeit', now.toISOString())
      .lte('start_zeit', in4h);

    // Build 4 hourly slots
    const slots: AvailabilitySlot[] = [];
    for (let h = 0; h < 4; h++) {
      const slotStart = new Date(nowMs + h * 60 * 60_000);
      const slotEnd = new Date(nowMs + (h + 1) * 60 * 60_000);
      const utcHour = slotStart.getUTCHours();
      const hourLabel = `${String(slotStart.getHours()).padStart(2, '0')}:00`;

      // Drivers with scheduled shift covering this slot
      const planned = (shifts ?? []).filter((s: { start_zeit: string; end_zeit: string }) => {
        const start = new Date(s.start_zeit).getTime();
        const end = new Date(s.end_zeit).getTime();
        return start < slotEnd.getTime() && end > slotStart.getTime();
      }).length;

      // Online drivers count only for current slot
      const online = h === 0 ? currentOnline : 0;
      const available = Math.max(planned, online);

      let level: AvailabilitySlot['level'];
      if (available === 0) level = 'kritisch';
      else if (available <= 1) level = 'niedrig';
      else if (available <= 3) level = 'ausreichend';
      else level = 'gut';

      slots.push({ hourLabel, utcHour, driversPlanned: planned, driversOnline: online, driversAvailable: available, level });
    }

    const avgAvailable = slots.reduce((s, r) => s + r.driversAvailable, 0) / slots.length;
    const minAvailable = Math.min(...slots.map((s) => s.driversAvailable));
    const peakSlot = slots.reduce((a, b) => (b.driversAvailable > a.driversAvailable ? b : a), slots[0]);

    let alertLevel: AvailabilitySummary['alertLevel'] = 'ok';
    if (minAvailable === 0) alertLevel = 'kritisch';
    else if (minAvailable <= 1 || avgAvailable < 2) alertLevel = 'niedrig';

    const summary: AvailabilitySummary = {
      currentOnline,
      plannedNext4h: Math.max(...slots.map((s) => s.driversPlanned)),
      avgAvailable: Math.round(avgAvailable * 10) / 10,
      minAvailable,
      peakHour: peakSlot?.hourLabel ?? '--:--',
      alertLevel,
    };

    return NextResponse.json({
      ok: true,
      slots,
      summary,
      generatedAt: now.toISOString(),
    } satisfies FahrerVerfuegbarkeitResponse);
  } catch (err) {
    console.error('[fahrer-verfuegbarkeits-prognose]', err);
    return NextResponse.json({ ok: false, error: 'Interner Fehler' }, { status: 500 });
  }
}
