/**
 * GET   /api/delivery/admin/coverage?location_id=...&hours=24
 * POST  /api/delivery/admin/coverage/requirements
 *
 * Einsatzplanung: Abdeckungs-Analyse und Anforderungs-Verwaltung.
 *
 * GET /api/delivery/admin/coverage
 *   Analysiert Schichtabdeckung für die nächsten N Stunden.
 *   Query-Parameter:
 *     location_id   — Pflicht
 *     hours         — Optional: Analyse-Fenster (default 24, max 168)
 *     gaps_only     — Optional: "true" → nur Slots mit gap < 0 zurückgeben
 *
 * GET Response:
 *   {
 *     coverage:       CoverageGap[]   — alle Slots (oder nur Gaps)
 *     summary: {
 *       total_slots:     number
 *       covered_slots:   number
 *       uncovered_slots: number
 *       worst_gap:       number       — stärkste Unterdeckung (negativ)
 *     }
 *     requirements:   CoverageRequirement[]  — aktuelle Anforderungen
 *   }
 *
 * POST /api/delivery/admin/coverage
 *   Setzt oder aktualisiert eine Coverage-Anforderung.
 *   Body: { location_id, day_of_week, hour_of_day, min_drivers, target_drivers }
 *
 * POST Response:
 *   { requirement: CoverageRequirement }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getCoverageGaps,
  getCoverageRequirements,
  upsertCoverageRequirement,
} from '@/lib/delivery/shifts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const hours    = Math.min(Math.max(Number(searchParams.get('hours') ?? 24), 1), 168);
  const gapsOnly = searchParams.get('gaps_only') === 'true';

  try {
    const [allCoverage, requirements] = await Promise.all([
      getCoverageGaps(locationId, hours),
      getCoverageRequirements(locationId),
    ]);

    const coverage = gapsOnly ? allCoverage.filter((s) => !s.covered) : allCoverage;

    const uncoveredSlots = allCoverage.filter((s) => !s.covered);
    const gaps           = uncoveredSlots.map((s) => s.gap);
    const worstGap       = gaps.length > 0 ? Math.min(...gaps) : 0;

    return NextResponse.json({
      coverage,
      summary: {
        total_slots:     allCoverage.length,
        covered_slots:   allCoverage.length - uncoveredSlots.length,
        uncovered_slots: uncoveredSlots.length,
        worst_gap:       worstGap,
      },
      requirements,
      hours,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: {
    location_id: string;
    day_of_week: number;
    hour_of_day: number;
    min_drivers: number;
    target_drivers: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const { location_id, day_of_week, hour_of_day, min_drivers, target_drivers } = body;

  if (location_id === undefined || day_of_week === undefined || hour_of_day === undefined) {
    return NextResponse.json(
      { error: 'location_id, day_of_week, hour_of_day sind Pflichtfelder' },
      { status: 400 },
    );
  }

  if (day_of_week < 0 || day_of_week > 6) {
    return NextResponse.json({ error: 'day_of_week muss zwischen 0 (So) und 6 (Sa) liegen' }, { status: 400 });
  }
  if (hour_of_day < 0 || hour_of_day > 23) {
    return NextResponse.json({ error: 'hour_of_day muss zwischen 0 und 23 liegen' }, { status: 400 });
  }
  if ((min_drivers ?? 0) < 0 || (target_drivers ?? 0) < (min_drivers ?? 0)) {
    return NextResponse.json(
      { error: 'min_drivers >= 0 und target_drivers >= min_drivers erforderlich' },
      { status: 400 },
    );
  }

  try {
    const requirement = await upsertCoverageRequirement({
      locationId:    location_id,
      dayOfWeek:     day_of_week,
      hourOfDay:     hour_of_day,
      minDrivers:    min_drivers ?? 1,
      targetDrivers: target_drivers ?? 2,
    });

    return NextResponse.json({ requirement }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 },
    );
  }
}
