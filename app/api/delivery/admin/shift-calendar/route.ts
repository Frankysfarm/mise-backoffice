/**
 * GET /api/delivery/admin/shift-calendar
 *
 * Liefert den Schicht-Wochenkalender für eine Location.
 *
 * Query-Parameter:
 *   location_id  — Pflicht: UUID der Location
 *   week_start   — Optional: YYYY-MM-DD (Montag der Woche); default = aktuelle Woche
 *
 * Response:
 *   { calendar: WeekCalendar }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getWeekCalendar } from '@/lib/delivery/shift-calendar';

export const runtime  = 'nodejs';
export const dynamic  = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const weekStartStr = searchParams.get('week_start');
  let weekStart: Date | undefined;
  if (weekStartStr) {
    weekStart = new Date(weekStartStr + 'T00:00:00');
    if (isNaN(weekStart.getTime())) {
      return NextResponse.json({ error: 'Ungültiges week_start (YYYY-MM-DD erwartet)' }, { status: 400 });
    }
  }

  try {
    const calendar = await getWeekCalendar(locationId, weekStart);
    return NextResponse.json({ calendar });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unbekannter Fehler' },
      { status: 500 },
    );
  }
}
