/**
 * GET  /api/delivery/subscriptions
 *      ?location_id=<uuid>&email=<optional>
 *
 * Öffentlicher Endpunkt (kein Login) für die Storefront.
 * Gibt aktive Abo-Pläne für einen Standort zurück.
 * Wenn email angegeben, wird auch das aktive Abo des Kunden mitgeliefert.
 *
 * POST /api/delivery/subscriptions
 *      { location_id, planId, customerEmail, customerName?, customerPhone? }
 *
 * Kunden können sich direkt aus dem Checkout für ein Abo anmelden.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSubscriptionPlans, getCustomerSubscription, createSubscription } from '@/lib/delivery/subscriptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const email = searchParams.get('email');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
  }

  try {
    const plans = await getSubscriptionPlans(locationId);
    const activePlans = plans.filter((p) => p.isActive);

    let currentSubscription = null;
    if (email && email.includes('@')) {
      currentSubscription = await getCustomerSubscription(locationId, email);
    }

    return NextResponse.json({ plans: activePlans, currentSubscription });
  } catch (err) {
    console.error('[subscriptions public GET]', err);
    return NextResponse.json({ error: 'Fehler beim Laden der Abo-Pläne' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 });
  }

  const locationId = body.location_id as string | undefined;
  const planId = body.planId as string | undefined;
  const customerEmail = body.customerEmail as string | undefined;

  if (!locationId || !planId || !customerEmail) {
    return NextResponse.json({ error: 'location_id, planId und customerEmail erforderlich' }, { status: 400 });
  }

  if (!customerEmail.includes('@')) {
    return NextResponse.json({ error: 'Ungültige E-Mail-Adresse' }, { status: 400 });
  }

  try {
    const sub = await createSubscription(locationId, {
      planId,
      customerEmail,
      customerName: (body.customerName as string | null) ?? null,
      customerPhone: (body.customerPhone as string | null) ?? null,
    });
    return NextResponse.json({ subscription: sub });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[subscriptions public POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
