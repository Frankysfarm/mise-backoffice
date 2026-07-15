/**
 * GET /api/delivery/driver/stopp-abbrueche
 *
 * Phase 1806 — Stopp-Abbruch-Tracker-API (Backend)
 * Abgebrochene Stopps je Fahrer + Grund (nicht_zuhause/falsches_paket/kunde_abwesend);
 * Trend letzte 7 Tage; Multi-Tenant; Supabase + Mock-Fallback.
 *
 * Query-Params:
 *   driver_id=<uuid>    — einzelner Fahrer (für Fahrer-App)
 *   location_id=<uuid>  — alle Fahrer einer Location (für Dispatch-Monitor)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type AbbruchGrund = 'nicht_zuhause' | 'falsches_paket' | 'kunde_abwesend' | 'unbekannt';
export type AbbruchTrend = 'steigend' | 'fallend' | 'stabil';

export interface AbbruchEintrag {
  stopp_id: string;
  bestellung_id: string;
  adresse: string;
  grund: AbbruchGrund;
  abgebrochen_am: string;
  tour_id: string | null;
}

export interface FahrerAbbruchStatistik {
  fahrer_id: string;
  name: string;
  /** Gesamtanzahl Abbrüche letzte 7 Tage */
  abbrueche_7_tage: number;
  /** Abbruchquote in Prozent (abgebrochen / gesamt * 100) */
  quote_pct: number;
  /** Aufschlüsselung nach Grund */
  nach_grund: Record<AbbruchGrund, number>;
  /** Abbrüche je Tag letzte 7 Tage (Index 0 = heute, 6 = vor 7 Tagen) */
  verlauf_7_tage: number[];
  trend: AbbruchTrend;
  /** Detaillierte letzte Einträge (max. 5) */
  letzte_abbrueche: AbbruchEintrag[];
}

export interface StoppAbbruchAntwort {
  location_id: string | null;
  fahrer: FahrerAbbruchStatistik[];
  /** Location-weite Abbruchquote */
  gesamt_quote_pct: number;
  /** Alert wenn Gesamt-Quote > 10% */
  quote_alert: boolean;
  generiert_am: string;
}

const GRUENDE: AbbruchGrund[] = ['nicht_zuhause', 'falsches_paket', 'kunde_abwesend', 'unbekannt'];

function trendFromVerlauf(verlauf: number[]): AbbruchTrend {
  if (verlauf.length < 2) return 'stabil';
  const neuest = verlauf[0];
  const aeltester = verlauf[verlauf.length - 1];
  const delta = neuest - aeltester;
  if (delta > 0.5) return 'steigend';
  if (delta < -0.5) return 'fallend';
  return 'stabil';
}

function buildMockEintraege(fahrerIdx: number, seed: number): AbbruchEintrag[] {
  const adressen = [
    'Hauptstraße 12, 52062 Aachen',
    'Burtscheider Str. 7, 52066 Aachen',
    'Karlsgraben 15, 52064 Aachen',
    'Jülicher Str. 22, 52070 Aachen',
    'Roermonder Str. 44, 52072 Aachen',
  ];
  const count = ((seed * (fahrerIdx + 2)) % 4) + 1;
  return Array.from({ length: count }, (_, i) => ({
    stopp_id: `mock-stop-${fahrerIdx}-${i}`,
    bestellung_id: `mock-order-${fahrerIdx}-${i}`,
    adresse: adressen[(fahrerIdx + i) % adressen.length],
    grund: GRUENDE[((seed * (fahrerIdx + i + 1)) % GRUENDE.length)],
    abgebrochen_am: new Date(
      Date.now() - ((fahrerIdx * 3 + i) * 60 + 30) * 60_000,
    ).toISOString(),
    tour_id: `mock-tour-${fahrerIdx}`,
  }));
}

