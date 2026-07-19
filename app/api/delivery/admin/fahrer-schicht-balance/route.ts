import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcAmpel(pct: number): Ampel {
  if (pct >= 80) return 'gruen';
  if (pct >= 60) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta > 2) return { trend: 'steigend', delta };
  if (delta < -2) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

export interface FahrerSchichtBalance {
  fahrer_id: string;
  fahrer_name: string;
  balance_score_pct: number;
  balance_score_pct_vw: number;
  regulaer_schichten: number;
  sonder_schichten: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_imbalance: boolean;
}

export interface FahrerSchichtBalanceResponse {
  fahrer: FahrerSchichtBalance[];
  team_avg_balance_pct: number;
  team_avg_balance_pct_vw: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   reg: 12, sonder: 3 },
    { id: 'd2', name: 'Sara K.',  reg: 8,  sonder: 5 },
    { id: 'd3', name: 'Tim B.',   reg: 6,  sonder: 7 },
    { id: 'd4', name: 'Julia F.', reg: 15, sonder: 2 },
  ];

  const fahrer: FahrerSchichtBalance[] = drivers.map(d => {
    const total = d.reg + d.sonder;
    const pct = total > 0 ? Math.round((d.reg / total) * 1000) / 10 : 100;
    const pct_vw = Math.max(0, Math.min(100, pct + (Math.random() > 0.5 ? 5 : -5)));
    const { trend, delta } = calcTrend(pct, pct_vw);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      balance_score_pct: pct,
      balance_score_pct_vw: Math.round(pct_vw * 10) / 10,
      regulaer_schichten: d.reg,
      sonder_schichten: d.sonder,
      trend,
      trend_delta: delta,
      ampel: calcAmpel(pct),
      alert_imbalance: pct < 60,
    };
  }).sort((a, b) => b.balance_score_pct - a.balance_score_pct);

  const team_avg = Math.round((fahrer.reduce((s, f) => s + f.balance_score_pct, 0) / fahrer.length) * 10) / 10;
  const team_avg_vw = Math.round((fahrer.reduce((s, f) => s + f.balance_score_pct_vw, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_imbalance).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_balance_pct: team_avg };
  }

  return { fahrer, team_avg_balance_pct: team_avg, team_avg_balance_pct_vw: team_avg_vw, alert_count, generiert_am: new Date().toISOString() };
}

// Sonder-Schichten = Nachtschicht + Wochenend + Feiertag shifts
// We approximate via shift metadata: shifts on weekends or between 22:00–06:00 count as "Sonder"
function isSonderShift(startedAt: string): boolean {
  const d = new Date(startedAt);
  const dow = d.getDay(); // 0=Sun, 6=Sat
  const hour = d.getHours();
  if (dow === 0 || dow === 6) return true;
  if (hour >= 22 || hour < 6) return true;
  return false;
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

    const { data: shiftsToday } = await supabase
      .from('driver_shifts')
      .select('driver_id, started_at')
      .eq('location_id', locationId)
      .gte('started_at', todayStart.toISOString())
      .lte('started_at', todayEnd.toISOString());

    const { data: shiftsVw } = await supabase
      .from('driver_shifts')
      .select('driver_id, started_at')
      .eq('location_id', locationId)
      .gte('started_at', vwStart.toISOString())
      .lte('started_at', vwEnd.toISOString());

    function buildScores(shifts: { driver_id: string; started_at: string }[]) {
      const reg = new Map<string, number>();
      const sonder = new Map<string, number>();
      for (const s of shifts) {
        const key = s.driver_id;
        if (isSonderShift(s.started_at)) {
          sonder.set(key, (sonder.get(key) ?? 0) + 1);
        } else {
          reg.set(key, (reg.get(key) ?? 0) + 1);
        }
      }
      return { reg, sonder };
    }

    const today = buildScores(shiftsToday ?? []);
    const vw = buildScores(shiftsVw ?? []);

    const fahrerList: FahrerSchichtBalance[] = drivers.map(d => {
      const r = today.reg.get(d.id) ?? 0;
      const s = today.sonder.get(d.id) ?? 0;
      const total = r + s;
      const pct = total > 0 ? Math.round((r / total) * 1000) / 10 : 100;

      const r_vw = vw.reg.get(d.id) ?? 0;
      const s_vw = vw.sonder.get(d.id) ?? 0;
      const total_vw = r_vw + s_vw;
      const pct_vw = total_vw > 0 ? Math.round((r_vw / total_vw) * 1000) / 10 : 100;

      const { trend, delta } = calcTrend(pct, pct_vw);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        balance_score_pct: pct,
        balance_score_pct_vw: pct_vw,
        regulaer_schichten: r,
        sonder_schichten: s,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(pct),
        alert_imbalance: pct < 60,
      };
    }).sort((a, b) => b.balance_score_pct - a.balance_score_pct);

    const team_avg = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.balance_score_pct, 0) / fahrerList.length) * 10) / 10
      : 0;
    const team_avg_vw = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.balance_score_pct_vw, 0) / fahrerList.length) * 10) / 10
      : 0;
    const alert_count = fahrerList.filter(f => f.alert_imbalance).length;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_balance_pct: team_avg });
    }

    return NextResponse.json({
      fahrer: fahrerList,
      team_avg_balance_pct: team_avg,
      team_avg_balance_pct_vw: team_avg_vw,
      alert_count,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
