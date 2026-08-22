/**
 * GET /api/delivery/admin/trends?location_id=...
 *
 * Heute vs. Gestern Vergleich für Trend-Pfeile im Admin-Dashboard.
 * Nutzt get_delivery_trends() DB-Funktion (Migration 006).
 *
 * Response:
 * {
 *   today:     { orders, delivered, avg_score }
 *   yesterday: { orders, delivered, avg_score }
 *   delta_orders:    number   — positiv = mehr als gestern
 *   delta_delivered: number
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDeliveryAdminActor, isDeliveryAdminLocation } from '@/lib/delivery/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await getDeliveryAdminActor();
  if (!actor) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 });
  const sb = await createClient();

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  if (!await isDeliveryAdminLocation(actor, locationId)) {
    return NextResponse.json({ error: 'Standort nicht autorisiert' }, { status: 403 });
  }

  const { data, error } = await sb.rpc('get_delivery_trends', {
    p_location_id: locationId,
  });

  if (error) {
    // Fallback: Funktion noch nicht in DB — leere Trends zurückgeben
    return NextResponse.json({
      today:           { orders: 0, delivered: 0, avg_score: null },
      yesterday:       { orders: 0, delivered: 0, avg_score: null },
      delta_orders:    0,
      delta_delivered: 0,
      _fallback: true,
    });
  }

  return NextResponse.json(data as Record<string, unknown>);
}
