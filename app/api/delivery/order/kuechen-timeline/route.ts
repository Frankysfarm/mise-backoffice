/**
 * GET /api/delivery/order/kuechen-timeline?order_id=X&location_id=Y
 *
 * Phase 850 — Küchen-Transparenz-Timeline
 * Gibt den aktuellen Status einer Bestellung als Stage-Sequenz zurück:
 * warteschlange → zubereitung → bereit → unterwegs → geliefert
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Stage = 'warteschlange' | 'zubereitung' | 'bereit' | 'unterwegs' | 'geliefert';

function mapStatus(status: string | null): Stage {
  if (status === 'delivered') return 'geliefert';
  if (status === 'out_for_delivery' || status === 'picked_up') return 'unterwegs';
  if (status === 'ready') return 'bereit';
  if (status === 'preparing') return 'zubereitung';
  return 'warteschlange';
}

const STAGE_ORDER: Stage[] = ['warteschlange', 'zubereitung', 'bereit', 'unterwegs', 'geliefert'];
const STAGE_LABELS: Record<Stage, string> = {
  warteschlange: 'Warteschlange',
  zubereitung: 'Zubereitung',
  bereit: 'Abholbereit',
  unterwegs: 'Unterwegs',
  geliefert: 'Geliefert',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('order_id');
  const locationId = searchParams.get('location_id');
  if (!orderId) return NextResponse.json({ error: 'order_id required' }, { status: 400 });

  const sb = await createClient();

  const q = sb
    .from('customer_orders')
    .select('id, status, created_at, prep_started_at, ready_at, picked_up_at, delivered_at, estimated_delivery_at')
    .eq('id', orderId);
  if (locationId) q.eq('location_id', locationId);
  const { data: orders } = await q.maybeSingle();

  if (!orders) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const currentStage = mapStatus(orders.status as string | null);
  const currentIdx = STAGE_ORDER.indexOf(currentStage);

  const tsByStage: Partial<Record<Stage, string>> = {
    warteschlange: orders.created_at as string,
    zubereitung: (orders as Record<string, unknown>).prep_started_at as string | undefined ?? undefined,
    bereit: (orders as Record<string, unknown>).ready_at as string | undefined ?? undefined,
    unterwegs: (orders as Record<string, unknown>).picked_up_at as string | undefined ?? undefined,
    geliefert: orders.delivered_at as string | undefined ?? undefined,
  };

  const stages = STAGE_ORDER.map((key, i) => ({
    key,
    label: STAGE_LABELS[key],
    done: i < currentIdx,
    active: i === currentIdx,
    ts: tsByStage[key] ?? null,
  }));

  const etaMin = orders.estimated_delivery_at
    ? Math.max(0, Math.round((new Date(orders.estimated_delivery_at as string).getTime() - Date.now()) / 60_000))
    : null;

  return NextResponse.json({
    order_id: orders.id,
    stage: currentStage,
    stages,
    eta_min: etaMin,
    generatedAt: new Date().toISOString(),
  });
}
