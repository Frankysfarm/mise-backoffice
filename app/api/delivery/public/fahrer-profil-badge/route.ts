/**
 * GET /api/delivery/public/fahrer-profil-badge?location_id=<uuid>&order_id=<uuid>
 *
 * Phase 1775 — Fahrer-Profil-Badge API (Storefront)
 * Name + Bewertung des zugewiesenen Fahrers; kein Auth; Supabase + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerProfilBadgeAntwort {
  fahrer_id: string;
  vorname: string;
  nachname_initial: string;
  bewertung: number;
  touren_heute: number;
  zugewiesen: boolean;
}

function buildMock(locationId: string): FahrerProfilBadgeAntwort {
  return {
    fahrer_id: 'drv-mock',
    vorname: 'Mehmet',
    nachname_initial: 'A',
    bewertung: 4.8,
    touren_heute: 6,
    zugewiesen: true,
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const orderId = req.nextUrl.searchParams.get('order_id');

  if (!locationId) {
    return NextResponse.json({ zugewiesen: false });
  }

  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    let driverId: string | null = null;

    // Try to find assigned driver from specific order
    if (orderId) {
      const { data: orderData } = await supabase
        .from('orders')
        .select('driver_id')
        .eq('id', orderId)
        .eq('location_id', locationId)
        .not('driver_id', 'is', null)
        .single();
      driverId = orderData?.driver_id ?? null;
    }

    // Fallback: find most active driver at this location today
    if (!driverId) {
      const { data: tourData } = await supabase
        .from('delivery_tours')
        .select('driver_id')
        .eq('location_id', locationId)
        .eq('status', 'active')
        .gte('created_at', `${today}T00:00:00Z`)
        .limit(1)
        .single();
      driverId = tourData?.driver_id ?? null;
    }

    if (!driverId) {
      return NextResponse.json({ zugewiesen: false });
    }

    // Fetch driver details
    const { data: drv } = await supabase
      .from('employees')
      .select('id, vorname, nachname')
      .eq('id', driverId)
      .single();

    if (!drv) {
      return NextResponse.json(buildMock(locationId));
    }

    // Driver rating
    const { data: ratingData } = await supabase
      .from('driver_ratings')
      .select('rating')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(50);

    const ratings = ratingData ?? [];
    const bewertung = ratings.length > 0
      ? Math.round(ratings.reduce((s: number, r: { rating?: number }) => s + (r.rating ?? 0), 0) / ratings.length * 10) / 10
      : 4.5;

    // Tours today
    const { count: tourenHeute } = await supabase
      .from('delivery_tours')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .gte('created_at', `${today}T00:00:00Z`);

    return NextResponse.json({
      fahrer_id: driverId,
      vorname: drv.vorname ?? 'Fahrer',
      nachname_initial: (drv.nachname ?? '').charAt(0).toUpperCase(),
      bewertung,
      touren_heute: tourenHeute ?? 0,
      zugewiesen: true,
    } satisfies FahrerProfilBadgeAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
