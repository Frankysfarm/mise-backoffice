/**
 * GET /api/delivery/admin/smart-batch-priority
 *
 * Automatische Batch-Priorisierung basierend auf:
 *  - Wartezeit in Minuten (seit Batch-Erstellung)
 *  - Fahrer-Verfügbarkeit (kein Fahrer = höhere Prio)
 *  - Zonen-Dringlichkeit (A=höchste Prio)
 *  - Bestellanzahl im Batch
 *
 * Response: PrioritizedBatch[]
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type BatchPriority = 'kritisch' | 'dringend' | 'normal';

export interface PrioritizedBatch {
  id: string;
  bestellnummer: string | null;
  zone: string | null;
  status: string;
  driverName: string | null;
  driverAssigned: boolean;
  orderCount: number;
  waitMin: number;
  priorityScore: number;
  priority: BatchPriority;
  createdAt: string;
}

function calcPriority(score: number): BatchPriority {
  if (score >= 60) return 'kritisch';
  if (score >= 30) return 'dringend';
  return 'normal';
}

function zonePriorityBonus(zone: string | null): number {
  if (!zone) return 0;
  const z = zone.toUpperCase();
  if (z === 'A') return 20;
  if (z === 'B') return 12;
  if (z === 'C') return 6;
  return 3;
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const params = new URL(req.url).searchParams;
  let locationId = params.get('location_id');

  if (!locationId) {
    const { data: emp } = await sb
      .from('employees')
      .select('location_id')
      .eq('auth_user_id', user.id)
      .single();
    locationId = (emp?.location_id as string | null) ?? null;
  }

  if (!locationId) return NextResponse.json({ error: 'Kein Standort' }, { status: 400 });

  const openStatuses = ['offen', 'bereit', 'pending', 'assigned', 'pickup'];

  const { data: batches, error } = await sb
    .from('delivery_batches')
    .select(`
      id,
      bestellnummer,
      zone,
      status,
      created_at,
      driver_id,
      drivers ( name )
    `)
    .eq('location_id', locationId)
    .in('status', openStatuses)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const result: PrioritizedBatch[] = (batches ?? []).map((b) => {
    const createdMs = b.created_at ? new Date(b.created_at).getTime() : now;
    const waitMin = Math.round((now - createdMs) / 60_000);
    const driverAssigned = !!b.driver_id;
    const driverName = (b.drivers as unknown as { name: string } | null)?.name ?? null;

    // Count orders associated with this batch
    const orderCount = 1; // will be enriched below

    const score =
      Math.min(waitMin * 2, 50) +
      (driverAssigned ? 0 : 30) +
      zonePriorityBonus(b.zone as string | null);

    return {
      id: b.id as string,
      bestellnummer: b.bestellnummer as string | null,
      zone: b.zone as string | null,
      status: b.status as string,
      driverName,
      driverAssigned,
      orderCount,
      waitMin,
      priorityScore: score,
      priority: calcPriority(score),
      createdAt: b.created_at as string,
    };
  });

  // Enrich with order counts from tour_stops
  const batchIds = result.map((b) => b.id);
  if (batchIds.length > 0) {
    const { data: stops } = await sb
      .from('tour_stops')
      .select('batch_id')
      .in('batch_id', batchIds);

    const countMap = new Map<string, number>();
    for (const s of stops ?? []) {
      const bid = s.batch_id as string;
      countMap.set(bid, (countMap.get(bid) ?? 0) + 1);
    }
    for (const b of result) {
      b.orderCount = countMap.get(b.id) ?? 1;
    }
  }

  result.sort((a, b) => b.priorityScore - a.priorityScore);

  return NextResponse.json({ batches: result, total: result.length });
}
