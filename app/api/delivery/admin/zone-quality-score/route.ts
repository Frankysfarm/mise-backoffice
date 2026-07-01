/**
 * GET /api/delivery/admin/zone-quality-score?location_id=...
 *
 * Phase 532 — Zonen-Qualitäts-Score-Karte
 * Kombinierter Qualitäts-Score je Zone: Liefertiming (40) + Kundenbewertung (35) + SLA-Compliance (25).
 * Basis: heutige abgeschlossene Lieferungen.
 *
 * Response: { ok, zones: ZoneQualityScore[], summary: ZoneQualitySummary, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type QualityLabel = 'excellent' | 'good' | 'average' | 'poor';

export interface ZoneQualityScore {
  zone: string;
  deliveryCount: number;
  avgDeliveryMinutes: number | null;
  slaCompliancePct: number | null;
  avgCustomerRating: number | null;
  timingScore: number;
  ratingScore: number;
  slaScore: number;
  qualityScore: number;
  qualityLabel: QualityLabel;
}

export interface ZoneQualitySummary {
  topZone: string | null;
  bottomZone: string | null;
  avgQualityScore: number;
  totalDeliveries: number;
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

function qualityLabel(score: number): QualityLabel {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'average';
  return 'poor';
}

// Timing score: ≤30 Min → 40, ≤45 → 30, ≤60 → 20, >60 → 10, null → 20
function timingScore(avgMin: number | null): number {
  if (avgMin === null) return 20;
  if (avgMin <= 30) return 40;
  if (avgMin <= 45) return 30;
  if (avgMin <= 60) return 20;
  return 10;
}

// Rating score: 1-5 → 0-35 linear, null → 17
function ratingScore(avg: number | null): number {
  if (avg === null) return 17;
  return Math.round(((avg - 1) / 4) * 35);
}

// SLA score: 0-100% compliance → 0-25
function slaScore(pct: number | null): number {
  if (pct === null) return 12;
  return Math.round((pct / 100) * 25);
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
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  type OrderRow = {
    delivery_zone: string | null;
    geliefert_am: string | null;
    bestellt_am: string | null;
    driver_rating: number | null;
    sla_minutes: number | null;
    status: string | null;
  };

  const { data: rows } = await ssb
    .from('customer_orders')
    .select('delivery_zone, geliefert_am, bestellt_am, driver_rating, sla_minutes, status')
    .eq('location_id', locationId)
    .eq('status', 'delivered')
    .gte('bestellt_am', todayStart.toISOString())
    .lt('bestellt_am', now.toISOString());

  const orders = (rows ?? []) as OrderRow[];

  if (orders.length === 0) {
    return NextResponse.json({
      ok: true,
      zones: [],
      summary: { topZone: null, bottomZone: null, avgQualityScore: 0, totalDeliveries: 0 },
      generatedAt: now.toISOString(),
    });
  }

  // Collect zones
  const zoneSet = new Set<string>();
  orders.forEach((o) => { if (o.delivery_zone) zoneSet.add(o.delivery_zone); });

  const zones: ZoneQualityScore[] = Array.from(zoneSet).sort().map((zone) => {
    const zoneOrders = orders.filter((o) => o.delivery_zone === zone);
    const deliveryCount = zoneOrders.length;

    // Avg delivery minutes (geliefert_am - bestellt_am)
    const deliveryMins = zoneOrders
      .filter((o) => o.geliefert_am && o.bestellt_am)
      .map((o) => (new Date(o.geliefert_am!).getTime() - new Date(o.bestellt_am!).getTime()) / 60_000);

    const avgDeliveryMinutes =
      deliveryMins.length > 0
        ? Math.round((deliveryMins.reduce((s, m) => s + m, 0) / deliveryMins.length) * 10) / 10
        : null;

    // SLA compliance (delivered within sla_minutes)
    const slaOrders = zoneOrders.filter((o) => o.sla_minutes !== null && o.geliefert_am && o.bestellt_am);
    let slaCompliancePct: number | null = null;
    if (slaOrders.length > 0) {
      const compliant = slaOrders.filter((o) => {
        const actualMin = (new Date(o.geliefert_am!).getTime() - new Date(o.bestellt_am!).getTime()) / 60_000;
        return actualMin <= (o.sla_minutes ?? 9999);
      }).length;
      slaCompliancePct = Math.round((compliant / slaOrders.length) * 100);
    }

    // Avg customer rating
    const ratedOrders = zoneOrders.filter((o) => o.driver_rating !== null);
    const avgCustomerRating =
      ratedOrders.length > 0
        ? Math.round((ratedOrders.reduce((s, o) => s + (o.driver_rating ?? 0), 0) / ratedOrders.length) * 10) / 10
        : null;

    const ts = timingScore(avgDeliveryMinutes);
    const rs = ratingScore(avgCustomerRating);
    const ss = slaScore(slaCompliancePct);
    const qualityScore = ts + rs + ss;

    return {
      zone,
      deliveryCount,
      avgDeliveryMinutes,
      slaCompliancePct,
      avgCustomerRating,
      timingScore: ts,
      ratingScore: rs,
      slaScore: ss,
      qualityScore,
      qualityLabel: qualityLabel(qualityScore),
    };
  });

  // Sort by qualityScore descending
  zones.sort((a, b) => b.qualityScore - a.qualityScore);

  const avgQualityScore =
    zones.length > 0
      ? Math.round(zones.reduce((s, z) => s + z.qualityScore, 0) / zones.length)
      : 0;

  const summary: ZoneQualitySummary = {
    topZone: zones[0]?.zone ?? null,
    bottomZone: zones[zones.length - 1]?.zone ?? null,
    avgQualityScore,
    totalDeliveries: orders.length,
  };

  return NextResponse.json({ ok: true, zones, summary, generatedAt: now.toISOString() });
}
