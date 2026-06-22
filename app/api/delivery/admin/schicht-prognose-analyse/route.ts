/**
 * GET  /api/delivery/admin/schicht-prognose-analyse
 *      → AccuracySummary + DayAccuracy für die eigene Location
 *
 * GET  /api/delivery/admin/schicht-prognose-analyse?action=history&weeks=8
 *      → WeeklyAccuracyPoint[] (Chart-Daten, letzten N Wochen)
 *
 * POST /api/delivery/admin/schicht-prognose-analyse
 *      { action: 'analyze', week_start?: 'YYYY-MM-DD' }
 *        → analyzeWeek für eigene Location (letzte Woche wenn week_start fehlt)
 *      { action: 'analyze-all', week_start?: 'YYYY-MM-DD' }
 *        → Batch für alle aktiven Standorte (Admin only)
 *      { action: 'prune', days_to_keep?: number }
 *        → Cleanup alter Zeilen (Admin only)
 *
 * Auth: Admin oder Manager
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  analyzeWeek,
  analyzeWeekAllLocations,
  getPrognoseGenauigkeit,
  getDayAccuracy,
  getAccuracySummary,
  pruneOldAnalyses,
} from '@/lib/delivery/schicht-prognose-analyse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Employee {
  location_id: string;
  rolle: string;
}

async function resolveEmployee(req: NextRequest): Promise<Employee | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id, rolle')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp?.location_id) return null;

  const paramId = req.nextUrl.searchParams.get('location_id');
  return {
    locationId: (paramId ?? emp.location_id) as string,
    rolle:      emp.rolle as string,
  } as unknown as Employee;
}

function isManagerOrAdmin(emp: Employee): boolean {
  return ['admin', 'manager'].includes((emp as unknown as { rolle: string }).rolle);
}

export async function GET(req: NextRequest) {
  const emp = await resolveEmployee(req);
  if (!emp) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isManagerOrAdmin(emp)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { locationId } = emp as unknown as { locationId: string };
  const action = req.nextUrl.searchParams.get('action');

  try {
    if (action === 'history') {
      const weeks = Math.min(52, Math.max(1, parseInt(req.nextUrl.searchParams.get('weeks') ?? '12', 10)));
      const history = await getPrognoseGenauigkeit(locationId, weeks);
      return NextResponse.json({ locationId, weeks, history });
    }

    // Default: summary + day accuracy
    const [summary, dayAccuracy] = await Promise.all([
      getAccuracySummary(locationId),
      getDayAccuracy(locationId),
    ]);

    return NextResponse.json({ locationId, summary, dayAccuracy });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const emp = await resolveEmployee(req);
  if (!emp) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isManagerOrAdmin(emp)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { locationId, rolle } = emp as unknown as { locationId: string; rolle: string };

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const action = body.action as string;

  try {
    if (action === 'analyze') {
      const weekStart = typeof body.week_start === 'string' ? body.week_start : undefined;
      const result = await analyzeWeek(locationId, weekStart);
      return NextResponse.json(result);
    }

    if (action === 'analyze-all') {
      if (rolle !== 'admin') {
        return NextResponse.json({ error: 'Nur Admins können alle Standorte analysieren' }, { status: 403 });
      }
      const weekStart = typeof body.week_start === 'string' ? body.week_start : undefined;
      const result = await analyzeWeekAllLocations(weekStart);
      return NextResponse.json(result);
    }

    if (action === 'prune') {
      if (rolle !== 'admin') {
        return NextResponse.json({ error: 'Nur Admins können prunen' }, { status: 403 });
      }
      const daysToKeep = typeof body.days_to_keep === 'number' ? body.days_to_keep : 365;
      const result = await pruneOldAnalyses(daysToKeep);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Fehler';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
