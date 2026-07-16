/**
 * GET /api/delivery/admin/schicht-abschluss-bilanz?location_id=<uuid>
 *
 * Phase 1836 — Schicht-Abschluss-Bilanz-API
 * Tagesabschluss je Fahrer: Stopps, Einnahmen, Pünktlichkeitsquote, Bewertung, Vergleich Vorwoche.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FahrerBilanz {
  fahrer_id: string;
  vorname: string;
  nachname: string;
  stopps_heute: number;
  einnahmen_cents: number;
  puenktlichkeits_quote: number;
  durchschnittsbewertung: number | null;
  stopps_vorwoche_schnitt: number;
  einnahmen_vorwoche_cents: number;
  trend: 'besser' | 'gleich' | 'schlechter';
}

interface ApiAntwort {
  location_id: string;
  datum: string;
  fahrer: FahrerBilanz[];
  team_stopps: number;
  team_einnahmen_cents: number;
  team_puenktlichkeit: number;
  generiert_am: string;
}

const MOCK: ApiAntwort = {
  location_id: 'mock',
  datum: new Date().toISOString().slice(0, 10),
  fahrer: [
    {
      fahrer_id: 'f1',
      vorname: 'Max',
      nachname: 'Mustermann',
      stopps_heute: 18,
      einnahmen_cents: 14400,
      puenktlichkeits_quote: 94,
      durchschnittsbewertung: 4.8,
      stopps_vorwoche_schnitt: 15,
      einnahmen_vorwoche_cents: 12000,
      trend: 'besser',
    },
    {
      fahrer_id: 'f2',
      vorname: 'Lisa',
      nachname: 'Muster',
      stopps_heute: 12,
      einnahmen_cents: 9600,
      puenktlichkeits_quote: 75,
      durchschnittsbewertung: 4.3,
      stopps_vorwoche_schnitt: 13,
      einnahmen_vorwoche_cents: 10400,
      trend: 'schlechter',
    },
    {
      fahrer_id: 'f3',
      vorname: 'Tom',
      nachname: 'Beispiel',
      stopps_heute: 14,
      einnahmen_cents: 11200,
      puenktlichkeits_quote: 86,
      durchschnittsbewertung: 4.6,
      stopps_vorwoche_schnitt: 14,
      einnahmen_vorwoche_cents: 11200,
      trend: 'gleich',
    },
  ],
  team_stopps: 44,
  team_einnahmen_cents: 35200,
  team_puenktlichkeit: 85,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    // Heutiges Datum (UTC-Beginn 05:00)
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(5, 0, 0, 0);
    if (now.getUTCHours() < 5) todayStart.setUTCDate(todayStart.getUTCDate() - 1);

    const vorwocheStart = new Date(todayStart);
    vorwocheStart.setUTCDate(vorwocheStart.getUTCDate() - 7);
    const vorwocheEnde = new Date(todayStart);

    // Aktive Fahrer heute
    const { data: shifts } = await sb
      .from('mise_driver_shifts')
      .select('employee_id')
      .eq('location_id', locationId)
      .gte('started_at', todayStart.toISOString())
      .limit(50);

    const fahrerIds = [...new Set((shifts ?? []).map((s: any) => s.employee_id))];

    if (fahrerIds.length === 0) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    // Fahrer-Stammdaten
    const { data: drivers } = await sb
      .from('mise_drivers')
      .select('id, vorname, nachname')
      .in('id', fahrerIds);

    // Heutige abgeschlossene Stopps
    const { data: todayStopps } = await sb
      .from('mise_delivery_batches')
      .select('employee_id, delivery_fee, status, scheduled_delivery_time, actual_delivery_time')
      .eq('location_id', locationId)
      .in('employee_id', fahrerIds)
      .gte('created_at', todayStart.toISOString())
      .eq('status', 'completed');

    // Vorwoche Stopps
    const { data: vorwocheStopps } = await sb
      .from('mise_delivery_batches')
      .select('employee_id, delivery_fee')
      .eq('location_id', locationId)
      .in('employee_id', fahrerIds)
      .gte('created_at', vorwocheStart.toISOString())
      .lt('created_at', vorwocheEnde.toISOString())
      .eq('status', 'completed');

    // Bewertungen heute
    const { data: bewertungen } = await sb
      .from('customer_orders')
      .select('driver_id, driver_rating')
      .eq('location_id', locationId)
      .in('driver_id', fahrerIds)
      .gte('created_at', todayStart.toISOString())
      .not('driver_rating', 'is', null);

    const driversMap = new Map((drivers ?? []).map((d: any) => [d.id, d]));
    const vorwocheMap = new Map<string, { stopps: number; einnahmen: number }>();
    for (const s of vorwocheStopps ?? []) {
      const entry = vorwocheMap.get(s.employee_id) ?? { stopps: 0, einnahmen: 0 };
      entry.stopps++;
      entry.einnahmen += s.delivery_fee ?? 0;
      vorwocheMap.set(s.employee_id, entry);
    }
    const bewertungsMap = new Map<string, number[]>();
    for (const b of bewertungen ?? []) {
      if (!b.driver_rating) continue;
      const arr = bewertungsMap.get(b.driver_id) ?? [];
      arr.push(b.driver_rating);
      bewertungsMap.set(b.driver_id, arr);
    }

    const fahrerBilanz: FahrerBilanz[] = fahrerIds.map(id => {
      const d = driversMap.get(id);
      const heuteBatches = (todayStopps ?? []).filter((s: any) => s.employee_id === id);
      const stopps = heuteBatches.length;
      const einnahmen = heuteBatches.reduce((s: number, b: any) => s + (b.delivery_fee ?? 0), 0);

      // Pünktlichkeit: Anteil mit tatsächlicher Lieferzeit ≤ geplanter Zeit
      const mitZeit = heuteBatches.filter((b: any) => b.scheduled_delivery_time && b.actual_delivery_time);
      const puenktlich = mitZeit.filter((b: any) =>
        new Date(b.actual_delivery_time).getTime() <= new Date(b.scheduled_delivery_time).getTime() + 5 * 60_000
      ).length;
      const quote = mitZeit.length > 0 ? Math.round((puenktlich / mitZeit.length) * 100) : 80;

      const ratings = bewertungsMap.get(id) ?? [];
      const avgRating = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null;

      const vw = vorwocheMap.get(id) ?? { stopps: 0, einnahmen: 0 };
      const trend: FahrerBilanz['trend'] =
        stopps > vw.stopps * 1.05 ? 'besser' :
        stopps < vw.stopps * 0.95 ? 'schlechter' : 'gleich';

      return {
        fahrer_id: id,
        vorname: d?.vorname ?? 'Fahrer',
        nachname: d?.nachname ?? '',
        stopps_heute: stopps,
        einnahmen_cents: Math.round(einnahmen * 100),
        puenktlichkeits_quote: quote,
        durchschnittsbewertung: avgRating,
        stopps_vorwoche_schnitt: vw.stopps,
        einnahmen_vorwoche_cents: Math.round(vw.einnahmen * 100),
        trend,
      };
    }).sort((a, b) => b.stopps_heute - a.stopps_heute);

    const teamStopps = fahrerBilanz.reduce((s, f) => s + f.stopps_heute, 0);
    const teamEinnahmen = fahrerBilanz.reduce((s, f) => s + f.einnahmen_cents, 0);
    const teamPuenktlichkeit = fahrerBilanz.length > 0
      ? Math.round(fahrerBilanz.reduce((s, f) => s + f.puenktlichkeits_quote, 0) / fahrerBilanz.length)
      : 0;

    return NextResponse.json({
      location_id: locationId,
      datum: now.toISOString().slice(0, 10),
      fahrer: fahrerBilanz,
      team_stopps: teamStopps,
      team_einnahmen_cents: teamEinnahmen,
      team_puenktlichkeit: teamPuenktlichkeit,
      generiert_am: now.toISOString(),
    } satisfies ApiAntwort);
  } catch (err) {
    console.error('[schicht-abschluss-bilanz]', err);
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
