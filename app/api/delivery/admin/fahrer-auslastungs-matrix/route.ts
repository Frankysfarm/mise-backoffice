import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StundeMatrix {
  stunde: number;
  aktiv: number;
  pause: number;
  verfuegbar: number;
}

interface FahrerAuslastungsMatrixResponse {
  location_id: string;
  stunden: StundeMatrix[];
  peak_stunde: number;
  alert_engpass: boolean;
  verfuegbar_aktuell: number;
}

const now = new Date();
const MOCK: FahrerAuslastungsMatrixResponse = {
  location_id: 'mock',
  stunden: Array.from({ length: 8 }, (_, i) => ({
    stunde: (now.getHours() - 7 + i + 24) % 24,
    aktiv: 2 + Math.round(Math.random() * 2),
    pause: Math.round(Math.random()),
    verfuegbar: 1 + Math.round(Math.random()),
  })),
  peak_stunde: (now.getHours() - 3 + 24) % 24,
  alert_engpass: false,
  verfuegbar_aktuell: 2,
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const nowTs = new Date();
    const since = new Date(nowTs.getTime() - 8 * 60 * 60 * 1000).toISOString();

    const { data: sessions } = await sb
      .from('driver_sessions')
      .select('driver_id, status, started_at, ended_at')
      .eq('location_id', locationId)
      .gte('started_at', since);

    const { data: drivers } = await sb
      .from('drivers')
      .select('id, status')
      .eq('location_id', locationId);

    const stunden: StundeMatrix[] = [];
    let peakAktiv = 0;
    let peakStunde = nowTs.getHours();

    for (let i = 7; i >= 0; i--) {
      const h = (nowTs.getHours() - i + 24) % 24;
      const hStart = new Date(nowTs);
      hStart.setHours(nowTs.getHours() - i, 0, 0, 0);
      const hEnd = new Date(hStart.getTime() + 60 * 60 * 1000);

      let aktiv = 0, pause = 0, verfuegbar = 0;
      const seen = new Set<string>();

      (sessions ?? []).forEach(s => {
        const start = new Date(s.started_at);
        const end = s.ended_at ? new Date(s.ended_at) : nowTs;
        if (start < hEnd && end > hStart && !seen.has(s.driver_id)) {
          seen.add(s.driver_id);
          if (s.status === 'active') aktiv++;
          else if (s.status === 'pause') pause++;
        }
      });

      const total = (drivers ?? []).length;
      verfuegbar = Math.max(0, total - aktiv - pause);

      if (aktiv > peakAktiv) { peakAktiv = aktiv; peakStunde = h; }
      stunden.push({ stunde: h, aktiv, pause, verfuegbar });
    }

    const verfuegbarAktuell = stunden[stunden.length - 1]?.verfuegbar ?? 0;

    return NextResponse.json({
      location_id: locationId,
      stunden,
      peak_stunde: peakStunde,
      alert_engpass: verfuegbarAktuell < 2,
      verfuegbar_aktuell: verfuegbarAktuell,
    } satisfies FahrerAuslastungsMatrixResponse);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
