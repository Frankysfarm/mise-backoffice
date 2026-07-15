/**
 * GET /api/delivery/driver/bonus-vorschau?driver_id=<uuid>
 *
 * Phase 1639 — Bonus-Vorschau-API (Fahrer-App Feierabend-Card)
 * Wochenbonus je Fahrer: Pünktlichkeits-Bonus + Touren-Bonus.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BonusVorschau {
  fahrer_id: string;
  puenktlichkeit: number;
  touren: number;
  gesamt: number;
  generiert_am: string;
}

function buildMock(driverId: string): BonusVorschau {
  return {
    fahrer_id: driverId,
    puenktlichkeit: 1.5,
    touren: 2.0,
    gesamt: 3.5,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setUTCHours(0, 0, 0, 0);
    weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay());

    const [stopsRes, reviewsRes] = await Promise.all([
      (sb as any)
        .from('delivery_stops')
        .select('id, geliefert_am, estimated_delivery_at')
        .eq('driver_id', driverId)
        .gte('geliefert_am', weekStart.toISOString())
        .not('geliefert_am', 'is', null),
      (sb as any)
        .from('delivery_reviews')
        .select('rating')
        .eq('driver_id', driverId)
        .gte('created_at', weekStart.toISOString())
        .limit(100),
    ]);

    if (stopsRes.error) {
      return NextResponse.json(buildMock(driverId));
    }

    const stops: any[] = stopsRes.data ?? [];
    const tourCount = stops.length;

    // Pünktlichkeits-Bonus: 0.10€ je pünktliche Lieferung
    const puenktlich = stops.filter((s) => {
      if (!s.estimated_delivery_at || !s.geliefert_am) return true;
      return new Date(s.geliefert_am) <= new Date(s.estimated_delivery_at);
    }).length;
    const puenktlichkeitBonus = Math.round(puenktlich * 0.1 * 100) / 100;

    // Touren-Bonus: 0.15€ je Lieferung diese Woche
    const tourenBonus = Math.round(tourCount * 0.15 * 100) / 100;

    return NextResponse.json({
      fahrer_id: driverId,
      puenktlichkeit: puenktlichkeitBonus,
      touren: tourenBonus,
      gesamt: Math.round((puenktlichkeitBonus + tourenBonus) * 100) / 100,
      generiert_am: now.toISOString(),
    } satisfies BonusVorschau);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
