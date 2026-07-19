import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcAmpel(etaMin: number): Ampel {
  if (etaMin <= 15) return 'gruen';
  if (etaMin <= 30) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta > 2) return { trend: 'steigend', delta };
  if (delta < -2) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

export interface FahrerRueckkehrDepotEta {
  fahrer_id: string;
  fahrer_name: string;
  rueckkehr_eta_min: number;
  rueckkehr_eta_min_vw: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_verspaetung: boolean;
}

export interface FahrerRueckkehrDepotEtaResponse {
  fahrer: FahrerRueckkehrDepotEta[];
  team_avg_eta_min: number;
  team_avg_eta_min_vw: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   eta: 10 },
    { id: 'd2', name: 'Sara K.',  eta: 22 },
    { id: 'd3', name: 'Tim B.',   eta: 35 },
    { id: 'd4', name: 'Julia F.', eta: 8  },
  ];

  const fahrer: FahrerRueckkehrDepotEta[] = drivers.map(d => {
    const eta_vw = Math.max(1, d.eta + (Math.random() > 0.5 ? 3 : -3));
    const { trend, delta } = calcTrend(d.eta, eta_vw);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      rueckkehr_eta_min: d.eta,
      rueckkehr_eta_min_vw: Math.round(eta_vw),
      trend,
      trend_delta: delta,
      ampel: calcAmpel(d.eta),
      alert_verspaetung: d.eta > 30,
    };
  }).sort((a, b) => a.rueckkehr_eta_min - b.rueckkehr_eta_min);

  const team_avg = Math.round((fahrer.reduce((s, f) => s + f.rueckkehr_eta_min, 0) / fahrer.length) * 10) / 10;
  const team_avg_vw = Math.round((fahrer.reduce((s, f) => s + f.rueckkehr_eta_min_vw, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_verspaetung).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_eta_min: team_avg };
  }

  return { fahrer, team_avg_eta_min: team_avg, team_avg_eta_min_vw: team_avg_vw, alert_count, generiert_am: new Date().toISOString() };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = createServiceClient();

    const { data: drivers, error: dErr } = await supabase
      .from('drivers')
      .select('id, name, location_id')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers?.length) {
      return NextResponse.json(buildMock(locationId, driverId));
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const vwStart = new Date(todayStart); vwStart.setDate(vwStart.getDate() - 7);
    const vwEnd = new Date(todayEnd); vwEnd.setDate(vwEnd.getDate() - 7);

    const { data: activeBatches } = await supabase
      .from('batches')
      .select('id, driver_id, estimated_return_at, created_at')
      .eq('location_id', locationId)
      .is('completed_at', null)
      .not('driver_id', 'is', null)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString());

    const { data: vwBatches } = await supabase
      .from('batches')
      .select('id, driver_id, estimated_return_at, created_at')
      .eq('location_id', locationId)
      .is('completed_at', null)
      .not('driver_id', 'is', null)
      .gte('created_at', vwStart.toISOString())
      .lte('created_at', vwEnd.toISOString());

    function getEtaMin(batches: { driver_id: string; estimated_return_at: string | null }[] | null, dId: string): number {
      const driverBatches = (batches ?? []).filter(b => b.driver_id === dId && b.estimated_return_at);
      if (!driverBatches.length) return 20;
      const latest = driverBatches.reduce((best, b) =>
        b.estimated_return_at! > best.estimated_return_at! ? b : best
      );
      const diffMs = new Date(latest.estimated_return_at!).getTime() - Date.now();
      return Math.max(1, Math.round(diffMs / 60000));
    }

    const fahrerList: FahrerRueckkehrDepotEta[] = drivers.map(d => {
      const eta = getEtaMin(activeBatches ?? [], d.id);
      const eta_vw = getEtaMin(vwBatches ?? [], d.id);
      const { trend, delta } = calcTrend(eta, eta_vw);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        rueckkehr_eta_min: eta,
        rueckkehr_eta_min_vw: eta_vw,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(eta),
        alert_verspaetung: eta > 30,
      };
    }).sort((a, b) => a.rueckkehr_eta_min - b.rueckkehr_eta_min);

    const team_avg = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.rueckkehr_eta_min, 0) / fahrerList.length) * 10) / 10
      : 0;
    const team_avg_vw = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.rueckkehr_eta_min_vw, 0) / fahrerList.length) * 10) / 10
      : 0;
    const alert_count = fahrerList.filter(f => f.alert_verspaetung).length;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_eta_min: team_avg });
    }

    return NextResponse.json({
      fahrer: fahrerList,
      team_avg_eta_min: team_avg,
      team_avg_eta_min_vw: team_avg_vw,
      alert_count,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
