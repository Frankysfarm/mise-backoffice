/**
 * GET /api/delivery/admin/fahrer-performance-rangliste?location_id=...&days=7
 *
 * Phase 814 — Fahrer-Performance-Rangliste-API
 * Top-Fahrer-Ranking kombinierter Score: Pünktlichkeit 40%, Bewertung 40%, Touren-Volumen 20%
 * Letzte 7 Tage (konfigurierbar via ?days=)
 *
 * Response: { ok, drivers: DriverRank[], generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface DriverRank {
  driverId: string;
  name: string;
  score: number;           // 0–100 kombiniert
  puenktlichkeit: number;  // 0–100
  rating: number;          // 0–5
  touren: number;
  trend: 'up' | 'down' | 'stable';
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

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const days = Math.min(30, Math.max(1, parseInt(searchParams.get('days') ?? '7', 10)));
  const ssb = createServiceClient();
  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000);
  const prevSince = new Date(since.getTime() - days * 86_400_000);

  // Alle Fahrer der Location
  const { data: driverRows } = await ssb
    .from('delivery_drivers')
    .select('id, name')
    .eq('location_id', locationId);

  const allDrivers = (driverRows ?? []) as { id: string; name: string }[];
  if (allDrivers.length === 0) {
    return NextResponse.json({ ok: true, drivers: [], generatedAt: now.toISOString() });
  }

  // Abgeschlossene Touren im Zeitraum
  const { data: batchRows } = await ssb
    .from('mise_delivery_batches')
    .select('id, driver_id, started_at, completed_at, status')
    .eq('location_id', locationId)
    .in('status', ['abgeschlossen', 'completed'])
    .gte('completed_at', since.toISOString());

  const batches = (batchRows ?? []) as {
    id: string;
    driver_id: string | null;
    started_at: string | null;
    completed_at: string | null;
    status: string;
  }[];

  // Vorperiode Touren für Trend
  const { data: prevBatchRows } = await ssb
    .from('mise_delivery_batches')
    .select('id, driver_id')
    .eq('location_id', locationId)
    .in('status', ['abgeschlossen', 'completed'])
    .gte('completed_at', prevSince.toISOString())
    .lt('completed_at', since.toISOString());

  const prevBatches = (prevBatchRows ?? []) as { id: string; driver_id: string | null }[];

  // Bewertungen der Fahrer (letzte N Tage)
  const { data: reviewRows } = await ssb
    .from('customer_order_reviews')
    .select('driver_id, rating')
    .eq('location_id', locationId)
    .gte('created_at', since.toISOString())
    .not('driver_id', 'is', null);

  const reviews = (reviewRows ?? []) as { driver_id: string; rating: number }[];

  // Pünktlichkeit: Stopps mit tatsächlicher vs. geplanter Lieferzeit
  const batchIds = batches.map((b) => b.id);
  let stops: { batch_id: string; geliefert_am: string | null; eta: string | null }[] = [];

  if (batchIds.length > 0) {
    const { data: stopRows } = await ssb
      .from('mise_delivery_stops')
      .select('batch_id, geliefert_am, eta')
      .in('batch_id', batchIds)
      .not('geliefert_am', 'is', null);

    stops = (stopRows ?? []) as typeof stops;
  }

  const drivers: DriverRank[] = allDrivers.map((d) => {
    const myBatches = batches.filter((b) => b.driver_id === d.id);
    const myPrevBatches = prevBatches.filter((b) => b.driver_id === d.id);
    const touren = myBatches.length;

    // Pünktlichkeit
    const myStops = stops.filter((s) => myBatches.some((b) => b.id === s.batch_id));
    let puenktlichkeit = 85; // Fallback
    if (myStops.length > 0) {
      const onTime = myStops.filter((s) => {
        if (!s.eta || !s.geliefert_am) return true;
        return new Date(s.geliefert_am) <= new Date(s.eta);
      }).length;
      puenktlichkeit = Math.round((onTime / myStops.length) * 100);
    }

    // Bewertung
    const myReviews = reviews.filter((r) => r.driver_id === d.id);
    const rating = myReviews.length > 0
      ? Math.round((myReviews.reduce((acc, r) => acc + r.rating, 0) / myReviews.length) * 10) / 10
      : 4.5; // Fallback

    // Kombinierter Score
    const ratingNorm = Math.min(100, (rating / 5) * 100);
    const tourNorm = Math.min(100, (touren / Math.max(1, Math.max(...allDrivers.map(
      (x) => batches.filter((b) => b.driver_id === x.id).length
    )))) * 100);
    const score = Math.round(puenktlichkeit * 0.4 + ratingNorm * 0.4 + tourNorm * 0.2);

    // Trend: Vergleich Touren aktuell vs. Vorperiode
    const prevTouren = myPrevBatches.length;
    const trend: 'up' | 'down' | 'stable' =
      touren > prevTouren + 1 ? 'up' :
      touren < prevTouren - 1 ? 'down' : 'stable';

    return { driverId: d.id, name: d.name, score, puenktlichkeit, rating, touren, trend };
  });

  // Nach Score absteigend sortieren
  drivers.sort((a, b) => b.score - a.score);

  return NextResponse.json({ ok: true, drivers, generatedAt: now.toISOString() });
}
