/**
 * GET /api/delivery/admin/fahrer-pause-monitor?location_id=<uuid>
 *
 * Phase 1948 — Fahrer-Pause-Monitor-API
 * Pausenzeiten je Fahrer (Start/Ende/Dauer); Alert wenn Fahrer >2h ohne Pause;
 * Gesamtpausenzeit; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PauseStatus = 'ok' | 'pause_faellig' | 'kritisch';

interface FahrerPauseInfo {
  fahrer_id: string;
  fahrer_name: string;
  letzte_pause_vor_min: number | null;
  pausen_anzahl: number;
  gesamtpausenzeit_min: number;
  status: PauseStatus;
  alert: boolean;
}

interface FahrerPauseMonitorResponse {
  location_id: string;
  fahrer: FahrerPauseInfo[];
  alert_count: number;
  generiert_am: string;
}

const ALERT_SCHWELLE_MIN = 120; // >2h ohne Pause → Alert

function statusOf(letztePauseVorMin: number | null): PauseStatus {
  if (letztePauseVorMin === null) return 'ok';
  if (letztePauseVorMin > ALERT_SCHWELLE_MIN + 60) return 'kritisch';
  if (letztePauseVorMin > ALERT_SCHWELLE_MIN) return 'pause_faellig';
  return 'ok';
}

const MOCK: FahrerPauseMonitorResponse = {
  location_id: 'mock',
  fahrer: [
    {
      fahrer_id: 'f1',
      fahrer_name: 'Max Müller',
      letzte_pause_vor_min: 45,
      pausen_anzahl: 2,
      gesamtpausenzeit_min: 30,
      status: 'ok',
      alert: false,
    },
    {
      fahrer_id: 'f2',
      fahrer_name: 'Lisa Schmidt',
      letzte_pause_vor_min: 135,
      pausen_anzahl: 1,
      gesamtpausenzeit_min: 15,
      status: 'pause_faellig',
      alert: true,
    },
    {
      fahrer_id: 'f3',
      fahrer_name: 'Tom Wagner',
      letzte_pause_vor_min: null,
      pausen_anzahl: 0,
      gesamtpausenzeit_min: 0,
      status: 'ok',
      alert: false,
    },
    {
      fahrer_id: 'f4',
      fahrer_name: 'Anna Becker',
      letzte_pause_vor_min: 195,
      pausen_anzahl: 1,
      gesamtpausenzeit_min: 10,
      status: 'kritisch',
      alert: true,
    },
  ],
  alert_count: 2,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    const sb = await createClient();

    const schichtStart = new Date();
    schichtStart.setHours(0, 0, 0, 0);

    const { data: fahrerRows, error: fehler } = await sb
      .from('delivery_drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (fehler || !fahrerRows?.length) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    const jetztMs = Date.now();

    const fahrer: FahrerPauseInfo[] = await Promise.all(
      fahrerRows.map(async (f) => {
        const { data: pausen } = await sb
          .from('driver_breaks')
          .select('started_at, ended_at')
          .eq('driver_id', f.id)
          .gte('started_at', schichtStart.toISOString())
          .order('started_at', { ascending: false });

        const rows = pausen ?? [];
        const gesamtpausenzeit_min = rows.reduce((sum, p) => {
          if (!p.ended_at) return sum;
          const dauer = (new Date(p.ended_at).getTime() - new Date(p.started_at).getTime()) / 60000;
          return sum + Math.max(0, dauer);
        }, 0);

        const letztePause = rows[0];
        const letzte_pause_vor_min = letztePause?.ended_at
          ? Math.round((jetztMs - new Date(letztePause.ended_at).getTime()) / 60000)
          : null;

        const status = statusOf(letzte_pause_vor_min);

        return {
          fahrer_id: f.id,
          fahrer_name: f.name ?? 'Unbekannt',
          letzte_pause_vor_min,
          pausen_anzahl: rows.length,
          gesamtpausenzeit_min: Math.round(gesamtpausenzeit_min),
          status,
          alert: status !== 'ok',
        };
      }),
    );

    const alert_count = fahrer.filter((f) => f.alert).length;

    const response: FahrerPauseMonitorResponse = {
      location_id: locationId,
      fahrer,
      alert_count,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
