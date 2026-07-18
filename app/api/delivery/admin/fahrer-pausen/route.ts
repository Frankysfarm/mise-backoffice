/**
 * GET /api/delivery/admin/fahrer-pausen?location_id=<uuid>
 *
 * Phase 2301 — Fahrer-Pausen-API
 * Zeit seit letzter Pause je Fahrer heute; Pflichtpausen-Alert wenn >4h;
 * Ampel grün(ok)/gelb(>4h)/rot(>6h); Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GELB_MIN = 240; // >4h ohne Pause
const ROT_MIN = 360;  // >6h ohne Pause

export type PausenAmpel = 'gruen' | 'gelb' | 'rot';

export interface FahrerPausenInfo {
  fahrer_id: string;
  fahrer_name: string;
  letzte_pause_vor_min: number | null;
  pausen_anzahl: number;
  gesamtpausenzeit_min: number;
  ampel: PausenAmpel;
  alert: boolean;
}

export interface FahrerPausenResponse {
  location_id: string;
  fahrer: FahrerPausenInfo[];
  alert_count: number;
  team_avg_pausen: number;
  generiert_am: string;
}

function ampelOf(letztePauseVorMin: number | null): PausenAmpel {
  if (letztePauseVorMin === null) return 'gruen';
  if (letztePauseVorMin > ROT_MIN) return 'rot';
  if (letztePauseVorMin > GELB_MIN) return 'gelb';
  return 'gruen';
}

const MOCK: FahrerPausenResponse = {
  location_id: 'mock',
  fahrer: [
    {
      fahrer_id: 'f1',
      fahrer_name: 'Max Müller',
      letzte_pause_vor_min: 90,
      pausen_anzahl: 2,
      gesamtpausenzeit_min: 35,
      ampel: 'gruen',
      alert: false,
    },
    {
      fahrer_id: 'f2',
      fahrer_name: 'Lisa Schmidt',
      letzte_pause_vor_min: 270,
      pausen_anzahl: 1,
      gesamtpausenzeit_min: 15,
      ampel: 'gelb',
      alert: true,
    },
    {
      fahrer_id: 'f3',
      fahrer_name: 'Tom Wagner',
      letzte_pause_vor_min: null,
      pausen_anzahl: 0,
      gesamtpausenzeit_min: 0,
      ampel: 'gruen',
      alert: false,
    },
    {
      fahrer_id: 'f4',
      fahrer_name: 'Anna Becker',
      letzte_pause_vor_min: 420,
      pausen_anzahl: 1,
      gesamtpausenzeit_min: 10,
      ampel: 'rot',
      alert: true,
    },
  ],
  alert_count: 2,
  team_avg_pausen: 1,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    const sb = await createClient();
    const schichtStart = new Date();
    schichtStart.setHours(0, 0, 0, 0);

    const { data: fahrerRows, error } = await sb
      .from('delivery_drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (error || !fahrerRows?.length) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    const jetztMs = Date.now();

    const fahrer: FahrerPausenInfo[] = await Promise.all(
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

        const ampel = ampelOf(letzte_pause_vor_min);

        return {
          fahrer_id: f.id,
          fahrer_name: f.name ?? 'Unbekannt',
          letzte_pause_vor_min,
          pausen_anzahl: rows.length,
          gesamtpausenzeit_min: Math.round(gesamtpausenzeit_min),
          ampel,
          alert: ampel !== 'gruen',
        };
      }),
    );

    const alert_count = fahrer.filter((f) => f.alert).length;
    const team_avg_pausen =
      fahrer.length > 0
        ? Math.round(fahrer.reduce((s, f) => s + f.pausen_anzahl, 0) / fahrer.length)
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      alert_count,
      team_avg_pausen,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerPausenResponse);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
