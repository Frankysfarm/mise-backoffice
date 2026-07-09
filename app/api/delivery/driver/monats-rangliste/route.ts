/**
 * GET /api/delivery/driver/monats-rangliste?driver_id=<uuid>
 *
 * Phase 921 — Monats-Rangliste Backend
 * Fahrers Rang im aktuellen Monat + Top-3-Fahrer (gleiche location).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const driverId = new URL(req.url).searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const sb = await createClient();

  // Finde location_id des Fahrers
  const { data: emp } = await sb
    .from('employees')
    .select('location_id, first_name, last_name')
    .eq('id', driverId)
    .maybeSingle();

  const locationId = emp?.location_id;
  if (!locationId) return NextResponse.json({ error: 'Fahrer nicht gefunden' }, { status: 404 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monat = monthStart.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  // Alle Schichten im aktuellen Monat
  const { data: schichten } = await sb
    .from('driver_shifts')
    .select('id, driver_id, employee:employees(id, first_name, last_name)')
    .eq('location_id', locationId)
    .gte('started_at', monthStart.toISOString())
    .not('driver_id', 'is', null);

  if (!schichten || schichten.length === 0) {
    return NextResponse.json({ mein_rang: 1, gesamt_fahrer: 1, top3: [], ich: null, monat });
  }

  const driverIds = [...new Set(schichten.map((s) => s.driver_id as string).filter(Boolean))];

  // Touren je Fahrer
  const { data: touren } = await sb
    .from('delivery_batches')
    .select('id, driver_id, status')
    .eq('location_id', locationId)
    .in('driver_id', driverIds)
    .gte('created_at', monthStart.toISOString());

  // Stopps für Pünktlichkeit
  const tourIds = (touren ?? []).map((t) => t.id);
  const { data: stopps } = tourIds.length
    ? await sb
        .from('delivery_stops')
        .select('batch_id, delivered_at, eta_at')
        .in('batch_id', tourIds)
        .not('delivered_at', 'is', null)
    : { data: [] };

  interface FahrerAgg {
    driver_id: string;
    name: string;
    touren: number;
    pct_puenktlich: number;
    einnahmen_eur: number;
  }

  const aggregates: FahrerAgg[] = driverIds.map((did) => {
    const schicht = schichten.find((s) => s.driver_id === did);
    const emp2 = schicht?.employee as { first_name?: string; last_name?: string } | null;
    const name = emp2 ? `${emp2.first_name ?? ''} ${emp2.last_name ?? ''}`.trim() : 'Fahrer';

    const fahrerTouren = (touren ?? []).filter((t) => t.driver_id === did);
    const tourCount = fahrerTouren.length;

    const relevantIds = fahrerTouren.map((t) => t.id);
    const fahrerStopps = (stopps ?? []).filter((s) => relevantIds.includes(s.batch_id));
    const puenktlich = fahrerStopps.filter((s) => {
      if (!s.delivered_at || !s.eta_at) return true;
      return new Date(s.delivered_at) <= new Date(s.eta_at);
    }).length;
    const pctPuenktlich = fahrerStopps.length > 0
      ? Math.round((puenktlich / fahrerStopps.length) * 100)
      : 100;

    const einnahmen = tourCount * 12.5; // estimate per tour

    return { driver_id: did, name, touren: tourCount, pct_puenktlich: pctPuenktlich, einnahmen_eur: Math.round(einnahmen) };
  });

  // Score = Touren*2 + Pünktlichkeit*0.5
  aggregates.sort((a, b) => (b.touren * 2 + b.pct_puenktlich * 0.5) - (a.touren * 2 + a.pct_puenktlich * 0.5));

  const ranked = aggregates.map((f, i) => ({ ...f, rank: i + 1, is_me: f.driver_id === driverId }));
  const top3 = ranked.slice(0, 3);
  const ich = ranked.find((f) => f.driver_id === driverId) ?? null;
  const mein_rang = ich?.rank ?? ranked.length + 1;

  return NextResponse.json({
    monat,
    mein_rang,
    gesamt_fahrer: ranked.length,
    top3,
    ich,
  });
}
