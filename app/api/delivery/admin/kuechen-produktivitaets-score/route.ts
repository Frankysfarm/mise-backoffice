/**
 * GET /api/delivery/admin/kuechen-produktivitaets-score
 *   ?location_id=<uuid>
 *
 * Echtzeit-Produktivitäts-Score der Küche (0–100):
 *   - Durchsatz-Score (0–40): Bestellungen letzte 60 Min vs. historischer Schnitt
 *   - Queue-Health-Score (0–30): Anteil überfälliger Bestellungen (>8 Min in Warteschlange)
 *   - Timing-Score (0–30): Anteil pünktlich fertiggestellter Bestellungen
 *
 * Phase 542
 *
 * Response: { ok, score, label, factors, trend, recommendation, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface KitchenProduktivitaetsFaktoren {
  throughputScore: number; // 0–40
  queueHealthScore: number; // 0–30
  timingScore: number; // 0–30
  ordersLast60Min: number;
  historicAvgPerHour: number;
  overdueCount: number;
  totalActiveCount: number;
  onTimePct: number;
}

export interface KitchenProduktivitaetsResponse {
  ok: boolean;
  score: number; // 0–100
  label: 'exzellent' | 'gut' | 'mittel' | 'schwach';
  factors: KitchenProduktivitaetsFaktoren;
  trend: 'up' | 'down' | 'flat';
  recommendation: string;
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

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const locationId = await resolveLocationId(req);
    if (!locationId) {
      return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });
    }

    const svc = createServiceClient();
    const now = new Date();
    const since60m = new Date(now.getTime() - 60 * 60_000).toISOString();
    const since7d = new Date(now.getTime() - 7 * 24 * 3600_000).toISOString();

    type OrderRow = {
      id: string;
      status: string;
      created_at: string;
      geschaetzte_zubereitung_min: number | null;
      tatsaechliche_zubereitung_min: number | null;
    };

    // Bestellungen letzte 60 Min für Durchsatz
    const { data: recentOrders } = await svc
      .from('customer_orders')
      .select('id, status, created_at, geschaetzte_zubereitung_min, tatsaechliche_zubereitung_min')
      .eq('location_id', locationId)
      .gte('created_at', since60m)
      .neq('status', 'storniert');

    const recent = (recentOrders as OrderRow[] | null) ?? [];
    const ordersLast60Min = recent.length;

    // Aktive Bestellungen (in Warteschlange oder Zubereitung)
    const active = recent.filter(o =>
      ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status),
    );
    const overdue = active.filter(o => {
      const ageMin = (now.getTime() - new Date(o.created_at).getTime()) / 60_000;
      return ageMin > 8;
    });

    // Historischer Schnitt: gleiche Stunde in den letzten 7 Tagen
    const currentHour = now.getUTCHours();
    const { data: historicOrders } = await svc
      .from('customer_orders')
      .select('id, created_at')
      .eq('location_id', locationId)
      .gte('created_at', since7d)
      .neq('status', 'storniert');

    const historic = (historicOrders as { id: string; created_at: string }[] | null) ?? [];
    const sameHourCounts: number[] = [];
    for (let d = 1; d <= 7; d++) {
      const dayStart = new Date(now.getTime() - d * 24 * 3600_000);
      dayStart.setUTCHours(currentHour, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 3600_000);
      const count = historic.filter(o => {
        const t = new Date(o.created_at).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      }).length;
      sameHourCounts.push(count);
    }
    const historicAvgPerHour =
      sameHourCounts.length > 0
        ? Math.round(sameHourCounts.reduce((a, b) => a + b, 0) / sameHourCounts.length)
        : 0;

    // Pünktlichkeits-Quote: abgeschlossene Bestellungen wo tatsaechlich <= geschaetzt
    const finished = recent.filter(o => o.status === 'fertig' || o.status === 'geliefert');
    const onTimeOrders = finished.filter(o => {
      if (!o.tatsaechliche_zubereitung_min || !o.geschaetzte_zubereitung_min) return true;
      return o.tatsaechliche_zubereitung_min <= o.geschaetzte_zubereitung_min * 1.1; // 10% Toleranz
    });
    const onTimePct = finished.length > 0
      ? Math.round((onTimeOrders.length / finished.length) * 100)
      : 100;

    // Scores berechnen
    const throughputRatio = historicAvgPerHour > 0
      ? ordersLast60Min / historicAvgPerHour
      : ordersLast60Min > 0 ? 1 : 0.5;
    const throughputScore = Math.round(Math.min(40, Math.max(0, throughputRatio * 40)));

    const overdueRatio = active.length > 0 ? overdue.length / active.length : 0;
    const queueHealthScore = Math.round(Math.max(0, 30 - overdueRatio * 30));

    const timingScore = Math.round((onTimePct / 100) * 30);

    const score = throughputScore + queueHealthScore + timingScore;

    const label: KitchenProduktivitaetsResponse['label'] =
      score >= 80 ? 'exzellent' :
      score >= 60 ? 'gut' :
      score >= 40 ? 'mittel' : 'schwach';

    // Vorherige Stunde für Trend
    const prevHourStart = new Date(now.getTime() - 120 * 60_000).toISOString();
    const { data: prevOrders } = await svc
      .from('customer_orders')
      .select('id')
      .eq('location_id', locationId)
      .gte('created_at', prevHourStart)
      .lt('created_at', since60m)
      .neq('status', 'storniert');
    const prevCount = ((prevOrders as { id: string }[] | null) ?? []).length;
    const trend: KitchenProduktivitaetsResponse['trend'] =
      ordersLast60Min > prevCount + 2 ? 'up' :
      ordersLast60Min < prevCount - 2 ? 'down' : 'flat';

    const recommendation =
      label === 'exzellent' ? 'Küche läuft optimal — weiter so!' :
      overdue.length > 2 ? `${overdue.length} Bestellungen überfällig — Kapazität prüfen.` :
      onTimePct < 70 ? 'Zubereitungszeiten überschritten — Priorisierung anpassen.' :
      ordersLast60Min < historicAvgPerHour * 0.5 ? 'Niedriger Durchsatz — evtl. Bestellvolumen-Prognose nutzen.' :
      'Leicht unter Zielwert — Monitoring fortsetzen.';

    return NextResponse.json<KitchenProduktivitaetsResponse>({
      ok: true,
      score,
      label,
      factors: {
        throughputScore,
        queueHealthScore,
        timingScore,
        ordersLast60Min,
        historicAvgPerHour,
        overdueCount: overdue.length,
        totalActiveCount: active.length,
        onTimePct,
      },
      trend,
      recommendation,
      generatedAt: now.toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
