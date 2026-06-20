/**
 * GET /api/delivery/driver/shift-status
 *
 * Liefert den aktuellen Schicht-Puls für den eingeloggten Fahrer.
 * Verwendet von FahrerSchichtPuls (Phase 337).
 *
 * Antwort:
 *   stopsDone        — erledigte Stops in aktiver Schicht
 *   stopsRemaining   — verbleibende Stops in aktiver Tour
 *   avgStopMin       — Ø Minuten pro Stop (geliefert_am - angekommen_am)
 *   shiftElapsedMin  — Schichtdauer seit actual_start in Minuten
 *
 * 404 wenn kein Fahrer-Profil oder keine aktive Schicht.
 * Auth: Fahrer eingeloggt.
 */
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ShiftStatus {
  stopsDone: number;
  stopsRemaining: number;
  avgStopMin: number;
  shiftElapsedMin: number;
}

export async function GET() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const svc = createServiceClient();

  // Fahrer-Profil
  const { data: driver } = await svc
    .from('mise_drivers')
    .select('id, location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!driver) return NextResponse.json({ error: 'Kein Fahrer-Profil' }, { status: 404 });
  const driverId = (driver as { id: string; location_id: string }).id;
  const locationId = (driver as { id: string; location_id: string }).location_id;

  // Aktive Schicht
  const { data: shift } = await svc
    .from('driver_shifts')
    .select('id, actual_start')
    .eq('driver_id', driverId)
    .eq('status', 'active')
    .order('actual_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!shift) return NextResponse.json({ error: 'Keine aktive Schicht' }, { status: 404 });
  const shiftData = shift as { id: string; actual_start: string | null };

  const shiftElapsedMin = shiftData.actual_start
    ? Math.round((Date.now() - new Date(shiftData.actual_start).getTime()) / 60_000)
    : 0;

  // Erledigte Stops seit Schichtstart
  const sinceIso = shiftData.actual_start ?? new Date(Date.now() - 8 * 3600_000).toISOString();

  const [doneRes, pendingRes] = await Promise.all([
    svc
      .from('delivery_tour_stops')
      .select('id, angekommen_am, geliefert_am')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .eq('status', 'geliefert')
      .gte('updated_at', sinceIso),

    svc
      .from('delivery_tour_stops')
      .select('id')
      .eq('driver_id', driverId)
      .eq('location_id', locationId)
      .in('status', ['pending', 'angekommen'])
      .gte('created_at', sinceIso),
  ]);

  const doneStops =
    (
      doneRes.data as
        | { id: string; angekommen_am: string | null; geliefert_am: string | null }[]
        | null
    ) ?? [];
  const pendingStops = (pendingRes.data as { id: string }[] | null) ?? [];

  // Ø Stop-Dauer aus angekommen_am → geliefert_am
  const durationsMin = doneStops
    .filter((s) => s.angekommen_am && s.geliefert_am)
    .map((s) =>
      Math.round(
        (new Date(s.geliefert_am!).getTime() - new Date(s.angekommen_am!).getTime()) / 60_000,
      ),
    )
    .filter((d) => d > 0 && d < 60);

  const avgStopMin =
    durationsMin.length > 0
      ? Math.round(durationsMin.reduce((a, b) => a + b, 0) / durationsMin.length)
      : 8;

  const result: ShiftStatus = {
    stopsDone: doneStops.length,
    stopsRemaining: pendingStops.length,
    avgStopMin,
    shiftElapsedMin,
  };

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
