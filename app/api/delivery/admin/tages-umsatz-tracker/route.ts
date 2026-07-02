/**
 * GET /api/delivery/admin/tages-umsatz-tracker
 *   ?location_id=<uuid>
 *
 * Tages-Umsatz-Tracker: Intraday-Umsatz-Fortschritt vs. Vortagsvergleich.
 *   - umsatzHeute: Summe gesamtbetrag aller nicht-stornierten Lieferbestellungen heute
 *   - umsatzGestern: Gleicher Zeitraum gestern (bis zur aktuellen Uhrzeit)
 *   - stunden: Stundenbuckets 0–23 (abgeschlossene + aktuelle Stunde) mit Umsatz
 *   - trend: up/down/flat vs. gestern
 *   - projektionTagesende: Hochrechnung auf 22 Uhr basierend auf bisherigem Trend
 *
 * Phase 544
 *
 * Response: { ok, umsatzHeute, umsatzGestern, trendPct, projektionTagesende, stunden, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface UmsatzStundeBucket {
  hour: number;
  label: string;
  umsatz: number;
  bestellungen: number;
  isCurrent: boolean;
}

export interface TagesUmsatzResponse {
  ok: boolean;
  umsatzHeute: number;
  umsatzGestern: number;
  trendPct: number; // +/- Prozent vs. gestern (selber Zeitraum)
  projektionTagesende: number | null;
  stunden: UmsatzStundeBucket[];
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

type OrderRow = {
  gesamtbetrag: number | null;
  created_at: string;
};

function buildHourBuckets(orders: OrderRow[], dayStart: Date, currentHour: number): UmsatzStundeBucket[] {
  const buckets: UmsatzStundeBucket[] = [];
  for (let h = 10; h <= 22; h++) {
    const hourStart = new Date(dayStart);
    hourStart.setUTCHours(h, 0, 0, 0);
    const hourEnd = new Date(hourStart.getTime() + 3600_000);

    const hourOrders = orders.filter(o => {
      const t = new Date(o.created_at).getTime();
      return t >= hourStart.getTime() && t < hourEnd.getTime();
    });
    const umsatz = hourOrders.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);

    buckets.push({
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      umsatz: Math.round(umsatz * 100) / 100,
      bestellungen: hourOrders.length,
      isCurrent: h === currentHour,
    });
  }
  return buckets;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const locationId = await resolveLocationId(req);
    if (!locationId) {
      return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
    }

    const svc = createServiceClient();
    const now = new Date();
    const currentHour = now.getUTCHours();

    // Tagesbeginn heute (UTC 00:00)
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 24 * 3600_000);

    // Gleiches Fenster gestern (bis zur aktuellen Zeit, nicht Tagesende)
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 3600_000);
    const yesterdayCutoff = new Date(now.getTime() - 24 * 3600_000);

    const [{ data: todayData }, { data: yesterdayData }] = await Promise.all([
      svc
        .from('customer_orders')
        .select('gesamtbetrag, created_at')
        .eq('location_id', locationId)
        .eq('lieferart', 'delivery')
        .neq('status', 'storniert')
        .gte('created_at', todayStart.toISOString())
        .lt('created_at', todayEnd.toISOString()),
      svc
        .from('customer_orders')
        .select('gesamtbetrag, created_at')
        .eq('location_id', locationId)
        .eq('lieferart', 'delivery')
        .neq('status', 'storniert')
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', yesterdayCutoff.toISOString()),
    ]);

    const todayOrders = (todayData as OrderRow[] | null) ?? [];
    const yesterdayOrders = (yesterdayData as OrderRow[] | null) ?? [];

    const umsatzHeute = Math.round(
      todayOrders.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0) * 100,
    ) / 100;

    const umsatzGestern = Math.round(
      yesterdayOrders.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0) * 100,
    ) / 100;

    const trendPct = umsatzGestern > 0
      ? Math.round(((umsatzHeute - umsatzGestern) / umsatzGestern) * 1000) / 10
      : 0;

    // Projektion auf 22 Uhr: Ø Umsatz/h der letzten 2 abgeschlossenen Stunden × verbleibende Stunden
    const completedHours = Math.max(0, currentHour - 10); // ab 10 Uhr
    let projektionTagesende: number | null = null;
    if (completedHours >= 2 && currentHour < 22) {
      const twoHourStart = new Date(now.getTime() - 2 * 3600_000);
      const recentOrders = todayOrders.filter(
        o => new Date(o.created_at).getTime() >= twoHourStart.getTime(),
      );
      const avgPerHour = recentOrders.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0) / 2;
      const hoursRemaining = 22 - currentHour;
      projektionTagesende = Math.round((umsatzHeute + avgPerHour * hoursRemaining) * 100) / 100;
    }

    const stunden = buildHourBuckets(todayOrders, todayStart, currentHour);

    return NextResponse.json<TagesUmsatzResponse>({
      ok: true,
      umsatzHeute,
      umsatzGestern,
      trendPct,
      projektionTagesende,
      stunden,
      generatedAt: now.toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
