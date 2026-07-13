import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WarnLevel = 'kritisch' | 'warnung' | 'ok';

type FahrerWarnung = {
  fahrer_id: string;
  name: string;
  zone: string;
  schicht_ende_in_min: number;
  offene_stopps: number;
  warn_level: WarnLevel;
  empfehlung: string;
};

type ApiResponse = {
  warnungen: FahrerWarnung[];
  kritisch_anzahl: number;
  location_id: string | null;
  generiert_am: string;
};

function warnLevel(endeInMin: number, offeneStopps: number): WarnLevel {
  if (offeneStopps === 0) return 'ok';
  if (endeInMin <= 15) return 'kritisch';
  if (endeInMin <= 30) return 'warnung';
  return 'ok';
}

function empfehlung(level: WarnLevel, endeInMin: number, stopps: number): string {
  if (level === 'kritisch') return `${stopps} Stop${stopps > 1 ? 's' : ''} sofort umrouten oder Schicht verlängern`;
  if (level === 'warnung') return `Ggf. letzten Stop umrouten (${endeInMin} Min bis Schichtende)`;
  return '';
}

function mockData(locationId: string | null): ApiResponse {
  const warnungen: FahrerWarnung[] = [
    { fahrer_id: 'f1', name: 'Ahmed K.', zone: 'B', schicht_ende_in_min: 12, offene_stopps: 3, warn_level: 'kritisch', empfehlung: '3 Stops sofort umrouten oder Schicht verlängern' },
    { fahrer_id: 'f3', name: 'Julia T.', zone: 'A', schicht_ende_in_min: 25, offene_stopps: 2, warn_level: 'warnung', empfehlung: 'Ggf. letzten Stop umrouten (25 Min bis Schichtende)' },
    { fahrer_id: 'f2', name: 'Marcus B.', zone: 'C', schicht_ende_in_min: 58, offene_stopps: 4, warn_level: 'ok', empfehlung: '' },
  ];
  return {
    warnungen,
    kritisch_anzahl: warnungen.filter(w => w.warn_level === 'kritisch').length,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();
    const now = new Date();

    // Active drivers with shift end time
    const dQ = supabase
      .from('driver_shifts')
      .select('driver_id, end_time, mise_drivers(id, name, zone)')
      .eq('status', 'active')
      .gt('end_time', now.toISOString());
    if (locationId) dQ.eq('location_id', locationId);
    const { data: shifts, error: shErr } = await dQ;
    if (shErr || !shifts || shifts.length === 0) throw new Error('no shifts');

    // Open stops (not delivered)
    const sQ = supabase
      .from('mise_delivery_stops')
      .select('driver_id')
      .in('status', ['assigned', 'picked_up', 'en_route']);
    if (locationId) sQ.eq('location_id', locationId);
    const { data: stops, error: stErr } = await sQ;
    if (stErr) throw stErr;

    const stopsByDriver: Record<string, number> = {};
    for (const s of stops ?? []) {
      if (!s.driver_id) continue;
      stopsByDriver[s.driver_id] = (stopsByDriver[s.driver_id] ?? 0) + 1;
    }

    const warnungen: FahrerWarnung[] = (shifts ?? []).map(sh => {
      const driver = Array.isArray(sh.mise_drivers) ? sh.mise_drivers[0] : sh.mise_drivers;
      const endeInMin = Math.round(
        (new Date(sh.end_time).getTime() - now.getTime()) / 60_000,
      );
      const offeneStopps = stopsByDriver[sh.driver_id] ?? 0;
      const level = warnLevel(endeInMin, offeneStopps);
      return {
        fahrer_id: sh.driver_id,
        name: driver?.name ?? sh.driver_id,
        zone: driver?.zone ?? '?',
        schicht_ende_in_min: endeInMin,
        offene_stopps: offeneStopps,
        warn_level: level,
        empfehlung: empfehlung(level, endeInMin, offeneStopps),
      };
    });

    return NextResponse.json({
      warnungen,
      kritisch_anzahl: warnungen.filter(w => w.warn_level === 'kritisch').length,
      location_id: locationId,
      generiert_am: now.toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
