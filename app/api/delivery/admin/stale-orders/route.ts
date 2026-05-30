/**
 * GET /api/delivery/admin/stale-orders?location_id=...
 *
 * Lieferbestellungen ohne Fahrer-Zuweisung seit >10 Minuten.
 * Für Admin-Dashboard: zeigt wie viele Bestellungen "feststecken" und
 * ob Eskalation (erweiterter Radius) bereits aktiv ist.
 *
 * Response:
 * {
 *   count: number
 *   needs_attention: boolean   // true wenn ≥1 Bestellung needs_escalation/escalated
 *   orders: [{
 *     id, bestellnummer, age_min, dispatch_attempts, escalation_status,
 *     delivery_zone, priority, created_at, last_dispatch_attempt_at, dispatch_escalated_at
 *   }]
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StaleOrderRow {
  id: string;
  bestellnummer: string;
  created_at: string;
  status: string;
  delivery_zone: string | null;
  priority: string | null;
  dispatch_attempts: number;
  last_dispatch_attempt_at: string | null;
  dispatch_escalated_at: string | null;
  kunde_adresse: string | null;
  kunde_plz: string | null;
  kunde_stadt: string | null;
  age_min: number;
  escalation_status: 'first_hold' | 'retry' | 'needs_escalation' | 'escalated';
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const svc = createServiceClient();

  // Primär: View verwenden (Migration 013)
  const { data: viewData, error: viewErr } = await svc
    .from('v_stale_unassigned_orders')
    .select('id, bestellnummer, created_at, status, delivery_zone, priority, dispatch_attempts, last_dispatch_attempt_at, dispatch_escalated_at, kunde_adresse, kunde_plz, kunde_stadt, age_min, escalation_status')
    .eq('location_id', locationId)
    .limit(50);

  // Fallback wenn View noch nicht in DB (Migration 013 nicht ausgeführt)
  if (viewErr) {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: fallback } = await svc
      .from('customer_orders')
      .select('id, bestellnummer, created_at, status, delivery_zone, priority, dispatch_attempts, last_dispatch_attempt_at, dispatch_escalated_at, kunde_adresse, kunde_plz, kunde_stadt')
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .is('mise_batch_id', null)
      .not('status', 'in', '(storniert,abgeschlossen,geliefert)')
      .lt('created_at', tenMinsAgo)
      .order('created_at', { ascending: true })
      .limit(50);

    const orders = (fallback ?? []).map((o) => {
      const ageMin = Math.round((Date.now() - new Date(o.created_at as string).getTime()) / 60_000);
      const attempts = (o.dispatch_attempts as number) ?? 0;
      const escalationStatus = (o.dispatch_escalated_at as string | null)
        ? 'escalated'
        : attempts >= 3 ? 'needs_escalation'
        : attempts >= 1 ? 'retry'
        : 'first_hold';
      return { ...o, age_min: ageMin, escalation_status: escalationStatus };
    });

    const needsAttention = orders.some(
      (o) => o.escalation_status === 'needs_escalation' || o.escalation_status === 'escalated',
    );
    return NextResponse.json({ count: orders.length, needs_attention: needsAttention, orders, _fallback: true });
  }

  const orders = (viewData ?? []) as StaleOrderRow[];
  const needsAttention = orders.some(
    (o) => o.escalation_status === 'needs_escalation' || o.escalation_status === 'escalated',
  );

  return NextResponse.json({
    count: orders.length,
    needs_attention: needsAttention,
    orders,
  });
}

/**
 * POST /api/delivery/admin/stale-orders
 * Body: { order_id: string }
 *
 * Erzwingt sofortigen Re-Dispatch einer gehaltenen Bestellung mit eskaliertem Radius.
 * Nützlich wenn Admin manuell eingreifen will.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { order_id?: string };
  if (!body.order_id) return NextResponse.json({ error: 'order_id fehlt' }, { status: 400 });

  const svc = createServiceClient();
  const { data: o, error } = await svc
    .from('customer_orders')
    .select('id, location_id, kunde_lat, kunde_lng, kunde_adresse, kunde_plz, kunde_stadt, bestellnummer, priority, estimated_prep_min, created_at, dispatch_attempts, dispatch_escalated_at')
    .eq('id', body.order_id)
    .single();

  if (error || !o) return NextResponse.json({ error: 'Bestellung nicht gefunden' }, { status: 404 });

  const { dispatchSingleOrder } = await import('@/lib/delivery/dispatch-engine');
  const result = await dispatchSingleOrder(
    o as Parameters<typeof dispatchSingleOrder>[0],
    1.5,  // Eskalierter Radius für manuellen Re-Dispatch
  );

  if (result.outcome === 'held') {
    await svc.from('customer_orders').update({
      dispatch_attempts: ((o.dispatch_attempts as number) ?? 0) + 1,
      last_dispatch_attempt_at: new Date().toISOString(),
    }).eq('id', body.order_id);
  }

  return NextResponse.json({ ok: true, result });
}
