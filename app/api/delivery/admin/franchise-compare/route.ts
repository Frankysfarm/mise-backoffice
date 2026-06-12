/**
 * GET /api/delivery/admin/franchise-compare
 *
 * Franchise-Vergleichs-Dashboard — liefert KPIs über alle Locations eines Tenants.
 * Kombiniert Realtime-Status + SLA-Metriken + Kundenbewertungen pro Location.
 * Geeignet für 30-Sekunden-Polling.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getFranchiseSummary, type LocationRealtimeStatus } from '@/lib/delivery/franchise';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface LocationCompareRow extends LocationRealtimeStatus {
  on_time_rate: number | null;
  avg_rating: number | null;
  total_ratings: number;
  revenue_today: number;
  rank: number;
}

export interface FranchiseCompareResponse {
  locations: LocationCompareRow[];
  tenant_id: string;
  generated_at: string;
  totals: {
    locations: number;
    queue_total: number;
    tours_total: number;
    completed_today: number;
    critical_alerts: number;
  };
}

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const svc = createServiceClient();

  // Tenant-ID über employees ermitteln
  const { data: emp } = await svc
    .from('employees')
    .select('tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!emp?.tenant_id) {
    return NextResponse.json({ error: 'Tenant nicht gefunden' }, { status: 403 });
  }

  const tenantId = emp.tenant_id as string;

  // Alle Locations des Tenants laden
  const { data: locationRows } = await svc
    .from('locations')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  const locationIds: string[] = (locationRows ?? []).map((l) => l.id as string);
  if (!locationIds.length) {
    return NextResponse.json<FranchiseCompareResponse>({
      locations: [],
      tenant_id: tenantId,
      generated_at: new Date().toISOString(),
      totals: { locations: 0, queue_total: 0, tours_total: 0, completed_today: 0, critical_alerts: 0 },
    });
  }

  // Realtime-Summary + SLA + Bewertungen + Umsatz parallel laden
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [summaryResult, perfResults, ratingResults, revenueResults] = await Promise.allSettled([
    getFranchiseSummary(tenantId),

    // SLA on-time-rate: letzte 30 abgeschlossene Lieferungen pro Location
    Promise.all(
      locationIds.map(async (lid) => {
        const { data } = await svc
          .from('delivery_performance')
          .select('on_time')
          .eq('location_id', lid)
          .order('recorded_at', { ascending: false })
          .limit(30);
        const rows = data ?? [];
        if (rows.length < 5) return { location_id: lid, on_time_rate: null };
        const rate = (rows.filter((r) => r.on_time === true).length / rows.length) * 100;
        return { location_id: lid, on_time_rate: Math.round(rate * 10) / 10 };
      }),
    ),

    // Kundenbewertungen: letzter 14 Tage
    Promise.all(
      locationIds.map(async (lid) => {
        const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
        const { data } = await svc
          .from('customer_delivery_ratings')
          .select('rating')
          .eq('location_id', lid)
          .gte('created_at', since);
        const rows = data ?? [];
        const avg = rows.length > 0
          ? Math.round((rows.reduce((s, r) => s + (r.rating as number), 0) / rows.length) * 100) / 100
          : null;
        return { location_id: lid, avg_rating: avg, total_ratings: rows.length };
      }),
    ),

    // Umsatz heute
    Promise.all(
      locationIds.map(async (lid) => {
        const { data } = await svc
          .from('customer_orders')
          .select('gesamtbetrag')
          .eq('location_id', lid)
          .in('status', ['geliefert', 'abgeholt', 'abgeschlossen'])
          .gte('created_at', todayStart.toISOString());
        const rows = data ?? [];
        const rev = rows.reduce((s, r) => s + ((r.gesamtbetrag as number | null) ?? 0), 0);
        return { location_id: lid, revenue_today: Math.round(rev * 100) / 100 };
      }),
    ),
  ]);

  const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
  const perfMap = new Map<string, number | null>();
  if (perfResults.status === 'fulfilled') {
    for (const p of perfResults.value) perfMap.set(p.location_id, p.on_time_rate);
  }
  const ratingMap = new Map<string, { avg_rating: number | null; total_ratings: number }>();
  if (ratingResults.status === 'fulfilled') {
    for (const r of ratingResults.value) ratingMap.set(r.location_id, { avg_rating: r.avg_rating, total_ratings: r.total_ratings });
  }
  const revenueMap = new Map<string, number>();
  if (revenueResults.status === 'fulfilled') {
    for (const r of revenueResults.value) revenueMap.set(r.location_id, r.revenue_today);
  }

  // Realtime-Status mit SLA/Bewertungen mergen
  const realtimeLocations: LocationRealtimeStatus[] = summary?.locations ?? locationIds.map((id) => ({
    location_id: id,
    location_name: locationRows?.find((l) => l.id === id)?.name ?? id,
    queue_depth: 0,
    active_tours: 0,
    cooking_now: 0,
    oldest_queued_min: null,
    completed_today: 0,
    active_alerts: 0,
    critical_alerts: 0,
    health: 'ok' as const,
  }));

  // Composite performance score (höher = besser)
  function scoreLocation(loc: LocationRealtimeStatus, onTime: number | null, avgRating: number | null): number {
    let score = 0;
    if (onTime !== null) score += onTime * 0.5;          // 50% Gewichtung SLA
    if (avgRating !== null) score += (avgRating / 5) * 100 * 0.3; // 30% Bewertung
    if (loc.completed_today > 0) score += Math.min(loc.completed_today * 2, 20); // 20% Durchsatz (max 10 Lieferungen)
    return Math.round(score);
  }

  const enriched: LocationCompareRow[] = realtimeLocations.map((loc, i) => ({
    ...loc,
    on_time_rate:   perfMap.get(loc.location_id) ?? null,
    avg_rating:     ratingMap.get(loc.location_id)?.avg_rating ?? null,
    total_ratings:  ratingMap.get(loc.location_id)?.total_ratings ?? 0,
    revenue_today:  revenueMap.get(loc.location_id) ?? 0,
    rank:           i + 1, // vorläufig
  }));

  // Nach Performance-Score sortieren (absteigend)
  enriched.sort((a, b) =>
    scoreLocation(b, b.on_time_rate, b.avg_rating) - scoreLocation(a, a.on_time_rate, a.avg_rating),
  );
  enriched.forEach((loc, i) => { loc.rank = i + 1; });

  const totals: FranchiseCompareResponse['totals'] = {
    locations:       enriched.length,
    queue_total:     enriched.reduce((s, l) => s + l.queue_depth, 0),
    tours_total:     enriched.reduce((s, l) => s + l.active_tours, 0),
    completed_today: enriched.reduce((s, l) => s + l.completed_today, 0),
    critical_alerts: enriched.reduce((s, l) => s + l.critical_alerts, 0),
  };

  return NextResponse.json<FranchiseCompareResponse>({
    locations: enriched,
    tenant_id: tenantId,
    generated_at: new Date().toISOString(),
    totals,
  });
}
