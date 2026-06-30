/**
 * GET /api/delivery/admin/kitchen-prioritaet?location_id=...
 *
 * Phase 526 — Küchen-Priorisierungs-Engine
 * Welche Bestellungen sollte die Küche JETZT priorisieren?
 * Basis: Wartezeit + Fahrer-ETA + Batch-Startzeit + Bestellpriorität.
 *
 * Response: { ok, orders: PrioOrder[], generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';

export interface PrioOrder {
  orderId: string;
  bestellnummer: string | null;
  kundeName: string | null;
  itemCount: number;
  status: string;
  priorityScore: number;
  urgencyLevel: UrgencyLevel;
  reasonLabel: string;
  batchStartsInMin: number | null;
  driverEtaMin: number | null;
  waitSinceMin: number;
  zone: string | null;
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

function urgencyFromScore(score: number): UrgencyLevel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function reasonLabel(waitMin: number, batchInMin: number | null, etaMin: number | null): string {
  if (batchInMin !== null && batchInMin <= 5)  return 'Fahrer kommt in <5 Min';
  if (etaMin !== null && etaMin <= 8)           return `Fahrer ETA ${etaMin} Min`;
  if (waitMin >= 25)                            return `${waitMin} Min Wartezeit`;
  if (waitMin >= 15)                            return 'Lange Wartezeit';
  if (batchInMin !== null && batchInMin <= 15) return `Batch in ${batchInMin} Min`;
  return 'Normale Priorität';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();
  const now = new Date();
  const since4h = new Date(now.getTime() - 4 * 3_600_000);

  // Aktive Bestellungen (noch nicht geliefert/storniert)
  const ACTIVE_STATUSES = ['neu', 'new', 'bestätigt', 'confirmed', 'offen', 'pending',
                           'in_zubereitung', 'preparing', 'in_preparation', 'fertig', 'ready', 'bereit'];

  const { data: orderRows } = await ssb
    .from('customer_orders')
    .select('id, bestellnummer, kunde_name, status, bestellt_am, delivery_zone, priority, gesamtbetrag')
    .eq('location_id', locationId)
    .in('status', ACTIVE_STATUSES)
    .gte('bestellt_am', since4h.toISOString());

  const orders = (orderRows ?? []) as {
    id: string;
    bestellnummer: string | null;
    kunde_name: string | null;
    status: string;
    bestellt_am: string | null;
    delivery_zone: string | null;
    priority: string | null;
    gesamtbetrag: number | null;
  }[];

  if (orders.length === 0) {
    return NextResponse.json({ ok: true, orders: [], generatedAt: now.toISOString() });
  }

  // Aktive Batches: startzeit + driver ETA
  const { data: batchRows } = await ssb
    .from('mise_delivery_batches')
    .select('id, startzeit, total_eta_min, driver_id')
    .eq('location_id', locationId)
    .not('status', 'in', '("abgeschlossen","completed","abgebrochen","cancelled")');

  const batches = (batchRows ?? []) as {
    id: string;
    startzeit: string | null;
    total_eta_min: number | null;
    driver_id: string | null;
  }[];

  // Batch-Stops: welche Bestellungen sind in einem aktiven Batch?
  const batchIds = batches.map((b) => b.id);
  let batchStopRows: { batch_id: string; order_id: string }[] = [];
  if (batchIds.length > 0) {
    const { data } = await ssb
      .from('mise_delivery_batch_stops')
      .select('batch_id, order_id')
      .in('batch_id', batchIds);
    batchStopRows = (data ?? []) as typeof batchStopRows;
  }

  // Bestellpositionen: Anzahl Items je Bestellung
  const orderIds = orders.map((o) => o.id);
  const { data: itemRows } = await ssb
    .from('customer_order_items')
    .select('order_id, quantity')
    .in('order_id', orderIds);

  const itemCountMap = new Map<string, number>();
  for (const item of (itemRows ?? []) as { order_id: string; quantity: number }[]) {
    itemCountMap.set(item.order_id, (itemCountMap.get(item.order_id) ?? 0) + (item.quantity ?? 1));
  }

  // Prioritäts-Score berechnen
  const prios: PrioOrder[] = orders.map((order) => {
    const waitMs = order.bestellt_am ? now.getTime() - new Date(order.bestellt_am).getTime() : 0;
    const waitMin = Math.round(waitMs / 60_000);

    // Fahrer-Batch für diese Bestellung
    const batchStop = batchStopRows.find((s) => s.order_id === order.id);
    const batch = batchStop ? batches.find((b) => b.id === batchStop.batch_id) : null;

    let batchStartsInMin: number | null = null;
    let driverEtaMin: number | null = null;
    if (batch) {
      if (batch.startzeit) {
        batchStartsInMin = Math.round((new Date(batch.startzeit).getTime() - now.getTime()) / 60_000);
        if (batchStartsInMin < 0) batchStartsInMin = 0;
      }
      driverEtaMin = batch.total_eta_min ?? null;
    }

    // Score: 0–100
    // Wartezeit: 0–40 Punkte (1 Punkt je Minute bis 40 Min)
    const waitScore = Math.min(40, waitMin);

    // Fahrer-Imminent: 0–40 Punkte
    let driverScore = 0;
    if (batchStartsInMin !== null && batchStartsInMin <= 5)  driverScore = 40;
    else if (batchStartsInMin !== null && batchStartsInMin <= 10) driverScore = 30;
    else if (batchStartsInMin !== null && batchStartsInMin <= 15) driverScore = 20;
    else if (driverEtaMin !== null && driverEtaMin <= 8) driverScore = 35;
    else if (driverEtaMin !== null && driverEtaMin <= 15) driverScore = 20;

    // Hochpriorität-Bestellung: 0–20 Punkte
    const prioScore = order.priority === 'high' || order.priority === 'hoch' ? 20
                    : order.priority === 'medium' || order.priority === 'mittel' ? 10
                    : 0;

    const priorityScore = Math.min(100, waitScore + driverScore + prioScore);
    const urgencyLevel = urgencyFromScore(priorityScore);
    const itemCount = itemCountMap.get(order.id) ?? 0;

    return {
      orderId: order.id,
      bestellnummer: order.bestellnummer,
      kundeName: order.kunde_name,
      itemCount,
      status: order.status,
      priorityScore,
      urgencyLevel,
      reasonLabel: reasonLabel(waitMin, batchStartsInMin, driverEtaMin),
      batchStartsInMin,
      driverEtaMin,
      waitSinceMin: waitMin,
      zone: order.delivery_zone,
    };
  });

  // Sortiert nach Score absteigend
  prios.sort((a, b) => b.priorityScore - a.priorityScore);

  return NextResponse.json({ ok: true, orders: prios.slice(0, 20), generatedAt: now.toISOString() });
}
