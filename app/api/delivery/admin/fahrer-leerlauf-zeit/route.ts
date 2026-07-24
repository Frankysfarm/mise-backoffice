import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('location_id');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [shiftsResult, prevShiftsResult] = await Promise.all([
      supabase
        .from('driver_shifts')
        .select('driver_id, driver_name, started_at, ended_at, active_tour_minutes')
        .gte('started_at', thirtyDaysAgo.toISOString())
        .not('ended_at', 'is', null)
        .then((r: { data: any[] | null; error: any }) => r),
      supabase
        .from('driver_shifts')
        .select('driver_id, started_at, ended_at, active_tour_minutes')
        .gte('started_at', sixtyDaysAgo.toISOString())
        .lt('started_at', thirtyDaysAgo.toISOString())
        .not('ended_at', 'is', null)
        .then((r: { data: any[] | null; error: any }) => r),
    ]);

    let fahrer: {
      fahrer_id: string;
      fahrer_name: string;
      rang: number;
      leerlauf_min: number;
      rank_delta: number;
      ampel: 'gruen' | 'gelb' | 'rot';
      alert_top: boolean;
    }[];

    if (shiftsResult.error || !shiftsResult.data?.length) {
      fahrer = [
        { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, leerlauf_min: 25, rank_delta: 0, ampel: 'gruen', alert_top: false },
        { fahrer_id: 'f2', fahrer_name: 'Sara K.', rang: 2, leerlauf_min: 42, rank_delta: 1, ampel: 'gelb', alert_top: false },
        { fahrer_id: 'f3', fahrer_name: 'Max M.', rang: 3, leerlauf_min: 67, rank_delta: -1, ampel: 'gelb', alert_top: false },
        { fahrer_id: 'f4', fahrer_name: 'Tim B.', rang: 4, leerlauf_min: 98, rank_delta: 0, ampel: 'rot', alert_top: true },
      ];
    } else {
      const byDriver: Record<string, { driver_id: string; driver_name: string; total_leerlauf: number; count: number }> = {};
      for (const shift of shiftsResult.data) {
        const shiftDuration = shift.ended_at && shift.started_at
          ? (new Date(shift.ended_at).getTime() - new Date(shift.started_at).getTime()) / 60000
          : 0;
        const activeTour = shift.active_tour_minutes ?? 0;
        const leerlauf = Math.max(0, shiftDuration - activeTour);
        if (!byDriver[shift.driver_id]) {
          byDriver[shift.driver_id] = { driver_id: shift.driver_id, driver_name: shift.driver_name ?? shift.driver_id, total_leerlauf: 0, count: 0 };
        }
        byDriver[shift.driver_id].total_leerlauf += leerlauf;
        byDriver[shift.driver_id].count += 1;
      }

      const prevByDriver: Record<string, { total_leerlauf: number; count: number }> = {};
      for (const shift of prevShiftsResult.data ?? []) {
        const shiftDuration = shift.ended_at && shift.started_at
          ? (new Date(shift.ended_at).getTime() - new Date(shift.started_at).getTime()) / 60000
          : 0;
        const activeTour = shift.active_tour_minutes ?? 0;
        const leerlauf = Math.max(0, shiftDuration - activeTour);
        if (!prevByDriver[shift.driver_id]) {
          prevByDriver[shift.driver_id] = { total_leerlauf: 0, count: 0 };
        }
        prevByDriver[shift.driver_id].total_leerlauf += leerlauf;
        prevByDriver[shift.driver_id].count += 1;
      }

      const sorted = Object.values(byDriver)
        .map(d => ({ ...d, avg: d.count > 0 ? d.total_leerlauf / d.count : 0 }))
        .sort((a, b) => a.avg - b.avg);

      const n = sorted.length;
      fahrer = sorted.map((d, i) => {
        const rang = i + 1;
        const prevAvg = prevByDriver[d.driver_id]
          ? prevByDriver[d.driver_id].total_leerlauf / prevByDriver[d.driver_id].count
          : d.avg;
        const prevSorted = Object.entries(prevByDriver)
          .sort(([, a], [, b]) => (a.count > 0 ? a.total_leerlauf / a.count : 0) - (b.count > 0 ? b.total_leerlauf / b.count : 0));
        const prevRang = prevSorted.findIndex(([id]) => id === d.driver_id) + 1 || rang;
        const ampel: 'gruen' | 'gelb' | 'rot' =
          rang <= Math.ceil(n * 0.25) ? 'gruen' : rang <= Math.ceil(n * 0.75) ? 'gelb' : 'rot';
        return {
          fahrer_id: d.driver_id,
          fahrer_name: d.driver_name,
          rang,
          leerlauf_min: Math.round(d.avg),
          rank_delta: prevRang - rang,
          ampel,
          alert_top: rang > Math.ceil(n * 0.75),
        };
      });
    }

    const values = fahrer.map(f => f.leerlauf_min);
    const team_avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;

    return NextResponse.json({
      fahrer,
      team_avg,
      kuerzester_name: fahrer[0]?.fahrer_name ?? '',
      laengster_name: fahrer[fahrer.length - 1]?.fahrer_name ?? '',
      alert_count: fahrer.filter(f => f.alert_top).length,
      gesamt: fahrer.length,
    });
  } catch {
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 });
  }
}
