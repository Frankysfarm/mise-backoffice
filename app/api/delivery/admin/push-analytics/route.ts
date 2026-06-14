/**
 * GET  /api/delivery/admin/push-analytics
 *
 * Unified Push Notification Analytics — VAPID + WhatsApp + Driver Push.
 *
 * Query params:
 *   action=dashboard&days=7|14|30  (default: dashboard, 7d)
 *   action=compute                  (manuelle Neu-Berechnung)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  getPushAnalyticsDashboard,
  computePushAnalyticsForLocation,
} from '@/lib/delivery/push-analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(userId: string): Promise<string | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('employees')
    .select('location_id')
    .eq('id', userId)
    .maybeSingle();
  return (data?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const sb   = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'Keine Location' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') ?? 'dashboard';
  const days   = Math.min(Math.max(parseInt(searchParams.get('days') ?? '7', 10), 1), 30);

  if (action === 'compute') {
    await computePushAnalyticsForLocation(locationId);
    return NextResponse.json({ ok: true, recomputed: true });
  }

  // default: dashboard
  const dashboard = await getPushAnalyticsDashboard(locationId, days);
  return NextResponse.json(dashboard, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
