/**
 * POST /api/delivery/admin/rating-request-trigger
 *
 * Löst einen Bewertungs-Anfrage-Event aus, nachdem eine Bestellung geliefert wurde.
 * Generiert/holt den Rating-Token und sendet einen `rating_request` Event
 * über das Customer-Notify-System inkl. Rating-URL in metadata.
 *
 * Body: { order_id: string; location_id?: string }
 * Response: { ok: true; ratingUrl: string; token: string }
 *
 * Intern genutzt: vom Dispatch/Delivery-Flow nach Statuswechsel auf "geliefert".
 * Multi-Tenant: location_id wird aus order gelesen falls nicht übergeben.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateRatingToken } from '@/lib/delivery/satisfaction';
import { recordCustomerEvent } from '@/lib/delivery/customer-notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TriggerBody {
  order_id: string;
  location_id?: string | null;
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  let body: TriggerBody;
  try {
    body = (await req.json()) as TriggerBody;
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const { order_id } = body;
  if (!order_id) return NextResponse.json({ error: 'order_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();

  // Resolve location_id from order if not provided
  let locationId = body.location_id ?? null;
  if (!locationId) {
    const { data: order } = await ssb
      .from('customer_orders')
      .select('location_id')
      .eq('id', order_id)
      .maybeSingle();
    locationId = (order?.location_id as string | null) ?? null;
  }
  if (!locationId) return NextResponse.json({ error: 'location_id nicht ermittelbar' }, { status: 400 });

  // Verify user has access to this location
  const { data: emp } = await sb
    .from('employees')
    .select('location_id, tenant_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!emp) return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });

  // Generate or retrieve rating token
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const tokenResult = await generateRatingToken(order_id, baseUrl);
  if (!tokenResult) {
    return NextResponse.json({ error: 'Rating-Token konnte nicht generiert werden' }, { status: 500 });
  }

  // Fire rating_request event — fire-and-forget
  await recordCustomerEvent(order_id, locationId, 'rating_request', {
    ratingUrl: tokenResult.ratingUrl,
    token: tokenResult.token,
  });

  return NextResponse.json({
    ok: true,
    ratingUrl: tokenResult.ratingUrl,
    token: tokenResult.token,
  });
}
