/**
 * GET /api/delivery/admin/zonen-auslastung-snapshot
 *   ?location_id=<uuid>
 *
 * Stündliche Auslastung der Zonen A/B/C/D:
 * - Aktive Touren je Zone
 * - Offene Bestellungen je Zone
 * - Auslastungs-Level: idle / low / medium / high / critical
 *
 * Phase 583
 *
 * Response: { ok, zones: ZoneSnapshot[], generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type ZoneAuslastungLevel = 'idle' | 'low' | 'medium' | 'high' | 'critical';

export interface ZoneSnapshot {
  zone: string;
  activeToursCount: number;
  pendingOrdersCount: number;
  inTransitCount: number;
  auslastungLevel: ZoneAuslastungLevel;
  auslastungPct: number;
}

export interface ZonenAuslastungSnapshotResponse {
  ok: boolean;
  zones: ZoneSnapshot[];
  totalActive: number;
  totalPending: number;
  generatedAt: string;
}

const ZONES = ['A', 'B', 'C', 'D'] as const;
type Zone = typeof ZONES[number];

function toLevel(pending: number, inTransit: number): ZoneAuslastungLevel {
  const total = pending + inTransit;
  if (total === 0) return 'idle';
  if (total <= 2) return 'low';
  if (total <= 5) return 'medium';
  if (total <= 8) return 'high';
  return 'critical';
}

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const param = new URL(req.url).searchParams.get('location_id');
  if (param) return param;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (emp as { location_id: string } | null)?.location_id ?? null;
}

type BatchRow = { zone: string | null; status: string };
type OrderRow = { delivery_zone: string | null; status: string };

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const locationId = await resolveLocationId(req);
    if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

    const svc = createServiceClient();

    const [{ data: rawBatches }, { data: rawOrders }] = await Promise.all([
      svc
        .from('delivery_batches')
        .select('zone, status')
        .eq('location_id', locationId)
        .in('status', ['pending', 'active', 'in_progress', 'on_the_way']),

      svc
        .from('customer_orders')
        .select('delivery_zone, status')
        .eq('location_id', locationId)
        .eq('typ', 'delivery')
        .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'bereit', 'unterwegs']),
    ]);

    const batches = (rawBatches ?? []) as BatchRow[];
    const orders  = (rawOrders  ?? []) as OrderRow[];

    const activeByZone  = new Map<Zone, number>();
    const pendingByZone = new Map<Zone, number>();
    const inTransitByZone = new Map<Zone, number>();
    for (const z of ZONES) {
      activeByZone.set(z, 0);
      pendingByZone.set(z, 0);
      inTransitByZone.set(z, 0);
    }

    for (const b of batches) {
      const z = (b.zone ?? '').toUpperCase() as Zone;
      if (!ZONES.includes(z)) continue;
      activeByZone.set(z, (activeByZone.get(z) ?? 0) + 1);
      if (b.status === 'on_the_way' || b.status === 'in_progress' || b.status === 'active') {
        inTransitByZone.set(z, (inTransitByZone.get(z) ?? 0) + 1);
      }
    }

    for (const o of orders) {
      const z = (o.delivery_zone ?? '').toUpperCase() as Zone;
      if (!ZONES.includes(z)) continue;
      if (o.status !== 'unterwegs') {
        pendingByZone.set(z, (pendingByZone.get(z) ?? 0) + 1);
      } else {
        inTransitByZone.set(z, (inTransitByZone.get(z) ?? 0) + 1);
      }
    }

    const maxDemand = Math.max(
      1,
      ...ZONES.map(z => (pendingByZone.get(z) ?? 0) + (inTransitByZone.get(z) ?? 0)),
    );

    const zones: ZoneSnapshot[] = ZONES.map(z => {
      const pending   = pendingByZone.get(z)   ?? 0;
      const inTransit = inTransitByZone.get(z) ?? 0;
      const active    = activeByZone.get(z)    ?? 0;
      const total     = pending + inTransit;
      return {
        zone: z,
        activeToursCount: active,
        pendingOrdersCount: pending,
        inTransitCount: inTransit,
        auslastungLevel: toLevel(pending, inTransit),
        auslastungPct: Math.round((total / maxDemand) * 100),
      };
    });

    const totalActive  = zones.reduce((a, z) => a + z.activeToursCount, 0);
    const totalPending = zones.reduce((a, z) => a + z.pendingOrdersCount, 0);

    const response: ZonenAuslastungSnapshotResponse = {
      ok: true,
      zones,
      totalActive,
      totalPending,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[zonen-auslastung-snapshot]', err);
    return NextResponse.json({ ok: false, error: 'Interner Fehler' }, { status: 500 });
  }
}
