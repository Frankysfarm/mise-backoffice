/**
 * GET /api/delivery/admin/fahrer-reaktionszeit-statistik?location_id=<uuid>
 *
 * Phase 1577 — Fahrer-Reaktionszeit-Statistik-API
 * Ø Zeit von Tour-Zuweisung bis Fahrerbestätigung je Fahrer; 7-Tage-Trend;
 * Status schnell/normal/langsam. Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TagesWert {
  datum: string;
  avg_min: number;
}

export interface FahrerReaktionszeitStatistikEintrag {
  fahrer_id: string;
  name: string;
  avg_reaktionszeit_min: number;
  tage: TagesWert[];
  trend: 'besser' | 'gleich' | 'schlechter';
  status: 'schnell' | 'normal' | 'langsam';
  anzahl: number;
  rang: number;
}

export interface FahrerReaktionszeitStatistikResponse {
  fahrer: FahrerReaktionszeitStatistikEintrag[];
  team_avg_min: number;
  sla_ziel_min: number;
  schnell_schwelle_min: number;
  langsam_schwelle_min: number;
  location_id: string;
  generiert_am: string;
}

const SCHNELL_SCHWELLE_MIN = 3;
const LANGSAM_SCHWELLE_MIN = 6;
const SLA_ZIEL_MIN = 5;

function reaktionStatus(avg: number): 'schnell' | 'normal' | 'langsam' {
  if (avg <= SCHNELL_SCHWELLE_MIN) return 'schnell';
  if (avg >= LANGSAM_SCHWELLE_MIN) return 'langsam';
  return 'normal';
}

function trendFromTage(tage: TagesWert[]): 'besser' | 'gleich' | 'schlechter' {
  if (tage.length < 2) return 'gleich';
  const recentSlice = tage.slice(-3);
  const earlierSlice = tage.slice(0, -3);
  const recent = recentSlice.reduce((s, t) => s + t.avg_min, 0) / recentSlice.length;
  const earlierLen = Math.max(1, earlierSlice.length);
  const earlier =
    earlierSlice.length > 0
      ? earlierSlice.reduce((s, t) => s + t.avg_min, 0) / earlierLen
      : recent;
  if (recent < earlier * 0.92) return 'besser';
  if (recent > earlier * 1.08) return 'schlechter';
  return 'gleich';
}

function buildMock(locationId: string): FahrerReaktionszeitStatistikResponse {
  const fahrer: FahrerReaktionszeitStatistikEintrag[] = [
    {
      fahrer_id: 'f1', name: 'Max M.', avg_reaktionszeit_min: 2.4, anzahl: 42, rang: 1,
      trend: 'besser', status: 'schnell',
      tage: [
        { datum: '2026-07-08', avg_min: 3.5 }, { datum: '2026-07-09', avg_min: 3.2 },
        { datum: '2026-07-10', avg_min: 2.8 }, { datum: '2026-07-11', avg_min: 2.7 },
        { datum: '2026-07-12', avg_min: 2.5 }, { datum: '2026-07-13', avg_min: 2.3 },
        { datum: '2026-07-14', avg_min: 2.4 },
      ],
    },
    {
      fahrer_id: 'f2', name: 'Anna S.', avg_reaktionszeit_min: 4.7, anzahl: 35, rang: 2,
      trend: 'gleich', status: 'normal',
      tage: [
        { datum: '2026-07-08', avg_min: 4.5 }, { datum: '2026-07-09', avg_min: 4.6 },
        { datum: '2026-07-10', avg_min: 4.8 }, { datum: '2026-07-11', avg_min: 4.7 },
        { datum: '2026-07-12', avg_min: 4.9 }, { datum: '2026-07-13', avg_min: 4.6 },
        { datum: '2026-07-14', avg_min: 4.7 },
      ],
    },
    {
      fahrer_id: 'f3', name: 'Tom B.', avg_reaktionszeit_min: 7.2, anzahl: 28, rang: 3,
      trend: 'schlechter', status: 'langsam',
      tage: [
        { datum: '2026-07-08', avg_min: 5.9 }, { datum: '2026-07-09', avg_min: 6.2 },
        { datum: '2026-07-10', avg_min: 6.5 }, { datum: '2026-07-11', avg_min: 6.9 },
        { datum: '2026-07-12', avg_min: 7.1 }, { datum: '2026-07-13', avg_min: 7.4 },
        { datum: '2026-07-14', avg_min: 7.2 },
      ],
    },
  ];
  const teamAvg = parseFloat(
    (fahrer.reduce((s, f) => s + f.avg_reaktionszeit_min, 0) / fahrer.length).toFixed(1),
  );
  return {
    fahrer,
    team_avg_min: teamAvg,
    sla_ziel_min: SLA_ZIEL_MIN,
    schnell_schwelle_min: SCHNELL_SCHWELLE_MIN,
    langsam_schwelle_min: LANGSAM_SCHWELLE_MIN,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

interface RawStop {
  driver_id: string;
  assigned_at: string;
  picked_up_at: string;
  created_at: string;
}

interface RawDriver {
  id: string;
  name?: string | null;
  vorname?: string | null;
  nachname?: string | null;
}

interface DayAcc {
  total: number;
  count: number;
}

interface DriverAcc {
  days: Record<string, DayAcc>;
  total: number;
  count: number;
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: driversRaw, error: dErr } = await (sb as any)
      .from('mise_drivers')
      .select('id, name, vorname, nachname')
      .eq('location_id', locationId)
      .eq('aktiv', true);

    if (dErr || !driversRaw) throw new Error('no drivers');
    const drivers = driversRaw as RawDriver[];
    if (drivers.length === 0) throw new Error('empty');

    const { data: stopsRaw } = await (sb as any)
      .from('mise_delivery_stops')
      .select('driver_id, assigned_at, picked_up_at, created_at')
      .eq('location_id', locationId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .not('assigned_at', 'is', null)
      .not('picked_up_at', 'is', null);

    const stops = (stopsRaw as RawStop[] | null) ?? [];
    const acc: Record<string, DriverAcc> = {};

    for (const s of stops) {
      if (!s.driver_id || !s.assigned_at || !s.picked_up_at) continue;
      const diffMin =
        (new Date(s.picked_up_at).getTime() - new Date(s.assigned_at).getTime()) / 60_000;
      if (diffMin < 0 || diffMin > 60) continue;
      const day = s.created_at.slice(0, 10);
      if (!acc[s.driver_id]) acc[s.driver_id] = { days: {}, total: 0, count: 0 };
      const da = acc[s.driver_id];
      if (!da.days[day]) da.days[day] = { total: 0, count: 0 };
      da.days[day].total += diffMin;
      da.days[day].count += 1;
      da.total += diffMin;
      da.count += 1;
    }

    const result: FahrerReaktionszeitStatistikEintrag[] = [];

    for (const d of drivers) {
      const a = acc[d.id];
      if (!a || a.count === 0) continue;
      const combinedName = [d.vorname, d.nachname].filter(Boolean).join(' ');
      const name = d.name || combinedName || d.id.slice(0, 8);
      const sortedEntries = Object.entries(a.days).sort((x, y) =>
        x[0].localeCompare(y[0]),
      );
      const tage: TagesWert[] = sortedEntries.map((entry) => ({
        datum: entry[0],
        avg_min: parseFloat((entry[1].total / entry[1].count).toFixed(1)),
      }));
      const avg = parseFloat((a.total / a.count).toFixed(1));
      result.push({
        fahrer_id: d.id,
        name,
        avg_reaktionszeit_min: avg,
        tage,
        trend: trendFromTage(tage),
        status: reaktionStatus(avg),
        anzahl: a.count,
        rang: 0,
      });
    }

    if (result.length === 0) throw new Error('no data');

    result.sort((a, b) => a.avg_reaktionszeit_min - b.avg_reaktionszeit_min);
    result.forEach((f, i) => {
      f.rang = i + 1;
    });

    const teamAvg = parseFloat(
      (result.reduce((s, f) => s + f.avg_reaktionszeit_min, 0) / result.length).toFixed(1),
    );

    return NextResponse.json({
      fahrer: result,
      team_avg_min: teamAvg,
      sla_ziel_min: SLA_ZIEL_MIN,
      schnell_schwelle_min: SCHNELL_SCHWELLE_MIN,
      langsam_schwelle_min: LANGSAM_SCHWELLE_MIN,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerReaktionszeitStatistikResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
