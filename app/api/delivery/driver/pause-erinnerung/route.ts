/**
 * GET /api/delivery/driver/pause-erinnerung?driver_id=<uuid>
 *
 * Phase 1784 — Eigene Pause-Erinnerung (Driver API)
 * Schichtdauer + Pausenstatus + Hinweis wenn >6h ohne 30 Min Pause.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PauseErinnerungAntwort {
  fahrer_id: string;
  schicht_dauer_h: number;
  pausen_dauer_min: number;
  naechste_pause_in_min: number | null;
  pause_pflicht_aktiv: boolean;
  pause_ausreichend: boolean;
  hinweis: string | null;
}

const PAUSE_PFLICHT_NACH_H = 6;
const PAUSE_PFLICHT_MIN = 30;
const PAUSE_EMPFEHLUNG_INTERVALL_H = 2;

function buildMock(driverId: string): PauseErinnerungAntwort {
  const seed = driverId.charCodeAt(0) || 70;
  const schicht_dauer_h = 4 + (seed % 5);
  const pausen_dauer_min = schicht_dauer_h >= PAUSE_PFLICHT_NACH_H
    ? (seed % 35)
    : 0;
  const pause_pflicht_aktiv = schicht_dauer_h >= PAUSE_PFLICHT_NACH_H;
  const pause_ausreichend = !pause_pflicht_aktiv || pausen_dauer_min >= PAUSE_PFLICHT_MIN;
  const letzte_pause_vor_h = (seed % 3) + 1;
  const naechste_pause_in_min = letzte_pause_vor_h >= PAUSE_EMPFEHLUNG_INTERVALL_H
    ? 0
    : Math.round((PAUSE_EMPFEHLUNG_INTERVALL_H - letzte_pause_vor_h) * 60);

  return {
    fahrer_id: driverId,
    schicht_dauer_h,
    pausen_dauer_min,
    naechste_pause_in_min,
    pause_pflicht_aktiv,
    pause_ausreichend,
    hinweis: !pause_ausreichend
      ? `Du bist seit ${schicht_dauer_h.toFixed(1)} Stunden im Einsatz. Bitte nimm bald eine Pause (mindestens ${PAUSE_PFLICHT_MIN} Min).`
      : naechste_pause_in_min === 0
      ? 'Eine kurze Pause tut gut — du bist schon länger unterwegs.'
      : null,
  };
}

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id') ?? '';

  if (!driverId) {
    return NextResponse.json({ error: 'driver_id fehlt' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const now = new Date();

    const { data: status, error } = await (sb as any)
      .from('driver_status')
      .select('driver_id, online_seit, pause_dauer_min, letzte_pause_ende')
      .eq('driver_id', driverId)
      .eq('is_online', true)
      .maybeSingle();

    if (error || !status) {
      return NextResponse.json(buildMock(driverId));
    }

    const schicht_dauer_ms = now.getTime() - new Date(status.online_seit).getTime();
    const schicht_dauer_h = schicht_dauer_ms / (1000 * 60 * 60);
    const pausen_dauer_min: number = status.pause_dauer_min ?? 0;
    const pause_pflicht_aktiv = schicht_dauer_h >= PAUSE_PFLICHT_NACH_H;
    const pause_ausreichend = !pause_pflicht_aktiv || pausen_dauer_min >= PAUSE_PFLICHT_MIN;

    const letzte_pause_vor_ms = status.letzte_pause_ende
      ? now.getTime() - new Date(status.letzte_pause_ende).getTime()
      : schicht_dauer_ms;
    const letzte_pause_vor_h = letzte_pause_vor_ms / (1000 * 60 * 60);
    const naechste_pause_in_min = letzte_pause_vor_h >= PAUSE_EMPFEHLUNG_INTERVALL_H
      ? 0
      : Math.round((PAUSE_EMPFEHLUNG_INTERVALL_H - letzte_pause_vor_h) * 60);

    return NextResponse.json({
      fahrer_id: driverId,
      schicht_dauer_h: Math.round(schicht_dauer_h * 10) / 10,
      pausen_dauer_min,
      naechste_pause_in_min,
      pause_pflicht_aktiv,
      pause_ausreichend,
      hinweis: !pause_ausreichend
        ? `Du bist seit ${schicht_dauer_h.toFixed(1)} Stunden im Einsatz. Bitte nimm bald eine Pause (mindestens ${PAUSE_PFLICHT_MIN} Min).`
        : naechste_pause_in_min === 0
        ? 'Eine kurze Pause tut gut — du bist schon länger unterwegs.'
        : null,
    } satisfies PauseErinnerungAntwort);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
