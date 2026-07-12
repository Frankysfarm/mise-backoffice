import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Pause = {
  id: string;
  start_iso: string;
  ende_iso: string | null;
  dauer_min: number | null;
  status: 'laufend' | 'abgeschlossen';
  start_label: string;
  ende_label: string | null;
};

type ApiResponse = {
  pausen: Pause[];
  gesamt_pause_min: number;
  laufende_pause: boolean;
  driver_id: string;
  generiert_am: string;
};

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} Uhr`;
}

function mockData(driverId: string): ApiResponse {
  const now = Date.now();
  const pausen: Pause[] = [
    {
      id: 'mock-1',
      start_iso: new Date(now - 3 * 3600000).toISOString(),
      ende_iso: new Date(now - 3 * 3600000 + 18 * 60000).toISOString(),
      dauer_min: 18,
      status: 'abgeschlossen',
      start_label: timeLabel(new Date(now - 3 * 3600000).toISOString()),
      ende_label: timeLabel(new Date(now - 3 * 3600000 + 18 * 60000).toISOString()),
    },
    {
      id: 'mock-2',
      start_iso: new Date(now - 90 * 60000).toISOString(),
      ende_iso: new Date(now - 90 * 60000 + 12 * 60000).toISOString(),
      dauer_min: 12,
      status: 'abgeschlossen',
      start_label: timeLabel(new Date(now - 90 * 60000).toISOString()),
      ende_label: timeLabel(new Date(now - 90 * 60000 + 12 * 60000).toISOString()),
    },
  ];
  return {
    pausen,
    gesamt_pause_min: 30,
    laufende_pause: false,
    driver_id: driverId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  try {
    const supabase = await createClient();
    const schichtStart = new Date(Date.now() - 12 * 3600000).toISOString();

    const { data: rows } = await supabase
      .from('driver_pauses')
      .select('id, started_at, ended_at')
      .eq('driver_id', driverId)
      .gte('started_at', schichtStart)
      .order('started_at', { ascending: true });

    if (!rows || rows.length === 0) return NextResponse.json(mockData(driverId));

    const now = Date.now();
    const pausen: Pause[] = rows.map(r => {
      const startMs = new Date(r.started_at).getTime();
      const endeMs = r.ended_at ? new Date(r.ended_at).getTime() : null;
      const dauerMin = endeMs
        ? Math.round((endeMs - startMs) / 60000)
        : Math.round((now - startMs) / 60000);
      return {
        id: r.id,
        start_iso: r.started_at,
        ende_iso: r.ended_at ?? null,
        dauer_min: dauerMin,
        status: (r.ended_at ? 'abgeschlossen' : 'laufend') as 'laufend' | 'abgeschlossen',
        start_label: timeLabel(r.started_at),
        ende_label: r.ended_at ? timeLabel(r.ended_at) : null,
      };
    });

    const gesamt = pausen.reduce((s, p) => s + (p.dauer_min ?? 0), 0);
    const laufend = pausen.some(p => p.status === 'laufend');

    return NextResponse.json({
      pausen,
      gesamt_pause_min: gesamt,
      laufende_pause: laufend,
      driver_id: driverId,
      generiert_am: new Date().toISOString(),
    } as ApiResponse);
  } catch {
    return NextResponse.json(mockData(driverId));
  }
}
