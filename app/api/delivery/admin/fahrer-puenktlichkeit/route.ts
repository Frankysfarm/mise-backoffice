/**
 * GET /api/delivery/admin/fahrer-puenktlichkeit?location_id=<uuid>
 *
 * Phase 1353 — Fahrer-Pünktlichkeits-Rangliste (Admin)
 * Stopps pünktlich vs. zu spät je Fahrer; Score A/B/C/D; Rangliste mit Trend.
 * Supabase mise_delivery_stops + mise_delivery_batches + mise_drivers + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type PuenktlichkeitsGrade = 'A' | 'B' | 'C' | 'D';

interface FahrerPuenktlichkeit {
  fahrer_id: string;
  fahrer_name: string;
  gesamt_stopps: number;
  puenktlich: number;
  zu_spaet: number;
  quote_pct: number;
  grade: PuenktlichkeitsGrade;
  trend: 'besser' | 'gleich' | 'schlechter';
}

interface PuenktlichkeitsResponse {
  rangliste: FahrerPuenktlichkeit[];
  generiert_am: string;
}

function gradeFromQuote(pct: number): PuenktlichkeitsGrade {
  if (pct >= 90) return 'A';
  if (pct >= 75) return 'B';
  if (pct >= 60) return 'C';
  return 'D';
}

function buildMock(): PuenktlichkeitsResponse {
  return {
    rangliste: [
      { fahrer_id: 'm1', fahrer_name: 'Max M.',   gesamt_stopps: 42, puenktlich: 39, zu_spaet:  3, quote_pct: 92.9, grade: 'A', trend: 'besser' },
      { fahrer_id: 'm2', fahrer_name: 'Sara K.',  gesamt_stopps: 38, puenktlich: 31, zu_spaet:  7, quote_pct: 81.6, grade: 'B', trend: 'gleich' },
      { fahrer_id: 'm3', fahrer_name: 'Tim B.',   gesamt_stopps: 29, puenktlich: 20, zu_spaet:  9, quote_pct: 69.0, grade: 'C', trend: 'schlechter' },
      { fahrer_id: 'm4', fahrer_name: 'Lisa F.',  gesamt_stopps: 19, puenktlich: 10, zu_spaet:  9, quote_pct: 52.6, grade: 'D', trend: 'gleich' },
    ],
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const since7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since14Days = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: drivers, error: driversErr } = await (sb as any)
      .from('mise_drivers')
      .select('id, employees(vorname, nachname)')
      .eq('location_id', locationId)
      .eq('aktiv', true);

    if (driversErr || !drivers || (drivers as unknown[]).length === 0) {
      return NextResponse.json(buildMock());
    }

    const { data: stops7, error: stopsErr7 } = await (sb as any)
      .from('mise_delivery_stops')
      .select('id, geliefert_am, eta_min, mise_delivery_batches!inner(fahrer_id, location_id, started_at)')
      .eq('mise_delivery_batches.location_id', locationId)
      .gte('geliefert_am', since7Days)
      .not('geliefert_am', 'is', null);

    const { data: stops14 } = await (sb as any)
      .from('mise_delivery_stops')
      .select('id, geliefert_am, eta_min, mise_delivery_batches!inner(fahrer_id, location_id, started_at)')
      .eq('mise_delivery_batches.location_id', locationId)
      .gte('geliefert_am', since14Days)
      .lt('geliefert_am', since7Days)
      .not('geliefert_am', 'is', null);

    if (stopsErr7 || !stops7) return NextResponse.json(buildMock());

    type StopRow = { id: string; geliefert_am: string; eta_min: number | null; mise_delivery_batches: { fahrer_id: string; started_at: string } };

    function calcQuote(stopList: StopRow[], fahrerIds: string[]): Map<string, { ges: number; pkt: number }> {
      const map = new Map<string, { ges: number; pkt: number }>();
      for (const fid of fahrerIds) map.set(fid, { ges: 0, pkt: 0 });
      for (const s of stopList) {
        const fid = s.mise_delivery_batches?.fahrer_id;
        if (!fid || !map.has(fid)) continue;
        const entry = map.get(fid)!;
        entry.ges++;
        const batchStart = new Date(s.mise_delivery_batches.started_at).getTime();
        const delivered = new Date(s.geliefert_am).getTime();
        const etaMs = (s.eta_min ?? 30) * 60_000;
        if (delivered <= batchStart + etaMs + 5 * 60_000) entry.pkt++;
      }
      return map;
    }

    const fahrerIds = (drivers as { id: string }[]).map(d => d.id);
    const map7  = calcQuote(stops7  as StopRow[], fahrerIds);
    const map14 = calcQuote((stops14 ?? []) as StopRow[], fahrerIds);

    const rangliste: FahrerPuenktlichkeit[] = (drivers as { id: string; employees: { vorname: string; nachname: string } | null }[])
      .map(d => {
        const s7  = map7.get(d.id)  ?? { ges: 0, pkt: 0 };
        const s14 = map14.get(d.id) ?? { ges: 0, pkt: 0 };
        const gesamt = s7.ges;
        const pkt = s7.pkt;
        const late = gesamt - pkt;
        const pct = gesamt > 0 ? Math.round((pkt / gesamt) * 1000) / 10 : 0;
        const pct14 = s14.ges > 0 ? (s14.pkt / s14.ges) * 100 : pct;
        const trend: FahrerPuenktlichkeit['trend'] = pct > pct14 + 3 ? 'besser' : pct < pct14 - 3 ? 'schlechter' : 'gleich';
        const vorname = d.employees?.vorname ?? '';
        const nachname = d.employees?.nachname ?? '';
        return {
          fahrer_id: d.id,
          fahrer_name: `${vorname} ${nachname}`.trim() || 'Fahrer',
          gesamt_stopps: gesamt,
          puenktlich: pkt,
          zu_spaet: late,
          quote_pct: pct,
          grade: gradeFromQuote(pct),
          trend,
        };
      })
      .filter(f => f.gesamt_stopps > 0)
      .sort((a, b) => b.quote_pct - a.quote_pct);

    if (rangliste.length === 0) return NextResponse.json(buildMock());

    return NextResponse.json({ rangliste, generiert_am: new Date().toISOString() } satisfies PuenktlichkeitsResponse);
  } catch {
    return NextResponse.json(buildMock());
  }
}
