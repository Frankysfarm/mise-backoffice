/**
 * PATCH /api/delivery/tours/[id]/status
 * Setzt den Status einer Tour (z.B. assigned → at_restaurant → on_route → delivered).
 * Bei Übergang → 'delivered': Driver-Rating + Payout-Records werden neu berechnet (fire-and-forget).
 * Bei Übergang → 'cancelled':  Recovery Engine liberated undelivered orders + re-dispatches (fire-and-forget).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recomputeDriverRating } from '@/lib/delivery/rating';
import { calculateDeliveryPayout } from '@/lib/delivery/payout';
import { recoverCancelledBatch } from '@/lib/delivery/recovery';
import { generateRatingToken } from '@/lib/delivery/satisfaction';
import { queueWebhookEvent } from '@/lib/delivery/webhooks';
import { recordActualDelivery } from '@/lib/delivery/eta-calibration';
import { recordCustomerEvent, type CustomerEventType } from '@/lib/delivery/customer-notify';
import { recordDriverSurgeBonus } from '@/lib/delivery/surge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATES = ['pending_acceptance', 'assigned', 'at_restaurant', 'on_route', 'delivered', 'cancelled'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const body = await req.json() as { state?: string };
  if (!body.state || !VALID_STATES.includes(body.state)) {
    return NextResponse.json({ error: `Ungültiger Status. Erlaubt: ${VALID_STATES.join(', ')}` }, { status: 400 });
  }

  const { error } = await sb
    .from('mise_delivery_batches')
    .update({ state: body.state })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Nach Tour-Abschluss: Driver-Rating + Payout-Records berechnen (fire-and-forget)
  if (body.state === 'delivered') {
    const { data: batch } = await sb
      .from('mise_delivery_batches')
      .select('id, driver_id, location_id')
      .eq('id', params.id)
      .maybeSingle();

    if (batch?.driver_id) {
      // Rating neu berechnen
      recomputeDriverRating(batch.driver_id as string).catch(() => {});

      // Payout-Records + Rating-Tokens für alle Dropoff-Stops dieser Tour
      if (batch.location_id) {
        const { data: stops } = await sb
          .from('mise_delivery_batch_stops')
          .select('id, order_id, lat, lng, completed_at')
          .eq('batch_id', params.id)
          .eq('type', 'dropoff')
          .not('completed_at', 'is', null);

        for (const stop of stops ?? []) {
          // Payout berechnen
          calculateDeliveryPayout({
            driverId: batch.driver_id as string,
            locationId: batch.location_id as string,
            orderId: (stop.order_id as string | null) ?? null,
            batchId: batch.id as string,
            batchStopId: stop.id as string,
            completedAt: (stop.completed_at as string | null) ?? undefined,
          }).catch(() => {});

          // Kunden-Rating-Token generieren (fire-and-forget)
          if (stop.order_id) {
            generateRatingToken(stop.order_id as string).catch(() => {});
            // ETA-Kalibrierungs-Engine: echte Lieferzeit eintragen
            const deliveredAt = stop.completed_at
              ? new Date(stop.completed_at as string)
              : new Date();
            recordActualDelivery(stop.order_id as string, deliveredAt).catch(() => {});
          }

          // Surge-Bonus: Fahrer erhält Bonus wenn Surge aktiv war (fire-and-forget)
          recordDriverSurgeBonus({
            driverId: batch.driver_id as string,
            locationId: batch.location_id as string,
            batchId: batch.id as string,
            orderId: (stop.order_id as string | null) ?? undefined,
          }).catch(() => {});
        }
      }
    }
  }

  // Bei Stornierung: Recovery Engine befreit nicht-gelieferte Stops (fire-and-forget)
  if (body.state === 'cancelled') {
    recoverCancelledBatch(params.id, 'admin_cancelled', true).catch(() => {});
  }

  // Webhook-Events für externe Systeme (fire-and-forget)
  if (body.state === 'on_route' || body.state === 'delivered' || body.state === 'cancelled') {
    (async () => {
      try {
        const { data: batchForWebhook } = await sb
          .from('mise_delivery_batches')
          .select('id, driver_id, location_id')
          .eq('id', params.id)
          .maybeSingle();

        if (!batchForWebhook?.location_id) return;
        const locId = batchForWebhook.location_id as string;

        if (body.state === 'on_route') {
          await queueWebhookEvent(locId, 'batch_picked_up', {
            batch_id:  params.id,
            driver_id: batchForWebhook.driver_id ?? null,
          });
        } else if (body.state === 'delivered') {
          await queueWebhookEvent(locId, 'batch_completed', {
            batch_id:   params.id,
            driver_id:  batchForWebhook.driver_id ?? null,
            completed_at: new Date().toISOString(),
          });
        } else if (body.state === 'cancelled') {
          await queueWebhookEvent(locId, 'batch_cancelled', {
            batch_id: params.id,
            reason:   'admin_cancelled',
          });
        }
      } catch { /* fire-and-forget */ }
    })();
  }

  // Customer Event Feed: Kunden über Tour-Status-Änderungen informieren (fire-and-forget)
  if (['at_restaurant', 'on_route', 'delivered', 'cancelled'].includes(body.state)) {
    (async () => {
      try {
        const { data: bEvt } = await sb
          .from('mise_delivery_batches')
          .select('location_id')
          .eq('id', params.id)
          .maybeSingle();
        if (!bEvt?.location_id) return;
        const locId = bEvt.location_id as string;

        const { data: sEvt } = await sb
          .from('mise_delivery_batch_stops')
          .select('order_id')
          .eq('batch_id', params.id)
          .eq('type', 'dropoff')
          .not('order_id', 'is', null);

        const orderIds = (sEvt ?? []).map((s: { order_id: unknown }) => s.order_id as string).filter(Boolean);
        if (orderIds.length === 0) return;

        const evMap: Record<string, CustomerEventType> = {
          at_restaurant: 'driver_at_restaurant',
          on_route:      'driver_departing',
          delivered:     'delivered',
          cancelled:     'cancelled',
        };
        const evType = evMap[body.state!];
        if (!evType) return;

        await Promise.all(
          orderIds.map((oid) =>
            recordCustomerEvent(oid, locId, evType, { batch_id: params.id }),
          ),
        );
      } catch { /* fire-and-forget */ }
    })();
  }

  return NextResponse.json({ ok: true, state: body.state });
}
