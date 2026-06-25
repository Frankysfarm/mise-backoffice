/**
 * GET /api/delivery/admin/schicht-abschluss-report?location_id=...&date=YYYY-MM-DD
 *
 * Vollständige KPI-Auswertung für abgeschlossene Schicht:
 *   - Umsatz (Gesamt / Liefergebühren)
 *   - Bestellungen (gesamt / geliefert / storniert)
 *   - Ø Lieferzeit in Minuten
 *   - SLA-Einhaltung (pünktliche Lieferungen / gesamt in %)
 *   - Fahrer-Score-Zusammenfassung
 *   - Top-Zone (meiste Bestellungen)
 *   - Peak-Stunde
 *
 * Response:
 *   { ok, report: SchichtAbschlussReport }
 *
 * Multi-Tenant: alle Queries filtern location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerScoreEntry {
  driverId: string;
  driverName: string | null;
  toursAbgeschlossen: number;
  avgDeliveryMin: number | null;
  punctualityPct: number | null;
}

export interface SchichtAbschlussReport {
  date: string;
  locationId: string;
  umsatzGesamt: number;
  umsatzLiefergebuehren: number;
  bestellungenGesamt: number;
  bestellungenGeliefert: number;
  bestellungenStorniert: number;
  stornoquotePct: number;
  avgLieferzeitMin: number | null;
  slaPct: number | null;
  topZone: string | null;
  topZoneCount: number;
  peakHour: number | null;
  peakHourCount: number;
  fahrer: FahrerScoreEntry[];
  computedAt: string;
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

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  // Date: default = today UTC
  const dateParam = searchParams.get('date');
  const date = dateParam ?? new Date().toISOString().slice(0, 10);
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd   = `${date}T23:59:59.999Z`;

  const ssb = createServiceClient();

  // All orders for this location+date
  const { data: orders } = await ssb
    .from('customer_orders')
    .select(
      'id, status, total_price, delivery_fee, created_at, delivered_at, promised_delivery_at, delivery_zone, driver_id',
    )
    .eq('location_id', locationId)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  const allOrders = orders ?? [];
  const delivered = allOrders.filter((o) => o.status === 'geliefert');
  const cancelled = allOrders.filter((o) => o.status === 'storniert' || o.status === 'cancelled');

  // Financials
  const umsatzGesamt = allOrders.reduce((s, o) => s + (Number(o.total_price) || 0), 0);
  const umsatzLiefergebuehren = allOrders.reduce((s, o) => s + (Number(o.delivery_fee) || 0), 0);

  // Avg delivery time
  const deliveryTimes = delivered
    .map((o) => {
      if (!o.delivered_at || !o.created_at) return null;
      return (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60_000;
    })
    .filter((t): t is number => t !== null && t > 0);
  const avgLieferzeitMin = deliveryTimes.length > 0
    ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
    : null;

  // SLA
  const withPromise = delivered.filter((o) => !!o.promised_delivery_at && !!o.delivered_at);
  const onTime = withPromise.filter((o) => new Date(o.delivered_at!) <= new Date(o.promised_delivery_at!));
  const slaPct = withPromise.length > 0 ? Math.round((onTime.length / withPromise.length) * 100) : null;

  // Top zone
  const zoneCounts = new Map<string, number>();
  for (const o of allOrders) {
    if (o.delivery_zone) {
      zoneCounts.set(o.delivery_zone, (zoneCounts.get(o.delivery_zone) ?? 0) + 1);
    }
  }
  let topZone: string | null = null;
  let topZoneCount = 0;
  for (const [z, c] of zoneCounts) {
    if (c > topZoneCount) { topZone = z; topZoneCount = c; }
  }

  // Peak hour (by order count in that hour)
  const hourCounts = new Map<number, number>();
  for (const o of allOrders) {
    const h = new Date(o.created_at).getUTCHours();
    hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
  }
  let peakHour: number | null = null;
  let peakHourCount = 0;
  for (const [h, c] of hourCounts) {
    if (c > peakHourCount) { peakHour = h; peakHourCount = c; }
  }

  // Driver scores
  const driverIds = [...new Set(allOrders.map((o) => o.driver_id).filter(Boolean))] as string[];
  let fahrer: FahrerScoreEntry[] = [];
  if (driverIds.length > 0) {
    const { data: drivers } = await ssb
      .from('mise_drivers')
      .select('id, name')
      .in('id', driverIds);

    fahrer = (drivers ?? []).map((d) => {
      const dOrders = delivered.filter((o) => o.driver_id === d.id);
      const dTimes = dOrders
        .map((o) => {
          if (!o.delivered_at || !o.created_at) return null;
          return (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60_000;
        })
        .filter((t): t is number => t !== null && t > 0);
      const avgMin = dTimes.length > 0 ? Math.round(dTimes.reduce((a, b) => a + b, 0) / dTimes.length) : null;

      const dPromise = dOrders.filter((o) => !!o.promised_delivery_at && !!o.delivered_at);
      const dOnTime = dPromise.filter((o) => new Date(o.delivered_at!) <= new Date(o.promised_delivery_at!));
      const punct = dPromise.length > 0 ? Math.round((dOnTime.length / dPromise.length) * 100) : null;

      return {
        driverId: d.id,
        driverName: d.name ?? null,
        toursAbgeschlossen: dOrders.length,
        avgDeliveryMin: avgMin,
        punctualityPct: punct,
      };
    }).sort((a, b) => b.toursAbgeschlossen - a.toursAbgeschlossen);
  }

  const stornoquotePct = allOrders.length > 0
    ? Math.round((cancelled.length / allOrders.length) * 100)
    : 0;

  const report: SchichtAbschlussReport = {
    date,
    locationId,
    umsatzGesamt: Math.round(umsatzGesamt * 100) / 100,
    umsatzLiefergebuehren: Math.round(umsatzLiefergebuehren * 100) / 100,
    bestellungenGesamt: allOrders.length,
    bestellungenGeliefert: delivered.length,
    bestellungenStorniert: cancelled.length,
    stornoquotePct,
    avgLieferzeitMin,
    slaPct,
    topZone,
    topZoneCount,
    peakHour,
    peakHourCount,
    fahrer,
    computedAt: new Date().toISOString(),
  };

  return NextResponse.json({ ok: true, report });
}
