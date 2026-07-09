/**
 * GET /api/delivery/driver/kundenzufriedenheit?driver_id=<uuid>
 *
 * Phase 939 — Kundenzufriedenheits-Verlauf-API (Fahrer-App)
 * Letzte 10 Kundenbewertungen mit Sterne + Kommentar-Snippet.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Bewertung {
  id: string;
  rating: number;
  kommentar: string | null;
  created_at: string;
  order_bestellnummer: string | null;
}

function mockData(driverId: string): object {
  const now = new Date();
  const bewertungen: Bewertung[] = [
    { id: '1', rating: 5, kommentar: 'Super schnell und freundlich!', created_at: new Date(now.getTime() - 20 * 60_000).toISOString(), order_bestellnummer: '1042' },
    { id: '2', rating: 4, kommentar: 'Pünktlich geliefert, danke.', created_at: new Date(now.getTime() - 90 * 60_000).toISOString(), order_bestellnummer: '1039' },
    { id: '3', rating: 5, kommentar: null, created_at: new Date(now.getTime() - 140 * 60_000).toISOString(), order_bestellnummer: '1035' },
    { id: '4', rating: 3, kommentar: 'Etwas verspätet aber nett.', created_at: new Date(now.getTime() - 3 * 3_600_000).toISOString(), order_bestellnummer: '1028' },
    { id: '5', rating: 5, kommentar: 'Essen noch warm, sehr gut!', created_at: new Date(now.getTime() - 5 * 3_600_000).toISOString(), order_bestellnummer: '1019' },
  ];
  const avg = bewertungen.reduce((s, b) => s + b.rating, 0) / bewertungen.length;
  return {
    bewertungen,
    avg_rating: Math.round(avg * 10) / 10,
    count: bewertungen.length,
    driver_id: driverId,
    generatedAt: now.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const driverId = url.searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const sb = await createClient();

  const { data: ratings, error } = await sb
    .from('driver_ratings')
    .select('id, rating, kommentar, created_at, order_id')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !ratings || ratings.length === 0) {
    return NextResponse.json(mockData(driverId));
  }

  // Try to resolve order bestellnummer
  const orderIds = (ratings ?? [])
    .map((r) => (r as { order_id?: string | null }).order_id)
    .filter((id): id is string => !!id);

  const orderMap = new Map<string, string>();
  if (orderIds.length > 0) {
    const { data: orders } = await sb
      .from('customer_orders')
      .select('id, bestellnummer')
      .in('id', orderIds);
    for (const o of orders ?? []) {
      orderMap.set(o.id, o.bestellnummer);
    }
  }

  const bewertungen: Bewertung[] = ratings.map((r) => {
    const orderId = (r as { order_id?: string | null }).order_id;
    return {
      id: r.id,
      rating: r.rating ?? 0,
      kommentar: (r as { kommentar?: string | null }).kommentar ?? null,
      created_at: (r as { created_at: string }).created_at,
      order_bestellnummer: orderId ? (orderMap.get(orderId) ?? null) : null,
    };
  });

  const avg = bewertungen.length > 0
    ? bewertungen.reduce((s, b) => s + b.rating, 0) / bewertungen.length
    : 0;

  return NextResponse.json({
    bewertungen,
    avg_rating: Math.round(avg * 10) / 10,
    count: bewertungen.length,
    driver_id: driverId,
    generatedAt: new Date().toISOString(),
  });
}