function buildMock(locationId: string | null, driverId: string | null): StoppAbbruchAntwort {
  const seed = (locationId ?? driverId ?? 'x').charCodeAt(0) || 65;
  const names = ['Ana Müller', 'Ben Koch', 'Clara Braun', 'Dario Schütz', 'Eva Lange'];

  const allFahrer = names.map((name, i) => {
    const abbrueche = ((seed * (i + 3)) % 5) + 1;
    const gesamt = abbrueche + ((seed * (i + 1)) % 10) + 8;
    const quote = Math.round((abbrueche / gesamt) * 100);

    const nach_grund: Record<AbbruchGrund, number> = {
      nicht_zuhause: Math.round(abbrueche * 0.4),
      falsches_paket: Math.round(abbrueche * 0.2),
      kunde_abwesend: Math.round(abbrueche * 0.3),
      unbekannt: abbrueche - Math.round(abbrueche * 0.4) - Math.round(abbrueche * 0.2) - Math.round(abbrueche * 0.3),
    };
    // ensure no negative values
    nach_grund.unbekannt = Math.max(0, nach_grund.unbekannt);

    const verlauf_7_tage = Array.from({ length: 7 }, (_, d) =>
      Math.max(0, Math.round(abbrueche / 7 + ((seed * (i + d + 1)) % 3) - 1)),
    );

    return {
      fahrer_id: driverId ?? `mock-driver-${i}`,
      name,
      abbrueche_7_tage: abbrueche,
      quote_pct: quote,
      nach_grund,
      verlauf_7_tage,
      trend: trendFromVerlauf(verlauf_7_tage),
      letzte_abbrueche: buildMockEintraege(i, seed),
    };
  });

  const selectedFahrer = driverId ? [allFahrer[0]] : allFahrer;
  const gesamt_quote =
    selectedFahrer.length > 0
      ? Math.round(
          selectedFahrer.reduce((s, f) => s + f.quote_pct, 0) / selectedFahrer.length,
        )
      : 0;

  return {
    location_id: locationId,
    fahrer: selectedFahrer,
    gesamt_quote_pct: gesamt_quote,
    quote_alert: gesamt_quote > 10,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  const driverId = req.nextUrl.searchParams.get('driver_id');

  if (!locationId && !driverId) {
    return NextResponse.json(
      { error: 'location_id oder driver_id erforderlich' },
      { status: 400 },
    );
  }

  try {
    const sb = await createClient();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();

    // Query abgebrochene Stopps aus delivery_batch_stops (falls Tabelle existiert)
    let query = sb
      .from('delivery_batch_stops')
      .select(
        'id, order_id, address, abort_reason, aborted_at, batch_id, driver_id, location_id',
      )
      .eq('status', 'aborted')
      .gte('aborted_at', since7d)
      .order('aborted_at', { ascending: false });

    if (locationId) query = query.eq('location_id', locationId);
    if (driverId) query = query.eq('driver_id', driverId);

    const { data: stops, error } = await query.limit(200);

    if (error || !stops || stops.length === 0) {
      return NextResponse.json(buildMock(locationId, driverId));
    }

    // Fahrernamen aus drivers-Tabelle laden
    const driverIds = [...new Set(stops.map((s) => s.driver_id).filter(Boolean) as string[])];
    const { data: drivers } = await sb
      .from('drivers')
      .select('id, name')
      .in('id', driverIds);

    const driverNameMap = new Map<string, string>(
      (drivers ?? []).map((d) => [d.id as string, d.name as string]),
    );

    // Aggregation je Fahrer
    const fahrerMap = new Map<string, FahrerAbbruchStatistik>();

    for (const stop of stops) {
      const fId = (stop.driver_id as string) ?? 'unbekannt';
      if (!fahrerMap.has(fId)) {
        fahrerMap.set(fId, {
          fahrer_id: fId,
          name: driverNameMap.get(fId) ?? 'Unbekannt',
          abbrueche_7_tage: 0,
          quote_pct: 0,
          nach_grund: { nicht_zuhause: 0, falsches_paket: 0, kunde_abwesend: 0, unbekannt: 0 },
          verlauf_7_tage: Array(7).fill(0),
          trend: 'stabil',
          letzte_abbrueche: [],
        });
      }
      const stat = fahrerMap.get(fId)!;
      stat.abbrueche_7_tage += 1;

      const grund = (stop.abort_reason as AbbruchGrund | null) ?? 'unbekannt';
      const validGrund: AbbruchGrund = GRUENDE.includes(grund) ? grund : 'unbekannt';
      stat.nach_grund[validGrund] += 1;

      // Tag-Index (0 = heute)
      const abortedAt = stop.aborted_at ? new Date(stop.aborted_at as string) : new Date();
      const daysAgo = Math.min(
        6,
        Math.floor((Date.now() - abortedAt.getTime()) / (24 * 60 * 60_000)),
      );
      stat.verlauf_7_tage[daysAgo] += 1;

      if (stat.letzte_abbrueche.length < 5) {
        stat.letzte_abbrueche.push({
          stopp_id: stop.id as string,
          bestellung_id: stop.order_id as string,
          adresse: (stop.address as string) ?? '',
          grund: validGrund,
          abgebrochen_am: stop.aborted_at as string,
          tour_id: stop.batch_id as string | null,
        });
      }
    }

    // Gesamtlieferungen je Fahrer für Quote laden
    const { data: totalStops } = await sb
      .from('delivery_batch_stops')
      .select('driver_id, count:id')
      .gte('created_at', since7d)
      .in('driver_id', driverIds);

    const totalMap = new Map<string, number>(
      (totalStops ?? []).map((r) => [r.driver_id as string, Number(r.count)]),
    );

    const fahrer = Array.from(fahrerMap.values()).map((stat) => {
      const total = totalMap.get(stat.fahrer_id) ?? stat.abbrueche_7_tage;
      const quote = total > 0 ? Math.round((stat.abbrueche_7_tage / total) * 100) : 0;
      return {
        ...stat,
        quote_pct: quote,
        trend: trendFromVerlauf(stat.verlauf_7_tage),
      };
    });

    const gesamt_quote =
      fahrer.length > 0
        ? Math.round(fahrer.reduce((s, f) => s + f.quote_pct, 0) / fahrer.length)
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      gesamt_quote_pct: gesamt_quote,
      quote_alert: gesamt_quote > 10,
      generiert_am: new Date().toISOString(),
    } satisfies StoppAbbruchAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
