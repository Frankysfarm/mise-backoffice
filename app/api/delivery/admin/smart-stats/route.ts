/**
 * GET /api/delivery/admin/smart-stats?location_id=...
 *
 * SmartStatsCockpit — Konsolidiertes Statistiken-Dashboard (Lieferdienst)
 * Liefert 6 KPIs, Stundenverlauf und Live-Status für heute.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    const effLocationId = locationId && locationId !== 'all' ? locationId : emp.location_id;

    let ordersQuery = svc
      .from('customer_orders')
      .select('id, status, gesamtbetrag, geliefert_am, eta_latest, bestellt_am, bewertung, storniert_am')
      .eq('tenant_id', emp.tenant_id)
      .gte('bestellt_am', todayStart.toISOString());

    if (effLocationId) ordersQuery = ordersQuery.eq('location_id', effLocationId);

    const { data: todayOrders } = await ordersQuery;

    const allOrders = todayOrders ?? [];
    const deliveredOrders = allOrders.filter(o => o.status === 'geliefert');
    const cancelledOrders = allOrders.filter(o => o.status === 'storniert');

    // Lieferzeit Ø
    const lieferzeiten = deliveredOrders.map(o => {
      if (!o.geliefert_am || !o.bestellt_am) return null;
      return (new Date(o.geliefert_am).getTime() - new Date(o.bestellt_am).getTime()) / 60_000;
    }).filter((v): v is number => v !== null);
    const avgLieferzeit = lieferzeiten.length > 0
      ? Math.round(lieferzeiten.reduce((a, b) => a + b) / lieferzeiten.length)
      : 0;

    // Pünktlichkeit
    const puenktlichCount = deliveredOrders.filter(o => {
      if (!o.geliefert_am || !o.eta_latest) return true;
      return new Date(o.geliefert_am) <= new Date(o.eta_latest);
    }).length;
    const puenktlichkeitsRate = deliveredOrders.length > 0
      ? Math.round((puenktlichCount / deliveredOrders.length) * 100)
      : 100;

    // Tagesumsatz
    const umsatzCent = deliveredOrders.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
    const umsatzEur = umsatzCent / 100;

    // Kundenbewertung Ø
    const bewertungen = deliveredOrders.filter(o => o.bewertung != null).map(o => o.bewertung as number);
    const avgBewertung = bewertungen.length > 0
      ? Math.round((bewertungen.reduce((a, b) => a + b) / bewertungen.length) * 10) / 10
      : 0;

    // Storno-Quote
    const stornoRate = allOrders.length > 0
      ? Math.round((cancelledOrders.length / allOrders.length) * 1000) / 10
      : 0;

    // Aktive Fahrer
    const { data: onlineDrivers } = await svc
      .from('driver_status')
      .select('employee_id')
      .eq('ist_online', true);
    const aktiveFahrer = onlineDrivers?.length ?? 0;

    // Offene Bestellungen
    const offeneBestellungen = allOrders.filter(o =>
      ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'abgeholt', 'unterwegs'].includes(o.status)
    ).length;

    // Auslastung (heuristisch: Bestellungen / max. Kapazität)
    const maxKapazitaet = Math.max(aktiveFahrer * 3, 1);
    const auslastungPct = Math.min(100, Math.round((offeneBestellungen / maxKapazitaet) * 100));

    // Stunden-Verlauf
    const stundenMap = new Map<number, { bestellungen: number; umsatz: number }>();
    for (const o of allOrders) {
      const h = new Date(o.bestellt_am).getHours();
      if (!stundenMap.has(h)) stundenMap.set(h, { bestellungen: 0, umsatz: 0 });
      stundenMap.get(h)!.bestellungen += 1;
      if (o.status === 'geliefert') stundenMap.get(h)!.umsatz += (o.gesamtbetrag ?? 0) / 100;
    }

    const currentHour = new Date().getHours();
    const stundenVerlauf = Array.from({ length: Math.min(currentHour + 1, 24) }, (_, i) => ({
      stunde: String(i).padStart(2, '0'),
      bestellungen: stundenMap.get(i)?.bestellungen ?? 0,
      umsatz: Math.round(stundenMap.get(i)?.umsatz ?? 0),
    })).filter(s => s.bestellungen > 0 || parseInt(s.stunde) >= 10);

    const kpis = [
      {
        label: 'Lieferzeit Ø',
        wert: String(avgLieferzeit),
        einheit: 'min',
        trend: 0,
        ziel: '≤30 min',
        status: avgLieferzeit <= 30 ? 'gut' : avgLieferzeit <= 40 ? 'ok' : 'kritisch',
      },
      {
        label: 'Pünktlichkeit',
        wert: String(puenktlichkeitsRate),
        einheit: '%',
        trend: 0,
        ziel: '≥90%',
        status: puenktlichkeitsRate >= 90 ? 'gut' : puenktlichkeitsRate >= 75 ? 'ok' : 'kritisch',
      },
      {
        label: 'Tagesumsatz',
        wert: umsatzEur.toLocaleString('de-DE', { maximumFractionDigits: 0 }),
        einheit: '€',
        trend: 0,
        ziel: '≥1.500€',
        status: umsatzEur >= 1500 ? 'gut' : umsatzEur >= 800 ? 'ok' : 'kritisch',
      },
      {
        label: 'Kundenbewertung',
        wert: avgBewertung > 0 ? String(avgBewertung) : '-',
        einheit: '★',
        trend: 0,
        ziel: '≥4.5★',
        status: avgBewertung >= 4.5 ? 'gut' : avgBewertung >= 4.0 ? 'ok' : 'kritisch',
      },
      {
        label: 'Storno-Quote',
        wert: String(stornoRate),
        einheit: '%',
        trend: 0,
        ziel: '≤5%',
        status: stornoRate <= 5 ? 'gut' : stornoRate <= 10 ? 'ok' : 'kritisch',
      },
      {
        label: 'Auslastung',
        wert: String(auslastungPct),
        einheit: '%',
        trend: 0,
        ziel: '≥70%',
        status: auslastungPct >= 70 ? 'gut' : auslastungPct >= 50 ? 'ok' : 'kritisch',
      },
    ] as const;

    return NextResponse.json({
      ok: true,
      kpis,
      stunden_verlauf: stundenVerlauf,
      aktuell: {
        aktive_fahrer: aktiveFahrer,
        offene_bestellungen: offeneBestellungen,
        ø_lieferzeit_min: avgLieferzeit,
        tages_umsatz_eur: Math.round(umsatzEur),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[smart-stats]', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
