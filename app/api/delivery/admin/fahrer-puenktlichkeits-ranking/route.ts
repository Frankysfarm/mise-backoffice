import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type StatusBadge = 'gold' | 'silber' | 'bronze' | 'keine';

interface FahrerRankingRow {
  rang: number;
  fahrer_id: string;
  fahrer_name: string;
  puenktlichkeitsrate: number;
  geliefert_gesamt: number;
  puenktlich: number;
  trend: 'steigend' | 'gleich' | 'fallend';
  status: StatusBadge;
}

interface RankingResponse {
  fahrer: FahrerRankingRow[];
  gesamt_fahrer: number;
  auswertungs_zeitraum_tage: number;
}

function buildMock(): RankingResponse {
  const names = ['Ali K.', 'Jonas M.', 'Sara B.', 'Tom F.', 'Mia S.', 'Leon P.'];
  const fahrer: FahrerRankingRow[] = names.map((name, i) => {
    const gesamt = 40 + Math.round((5 - i) * 8);
    const puenktlich = Math.round(gesamt * (0.97 - i * 0.06));
    const rate = puenktlich / gesamt;
    return {
      rang: i + 1,
      fahrer_id: `mock-${i + 1}`,
      fahrer_name: name,
      puenktlichkeitsrate: Math.round(rate * 1000) / 10,
      geliefert_gesamt: gesamt,
      puenktlich,
      trend: i === 0 ? 'steigend' : i === 2 ? 'fallend' : 'gleich',
      status: i === 0 ? 'gold' : i === 1 ? 'silber' : i === 2 ? 'bronze' : 'keine',
    };
  });
  return { fahrer, gesamt_fahrer: names.length, auswertungs_zeitraum_tage: 30 };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = createClient();
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const query = supabase
      .from('delivery_batches')
      .select('driver_id, finished_at, sla_met, drivers(name)')
      .gte('finished_at', since.toISOString())
      .eq('status', 'abgeschlossen');

    if (locationId) {
      query.eq('location_id', locationId);
    }

    const { data } = await query;

    if (!data || data.length === 0) {
      return NextResponse.json(buildMock());
    }

    type BatchRow = {
      driver_id: string;
      sla_met: boolean | null;
      drivers: { name?: string | null } | null;
    };

    const byDriver: Record<string, { name: string; gesamt: number; puenktlich: number }> = {};
    for (const b of data as unknown as BatchRow[]) {
      if (!b.driver_id) continue;
      if (!byDriver[b.driver_id]) {
        byDriver[b.driver_id] = {
          name: (b.drivers as { name?: string | null } | null)?.name ?? b.driver_id.slice(0, 8),
          gesamt: 0,
          puenktlich: 0,
        };
      }
      byDriver[b.driver_id].gesamt += 1;
      if (b.sla_met) byDriver[b.driver_id].puenktlich += 1;
    }

    const sorted = Object.entries(byDriver)
      .map(([id, d]) => ({
        fahrer_id: id,
        fahrer_name: d.name,
        geliefert_gesamt: d.gesamt,
        puenktlich: d.puenktlich,
        puenktlichkeitsrate: d.gesamt > 0 ? Math.round((d.puenktlich / d.gesamt) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.puenktlichkeitsrate - a.puenktlichkeitsrate);

    const fahrer: FahrerRankingRow[] = sorted.map((f, i) => ({
      ...f,
      rang: i + 1,
      trend: 'gleich' as const,
      status: (i === 0 ? 'gold' : i === 1 ? 'silber' : i === 2 ? 'bronze' : 'keine') as StatusBadge,
    }));

    return NextResponse.json({
      fahrer,
      gesamt_fahrer: fahrer.length,
      auswertungs_zeitraum_tage: 30,
    } satisfies RankingResponse);
  } catch {
    return NextResponse.json(buildMock());
  }
}
