/**
 * GET /api/delivery/admin/zonen-bestelldruck
 *   ?location_id=<uuid>
 *
 * Zonen-Bestelldruck-Monitor: Verhältnis offene Bestellungen zu aktiven Fahrern je Zone.
 *   - openOrders: Bestellungen in Status neu/bestätigt ohne Fahrerzuweisung
 *   - activeDrivers: Fahrer mit aktiver Tour in dieser Zone
 *   - pressureRatio: openOrders / max(1, activeDrivers) — >3 = hoch
 *   - alertLevel: ok / elevated / high / critical
 *
 * Phase 543
 *
 * Response: { ok, zones: ZoneBestelldruckRow[], summary: ZoneBestelldruckSummary, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type AlertLevel = 'ok' | 'elevated' | 'high' | 'critical';

export interface ZoneBestelldruckRow {
  zone: string;
  openOrders: number;
  activeDrivers: number;
  pressureRatio: number;
  alertLevel: AlertLevel;
  avgWaitMin: number | null;
}

export interface ZoneBestelldruckSummary {
  totalOpenOrders: number;
  totalActiveDrivers: number;
  criticalZones: string[];
  highZones: string[];
  overallLevel: AlertLevel;
}

export interface ZonenBestelldruckResponse {
  ok: boolean;
  zones: ZoneBestelldruckRow[];
  summary: ZoneBestelldruckSummary;
  generatedAt: string;
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

function alertLevel(ratio: number): AlertLevel {
  if (ratio >= 5) return 'critical';
  if (ratio >= 3) return 'high';
  if (ratio >= 1.5) return 'elevated';
  return 'ok';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const locationId = await resolveLocationId(req);
    if (!locationId) {
      return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
    }

    const svc = createServiceClient();
    const now = new Date();
    const since4h = new Date(now.getTime() - 4 * 3600_000).toISOString();

    type OrderRow = {
      id: string;
      status: string;
      delivery_zone: string | null;
      created_at: string;
    };

    type BatchRow = {
      id: string;
      zone: string | null;
      status: string;
    };

    // Offene Bestellungen (ohne Fahrerzuweisung)
    const { data: openOrdersData } = await svc
      .from('customer_orders')
      .select('id, status, delivery_zone, created_at')
      .eq('location_id', locationId)
      .in('status', ['neu', 'bestätigt'])
      .gte('created_at', since4h);

    // Aktive Batches/Touren je Zone
    const { data: activeBatchesData } = await svc
      .from('delivery_batches')
      .select('id, zone, status')
      .eq('location_id', locationId)
      .in('status', ['pickup', 'unterwegs', 'assigned', 'at_restaurant', 'on_route', 'pending_acceptance']);

    const openOrders = (openOrdersData as OrderRow[] | null) ?? [];
    const activeBatches = (activeBatchesData as BatchRow[] | null) ?? [];

    // Zonen aus beiden Quellen ermitteln
    const allZones = new Set<string>();
    openOrders.forEach(o => { if (o.delivery_zone) allZones.add(o.delivery_zone); });
    activeBatches.forEach(b => { if (b.zone) allZones.add(b.zone); });

    // Fallback: wenn keine Zonen, mindestens eine Zeile "Alle"
    if (allZones.size === 0) {
      const summary: ZoneBestelldruckSummary = {
        totalOpenOrders: 0,
        totalActiveDrivers: 0,
        criticalZones: [],
        highZones: [],
        overallLevel: 'ok',
      };
      return NextResponse.json<ZonenBestelldruckResponse>({
        ok: true,
        zones: [],
        summary,
        generatedAt: now.toISOString(),
      });
    }

    const zones: ZoneBestelldruckRow[] = Array.from(allZones).sort().map(zone => {
      const zoneOrders = openOrders.filter(o => o.delivery_zone === zone);
      const zoneDrivers = activeBatches.filter(b => b.zone === zone).length;
      const ratio = zoneOrders.length / Math.max(1, zoneDrivers);

      // Ø Wartezeit offener Bestellungen in dieser Zone
      const waitMins = zoneOrders
        .map(o => (now.getTime() - new Date(o.created_at).getTime()) / 60_000)
        .filter(m => m >= 0);
      const avgWaitMin = waitMins.length > 0
        ? Math.round(waitMins.reduce((a, b) => a + b, 0) / waitMins.length)
        : null;

      return {
        zone,
        openOrders: zoneOrders.length,
        activeDrivers: zoneDrivers,
        pressureRatio: Math.round(ratio * 10) / 10,
        alertLevel: alertLevel(ratio),
        avgWaitMin,
      };
    });

    const criticalZones = zones.filter(z => z.alertLevel === 'critical').map(z => z.zone);
    const highZones = zones.filter(z => z.alertLevel === 'high').map(z => z.zone);

    const worstLevel: AlertLevel =
      criticalZones.length > 0 ? 'critical' :
      highZones.length > 0 ? 'high' :
      zones.some(z => z.alertLevel === 'elevated') ? 'elevated' : 'ok';

    const summary: ZoneBestelldruckSummary = {
      totalOpenOrders: openOrders.length,
      totalActiveDrivers: activeBatches.length,
      criticalZones,
      highZones,
      overallLevel: worstLevel,
    };

    return NextResponse.json<ZonenBestelldruckResponse>({
      ok: true,
      zones,
      summary,
      generatedAt: now.toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
