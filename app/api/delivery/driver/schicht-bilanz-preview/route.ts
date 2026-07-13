import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1244 — Schicht-Bilanz-Preview-API
// GET /api/delivery/driver/schicht-bilanz-preview?driver_id=<uuid>
// Fortlaufende Bilanz + Hochrechnung bis Schichtende

function buildMock(driverId: string) {
  const now = new Date();
  const startH = Math.max(8, now.getHours() - 3);
  const aktiveStunden = now.getHours() - startH + now.getMinutes() / 60;
  const verbleibendeStunden = Math.max(0, 8 - aktiveStunden);
  const stoppsBisher = Math.floor(aktiveStunden * 2.5);
  const einnahmenBisher = stoppsBisher * 7.5;
  const trinkgeldBisher = stoppsBisher * 1.2;
  const kmBisher = stoppsBisher * 3.5;
  const pace = aktiveStunden > 0 ? einnahmenBisher / aktiveStunden : 0;
  const prognoseEinnahmen = einnahmenBisher + pace * verbleibendeStunden;

  return {
    fahrer_id: driverId,
    schicht_start_uhr: `${startH.toString().padStart(2, '0')}:00`,
    schicht_ende_uhr: `${(startH + 8).toString().padStart(2, '0')}:00`,
    aktive_stunden: Math.round(aktiveStunden * 10) / 10,
    verbleibende_stunden: Math.round(verbleibendeStunden * 10) / 10,
    stopps_bisher: stoppsBisher,
    einnahmen_bisher_eur: Math.round(einnahmenBisher * 100) / 100,
    trinkgeld_bisher_eur: Math.round(trinkgeldBisher * 100) / 100,
    km_bisher: Math.round(kmBisher * 10) / 10,
    prognose_einnahmen_eur: Math.round(prognoseEinnahmen * 100) / 100,
    prognose_stopps: Math.round(stoppsBisher + (stoppsBisher / Math.max(aktiveStunden, 0.5)) * verbleibendeStunden),
    prognose_trinkgeld_eur: Math.round((trinkgeldBisher / Math.max(aktiveStunden, 0.5)) * (aktiveStunden + verbleibendeStunden) * 100) / 100,
    ziel_status: prognoseEinnahmen >= 160 ? 'gold' : prognoseEinnahmen >= 120 ? 'silber' : prognoseEinnahmen >= 80 ? 'bronze' : 'unter_bronze',
    generiert_am: now.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const driverId = request.nextUrl.searchParams.get('driver_id');
  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const now = new Date();

    // Get driver info + shift start
    const { data: driverStatus } = await supabase
      .from('mise_drivers')
      .select('employee_id, online_seit, schicht_start, schicht_ende')
      .eq('employee_id', driverId)
      .single();

    if (!driverStatus) {
      return NextResponse.json(buildMock(driverId));
    }

    const schichtStart = driverStatus.schicht_start
      ? new Date(driverStatus.schicht_start)
      : driverStatus.online_seit
      ? new Date(driverStatus.online_seit)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);

    const schichtEnde = driverStatus.schicht_ende
      ? new Date(driverStatus.schicht_ende)
      : new Date(schichtStart.getTime() + 8 * 3600 * 1000);

    const aktiveMs = now.getTime() - schichtStart.getTime();
    const gesamtMs = schichtEnde.getTime() - schichtStart.getTime();
    const aktiveStunden = Math.max(0, aktiveMs / 3600000);
    const verbleibendeStunden = Math.max(0, (gesamtMs - aktiveMs) / 3600000);

    // Get completed stops today
    const { data: stops } = await supabase
      .from('mise_delivery_stops')
      .select('id, delivered_at, order_value_eur, tip_eur, distance_km')
      .eq('driver_id', driverId)
      .gte('delivered_at', schichtStart.toISOString())
      .not('delivered_at', 'is', null);

    const stoppsBisher = stops?.length ?? 0;
    const einnahmenBisher = stops?.reduce((s, st) => s + (st.order_value_eur ?? 0), 0) ?? 0;
    const trinkgeldBisher = stops?.reduce((s, st) => s + (st.tip_eur ?? 0), 0) ?? 0;
    const kmBisher = stops?.reduce((s, st) => s + (st.distance_km ?? 0), 0) ?? 0;

    const pace = aktiveStunden > 0 ? einnahmenBisher / aktiveStunden : 0;
    const prognoseEinnahmen = einnahmenBisher + pace * verbleibendeStunden;
    const prognoseStopps = Math.round(stoppsBisher + (aktiveStunden > 0 ? (stoppsBisher / aktiveStunden) * verbleibendeStunden : 0));
    const prognoseTrinkgeld = aktiveStunden > 0 ? (trinkgeldBisher / aktiveStunden) * (aktiveStunden + verbleibendeStunden) : trinkgeldBisher;

    const fmtUhr = (d: Date) =>
      `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

    return NextResponse.json({
      fahrer_id: driverId,
      schicht_start_uhr: fmtUhr(schichtStart),
      schicht_ende_uhr: fmtUhr(schichtEnde),
      aktive_stunden: Math.round(aktiveStunden * 10) / 10,
      verbleibende_stunden: Math.round(verbleibendeStunden * 10) / 10,
      stopps_bisher: stoppsBisher,
      einnahmen_bisher_eur: Math.round(einnahmenBisher * 100) / 100,
      trinkgeld_bisher_eur: Math.round(trinkgeldBisher * 100) / 100,
      km_bisher: Math.round(kmBisher * 10) / 10,
      prognose_einnahmen_eur: Math.round(prognoseEinnahmen * 100) / 100,
      prognose_stopps: prognoseStopps,
      prognose_trinkgeld_eur: Math.round(prognoseTrinkgeld * 100) / 100,
      ziel_status: prognoseEinnahmen >= 160 ? 'gold' : prognoseEinnahmen >= 120 ? 'silber' : prognoseEinnahmen >= 80 ? 'bronze' : 'unter_bronze',
      generiert_am: now.toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
