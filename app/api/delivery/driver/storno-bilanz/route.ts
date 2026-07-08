/**
 * GET /api/delivery/driver/storno-bilanz?driver_id=<uuid>&location_id=<uuid>
 *
 * Phase 798 — Eigene Storno-Bilanz des Fahrers
 * Zählt Stornos in der aktuellen Schicht des Fahrers + Vergleich mit Schicht-Ø aller Fahrer.
 *
 * Response: { ok, eigene_stornos, schicht_stornos_gesamt, schicht_ø_stornos, vergleich, storno_quote_pct }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Vergleich = 'besser' | 'schlechter' | 'gleich';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');
  const locationId = searchParams.get('location_id');

  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    // Aktuelle Schicht des Fahrers (heute)
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    const heuteIso = heute.toISOString();

    // Alle Bestellungen in aktiver Schicht des Fahrers (via Batches)
    const batchQuery = sb
      .from('mise_delivery_batches')
      .select('id, driver_id, stop_count')
      .eq('driver_id', driverId)
      .gte('started_at', heuteIso);

    if (locationId) {
      batchQuery.eq('location_id', locationId);
    }

    const { data: eigeneBatches } = await batchQuery;

    const eigeneBatchIds = (eigeneBatches ?? []).map((b: any) => b.id);
    let eigeneStornos = 0;

    if (eigeneBatchIds.length > 0) {
      const { count } = await sb
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('batch_id', eigeneBatchIds)
        .eq('status', 'cancelled');
      eigeneStornos = count ?? 0;
    }

    // Eigene Bestellungen gesamt (für Quote)
    let eigeneBestellungen = 0;
    if (eigeneBatchIds.length > 0) {
      const { count } = await sb
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('batch_id', eigeneBatchIds);
      eigeneBestellungen = count ?? 0;
    }

    // Schicht-Ø: alle Fahrer derselben Location heute
    let schichtStornosGesamt = 0;
    let schichtFahrerAnzahl = 0;

    if (locationId) {
      const { data: allBatches } = await sb
        .from('mise_delivery_batches')
        .select('driver_id')
        .eq('location_id', locationId)
        .gte('started_at', heuteIso);

      const alleIds = (allBatches ?? []).map((b: any) => b.id);
      const alleFahrerIds = [...new Set((allBatches ?? []).map((b: any) => b.driver_id as string))];
      schichtFahrerAnzahl = alleFahrerIds.length;

      if (alleIds.length > 0) {
        const { count } = await sb
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .in('batch_id', alleIds)
          .eq('status', 'cancelled');
        schichtStornosGesamt = count ?? 0;
      }
    }

    const schichtØStornos = schichtFahrerAnzahl > 0
      ? Math.round((schichtStornosGesamt / schichtFahrerAnzahl) * 10) / 10
      : eigeneStornos;

    let vergleich: Vergleich = 'gleich';
    if (eigeneStornos < schichtØStornos - 0.4) vergleich = 'besser';
    else if (eigeneStornos > schichtØStornos + 0.4) vergleich = 'schlechter';

    const storno_quote_pct = eigeneBestellungen > 0
      ? Math.round((eigeneStornos / eigeneBestellungen) * 100)
      : 0;

    return NextResponse.json({
      ok: true,
      eigene_stornos: eigeneStornos,
      schicht_stornos_gesamt: schichtStornosGesamt,
      schicht_ø_stornos: schichtØStornos,
      vergleich,
      storno_quote_pct,
    });
  } catch (err: unknown) {
    console.error('[storno-bilanz]', err);
    return NextResponse.json({ ok: false, error: 'Serverfehler' }, { status: 500 });
  }
}
