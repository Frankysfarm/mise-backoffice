/**
 * GET /api/delivery/dispatch/tour-comparison?location_id=...
 *
 * Liefert bis zu 4 aktive Touren mit Fahrername, Stops-Fortschritt,
 * ETA-Abweichung und Effizienz-Score für den Tour-Parallel-Vergleich.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TourComparisonItem {
  id: string;
  tourNummer: number;
  fahrer: string;
  stopsDone: number;
  stopsTotal: number;
  etaAbweichung: number;
  effizienz: number;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = new URL(req.url).searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  try {
    const sbService = createServiceClient();
    const activeStates = ['pending_acceptance', 'assigned', 'at_restaurant', 'on_route'];

    const { data: batches, error } = await sbService
      .from('mise_delivery_batches')
      .select(`
        id,
        state,
        estimated_delivery_at,
        created_at,
        mise_drivers!driver_id(id, name),
        mise_batch_stops(id, state, stop_type)
      `)
      .eq('location_id', locationId)
      .in('state', activeStates)
      .order('created_at', { ascending: false })
      .limit(4);

    if (error) throw new Error(error.message);

    const now = new Date();
    const tours: TourComparisonItem[] = (batches ?? []).map((batch, idx) => {
      type Stop = { id: string; state: string; stop_type: string };
      const stops: Stop[] = Array.isArray(batch.mise_batch_stops)
        ? (batch.mise_batch_stops as unknown as Stop[])
        : [];

      const dropoffStops = stops.filter((s) => s.stop_type === 'dropoff');
      const doneStops = stops.filter(
        (s) => s.stop_type === 'dropoff' && s.state === 'delivered',
      );
      const stopsTotal = dropoffStops.length || 1;
      const stopsDone = doneStops.length;

      // ETA-Abweichung in Minuten (wie weit liegt est. delivery von jetzt entfernt)
      let etaAbweichung = 0;
      if (batch.estimated_delivery_at) {
        const etaMs = new Date(batch.estimated_delivery_at as string).getTime() - now.getTime();
        etaAbweichung = Math.abs(Math.round(etaMs / 60_000));
      }

      // Effizienz-Score: 40% SLA-Anteil + 40% Fortschritt + 20% ETA-Genauigkeit
      const progressPct = stopsDone / stopsTotal;
      const slaScore = progressPct * 40;
      const progressScore = progressPct * 40;
      const etaScore = etaAbweichung <= 5 ? 20 : etaAbweichung <= 10 ? 10 : 0;
      const effizienz = Math.round(slaScore + progressScore + etaScore);

      type DriverShape = { id: string; name: string } | null;
      const driverRaw = batch.mise_drivers;
      const driver: DriverShape = Array.isArray(driverRaw)
        ? ((driverRaw as unknown[])[0] as DriverShape ?? null)
        : (driverRaw as unknown as DriverShape);

      return {
        id: batch.id as string,
        tourNummer: idx + 1,
        fahrer: driver?.name ?? 'Unbekannt',
        stopsDone,
        stopsTotal,
        etaAbweichung,
        effizienz,
      };
    });

    return NextResponse.json({ tours, generatedAt: now.toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
