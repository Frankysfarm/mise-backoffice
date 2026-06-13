/**
 * GET  /api/delivery/admin/tour-analytics
 * POST /api/delivery/admin/tour-analytics  { action: 'scan' | 'record', batch_id? }
 *
 * Tour Performance Analytics dashboard data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getTourAnalyticsDashboard,
  recordTourPerformance,
  scanAndRecordCompletedTours,
} from '@/lib/delivery/tour-analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  if (!emp?.tenant_id) return null;
  const { data: loc } = await sb
    .from('locations')
    .select('id')
    .eq('tenant_id', emp.tenant_id as string)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (loc?.id as string) ?? null;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId)
    return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const dashboard = await getTourAnalyticsDashboard(locationId);
  return NextResponse.json({ ok: true, ...dashboard });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: { action?: string; batch_id?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body.action === 'scan') {
    const result = await scanAndRecordCompletedTours();
    return NextResponse.json({ ok: true, ...result });
  }

  if (body.action === 'record' && body.batch_id) {
    await recordTourPerformance(body.batch_id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 });
}
