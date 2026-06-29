/**
 * GET /api/delivery/admin/kitchen-backlog-monitor?location_id=...&threshold_min=20&alert_count=3
 *
 * Küchen-Rückstand-Monitor: Wie viele Bestellungen warten länger als X Min auf Fertigstellung?
 * Phase 512
 *
 * Params:
 *   threshold_min  = Minuten bis eine Bestellung als "Rückstand" gilt (default: 20)
 *   alert_count    = Anzahl Rückstands-Bestellungen für Alert (default: 3)
 *
 * Response: { ok, data: BacklogData, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type BacklogLevel = 'ok' | 'warning' | 'critical';

export interface BacklogOrder {
  orderId: string;
  bestellnummer: string | null;
  status: string;
  waitMinutes: number;
  zone: string | null;
}

export interface BacklogData {
  alertLevel: BacklogLevel;
  backlogCount: number;
  thresholdMin: number;
  alertCountThreshold: number;
  longestWaitMin: number;
  totalInPrep: number;
  orders: BacklogOrder[];
}

const PREP_STATUSES = ['in_zubereitung', 'preparing', 'bestätigt', 'confirmed', 'in_preparation'];

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const thresholdMin = Math.max(1, parseInt(searchParams.get('threshold_min') ?? '20', 10));
  const alertCountThreshold = Math.max(1, parseInt(searchParams.get('alert_count') ?? '3', 10));

  const ssb = createServiceClient();
  const now = new Date();
  const since = new Date(now.getTime() - 3 * 3_600_000); // Letzte 3h

  const { data: orders } = await ssb
    .from('customer_orders')
    .select('id, order_number, status, created_at, delivery_zone')
    .eq('location_id', locationId)
    .in('status', PREP_STATUSES)
    .gte('created_at', since.toISOString());

  const allOrders: BacklogOrder[] = (orders ?? []).map((o) => {
    const waitMs = now.getTime() - new Date(o.created_at as string).getTime();
    return {
      orderId: o.id as string,
      bestellnummer: (o.order_number as string) ?? null,
      status: o.status as string,
      waitMinutes: Math.round(waitMs / 60_000),
      zone: (o.delivery_zone as string) ?? null,
    };
  });

  const backlogOrders = allOrders.filter((o) => o.waitMinutes >= thresholdMin);
  backlogOrders.sort((a, b) => b.waitMinutes - a.waitMinutes);

  const longestWait = backlogOrders[0]?.waitMinutes ?? 0;

  let alertLevel: BacklogLevel = 'ok';
  if (backlogOrders.length >= alertCountThreshold * 2) {
    alertLevel = 'critical';
  } else if (backlogOrders.length >= alertCountThreshold) {
    alertLevel = 'warning';
  }

  const data: BacklogData = {
    alertLevel,
    backlogCount: backlogOrders.length,
    thresholdMin,
    alertCountThreshold,
    longestWaitMin: longestWait,
    totalInPrep: allOrders.length,
    orders: backlogOrders.slice(0, 10),
  };

  return NextResponse.json({ ok: true, data, generatedAt: now.toISOString() });
}
