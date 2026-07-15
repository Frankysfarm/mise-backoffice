import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Status = 'auf_kurs' | 'fast_da' | 'erreicht' | 'hinterher';

interface WochenzielData {
  wochenziel: number;
  verdient_diese_woche: number;
  fortschritt_pct: number;
  restbetrag: number;
  schichten_verbleibend: number;
  prognose_ende_woche: number;
  status: Status;
}

const WOCHENZIEL = 50;

function buildMock(driverId: string): WochenzielData {
  const seed = driverId.charCodeAt(0) % 4;
  const verdient = [32.4, 49.1, 50.0, 18.3][seed];
  const fortschritt = Math.min(100, (verdient / WOCHENZIEL) * 100);
  const restbetrag = Math.max(0, WOCHENZIEL - verdient);
  const schichten = [3, 1, 0, 5][seed];
  const prognose = verdient + (schichten > 0 ? (verdient / (5 - schichten + 0.5)) : 0);
  const status: Status =
    fortschritt >= 100 ? 'erreicht' :
    fortschritt >= 85  ? 'fast_da' :
    fortschritt >= 50  ? 'auf_kurs' :
    'hinterher';
  return {
    wochenziel: WOCHENZIEL,
    verdient_diese_woche: Math.round(verdient * 100) / 100,
    fortschritt_pct: Math.round(fortschritt * 10) / 10,
    restbetrag: Math.round(restbetrag * 100) / 100,
    schichten_verbleibend: schichten,
    prognose_ende_woche: Math.round(Math.min(prognose, WOCHENZIEL * 1.3) * 100) / 100,
    status,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');
  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const { data: batches } = await supabase
      .from('delivery_batches')
      .select('tip_amount, finished_at')
      .eq('driver_id', driverId)
      .eq('status', 'abgeschlossen')
      .gte('finished_at', startOfWeek.toISOString());

    if (!batches || batches.length === 0) {
      return NextResponse.json(buildMock(driverId));
    }

    const verdient = batches.reduce((sum: number, b: { tip_amount?: number | null }) =>
      sum + (b.tip_amount ?? 0), 0);

    const fortschritt = Math.min(100, (verdient / WOCHENZIEL) * 100);
    const restbetrag = Math.max(0, WOCHENZIEL - verdient);

    const today = new Date().getDay();
    const schichten_verbleibend = Math.max(0, 6 - today);

    const tage_verstrichen = Math.max(1, today === 0 ? 7 : today);
    const taeglich_avg = verdient / tage_verstrichen;
    const prognose_ende_woche = Math.round(Math.min(verdient + taeglich_avg * schichten_verbleibend, WOCHENZIEL * 1.5) * 100) / 100;

    const status: Status =
      fortschritt >= 100 ? 'erreicht' :
      fortschritt >= 85  ? 'fast_da' :
      fortschritt >= 50  ? 'auf_kurs' :
      'hinterher';

    return NextResponse.json({
      wochenziel: WOCHENZIEL,
      verdient_diese_woche: Math.round(verdient * 100) / 100,
      fortschritt_pct: Math.round(fortschritt * 10) / 10,
      restbetrag: Math.round(restbetrag * 100) / 100,
      schichten_verbleibend,
      prognose_ende_woche,
      status,
    } satisfies WochenzielData);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
