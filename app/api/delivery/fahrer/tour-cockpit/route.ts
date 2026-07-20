/**
 * GET /api/delivery/fahrer/tour-cockpit?batch_id=...&driver_id=...
 *
 * Phase 2718 — Smart Tour Cockpit Ultra (Fahrer-App)
 * Liefert aktuellen Batch mit allen Stopps, ETA-Zeiten, Status und Kundendaten.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get('batch_id');
  const driverId = searchParams.get('driver_id');

  try {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const svc = createServiceClient();

    // Aktiven Batch ermitteln
    let activeBatchId = batchId;

    if (!activeBatchId && (driverId || user.id)) {
      const targetDriver = driverId ?? user.id;
      const { data: batch } = await svc
        .from('mise_delivery_batches')
        .select('id')
        .eq('driver_id', targetDriver)
        .in('state', ['pending_acceptance', 'assigned', 'at_restaurant', 'on_route'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      activeBatchId = batch?.id ?? null;
    }

    if (!activeBatchId) {
      return NextResponse.json({
        ok: true,
        batch_id: null,
        stopps: [],
        total_stopps: 0,
        abgeschlossen: 0,
      });
    }

    // Stops laden
    const { data: stops, error } = await svc
      .from('mise_delivery_batch_stops')
      .select(`
        id,
        sequence,
        type,
        arrived_at,
        completed_at,
        order:customer_orders(
          id,
          adresse,
          kunde_name,
          telefon,
          eta_earliest,
          notiz_fahrer
        )
      `)
      .eq('batch_id', activeBatchId)
      .eq('type', 'dropoff')
      .order('sequence', { ascending: true });

    if (error) throw error;

    const mappedStops = (stops ?? []).map(s => {
      const order = Array.isArray(s.order) ? s.order[0] : s.order;
      const status = s.completed_at
        ? 'abgeschlossen'
        : s.arrived_at
        ? 'angekommen'
        : 'ausstehend';

      return {
        stopp_id: s.id,
        reihenfolge: s.sequence,
        adresse: (order?.adresse as string | null) ?? 'Unbekannte Adresse',
        kunde: (order?.kunde_name as string | null) ?? 'Kunde',
        telefon: (order?.telefon as string | null) ?? null,
        eta_iso: (order?.eta_earliest as string | null) ?? null,
        status,
        notiz: (order?.notiz_fahrer as string | null) ?? null,
      };
    });

    const abgeschlossen = mappedStops.filter(s => s.status === 'abgeschlossen').length;

    return NextResponse.json({
      ok: true,
      batch_id: activeBatchId,
      stopps: mappedStops,
      total_stopps: mappedStops.length,
      abgeschlossen,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[tour-cockpit]', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
