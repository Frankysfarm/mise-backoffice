/**
 * GET  /api/delivery/admin/subscriptions
 *      ?action=dashboard|plans|list&status=active|cancelled|paused|expired|all
 *
 * POST /api/delivery/admin/subscriptions
 *      { action: 'create_plan',           name, planType, priceEur, ... }
 *      { action: 'update_plan',           planId, ...updates }
 *      { action: 'toggle_plan',           planId }
 *      { action: 'create_subscription',   planId, customerEmail, customerName?, customerPhone? }
 *      { action: 'cancel_subscription',   subscriptionId, reason? }
 *      { action: 'renew_all' }            — Alle abgelaufenen Abos verlängern
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getSubscriptionDashboard,
  getSubscriptionPlans,
  getSubscriptionList,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  togglePlanActive,
  createSubscription,
  cancelSubscription,
  renewExpiredSubscriptions,
} from '@/lib/delivery/subscriptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const urlLocId = req.nextUrl.searchParams.get('location_id');
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  if (urlLocId) return urlLocId;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return (emp?.location_id as string | null) ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  const action = req.nextUrl.searchParams.get('action') ?? 'dashboard';

  try {
    if (action === 'plans') {
      const plans = await getSubscriptionPlans(locationId);
      return NextResponse.json({ plans });
    }

    if (action === 'list') {
      const status = (req.nextUrl.searchParams.get('status') ?? 'all') as
        'active' | 'cancelled' | 'paused' | 'expired' | 'all';
      const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200);
      const subscriptions = await getSubscriptionList(locationId, { status, limit });
      return NextResponse.json({ subscriptions });
    }

    // default: dashboard
    const dashboard = await getSubscriptionDashboard(locationId);
    return NextResponse.json(dashboard);
  } catch (err) {
    console.error('[subscriptions GET]', err);
    return NextResponse.json({ error: 'Fehler beim Laden der Daten' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const action = body.action as string;

  try {
    if (action === 'create_plan') {
      const plan = await createSubscriptionPlan(locationId, {
        name: body.name as string,
        description: (body.description as string | null) ?? null,
        planType: body.planType as 'weekly' | 'monthly' | 'annual',
        priceEur: Number(body.priceEur),
        freeDeliveriesPerPeriod: body.freeDeliveriesPerPeriod != null
          ? Number(body.freeDeliveriesPerPeriod) : null,
        discountPct: body.discountPct != null ? Number(body.discountPct) : 0,
        minOrderValueEur: body.minOrderValueEur != null
          ? Number(body.minOrderValueEur) : null,
      });
      return NextResponse.json({ plan });
    }

    if (action === 'update_plan') {
      const planId = body.planId as string;
      if (!planId) return NextResponse.json({ error: 'planId fehlt' }, { status: 400 });
      await updateSubscriptionPlan(planId, locationId, {
        name: body.name as string | undefined,
        description: body.description as string | null | undefined,
        priceEur: body.priceEur != null ? Number(body.priceEur) : undefined,
        freeDeliveriesPerPeriod: body.freeDeliveriesPerPeriod !== undefined
          ? (body.freeDeliveriesPerPeriod != null ? Number(body.freeDeliveriesPerPeriod) : null)
          : undefined,
        discountPct: body.discountPct != null ? Number(body.discountPct) : undefined,
        minOrderValueEur: body.minOrderValueEur !== undefined
          ? (body.minOrderValueEur != null ? Number(body.minOrderValueEur) : null)
          : undefined,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'toggle_plan') {
      const planId = body.planId as string;
      if (!planId) return NextResponse.json({ error: 'planId fehlt' }, { status: 400 });
      const isActive = await togglePlanActive(planId, locationId);
      return NextResponse.json({ isActive });
    }

    if (action === 'create_subscription') {
      const sub = await createSubscription(locationId, {
        planId: body.planId as string,
        customerEmail: body.customerEmail as string,
        customerPhone: (body.customerPhone as string | null) ?? null,
        customerName: (body.customerName as string | null) ?? null,
      });
      return NextResponse.json({ subscription: sub });
    }

    if (action === 'cancel_subscription') {
      const subId = body.subscriptionId as string;
      if (!subId) return NextResponse.json({ error: 'subscriptionId fehlt' }, { status: 400 });
      await cancelSubscription(subId, locationId, body.reason as string | undefined);
      return NextResponse.json({ ok: true });
    }

    if (action === 'renew_all') {
      const result = await renewExpiredSubscriptions();
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: `Unbekannte Aktion: ${action}` }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[subscriptions POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
