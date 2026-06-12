/**
 * GET /api/delivery/driver/shifts
 *   ?limit=20
 *
 * Schicht-Verlauf des eingeloggten Fahrers.
 * Gibt die letzten N abgeschlossenen Schichten zurück,
 * angereichert mit Lieferungen, Pausen und geschätztem Verdienst.
 *
 * Auth: Fahrer-Login erforderlich (mise_drivers.auth_user_id = user.id)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ShiftHistoryEntry {
  id: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  status: string;
  durationMinutes: number | null;
  activeMinutes: number | null;
  breakMinutes: number;
  breakCount: number;
  deliveries: number;
  distanceKm: number;
  earningsEur: number;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(1, Number(searchParams.get('limit') ?? 20)), 50);

  const svc = createServiceClient();

  // Fahrer-ID auflösen
  const { data: driver } = await svc
    .from('mise_drivers')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (!driver) return NextResponse.json({ error: 'Kein Fahrer-Profil gefunden' }, { status: 404 });
  const driverId = driver.id as string;

  // Schichten laden (completed + missed, letzte 30 Tage)
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: shifts, error: shiftErr } = await svc
    .from('driver_shifts')
    .select('id, planned_start, planned_end, actual_start, actual_end, status')
    .eq('driver_id', driverId)
    .in('status', ['completed', 'active', 'missed'])
    .gte('planned_start', since)
    .order('planned_start', { ascending: false })
    .limit(limit);

  if (shiftErr) {
    return NextResponse.json({ error: shiftErr.message }, { status: 500 });
  }

  const rows = shifts ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ shifts: [] });
  }

  const shiftIds = rows.map(s => s.id as string);

  // Pausen-Zusammenfassungen für diese Schichten laden
  const { data: breakRows } = await svc
    .from('shift_breaks')
    .select('shift_id, started_at, ended_at')
    .in('shift_id', shiftIds)
    .not('ended_at', 'is', null);

  // Pausen nach shift_id gruppieren
  const breakByShift = new Map<string, { totalMin: number; count: number }>();
  for (const br of breakRows ?? []) {
    const sid = br.shift_id as string;
    const mins = Math.round(
      (new Date(br.ended_at as string).getTime() - new Date(br.started_at as string).getTime()) / 60_000,
    );
    const cur = breakByShift.get(sid) ?? { totalMin: 0, count: 0 };
    breakByShift.set(sid, { totalMin: cur.totalMin + mins, count: cur.count + 1 });
  }

  // Zeitrahmen für Batch-Abfrage: ältester Schicht-Start → jetzt
  const oldestStart = rows[rows.length - 1].actual_start ?? rows[rows.length - 1].planned_start;
  const { data: batches } = await svc
    .from('mise_delivery_batches')
    .select('id, completed_at, total_distance_km, state')
    .eq('driver_id', driverId)
    .eq('state', 'completed')
    .gte('completed_at', oldestStart as string)
    .not('completed_at', 'is', null);

  // Batches nach Schicht-Zeitfenster zuordnen
  const batchesSorted = (batches ?? []).map(b => ({
    completedAt: new Date(b.completed_at as string).getTime(),
    distKm: Number(b.total_distance_km ?? 0),
  }));

  const result: ShiftHistoryEntry[] = rows.map(shift => {
    const start = shift.actual_start ? new Date(shift.actual_start as string).getTime() : null;
    const end   = shift.actual_end   ? new Date(shift.actual_end   as string).getTime()
                : shift.status === 'active' ? Date.now() : null;

    const durationMin = start && end ? Math.round((end - start) / 60_000) : null;

    const breaks = breakByShift.get(shift.id as string) ?? { totalMin: 0, count: 0 };
    const activeMin = durationMin !== null ? Math.max(0, durationMin - breaks.totalMin) : null;

    // Batches die in diesem Schicht-Fenster abgeschlossen wurden
    const shiftBatches = start && end
      ? batchesSorted.filter(b => b.completedAt >= start && b.completedAt <= end)
      : [];

    const deliveries = shiftBatches.length;
    const distanceKm = Math.round(shiftBatches.reduce((s, b) => s + b.distKm, 0) * 100) / 100;
    const earningsEur = Math.round((deliveries * 1.50 + distanceKm * 0.20) * 100) / 100;

    return {
      id:              shift.id as string,
      plannedStart:    shift.planned_start as string,
      plannedEnd:      shift.planned_end as string,
      actualStart:     shift.actual_start as string | null,
      actualEnd:       shift.actual_end as string | null,
      status:          shift.status as string,
      durationMinutes: durationMin,
      activeMinutes:   activeMin,
      breakMinutes:    breaks.totalMin,
      breakCount:      breaks.count,
      deliveries,
      distanceKm,
      earningsEur,
    };
  });

  return NextResponse.json({ shifts: result });
}
