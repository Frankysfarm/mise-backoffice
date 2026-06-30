/**
 * GET /api/delivery/admin/kitchen-handoff-monitor?location_id=...&threshold_min=10
 *
 * Phase 519 — Küchen-Handoff-Zeit-Monitor
 * Zeigt Bestellungen, die fertig sind aber noch nicht vom Fahrer abgeholt wurden.
 * Alert wenn Wartezeit > threshold_min.
 *
 * Response: { ok, data: HandoffData, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type HandoffAlertLevel = 'ok' | 'warning' | 'critical';

export interface HandoffOrder {
  orderId: string;
  bestellnummer: string;
  kundeName: string;
  fertigSeitMin: number;
  status: string;
}

export interface HandoffData {
  alertLevel: HandoffAlertLevel;
  waitingCount: number;
  longestWaitMin: number;
  thresholdMin: number;
  avgWaitMin: number | null;
  orders: HandoffOrder[];
}

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

  const thresholdMin = Math.min(60, Math.max(3, parseInt(searchParams.get('threshold_min') ?? '10', 10)));

  const ssb = createServiceClient();
  const now = new Date();
  const since = new Date(now.getTime() - 2 * 3_600_000); // letzte 2 Stunden

  // Bestellungen die als fertig markiert sind (noch nicht unterwegs/geliefert)
  const { data: rows } = await ssb
    .from('customer_orders')
    .select('id, bestellnummer, kunde_name, status, fertig_am, bestellt_am')
    .eq('location_id', locationId)
    .in('status', ['fertig', 'ready', 'bereit', 'fertig_zur_abholung', 'pickup_ready'])
    .gte('bestellt_am', since.toISOString())
    .order('fertig_am', { ascending: true })
    .limit(20);

  const orders = (rows ?? []) as {
    id: string;
    bestellnummer: string;
    kunde_name: string | null;
    status: string;
    fertig_am: string | null;
    bestellt_am: string | null;
  }[];

  const handoffOrders: HandoffOrder[] = orders
    .map((o) => {
      const fertigAt = o.fertig_am ? new Date(o.fertig_am) : (o.bestellt_am ? new Date(o.bestellt_am) : now);
      const waitMs = now.getTime() - fertigAt.getTime();
      const fertigSeitMin = Math.max(0, Math.round(waitMs / 60_000));
      return {
        orderId: o.id,
        bestellnummer: o.bestellnummer ?? o.id.slice(0, 8),
        kundeName: o.kunde_name ?? 'Unbekannt',
        fertigSeitMin,
        status: o.status,
      };
    })
    .sort((a, b) => b.fertigSeitMin - a.fertigSeitMin);

  const waitingCount = handoffOrders.length;
  const longestWaitMin = handoffOrders[0]?.fertigSeitMin ?? 0;
  const avgWaitMin = waitingCount > 0
    ? Math.round(handoffOrders.reduce((s, o) => s + o.fertigSeitMin, 0) / waitingCount)
    : null;

  let alertLevel: HandoffAlertLevel = 'ok';
  if (longestWaitMin >= thresholdMin * 2) alertLevel = 'critical';
  else if (longestWaitMin >= thresholdMin) alertLevel = 'warning';

  const data: HandoffData = {
    alertLevel,
    waitingCount,
    longestWaitMin,
    thresholdMin,
    avgWaitMin,
    orders: handoffOrders.slice(0, 10),
  };

  return NextResponse.json({ ok: true, data, generatedAt: now.toISOString() });
}
