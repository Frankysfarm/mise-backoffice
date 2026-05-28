/**
 * lib/delivery/kitchen-sync.ts
 *
 * Küchen-Timing Synchronisation.
 * Berechnet wann die Küche mit dem Kochen anfangen soll,
 * damit das Essen genau dann fertig ist wenn der Fahrer ankommt.
 *
 * Strategie: cook_start = tour_pickup_at - prep_min - buffer_min
 * Wenn cook_start in der Vergangenheit liegt → sofort (notified_at = now)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

export interface KitchenTimingInput {
  locationId: string;
  orderId: string;
  batchId: string | null;
  tourPickupAt: Date;         // Wann Fahrer am Restaurant abholt
  estimatedPrepMin: number;   // Geschätzte Zubereitungszeit
  bufferMin?: number;         // Puffer (default: 3 min)
}

export interface KitchenTiming {
  id: string;
  orderId: string;
  batchId: string | null;
  tourPickupAt: Date;
  cookStartAt: Date;
  readyTarget: Date;
  prepMin: number;
  bufferMin: number;
  status: 'scheduled' | 'cooking' | 'ready' | 'picked_up';
  notifiedAt: Date | null;
}

/** Erstellt oder aktualisiert ein Küchen-Timing für eine Bestellung. */
export async function upsertKitchenTiming(input: KitchenTimingInput): Promise<KitchenTiming> {
  const sb = createServiceClient();
  const buffer = input.bufferMin ?? 3;
  const cookStartAt = new Date(
    input.tourPickupAt.getTime() - (input.estimatedPrepMin + buffer) * 60_000,
  );
  const readyTarget = new Date(
    input.tourPickupAt.getTime() - buffer * 60_000,
  );

  const now = new Date();
  const shouldNotifyNow = cookStartAt <= now;

  const row = {
    location_id:     input.locationId,
    order_id:        input.orderId,
    batch_id:        input.batchId,
    tour_pickup_at:  input.tourPickupAt.toISOString(),
    cook_start_at:   cookStartAt.toISOString(),
    ready_target:    readyTarget.toISOString(),
    prep_min:        input.estimatedPrepMin,
    buffer_min:      buffer,
    status:          shouldNotifyNow ? 'cooking' : 'scheduled',
    notified_at:     shouldNotifyNow ? now.toISOString() : null,
    updated_at:      now.toISOString(),
  };

  const { data, error } = await sb
    .from('kitchen_timings')
    .upsert(row, { onConflict: 'order_id' })
    .select()
    .single();

  if (error) throw new Error(`kitchen_timings upsert failed: ${error.message}`);

  return parseRow(data);
}

/** Markiert eine Bestellung als in Zubereitung (Küche hat gestartet). */
export async function markCooking(orderId: string): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('kitchen_timings')
    .update({ status: 'cooking', notified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('status', 'scheduled');
}

/** Markiert eine Bestellung als fertig (bereit zur Abholung). */
export async function markReady(orderId: string): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('kitchen_timings')
    .update({ status: 'ready', updated_at: new Date().toISOString() })
    .eq('order_id', orderId);
}

/** Markiert eine Bestellung als abgeholt. */
export async function markPickedUp(orderId: string): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('kitchen_timings')
    .update({ status: 'picked_up', updated_at: new Date().toISOString() })
    .eq('order_id', orderId);
}

/** Lädt alle aktiven Küchen-Timings für eine Location (für Küchen-Dashboard). */
export async function getKitchenQueue(locationId: string): Promise<KitchenTiming[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('kitchen_timings')
    .select('*')
    .eq('location_id', locationId)
    .in('status', ['scheduled', 'cooking', 'ready'])
    .order('cook_start_at', { ascending: true });

  return (data ?? []).map(parseRow);
}

/**
 * Prüft alle geplanten Timings und triggert Benachrichtigungen für fällige Bestellungen.
 * Wird vom Cron alle 30 Sekunden aufgerufen.
 */
export async function syncKitchenNotifications(): Promise<{
  notified: number;
  locations: string[];
}> {
  const sb = createServiceClient();
  const now = new Date();

  const { data: due } = await sb
    .from('kitchen_timings')
    .select('id, order_id, location_id, batch_id')
    .eq('status', 'scheduled')
    .lte('cook_start_at', now.toISOString())
    .is('notified_at', null)
    .limit(100);

  if (!due || due.length === 0) return { notified: 0, locations: [] };

  const ids = due.map((r) => r.id as string);
  await sb
    .from('kitchen_timings')
    .update({ status: 'cooking', notified_at: now.toISOString(), updated_at: now.toISOString() })
    .in('id', ids);

  const locations = [...new Set(due.map((r) => r.location_id as string))];
  return { notified: ids.length, locations };
}

function parseRow(r: Record<string, unknown>): KitchenTiming {
  return {
    id:           r.id as string,
    orderId:      r.order_id as string,
    batchId:      (r.batch_id as string | null) ?? null,
    tourPickupAt: new Date(r.tour_pickup_at as string),
    cookStartAt:  new Date(r.cook_start_at as string),
    readyTarget:  new Date(r.ready_target as string),
    prepMin:      r.prep_min as number,
    bufferMin:    r.buffer_min as number,
    status:       r.status as KitchenTiming['status'],
    notifiedAt:   r.notified_at ? new Date(r.notified_at as string) : null,
  };
}
