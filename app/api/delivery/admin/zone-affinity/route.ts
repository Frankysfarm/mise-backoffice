/**
 * GET  /api/delivery/admin/zone-affinity
 * POST /api/delivery/admin/zone-affinity  { action: 'refresh' }
 *
 * Zone Affinity Dashboard: driver × zone performance matrix.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getZoneAffinityDashboard,
  refreshZoneAffinityAllLocations,
} from '@/lib/delivery/zone-affinity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  if (!data?.tenant_id) return null;
  const { data: loc } = await sb
    .from('locations')
    .select('id')
    .eq('tenant_id', data.tenant_id as string)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (loc?.id as string) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const dashboard = await getZoneAffinityDashboard(locationId);
  return NextResponse.json({ ok: true, ...dashboard });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: { action?: string };
  try { body = await req.json(); } catch { body = {}; }

  if (body.action === 'refresh') {
    const result = await refreshZoneAffinityAllLocations();
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ error: 'Unbekannte action' }, { status: 400 });
}
