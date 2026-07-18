/**
 * Phase 2353 — Fahrer-Kundenzufriedenheits-API
 *
 * GET /api/delivery/admin/fahrer-kundenzufriedenheit?location_id=<uuid>
 * Bewertungs-Ø je Fahrer (1–5 Sterne) aus letzten 7 Tagen; Trend vs. Vorwoche;
 * Alert wenn <3.5; Ampel grün(≥4.5)/gelb(≥3.5)/rot(<3.5); Multi-Tenant; Supabase+Mock.
 *
 * Response: { location_id, fahrer: FahrerBewertungInfo[], team_avg, alert_count, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type BewertungsAmpel = 'gruen' | 'gelb' | 'rot';

export interface FahrerBewertungInfo {
  fahrer_id: string;
  fahrer_name: string;
  avg_bewertung: number;
  bewertungen_anzahl: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: BewertungsAmpel;
  alert: boolean;
}

export interface FahrerKundenzufriedenheitResponse {
  location_id: string;
  fahrer: FahrerBewertungInfo[];
  team_avg: number;
  alert_count: number;
  generiert_am: string;
}

function bewertungsAmpel(avg: number): BewertungsAmpel {
  if (avg >= 4.5) return 'gruen';
  if (avg >= 3.5) return 'gelb';
  return 'rot';
}

function trendLabel(delta: number): 'steigend' | 'fallend' | 'stabil' {
  if (delta > 0.1) return 'steigend';
  if (delta < -0.1) return 'fallend';
  return 'stabil';
}

const MOCK: FahrerKundenzufriedenheitResponse = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Ali K.', avg_bewertung: 4.8, bewertungen_anzahl: 32, trend: 'steigend', trend_delta: 0.3, ampel: 'gruen', alert: false },
    { fahrer_id: 'f2', fahrer_name: 'Ben S.', avg_bewertung: 4.2, bewertungen_anzahl: 18, trend: 'stabil', trend_delta: 0.0, ampel: 'gelb', alert: false },
    { fahrer_id: 'f3', fahrer_name: 'Clara M.', avg_bewertung: 3.1, bewertungen_anzahl: 11, trend: 'fallend', trend_delta: -0.5, ampel: 'rot', alert: true },
    { fahrer_id: 'f4', fahrer_name: 'David R.', avg_bewertung: 4.6, bewertungen_anzahl: 27, trend: 'steigend', trend_delta: 0.2, ampel: 'gruen', alert: false },
  ],
  team_avg: 4.2,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) {
    return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const now = new Date();
    const seit7Tagen = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const seit14Tagen = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('active', true);

    if (!drivers || drivers.length === 0) {
      return NextResponse.json({ ...MOCK, location_id: locationId, generiert_am: now.toISOString() });
    }

    const fahrerList: FahrerBewertungInfo[] = [];

    for (const driver of drivers) {
      const { data: recent } = await supabase
        .from('delivery_ratings')
        .select('rating')
        .eq('driver_id', driver.id)
        .gte('created_at', seit7Tagen);

      const { data: previous } = await supabase
        .from('delivery_ratings')
        .select('rating')
        .eq('driver_id', driver.id)
        .gte('created_at', seit14Tagen)
        .lt('created_at', seit7Tagen);

      const recentAvg = recent && recent.length > 0
        ? recent.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / recent.length
        : 0;
      const prevAvg = previous && previous.length > 0
        ? previous.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / previous.length
        : recentAvg;
      const delta = recentAvg - prevAvg;

      if (recentAvg === 0) continue;

      const ampel = bewertungsAmpel(recentAvg);
      fahrerList.push({
        fahrer_id: driver.id,
        fahrer_name: driver.name,
        avg_bewertung: Math.round(recentAvg * 10) / 10,
        bewertungen_anzahl: recent?.length ?? 0,
        trend: trendLabel(delta),
        trend_delta: Math.round(delta * 10) / 10,
        ampel,
        alert: ampel === 'rot',
      });
    }

    if (fahrerList.length === 0) {
      return NextResponse.json({ ...MOCK, location_id: locationId, generiert_am: now.toISOString() });
    }

    fahrerList.sort((a, b) => b.avg_bewertung - a.avg_bewertung);
    const teamAvg = Math.round(
      (fahrerList.reduce((s, f) => s + f.avg_bewertung, 0) / fahrerList.length) * 10
    ) / 10;
    const alertCount = fahrerList.filter((f) => f.alert).length;

    const resp: FahrerKundenzufriedenheitResponse = {
      location_id: locationId,
      fahrer: fahrerList,
      team_avg: teamAvg,
      alert_count: alertCount,
      generiert_am: now.toISOString(),
    };

    return NextResponse.json(resp);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId, generiert_am: new Date().toISOString() });
  }
}
