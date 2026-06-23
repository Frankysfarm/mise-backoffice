/**
 * GET /api/delivery/admin/kitchen-capacity-alert
 *
 * Küchen-Kapazitäts-Warnung: Alert wenn zu viele Bestellungen gleichzeitig in Zubereitung.
 *
 * Schwellwert aus delivery_config (key: kitchen_max_concurrent_orders, Default: 8).
 * Alert-Level:
 *   ok       — currentCount ≤ threshold × 0.75
 *   warning  — threshold × 0.75 < currentCount ≤ threshold
 *   critical — currentCount > threshold
 *
 * Response:
 *   alertLevel, currentCount, threshold, pct, orders (Liste betroffener Bestellungen)
 *   longestWaitMin (älteste Bestellung in Zubereitung in Minuten)
 *
 * Multi-Tenant: alle Queries filtern location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_THRESHOLD = 8;

type AlertLevel = 'ok' | 'warning' | 'critical';

export interface KitchenCapacityAlertResponse {
  ok: boolean;
  alertLevel: AlertLevel;
  currentCount: number;
  threshold: number;
  pct: number;
  longestWaitMin: number | null;
  orders: Array<{
    id: string;
    bestellnummer: string | null;
    status: string;
    createdAt: string;
    waitMin: number;
  }>;
}

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
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();

  // Load threshold from delivery_config
  const { data: configRow } = await ssb
    .from('delivery_config')
    .select('value')
    .eq('location_id', locationId)
    .eq('key', 'kitchen_max_concurrent_orders')
    .maybeSingle();

  const threshold = configRow?.value != null ? Number(configRow.value) : DEFAULT_THRESHOLD;

  // Count orders currently in_zubereitung (status = 'in_zubereitung' or 'preparing')
  const now = new Date();
  const since = new Date(now.getTime() - 3 * 60 * 60 * 1_000).toISOString();

  const { data: orders } = await ssb
    .from('customer_orders')
    .select('id, bestellnummer, status, created_at')
    .eq('location_id', locationId)
    .in('status', ['in_zubereitung', 'preparing', 'bestätigt', 'confirmed'])
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(50);

  const nowMs = now.getTime();
  const orderList = (orders ?? []).map((o) => {
    const createdAt = o.created_at as string;
    const waitMin = Math.floor((nowMs - new Date(createdAt).getTime()) / 60_000);
    return {
      id:           o.id as string,
      bestellnummer: o.bestellnummer as string | null,
      status:       o.status as string,
      createdAt,
      waitMin,
    };
  });

  const currentCount = orderList.length;
  const pct = Math.round((currentCount / threshold) * 100);
  const longestWaitMin = orderList.length > 0 ? Math.max(...orderList.map((o) => o.waitMin)) : null;

  let alertLevel: AlertLevel = 'ok';
  if (currentCount > threshold) {
    alertLevel = 'critical';
  } else if (currentCount > threshold * 0.75) {
    alertLevel = 'warning';
  }

  return NextResponse.json({
    ok: true,
    alertLevel,
    currentCount,
    threshold,
    pct,
    longestWaitMin,
    orders: orderList,
  } satisfies KitchenCapacityAlertResponse);
}
