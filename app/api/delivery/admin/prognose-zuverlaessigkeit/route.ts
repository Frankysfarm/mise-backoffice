/**
 * GET /api/delivery/admin/prognose-zuverlaessigkeit?location_id=<uuid>
 *
 * Phase 2002 — Prognose-Zuverlässigkeits-Score-API
 * ETA-Trefferquote (±5 Min) je Fahrer letzte 30 Bestellungen; Score 0–100; Trend vs. Vortag; Multi-Tenant; Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerPrognoseScore {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  trefferquote_pct: number;
  bestellungen_geprueft: number;
  trend: Trend;
  alert: boolean;
  rang: number;
}

interface PrognoseZuverlaessigkeitResponse {
  location_id: string;
  fahrer: FahrerPrognoseScore[];
  team_durchschnitt: number;
  alert_count: number;
  generiert_am: string;
}

function trendOf(heute: number, gestern: number): Trend {
  const delta = heute - gestern;
  if (delta > 3) return 'steigend';
  if (delta < -3) return 'fallend';
  return 'stabil';
}

const MOCK: PrognoseZuverlaessigkeitResponse = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max Müller',   score: 88, trefferquote_pct: 88, bestellungen_geprueft: 28, trend: 'steigend', alert: false, rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Lisa Schmidt', score: 76, trefferquote_pct: 76, bestellungen_geprueft: 30, trend: 'stabil',   alert: false, rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tom Wagner',   score: 63, trefferquote_pct: 63, bestellungen_geprueft: 25, trend: 'fallend',  alert: true,  rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Anna Becker',  score: 55, trefferquote_pct: 55, bestellungen_geprueft: 22, trend: 'fallend',  alert: true,  rang: 4 },
  ],
  team_durchschnitt: 70,
  alert_count: 2,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    const sb = await createClient();

    const jetzt = new Date();
    const vor30Tagen = new Date(jetzt.getTime() - 30 * 24 * 60 * 60 * 1000);
    const vor60Tagen = new Date(jetzt.getTime() - 60 * 24 * 60 * 60 * 1000);

    const { data: fahrerRows, error: fahrerFehler } = await sb
      .from('delivery_drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (fahrerFehler || !fahrerRows?.length) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    const scoredFahrer: FahrerPrognoseScore[] = await Promise.all(
      fahrerRows.map(async (f) => {
        const calcTrefferquote = async (von: Date, bis: Date): Promise<number> => {
          const { data: orders } = await sb
            .from('orders')
            .select('eta_minutes, actual_delivery_minutes')
            .eq('location_id', locationId)
            .eq('driver_id', f.id)
            .not('actual_delivery_minutes', 'is', null)
            .not('eta_minutes', 'is', null)
            .gte('created_at', von.toISOString())
            .lt('created_at', bis.toISOString())
            .order('created_at', { ascending: false })
            .limit(30);

          const rows = orders ?? [];
          if (!rows.length) return -1;
          const treffer = rows.filter((o) => Math.abs((o.eta_minutes ?? 0) - (o.actual_delivery_minutes ?? 0)) <= 5);
          return Math.round((treffer.length / rows.length) * 100);
        };

        const [heute_pct, gestern_pct] = await Promise.all([
          calcTrefferquote(vor30Tagen, jetzt),
          calcTrefferquote(vor60Tagen, vor30Tagen),
        ]);

        const score = heute_pct >= 0 ? heute_pct : 0;
        const trend = gestern_pct >= 0 ? trendOf(score, gestern_pct) : 'stabil';

        return {
          fahrer_id: f.id,
          fahrer_name: f.name ?? 'Unbekannt',
          score,
          trefferquote_pct: score,
          bestellungen_geprueft: 30,
          trend,
          alert: score < 70,
          rang: 0,
        };
      }),
    );

    scoredFahrer.sort((a, b) => b.score - a.score);
    scoredFahrer.forEach((f, i) => { f.rang = i + 1; });

    const alert_count = scoredFahrer.filter((f) => f.alert).length;
    const team_durchschnitt = scoredFahrer.length
      ? Math.round(scoredFahrer.reduce((s, f) => s + f.score, 0) / scoredFahrer.length)
      : 0;

    const response: PrognoseZuverlaessigkeitResponse = {
      location_id: locationId,
      fahrer: scoredFahrer,
      team_durchschnitt,
      alert_count,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
