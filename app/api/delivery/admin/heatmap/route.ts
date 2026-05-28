/**
 * GET /api/delivery/admin/heatmap?location_id=...&from=ISO&to=ISO
 *
 * Liefer-Heatmap: Aggregiert Bestell-Koordinaten nach Gitter-Zellen (0.01°≈1km).
 * Gibt GeoJSON-ähnliche Punkte zurück, die z.B. Google Maps HeatmapLayer nutzen kann.
 *
 * Response:
 * {
 *   points: Array<{ lat: number; lng: number; weight: number; zone: string }>
 *   total: number
 *   period: { from: string; to: string }
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Rundet auf nächstes 0.01° Gitter
function snapToGrid(v: number, step = 0.01): number {
  return Math.round(v / step) * step;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const now = new Date();
  const fromStr = searchParams.get('from')
    ?? new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const toStr = searchParams.get('to') ?? now.toISOString();

  const { data: orders, error } = await sb
    .from('customer_orders')
    .select('id, kunde_lat, kunde_lng, delivery_zone, status')
    .eq('location_id', locationId)
    .eq('typ', 'lieferung')
    .not('kunde_lat', 'is', null)
    .not('kunde_lng', 'is', null)
    .gte('created_at', fromStr)
    .lte('created_at', toStr)
    .limit(5000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregiere nach Gitter-Zelle
  type CellKey = string;
  const cells = new Map<CellKey, { lat: number; lng: number; weight: number; zone: string }>();

  for (const o of orders ?? []) {
    const lat = snapToGrid(o.kunde_lat as number);
    const lng = snapToGrid(o.kunde_lng as number);
    const key: CellKey = `${lat},${lng}`;
    const existing = cells.get(key);
    if (existing) {
      existing.weight += 1;
    } else {
      cells.set(key, {
        lat,
        lng,
        weight: 1,
        zone: (o.delivery_zone as string) ?? 'unknown',
      });
    }
  }

  const points = Array.from(cells.values()).sort((a, b) => b.weight - a.weight);

  return NextResponse.json({
    points,
    total: orders?.length ?? 0,
    period: { from: fromStr, to: toStr },
  });
}
