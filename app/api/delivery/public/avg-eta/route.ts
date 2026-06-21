/**
 * GET /api/delivery/public/avg-eta?slug=<locationSlug>
 *
 * Public (no-auth) endpoint — returns today's avg delivery time for a given
 * location slug. Used by LieferzeitVergleichWidget on the customer storefront.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.trim();
  if (!slug) return NextResponse.json({ error: 'slug fehlt' }, { status: 400 });

  // Use service-role-equivalent anonymous client — no user session required.
  const sb = await createClient();

  // Resolve slug → location_id
  const { data: tenant } = await sb
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (!tenant) {
    // Try fallback: slug might be a direct location slug on mise_locations
    const { data: loc } = await sb
      .from('mise_locations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!loc) return NextResponse.json({ avg_delivery_min: null });
  }

  // Resolve tenant → location_id
  const { data: locRow } = await sb
    .from('mise_locations')
    .select('id')
    .eq('tenant_id', tenant!.id)
    .maybeSingle();

  const locationId = locRow?.id;
  if (!locationId) return NextResponse.json({ avg_delivery_min: null });

  // Today's avg delivery time from delivery_performance
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: rows } = await sb
    .from('delivery_performance')
    .select('delivery_min')
    .eq('location_id', locationId)
    .gte('recorded_at', todayStart.toISOString())
    .not('delivery_min', 'is', null);

  const valid = (rows ?? []).map(r => r.delivery_min as number).filter(v => v > 0);
  const avg = valid.length > 0
    ? Math.round(valid.reduce((s, v) => s + v, 0) / valid.length)
    : null;

  return NextResponse.json({ avg_delivery_min: avg });
}
