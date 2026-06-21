/**
 * GET /api/delivery/public/transparency?slug=<locationSlug>
 *      → Öffentliches Transparenz-Profil: Trust-Score, Badge, Avg-ETA, On-Time-Rate
 *      Kein Auth erforderlich (kein sensitiver Inhalt).
 *
 * Wird genutzt von LieferTransparenzBadge auf der Storefront.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getPublicTransparencyProfile } from '@/lib/delivery/transparency-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.trim();
  if (!slug) return NextResponse.json({ error: 'slug fehlt' }, { status: 400 });

  const sb = createServiceClient();

  // Slug → location_id (gleicher Zwei-Pfad-Ablauf wie public/avg-eta)
  let locationId: string | null = null;

  const { data: tenant } = await sb
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (tenant?.id) {
    const { data: locRow } = await sb
      .from('mise_locations')
      .select('id')
      .eq('tenant_id', tenant.id)
      .maybeSingle();
    locationId = locRow?.id ?? null;
  }

  if (!locationId) {
    const { data: loc } = await sb
      .from('mise_locations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    locationId = loc?.id ?? null;
  }

  if (!locationId) {
    return NextResponse.json({
      trustScore: null,
      badgeLevel: null,
      badgeLabel: null,
      avgDeliveryMin: null,
      onTimeRatePct: null,
      satisfactionRate: null,
      ordersLast30d: 0,
      snapshotDate: null,
    });
  }

  try {
    const profile = await getPublicTransparencyProfile(locationId);
    return NextResponse.json(profile);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
