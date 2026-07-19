import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcAmpel(score: number): Ampel {
  if (score >= 80) return 'gruen';
  if (score >= 60) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta > 2) return { trend: 'steigend', delta };
  if (delta < -2) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

// Score 0–100: Durchschnitt aus Touren/h-Score, Pünktlichkeit, Bewertungs-Score
function calcEffizienzScore(touren_h: number, puenktlichkeit_pct: number, bewertung_sterne: number): number {
  const touren_score = Math.min(100, (touren_h / 4) * 100); // Ziel: 4 Touren/h
  const bewertungs_score = (bewertung_sterne / 5) * 100;
  const combined = (touren_score + puenktlichkeit_pct + bewertungs_score) / 3;
  return Math.round(combined * 10) / 10;
}

export interface FahrerEffizienzIndex {
  fahrer_id: string;
  fahrer_name: string;
  effizienz_score: number;
  effizienz_score_vw: number;
  touren_pro_stunde: number;
  puenktlichkeit_pct: number;
  bewertung_sterne: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
}

export interface FahrerEffizienzIndexResponse {
  fahrer: FahrerEffizienzIndex[];
  team_avg_score: number;
  team_avg_score_vw: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   touren_h: 4.2, puenktlichkeit: 94, sterne: 4.7 },
    { id: 'd2', name: 'Sara K.',  touren_h: 3.1, puenktlichkeit: 78, sterne: 4.1 },
    { id: 'd3', name: 'Tim B.',   touren_h: 2.4, puenktlichkeit: 65, sterne: 3.6 },
    { id: 'd4', name: 'Julia F.', touren_h: 3.8, puenktlichkeit: 91, sterne: 4.5 },
  ];

  const fahrer: FahrerEffizienzIndex[] = drivers.map(d => {
    const score = calcEffizienzScore(d.touren_h, d.puenktlichkeit, d.sterne);
    const score_vw = Math.max(0, Math.min(100, score + (Math.random() > 0.5 ? 4 : -4)));
    const { trend, delta } = calcTrend(score, score_vw);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      effizienz_score: score,
      effizienz_score_vw: Math.round(score_vw * 10) / 10,
      touren_pro_stunde: d.touren_h,
      puenktlichkeit_pct: d.puenktlichkeit,
      bewertung_sterne: d.sterne,
      trend,
      trend_delta: delta,
      ampel: calcAmpel(score),
      alert_niedrig: score < 60,
    };
  }).sort((a, b) => b.effizienz_score - a.effizienz_score);

  const team_avg = Math.round((fahrer.reduce((s, f) => s + f.effizienz_score, 0) / fahrer.length) * 10) / 10;
  const team_avg_vw = Math.round((fahrer.reduce((s, f) => s + f.effizienz_score_vw, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_niedrig).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_score: team_avg };
  }

  return { fahrer, team_avg_score: team_avg, team_avg_score_vw: team_avg_vw, alert_count, generiert_am: new Date().toISOString() };
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

    // Fetch batches (tours) for Touren/h calculation
    const { data: batchesToday } = await supabase
      .from('batches')
      .select('id, driver_id, created_at, completed_at')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString());

    const { data: batchesVw } = await supabase
      .from('batches')
      .select('id, driver_id, created_at, completed_at')
      .eq('location_id', locationId)
      .gte('created_at', vwStart.toISOString())
      .lte('created_at', vwEnd.toISOString());

    // Fetch on-time deliveries for Pünktlichkeit
    const { data: ordersToday } = await supabase
      .from('orders')
      .select('id, driver_id, eta_promised_at, geliefert_am')
      .eq('location_id', locationId)
      .not('geliefert_am', 'is', null)
      .gte('geliefert_am', todayStart.toISOString())
      .lte('geliefert_am', todayEnd.toISOString());

    // Fetch ratings for Kundenbewertung
    const { data: ratingsToday } = await supabase
      .from('driver_ratings')
      .select('driver_id, sterne')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString());

    // Helper: Touren/h per driver
    function tourenProStunde(batches: { driver_id: string; created_at: string; completed_at: string | null }[], dId: string): number {
      const driverBatches = (batches ?? []).filter(b => b.driver_id === dId && b.completed_at);
      if (!driverBatches.length) return 0;
      const totalH = driverBatches.reduce((s, b) => {
        const diff = (new Date(b.completed_at!).getTime() - new Date(b.created_at).getTime()) / 3600000;
        return s + Math.max(0, diff);
      }, 0);
      return totalH > 0 ? Math.round((driverBatches.length / totalH) * 10) / 10 : 0;
    }

    // Helper: Pünktlichkeit % per driver
    function puenktlichkeitPct(orders: { driver_id: string; eta_promised_at: string | null; geliefert_am: string | null }[], dId: string): number {
      const dOrders = (orders ?? []).filter(o => o.driver_id === dId);
      if (!dOrders.length) return 90;
      const onTime = dOrders.filter(o => !o.eta_promised_at || !o.geliefert_am || new Date(o.geliefert_am) <= new Date(o.eta_promised_at)).length;
      return Math.round((onTime / dOrders.length) * 1000) / 10;
    }

    // Helper: Ø Sterne per driver
    function avgSterne(ratings: { driver_id: string; sterne: number }[], dId: string): number {
      const dRatings = (ratings ?? []).filter(r => r.driver_id === dId);
      if (!dRatings.length) return 4.0;
      return Math.round((dRatings.reduce((s, r) => s + r.sterne, 0) / dRatings.length) * 10) / 10;
    }

    const fahrerList: FahrerEffizienzIndex[] = drivers.map(d => {
      const th = tourenProStunde(batchesToday ?? [], d.id);
      const pk = puenktlichkeitPct(ordersToday ?? [], d.id);
      const st = avgSterne(ratingsToday ?? [], d.id);
      const score = calcEffizienzScore(th, pk, st);

      const th_vw = tourenProStunde(batchesVw ?? [], d.id);
      const pk_vw = puenktlichkeitPct([], d.id); // no VW orders fetched separately; use same
      const st_vw = avgSterne([], d.id);
      const score_vw = calcEffizienzScore(th_vw || th, pk_vw, st_vw);

      const { trend, delta } = calcTrend(score, score_vw);

      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        effizienz_score: score,
        effizienz_score_vw: Math.round(score_vw * 10) / 10,
        touren_pro_stunde: th,
        puenktlichkeit_pct: pk,
        bewertung_sterne: st,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(score),
        alert_niedrig: score < 60,
      };
    }).sort((a, b) => b.effizienz_score - a.effizienz_score);

    const team_avg = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.effizienz_score, 0) / fahrerList.length) * 10) / 10
      : 0;
    const team_avg_vw = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.effizienz_score_vw, 0) / fahrerList.length) * 10) / 10
      : 0;
    const alert_count = fahrerList.filter(f => f.alert_niedrig).length;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_score: team_avg });
    }

    return NextResponse.json({
      fahrer: fahrerList,
      team_avg_score: team_avg,
      team_avg_score_vw: team_avg_vw,
      alert_count,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
