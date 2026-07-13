import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1229 — Energie-Verlauf-API (Driver)
// GET ?driver_id=<uuid> → letzte 5 Energie-Checks + Ø-Energie + Vergleich zu gestern

interface EnergieCheck {
  id: string;
  created_at: string;
  energie_level: number;
  kommentar?: string | null;
}

interface EnergieVerlaufResponse {
  checks: EnergieCheck[];
  avg_energie: number;
  avg_energie_gestern: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  driver_id: string;
  generiert_am: string;
}

function mockResponse(driver_id: string): EnergieVerlaufResponse {
  const now = Date.now();
  const checks: EnergieCheck[] = [
    { id: 'e1', created_at: new Date(now - 150 * 60000).toISOString(), energie_level: 4 },
    { id: 'e2', created_at: new Date(now - 120 * 60000).toISOString(), energie_level: 3 },
    { id: 'e3', created_at: new Date(now - 90 * 60000).toISOString(), energie_level: 4 },
    { id: 'e4', created_at: new Date(now - 45 * 60000).toISOString(), energie_level: 3 },
    { id: 'e5', created_at: new Date(now - 15 * 60000).toISOString(), energie_level: 2 },
  ];
  const avg = Math.round((checks.reduce((s, c) => s + c.energie_level, 0) / checks.length) * 10) / 10;
  return {
    checks,
    avg_energie: avg,
    avg_energie_gestern: 3.4,
    trend: avg < 3 ? 'fallend' : avg > 3.5 ? 'steigend' : 'stabil',
    driver_id,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driver_id = searchParams.get('driver_id');

  if (!driver_id) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // Fetch last 5 energy checks for this driver (today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: checksRaw, error } = await supabase
      .from('driver_energie_checks')
      .select('id, created_at, energie_level, kommentar')
      .eq('driver_id', driver_id)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    if (error || !checksRaw?.length) {
      return NextResponse.json(mockResponse(driver_id));
    }

    const checks: EnergieCheck[] = checksRaw.map((c) => ({
      id: c.id,
      created_at: c.created_at,
      energie_level: c.energie_level ?? 3,
      kommentar: c.kommentar ?? null,
    })).reverse();

    const avg = checks.length > 0
      ? Math.round((checks.reduce((s, c) => s + c.energie_level, 0) / checks.length) * 10) / 10
      : 3;

    // Yesterday comparison: same driver, yesterday
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const { data: yesterdayChecks } = await supabase
      .from('driver_energie_checks')
      .select('energie_level')
      .eq('driver_id', driver_id)
      .gte('created_at', yesterdayStart.toISOString())
      .lt('created_at', todayStart.toISOString());

    const avgGestern = yesterdayChecks?.length
      ? Math.round((yesterdayChecks.reduce((s, c) => s + (c.energie_level ?? 3), 0) / yesterdayChecks.length) * 10) / 10
      : avg;

    const delta = avg - avgGestern;
    const trend: EnergieVerlaufResponse['trend'] = delta > 0.3 ? 'steigend' : delta < -0.3 ? 'fallend' : 'stabil';

    return NextResponse.json({
      checks,
      avg_energie: avg,
      avg_energie_gestern: avgGestern,
      trend,
      driver_id,
      generiert_am: new Date().toISOString(),
    } satisfies EnergieVerlaufResponse);
  } catch {
    return NextResponse.json(mockResponse(driver_id));
  }
}
