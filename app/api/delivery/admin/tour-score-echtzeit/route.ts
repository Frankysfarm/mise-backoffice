/**
 * GET /api/delivery/admin/tour-score-echtzeit?location_id=...
 *
 * Phase 2717 — Tour-Score Echtzeit-Board (Dispatch)
 * Liefert Score-Daten aller aktiven Fahrer: Pünktlichkeit, Effizienz, Kundenzufriedenheit.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DriverScore {
  driver_id: string;
  driver_name: string;
  score: number;
  pünktlichkeit: number;
  effizienz: number;
  kundenzufriedenheit: number;
  touren_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const svc = createServiceClient();

    const { data: emp } = await svc
      .from('employees')
      .select('tenant_id, location_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!emp?.tenant_id) return NextResponse.json({ ok: false, error: 'No tenant' }, { status: 403 });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Online-Fahrer laden
    const { data: drivers } = await svc
      .from('employees')
      .select(`
        id, vorname, nachname,
        status:driver_status(ist_online)
      `)
      .eq('tenant_id', emp.tenant_id)
      .eq('rolle', 'fahrer')
      .eq('aktiv', true);

    // Abgeschlossene Bestellungen heute laden
    const { data: completedOrders } = await svc
      .from('customer_orders')
      .select('id, driver_id, geliefert_am, eta_latest, bewertung, abgeholt_am, fertig_am')
      .eq('tenant_id', emp.tenant_id)
      .eq('status', 'geliefert')
      .gte('geliefert_am', todayStart.toISOString())
      .not('driver_id', 'is', null);

    const ordersByDriver = new Map<string, typeof completedOrders>();
    for (const o of completedOrders ?? []) {
      if (!o.driver_id) continue;
      if (!ordersByDriver.has(o.driver_id)) ordersByDriver.set(o.driver_id, []);
      ordersByDriver.get(o.driver_id)!.push(o);
    }

    const driverScores: DriverScore[] = [];

    for (const driver of drivers ?? []) {
      const statusArr = Array.isArray(driver.status) ? driver.status : [driver.status];
      const isOnline = statusArr[0]?.ist_online === true;
      if (!isOnline) continue;

      const driverOrders = ordersByDriver.get(driver.id) ?? [];
      const touren = driverOrders.length;

      // Pünktlichkeit: Anteil pünktlich gelieferter Bestellungen
      const puenktlichCount = driverOrders.filter(o => {
        if (!o.geliefert_am || !o.eta_latest) return true;
        return new Date(o.geliefert_am) <= new Date(o.eta_latest);
      }).length;
      const puenktlichkeit = touren > 0 ? Math.round((puenktlichCount / touren) * 100) : 80;

      // Effizienz: Abholzeit (Fahrer nimmt Essen ab) vs. fertig_am
      const effizienzRatings = driverOrders.map(o => {
        if (!o.abgeholt_am || !o.fertig_am) return 80;
        const warteMin = (new Date(o.abgeholt_am).getTime() - new Date(o.fertig_am).getTime()) / 60_000;
        if (warteMin <= 3) return 100;
        if (warteMin <= 6) return 85;
        if (warteMin <= 10) return 70;
        return 55;
      });
      const effizienz = effizienzRatings.length > 0
        ? Math.round(effizienzRatings.reduce((a, b) => a + b, 0) / effizienzRatings.length)
        : 75;

      // Kundenzufriedenheit: Ø Bewertung → Score 0–100
      const ratings = driverOrders.filter(o => o.bewertung != null).map(o => o.bewertung as number);
      const kundenzufriedenheit = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length / 5) * 100)
        : 82;

      const score = Math.round(puenktlichkeit * 0.4 + effizienz * 0.35 + kundenzufriedenheit * 0.25);
      const trend: DriverScore['trend'] = score >= 85 ? 'steigend' : score >= 70 ? 'stabil' : 'fallend';

      driverScores.push({
        driver_id: driver.id,
        driver_name: `${driver.vorname} ${driver.nachname?.slice(0, 1) ?? ''}.`,
        score,
        pünktlichkeit: puenktlichkeit,
        effizienz,
        kundenzufriedenheit,
        touren_heute: touren,
        trend,
      });
    }

    driverScores.sort((a, b) => b.score - a.score);

    const teamAvg = driverScores.length > 0
      ? Math.round((driverScores.reduce((s, d) => s + d.score, 0) / driverScores.length) * 100) / 100
      : 0;

    const best = driverScores[0] ?? null;

    return NextResponse.json({
      ok: true,
      drivers: driverScores,
      team_avg_score: teamAvg,
      best_score: best?.score ?? 0,
      best_driver: best?.driver_name ?? '-',
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[tour-score-echtzeit]', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
