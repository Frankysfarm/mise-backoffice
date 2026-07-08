/**
 * GET /api/delivery/admin/fahrer-schicht-coach?driver_id=<uuid>&location_id=<uuid>
 *
 * Phase 793 — Schicht-Coach-Tipp-API
 * Tagesbasierter Coaching-Hinweis: beste Stunde gestern, Top-Zone, Trinkgeld-Tipp.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MOTIVATIONEN = [
  'Heute ist dein Tag — mach das Beste draus!',
  'Jede Tour zählt. Bleib fokussiert!',
  'Deine Leistung von gestern zeigt dir den Weg.',
  'Schau dir deine Muster an — dort steckt dein Potenzial.',
  'Kleiner Tipp, große Wirkung. Viel Erfolg!',
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');
  const locationId = searchParams.get('location_id');
  if (!driverId || !locationId) {
    return NextResponse.json({ error: 'driver_id und location_id required' }, { status: 400 });
  }

  const sb = await createClient();
  const gesternStart = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const heuteStart = new Date(Date.now() - 1 * 86_400_000).toISOString();

  // Gestrige Touren des Fahrers
  const { data: batches } = await sb
    .from('mise_delivery_batches')
    .select('id, created_at, tour_start, tour_end, zone, status')
    .eq('location_id', locationId)
    .eq('driver_id', driverId)
    .gte('created_at', gesternStart)
    .lt('created_at', heuteStart)
    .in('status', ['delivered', 'completed']);

  // Trinkgeld aus gestrigen Touren
  const batchIds = (batches ?? []).map(b => b.id as string);
  let avgTrinkgeldGesamt = 0;
  let zoneMap = new Map<string, { trinkgeld: number; count: number }>();

  if (batchIds.length > 0) {
    const { data: orders } = await sb
      .from('orders')
      .select('id, tip_amount, delivery_zone')
      .eq('location_id', locationId)
      .in('batch_id', batchIds)
      .not('tip_amount', 'is', null);

    let totalTip = 0; let tipCount = 0;
    for (const o of orders ?? []) {
      const tip = Number(o.tip_amount ?? 0);
      const zone = (o.delivery_zone as string) ?? 'Unbekannt';
      totalTip += tip; tipCount += 1;
      const cur = zoneMap.get(zone) ?? { trinkgeld: 0, count: 0 };
      cur.trinkgeld += tip; cur.count += 1;
      zoneMap.set(zone, cur);
    }
    avgTrinkgeldGesamt = tipCount > 0 ? totalTip / tipCount : 0;
  }

  // Beste Stunde (meiste Touren je Stunde)
  const stundeMap = new Map<number, number>();
  for (const b of batches ?? []) {
    const h = new Date(b.created_at as string).getUTCHours();
    stundeMap.set(h, (stundeMap.get(h) ?? 0) + 1);
  }
  let besteStunde: { h: number; label: string; avgTouren: number } | null = null;
  if (stundeMap.size > 0) {
    const [bestH, bestCount] = [...stundeMap.entries()].sort((a, b) => b[1] - a[1])[0];
    besteStunde = { h: bestH, label: `${String(bestH).padStart(2, '0')}:00 Uhr`, avgTouren: bestCount };
  }

  // Top-Zone nach Trinkgeld
  let topZone: { zone: string; avgTrinkgeld: number; touren: number } | null = null;
  if (zoneMap.size > 0) {
    let bestZone = '';
    let bestAvg = -1;
    for (const [zone, { trinkgeld, count }] of zoneMap) {
      const avg = count > 0 ? trinkgeld / count : 0;
      if (avg > bestAvg) { bestAvg = avg; bestZone = zone; }
    }
    const zd = zoneMap.get(bestZone)!;
    topZone = { zone: bestZone, avgTrinkgeld: bestAvg, touren: zd.count };
  }

  // Trinkgeld-Tipp
  let trinkgeldTipp: string | null = null;
  if (avgTrinkgeldGesamt > 0) {
    if (avgTrinkgeldGesamt >= 2) {
      trinkgeldTipp = `Gestern Ø ${avgTrinkgeldGesamt.toFixed(2)} € Trinkgeld — weiter so! Freundlicher Gruß bei Übergabe macht oft den Unterschied.`;
    } else {
      trinkgeldTipp = `Trinkgeld-Potenzial: Pünktliche Lieferung + Lächeln steigert Trinkgeld deutlich. Ziel: >2 €/Lieferung.`;
    }
  } else {
    trinkgeldTipp = 'Trinkgeld-Daten fehlen noch — nach den ersten Touren gibt es hier personalisierte Tipps.';
  }

  // Motivationstext (deterministisch nach Wochentag)
  const wochentag = new Date().getUTCDay();
  const motivationsText = MOTIVATIONEN[wochentag % MOTIVATIONEN.length];

  return NextResponse.json({
    ok: true,
    coach: {
      besteStunde,
      topZone,
      trinkgeldTipp,
      motivationsText,
    },
    generatedAt: new Date().toISOString(),
  });
}
