/**
 * Phase 2193 — Fahrer-Einnahmen-Performance-API
 *
 * GET /api/delivery/admin/fahrer-einnahmen-performance?location_id=<uuid>
 * Verdienst (€) + Trinkgeld je Fahrer heute; Trend vs. 7-Tage-Ø; Alert wenn <50% Team-Ø
 * Multi-Tenant; Supabase + Mock-Fallback.
 *
 * Response: { location_id, fahrer: FahrerEinnahmenPerf[], team_durchschnitt_eur, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type Trend = 'steigend' | 'fallend' | 'stabil';

export interface FahrerEinnahmenPerf {
  fahrer_id: string;
  name: string;
  verdienst_eur: number;
  trinkgeld_eur: number;
  touren_heute: number;
  trend: Trend;
  trend_delta_eur: number;
  alert: boolean;
  rang: number;
}

export interface FahrerEinnahmenPerfAntwort {
  location_id: string;
  fahrer: FahrerEinnahmenPerf[];
  team_durchschnitt_eur: number;
  generiert_am: string;
}

const MOCK_FAHRER: Omit<FahrerEinnahmenPerf, 'rang'>[] = [
  { fahrer_id: 'f1', name: 'Max Müller',   verdienst_eur: 84.5,  trinkgeld_eur: 12.0, touren_heute: 6, trend: 'steigend', trend_delta_eur:  8.0, alert: false },
  { fahrer_id: 'f2', name: 'Lena Schmidt', verdienst_eur: 62.0,  trinkgeld_eur:  7.5, touren_heute: 4, trend: 'stabil',   trend_delta_eur:  0.5, alert: false },
  { fahrer_id: 'f3', name: 'Tom Becker',   verdienst_eur: 28.0,  trinkgeld_eur:  3.0, touren_heute: 2, trend: 'fallend',  trend_delta_eur: -15.0, alert: true  },
];

function trendVon(heute: number, avg7: number): { trend: Trend; delta: number } {
  const delta = Math.round((heute - avg7) * 10) / 10;
  if (delta > 3) return { trend: 'steigend', delta };
  if (delta < -3) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta: 0 };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const jetzt = new Date();
  const heuteStart = new Date(jetzt);
  heuteStart.setHours(0, 0, 0, 0);
  const vor7Tagen = new Date(jetzt.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const supabase = await createClient();

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, full_name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (!drivers || drivers.length === 0) throw new Error('keine Fahrer');

    const unsorted = await Promise.all(
      drivers.map(async (d: { id: string; full_name: string | null }) => {
        const { data: heuteRows } = await supabase
          .from('mise_delivery_batches')
          .select('revenue_eur, total_tip_eur')
          .eq('location_id', locationId)
          .eq('driver_id', d.id)
          .eq('status', 'delivered')
          .gte('delivered_at', heuteStart.toISOString());

        const touren_heute = heuteRows?.length ?? 0;
        const verdienst_eur =
          Math.round((heuteRows ?? []).reduce((s: number, r: { revenue_eur: number | null }) => s + (r.revenue_eur ?? 0), 0) * 100) / 100;
        const trinkgeld_eur =
          Math.round((heuteRows ?? []).reduce((s: number, r: { total_tip_eur: number | null }) => s + (r.total_tip_eur ?? 0), 0) * 100) / 100;

        const { data: wocheRows } = await supabase
          .from('mise_delivery_batches')
          .select('revenue_eur')
          .eq('location_id', locationId)
          .eq('driver_id', d.id)
          .eq('status', 'delivered')
          .gte('delivered_at', vor7Tagen.toISOString())
          .lt('delivered_at', heuteStart.toISOString());

        const avg7 =
          (wocheRows?.length ?? 0) > 0
            ? Math.round(((wocheRows ?? []).reduce((s: number, r: { revenue_eur: number | null }) => s + (r.revenue_eur ?? 0), 0) / 7) * 100) / 100
            : verdienst_eur;

        const { trend, delta } = trendVon(verdienst_eur, avg7);

        return {
          fahrer_id: d.id,
          name: d.full_name ?? 'Unbekannt',
          verdienst_eur,
          trinkgeld_eur,
          touren_heute,
          trend,
          trend_delta_eur: delta,
          alert: false,
        };
      })
    );

    const mitVerdienst = unsorted.filter(f => f.verdienst_eur > 0);
    const team_durchschnitt_eur =
      mitVerdienst.length > 0
        ? Math.round((mitVerdienst.reduce((s, f) => s + f.verdienst_eur, 0) / mitVerdienst.length) * 100) / 100
        : 0;

    const withAlert = unsorted.map(f => ({
      ...f,
      alert: f.verdienst_eur > 0 && team_durchschnitt_eur > 0 && f.verdienst_eur < team_durchschnitt_eur * 0.5,
    }));

    const sorted = [...withAlert].sort((a, b) => b.verdienst_eur - a.verdienst_eur);
    const fahrerListe: FahrerEinnahmenPerf[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerListe,
      team_durchschnitt_eur,
      generiert_am: jetzt.toISOString(),
    } satisfies FahrerEinnahmenPerfAntwort);
  } catch {
    const sorted = [...MOCK_FAHRER].sort((a, b) => b.verdienst_eur - a.verdienst_eur);
    const fahrerListe: FahrerEinnahmenPerf[] = sorted.map((f, i) => ({ ...f, rang: i + 1 }));
    const team_durchschnitt_eur =
      Math.round((fahrerListe.reduce((s, f) => s + f.verdienst_eur, 0) / fahrerListe.length) * 100) / 100;
    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerListe,
      team_durchschnitt_eur,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerEinnahmenPerfAntwort);
  }
}
