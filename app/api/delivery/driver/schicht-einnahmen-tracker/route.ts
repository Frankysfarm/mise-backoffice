/**
 * GET /api/delivery/driver/schicht-einnahmen-tracker?driver_id=<uuid>
 *
 * Phase 1317 — Schicht-Einnahmen-Tracker (Fahrer-App Backend)
 * Trinkgeld + Liefergebühren kumulativ heute + 7-Tage-Vergleich.
 * Supabase mise_delivery_stops + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TagesEinnahmen {
  datum: string;
  trinkgeld_eur: number;
  liefergebuehren_eur: number;
  gesamt_eur: number;
  stopps: number;
}

export interface SchichtEinnahmenTracker {
  fahrer_id: string;
  heute_trinkgeld_eur: number;
  heute_liefergebuehren_eur: number;
  heute_gesamt_eur: number;
  heute_stopps: number;
  vergleich_7_tage: TagesEinnahmen[];
  ø_7_tage_eur: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  generiert_am: string;
}

function buildMock(driverId: string): SchichtEinnahmenTracker {
  const vergleich: TagesEinnahmen[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const stopps = 8 + Math.floor(Math.random() * 6);
    const tip = parseFloat((stopps * 1.2 + Math.random() * 3).toFixed(2));
    const fee = parseFloat((stopps * 2.5).toFixed(2));
    return {
      datum: d.toISOString().slice(0, 10),
      trinkgeld_eur: tip,
      liefergebuehren_eur: fee,
      gesamt_eur: parseFloat((tip + fee).toFixed(2)),
      stopps,
    };
  });

  const ø = vergleich.reduce((s, d) => s + d.gesamt_eur, 0) / 7;
  const heute = vergleich[6];

  return {
    fahrer_id: driverId,
    heute_trinkgeld_eur: heute.trinkgeld_eur,
    heute_liefergebuehren_eur: heute.liefergebuehren_eur,
    heute_gesamt_eur: heute.gesamt_eur,
    heute_stopps: heute.stopps,
    vergleich_7_tage: vergleich,
    ø_7_tage_eur: parseFloat(ø.toFixed(2)),
    trend: heute.gesamt_eur > ø * 1.05 ? 'besser' : heute.gesamt_eur < ø * 0.95 ? 'schlechter' : 'gleich',
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const vor7Tagen = new Date(todayStart.getTime() - 6 * 86400_000);

    const { data: stops, error } = await (sb as any)
      .from('mise_delivery_stops')
      .select('tip_eur, delivery_fee_eur, completed_at')
      .eq('driver_id', driverId)
      .eq('status', 'delivered')
      .gte('completed_at', vor7Tagen.toISOString());

    if (error || !stops?.length) return NextResponse.json(buildMock(driverId));

    const typedStops = stops as { tip_eur?: number; delivery_fee_eur?: number; completed_at?: string }[];

    const dayMap: Record<string, TagesEinnahmen> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(vor7Tagen.getTime() + i * 86400_000);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { datum: key, trinkgeld_eur: 0, liefergebuehren_eur: 0, gesamt_eur: 0, stopps: 0 };
    }

    for (const s of typedStops) {
      const key = (s.completed_at ?? '').slice(0, 10);
      if (!dayMap[key]) continue;
      const tip = s.tip_eur ?? 0;
      const fee = s.delivery_fee_eur ?? 0;
      dayMap[key].trinkgeld_eur += tip;
      dayMap[key].liefergebuehren_eur += fee;
      dayMap[key].gesamt_eur += tip + fee;
      dayMap[key].stopps += 1;
    }

    const vergleich = Object.values(dayMap).map((d) => ({
      ...d,
      trinkgeld_eur: parseFloat(d.trinkgeld_eur.toFixed(2)),
      liefergebuehren_eur: parseFloat(d.liefergebuehren_eur.toFixed(2)),
      gesamt_eur: parseFloat(d.gesamt_eur.toFixed(2)),
    }));

    const todayKey = todayStart.toISOString().slice(0, 10);
    const heute = dayMap[todayKey] ?? { trinkgeld_eur: 0, liefergebuehren_eur: 0, gesamt_eur: 0, stopps: 0 };
    const ø7 = vergleich.reduce((s, d) => s + d.gesamt_eur, 0) / 7;

    return NextResponse.json({
      fahrer_id: driverId,
      heute_trinkgeld_eur: parseFloat(heute.trinkgeld_eur.toFixed(2)),
      heute_liefergebuehren_eur: parseFloat(heute.liefergebuehren_eur.toFixed(2)),
      heute_gesamt_eur: parseFloat(heute.gesamt_eur.toFixed(2)),
      heute_stopps: heute.stopps,
      vergleich_7_tage: vergleich,
      ø_7_tage_eur: parseFloat(ø7.toFixed(2)),
      trend: heute.gesamt_eur > ø7 * 1.05 ? 'besser' : heute.gesamt_eur < ø7 * 0.95 ? 'schlechter' : 'gleich',
      generiert_am: new Date().toISOString(),
    } satisfies SchichtEinnahmenTracker);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
