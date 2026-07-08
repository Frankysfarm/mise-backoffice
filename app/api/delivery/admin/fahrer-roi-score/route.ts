/**
 * GET /api/delivery/admin/fahrer-roi-score?location_id=<uuid>
 *
 * Phase 856 — Fahrer-ROI-Score-API
 * Einnahmen ÷ Gesamtkosten (Lohn + km-Kosten) je Fahrerschicht heute.
 * ROI-Score 0–100 für direkten Vergleich.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOHN_PRO_STUNDE = 12.50; // €/h
const KM_KOSTEN_PRO_KM = 0.30; // €/km

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
  if (fromQuery) return fromQuery;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // Aktive/abgeschlossene Schichten heute
  const { data: shifts } = await sb
    .from('driver_shifts')
    .select('id, driver_id, started_at, ended_at, km_start, km_ende')
    .eq('location_id', locationId)
    .gte('started_at', todayStart.toISOString())
    .in('status', ['active', 'completed']);

  if (!shifts?.length) {
    return NextResponse.json({
      fahrer: [],
      avg_roi: 0,
      avg_roi_score: 0,
      benchmark_score: 65,
      generatedAt: now.toISOString(),
    });
  }

  const driverIds = [...new Set((shifts ?? []).map(s => s.driver_id as string))];

  const { data: drivers } = await sb
    .from('mise_drivers')
    .select('id, vorname, nachname')
    .in('id', driverIds);

  const driverMap = new Map(
    (drivers ?? []).map(d => [
      d.id as string,
      `${d.vorname ?? ''} ${(d.nachname as string | undefined)?.charAt(0) ?? ''}.`.trim(),
    ])
  );

  // Einnahmen je Fahrer aus delivery_batches
  const { data: batches } = await sb
    .from('delivery_batches')
    .select('driver_id, delivery_fee, total_stops')
    .eq('location_id', locationId)
    .gte('created_at', todayStart.toISOString())
    .not('delivery_fee', 'is', null);

  const einnahmenMap = new Map<string, number>();
  const stoppsMap = new Map<string, number>();
  for (const b of batches ?? []) {
    const did = b.driver_id as string;
    if (!did) continue;
    einnahmenMap.set(did, (einnahmenMap.get(did) ?? 0) + Number(b.delivery_fee ?? 0));
    stoppsMap.set(did, (stoppsMap.get(did) ?? 0) + Number(b.total_stops ?? 1));
  }

  // Schichtdauer + km je Fahrer
  const schichtMap = new Map<string, number>();
  const kmMap = new Map<string, number>();
  for (const shift of shifts ?? []) {
    const did = shift.driver_id as string;
    const start = new Date(shift.started_at as string);
    const end = shift.ended_at ? new Date(shift.ended_at as string) : now;
    const minuten = Math.max(0, (end.getTime() - start.getTime()) / 60_000);
    schichtMap.set(did, (schichtMap.get(did) ?? 0) + minuten);

    if (shift.km_start != null && shift.km_ende != null) {
      const tachoKm = Number(shift.km_ende) - Number(shift.km_start);
      if (tachoKm > 0) kmMap.set(did, (kmMap.get(did) ?? 0) + tachoKm);
    }
  }

  const result = driverIds.map(did => {
    const einnahmen = einnahmenMap.get(did) ?? 0;
    const stopps = stoppsMap.get(did) ?? 0;
    const schichtMin = schichtMap.get(did) ?? 60;
    const schichtH = schichtMin / 60;
    // km: aus Tacho oder Schätzung (Ø 2.5 km/Stopp)
    const km = kmMap.get(did) ?? stopps * 2.5;

    const lohnkosten = Math.round(schichtH * LOHN_PRO_STUNDE * 100) / 100;
    const kmkosten = Math.round(km * KM_KOSTEN_PRO_KM * 100) / 100;
    const gesamtkosten = lohnkosten + kmkosten;

    const roi = gesamtkosten > 0 ? einnahmen / gesamtkosten : 0;
    // Score: ROI < 0.5 → 0, ROI >= 2.0 → 100
    const roi_score = Math.round(Math.min(100, Math.max(0, ((roi - 0.5) / 1.5) * 100)));

    return {
      driver_id: did,
      name: driverMap.get(did) ?? 'Fahrer',
      einnahmen: Math.round(einnahmen * 100) / 100,
      lohnkosten,
      kmkosten,
      gesamtkosten: Math.round(gesamtkosten * 100) / 100,
      km: Math.round(km * 10) / 10,
      schicht_minuten: Math.round(schichtMin),
      stopps,
      roi: Math.round(roi * 100) / 100,
      roi_score,
    };
  }).sort((a, b) => b.roi_score - a.roi_score);

  const avg_roi = result.length
    ? Math.round((result.reduce((s, f) => s + f.roi, 0) / result.length) * 100) / 100
    : 0;
  const avg_roi_score = result.length
    ? Math.round(result.reduce((s, f) => s + f.roi_score, 0) / result.length)
    : 0;

  return NextResponse.json({
    fahrer: result,
    avg_roi,
    avg_roi_score,
    benchmark_score: 65,
    generatedAt: now.toISOString(),
  });
}
