import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Drivers needed per N predicted orders (matches schicht-optimierer logic)
const ORDERS_PER_DRIVER = 2.5;

type PeakKlasse = 'low' | 'normal' | 'peak' | 'high';
type Severity = 'ok' | 'warning' | 'critical';

interface HourSlot {
  hourUtc: number;
  hourLabel: string;     // local Berlin time HH:00
  predictedOrders: number;
  plannedDrivers: number;
  peakKlasse: PeakKlasse;
  driversNeeded: number;
  severity: Severity;
}

interface KapazitaetsPrognose {
  locationId: string;
  generatedAt: string;
  lookaheadHours: number;
  hours: HourSlot[];
  criticalHours: number;
  warningHours: number;
  recommendation: string | null;
}

function utcHourToLabel(hourUtc: number): string {
  const berlinOffset = 2; // UTC+2 (CEST); simple static offset sufficient for display
  const localHour = (hourUtc + berlinOffset) % 24;
  return `${String(localHour).padStart(2, '0')}:00`;
}

function severityFor(plannedDrivers: number, driversNeeded: number): Severity {
  if (plannedDrivers >= driversNeeded) return 'ok';
  if (plannedDrivers >= driversNeeded - 1) return 'warning';
  return 'critical';
}

function buildRecommendation(critical: number, warning: number): string | null {
  if (critical === 0 && warning === 0) return null;
  if (critical > 0) {
    return `${critical} kritische Stunde${critical > 1 ? 'n' : ''} mit Fahrer-Unterbesetzung — sofort handeln.`;
  }
  return `${warning} Stunde${warning > 1 ? 'n' : ''} mit knapper Besetzung — Fahrer einplanen empfohlen.`;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });

  const lookaheadHours = Math.min(8, Math.max(1, parseInt(req.nextUrl.searchParams.get('hours') ?? '4', 10)));

  const svc = createServiceClient();
  const nowUtc = new Date();
  const currentHourUtc = nowUtc.getUTCHours();
  const todayDow = nowUtc.getUTCDay(); // 0=Sun … 6=Sat

  // Build list of hours to analyze
  const targetHours: number[] = [];
  for (let i = 0; i < lookaheadHours; i++) {
    targetHours.push((currentHourUtc + i) % 24);
  }

  // Fetch tages_muster_snapshots for today's day-of-week, relevant hours
  const { data: musterRows } = await svc
    .from('tages_muster_snapshots')
    .select('stunde, avg_bestellungen, peak_klasse')
    .eq('location_id', locationId)
    .eq('wochentag', todayDow)
    .in('stunde', targetHours);

  const musterMap = new Map<number, { avgBestellungen: number; peakKlasse: PeakKlasse }>();
  for (const row of musterRows ?? []) {
    musterMap.set(Number(row.stunde), {
      avgBestellungen: Number(row.avg_bestellungen ?? 0),
      peakKlasse: (row.peak_klasse as PeakKlasse) ?? 'normal',
    });
  }

  // Fetch driver_shifts that overlap any of the lookahead hours
  const windowStart = new Date(nowUtc);
  windowStart.setUTCMinutes(0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCHours(windowEnd.getUTCHours() + lookaheadHours);

  const { data: shiftRows } = await svc
    .from('driver_shifts')
    .select('driver_id, planned_start, planned_end, actual_start, status')
    .eq('location_id', locationId)
    .in('status', ['scheduled', 'active'])
    .lt('planned_start', windowEnd.toISOString())
    .gt('planned_end', windowStart.toISOString());

  type ShiftRow = {
    driver_id: string;
    planned_start: string;
    planned_end: string;
    actual_start: string | null;
    status: string;
  };

  const shifts = (shiftRows ?? []) as ShiftRow[];

  // Count unique drivers per lookahead hour
  function driversForHour(hourUtc: number): number {
    const slotStart = new Date(windowStart);
    slotStart.setUTCHours(hourUtc, 0, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setUTCHours(hourUtc + 1);
    const slotStartMs = slotStart.getTime();
    const slotEndMs = slotEnd.getTime();

    const driverSet = new Set<string>();
    for (const s of shifts) {
      const startMs = new Date(s.planned_start).getTime();
      const endMs = new Date(s.planned_end).getTime();
      if (startMs < slotEndMs && endMs > slotStartMs) {
        driverSet.add(s.driver_id);
      }
    }
    return driverSet.size;
  }

  // Build hour slots
  const hours: HourSlot[] = targetHours.map(hourUtc => {
    const muster = musterMap.get(hourUtc);
    const predictedOrders = muster ? Math.round(muster.avgBestellungen * 10) / 10 : 0;
    const peakKlasse: PeakKlasse = muster?.peakKlasse ?? 'normal';
    const driversNeeded = Math.max(1, Math.ceil(predictedOrders / ORDERS_PER_DRIVER));
    const plannedDrivers = driversForHour(hourUtc);
    const severity = severityFor(plannedDrivers, driversNeeded);

    return {
      hourUtc,
      hourLabel: utcHourToLabel(hourUtc),
      predictedOrders,
      plannedDrivers,
      peakKlasse,
      driversNeeded,
      severity,
    };
  });

  const criticalHours = hours.filter(h => h.severity === 'critical').length;
  const warningHours = hours.filter(h => h.severity === 'warning').length;

  const result: KapazitaetsPrognose = {
    locationId,
    generatedAt: nowUtc.toISOString(),
    lookaheadHours,
    hours,
    criticalHours,
    warningHours,
    recommendation: buildRecommendation(criticalHours, warningHours),
  };

  return NextResponse.json(result);
}
