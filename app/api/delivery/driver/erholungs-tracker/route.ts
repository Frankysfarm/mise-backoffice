/**
 * GET /api/delivery/driver/erholungs-tracker?driver_id=...&location_id=...
 *
 * Phase 527 — Fahrer-Erholungs-Tracker
 * Zeigt wie lange ein Fahrer heute aktiv war vs. in Pause.
 * Ermüdungsindikator bei >4h Aktivzeit ohne ausreichende Pause.
 *
 * Response: { ok, activeMinutes, pauseMinutes, fatigueLevel, lastPauseAt, recommendation, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type FatigueLevel = 'fresh' | 'moderate' | 'tired' | 'exhausted';

export interface ErholungsData {
  activeMinutes: number;
  pauseMinutes: number;
  totalOnShiftMinutes: number;
  fatigueLevel: FatigueLevel;
  lastPauseAt: string | null;
  minutesSinceLastPause: number | null;
  recommendation: string;
  toursToday: number;
  deliveriesToday: number;
}

function fatigueLevel(activeMin: number, pauseMin: number): FatigueLevel {
  if (activeMin >= 360 && pauseMin < 20) return 'exhausted';
  if (activeMin >= 240 && pauseMin < 15) return 'tired';
  if (activeMin >= 180)                  return 'moderate';
  return 'fresh';
}

function recommendation(level: FatigueLevel, activeMin: number, pauseMin: number): string {
  switch (level) {
    case 'exhausted': return `${Math.round(activeMin / 60 * 10) / 10}h aktiv, nur ${pauseMin} Min Pause — bitte jetzt pausieren!`;
    case 'tired':     return `${Math.round(activeMin / 60 * 10) / 10}h aktiv — kurze Pause (10–15 Min) empfohlen.`;
    case 'moderate':  return `${Math.round(activeMin / 60 * 10) / 10}h aktiv — du bist gut unterwegs.`;
    case 'fresh':     return 'Fit für den Einsatz.';
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const driverId   = searchParams.get('driver_id');
  let locationId   = searchParams.get('location_id');

  if (!driverId) return NextResponse.json({ error: 'driver_id fehlt' }, { status: 400 });

  // Resolve location if missing
  if (!locationId) {
    const { data: emp } = await sb
      .from('employees')
      .select('location_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    locationId = (emp?.location_id as string) ?? null;
  }
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // Driver-Status: online_seit
  const { data: driverStatus } = await ssb
    .from('driver_status')
    .select('online_seit, ist_online')
    .eq('employee_id', driverId)
    .maybeSingle();

  const status = driverStatus as { online_seit: string | null; ist_online: boolean } | null;
  const onlineSeit = status?.online_seit ?? null;
  const isOnline   = status?.ist_online ?? false;

  // Touren heute: abgeschlossene + aktive Batches
  const { data: batchRows } = await ssb
    .from('mise_delivery_batches')
    .select('id, startzeit, abgeschlossen_am, status')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('startzeit', todayStart.toISOString());

  const batches = (batchRows ?? []) as {
    id: string;
    startzeit: string | null;
    abgeschlossen_am: string | null;
    status: string;
  }[];

  const toursToday = batches.length;

  // Lieferungen heute: abgeschlossene Stopp-Einträge
  const batchIds = batches.map((b) => b.id);
  let deliveriesToday = 0;
  if (batchIds.length > 0) {
    const { data: stopRows } = await ssb
      .from('mise_delivery_batch_stops')
      .select('id')
      .in('batch_id', batchIds)
      .not('geliefert_am', 'is', null);
    deliveriesToday = (stopRows ?? []).length;
  }

  // Aktive Zeit berechnen: Zeit seit online_seit (heute), minus Pausen
  // Pausen = Lücken zwischen Tour-Ende und nächster Tour-Start heute
  let activeMinutes = 0;
  let pauseMinutes  = 0;
  let lastPauseAt: string | null = null;

  if (onlineSeit) {
    const onlineStart = new Date(onlineSeit);
    const effectiveStart = onlineStart < todayStart ? todayStart : onlineStart;
    const totalOnlineMs = now.getTime() - effectiveStart.getTime();

    // Touren-Zeitfenster berechnen
    const tourIntervals = batches
      .filter((b) => b.startzeit)
      .map((b) => ({
        start: new Date(b.startzeit!).getTime(),
        end: b.abgeschlossen_am ? new Date(b.abgeschlossen_am).getTime() : now.getTime(),
      }))
      .sort((a, b) => a.start - b.start);

    if (tourIntervals.length === 0) {
      // Keine Touren — die gesamte Online-Zeit ist "Wartezeit", nicht wirkliche Aktivzeit
      activeMinutes = Math.max(0, Math.round(totalOnlineMs / 60_000));
      pauseMinutes  = 0;
    } else {
      // Aktive Zeit = Tour-Dauer gesamt
      let tourActiveMs = 0;
      for (const ti of tourIntervals) {
        tourActiveMs += Math.max(0, ti.end - ti.start);
      }
      activeMinutes = Math.max(0, Math.round(tourActiveMs / 60_000));

      // Pausen = Lücken zwischen Touren
      let pauseMs = 0;
      for (let i = 1; i < tourIntervals.length; i++) {
        const gap = tourIntervals[i].start - tourIntervals[i - 1].end;
        if (gap > 0) {
          pauseMs += gap;
          // Letzte Pause = Ende der letzten abgeschlossenen Tour
          if (tourIntervals[i - 1].end && batches[i - 1]?.abgeschlossen_am) {
            lastPauseAt = batches[i - 1].abgeschlossen_am;
          }
        }
      }
      pauseMinutes = Math.max(0, Math.round(pauseMs / 60_000));
    }
  }

  const minutesSinceLastPause = lastPauseAt
    ? Math.round((now.getTime() - new Date(lastPauseAt).getTime()) / 60_000)
    : null;

  const totalOnlineMin = onlineSeit
    ? Math.max(0, Math.round((now.getTime() - new Date(onlineSeit).getTime()) / 60_000))
    : 0;

  const level = fatigueLevel(activeMinutes, pauseMinutes);

  const result: ErholungsData = {
    activeMinutes,
    pauseMinutes,
    totalOnShiftMinutes: totalOnlineMin,
    fatigueLevel: level,
    lastPauseAt,
    minutesSinceLastPause,
    recommendation: recommendation(level, activeMinutes, pauseMinutes),
    toursToday,
    deliveriesToday,
  };

  return NextResponse.json({ ok: true, ...result, generatedAt: now.toISOString() });
}
